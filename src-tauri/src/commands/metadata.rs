//! Commands for fetching and editing metadata, album covers, lyrics (LRC) and audio fingerprinting.

use super::error::CommandError;
use crate::commands::library::{resolve_cover_thumbnail, resolve_cover_to_data_uri};
use crate::AppState;
use base64::Engine;
use metadata::cover_query::{match_score_with_context, AlbumLookupContext, CandidateContext};
use metadata::{
    AcoustidClient, CoverCandidateDto, LastFmAuthOverride, LastFmSession, LastFmTrackInfo,
    LyricsDto, ReleaseCandidateDto, TrackFingerprintMatchDto,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::State;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastFmAuthUrlResult {
    pub token: String,
    pub auth_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastFmScrobbleRequest {
    pub session_key: String,
    pub artist: String,
    pub track: String,
    pub album: Option<String>,
    pub duration_sec: Option<u64>,
    pub timestamp: Option<u64>,
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
}

/// Identifies audio track fingerprint using AcoustID and MusicBrainz.
pub async fn identify_track_fingerprint_internal(
    path: &str,
    client_key: Option<String>,
) -> Result<Vec<TrackFingerprintMatchDto>, CommandError> {
    let client = AcoustidClient::new(client_key);
    let path_buf = PathBuf::from(path);
    if !path_buf.exists() {
        return Err(CommandError::not_found(
            "The audio file does not exist on disk",
        ));
    }

    let (duration, fingerprint) = AcoustidClient::generate_fingerprint(&path_buf).await?;

    client
        .lookup(duration, &fingerprint)
        .await
        .map_err(CommandError::from)
}

async fn load_album_lookup_context(
    db: &storage::Database,
    album_id: Option<i64>,
) -> AlbumLookupContext {
    let Some(id) = album_id.filter(|&id| id > 0) else {
        return AlbumLookupContext::default();
    };
    let Ok(Some(ctx)) = db.get_album_cover_context(id).await else {
        return AlbumLookupContext::default();
    };
    AlbumLookupContext {
        year: ctx.album.year,
        track_count: Some(ctx.track_count),
        sample_tracks: ctx.sample_tracks,
        release_mbid: ctx.album.release_mbid,
    }
}

/// Searches for album cover candidates using album verification context (year, track count,
/// sample tracks) alongside Cover Art Archive and MusicBrainz.
pub async fn search_cover_candidates_internal(
    state: &AppState,
    album: &str,
    artist: &str,
    album_id: Option<i64>,
) -> Vec<CoverCandidateDto> {
    info!(
        "Tauri command: search_cover_candidates('{}', '{}', album_id={:?})",
        album, artist, album_id
    );
    let ctx = load_album_lookup_context(&state.db, album_id).await;
    state
        .cover_archive
        .search_cover_candidates_for_album(album, artist, &ctx, Some(&state.mb))
        .await
}

fn push_discord_track_cover(state: &AppState, artist: &str, album: &str, art_url: Option<String>) {
    let Some(discord) = &state.discord_rpc else {
        return;
    };
    let dur = state
        .engine
        .duration()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let pos = state
        .engine
        .position()
        .map(|p| p.as_millis() as u64)
        .unwrap_or(0);
    let current_title = state
        .engine
        .queue()
        .current_item()
        .map(|i| i.title.clone())
        .unwrap_or_default();
    discord.update_track(desktop_integration::DiscordTrackInfo {
        title: current_title,
        artist: artist.to_string(),
        album: album.to_string(),
        duration_ms: dur,
        art_url,
    });
    discord.update_playback_status(state.engine.state(), pos, dur);
}

/// Helper function to update Discord RPC and cover cache when a cover is applied.
pub fn sync_cover_to_discord_cache(
    state: &AppState,
    album_id: Option<i64>,
    artist: Option<&str>,
    album_title: Option<&str>,
    cover_url_or_data: &str,
) {
    let (Some(art), Some(alb)) = (artist, album_title) else {
        return;
    };

    let cache_key = format!(
        "{}---{}",
        art.trim().to_lowercase(),
        alb.trim().to_lowercase()
    );

    if cover_url_or_data.starts_with("http://") || cover_url_or_data.starts_with("https://") {
        if let Ok(mut cache) = state.discord_cover_cache.write() {
            if let Some(id) = album_id.filter(|&id| id > 0) {
                cache.insert(format!("album:{id}"), cover_url_or_data.to_string());
            }
            cache.insert(cache_key, cover_url_or_data.to_string());
        }
        push_discord_track_cover(state, art, alb, Some(cover_url_or_data.to_string()));
    }
}

fn clear_discord_cover_cache(
    state: &AppState,
    album_id: Option<i64>,
    artist: Option<&str>,
    album_title: Option<&str>,
) {
    let (Some(art), Some(alb)) = (artist, album_title) else {
        return;
    };
    let cache_key = format!(
        "{}---{}",
        art.trim().to_lowercase(),
        alb.trim().to_lowercase()
    );
    if let Ok(mut cache) = state.discord_cover_cache.write() {
        if let Some(id) = album_id.filter(|&id| id > 0) {
            cache.remove(&format!("album:{id}"));
        }
        cache.remove(&cache_key);
    }
    push_discord_track_cover(state, art, alb, None);
}

/// Downloads and applies album cover from a URL.
pub async fn apply_cover_url_internal(
    state: &AppState,
    album_id: i64,
    cover_url: &str,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
) -> Result<String, CommandError> {
    info!(
        "Tauri command: apply_cover_url(album_id: {}, url: '{}')",
        album_id, cover_url
    );

    let actual_album_id = if album_id > 0 {
        album_id
    } else if let Some(title) = &album_title {
        let art = artist.as_deref().unwrap_or("Unknown");
        state.db.upsert_album(title, art, None, None, None).await?
    } else {
        return Err(CommandError::validation("Invalid album ID"));
    };

    let path = state
        .cover_archive
        .download_cover_from_url(cover_url, &format!("album_{}", actual_album_id))
        .await?;
    let path_str = path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(actual_album_id, &path_str, None)
        .await?;

    if let Some(tid) = track_id {
        let _ = state.db.link_track_to_album(tid, actual_album_id).await;
    }

    sync_cover_to_discord_cache(
        state,
        Some(actual_album_id),
        artist.as_deref(),
        album_title.as_deref(),
        cover_url,
    );

    cover_file_thumbnail_uri(&path).await
}

/// Applies a local file as an album cover.
pub async fn apply_custom_cover_file_internal(
    state: &AppState,
    album_id: i64,
    file_path: &str,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
) -> Result<String, CommandError> {
    info!(
        "Tauri command: apply_custom_cover_file(album_id: {}, path: '{}')",
        album_id, file_path
    );
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(CommandError::not_found("The given file does not exist"));
    }

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => {
            return Err(CommandError::validation(
                "Only PNG, JPG, WebP or GIF image files are supported",
            ))
        }
    };

    let bytes = tokio::fs::read(path)
        .await
        .map_err(|e| CommandError::from(e).context("Failed to read the file"))?;
    if bytes.len() > 25 * 1024 * 1024 {
        return Err(CommandError::validation(
            "The image file is too large (max. 25 MB)",
        ));
    }

    let actual_album_id = if album_id > 0 {
        album_id
    } else if let Some(title) = &album_title {
        let art = artist.as_deref().unwrap_or("Unknown");
        state.db.upsert_album(title, art, None, None, None).await?
    } else {
        return Err(CommandError::validation("Invalid album ID"));
    };

    let saved_path = state
        .cover_archive
        .save_custom_cover_file(actual_album_id, path)
        .await?;
    let path_str = saved_path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(actual_album_id, &path_str, None)
        .await?;

    if let Some(tid) = track_id {
        let _ = state.db.link_track_to_album(tid, actual_album_id).await;
    }

    clear_discord_cover_cache(
        state,
        Some(actual_album_id),
        artist.as_deref(),
        album_title.as_deref(),
    );

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Validates ListenBrainz user token.
pub async fn validate_listenbrainz_token_internal(
    state: &AppState,
    token: &str,
) -> Result<String, CommandError> {
    info!("Tauri command: validate_listenbrainz_token");
    state
        .listenbrainz
        .validate_token(token)
        .await
        .map_err(CommandError::from)
}

/// Submits currently playing track to ListenBrainz.
pub async fn submit_listenbrainz_playing_now_internal(
    state: &AppState,
    token: &str,
    artist: &str,
    title: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> Result<(), CommandError> {
    state
        .listenbrainz
        .submit_playing_now(token, artist, title, album, duration_ms)
        .await
        .map_err(CommandError::from)
}

/// Submits completed listen to ListenBrainz.
pub async fn submit_listenbrainz_listen_internal(
    state: &AppState,
    token: &str,
    artist: &str,
    title: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> Result<(), CommandError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    state
        .listenbrainz
        .submit_listen(token, artist, title, album, now, duration_ms)
        .await
        .map_err(CommandError::from)
}

/// Generates Last.fm authentication URL and token.
pub async fn lastfm_get_auth_url_internal(
    state: &AppState,
    api_key: Option<String>,
) -> Result<LastFmAuthUrlResult, CommandError> {
    info!("Tauri command: lastfm_get_auth_url");
    let key = api_key
        .as_deref()
        .unwrap_or(metadata::DEFAULT_LASTFM_API_KEY);
    let token = state.lastfm.get_auth_token(Some(key)).await?;
    let auth_url = format!(
        "https://www.last.fm/api/auth/?api_key={}&token={}",
        metadata::urlencoding::encode(key),
        metadata::urlencoding::encode(&token)
    );
    Ok(LastFmAuthUrlResult { token, auth_url })
}

/// Fetches Last.fm web session from approved token.
pub async fn lastfm_fetch_session_internal(
    state: &AppState,
    token: &str,
    api_key: Option<&str>,
    api_secret: Option<&str>,
) -> Result<LastFmSession, CommandError> {
    info!("Tauri command: lastfm_fetch_session");
    state
        .lastfm
        .fetch_session(token, api_key, api_secret)
        .await
        .map_err(CommandError::from)
}

/// Validates existing Last.fm session key.
pub async fn lastfm_validate_session_internal(
    state: &AppState,
    session_key: &str,
    api_key: Option<&str>,
    api_secret: Option<&str>,
) -> Result<String, CommandError> {
    info!("Tauri command: lastfm_validate_session");
    state
        .lastfm
        .validate_session(session_key, api_key, api_secret)
        .await
        .map_err(CommandError::from)
}

/// Updates Last.fm Now Playing status.
pub async fn lastfm_update_now_playing_internal(
    state: &AppState,
    request: &LastFmScrobbleRequest,
) -> Result<(), CommandError> {
    let track_info = LastFmTrackInfo {
        artist: &request.artist,
        track: &request.track,
        album: request.album.as_deref(),
        duration_sec: request.duration_sec,
    };
    let auth = LastFmAuthOverride {
        api_key: request.api_key.as_deref(),
        api_secret: request.api_secret.as_deref(),
    };
    state
        .lastfm
        .update_now_playing(&request.session_key, track_info, auth)
        .await
        .map_err(CommandError::from)
}

/// Submits Last.fm scrobble upon track playback completion.
pub async fn lastfm_scrobble_internal(
    state: &AppState,
    request: &LastFmScrobbleRequest,
) -> Result<(), CommandError> {
    let track_info = LastFmTrackInfo {
        artist: &request.artist,
        track: &request.track,
        album: request.album.as_deref(),
        duration_sec: request.duration_sec,
    };
    let auth = LastFmAuthOverride {
        api_key: request.api_key.as_deref(),
        api_secret: request.api_secret.as_deref(),
    };
    let ts = request.timestamp.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    });
    state
        .lastfm
        .scrobble(&request.session_key, track_info, ts, auth)
        .await
        .map_err(CommandError::from)
}

// ==========================================
// TAURI COMMANDS
// ==========================================

#[tauri::command]
pub async fn save_lyrics_lrc(
    track_path: String,
    lrc_content: String,
) -> Result<String, CommandError> {
    tokio::task::spawn_blocking(move || {
        // The .lrc file goes only next to an existing audio file.
        let track = super::paths::ensure_readable(
            &audio_engine::uri::local_path(&track_path),
            super::paths::AUDIO_EXTENSIONS,
        )?;
        let lrc_path = super::paths::ensure_writable(&track.with_extension("lrc"))?;
        std::fs::write(&lrc_path, lrc_content)
            .map_err(|e| CommandError::from(e).context("Failed to write the LRC file"))?;
        info!("Saved the synced LRC file: {}", lrc_path.display());
        Ok(lrc_path.to_string_lossy().into_owned())
    })
    .await?
}

#[tauri::command]
pub async fn get_track_metadata(
    path: String,
) -> Result<audio_engine::TrackMetadataFullDto, CommandError> {
    tokio::task::spawn_blocking(move || {
        let resolved = super::paths::ensure_readable(
            &audio_engine::uri::local_path(&path),
            super::paths::AUDIO_EXTENSIONS,
        )?;
        audio_engine::read_track_metadata(&resolved.to_string_lossy()).map_err(CommandError::from)
    })
    .await?
}

#[tauri::command]
pub async fn update_track_metadata(
    track_id: i64,
    path: String,
    meta: audio_engine::TrackMetadataFullDto,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    // Tags are written only to the file the library knows under this `track_id`:
    // the UI cannot point at any other file.
    let track =
        state.db.get_track_by_id(track_id).await?.ok_or_else(|| {
            CommandError::not_found(format!("Track with ID {track_id} not found"))
        })?;
    let library_path = audio_engine::uri::local_path(&track.path);
    if library_path != audio_engine::uri::local_path(&path) {
        return Err(CommandError::validation(
            "The file path does not match the track in the library",
        ));
    }

    // 1. Write to the physical audio file through lofty
    let meta_for_file = meta.clone();
    tokio::task::spawn_blocking(move || {
        let resolved =
            super::paths::ensure_readable(&library_path, super::paths::AUDIO_EXTENSIONS)?;
        audio_engine::write_track_metadata(&resolved.to_string_lossy(), &meta_for_file)
            .map_err(CommandError::from)
    })
    .await??;

    // 2. Update in the SQLite database
    state
        .db
        .update_track_metadata(
            track_id,
            &meta.title,
            &meta.artist,
            meta.album_artist.as_deref(),
            meta.track_no.map(|n| n as i64),
            meta.disc_no.map(|n| n as i64),
            meta.album.as_deref(),
            meta.year.map(|y| y as i64),
        )
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn identify_track_fingerprint(
    path: String,
    client_key: Option<String>,
) -> Result<Vec<TrackFingerprintMatchDto>, CommandError> {
    identify_track_fingerprint_internal(&path, client_key).await
}

#[tauri::command]
pub async fn search_musicbrainz_releases(
    album: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Vec<ReleaseCandidateDto>, CommandError> {
    info!(
        "Tauri command: search_musicbrainz_releases('{}', '{}')",
        album, artist
    );
    state
        .mb
        .search_releases(&album, &artist)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn fetch_and_apply_cover(
    album_id: i64,
    mbid: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    info!(
        "Tauri command: fetch_and_apply_cover(album_id: {}, mbid: '{}')",
        album_id, mbid
    );
    let path = state.cover_archive.fetch_and_cache_cover(&mbid).await?;
    let path_str = path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(album_id, &path_str, Some(&mbid))
        .await?;

    if let Ok(Some(album)) = state.db.get_album_by_id(album_id).await {
        let caa_url = format!("https://coverartarchive.org/release/{mbid}/front-500");
        sync_cover_to_discord_cache(
            &state,
            Some(album_id),
            Some(&album.album_artist),
            Some(&album.title),
            &caa_url,
        );
    }

    cover_file_thumbnail_uri(&path).await
}

#[tauri::command]
pub async fn auto_fetch_album_cover(
    album_id: i64,
    album_title: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, CommandError> {
    info!(
        "Tauri command: auto_fetch_album_cover('{}', '{}')",
        album_title, artist
    );
    let ctx = load_album_lookup_context(&state.db, Some(album_id)).await;

    // MusicBrainz first: inspect up to top 3 qualified releases in case #1 has HTTP 404 on CAA.
    match state
        .mb
        .search_releases_with_context(&album_title, &artist, &ctx.sample_tracks)
        .await
    {
        Ok(candidates) => {
            let qualified = candidates
                .into_iter()
                .filter(|c| {
                    let release_year = c
                        .date
                        .as_deref()
                        .and_then(|d| d.get(..4))
                        .and_then(|y| y.parse::<i64>().ok());
                    let cand_ctx = CandidateContext {
                        title: &c.title,
                        artist: &c.artist,
                        year: release_year,
                        track_count: c.track_count,
                        release_mbid: Some(&c.mbid),
                    };
                    c.score >= 85
                        && match_score_with_context(&album_title, &artist, &ctx, &cand_ctx)
                            >= metadata::AUTO_ACCEPT_SCORE
                })
                .take(3);

            for best in qualified {
                match state.cover_archive.fetch_and_cache_cover(&best.mbid).await {
                    Ok(path) => {
                        let path_str = path.to_string_lossy().to_string();
                        state
                            .db
                            .update_album_cover(album_id, &path_str, Some(&best.mbid))
                            .await?;
                        let caa_url = format!(
                            "https://coverartarchive.org/release/{}/front-500",
                            best.mbid
                        );
                        sync_cover_to_discord_cache(
                            &state,
                            Some(album_id),
                            Some(&artist),
                            Some(&album_title),
                            &caa_url,
                        );
                        return Ok(Some(cover_file_thumbnail_uri(&path).await?));
                    }
                    Err(e) => {
                        tracing::warn!("Failed to fetch the cover for MBID {}: {}", best.mbid, e);
                    }
                }
            }
        }
        Err(e) => tracing::warn!("MusicBrainz search failed, trying other sources: {e}"),
    }

    // Deezer / Apple Music / CAA ladder, accepted only when context & metadata match.
    let Some(found) = state
        .cover_archive
        .find_best_cover_for_album(&album_title, &artist, None, &ctx, Some(&state.mb))
        .await
    else {
        return Ok(None);
    };
    let data_uri = apply_cover_url_internal(
        &state,
        album_id,
        &found.full_url,
        Some(album_title),
        Some(artist),
        None,
    )
    .await?;
    Ok(Some(data_uri))
}

#[tauri::command]
pub async fn trigger_background_cover_fetch(
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .cover_worker_force_run
        .store(true, std::sync::atomic::Ordering::Release);
    state.cover_worker_notify.notify_one();
    Ok(())
}

#[tauri::command]
pub async fn search_cover_candidates(
    album: String,
    artist: String,
    album_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<CoverCandidateDto>, CommandError> {
    Ok(search_cover_candidates_internal(&state, &album, &artist, album_id).await)
}

#[tauri::command]
pub async fn apply_cover_url(
    album_id: i64,
    cover_url: String,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    apply_cover_url_internal(&state, album_id, &cover_url, album_title, artist, track_id).await
}

#[tauri::command]
pub async fn apply_custom_cover_file(
    album_id: i64,
    file_path: String,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let resolved = super::paths::ensure_readable(
        std::path::Path::new(&file_path),
        &["png", "jpg", "jpeg", "webp", "gif"],
    )?;
    let file_path = resolved.to_string_lossy();
    apply_custom_cover_file_internal(&state, album_id, &file_path, album_title, artist, track_id)
        .await
}

#[tauri::command]
pub async fn apply_custom_cover_data(
    album_id: i64,
    data_base64: String,
    extension: String,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    info!(
        "Tauri command: apply_custom_cover_data(album_id: {}, ext: '{}')",
        album_id, extension
    );

    let raw_b64 = if let Some(idx) = data_base64.find(',') {
        &data_base64[idx + 1..]
    } else {
        &data_base64
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw_b64)
        .map_err(|e| CommandError::validation(format!("Base64 decode error: {}", e)))?;

    if bytes.len() > 25 * 1024 * 1024 {
        return Err(CommandError::validation(
            "The image file is too large (max. 25 MB)",
        ));
    }

    let clean_ext = match extension.to_lowercase().as_str() {
        "png" => "png",
        "jpg" | "jpeg" => "jpg",
        "webp" => "webp",
        "gif" => "gif",
        _ => "jpg",
    };
    let mime = match clean_ext {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };

    let actual_album_id = if album_id > 0 {
        album_id
    } else if let Some(title) = &album_title {
        let art = artist.as_deref().unwrap_or("Unknown");
        state.db.upsert_album(title, art, None, None, None).await?
    } else {
        return Err(CommandError::validation("Invalid album ID"));
    };

    let saved_path = state
        .cover_archive
        .save_custom_cover_bytes(actual_album_id, &bytes, clean_ext)
        .await?;
    let path_str = saved_path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(actual_album_id, &path_str, None)
        .await?;

    // Link the track to the album
    if let Some(tid) = track_id {
        let _ = state.db.link_track_to_album(tid, actual_album_id).await;
    }

    clear_discord_cover_cache(
        &state,
        Some(actual_album_id),
        artist.as_deref(),
        album_title.as_deref(),
    );

    Ok(format!("data:{};base64,{}", mime, raw_b64))
}

#[tauri::command]
pub async fn get_track_cover(track_path: String) -> Result<Option<String>, CommandError> {
    tokio::task::spawn_blocking(move || -> Result<Option<String>, CommandError> {
        use lofty::file::TaggedFileExt;
        let clean_path = if let Some(stripped) = track_path.strip_prefix("file://") {
            stripped
        } else {
            &track_path
        };
        let path = std::path::Path::new(clean_path);
        if !path.exists() {
            return Ok(None);
        }

        if let Ok(probe) = lofty::probe::Probe::open(path) {
            if let Ok(tagged_file) = probe.read() {
                if let Some(tag) = tagged_file
                    .primary_tag()
                    .or_else(|| tagged_file.first_tag())
                {
                    if let Some(pic) = tag.pictures().first() {
                        let data = pic.data();
                        let mime = match pic.mime_type() {
                            Some(lofty::picture::MimeType::Png) => "image/png",
                            Some(lofty::picture::MimeType::Jpeg) => "image/jpeg",
                            _ => "image/jpeg",
                        };
                        let b64 = base64::engine::general_purpose::STANDARD.encode(data);
                        return Ok(Some(format!("data:{};base64,{}", mime, b64)));
                    }
                }
            }
        }

        if let Some(parent) = path.parent() {
            if let Some(cand_path) = library::find_folder_cover(parent, None) {
                if let Some(data_uri) = resolve_cover_to_data_uri(&cand_path.to_string_lossy()) {
                    return Ok(Some(data_uri));
                }
            }
        }

        Ok(None)
    })
    .await?
}

#[tauri::command]
pub async fn get_lyrics(
    track_path: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    duration_sec: Option<f64>,
    _state: State<'_, AppState>,
) -> Result<Option<LyricsDto>, CommandError> {
    info!("Tauri command: get_lyrics('{}' - '{}')", artist, title);
    let lyrics = metadata::fetch_lyrics_online_or_local(
        track_path.as_deref(),
        &title,
        &artist,
        album.as_deref(),
        duration_sec,
    )
    .await;
    Ok(lyrics)
}

/// Reads a cached cover and returns it as a compact 512px thumbnail `data:` URI,
/// falling back to the raw file if thumbnail decoding fails.
async fn cover_file_thumbnail_uri(path: &std::path::Path) -> Result<String, CommandError> {
    let path_buf = path.to_path_buf();
    let thumb =
        tokio::task::spawn_blocking(move || resolve_cover_thumbnail(&path_buf.to_string_lossy()))
            .await?;
    if let Some(uri) = thumb {
        return Ok(uri);
    }
    let bytes = tokio::fs::read(path).await?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
    Ok(crate::commands::library::image_data_uri(ext, &bytes))
}
