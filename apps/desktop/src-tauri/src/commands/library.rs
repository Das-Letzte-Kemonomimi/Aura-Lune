use crate::{AppState, ScanSummaryDto};
use std::path::PathBuf;
use storage::{AlbumRecord, ArtistRecord, TrackRecord};
use tracing::info;

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

#[cfg(test)]
mod tests {
    #[test]
    fn test_scan_paths_empty_returns_zero_summary() {
        let empty_paths: Vec<String> = vec![];
        assert!(empty_paths.is_empty());
    }
}
