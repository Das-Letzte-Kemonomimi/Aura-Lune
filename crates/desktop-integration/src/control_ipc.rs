//! IPC control channels for Linux environments (Hyprland, Sway, i3, Waybar, Polybar, Bash, Rofi).
//!
//! Both entry points live in the private runtime directory (see [`crate::runtime_dir`]):
//! 1. The named FIFO pipe `$XDG_RUNTIME_DIR/auralune/ctl`: control from any shell script,
//!    e.g. `echo next > "$XDG_RUNTIME_DIR/auralune/ctl"`.
//! 2. The Unix socket `$XDG_RUNTIME_DIR/auralune/auralune.sock`: a two-way interface for
//!    `socat`, `nc -U` or client apps.

use crate::runtime_dir;
use audio_engine::AudioEngine;
use domain::PlaybackState;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::os::unix::fs::{FileTypeExt, MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader as TokioBufReader};
use tokio::net::UnixListener;
use tokio::sync::{Notify, Semaphore};
use tracing::{debug, error, info, warn};

/// Maximum length of one command (bytes). Longer lines close the connection.
const MAX_COMMAND_LEN: u64 = 256;
/// Maximum number of simultaneous connections to the control socket.
const MAX_SOCKET_CONNECTIONS: usize = 8;

/// IPC controller for controlling the player.
pub struct ControlIpcServer {
    engine: Arc<AudioEngine>,
    running: Arc<AtomicBool>,
    shutdown: Arc<Notify>,
    fifo_path: PathBuf,
    socket_path: PathBuf,
}

impl ControlIpcServer {
    /// Creates a new IPC server instance.
    pub fn new(engine: Arc<AudioEngine>) -> Self {
        Self {
            engine,
            running: Arc::new(AtomicBool::new(true)),
            shutdown: Arc::new(Notify::new()),
            fifo_path: runtime_dir::control_fifo_path(),
            socket_path: runtime_dir::control_socket_path(),
        }
    }

    /// Starts listening on the FIFO and the Unix socket.
    pub fn start(&self, rt: &tokio::runtime::Runtime) {
        if let Err(e) = runtime_dir::ensure_runtime_dir() {
            warn!(
                "Private IPC directory unavailable ({}), skipping control IPC",
                e
            );
            return;
        }

        // 1. FIFO on its own blocking thread (opening a FIFO blocks until a writer appears).
        let running_flag = self.running.clone();
        let engine_for_fifo = self.engine.clone();
        let fifo_path = self.fifo_path.clone();
        if let Err(e) = std::thread::Builder::new()
            .name("auralune-fifo-ipc".into())
            .spawn(move || {
                Self::run_fifo_listener(engine_for_fifo, running_flag, &fifo_path);
            })
        {
            error!("Failed to spawn the IPC FIFO listener thread: {}", e);
        }

        // 2. Unix Domain Socket na runtime Tokio.
        let running_flag_sock = self.running.clone();
        let shutdown = self.shutdown.clone();
        let engine_for_sock = self.engine.clone();
        let socket_path = self.socket_path.clone();
        rt.spawn(async move {
            Self::run_socket_listener(engine_for_sock, running_flag_sock, shutdown, &socket_path)
                .await;
        });

        info!(
            "Control IPC initialised: FIFO={} and Socket={}",
            self.fifo_path.display(),
            self.socket_path.display()
        );
    }

    /// FIFO handling loop.
    fn run_fifo_listener(engine: Arc<AudioEngine>, running: Arc<AtomicBool>, fifo_path: &Path) {
        // Remove a stale FIFO if it exists (the directory is private, so the file is ours).
        let _ = fs::remove_file(fifo_path);

        match Command::new("mkfifo")
            .arg("-m")
            .arg("600")
            .arg("--")
            .arg(fifo_path)
            .status()
        {
            Ok(s) if s.success() => {}
            Ok(s) => {
                warn!(
                    "mkfifo {} exited with code {:?}, IPC FIFO unavailable",
                    fifo_path.display(),
                    s.code()
                );
                return;
            }
            Err(e) => {
                warn!(
                    "Failed to run mkfifo for {}: {}, IPC FIFO unavailable",
                    fifo_path.display(),
                    e
                );
                return;
            }
        }
        if !is_own_private_fifo(fifo_path) {
            warn!(
                "{} is not a private FIFO of the current user, skipping the IPC FIFO",
                fifo_path.display()
            );
            return;
        }

        info!("FIFO ready to receive commands: {}", fifo_path.display());

        while running.load(Ordering::Relaxed) {
            // Opening the FIFO read-only blocks the thread until a writer opens it;
            // `stop()` wakes it by opening the FIFO for writing.
            match fs::OpenOptions::new().read(true).open(fifo_path) {
                Ok(file) => {
                    let mut reader = BufReader::new(file);
                    let mut line = String::new();
                    while running.load(Ordering::Relaxed) {
                        line.clear();
                        match (&mut reader).take(MAX_COMMAND_LEN + 1).read_line(&mut line) {
                            Ok(0) | Err(_) => break,
                            Ok(_) if line.len() as u64 > MAX_COMMAND_LEN => {
                                warn!("FIFO command too long, rejected");
                                break;
                            }
                            Ok(_) => {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    debug!("Received command from FIFO: '{}'", trimmed);
                                    Self::execute_command(&engine, trimmed);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    if running.load(Ordering::Relaxed) {
                        debug!("Failed to open the FIFO: {}", e);
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                }
            }
        }

        let _ = fs::remove_file(fifo_path);
    }

    /// Unix domain socket handling loop.
    async fn run_socket_listener(
        engine: Arc<AudioEngine>,
        running: Arc<AtomicBool>,
        shutdown: Arc<Notify>,
        socket_path: &Path,
    ) {
        let _ = fs::remove_file(socket_path);

        let listener = match UnixListener::bind(socket_path) {
            Ok(l) => l,
            Err(e) => {
                warn!("Failed to bind socket {}: {}", socket_path.display(), e);
                return;
            }
        };
        // Socket for the current user only (the directory is 0700 anyway).
        if let Err(e) = fs::set_permissions(socket_path, fs::Permissions::from_mode(0o600)) {
            warn!(
                "Failed to restrict the permissions of socket {}: {}",
                socket_path.display(),
                e
            );
        }

        info!(
            "Unix socket ready to receive commands: {}",
            socket_path.display()
        );

        let connections = Arc::new(Semaphore::new(MAX_SOCKET_CONNECTIONS));
        while running.load(Ordering::Relaxed) {
            let accepted = tokio::select! {
                res = listener.accept() => res,
                () = shutdown.notified() => break,
            };
            let stream = match accepted {
                Ok((stream, _)) => stream,
                Err(e) => {
                    debug!("accept error on the IPC socket: {}", e);
                    continue;
                }
            };
            let Ok(permit) = connections.clone().try_acquire_owned() else {
                warn!("Too many connections to the control socket, rejected");
                continue;
            };
            let engine_clone = engine.clone();
            tokio::spawn(async move {
                let _permit = permit;
                Self::serve_socket_connection(engine_clone, stream).await;
            });
        }

        let _ = fs::remove_file(socket_path);
    }

    /// Handles one connection: one command per line → one response per line.
    async fn serve_socket_connection(engine: Arc<AudioEngine>, stream: tokio::net::UnixStream) {
        let (read_half, mut write_half) = stream.into_split();
        let mut reader = TokioBufReader::new(read_half);
        let mut line = String::new();
        loop {
            line.clear();
            match (&mut reader)
                .take(MAX_COMMAND_LEN + 1)
                .read_line(&mut line)
                .await
            {
                Ok(0) | Err(_) => break,
                Ok(_) if line.len() as u64 > MAX_COMMAND_LEN => {
                    let _ = write_half.write_all(b"ERR: COMMAND_TOO_LONG\n").await;
                    break;
                }
                Ok(_) => {}
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            debug!("Received command from socket: '{}'", trimmed);
            // Transport commands block (micro-fades), so they run off the Tokio thread.
            let engine = engine.clone();
            let cmd = trimmed.to_string();
            let response =
                tokio::task::spawn_blocking(move || Self::execute_command(&engine, &cmd))
                    .await
                    .unwrap_or("ERR");
            if write_half
                .write_all(format!("{}\n", response).as_bytes())
                .await
                .is_err()
            {
                break;
            }
        }
    }

    /// Runs a text command on the audio engine.
    pub fn execute_command(engine: &Arc<AudioEngine>, cmd: &str) -> &'static str {
        let lower = cmd.to_lowercase();
        let parts: Vec<&str> = lower.split_whitespace().collect();
        let action = parts.first().copied().unwrap_or("");

        match action {
            "play" => {
                let _ = engine.play();
                "OK: PLAY"
            }
            "pause" => {
                let _ = engine.pause();
                "OK: PAUSE"
            }
            "play_pause" | "play-pause" | "toggle" => {
                if engine.state() == PlaybackState::Playing {
                    let _ = engine.pause();
                    "OK: TOGGLE -> PAUSED"
                } else {
                    let _ = engine.play();
                    "OK: TOGGLE -> PLAYING"
                }
            }
            "stop" => {
                let _ = engine.stop();
                "OK: STOP"
            }
            "next" => {
                let _ = engine.play_next();
                "OK: NEXT"
            }
            "prev" | "previous" => {
                let _ = engine.play_previous();
                "OK: PREVIOUS"
            }
            "vol_up" | "vol-up" | "volume_up" | "volume-up" => {
                let curr = engine.volume();
                let next = (curr + 0.05).min(1.0);
                let _ = engine.set_volume(next);
                "OK: VOLUME_UP"
            }
            "vol_down" | "vol-down" | "volume_down" | "volume-down" => {
                let curr = engine.volume();
                let next = (curr - 0.05).max(0.0);
                let _ = engine.set_volume(next);
                "OK: VOLUME_DOWN"
            }
            "mute" | "toggle_mute" => {
                let curr = engine.volume();
                if curr > 0.001 {
                    let _ = engine.set_volume(0.0);
                    "OK: MUTED"
                } else {
                    let _ = engine.set_volume(1.0);
                    "OK: UNMUTED"
                }
            }
            "seek" => {
                if let Some(arg) = parts.get(1) {
                    if let Ok(offset_secs) = arg.parse::<i64>() {
                        let curr_pos = engine.position().map(|d| d.as_secs() as i64).unwrap_or(0);
                        let dur = engine.duration().map(|d| d.as_secs() as i64).unwrap_or(3600);
                        let target = (curr_pos + offset_secs).clamp(0, dur) as u64;
                        let _ = engine.seek(std::time::Duration::from_secs(target));
                        "OK: SEEK"
                    } else {
                        "ERR: INVALID_SEEK_ARG"
                    }
                } else {
                    "ERR: MISSING_SEEK_ARG"
                }
            }
            "ping" => "PONG: AURALUNE_IPC_OK",
            _ => "ERR: UNKNOWN_COMMAND (available: play, pause, toggle, next, prev, stop, vol_up, vol_down, mute, seek <+-secs>, ping)",
        }
    }

    /// Shuts the server down: wakes both listeners and removes the IPC files.
    pub fn stop(&self) {
        if !self.running.swap(false, Ordering::Relaxed) {
            return;
        }
        // Socket: interrupt `accept()` (the permit is remembered if the loop is not waiting yet).
        self.shutdown.notify_one();
        // FIFO: the thread waits in a blocking read `open()`; a non-blocking open for writing
        // wakes it, and when nobody reads it returns ENXIO immediately.
        let _ = fs::OpenOptions::new()
            .write(true)
            .custom_flags(libc::O_NONBLOCK)
            .open(&self.fifo_path);
        let _ = fs::remove_file(&self.fifo_path);
        let _ = fs::remove_file(&self.socket_path);
    }
}

impl Drop for ControlIpcServer {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Whether `path` is a FIFO (not a link) owned by the current user, with no access for others.
fn is_own_private_fifo(path: &Path) -> bool {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return false;
    };
    meta.file_type().is_fifo()
        && Some(meta.uid()) == runtime_dir::current_uid()
        && meta.mode() & 0o077 == 0
}
