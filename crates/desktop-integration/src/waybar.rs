//! Exports the player status to `$XDG_RUNTIME_DIR/auralune/auralune.json` for Waybar, Hyprland, Polybar and other Linux bars.

use crate::runtime_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tracing::{debug, error};

static LAST_WRITTEN_WAYBAR: Mutex<Option<WaybarStatus>> = Mutex::new(None);

/// Status structure compatible with the Waybar custom module (`return-type: "json"`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaybarStatus {
    /// Main text shown on the bar (e.g. "Artist - Title")
    pub text: String,
    /// Alternative class (e.g. "playing", "paused", "stopped")
    pub alt: String,
    /// Multi-line tooltip with details on hover
    pub tooltip: String,
    /// CSS class for styling in Waybar's style.css
    pub class: String,
    /// Playback progress in percent (0 - 100)
    pub percentage: u8,
    /// Volume level in percent (0 - 100)
    pub volume: u8,
    /// Optional path to the album cover
    pub art_url: Option<String>,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub state: String,
    pub position_ms: u64,
    pub duration_ms: u64,
}

impl Default for WaybarStatus {
    fn default() -> Self {
        Self {
            text: "Auralune: Ready".to_string(),
            alt: "stopped".to_string(),
            tooltip: "Auralune Hi-Fi Music Player
Nothing playing"
                .to_string(),
            class: "stopped".to_string(),
            percentage: 0,
            volume: 100,
            art_url: None,
            title: "No track".to_string(),
            artist: "Auralune".to_string(),
            album: "".to_string(),
            state: "Stopped".to_string(),
            position_ms: 0,
            duration_ms: 0,
        }
    }
}

/// Whether two Waybar snapshots differ meaningfully (ignoring raw `position_ms` jitter so a
/// paused or stopped player emits zero file writes while preserving progress-percentage updates).
pub fn waybar_status_changed(prev: Option<&WaybarStatus>, next: &WaybarStatus) -> bool {
    let Some(prev) = prev else {
        return true;
    };
    prev.text != next.text
        || prev.alt != next.alt
        || prev.tooltip != next.tooltip
        || prev.class != next.class
        || prev.percentage != next.percentage
        || prev.volume != next.volume
        || prev.art_url != next.art_url
        || prev.title != next.title
        || prev.artist != next.artist
        || prev.album != next.album
        || prev.state != next.state
        || prev.duration_ms != next.duration_ms
}

/// Writes the status atomically to the JSON file in the private runtime directory
/// (`$XDG_RUNTIME_DIR/auralune/auralune.json`, see [`crate::runtime_dir`]) when it changed.
pub fn write_waybar_status(status: &WaybarStatus) -> std::io::Result<()> {
    let changed = LAST_WRITTEN_WAYBAR
        .lock()
        .map(|prev| waybar_status_changed(prev.as_ref(), status))
        .unwrap_or(true);
    if !changed {
        return Ok(());
    }
    let dir = runtime_dir::ensure_runtime_dir()?;
    write_waybar_status_to_path(status, dir.join(runtime_dir::WAYBAR_STATUS_FILE))?;
    if let Ok(mut prev) = LAST_WRITTEN_WAYBAR.lock() {
        *prev = Some(status.clone());
    }
    Ok(())
}

/// Writes the status to the given file (through a `0600` temp file and `fs::rename`),
/// so Waybar never reads a partially written file.
pub fn write_waybar_status_to_path(
    status: &WaybarStatus,
    target_path: impl AsRef<Path>,
) -> std::io::Result<()> {
    let target_path = target_path.as_ref();
    let json_data = serde_json::to_string_pretty(status)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    let mut tmp_name = target_path.as_os_str().to_owned();
    tmp_name.push(format!(".tmp.{}", std::process::id()));
    let tmp_path = PathBuf::from(tmp_name);
    let write_tmp = || -> std::io::Result<()> {
        // O_EXCL (create_new) also refuses an existing symbolic link.
        let _ = fs::remove_file(&tmp_path);
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&tmp_path)?;
        file.write_all(json_data.as_bytes())
    };
    if let Err(e) = write_tmp().and_then(|()| fs::rename(&tmp_path, target_path)) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }

    debug!("Updated the Waybar status file: {}", target_path.display());
    Ok(())
}

/// Clears the status file when the app closes.
pub fn cleanup_waybar_status() {
    if let Ok(mut prev) = LAST_WRITTEN_WAYBAR.lock() {
        *prev = None;
    }
    let p = runtime_dir::waybar_status_path();
    match fs::remove_file(&p) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => error!("Failed to remove the Waybar status file: {}", e),
    }
}
