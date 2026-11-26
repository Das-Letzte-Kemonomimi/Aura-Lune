//! Komendy zarządzania biblioteką muzyczną, indeksowaniem, statystykami i metadanymi utworów.

use super::error::CommandError;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use storage::{AlbumRecord, DuplicateGroup, RecapSummaryDto, TrackRecord};
use tauri::State;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummaryDto {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
}

/// Maksymalny rozmiar lokalnego pliku okładki zwracanego do interfejsu jako data: URI.
const MAX_COVER_FILE_BYTES: u64 = 20 * 1024 * 1024;

/// Rozwiązuje ścieżkę do okładki (plik lokalny lub URL) do postaci data: URI w formacie Base64.
///
/// Plik lokalny musi (po rozwiązaniu dowiązań) być obrazem — `cover.jpg` będący dowiązaniem
/// do np. `~/.ssh/id_rsa` nie zostanie odczytany.
pub fn resolve_cover_to_data_uri(path_str: &str) -> Option<String> {
    if path_str.starts_with("data:")
        || path_str.starts_with("http://")
        || path_str.starts_with("https://")
    {
        return Some(path_str.to_string());
    }

    let path = super::paths::ensure_readable(
        &audio_engine::uri::local_path(path_str),
        super::paths::IMAGE_EXTENSIONS,
    )
    .ok()?;
    if fs::metadata(&path).ok()?.len() > MAX_COVER_FILE_BYTES {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    Some(image_data_uri(&ext, &bytes))
}

/// Koduje bajty obrazu jako `data:<mime>;base64,…` (typ MIME z rozszerzenia).
pub fn image_data_uri(extension: &str, bytes: &[u8]) -> String {
    let mime = match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{mime};base64,{b64}")
}

/// Performs recursive library scan over the specified folder.
pub async fn scan_library_internal(
    state: &AppState,
    folder_path: &str,
) -> Result<ScanSummaryDto, CommandError> {
    if folder_path.trim().is_empty() {
        return Err(CommandError::validation(
            "Ścieżka do skanowania nie może być pusta",
        ));
    }

    info!("Library scan started for: {}", folder_path);
    let summary = state.scanner.scan_directory(folder_path, &state.db).await?;

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

/// Scans specific paths (files or folders) and inserts or updates metadata in DB.
pub async fn scan_paths_internal(
    state: &AppState,
    paths: &[String],
) -> Result<ScanSummaryDto, CommandError> {
    if paths.is_empty() {
        return Ok(ScanSummaryDto {
            total_files_found: 0,
            new_or_updated_tracks: 0,
            skipped_unchanged: 0,
            errors: 0,
        });
    }

    info!("Scanning {} specific paths", paths.len());
    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let summary = state.scanner.scan_paths(&path_bufs, &state.db).await?;

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

/// Retrieves all indexed tracks from the database.
pub async fn get_library_tracks_internal(
    state: &AppState,
) -> Result<Vec<TrackRecord>, CommandError> {
    state.db.list_tracks().await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn scan_library(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, CommandError> {
    scan_library_internal(&state, &folder_path).await
}

#[tauri::command]
pub async fn scan_paths(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, CommandError> {
    scan_paths_internal(&state, &paths).await
}

#[tauri::command]
pub async fn get_library_tracks(
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, CommandError> {
    get_library_tracks_internal(&state).await
}

#[tauri::command]
pub async fn get_library_albums(
    state: State<'_, AppState>,
) -> Result<Vec<AlbumRecord>, CommandError> {
    let albums = state.db.list_albums().await?;

    // Odczyt i kodowanie Base64 wszystkich okładek to blokujące I/O — poza wątkami Tokio.
    tokio::task::spawn_blocking(move || {
        albums
            .into_iter()
            .map(|mut album| {
                if let Some(cp) = &album.cover_path {
                    album.cover_path = resolve_cover_to_data_uri(cp);
                }
                album
            })
            .collect()
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn toggle_favorite(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<bool, CommandError> {
    state
        .db
        .toggle_favorite(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_track_rating(
    track_id: i64,
    rating: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .set_track_rating(track_id, rating)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn record_track_play(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .record_track_play(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_recap_summary(
    period: String,
    state: State<'_, AppState>,
) -> Result<RecapSummaryDto, CommandError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let since_epoch = match period.as_str() {
        "week" => now.saturating_sub(7 * 86400),
        "month" => now.saturating_sub(30 * 86400),
        "year" => now.saturating_sub(365 * 86400),
        _ => 0, // all_time
    };

    state
        .db
        .get_recap_summary(&period, since_epoch)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn reset_track_plays(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .reset_track_plays(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn find_duplicate_tracks(
    state: State<'_, AppState>,
) -> Result<Vec<DuplicateGroup>, CommandError> {
    state
        .db
        .find_duplicate_tracks()
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_track_record(
    track_id: i64,
    delete_file: bool,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    if delete_file {
        if let Some(track) = state.db.get_track_by_id(track_id).await? {
            // Rekord usuwamy dopiero po udanym usunięciu pliku — inaczej interfejs zgłosiłby
            // sukces, a plik zostałby na dysku (i wrócił przy następnym skanowaniu).
            let p = audio_engine::uri::local_path(&track.path);
            match tokio::fs::remove_file(&p).await {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => {
                    return Err(CommandError::from(e)
                        .context(format!("Nie udało się usunąć pliku {}", p.display())));
                }
            }
        }
    }
    state
        .db
        .delete_track(track_id)
        .await
        .map_err(CommandError::from)
}
