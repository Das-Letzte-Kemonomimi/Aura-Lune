use super::error::CommandError;
use crate::AppState;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use tauri::State;
use tracing::{info, warn};

/// Unique ID for a queue item from outside the library (`<prefix>-<ms>-<counter>`).
///
/// A timestamp alone is not enough: files added in a loop (drag & drop, CLI arguments)
/// got the same ID, which broke MPRIS sync, silence trimming
/// and removing from the queue by ID.
pub fn new_queue_item_id(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{ms}-{n}")
}

/// Schedules a queue state write. Writes are merged (debounced) and done by a single writer
/// thread, so they cannot overtake each other and overwrite a newer state with an older one.
pub fn persist_queue_state(state: &AppState) {
    state.queue_saver.request_save();
}

/// A single delayed write of the playback queue to the database.
#[derive(Clone)]
pub struct QueueSaver {
    tx: std::sync::Arc<tokio::sync::watch::Sender<u64>>,
}

impl QueueSaver {
    /// How long a series of changes (e.g. dragging many items) is merged into one write.
    pub const DEBOUNCE: std::time::Duration = std::time::Duration::from_millis(300);

    pub fn spawn(
        rt: &tokio::runtime::Runtime,
        engine: std::sync::Arc<audio_engine::AudioEngine>,
        db: std::sync::Arc<storage::Database>,
    ) -> Self {
        let (tx, mut rx) = tokio::sync::watch::channel(0u64);
        rt.spawn(async move {
            while rx.changed().await.is_ok() {
                tokio::time::sleep(Self::DEBOUNCE).await;
                rx.borrow_and_update();
                let queue = engine.queue();
                if let Err(e) = db.save_queue_state(&queue).await {
                    warn!("Failed to save the queue state: {}", e);
                }
            }
        });
        Self {
            tx: std::sync::Arc::new(tx),
        }
    }

    pub fn request_save(&self) {
        self.tx.send_modify(|v| *v = v.wrapping_add(1));
    }
}

#[tauri::command]
pub fn get_queue(state: State<'_, AppState>) -> PlaybackQueue {
    state.engine.queue()
}

#[tauri::command]
pub async fn set_queue(
    items: Vec<QueueItem>,
    start_index: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<Option<QueueItem>, CommandError> {
        info!("Tauri command: set_queue ({} tracks)", items.len());
        let active = state.engine.set_queue(items, start_index)?;
        after_track_switch(&state, active.as_ref());
        Ok(active)
    })
    .await?
}

#[tauri::command]
pub fn add_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), CommandError> {
    info!("Tauri command: add_to_queue('{}')", item.title);
    state.engine.add_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

/// Adds many URI paths to the queue at once, without sequential round-trips
/// to SQLite. Persisting runs once after all items are added.
#[tauri::command]
pub async fn add_uris_to_queue(
    uris: Vec<String>,
    state: State<'_, AppState>,
) -> Result<usize, CommandError> {
    info!("Tauri command: add_uris_to_queue({} paths)", uris.len());
    if uris.is_empty() {
        return Ok(0);
    }

    // Expand folders recursively and collect only audio files (walking directories
    // blocks, so it runs off the Tokio threads).
    let resolved_files = tokio::task::spawn_blocking(move || {
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
            } else if (path.is_file()
                && library::LibraryScanner::is_supported_audio_extension(path))
                || uri.starts_with("http://")
                || uri.starts_with("https://")
            {
                resolved_files.push(uri);
            }
        }
        resolved_files
    })
    .await
    .map_err(|e| CommandError::internal(format!("Folder walk interrupted: {e}")))?;

    if resolved_files.is_empty() {
        return Ok(0);
    }

    let db = state.db.clone();
    let mut added = 0usize;

    for uri in &resolved_files {
        // Look up metadata in the database (asynchronously)
        let track_opt = db.get_track_by_path(uri).await.ok().flatten();

        let item = if let Some(t) = track_opt {
            db.queue_item_for_track(&t).await
        } else {
            let title = std::path::Path::new(uri)
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or(uri)
                .to_string();
            QueueItem {
                id: new_queue_item_id("drop"),
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

    // Save the queue state only once, after all items are added
    persist_queue_state(&state);
    Ok(added)
}

#[tauri::command]
pub fn add_next_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), CommandError> {
    info!("Tauri command: add_next_to_queue('{}')", item.title);
    state.engine.add_next_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn remove_from_queue(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
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
) -> Result<bool, CommandError> {
    info!("Tauri command: reorder_queue({} -> {})", from_idx, to_idx);
    let res = state.engine.move_in_queue(from_idx, to_idx);
    persist_queue_state(&state);
    Ok(res)
}

#[tauri::command]
pub async fn clear_queue(state: State<'_, AppState>) -> Result<(), CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        info!("Tauri command: clear_queue()");
        state.engine.clear_queue();
        persist_queue_state(&state);
        Ok(())
    })
    .await?
}

#[tauri::command]
pub async fn play_queue_index(
    index: usize,
    expected_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<Option<QueueItem>, CommandError> {
        info!(
            "Tauri command: play_queue_index({}, expected_id: {:?})",
            index, expected_id
        );
        let target_index = if let Some(ref target_id) = expected_id {
            state.engine.with_queue(|q| {
                if index < q.items.len() && q.items[index].id == *target_id {
                    index
                } else if let Some(found) = q.items.iter().position(|it| it.id == *target_id) {
                    warn!(
                        "play_queue_index: correcting index from {} to {} for track {}",
                        index, found, target_id
                    );
                    found
                } else {
                    index
                }
            })
        } else {
            index
        };

        let active = state.engine.play_index(target_index)?;
        after_track_switch(&state, active.as_ref());
        Ok(active)
    })
    .await?
}

#[tauri::command]
pub async fn play_next(state: State<'_, AppState>) -> Result<Option<QueueItem>, CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<Option<QueueItem>, CommandError> {
        info!("Tauri command: play_next()");
        play_next_internal(&state)
    })
    .await?
}

/// Next track + MPRIS sync and queue save (command, system tray).
pub fn play_next_internal(state: &AppState) -> Result<Option<QueueItem>, CommandError> {
    let next_item = state.engine.play_next()?;
    after_track_switch(state, next_item.as_ref());
    Ok(next_item)
}

#[tauri::command]
pub async fn play_previous(state: State<'_, AppState>) -> Result<Option<QueueItem>, CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<Option<QueueItem>, CommandError> {
        info!("Tauri command: play_previous()");
        play_previous_internal(&state)
    })
    .await?
}

/// Previous track + MPRIS sync and queue save (command, system tray).
pub fn play_previous_internal(state: &AppState) -> Result<Option<QueueItem>, CommandError> {
    let prev_item = state.engine.play_previous()?;
    after_track_switch(state, prev_item.as_ref());
    Ok(prev_item)
}

/// Shared handling after a track switch: clears the stream tag (except for radio),
/// syncs MPRIS and saves the queue.
fn after_track_switch(state: &AppState, item: Option<&QueueItem>) {
    if let Some(item) = item {
        if !item.id.starts_with("radio-") {
            if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                *t = None;
            }
        }
        crate::commands::playback::sync_mpris_from_queue_item(item, state);
    }
    persist_queue_state(state);
}

#[tauri::command]
pub fn set_loop_mode(mode: LoopMode, state: State<'_, AppState>) -> Result<(), CommandError> {
    info!("Tauri command: set_loop_mode({:?})", mode);
    state.engine.set_loop_mode(mode);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn toggle_shuffle(state: State<'_, AppState>) -> Result<bool, CommandError> {
    let current = state.engine.shuffle();
    let new_val = !current;
    info!("Tauri command: toggle_shuffle({} -> {})", current, new_val);
    state.engine.set_shuffle(new_val);
    persist_queue_state(&state);
    Ok(new_val)
}

/// Sets shuffle to a specific value (idempotent, unlike `toggle_shuffle`).
#[tauri::command]
pub fn set_shuffle(enabled: bool, state: State<'_, AppState>) -> Result<bool, CommandError> {
    info!("Tauri command: set_shuffle({})", enabled);
    if state.engine.shuffle() != enabled {
        state.engine.set_shuffle(enabled);
        persist_queue_state(&state);
    }
    Ok(enabled)
}

#[tauri::command]
pub fn toggle_stop_after_current(state: State<'_, AppState>) -> Result<bool, CommandError> {
    let current = state.engine.stop_after_current();
    let new_val = !current;
    info!(
        "Tauri command: toggle_stop_after_current({} -> {})",
        current, new_val
    );
    state.engine.set_stop_after_current(new_val);
    Ok(new_val)
}

/// Sets a library track as active (loaded but not playing), e.g. when after the first
/// scan the default demo track is replaced by the user's first track.
/// Does not interrupt current playback.
#[tauri::command]
pub async fn set_active_track(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: set_active_track({})", track_id);
    if state.engine.state() == domain::PlaybackState::Playing {
        return Ok(());
    }
    let track =
        state.db.get_track_by_id(track_id).await?.ok_or_else(|| {
            CommandError::not_found(format!("Track with ID {} not found", track_id))
        })?;
    let item = state.db.queue_item_for_track(&track).await;
    let state_bg = state.inner().clone();
    let uri = track.path;
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        state_bg.engine.set_active_item(item);
        state_bg.engine.load_uri(&uri)?;
        Ok(())
    })
    .await??;
    persist_queue_state(&state);
    Ok(())
}
