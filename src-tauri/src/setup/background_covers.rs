//! High-confidence background album cover fetcher.
//!
//! Runs after start-up (delayed 4 s) and whenever library scans index new tracks.
//! Picks covers only when [`CoverArtArchiveClient::find_high_confidence_cover`] clears
//! `BACKGROUND_AUTO_ACCEPT_SCORE` (90+) with homonym/tracklist safeguards, and never overwrites
//! user-selected or locally discovered covers (`update_album_cover_if_missing`).

use crate::commands::metadata::sync_cover_to_discord_cache;
use crate::media_protocol::album_cover_url_opt;
use crate::AppState;
use metadata::cover_query::AlbumLookupContext;
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, info, warn};

/// Event emitted to the frontend whenever a background cover fetch populates an album cover.
pub const ALBUM_COVER_UPDATED_EVENT: &str = "auralune://album-cover-updated";

/// Event emitted with running state and `processed / total` counts for background cover sync.
pub const COVER_SYNC_PROGRESS_EVENT: &str = "auralune://cover-sync-progress";

/// Setting key controlling automatic background cover fetching (`"false"` disables it).
pub const SETTING_AUTO_FETCH_COVERS_BG: &str = "auto_fetch_covers_bg";

const STARTUP_DELAY: Duration = Duration::from_secs(4);
const INTER_ALBUM_DELAY: Duration = Duration::from_millis(150);
const RETRY_NOT_FOUND_SECS: i64 = 7 * 24 * 60 * 60;
const RETRY_ERROR_SECS: i64 = 60 * 60;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoverSyncProgress {
    pub running: bool,
    pub processed: usize,
    pub total: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoverSyncDispatchResult {
    pub started: bool,
    pub already_running: bool,
    pub progress: CoverSyncProgress,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumCoverUpdatedPayload {
    pub album_id: i64,
    pub cover_path: String,
    pub release_mbid: Option<String>,
}

struct ActiveWorkerGuard<'a>(&'a std::sync::atomic::AtomicBool);

impl Drop for ActiveWorkerGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

pub fn current_cover_sync_progress(state: &AppState) -> CoverSyncProgress {
    state
        .cover_sync_progress
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

fn publish_cover_sync_progress(app: &AppHandle, state: &AppState, progress: CoverSyncProgress) {
    {
        let mut guard = state
            .cover_sync_progress
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *guard = progress.clone();
    }
    let _ = app.emit(COVER_SYNC_PROGRESS_EVENT, progress);
}

/// Dispatches a forced background cover pass unless one is already active.
pub async fn try_dispatch_background_cover_sync(
    app: &AppHandle,
    state: &AppState,
) -> CoverSyncDispatchResult {
    if state
        .cover_worker_active
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return CoverSyncDispatchResult {
            started: false,
            already_running: true,
            progress: current_cover_sync_progress(state),
        };
    }

    let album_ids = state
        .db
        .list_album_ids_needing_background_cover(true, 0, 0)
        .await
        .unwrap_or_default();

    if album_ids.is_empty() {
        let progress = CoverSyncProgress {
            running: false,
            processed: 0,
            total: 0,
        };
        publish_cover_sync_progress(app, state, progress.clone());
        state.cover_worker_active.store(false, Ordering::Release);
        return CoverSyncDispatchResult {
            started: false,
            already_running: false,
            progress,
        };
    }

    let progress = CoverSyncProgress {
        running: true,
        processed: 0,
        total: album_ids.len(),
    };
    publish_cover_sync_progress(app, state, progress.clone());
    state.cover_worker_force_run.store(true, Ordering::Release);
    state.cover_worker_notify.notify_one();

    CoverSyncDispatchResult {
        started: true,
        already_running: false,
        progress,
    }
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

async fn is_background_fetch_enabled(state: &AppState) -> bool {
    state
        .db
        .get_app_setting(SETTING_AUTO_FETCH_COVERS_BG)
        .await
        .ok()
        .flatten()
        .map(|v| v != "false")
        .unwrap_or(true)
}

/// Starts the background cover worker loop inside `state.rt`. Called once from `app_init`.
pub fn spawn_background_cover_worker(app: AppHandle) {
    let Some(state) = app.try_state::<AppState>().map(|s| s.inner().clone()) else {
        warn!("Background cover worker: AppState unavailable");
        return;
    };
    let rt = state.rt.clone();
    rt.spawn(async move {
        tokio::select! {
            _ = tokio::time::sleep(STARTUP_DELAY) => {}
            _ = state.cover_worker_notify.notified() => {}
        }
        loop {
            let forced = state.cover_worker_force_run.swap(false, Ordering::AcqRel);
            if forced || is_background_fetch_enabled(&state).await {
                let claimed = forced
                    || state
                        .cover_worker_active
                        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                        .is_ok();
                if claimed {
                    let _guard = ActiveWorkerGuard(&state.cover_worker_active);
                    run_pending_cover_pass(&app, &state, forced).await;
                }
            }
            state.cover_worker_notify.notified().await;
        }
    });
}

async fn run_pending_cover_pass(app: &AppHandle, state: &AppState, forced: bool) {
    let now = unix_now();
    let album_ids = match state
        .db
        .list_album_ids_needing_background_cover(
            forced,
            now.saturating_sub(RETRY_NOT_FOUND_SECS),
            now.saturating_sub(RETRY_ERROR_SECS),
        )
        .await
    {
        Ok(ids) => ids,
        Err(e) => {
            warn!("Background cover query failed: {e}");
            publish_cover_sync_progress(app, state, CoverSyncProgress::default());
            return;
        }
    };
    if album_ids.is_empty() {
        publish_cover_sync_progress(app, state, CoverSyncProgress::default());
        return;
    }

    let total = album_ids.len();
    let mut processed = 0usize;
    publish_cover_sync_progress(
        app,
        state,
        CoverSyncProgress {
            running: true,
            processed,
            total,
        },
    );

    debug!("Background cover worker: inspecting {total} albums lacking covers");
    for album_id in album_ids {
        if !forced && !is_background_fetch_enabled(state).await {
            break;
        }
        if let Ok(Some(item)) = state.db.get_album_cover_context(album_id).await {
            process_one_album(app, state, item).await;
        }
        processed += 1;
        publish_cover_sync_progress(
            app,
            state,
            CoverSyncProgress {
                running: true,
                processed,
                total,
            },
        );
        tokio::time::sleep(INTER_ALBUM_DELAY).await;
    }

    publish_cover_sync_progress(
        app,
        state,
        CoverSyncProgress {
            running: false,
            processed,
            total,
        },
    );
}

async fn process_one_album(
    app: &AppHandle,
    state: &AppState,
    item: storage::AlbumCoverLookupContext,
) {
    let album = &item.album;
    let now = unix_now();
    let ctx = AlbumLookupContext {
        year: album.year,
        track_count: Some(item.track_count),
        sample_tracks: item.sample_tracks,
        release_mbid: item.release_mbid.clone(),
    };

    // 1. If the file tags (or a split sibling of this album) already carry a MusicBrainz Release ID,
    //    fetch Cover Art Archive first.
    if let Some(mbid) = item
        .release_mbid
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        if let Ok(path) = state.cover_archive.fetch_and_cache_cover(mbid).await {
            let public_url = format!("https://coverartarchive.org/release/{mbid}/front-500");
            persist_and_emit(
                app,
                state,
                album.id,
                &album.title,
                &album.album_artist,
                path,
                Some(mbid.to_string()),
                Some(public_url),
            )
            .await;
            return;
        }
    }

    // 2. Otherwise require high-confidence metadata match (`>= BACKGROUND_AUTO_ACCEPT_SCORE`).
    let Some(cand) = state
        .cover_archive
        .find_high_confidence_cover(&album.title, &album.album_artist, &ctx, Some(&state.mb))
        .await
    else {
        let status = if metadata::cover_query::is_ambiguity_prone(&album.title, &album.album_artist)
        {
            "ambiguous"
        } else {
            "not_found"
        };
        let _ = state
            .db
            .record_cover_lookup_attempt(album.id, status, now, None)
            .await;
        return;
    };

    match state
        .cover_archive
        .download_cover_from_url(&cand.full_url, &format!("album_{}", album.id))
        .await
    {
        Ok(path) => {
            persist_and_emit(
                app,
                state,
                album.id,
                &album.title,
                &album.album_artist,
                path,
                cand.release_mbid,
                Some(cand.full_url),
            )
            .await;
        }
        Err(e) => {
            warn!(
                "Background cover download failed for album #{}: {e}",
                album.id
            );
            let _ = state
                .db
                .record_cover_lookup_attempt(album.id, "error", now, Some(&e.to_string()))
                .await;
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn persist_and_emit(
    app: &AppHandle,
    state: &AppState,
    album_id: i64,
    album_title: &str,
    album_artist: &str,
    disk_path: std::path::PathBuf,
    release_mbid: Option<String>,
    remote_url: Option<String>,
) {
    let path_str = disk_path.to_string_lossy().to_string();
    let updated = match state
        .db
        .update_album_cover_if_missing(album_id, &path_str, release_mbid.as_deref())
        .await
    {
        Ok(u) => u,
        Err(e) => {
            warn!("Failed to store background cover for album #{album_id}: {e}");
            return;
        }
    };
    if !updated {
        return;
    }

    if let Some(url) = remote_url {
        sync_cover_to_discord_cache(
            state,
            Some(album_id),
            Some(album_artist),
            Some(album_title),
            &url,
        );
    }

    if let Some(cover_path) = album_cover_url_opt(album_id, &path_str) {
        info!("Background cover fetched for album #{album_id} ('{album_title}')");
        let _ = app.emit(
            ALBUM_COVER_UPDATED_EVENT,
            AlbumCoverUpdatedPayload {
                album_id,
                cover_path,
                release_mbid,
            },
        );
    }
}
