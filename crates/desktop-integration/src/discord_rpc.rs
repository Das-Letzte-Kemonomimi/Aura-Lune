//! Klient Discord Rich Presence (RPC) dla Linuksa.
//!
//! Komunikacja odbywa się bezblokadowo przez lokalne gniazdo Unix Domain Socket
//! (`discord-ipc-0` .. `discord-ipc-9`) z wykorzystaniem protokołu IPC Discorda.

use domain::PlaybackState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tracing::{debug, info};

/// Domyślny zarejestrowany Discord Application ID dla odtwarzaczy audio / Auralune.
pub const DEFAULT_DISCORD_CLIENT_ID: &str = "1121632048155742288";

/// Informacje o utworze przesyłane do statusu Discord RPC.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiscordTrackInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub art_url: Option<String>,
}

/// Status połączenia z klientem Discord.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordRpcStatus {
    pub enabled: bool,
    pub connected: bool,
    pub client_id: String,
    pub current_activity: Option<String>,
}

/// Polecenia wewnętrzne wysyłane do pętli roboczej Discord RPC.
enum DiscordRpcCommand {
    UpdateTrack(DiscordTrackInfo),
    UpdatePlayback {
        state: PlaybackState,
        position_ms: u64,
        duration_ms: u64,
    },
    UpdatePosition(u64),
    ClearActivity,
    SetEnabled(bool),
    SetClientId(String),
}

/// Kontroler Discord RPC zarządzający aktywnością użytkowniczki w Discordzie.
pub struct DiscordRpcController {
    tx: UnboundedSender<DiscordRpcCommand>,
    status: Arc<RwLock<DiscordRpcStatus>>,
}

impl DiscordRpcController {
    /// Tworzy i uruchamia kontroler Discord RPC w tle przy użyciu podanego lub bieżącego uchwytu Tokio.
    pub fn start(
        handle: Option<&tokio::runtime::Handle>,
        enabled: bool,
        client_id: Option<String>,
    ) -> Arc<Self> {
        let initial_client_id = client_id
            .filter(|id| !id.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_DISCORD_CLIENT_ID.to_string());

        let status = Arc::new(RwLock::new(DiscordRpcStatus {
            enabled,
            connected: false,
            client_id: initial_client_id.clone(),
            current_activity: None,
        }));

        let (tx, rx) = mpsc::unbounded_channel();
        let status_clone = status.clone();

        let spawner = handle
            .cloned()
            .or_else(|| tokio::runtime::Handle::try_current().ok());

        if let Some(h) = spawner {
            h.spawn(async move {
                let mut worker = DiscordRpcWorker::new(enabled, initial_client_id, status_clone);
                worker.run(rx).await;
            });
        } else {
            tracing::warn!("Nie można uruchomić DiscordRpcWorker: brak aktywnego środowiska uruchomieniowego Tokio");
        }

        Arc::new(Self { tx, status })
    }

    /// Aktualizuje metadane odtwarzanego utworu.
    pub fn update_track(&self, info: DiscordTrackInfo) {
        let _ = self.tx.send(DiscordRpcCommand::UpdateTrack(info));
    }

    /// Aktualizuje stan odtwarzania (Playing, Paused, Stopped) wraz z pozycją.
    pub fn update_playback_status(&self, state: PlaybackState, position_ms: u64, duration_ms: u64) {
        let _ = self.tx.send(DiscordRpcCommand::UpdatePlayback {
            state,
            position_ms,
            duration_ms,
        });
    }

    /// Informuje o przesunięciu czasu (seek).
    pub fn update_position(&self, position_ms: u64) {
        let _ = self.tx.send(DiscordRpcCommand::UpdatePosition(position_ms));
    }

    /// Czyści status aktywności na Discordzie.
    pub fn clear_activity(&self) {
        let _ = self.tx.send(DiscordRpcCommand::ClearActivity);
    }

    /// Włącza lub wyłącza Discord RPC.
    pub fn set_enabled(&self, enabled: bool) {
        let _ = self.tx.send(DiscordRpcCommand::SetEnabled(enabled));
    }

    /// Zmienia Application ID Discorda.
    pub fn set_client_id(&self, client_id: String) {
        let _ = self.tx.send(DiscordRpcCommand::SetClientId(client_id));
    }

    /// Pobiera bieżący status Discord RPC do prezentacji w UI.
    pub fn get_status(&self) -> DiscordRpcStatus {
        self.status
            .read()
            .map(|s| s.clone())
            .unwrap_or_else(|_| DiscordRpcStatus {
                enabled: false,
                connected: false,
                client_id: DEFAULT_DISCORD_CLIENT_ID.to_string(),
                current_activity: None,
            })
    }
}

/// Wewnętrzny worker obsługujący gniazdo Unix IPC Discorda.
struct DiscordRpcWorker {
    enabled: bool,
    client_id: String,
    stream: Option<UnixStream>,
    status: Arc<RwLock<DiscordRpcStatus>>,
    current_track: Option<DiscordTrackInfo>,
    playback_state: PlaybackState,
    current_position_ms: u64,
    current_duration_ms: u64,
    last_connect_attempt: Option<SystemTime>,
    nonce_counter: u64,
}

impl DiscordRpcWorker {
    fn new(enabled: bool, client_id: String, status: Arc<RwLock<DiscordRpcStatus>>) -> Self {
        Self {
            enabled,
            client_id,
            stream: None,
            status,
            current_track: None,
            playback_state: PlaybackState::Stopped,
            current_position_ms: 0,
            current_duration_ms: 0,
            last_connect_attempt: None,
            nonce_counter: 0,
        }
    }

    async fn run(&mut self, mut rx: UnboundedReceiver<DiscordRpcCommand>) {
        if self.enabled {
            self.try_connect().await;
        }

        while let Some(cmd) = rx.recv().await {
            match cmd {
                DiscordRpcCommand::UpdateTrack(track) => {
                    self.current_track = Some(track);
                    self.refresh_activity().await;
                }
                DiscordRpcCommand::UpdatePlayback {
                    state,
                    position_ms,
                    duration_ms,
                } => {
                    self.playback_state = state;
                    self.current_position_ms = position_ms;
                    if duration_ms > 0 {
                        self.current_duration_ms = duration_ms;
                    }
                    self.refresh_activity().await;
                }
                DiscordRpcCommand::UpdatePosition(pos) => {
                    self.current_position_ms = pos;
                    self.refresh_activity().await;
                }
                DiscordRpcCommand::ClearActivity => {
                    self.playback_state = PlaybackState::Stopped;
                    self.clear_discord_activity().await;
                }
                DiscordRpcCommand::SetEnabled(enabled) => {
                    self.enabled = enabled;
                    self.update_shared_status();
                    if enabled {
                        self.try_connect().await;
                        self.refresh_activity().await;
                    } else {
                        self.clear_discord_activity().await;
                        self.disconnect();
                    }
                }
                DiscordRpcCommand::SetClientId(new_id) => {
                    let trimmed = new_id.trim();
                    let final_id = if trimmed.is_empty() {
                        DEFAULT_DISCORD_CLIENT_ID.to_string()
                    } else {
                        trimmed.to_string()
                    };
                    if final_id != self.client_id {
                        self.client_id = final_id;
                        self.disconnect();
                        if self.enabled {
                            self.try_connect().await;
                            self.refresh_activity().await;
                        }
                    }
                }
            }
        }
    }

    fn next_nonce(&mut self) -> String {
        self.nonce_counter += 1;
        self.nonce_counter.to_string()
    }

    fn update_shared_status(&self) {
        if let Ok(mut st) = self.status.write() {
            st.enabled = self.enabled;
            st.connected = self.stream.is_some();
            st.client_id = self.client_id.clone();
            st.current_activity = self.current_track.as_ref().map(|t| {
                if !t.artist.is_empty() {
                    format!("{} - {}", t.artist, t.title)
                } else {
                    t.title.clone()
                }
            });
        }
    }

    fn disconnect(&mut self) {
        self.stream = None;
        self.update_shared_status();
    }

    async fn try_connect(&mut self) -> bool {
        if self.stream.is_some() {
            return true;
        }

        // Unikaj spamu ponownych połączeń częściej niż co 3 sekundy
        if let Some(last) = self.last_connect_attempt {
            if let Ok(elapsed) = last.elapsed() {
                if elapsed < Duration::from_secs(3) {
                    return false;
                }
            }
        }
        self.last_connect_attempt = Some(SystemTime::now());

        let candidates = find_discord_socket_candidates();
        for path in candidates {
            if !path.exists() {
                continue;
            }
            debug!("Próba połączenia z gniazdem Discord IPC: {:?}", path);
            match UnixStream::connect(&path).await {
                Ok(mut stream) => {
                    // Wysłanie uścisku dłoni (Handshake opcode 0)
                    let handshake_payload = serde_json::json!({
                        "v": 1,
                        "client_id": self.client_id
                    })
                    .to_string();

                    if let Err(e) = send_ipc_frame(&mut stream, 0, &handshake_payload).await {
                        debug!("Błąd wysyłania Handshake do {:?}: {}", path, e);
                        continue;
                    }

                    // Odczyt odpowiedzi (opcode 1 - READY) z limitem czasu
                    let read_res = tokio::time::timeout(
                        Duration::from_millis(1500),
                        read_ipc_frame(&mut stream),
                    )
                    .await;

                    match read_res {
                        Ok(Ok((1, _payload))) => {
                            info!("Pomyślnie połączono z Discord RPC przez {:?}", path);
                            self.stream = Some(stream);
                            self.update_shared_status();
                            return true;
                        }

                        Ok(Ok((opcode, payload))) => {
                            debug!(
                                "Nieoczekiwana odpowiedź Discord IPC (opcode {}): {}",
                                opcode, payload
                            );
                        }
                        Ok(Err(e)) => {
                            debug!("Błąd odczytu odpowiedzi Handshake z {:?}: {}", path, e);
                        }
                        Err(_) => {
                            debug!("Przekroczono limit czasu odpowiedzi Handshake z {:?}", path);
                        }
                    }
                }
                Err(e) => {
                    debug!("Nie udało się połączyć z {:?}: {}", path, e);
                }
            }
        }

        self.update_shared_status();
        false
    }

    async fn refresh_activity(&mut self) {
        if !self.enabled {
            return;
        }

        let track = match &self.current_track {
            Some(t) => t.clone(),
            None => {
                self.clear_discord_activity().await;
                return;
            }
        };

        if self.playback_state == PlaybackState::Stopped {
            self.clear_discord_activity().await;
            return;
        }

        if !self.try_connect().await {
            return;
        }

        let nonce = self.next_nonce();
        let pid = std::process::id();
        let is_playing = self.playback_state == PlaybackState::Playing;

        // Szczegóły utworu
        let details = if track.title.trim().is_empty() {
            "Nieznany utwór".to_string()
        } else {
            truncate_str(&track.title, 128)
        };

        let state = if !track.artist.trim().is_empty() {
            if !track.album.trim().is_empty() {
                truncate_str(&format!("{} • {}", track.artist, track.album), 128)
            } else {
                truncate_str(&track.artist, 128)
            }
        } else if !track.album.trim().is_empty() {
            truncate_str(&track.album, 128)
        } else {
            "Auralune (Kitsune Player)".to_string()
        };

        // Obliczenie znaczników czasu dla odtwarzania
        let now_unix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let timestamps = if is_playing {
            let elapsed_secs = self.current_position_ms / 1000;
            let start_time = now_unix.saturating_sub(elapsed_secs);

            let duration_secs = self.current_duration_ms / 1000;

            if duration_secs > elapsed_secs {
                Some(serde_json::json!({
                    "start": start_time,
                    "end": start_time + duration_secs
                }))
            } else {
                Some(serde_json::json!({
                    "start": start_time
                }))
            }
        } else {
            None
        };

        // Okładka i ikony statusu
        let large_image = match &track.art_url {
            Some(url) if url.starts_with("http://") || url.starts_with("https://") => url.clone(),
            _ => "auralune_logo".to_string(),
        };

        let large_text = if !track.album.is_empty() {
            truncate_str(&track.album, 128)
        } else {
            "Auralune (Kitsune Player)".to_string()
        };

        let small_image = if is_playing { "play" } else { "pause" };
        let small_text = if is_playing {
            "Odtwarzanie"
        } else {
            "Wstrzymano"
        };

        let mut activity = serde_json::json!({
            "type": 2, // 2 = Listening to
            "details": details,
            "state": state,
            "assets": {
                "large_image": large_image,
                "large_text": large_text,
                "small_image": small_image,
                "small_text": small_text
            },
            "buttons": [
                {
                    "label": "Auralune Player",
                    "url": "https://github.com/Das-Letzte-Kemonomimi/Aura-Lune"
                }
            ]
        });

        if let Some(ts) = timestamps {
            activity["timestamps"] = ts;
        }

        let payload = serde_json::json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": pid,
                "activity": activity
            },
            "nonce": nonce
        })
        .to_string();

        if let Some(stream) = self.stream.as_mut() {
            if let Err(e) = send_ipc_frame(stream, 1, &payload).await {
                debug!("Błąd wysyłania SET_ACTIVITY do Discorda: {}", e);
                self.disconnect();
            } else {
                debug!("Wysłano aktywność do Discord RPC: {}", details);
                self.update_shared_status();
            }
        }
    }

    async fn clear_discord_activity(&mut self) {
        if self.stream.is_none() {
            self.update_shared_status();
            return;
        }

        let nonce = self.next_nonce();
        let pid = std::process::id();
        let payload = serde_json::json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": pid,
                "activity": serde_json::Value::Null
            },
            "nonce": nonce
        })
        .to_string();

        if let Some(stream) = self.stream.as_mut() {
            if let Err(e) = send_ipc_frame(stream, 1, &payload).await {
                debug!("Błąd czyszczenia aktywności Discorda: {}", e);
                self.disconnect();
            } else {
                debug!("Wyczyszczono aktywność Discord RPC");
                self.update_shared_status();
            }
        }
    }
}

/// Zwraca listę potencjalnych ścieżek gniazd Unix IPC Discorda na Linuksie.
fn find_discord_socket_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    // 1. $XDG_RUNTIME_DIR
    if let Ok(runtime_dir) = std::env::var("XDG_RUNTIME_DIR") {
        let base = PathBuf::from(&runtime_dir);
        for i in 0..10 {
            candidates.push(base.join(format!("discord-ipc-{}", i)));
        }

        // Ścieżki dla klientów Flatpak (m.in. Vesktop, WebCord, Discord):
        // Flatpak montuje per-app xdg-run w $XDG_RUNTIME_DIR/.flatpak/<app_id>/xdg-run/
        let flatpak_dir = base.join(".flatpak");
        if flatpak_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&flatpak_dir) {
                for entry in entries.flatten() {
                    let app_xdg_run = entry.path().join("xdg-run");
                    if app_xdg_run.is_dir() {
                        for i in 0..10 {
                            candidates.push(app_xdg_run.join(format!("discord-ipc-{}", i)));
                        }
                    }
                }
            }
        }

        let app_prefixes = [
            ".flatpak/dev.vencord.Vesktop/xdg-run",
            ".flatpak/com.discordapp.Discord/xdg-run",
            ".flatpak/com.discordapp.DiscordCanary/xdg-run",
            ".flatpak/io.github.spacingbat3.webcord/xdg-run",
            "app/com.discordapp.Discord",
            "app/com.discordapp.DiscordCanary",
            "app/dev.vencord.Vesktop",
            "app/io.github.spacingbat3.webcord",
        ];
        for prefix in &app_prefixes {
            for i in 0..10 {
                candidates.push(base.join(prefix).join(format!("discord-ipc-{}", i)));
            }
        }
    }


    // 2. /run/user/<UID>
    let uid = libc_getuid();
    let run_user = PathBuf::from(format!("/run/user/{}", uid));
    if run_user.exists() {
        for i in 0..10 {
            candidates.push(run_user.join(format!("discord-ipc-{}", i)));
        }
    }

    // 3. /tmp fallback
    let tmp = PathBuf::from("/tmp");
    for i in 0..10 {
        candidates.push(tmp.join(format!("discord-ipc-{}", i)));
    }

    candidates
}

fn libc_getuid() -> u32 {
    // Bezpieczne pobranie UID bieżącego użytkownika Linuksa bez zewnętrznych zależności
    extern "C" {
        fn getuid() -> u32;
    }
    unsafe { getuid() }
}

/// Zapisuje ramkę binarną protokołu Discord IPC:
/// [opcode: u32 LE][length: u32 LE][payload JSON UTF-8]
async fn send_ipc_frame(
    stream: &mut UnixStream,
    opcode: u32,
    payload: &str,
) -> std::io::Result<()> {
    let payload_bytes = payload.as_bytes();
    let length = payload_bytes.len() as u32;
    let mut header = [0u8; 8];
    header[0..4].copy_from_slice(&opcode.to_le_bytes());
    header[4..8].copy_from_slice(&length.to_le_bytes());

    stream.write_all(&header).await?;
    stream.write_all(payload_bytes).await?;
    stream.flush().await?;
    Ok(())
}

/// Odczytuje pojedynczą ramkę binarną Discord IPC z gniazda.
async fn read_ipc_frame(stream: &mut UnixStream) -> std::io::Result<(u32, String)> {
    let mut header = [0u8; 8];
    stream.read_exact(&mut header).await?;
    let opcode = u32::from_le_bytes(header[0..4].try_into().unwrap());
    let length = u32::from_le_bytes(header[4..8].try_into().unwrap());

    if length > 1024 * 1024 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Ramka Discord IPC przekracza dopuszczalny limit 1 MB",
        ));
    }

    let mut payload = vec![0u8; length as usize];
    stream.read_exact(&mut payload).await?;
    let payload_str = String::from_utf8(payload)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    Ok((opcode, payload_str))
}

fn truncate_str(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        s.chars().take(max_chars - 1).collect::<String>() + "…"
    }
}
