//! Komendy zarządzania biblioteką muzyczną, indeksowaniem, statystykami i metadanymi utworów.

use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use storage::{AlbumRecord, ArtistRecord, DuplicateGroup, RecapSummaryDto, TrackRecord};
use tauri::State;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummaryDto {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
}

/// Rozwiązuje ścieżkę do okładki (plik lokalny lub URL) do postaci data: URI w formacie Base64.
pub fn resolve_cover_to_data_uri(path_str: &str) -> Option<String> {
    if path_str.starts_with("data:")
        || path_str.starts_with("http://")
        || path_str.starts_with("https://")
    {
        return Some(path_str.to_string());
    }

    let clean_path = if let Some(stripped) = path_str.strip_prefix("file://") {
        stripped
    } else {
        path_str
    };

    let path = Path::new(clean_path);
    if !path.exists() {
        return None;
    }

    let bytes = fs::read(path).ok()?;
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, b64))
}

/// Performs recursive library scan over the specified folder.
pub async fn scan_library_internal(
    state: &AppState,
    folder_path: &str,
) -> Result<ScanSummaryDto, String> {
    if folder_path.trim().is_empty() {
        return Err("Ścieżka do skanowania nie może być pusta".to_string());
    }

    info!("Library scan started for: {}", folder_path);
    let summary = state
        .scanner
        .scan_directory(folder_path, &state.db)
        .await
        .map_err(|e| e.to_string())?;

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
) -> Result<ScanSummaryDto, String> {
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
    let summary = state
        .scanner
        .scan_paths(&path_bufs, &state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

/// Retrieves all indexed tracks from the database.
pub async fn get_library_tracks_internal(state: &AppState) -> Result<Vec<TrackRecord>, String> {
    state.db.list_tracks().await.map_err(|e| e.to_string())
}

/// Retrieves all indexed albums from the database.
pub async fn get_library_albums_internal(state: &AppState) -> Result<Vec<AlbumRecord>, String> {
    state.db.list_albums().await.map_err(|e| e.to_string())
}

/// Retrieves all indexed artists from the database.
pub async fn get_library_artists_internal(state: &AppState) -> Result<Vec<ArtistRecord>, String> {
    state.db.list_artists().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_library(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, String> {
    scan_library_internal(&state, &folder_path).await
}

#[tauri::command]
pub async fn scan_paths(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, String> {
    scan_paths_internal(&state, &paths).await
}

#[tauri::command]
pub async fn get_library_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    get_library_tracks_internal(&state).await
}

#[tauri::command]
pub async fn get_library_albums(state: State<'_, AppState>) -> Result<Vec<AlbumRecord>, String> {
    let albums = state.db.list_albums().await.map_err(|e| e.to_string())?;

    let mut resolved = Vec::with_capacity(albums.len());
    for mut album in albums {
        if let Some(cp) = &album.cover_path {
            album.cover_path = resolve_cover_to_data_uri(cp);
        }
        resolved.push(album);
    }
    Ok(resolved)
}

#[tauri::command]
pub async fn get_library_artists(state: State<'_, AppState>) -> Result<Vec<ArtistRecord>, String> {
    get_library_artists_internal(&state).await
}

#[tauri::command]
pub async fn toggle_favorite(track_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .db
        .toggle_favorite(track_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_track_rating(
    track_id: i64,
    rating: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .set_track_rating(track_id, rating)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn record_track_play(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .db
        .record_track_play(track_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn record_track_listening(
    track_id: i64,
    duration_ms: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .record_track_listening(track_id, duration_ms)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recap_summary(
    period: String,
    state: State<'_, AppState>,
) -> Result<RecapSummaryDto, String> {
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
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_track_plays(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .db
        .reset_track_plays(track_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_favorite_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    state
        .db
        .list_favorite_tracks()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recently_played_tracks(
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    let l = limit.unwrap_or(30);
    state
        .db
        .list_recently_played_tracks(l)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_top_played_tracks(
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    let l = limit.unwrap_or(30);
    state
        .db
        .list_top_played_tracks(l)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_hires_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    state
        .db
        .list_hires_tracks()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_duplicate_tracks(
    state: State<'_, AppState>,
) -> Result<Vec<DuplicateGroup>, String> {
    state
        .db
        .find_duplicate_tracks()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_track_record(
    track_id: i64,
    delete_file: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if delete_file {
        if let Ok(Some(track)) = state.db.get_track_by_id(track_id).await {
            let p = PathBuf::from(&track.path);
            if p.exists() {
                let _ = fs::remove_file(p);
            }
        }
    }
    state
        .db
        .delete_track(track_id)
        .await
        .map_err(|e| e.to_string())
}
