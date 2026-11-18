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
pub fn parse_cue_sheet_content(cue_content: String) -> Result<CueSheet, String> {
    CueSheet::parse(&cue_content)
}

#[tauri::command]
pub async fn list_smart_playlist_tracks(
    smart_type: String,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    match smart_type.as_str() {
        "favorites" => state
            .db
            .list_favorite_tracks()
            .await
            .map_err(|e| e.to_string()),
        "top_played" => state
            .db
            .list_top_played_tracks(25)
            .await
            .map_err(|e| e.to_string()),
        "recently_played" => state
            .db
            .list_recently_played_tracks(50)
            .await
            .map_err(|e| e.to_string()),
        "hires" => state
            .db
            .list_hires_tracks()
            .await
            .map_err(|e| e.to_string()),
        "forgotten" => state
            .db
            .list_forgotten_tracks(50)
            .await
            .map_err(|e| e.to_string()),
        "high_bpm" => state
            .db
            .list_high_bpm_tracks(130.0)
            .await
            .map_err(|e| e.to_string()),
        "top_rated" => state
            .db
            .list_top_rated_tracks()
            .await
            .map_err(|e| e.to_string()),
        _ => Err("Nieznany typ inteligentnej playlisty".to_string()),
    }
}

#[tauri::command]
pub fn load_radio_stream(
    url: String,
    station_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: load_radio_stream('{}', '{}')",
        station_name, url
    );
    state.engine.load_uri(&url).map_err(|e| e.to_string())?;

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
        album: Some("Radio internetowe".to_string()),
        duration_ms: 0,
    };

    state.engine.set_active_item(queue_item.clone());
    crate::commands::playback::sync_mpris_from_queue_item(&queue_item, &state);
    state.engine.play().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_queue_as_playlist(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    info!("Tauri command: save_queue_as_playlist('{}')", name);
    let queue = state.engine.queue();
    if queue.items.is_empty() {
        return Err("Kolejka odtwarzania jest pusta".to_string());
    }

    state.rt.block_on(async {
        let pl_id = state
            .db
            .create_playlist(&name)
            .await
            .map_err(|e| e.to_string())?;

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
    })
}

#[tauri::command]
pub fn create_playlist(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    info!("Tauri command: create_playlist('{}')", name);
    state
        .rt
        .block_on(async { state.db.create_playlist(&name).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_playlist(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: delete_playlist({})", playlist_id);
    state
        .rt
        .block_on(async { state.db.delete_playlist(playlist_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    state
        .rt
        .block_on(async { state.db.list_playlists().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: add_track_to_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .rt
        .block_on(async { state.db.add_track_to_playlist(playlist_id, track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: remove_track_from_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .rt
        .block_on(async {
            state
                .db
                .remove_track_from_playlist(playlist_id, track_id)
                .await
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_playlist_tracks(
    playlist_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    state
        .rt
        .block_on(async { state.db.get_playlist_tracks(playlist_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_playlist_m3u8(
    playlist_id: i64,
    export_path: String,
    use_relative_paths: bool,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: export_playlist_m3u8(playlist_id: {}, export_path: '{}', relative: {})",
        playlist_id, export_path, use_relative_paths
    );
    let tracks = state
        .rt
        .block_on(async { state.db.get_playlist_tracks(playlist_id).await })
        .map_err(|e| format!("Błąd pobierania utworów playlisty: {}", e))?;

    let playlists = state
        .rt
        .block_on(async { state.db.list_playlists().await })
        .map_err(|e| format!("Błąd pobierania listy playlist: {}", e))?;

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

    let export_dir = std::path::Path::new(&export_path).parent();
    let content =
        M3uPlaylist::export_to_m3u8(&playlist_name, &entries, export_dir, use_relative_paths);

    fs::write(&export_path, content)
        .map_err(|e| format!("Nie udało się zapisać pliku M3U8: {}", e))?;

    Ok(format!(
        "Pomyślnie wyeksportowano playlistę '{}' ({} utworów)",
        playlist_name,
        entries.len()
    ))
}

#[tauri::command]
pub fn import_playlist_m3u8(
    file_path: String,
    custom_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<ImportM3uResult, String> {
    info!("Tauri command: import_playlist_m3u8('{}')", file_path);

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Nie udało się odczytać pliku M3U/M3U8: {}", e))?;

    let path_obj = std::path::Path::new(&file_path);
    let base_dir = path_obj.parent();

    let fallback_name = path_obj
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Zaimportowana Playlista");

    let playlist_name = custom_name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| fallback_name.to_string());

    let m3u = M3uPlaylist::parse(&content, &playlist_name, base_dir)?;

    state.rt.block_on(async {
        let playlist_id = state
            .db
            .create_playlist(&m3u.name)
            .await
            .map_err(|e| format!("Błąd tworzenia playlisty w bazie: {}", e))?;

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
                    error!("Błąd dodawania utworu {} do playlisty: {}", track.id, e);
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
    })
}
