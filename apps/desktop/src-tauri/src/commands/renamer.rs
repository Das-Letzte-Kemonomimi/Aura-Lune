use crate::AppState;
use domain::renamer::{
    format_pattern_for_track, resolve_renamed_path, RenamePreviewItem, RenamerTrackInfo,
};
use std::fs;
use tauri::State;

#[tauri::command]
pub async fn preview_rename_tracks(
    pattern: String,
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<RenamePreviewItem>, String> {
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
                        error: Some(err),
                    });
                }
            }
        }
    }
    Ok(items)
}

#[tauri::command]
pub async fn execute_rename_tracks(
    items: Vec<(i64, String)>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let mut renamed_count = 0;
    for (track_id, target_path) in items {
        if let Ok(Some(track)) = state.db.get_track_by_id(track_id).await {
            let old_p = std::path::Path::new(&track.path);
            let new_p = std::path::Path::new(&target_path);

            if old_p == new_p {
                continue;
            }

            if let Some(parent) = new_p.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if fs::rename(old_p, new_p).is_ok() {
                let _ = state.db.update_track_path(track_id, &target_path).await;
                renamed_count += 1;
            }
        }
    }
    Ok(renamed_count)
}
