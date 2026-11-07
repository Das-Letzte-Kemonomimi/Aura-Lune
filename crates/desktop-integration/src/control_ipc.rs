//! Kanały sterowania IPC dla środowisk Linuksa (Hyprland, Sway, i3, Waybar, Polybar, Bash, Rofi).
//!
//! Udostępnia dwa punkty wejściowe:
//! 1. Nazwany potok FIFO `/tmp/auralune_ctl`: pozwala na sterowanie z dowolnego skryptu powłoki,
//!    np. `echo "play_pause" > /tmp/auralune_ctl` lub `echo "next" > /tmp/auralune_ctl`.
//! 2. Lokalny socket Unix Domain Socket `/tmp/auralune.sock`: dwukierunkowy interfejs dla narzędzi `socat`, `nc -U` lub aplikacji klienckich.

use audio_engine::AudioEngine;
use domain::PlaybackState;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as TokioBufReader};
use tokio::net::UnixListener;
use tracing::{debug, error, info, warn};

pub const DEFAULT_FIFO_PATH: &str = "/tmp/auralune_ctl";
pub const DEFAULT_SOCKET_PATH: &str = "/tmp/auralune.sock";

/// Kontroler IPC sterowania odtwarzaczem.
pub struct ControlIpcServer {
    engine: Arc<AudioEngine>,
    running: Arc<AtomicBool>,
}

impl ControlIpcServer {
    /// Tworzy nową instancję serwera IPC.
    pub fn new(engine: Arc<AudioEngine>) -> Self {
        Self {
            engine,
            running: Arc::new(AtomicBool::new(true)),
        }
    }

    /// Uruchamia nasłuchiwanie na kolejce FIFO oraz gnieździe Unix Socket.
    pub fn start(&self, rt: &tokio::runtime::Runtime) {
        let running_flag = self.running.clone();
        let engine_for_fifo = self.engine.clone();
        let engine_for_sock = self.engine.clone();

        // 1. Inicjalizacja FIFO /tmp/auralune_ctl w osobnym wątku blokującym (OS FIFO)
        if let Err(e) = std::thread::Builder::new()
            .name("auralune-fifo-ipc".into())
            .spawn(move || {
                Self::run_fifo_listener(engine_for_fifo, running_flag, DEFAULT_FIFO_PATH);
            })
        {
            error!("Błąd tworzenia wątku nasłuchu FIFO IPC: {}", e);
        }

        // 2. Inicjalizacja Unix Domain Socket /tmp/auralune.sock na runtime Tokio
        let running_flag_sock = self.running.clone();
        rt.spawn(async move {
            Self::run_socket_listener(engine_for_sock, running_flag_sock, DEFAULT_SOCKET_PATH)
                .await;
        });

        info!(
            "Zainicjalizowano IPC sterowania: FIFO={} oraz Socket={}",
            DEFAULT_FIFO_PATH, DEFAULT_SOCKET_PATH
        );
    }

    /// Pętla obsługi kolejki FIFO.
    fn run_fifo_listener(engine: Arc<AudioEngine>, running: Arc<AtomicBool>, fifo_path: &str) {
        // Usuń stare FIFO, jeśli istnieje
        let p = Path::new(fifo_path);
        if p.exists() {
            let _ = fs::remove_file(p);
        }

        // Utwórz FIFO przez polecenie systemowe `mkfifo`
        let status = Command::new("mkfifo").arg(fifo_path).status();
        if let Err(e) = status {
            warn!(
                "Nie udało się utworzyć FIFO {}: {}. IPC FIFO może być niedostępne.",
                fifo_path, e
            );
            return;
        }

        info!("Kolejka FIFO gotowa do odbioru poleceń: {}", fifo_path);

        while running.load(Ordering::Relaxed) {
            // Otwarcie FIFO w trybie tylko do odczytu blokuje wątek do momentu otwarcia przez piszącego
            match fs::OpenOptions::new().read(true).open(fifo_path) {
                Ok(file) => {
                    let reader = BufReader::new(file);
                    for line in reader.lines() {
                        match line {
                            Ok(cmd) => {
                                let trimmed = cmd.trim();
                                if !trimmed.is_empty() {
                                    debug!("Odebrano polecenie z FIFO: '{}'", trimmed);
                                    Self::execute_command(&engine, trimmed);
                                }
                            }
                            Err(_) => break,
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
        socket_path: &str,
    ) {
        let p = Path::new(socket_path);
        if p.exists() {
            let _ = fs::remove_file(p);
        }

        let listener = match UnixListener::bind(socket_path) {
            Ok(l) => l,
            Err(e) => {
                warn!("Nie udało się powiązać socketu {}: {}", socket_path, e);
                return;
            }
        };

        info!(
            "Gniazdo Unix Socket gotowe do odbioru poleceń: {}",
            socket_path
        );

        while running.load(Ordering::Relaxed) {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let engine_clone = engine.clone();
                    tokio::spawn(async move {
                        let (read_half, mut write_half) = stream.into_split();
                        let reader = TokioBufReader::new(read_half);
                        let mut lines = reader.lines();

                        while let Ok(Some(line)) = lines.next_line().await {
                            let trimmed = line.trim();
                            if trimmed.is_empty() {
                                continue;
                            }
                            debug!("Odebrano polecenie z Socket: '{}'", trimmed);
                            let response = Self::execute_command(&engine_clone, trimmed);
                            let _ = write_half
                                .write_all(format!("{}\n", response).as_bytes())
                                .await;
                        }
                    });
                }
                Err(e) => {
                    if running.load(Ordering::Relaxed) {
                        debug!("Błąd accept na socket IPC: {}", e);
                    }
                }
            }
        }

        let _ = fs::remove_file(socket_path);
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

    /// Kończy działanie serwera i usuwa pliki tymczasowe.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
        let _ = fs::remove_file(DEFAULT_FIFO_PATH);
        let _ = fs::remove_file(DEFAULT_SOCKET_PATH);
    }
}

impl Drop for ControlIpcServer {
    fn drop(&mut self) {
        self.stop();
    }
}
