use super::error::CommandError;
use crate::AppState;
use domain::queue::QueueItem;
use domain::{CueSheet, ImportM3uResult, M3uEntry, M3uPlaylist, Playlist};
use serde::{Deserialize, Serialize};
use std::fs;
use storage::TrackRecord;
use tauri::State;
use tracing::{error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistExportDto {
    pub name: String,
    pub track_paths: Vec<String>,
}

#[tauri::command]
pub fn parse_cue_sheet_content(cue_content: String) -> Result<CueSheet, CommandError> {
    CueSheet::parse(&cue_content).map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_radio_stream(
    url: String,
    station_name: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        info!(
            "Tauri command: load_radio_stream('{}', '{}')",
            station_name, url
        );
        state.engine.load_uri(&url)?;

        if let Ok(mut t) = state.latest_live_stream_tag.lock() {
            *t = None;
        }

        let queue_item = QueueItem {
            id: format!(
                "radio-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ),
            track_id: None,
            uri: url.clone(),
            title: station_name.clone(),
            artist: station_name.clone(),
            album: Some("Internet Radio".to_string()),
            duration_ms: 0,
        };

        state.engine.set_active_item(queue_item.clone());
        crate::commands::playback::sync_mpris_from_queue_item(&queue_item, &state);
        state.engine.play()?;
        Ok(())
    })
    .await?
}

#[tauri::command]
pub async fn save_queue_as_playlist(
    name: String,
    state: State<'_, AppState>,
) -> Result<i64, CommandError> {
    info!("Tauri command: save_queue_as_playlist('{}')", name);
    let queue = state.engine.queue();
    if queue.items.is_empty() {
        return Err(CommandError::validation("The playback queue is empty"));
    }

    let pl_id = state.db.create_playlist(&name).await?;

    for item in &queue.items {
        let track_id = if let Some(tid) = item.track_id {
            Some(tid)
        } else if let Ok(Some(track)) = state.db.get_track_by_path(&item.uri).await {
            Some(track.id)
        } else {
            None
        };

        if let Some(tid) = track_id {
            let _ = state.db.add_track_to_playlist(pl_id, tid).await;
        }
    }
    Ok(pl_id)
}

#[tauri::command]
pub async fn create_playlist(
    name: String,
    state: State<'_, AppState>,
) -> Result<i64, CommandError> {
    info!("Tauri command: create_playlist('{}')", name);
    state
        .db
        .create_playlist(&name)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_playlist(
    playlist_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: delete_playlist({})", playlist_id);
    state
        .db
        .delete_playlist(playlist_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, CommandError> {
    state.db.list_playlists().await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!(
        "Tauri command: add_track_to_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .db
        .add_track_to_playlist(playlist_id, track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!(
        "Tauri command: remove_track_from_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .db
        .remove_track_from_playlist(playlist_id, track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_playlist_tracks(
    playlist_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, CommandError> {
    state
        .db
        .get_playlist_tracks(playlist_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn export_playlist_m3u8(
    playlist_id: i64,
    export_path: String,
    use_relative_paths: bool,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    info!(
        "Tauri command: export_playlist_m3u8(playlist_id: {}, export_path: '{}', relative: {})",
        playlist_id, export_path, use_relative_paths
    );
    let export_path = super::paths::ensure_writable(std::path::Path::new(&export_path))?;
    let tracks = state
        .db
        .get_playlist_tracks(playlist_id)
        .await
        .map_err(|e| CommandError::from(e).context("Failed to fetch the playlist tracks"))?;

    let playlists = state
        .db
        .list_playlists()
        .await
        .map_err(|e| CommandError::from(e).context("Failed to fetch the playlist list"))?;

    let playlist_name = playlists
        .iter()
        .find(|p| p.id == playlist_id)
        .map(|p| p.name.clone())
        .unwrap_or_else(|| format!("Playlist_{}", playlist_id));

    let entries: Vec<M3uEntry> = tracks
        .into_iter()
        .map(|t| M3uEntry {
            path_or_uri: t.path,
            title: Some(t.title),
            artist: Some(t.artist),
            duration_seconds: Some(t.duration_ms / 1000),
        })
        .collect();

    let export_dir = export_path.parent();
    let content =
        M3uPlaylist::export_to_m3u8(&playlist_name, &entries, export_dir, use_relative_paths);

    fs::write(&export_path, content)
        .map_err(|e| CommandError::from(e).context("Failed to write the M3U8 file"))?;

    Ok(format!(
        "Exported playlist '{}' ({} tracks)",
        playlist_name,
        entries.len()
    ))
}

#[tauri::command]
pub async fn import_playlist_m3u8(
    file_path: String,
    custom_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<ImportM3uResult, CommandError> {
    info!("Tauri command: import_playlist_m3u8('{}')", file_path);
    let resolved =
        super::paths::ensure_readable(std::path::Path::new(&file_path), &["m3u", "m3u8"])?;

    let content = fs::read_to_string(&resolved)
        .map_err(|e| CommandError::from(e).context("Failed to read the M3U/M3U8 file"))?;

    let path_obj = std::path::Path::new(&file_path);
    let base_dir = path_obj.parent();

    let fallback_name = path_obj
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Imported Playlist");

    let playlist_name = custom_name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| fallback_name.to_string());

    let m3u = M3uPlaylist::parse(&content, &playlist_name, base_dir)?;

    let playlist_id = state.db.create_playlist(&m3u.name).await.map_err(|e| {
        CommandError::from(e).context("Failed to create the playlist in the database")
    })?;

    let mut matched_tracks = 0;
    let mut missing_tracks = Vec::new();

    for entry in &m3u.entries {
        if let Some(track) = state
            .db
            .find_track_by_path_or_uri(&entry.path_or_uri)
            .await
            .unwrap_or(None)
        {
            if let Err(e) = state.db.add_track_to_playlist(playlist_id, track.id).await {
                error!("Failed to add track {} to the playlist: {}", track.id, e);
            } else {
                matched_tracks += 1;
            }
        } else {
            missing_tracks.push(entry.path_or_uri.clone());
        }
    }

    Ok(ImportM3uResult {
        playlist_id,
        playlist_name: m3u.name,
        total_entries: m3u.entries.len(),
        matched_tracks,
        missing_tracks,
    })
}
