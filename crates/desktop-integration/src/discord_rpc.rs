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
use tokio::net::unix::OwnedWriteHalf;
use tokio::net::UnixStream;
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tracing::{debug, info};

/// Oficjalny zarejestrowany Discord Application ID dla Auralune („Słucha Auralune”).
pub const DEFAULT_DISCORD_CLIENT_ID: &str = "1563876157387186226";

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
    writer: Option<OwnedWriteHalf>,
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
            writer: None,
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

        let mut ticker = tokio::time::interval(Duration::from_millis(1500));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                cmd = rx.recv() => {
                    let Some(command) = cmd else { break };
                    match command {
                        DiscordRpcCommand::UpdateTrack(track) => {
                            self.current_track = Some(track);
                            if self.playback_state == PlaybackState::Stopped {
                                self.playback_state = PlaybackState::Playing;
                            }
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
                _ = ticker.tick() => {
                    // Jeśli Discord RPC jest włączony, ale nie ma jeszcze połączenia (np. Vesktop/Discord uruchomiony później),
                    // to sprawdzaj gniazdo w tle i automatycznie wyślij aktywność bez konieczności interakcji użytkowniczki
                    if self.enabled
                        && self.writer.is_none()
                        && self.current_track.is_some()
                        && self.playback_state != PlaybackState::Stopped
                        && self.try_connect().await
                    {
                        self.refresh_activity().await;
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
            st.connected = self.writer.is_some();
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
        self.writer = None;
        self.update_shared_status();
    }

    async fn try_connect(&mut self) -> bool {
        if self.writer.is_some() {
            return true;
        }

        // Unikaj spamu ponownych połączeń częściej niż co 500ms
        if let Some(last) = self.last_connect_attempt {
            if let Ok(elapsed) = last.elapsed() {
                if elapsed < Duration::from_millis(500) {
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
            info!("Próba połączenia z gniazdem Discord IPC: {:?}", path);
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
                        Duration::from_millis(800),
                        read_ipc_frame(&mut stream),
                    )
                    .await;

                    match read_res {
                        Ok(Ok((1, _payload))) => {
                            info!("Pomyślnie połączono z Discord RPC przez {:?}", path);
                            let (read_half, write_half) = stream.into_split();
                            tokio::spawn(async move {
                                let mut reader = read_half;
                                while let Ok((opcode, _)) = read_ipc_frame(&mut reader).await {
                                    tracing::trace!("Discord IPC response opcode {}", opcode);
                                }
                            });
                            self.writer = Some(write_half);
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

        // Szczegóły utworu (Linia 1 w Discordzie: Tytuł utworu)
        let details = if track.title.trim().is_empty() {
            "Nieznany utwór".to_string()
        } else {
            truncate_str(&track.title, 128)
        };

        // Wykonawca (Linia 2 w Discordzie: Wykonawca)
        let state = if !track.artist.trim().is_empty() {
            truncate_str(&track.artist, 128)
        } else if !track.album.trim().is_empty() {
            truncate_str(&track.album, 128)
        } else {
            "Auralune".to_string()
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
        // Jeśli okładka jest dostępna (online HTTPS, base64 data URI lub plik lokalny), użyj jej.
        // Jeśli brak jakiejkolwiek okładki, użyj bezpośredniego HTTPS do oficjalnej ikony Auralune.
        let default_logo_url = "https://raw.githubusercontent.com/Das-Letzte-Kemonomimi/Aura-Lune/main/apps/desktop/src-tauri/icons/128x128.png";
        let large_image = match &track.art_url {
            Some(url)
                if url.starts_with("http://")
                    || url.starts_with("https://")
                    || url.starts_with("data:image/")
                    || url.starts_with("file://") =>
            {
                url.clone()
            }
            _ => default_logo_url.to_string(),
        };

        // Album (Linia 3 w Discordzie / tooltip na okładce)
        let large_text = if !track.album.trim().is_empty() {
            truncate_str(&track.album, 128)
        } else {
            "Auralune (Kitsune Player)".to_string()
        };

        let mut activity = serde_json::json!({
            "name": "Auralune",
            "type": 2, // 2 = Listening to
            "details": details,
            "state": state,
            "assets": {
                "large_image": large_image,
                "large_text": large_text
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

        if let Some(writer) = self.writer.as_mut() {
            if let Err(e) = send_ipc_frame(writer, 1, &payload).await {
                debug!("Błąd wysyłania SET_ACTIVITY do Discorda: {}", e);
                self.disconnect();
            } else {
                info!("Pomyślnie wysłano aktywność do Discord RPC: {}", details);
                self.update_shared_status();
            }
        }
    }

    async fn clear_discord_activity(&mut self) {
        if self.writer.is_none() {
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

        if let Some(writer) = self.writer.as_mut() {
            if let Err(e) = send_ipc_frame(writer, 1, &payload).await {
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

    // Zwróć tylko unikalne ścieżki, które faktycznie istnieją w systemie
    let mut seen = std::collections::HashSet::new();
    let mut existing = Vec::new();
    for p in candidates {
        if p.exists() && seen.insert(p.clone()) {
            existing.push(p);
        }
    }

    existing
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
async fn send_ipc_frame<W>(writer: &mut W, opcode: u32, payload: &str) -> std::io::Result<()>
where
    W: AsyncWriteExt + Unpin,
{
    let payload_bytes = payload.as_bytes();
    let length = payload_bytes.len() as u32;
    let mut header = [0u8; 8];
    header[0..4].copy_from_slice(&opcode.to_le_bytes());
    header[4..8].copy_from_slice(&length.to_le_bytes());

    writer.write_all(&header).await?;
    writer.write_all(payload_bytes).await?;
    writer.flush().await?;
    Ok(())
}

/// Odczytuje pojedynczą ramkę binarną Discord IPC z gniazda.
async fn read_ipc_frame<R>(reader: &mut R) -> std::io::Result<(u32, String)>
where
    R: AsyncReadExt + Unpin,
{
    let mut header = [0u8; 8];
    reader.read_exact(&mut header).await?;
    let opcode = u32::from_le_bytes(header[0..4].try_into().unwrap());
    let length = u32::from_le_bytes(header[4..8].try_into().unwrap());

    if length > 1024 * 1024 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Ramka Discord IPC przekracza dopuszczalny limit 1 MB",
        ));
    }

    let mut payload = vec![0u8; length as usize];
    reader.read_exact(&mut payload).await?;
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
