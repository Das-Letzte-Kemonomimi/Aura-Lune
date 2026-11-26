use super::error::CommandError;
use crate::AppState;
use domain::renamer::{
    format_pattern_for_track, resolve_renamed_path, validate_rename_target, RenamePreviewItem,
    RenamerTrackInfo,
};
use std::fs;
use tauri::State;
use tracing::warn;

#[tauri::command]
pub async fn preview_rename_tracks(
    pattern: String,
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<RenamePreviewItem>, CommandError> {
    let mut items = Vec::new();
    for id in track_ids {
        if let Ok(Some(track)) = state.db.get_track_by_id(id).await {
            let ext = std::path::Path::new(&track.path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or(&track.format);

            let album_title = if let Some(a_id) = track.album_id {
                state
                    .db
                    .get_album_by_id(a_id)
                    .await
                    .ok()
                    .flatten()
                    .map(|a| a.title)
            } else {
                None
            };

            let info = RenamerTrackInfo {
                title: &track.title,
                artist: &track.artist,
                album_artist: track.album_artist.as_deref(),
                album: album_title.as_deref(),
                track_no: track.track_no,
                disc_no: track.disc_no,
                ext,
            };

            let formatted = format_pattern_for_track(&pattern, &info);

            match resolve_renamed_path(&track.path, &formatted) {
                Ok(new_path) => {
                    let new_path_str = new_path.to_string_lossy().to_string();
                    let will_overwrite = new_path.exists() && new_path_str != track.path;
                    items.push(RenamePreviewItem {
                        track_id: track.id,
                        old_path: track.path,
                        new_path: new_path_str,
                        will_overwrite,
                        is_valid: true,
                        error: None,
                    });
                }
                Err(err) => {
                    items.push(RenamePreviewItem {
                        track_id: track.id,
                        old_path: track.path,
                        new_path: String::new(),
                        will_overwrite: false,
                        is_valid: false,
                        error: Some(err.to_string()),
                    });
                }
            }
        }
    }
    Ok(items)
}

/// Wykonuje zmianę nazw plików.
///
/// Każda ścieżka docelowa jest ponownie walidowana (musi leżeć w katalogu pliku źródłowego,
/// bez `..` i ścieżek absolutnych). Istniejące pliki są nadpisywane wyłącznie przy
/// `allow_overwrite = true` (użytkownik potwierdził nadpisanie w podglądzie).
/// Zwraca liczbę plików, którym zmieniono nazwę.
#[tauri::command]
pub async fn execute_rename_tracks(
    items: Vec<(i64, String)>,
    allow_overwrite: Option<bool>,
    state: State<'_, AppState>,
) -> Result<usize, CommandError> {
    let allow_overwrite = allow_overwrite.unwrap_or(false);
    let mut renamed_count = 0;
    for (track_id, target_path) in items {
        let Ok(Some(track)) = state.db.get_track_by_id(track_id).await else {
            continue;
        };
        if track.path == target_path {
            continue;
        }
        let new_p = match validate_rename_target(&track.path, &target_path) {
            Ok(p) => p,
            Err(e) => {
                warn!(
                    "Odrzucono zmianę nazwy {} -> {}: {}",
                    track.path, target_path, e
                );
                continue;
            }
        };
        if new_p.exists() && !allow_overwrite {
            warn!("Pominięto {}: plik docelowy już istnieje", new_p.display());
            continue;
        }

        let old_p = std::path::PathBuf::from(&track.path);
        let renamed = tokio::task::spawn_blocking(move || {
            if let Some(parent) = new_p.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::rename(&old_p, &new_p).map(|_| new_p)
        })
        .await?;

        match renamed {
            Ok(new_p) => {
                let new_path_str = new_p.to_string_lossy().to_string();
                if let Err(e) = state.db.update_track_path(track_id, &new_path_str).await {
                    warn!(
                        "Nie udało się zaktualizować ścieżki utworu {}: {}",
                        track_id, e
                    );
                }
                renamed_count += 1;
            }
            Err(e) => warn!("Błąd zmiany nazwy {}: {}", track.path, e),
        }
    }
    Ok(renamed_count)
}
