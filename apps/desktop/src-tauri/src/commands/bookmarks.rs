use super::error::CommandError;
use crate::AppState;
use domain::TrackBookmark;
use tauri::State;

#[tauri::command]
pub async fn save_bookmark(
    track_id: i64,
    position_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .save_bookmark(track_id, position_ms)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_bookmark(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<u64>, CommandError> {
    state
        .db
        .get_bookmark(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_bookmark(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .delete_bookmark(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_track_bookmarks(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<TrackBookmark>, CommandError> {
    state
        .db
        .get_track_bookmarks(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn add_track_bookmark(
    track_id: i64,
    name: String,
    position_ms: u64,
    state: State<'_, AppState>,
) -> Result<TrackBookmark, CommandError> {
    state
        .db
        .add_track_bookmark(track_id, &name, position_ms)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn update_track_bookmark(
    bookmark_id: i64,
    name: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .update_track_bookmark(bookmark_id, &name)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_track_bookmark(
    bookmark_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .delete_track_bookmark(bookmark_id)
        .await
        .map_err(CommandError::from)
}
