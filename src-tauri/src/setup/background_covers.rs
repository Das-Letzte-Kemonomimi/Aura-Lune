//! High-confidence background album cover fetcher.
//!
//! Runs after start-up (delayed 4 s) and whenever library scans index new tracks.
//! Picks covers only when [`CoverArtArchiveClient::find_high_confidence_cover`] clears
//! `BACKGROUND_AUTO_ACCEPT_SCORE` (90+) with homonym/tracklist safeguards, and never overwrites
//! user-selected or locally discovered covers (`update_album_cover_if_missing`).

use crate::commands::library::resolve_cover_thumbnail;
use crate::commands::metadata::sync_cover_to_discord_cache;
use crate::AppState;
use metadata::cover_query::AlbumLookupContext;
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, info, warn};

/// Event emitted to the frontend whenever a background cover fetch populates an album cover.
pub const ALBUM_COVER_UPDATED_EVENT: &str = "auralune://album-cover-updated";

/// Setting key controlling automatic background cover fetching (`"false"` disables it).
pub const SETTING_AUTO_FETCH_COVERS_BG: &str = "auto_fetch_covers_bg";

const STARTUP_DELAY: Duration = Duration::from_secs(4);
const INTER_ALBUM_DELAY: Duration = Duration::from_millis(150);
const RETRY_NOT_FOUND_SECS: i64 = 7 * 24 * 60 * 60;
const RETRY_ERROR_SECS: i64 = 60 * 60;
const BATCH_LIMIT: i64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumCoverUpdatedPayload {
    pub album_id: i64,
    pub cover_path: String,
    pub release_mbid: Option<String>,
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
        tokio::time::sleep(STARTUP_DELAY).await;
        loop {
            let forced = state.cover_worker_force_run.swap(false, Ordering::AcqRel);
            if forced || is_background_fetch_enabled(&state).await {
                run_pending_cover_pass(&app, &state, forced).await;
            }
            state.cover_worker_notify.notified().await;
        }
    });
}

async fn run_pending_cover_pass(app: &AppHandle, state: &AppState, forced: bool) {
    loop {
        if !forced && !is_background_fetch_enabled(state).await {
            return;
        }
        let now = unix_now();
        let error_cutoff = if forced {
            now
        } else {
            now.saturating_sub(RETRY_ERROR_SECS)
        };
        let pending = match state
            .db
            .list_albums_needing_background_cover(
                now.saturating_sub(RETRY_NOT_FOUND_SECS),
                error_cutoff,
                BATCH_LIMIT,
            )
            .await
        {
            Ok(list) => list,
            Err(e) => {
                warn!("Background cover query failed: {e}");
                return;
            }
        };
        if pending.is_empty() {
            return;
        }

        debug!(
            "Background cover worker: inspecting {} albums lacking covers",
            pending.len()
        );
        for item in pending {
            if !forced && !is_background_fetch_enabled(state).await {
                return;
            }
            process_one_album(app, state, item).await;
            tokio::time::sleep(INTER_ALBUM_DELAY).await;
        }
    }
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
        release_mbid: album.release_mbid.clone(),
    };

    // 1. If the file tags already contain a MusicBrainz Release ID, fetch Cover Art Archive first.
    if let Some(mbid) = album
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

    let thumb_uri = tokio::task::spawn_blocking(move || resolve_cover_thumbnail(&path_str))
        .await
        .ok()
        .flatten();
    if let Some(cover_path) = thumb_uri {
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
