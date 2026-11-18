use crate::AppState;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use tauri::State;
use tracing::{info, warn};

pub fn persist_queue_state(state: &AppState) {
    let queue = state.engine.queue();
    let db = state.db.clone();
    state.rt.spawn(async move {
        if let Err(e) = db.save_queue_state(&queue).await {
            tracing::warn!("Nie udało się zapisać stanu kolejki: {}", e);
        }
    });
}

#[tauri::command]
pub fn get_queue(state: State<'_, AppState>) -> PlaybackQueue {
    state.engine.queue()
}

#[tauri::command]
pub fn set_queue(
    items: Vec<QueueItem>,
    start_index: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: set_queue ({} utworów)", items.len());
    let active = state
        .engine
        .set_queue(items, start_index)
        .map_err(|e| e.to_string())?;
    if let Some(item) = &active {
        if !item.id.starts_with("radio-") {
            if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                *t = None;
            }
        }
        crate::commands::playback::sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(active)
}

#[tauri::command]
pub fn add_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: add_to_queue('{}')", item.title);
    state.engine.add_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

/// Dodaje wiele ścieżek URI do kolejki za jednym razem — bez sekwencyjnych round-tripów
/// do SQLite. Operacja persist jest wywoływana raz po dodaniu wszystkich elementów.
#[tauri::command]
pub async fn add_uris_to_queue(
    uris: Vec<String>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    info!("Tauri command: add_uris_to_queue({} ścieżek)", uris.len());
    if uris.is_empty() {
        return Ok(0);
    }

    // Rozwiń rekurencyjnie foldery i zbierz wyłącznie pliki audio
    let mut resolved_files = Vec::new();
    for uri in uris {
        let path = std::path::Path::new(&uri);
        if path.is_dir() {
            for entry in walkdir::WalkDir::new(path)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                if p.is_file() && library::LibraryScanner::is_supported_audio_extension(p) {
                    resolved_files.push(p.to_string_lossy().to_string());
                }
            }
        } else if (path.is_file() && library::LibraryScanner::is_supported_audio_extension(path))
            || uri.starts_with("http://")
            || uri.starts_with("https://")
        {
            resolved_files.push(uri);
        }
    }

    if resolved_files.is_empty() {
        return Ok(0);
    }

    let db = state.db.clone();
    let mut added = 0usize;

    for uri in &resolved_files {
        // Sprawdź bazę danych w poszukiwaniu metadanych (asynchronicznie)
        let track_opt = db.get_track_by_path(uri).await.ok().flatten();

        let item = if let Some(t) = track_opt {
            QueueItem {
                id: format!("track-{}", t.id),
                track_id: Some(t.id),
                uri: t.path.clone(),
                title: t.title.clone(),
                artist: t.artist.clone(),
                album: t.album_artist.clone(),
                duration_ms: t.duration_ms as u64,
            }
        } else {
            let title = std::path::Path::new(uri)
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or(uri)
                .to_string();
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_micros();
            QueueItem {
                id: format!("drop-{}-{}", ts, added),
                track_id: None,
                uri: uri.to_string(),
                title,
                artist: String::new(),
                album: None,
                duration_ms: 0,
            }
        };

        state.engine.add_to_queue(item);
        added += 1;
    }

    // Zapis stanu kolejki tylko raz po dodaniu wszystkich elementów
    persist_queue_state(&state);
    Ok(added)
}

#[tauri::command]
pub fn add_next_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: add_next_to_queue('{}')", item.title);
    state.engine.add_next_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn remove_from_queue(id: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: remove_from_queue('{}')", id);
    state.engine.remove_from_queue(&id);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn reorder_queue(
    from_idx: usize,
    to_idx: usize,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    info!("Tauri command: reorder_queue({} -> {})", from_idx, to_idx);
    let res = state.engine.move_in_queue(from_idx, to_idx);
    persist_queue_state(&state);
    Ok(res)
}

#[tauri::command]
pub fn clear_queue(state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: clear_queue()");
    state.engine.clear_queue();
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn play_queue_index(
    index: usize,
    expected_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, String> {
    info!(
        "Tauri command: play_queue_index({}, expected_id: {:?})",
        index, expected_id
    );
    let target_index = if let Some(ref target_id) = expected_id {
        let q = state.engine.queue();
        if index < q.items.len() && q.items[index].id == *target_id {
            index
        } else if let Some(found) = q.items.iter().position(|it| it.id == *target_id) {
            warn!(
                "play_queue_index: korekta indeksu z {} na {} dla utworu {}",
                index, found, target_id
            );
            found
        } else {
            index
        }
    } else {
        index
    };

    let active = state
        .engine
        .play_index(target_index)
        .map_err(|e| e.to_string())?;
    if let Some(item) = &active {
        if !item.id.starts_with("radio-") {
            if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                *t = None;
            }
        }
        crate::commands::playback::sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(active)
}

#[tauri::command]
pub fn play_next(state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_next()");
    let next_item = state.engine.play_next().map_err(|e| e.to_string())?;
    if let Some(item) = &next_item {
        if !item.id.starts_with("radio-") {
            if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                *t = None;
            }
        }
        crate::commands::playback::sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(next_item)
}

#[tauri::command]
pub fn play_previous(state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_previous()");
    let prev_item = state.engine.play_previous().map_err(|e| e.to_string())?;
    if let Some(item) = &prev_item {
        if !item.id.starts_with("radio-") {
            if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                *t = None;
            }
        }
        crate::commands::playback::sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(prev_item)
}

#[tauri::command]
pub fn set_loop_mode(mode: LoopMode, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_loop_mode({:?})", mode);
    state.engine.set_loop_mode(mode);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn toggle_shuffle(state: State<'_, AppState>) -> Result<bool, String> {
    let current = state.engine.shuffle();
    let new_val = !current;
    info!("Tauri command: toggle_shuffle({} -> {})", current, new_val);
    state.engine.set_shuffle(new_val);
    persist_queue_state(&state);
    Ok(new_val)
}

#[tauri::command]
pub fn set_stop_after_current(enabled: bool, state: State<'_, AppState>) -> Result<bool, String> {
    info!("Tauri command: set_stop_after_current({})", enabled);
    state.engine.set_stop_after_current(enabled);
    Ok(enabled)
}

#[tauri::command]
pub fn toggle_stop_after_current(state: State<'_, AppState>) -> Result<bool, String> {
    let current = state.engine.stop_after_current();
    let new_val = !current;
    info!(
        "Tauri command: toggle_stop_after_current({} -> {})",
        current, new_val
    );
    state.engine.set_stop_after_current(new_val);
    Ok(new_val)
}

#[tauri::command]
pub fn get_stop_after_current(state: State<'_, AppState>) -> bool {
    state.engine.stop_after_current()
}

#[tauri::command]
pub fn notify_track_looped(
    position_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::commands::devices::notify_track_looped_internal(&state, position_ms)
}
