//! Eksport statusu odtwarzacza do pliku `/tmp/auralune.json` dla Waybara, Hyprlanda, Polybara i innych pasków zadań Linuksa.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
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

/// Domyślna ścieżka eksportu statusu dla Waybara / Hyprlanda.
pub const DEFAULT_WAYBAR_STATUS_PATH: &str = "/tmp/auralune.json";

/// Zapisuje status atomowo do pliku JSON (poprzez plik tymczasowy i `fs::rename`),
/// aby uniknąć odczytu częściowo zapisanego pliku przez proces Waybara.
pub fn write_waybar_status(status: &WaybarStatus) -> std::io::Result<()> {
    write_waybar_status_to_path(status, DEFAULT_WAYBAR_STATUS_PATH)
}

/// Zapisuje status do wskazanego pliku.
pub fn write_waybar_status_to_path(
    status: &WaybarStatus,
    target_path: &str,
) -> std::io::Result<()> {
    let json_data = serde_json::to_string_pretty(status)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    let tmp_path = format!("{}.tmp.{}", target_path, std::process::id());
    fs::write(&tmp_path, json_data)?;
    if let Err(e) = fs::rename(&tmp_path, target_path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }

    debug!("Zaktualizowano plik statusu Waybar: {}", target_path);
    Ok(())
}

/// Czyści plik statusu przy zamykaniu aplikacji.
pub fn cleanup_waybar_status() {
    let p = Path::new(DEFAULT_WAYBAR_STATUS_PATH);
    if p.exists() {
        if let Err(e) = fs::remove_file(p) {
            error!("Błąd usuwania pliku statusu Waybar: {}", e);
        }
    }
}
