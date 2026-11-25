//! Kanały sterowania IPC dla środowisk Linuksa (Hyprland, Sway, i3, Waybar, Polybar, Bash, Rofi).
//!
//! Oba punkty wejściowe leżą w prywatnym katalogu uruchomieniowym (zob. [`crate::runtime_dir`]):
//! 1. Nazwany potok FIFO `$XDG_RUNTIME_DIR/auralune/ctl`: sterowanie z dowolnego skryptu powłoki,
//!    np. `echo next > "$XDG_RUNTIME_DIR/auralune/ctl"`.
//! 2. Gniazdo Unix `$XDG_RUNTIME_DIR/auralune/auralune.sock`: dwukierunkowy interfejs dla
//!    `socat`, `nc -U` lub aplikacji klienckich.

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

/// Maksymalna długość jednego polecenia (bajty). Dłuższe linie zamykają połączenie.
const MAX_COMMAND_LEN: u64 = 256;
/// Maksymalna liczba jednoczesnych połączeń z gniazdem sterowania.
const MAX_SOCKET_CONNECTIONS: usize = 8;

/// Kontroler IPC sterowania odtwarzaczem.
pub struct ControlIpcServer {
    engine: Arc<AudioEngine>,
    running: Arc<AtomicBool>,
    shutdown: Arc<Notify>,
    fifo_path: PathBuf,
    socket_path: PathBuf,
}

impl ControlIpcServer {
    /// Tworzy nową instancję serwera IPC.
    pub fn new(engine: Arc<AudioEngine>) -> Self {
        Self {
            engine,
            running: Arc::new(AtomicBool::new(true)),
            shutdown: Arc::new(Notify::new()),
            fifo_path: runtime_dir::control_fifo_path(),
            socket_path: runtime_dir::control_socket_path(),
        }
    }

    /// Uruchamia nasłuchiwanie na kolejce FIFO oraz gnieździe Unix Socket.
    pub fn start(&self, rt: &tokio::runtime::Runtime) {
        if let Err(e) = runtime_dir::ensure_runtime_dir() {
            warn!(
                "Prywatny katalog IPC niedostępny ({}) — pomijam IPC sterowania",
                e
            );
            return;
        }

        // 1. FIFO w osobnym wątku blokującym (otwarcie FIFO blokuje do pojawienia się piszącego).
        let running_flag = self.running.clone();
        let engine_for_fifo = self.engine.clone();
        let fifo_path = self.fifo_path.clone();
        if let Err(e) = std::thread::Builder::new()
            .name("auralune-fifo-ipc".into())
            .spawn(move || {
                Self::run_fifo_listener(engine_for_fifo, running_flag, &fifo_path);
            })
        {
            error!("Błąd tworzenia wątku nasłuchu FIFO IPC: {}", e);
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
            "Zainicjalizowano IPC sterowania: FIFO={} oraz Socket={}",
            self.fifo_path.display(),
            self.socket_path.display()
        );
    }

    /// Pętla obsługi kolejki FIFO.
    fn run_fifo_listener(engine: Arc<AudioEngine>, running: Arc<AtomicBool>, fifo_path: &Path) {
        // Usuń stare FIFO, jeśli istnieje (katalog jest prywatny, więc to nasz plik).
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
                    "mkfifo {} zakończył się kodem {:?} — IPC FIFO niedostępne",
                    fifo_path.display(),
                    s.code()
                );
                return;
            }
            Err(e) => {
                warn!(
                    "Nie udało się uruchomić mkfifo dla {}: {} — IPC FIFO niedostępne",
                    fifo_path.display(),
                    e
                );
                return;
            }
        }
        if !is_own_private_fifo(fifo_path) {
            warn!(
                "{} nie jest prywatną kolejką FIFO bieżącego użytkownika — pomijam IPC FIFO",
                fifo_path.display()
            );
            return;
        }

        info!(
            "Kolejka FIFO gotowa do odbioru poleceń: {}",
            fifo_path.display()
        );

        while running.load(Ordering::Relaxed) {
            // Otwarcie FIFO w trybie tylko do odczytu blokuje wątek do momentu otwarcia przez
            // piszącego; `stop()` budzi je, otwierając FIFO do zapisu.
            match fs::OpenOptions::new().read(true).open(fifo_path) {
                Ok(file) => {
                    let mut reader = BufReader::new(file);
                    let mut line = String::new();
                    while running.load(Ordering::Relaxed) {
                        line.clear();
                        match (&mut reader).take(MAX_COMMAND_LEN + 1).read_line(&mut line) {
                            Ok(0) | Err(_) => break,
                            Ok(_) if line.len() as u64 > MAX_COMMAND_LEN => {
                                warn!("Zbyt długie polecenie FIFO — odrzucono");
                                break;
                            }
                            Ok(_) => {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    debug!("Odebrano polecenie z FIFO: '{}'", trimmed);
                                    Self::execute_command(&engine, trimmed);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    if running.load(Ordering::Relaxed) {
                        debug!("Błąd otwarcia FIFO: {}", e);
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                }
            }
        }

        let _ = fs::remove_file(fifo_path);
    }

    /// Pętla obsługi Unix Domain Socket.
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
                warn!(
                    "Nie udało się powiązać socketu {}: {}",
                    socket_path.display(),
                    e
                );
                return;
            }
        };
        // Socket tylko dla bieżącego użytkownika (katalog i tak ma 0700).
        if let Err(e) = fs::set_permissions(socket_path, fs::Permissions::from_mode(0o600)) {
            warn!(
                "Nie udało się ograniczyć uprawnień socketu {}: {}",
                socket_path.display(),
                e
            );
        }

        info!(
            "Gniazdo Unix Socket gotowe do odbioru poleceń: {}",
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
                    debug!("Błąd accept na socket IPC: {}", e);
                    continue;
                }
            };
            let Ok(permit) = connections.clone().try_acquire_owned() else {
                warn!("Za dużo połączeń z gniazdem sterowania — odrzucono");
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

    /// Obsługuje jedno połączenie: polecenie w linii → odpowiedź w linii.
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
            debug!("Odebrano polecenie z Socket: '{}'", trimmed);
            // Polecenia transportu blokują (mikro-fade'y) — poza wątkiem Tokio.
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

    /// Wykonuje polecenie tekstowe na silniku audio.
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

    /// Kończy działanie serwera: budzi oba nasłuchy i usuwa pliki IPC.
    pub fn stop(&self) {
        if !self.running.swap(false, Ordering::Relaxed) {
            return;
        }
        // Gniazdo: przerwij `accept()` (permit zostaje zapamiętany, jeśli pętla jeszcze nie czeka).
        self.shutdown.notify_one();
        // FIFO: wątek czeka w blokującym `open()` do odczytu — nieblokujące otwarcie do zapisu
        // je budzi; gdy nikt nie czyta, zwraca od razu ENXIO.
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

/// Czy `path` to FIFO (nie dowiązanie) należące do bieżącego użytkownika, bez dostępu dla innych.
fn is_own_private_fifo(path: &Path) -> bool {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return false;
    };
    meta.file_type().is_fifo()
        && Some(meta.uid()) == runtime_dir::current_uid()
        && meta.mode() & 0o077 == 0
}
