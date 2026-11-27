//! Discord Rich Presence (RPC) client for Linux.
//!
//! Communication is non-blocking over the local Unix domain socket
//! (`discord-ipc-0` .. `discord-ipc-9`) using the Discord IPC protocol.

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

/// The officially registered Discord Application ID for Auralune ("Listening to Auralune").
pub const DEFAULT_DISCORD_CLIENT_ID: &str = "1563876157387186226";

/// Track information sent to the Discord RPC status.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscordTrackInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub art_url: Option<String>,
}

/// Connection status with the Discord client.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordRpcStatus {
    pub enabled: bool,
    pub connected: bool,
    pub client_id: String,
    pub current_activity: Option<String>,
}

/// Internal commands sent to the Discord RPC worker loop.
enum DiscordRpcCommand {
    UpdateTrack(DiscordTrackInfo),
    UpdatePlayback {
        state: PlaybackState,
        position_ms: u64,
        duration_ms: u64,
    },
    UpdatePosition(u64),
    TrackLooped,
    ClearActivity,
    SetEnabled(bool),
    SetClientId(String),
}

/// Discord RPC controller that manages the user's Discord activity.
pub struct DiscordRpcController {
    tx: UnboundedSender<DiscordRpcCommand>,
    status: Arc<RwLock<DiscordRpcStatus>>,
}

impl DiscordRpcController {
    /// Creates and starts the Discord RPC controller in the background on the given or current Tokio handle.
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
            tracing::warn!("Cannot start DiscordRpcWorker: no active Tokio runtime");
        }

        Arc::new(Self { tx, status })
    }

    /// Updates the metadata of the playing track.
    pub fn update_track(&self, info: DiscordTrackInfo) {
        let _ = self.tx.send(DiscordRpcCommand::UpdateTrack(info));
    }

    /// Updates the playback state (Playing, Paused, Stopped) with the position.
    pub fn update_playback_status(&self, state: PlaybackState, position_ms: u64, duration_ms: u64) {
        let _ = self.tx.send(DiscordRpcCommand::UpdatePlayback {
            state,
            position_ms,
            duration_ms,
        });
    }

    /// Reports a time jump (seek).
    pub fn update_position(&self, position_ms: u64) {
        let _ = self.tx.send(DiscordRpcCommand::UpdatePosition(position_ms));
    }

    /// Reports that the track looped back to the start (Repeat Track / Loop).
    pub fn track_looped(&self) {
        let _ = self.tx.send(DiscordRpcCommand::TrackLooped);
    }

    /// Clears the activity status on Discord.
    pub fn clear_activity(&self) {
        let _ = self.tx.send(DiscordRpcCommand::ClearActivity);
    }

    /// Turns Discord RPC on or off.
    pub fn set_enabled(&self, enabled: bool) {
        if let Ok(mut s) = self.status.write() {
            s.enabled = enabled;
            if !enabled {
                s.connected = false;
                s.current_activity = None;
            }
        }
        let _ = self.tx.send(DiscordRpcCommand::SetEnabled(enabled));
    }

    /// Changes the Discord Application ID.
    pub fn set_client_id(&self, client_id: String) {
        if let Ok(mut s) = self.status.write() {
            s.client_id = client_id.clone();
        }
        let _ = self.tx.send(DiscordRpcCommand::SetClientId(client_id));
    }

    /// Returns the current Discord RPC status for display in the UI.
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

/// Exponential backoff between Discord IPC reconnect attempts: 1.5 s doubled up to 60 s.
pub fn next_reconnect_backoff(failed_attempts: u32) -> Duration {
    let shift = failed_attempts.min(6);
    let ms = 1_500u64.saturating_mul(1u64 << shift).min(60_000);
    Duration::from_millis(ms)
}

/// Internal worker that handles the Discord Unix IPC socket.
struct DiscordRpcWorker {
    enabled: bool,
    client_id: String,
    writer: Option<OwnedWriteHalf>,
    status: Arc<RwLock<DiscordRpcStatus>>,
    current_track: Option<DiscordTrackInfo>,
    playback_state: PlaybackState,
    current_position_ms: u64,
    current_duration_ms: u64,
    reconnect_attempts: u32,
    next_connect_at: Option<tokio::time::Instant>,
    nonce_counter: u64,
    dirty: bool,
    last_sent_at: Option<tokio::time::Instant>,
    last_start_unix: Option<u64>,
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
            reconnect_attempts: 0,
            next_connect_at: None,
            nonce_counter: 0,
            dirty: false,
            last_sent_at: None,
            last_start_unix: None,
        }
    }

    fn reset_reconnect_backoff(&mut self) {
        self.reconnect_attempts = 0;
        self.next_connect_at = None;
    }

    fn schedule_flush(&self, flush_deadline: &mut Option<tokio::time::Instant>) {
        let now = tokio::time::Instant::now();
        // Fast 60ms settle: micro-bursts of commands (UpdateTrack + UpdatePlayback)
        // merge into exactly 1 SET_ACTIVITY frame sent within a fraction of a second
        let settle = now + Duration::from_millis(60);
        // Protection against the Discord Gateway rate limit (max 5 per 20s, min. 1000ms between frames during fast seeking)
        let min_interval = match self.last_sent_at {
            Some(t) => t + Duration::from_millis(1000),
            None => now,
        };
        let target = std::cmp::max(settle, min_interval);
        if let Some(existing) = *flush_deadline {
            if target < existing {
                *flush_deadline = Some(target);
            }
        } else {
            *flush_deadline = Some(target);
        }
    }

    async fn run(&mut self, mut rx: UnboundedReceiver<DiscordRpcCommand>) {
        if self.enabled {
            self.try_connect().await;
        }

        let mut flush_deadline: Option<tokio::time::Instant> = None;

        loop {
            let now_instant = tokio::time::Instant::now();
            let reconnect_due = if self.enabled
                && self.writer.is_none()
                && self.current_track.is_some()
                && self.playback_state != PlaybackState::Stopped
            {
                self.next_connect_at
            } else {
                None
            };

            let loop_check_due = if self.enabled
                && self.playback_state == PlaybackState::Playing
                && self.current_duration_ms > 0
            {
                self.last_start_unix
                    .map(|_| now_instant + Duration::from_millis(1500))
            } else {
                None
            };

            let maintenance_deadline = match (reconnect_due, loop_check_due) {
                (Some(a), Some(b)) => Some(std::cmp::min(a, b)),
                (a, b) => a.or(b),
            };

            let flush_fut = async {
                match flush_deadline {
                    Some(dl) => tokio::time::sleep_until(dl).await,
                    None => std::future::pending::<()>().await,
                }
            };

            let maintenance_fut = async {
                match maintenance_deadline {
                    Some(dl) => tokio::time::sleep_until(dl).await,
                    None => std::future::pending::<()>().await,
                }
            };

            tokio::select! {
                cmd = rx.recv() => {
                    let Some(command) = cmd else { break };
                    match command {
                        DiscordRpcCommand::UpdateTrack(track) => {
                            let track_changed = self.current_track.as_ref() != Some(&track);
                            if track.duration_ms > 0 {
                                self.current_duration_ms = track.duration_ms;
                            }
                            self.current_track = Some(track);
                            if self.playback_state == PlaybackState::Stopped {
                                self.playback_state = PlaybackState::Playing;
                            }
                            if track_changed {
                                self.reset_reconnect_backoff();
                                self.dirty = true;
                                self.schedule_flush(&mut flush_deadline);
                            }
                        }
                        DiscordRpcCommand::UpdatePlayback {
                            state,
                            position_ms,
                            duration_ms,
                        } => {
                            let state_changed = self.playback_state != state;
                            self.playback_state = state;
                            let dur_changed = duration_ms > 0 && duration_ms != self.current_duration_ms;
                            if duration_ms > 0 {
                                self.current_duration_ms = duration_ms;
                            }
                            let now_unix = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let estimated_current_pos_ms = if let Some(st) = self.last_start_unix {
                                (now_unix.saturating_sub(st)) * 1000
                            } else {
                                self.current_position_ms
                            };
                            let pos_jump = (self.current_position_ms as i64 - position_ms as i64).abs() > 2500
                                || (estimated_current_pos_ms as i64 - position_ms as i64).abs() > 2500;
                            self.current_position_ms = position_ms;
                            if state_changed || dur_changed || pos_jump {
                                self.dirty = true;
                                self.schedule_flush(&mut flush_deadline);
                            }
                        }
                        DiscordRpcCommand::UpdatePosition(pos) => {
                            let now_unix = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let estimated_current_pos_ms = if let Some(st) = self.last_start_unix {
                                (now_unix.saturating_sub(st)) * 1000
                            } else {
                                self.current_position_ms
                            };
                            let pos_jump = (self.current_position_ms as i64 - pos as i64).abs() > 2500
                                || (estimated_current_pos_ms as i64 - pos as i64).abs() > 2500;
                            self.current_position_ms = pos;
                            if pos_jump {
                                self.dirty = true;
                                self.schedule_flush(&mut flush_deadline);
                            }
                        }
                        DiscordRpcCommand::TrackLooped => {
                            self.current_position_ms = 0;
                            self.last_start_unix = None;
                            self.dirty = true;
                            self.schedule_flush(&mut flush_deadline);
                        }
                        DiscordRpcCommand::ClearActivity => {
                            self.playback_state = PlaybackState::Stopped;
                            self.dirty = false;
                            flush_deadline = None;
                            self.clear_discord_activity().await;
                        }
                        DiscordRpcCommand::SetEnabled(enabled) => {
                            self.enabled = enabled;
                            self.update_shared_status();
                            if enabled {
                                self.reset_reconnect_backoff();
                                self.try_connect().await;
                                self.dirty = true;
                                self.schedule_flush(&mut flush_deadline);
                            } else {
                                self.reset_reconnect_backoff();
                                self.dirty = false;
                                flush_deadline = None;
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
                                self.reset_reconnect_backoff();
                                self.disconnect();
                                if self.enabled {
                                    self.try_connect().await;
                                    self.dirty = true;
                                    self.schedule_flush(&mut flush_deadline);
                                }
                            }
                        }
                    }
                }
                _ = flush_fut => {
                    flush_deadline = None;
                    if self.dirty {
                        self.dirty = false;
                        self.last_sent_at = Some(tokio::time::Instant::now());
                        self.refresh_activity().await;
                    }
                }
                _ = maintenance_fut => {
                    let now_unix = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();

                    // If the track is playing, has a known length and the Discord time passed that length (the bar reached 100%),
                    // while the player is still playing (e.g. the track looped without an explicit notification), update the position.
                    if self.enabled
                        && self.playback_state == PlaybackState::Playing
                        && self.current_duration_ms > 0
                    {
                        if let Some(start_t) = self.last_start_unix {
                            let dur_secs = self.current_duration_ms / 1000;
                            if dur_secs > 0 && now_unix > start_t + dur_secs + 1 {
                                self.current_position_ms = 0;
                                self.last_start_unix = Some(now_unix);
                                self.dirty = true;
                                self.schedule_flush(&mut flush_deadline);
                            }
                        }
                    }

                    // If Discord RPC is on but not connected yet (e.g. Vesktop/Discord started later),
                    // probe the socket in the background with exponential backoff up to 60 s.
                    if self.enabled
                        && self.writer.is_none()
                        && self.current_track.is_some()
                        && self.playback_state != PlaybackState::Stopped
                        && self.try_connect().await
                    {
                        self.last_sent_at = Some(tokio::time::Instant::now());
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

    /// Publishes the worker-owned fields (`connected`, `current_activity`). `enabled` and `client_id`
    /// belong to the controller, which writes them before sending the command: the worker's copies
    /// lag behind (e.g. during an 800 ms handshake) and must never overwrite a newer setting.
    fn update_shared_status(&self) {
        if let Ok(mut st) = self.status.write() {
            if !st.enabled {
                st.connected = false;
                st.current_activity = None;
                return;
            }
            st.connected = self.writer.is_some();
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

        if let Some(deadline) = self.next_connect_at {
            if tokio::time::Instant::now() < deadline {
                return false;
            }
        }

        // ~130 `exists()` and `read_dir` checks, so off the Tokio threads.
        let candidates = tokio::task::spawn_blocking(find_discord_socket_candidates)
            .await
            .unwrap_or_default();
        for path in candidates {
            if !path.exists() {
                continue;
            }
            info!("Trying to connect to the Discord IPC socket: {:?}", path);
            match UnixStream::connect(&path).await {
                Ok(mut stream) => {
                    // Send the handshake (opcode 0)
                    let handshake_payload = serde_json::json!({
                        "v": 1,
                        "client_id": self.client_id
                    })
                    .to_string();

                    if let Err(e) = send_ipc_frame(&mut stream, 0, &handshake_payload).await {
                        debug!("Failed to send the handshake to {:?}: {}", path, e);
                        continue;
                    }

                    // Read the response (opcode 1 - READY) with a timeout
                    let read_res = tokio::time::timeout(
                        Duration::from_millis(800),
                        read_ipc_frame(&mut stream),
                    )
                    .await;

                    match read_res {
                        Ok(Ok((1, _payload))) => {
                            info!("Connected to Discord RPC via {:?}", path);
                            let (read_half, write_half) = stream.into_split();
                            tokio::spawn(async move {
                                let mut reader = read_half;
                                while let Ok((opcode, _)) = read_ipc_frame(&mut reader).await {
                                    tracing::trace!("Discord IPC response opcode {}", opcode);
                                }
                            });
                            self.writer = Some(write_half);
                            self.reset_reconnect_backoff();
                            self.update_shared_status();
                            return true;
                        }

                        Ok(Ok((opcode, payload))) => {
                            debug!(
                                "Unexpected Discord IPC response (opcode {}): {}",
                                opcode, payload
                            );
                        }
                        Ok(Err(e)) => {
                            debug!(
                                "Failed to read the handshake response from {:?}: {}",
                                path, e
                            );
                        }
                        Err(_) => {
                            debug!("Handshake response from {:?} timed out", path);
                        }
                    }
                }
                Err(e) => {
                    debug!("Failed to connect to {:?}: {}", path, e);
                }
            }
        }

        let backoff = next_reconnect_backoff(self.reconnect_attempts);
        self.reconnect_attempts = self.reconnect_attempts.saturating_add(1);
        self.next_connect_at = Some(tokio::time::Instant::now() + backoff);
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

        let now_unix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let elapsed_secs = self.current_position_ms / 1000;
        let start_time = now_unix.saturating_sub(elapsed_secs);
        self.last_start_unix = Some(start_time);

        let activity = build_activity_payload(
            &track,
            self.playback_state,
            self.current_position_ms,
            self.current_duration_ms,
            now_unix,
        );

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
                debug!("Failed to send SET_ACTIVITY to Discord: {}", e);
                self.disconnect();
            } else {
                info!("Sent the activity to Discord RPC: {}", track.title);
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
                debug!("Failed to clear the Discord activity: {}", e);
                self.disconnect();
            } else {
                debug!("Cleared the Discord RPC activity");
                self.update_shared_status();
            }
        }
    }
}

/// Returns the list of candidate Discord Unix IPC socket paths on Linux.
fn find_discord_socket_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    // 1. $XDG_RUNTIME_DIR
    if let Ok(runtime_dir) = std::env::var("XDG_RUNTIME_DIR") {
        let base = PathBuf::from(&runtime_dir);
        for i in 0..10 {
            candidates.push(base.join(format!("discord-ipc-{}", i)));
        }

        // Paths for Flatpak clients (Vesktop, WebCord, Discord and others):
        // Flatpak mounts a per-app xdg-run at $XDG_RUNTIME_DIR/.flatpak/<app_id>/xdg-run/
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
            "snap.discord",
            "snap.discord-canary",
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

    // 2. /run/user/<UID> (when XDG_RUNTIME_DIR is not set)
    if let Some(uid) = crate::runtime_dir::current_uid() {
        let run_user = PathBuf::from(format!("/run/user/{uid}"));
        for i in 0..10 {
            candidates.push(run_user.join(format!("discord-ipc-{}", i)));
        }
    }

    // 3. /tmp (Discord without XDG_RUNTIME_DIR): only sockets owned by the current
    //    user; a foreign socket in /tmp could intercept playback metadata.
    if let Some(uid) = crate::runtime_dir::current_uid() {
        for i in 0..10 {
            let p = PathBuf::from(format!("/tmp/discord-ipc-{i}"));
            let owned = std::fs::symlink_metadata(&p)
                .map(|m| std::os::unix::fs::MetadataExt::uid(&m) == uid)
                .unwrap_or(false);
            if owned {
                candidates.push(p);
            }
        }
    }

    // Return only unique paths that actually exist on the system
    let mut seen = std::collections::HashSet::new();
    let mut existing = Vec::new();
    for p in candidates {
        if p.exists() && seen.insert(p.clone()) {
            existing.push(p);
        }
    }

    existing
}

/// Timeout for writing one frame to the Discord socket.
const IPC_WRITE_TIMEOUT: Duration = Duration::from_secs(2);

/// Writes a binary Discord IPC protocol frame:
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

    // A hung Discord client must not block the integration thread forever.
    tokio::time::timeout(IPC_WRITE_TIMEOUT, async {
        writer.write_all(&header).await?;
        writer.write_all(payload_bytes).await?;
        writer.flush().await
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "Discord IPC write timed out"))?
}

/// Reads a single binary Discord IPC frame from the socket.
async fn read_ipc_frame<R>(reader: &mut R) -> std::io::Result<(u32, String)>
where
    R: AsyncReadExt + Unpin,
{
    let mut header = [0u8; 8];
    reader.read_exact(&mut header).await?;
    let opcode = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
    let length = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);

    if length > 1024 * 1024 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Discord IPC frame exceeds the 1 MB limit",
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

/// Builds the activity structure (Activity Type 2: Listening) for Discord RPC.
///
/// Discord Rich Presence rules for Activity Type 2 (Listening):
/// - `details`: track title (line 1)
/// - `state`: artist (line 2). The album is not repeated here, because it appears
///   in line 3 as `assets.large_text` or the cover tooltip.
/// - `assets.large_text`: album (line 3 / tooltip)
/// - `timestamps`: progress bar. Discord needs `start` and `end` in UNIX seconds to draw
///   the progress bar with the current and total time (e.g. 01:42 [====-----] 03:07).
pub fn build_activity_payload(
    track: &DiscordTrackInfo,
    playback_state: PlaybackState,
    current_position_ms: u64,
    current_duration_ms: u64,
    now_unix: u64,
) -> serde_json::Value {
    let is_playing = playback_state == PlaybackState::Playing;

    // Line 1: track title
    let details = if track.title.trim().is_empty() {
        "Unknown Track".to_string()
    } else {
        truncate_str(&track.title, 128)
    };

    // Line 2: artist (only the artist, without repeating the album)
    let state = if !track.artist.trim().is_empty() {
        truncate_str(&track.artist, 128)
    } else {
        "Auralune".to_string()
    };

    // Line 3: album (and the cover tooltip)
    let large_text = if !track.album.trim().is_empty() {
        truncate_str(&track.album, 128)
    } else {
        "Auralune Player".to_string()
    };

    // Timestamps for the Discord progress bar (Type 2: Listening)
    // Discord renders the progress bar only when both `start` and `end` are present (in unix seconds)
    let timestamps = if is_playing {
        let elapsed_secs = current_position_ms / 1000;
        let start_time = now_unix.saturating_sub(elapsed_secs);
        let duration_secs = current_duration_ms / 1000;

        if duration_secs > 0 {
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

    // ONLY public HTTPS/HTTP addresses or asset keys may be sent to the Discord Gateway.
    let default_logo_url = "https://raw.githubusercontent.com/Das-Letzte-Kemonomimi/Aura-Lune/main/src-tauri/icons/128x128.png";
    let large_image = match &track.art_url {
        Some(url) if url.starts_with("http://") || url.starts_with("https://") => url.clone(),
        _ => default_logo_url.to_string(),
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

    activity
}
