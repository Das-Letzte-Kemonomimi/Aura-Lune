//! Eksport statusu odtwarzacza do `$XDG_RUNTIME_DIR/auralune/auralune.json` dla Waybara, Hyprlanda, Polybara i innych pasków zadań Linuksa.

use crate::runtime_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, error};

/// Struktura statusu zgodna z modułem custom Waybar (`return-type: "json"`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaybarStatus {
    /// Główny tekst wyświetlany na pasku (np. "Artysta - Tytuł")
    pub text: String,
    /// Klasa alternatywna (np. "playing", "paused", "stopped")
    pub alt: String,
    /// Wielolinijkowy dymek ze szczegółami po najechaniu myszką
    pub tooltip: String,
    /// Klasa CSS dla stylizowania w style.css Waybara
    pub class: String,
    /// Postęp odtwarzania w procentach (0 - 100)
    pub percentage: u8,
    /// Poziom głośności w procentach (0 - 100)
    pub volume: u8,
    /// Opcjonalna ścieżka do okładki albumu
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
            text: "Auralune: Gotowy".to_string(),
            alt: "stopped".to_string(),
            tooltip: "Auralune Hi-Fi Music Player\nBrak aktywnego odtwarzania".to_string(),
            class: "stopped".to_string(),
            percentage: 0,
            volume: 100,
            art_url: None,
            title: "Brak utworu".to_string(),
            artist: "Auralune".to_string(),
            album: "".to_string(),
            state: "Stopped".to_string(),
            position_ms: 0,
            duration_ms: 0,
        }
    }
}

/// Zapisuje status atomowo do pliku JSON w prywatnym katalogu uruchomieniowym
/// (`$XDG_RUNTIME_DIR/auralune/auralune.json`, zob. [`crate::runtime_dir`]).
pub fn write_waybar_status(status: &WaybarStatus) -> std::io::Result<()> {
    let dir = runtime_dir::ensure_runtime_dir()?;
    write_waybar_status_to_path(status, dir.join(runtime_dir::WAYBAR_STATUS_FILE))
}

/// Zapisuje status do wskazanego pliku (poprzez plik tymczasowy `0600` i `fs::rename`),
/// aby Waybar nigdy nie odczytał częściowo zapisanego pliku.
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
        // O_EXCL (create_new) odmawia także istniejącego dowiązania symbolicznego.
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

    debug!(
        "Zaktualizowano plik statusu Waybar: {}",
        target_path.display()
    );
    Ok(())
}

/// Czyści plik statusu przy zamykaniu aplikacji.
pub fn cleanup_waybar_status() {
    let p = runtime_dir::waybar_status_path();
    match fs::remove_file(&p) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => error!("Błąd usuwania pliku statusu Waybar: {}", e),
    }
}
