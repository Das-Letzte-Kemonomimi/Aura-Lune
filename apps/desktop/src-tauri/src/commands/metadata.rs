//! Komendy pobierania i edycji metadanych, okładek płyt, tekstów utworów (LRC) oraz fingerprintingu audio.

use crate::commands::library::resolve_cover_to_data_uri;
use crate::AppState;
use base64::Engine;
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
) -> Result<Vec<TrackFingerprintMatchDto>, String> {
    let client = AcoustidClient::new(client_key);
    let path_buf = PathBuf::from(path);
    if !path_buf.exists() {
        return Err("Plik audio nie istnieje na dysku".to_string());
    }

    let (duration, fingerprint) = AcoustidClient::generate_fingerprint(&path_buf)
        .await
        .map_err(|e| e.to_string())?;

    client
        .lookup(duration, &fingerprint)
        .await
        .map_err(|e| e.to_string())
}

/// Searches for album cover candidates using Cover Art Archive and MusicBrainz.
pub async fn search_cover_candidates_internal(
    state: &AppState,
    album: &str,
    artist: &str,
) -> Vec<CoverCandidateDto> {
    info!(
        "Tauri command: search_cover_candidates('{}', '{}')",
        album, artist
    );
    state
        .cover_archive
        .search_cover_candidates(album, artist)
        .await
}

/// Helper function to update discord rpc and cover cache when a cover is applied.
pub fn sync_cover_to_discord_cache(
    state: &AppState,
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
            cache.insert(cache_key, cover_url_or_data.to_string());
        }
        if let Some(discord) = &state.discord_rpc {
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
                artist: art.to_string(),
                album: alb.to_string(),
                duration_ms: dur,
                art_url: Some(cover_url_or_data.to_string()),
            });
            discord.update_playback_status(state.engine.state(), pos, dur);
        }
    }
}

/// Downloads and applies album cover from a URL.
pub async fn apply_cover_url_internal(
    state: &AppState,
    album_id: i64,
    cover_url: &str,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
) -> Result<String, String> {
    info!(
        "Tauri command: apply_cover_url(album_id: {}, url: '{}')",
        album_id, cover_url
    );

    let actual_album_id = if album_id > 0 {
        album_id
    } else if let Some(title) = &album_title {
        let art = artist.as_deref().unwrap_or("Unknown");
        state
            .db
            .upsert_album(title, art, None, None)
            .await
            .map_err(|e| e.to_string())?
    } else {
        return Err("Nieprawidłowe ID albumu".to_string());
    };

    let path = state
        .cover_archive
        .download_cover_from_url(cover_url, &format!("album_{}", actual_album_id))
        .await
        .map_err(|e| e.to_string())?;
    let path_str = path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(actual_album_id, &path_str, None)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(tid) = track_id {
        let _ = state.db.link_track_to_album(tid, actual_album_id).await;
    }
    if let Some(title) = &album_title {
        let _ = state
            .db
            .link_tracks_by_album_title(title, actual_album_id)
            .await;
    }

    sync_cover_to_discord_cache(state, artist.as_deref(), album_title.as_deref(), cover_url);

    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

/// Applies a local file as an album cover.
pub async fn apply_custom_cover_file_internal(
    state: &AppState,
    album_id: i64,
    file_path: &str,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
) -> Result<String, String> {
    info!(
        "Tauri command: apply_custom_cover_file(album_id: {}, path: '{}')",
        album_id, file_path
    );
    let path = Path::new(file_path);
    if !path.exists() {
        return Err("Wskazany plik nie istnieje".to_string());
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
            return Err(
                "Obsługiwane są wyłącznie pliki graficzne PNG, JPG, WebP lub GIF".to_string(),
            )
        }
    };

    let bytes = std::fs::read(path).map_err(|e| format!("Błąd odczytu pliku: {}", e))?;
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("Plik graficzny jest zbyt duży (maks. 25 MB)".to_string());
    }

    let actual_album_id = if album_id > 0 {
        album_id
    } else if let Some(title) = &album_title {
        let art = artist.as_deref().unwrap_or("Unknown");
        state
            .db
            .upsert_album(title, art, None, None)
            .await
            .map_err(|e| e.to_string())?
    } else {
        return Err("Nieprawidłowe ID albumu".to_string());
    };

    let saved_path = state
        .cover_archive
        .save_custom_cover_file(actual_album_id, path)
        .await
        .map_err(|e| e.to_string())?;
    let path_str = saved_path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(actual_album_id, &path_str, None)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(tid) = track_id {
        let _ = state.db.link_track_to_album(tid, actual_album_id).await;
    }
    if let Some(title) = &album_title {
        let _ = state
            .db
            .link_tracks_by_album_title(title, actual_album_id)
            .await;
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Validates ListenBrainz user token.
pub async fn validate_listenbrainz_token_internal(
    state: &AppState,
    token: &str,
) -> Result<String, String> {
    info!("Tauri command: validate_listenbrainz_token");
    state.listenbrainz.validate_token(token).await
}

/// Submits currently playing track to ListenBrainz.
pub async fn submit_listenbrainz_playing_now_internal(
    state: &AppState,
    token: &str,
    artist: &str,
    title: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> Result<(), String> {
    state
        .listenbrainz
        .submit_playing_now(token, artist, title, album, duration_ms)
        .await
}

/// Submits completed listen to ListenBrainz.
pub async fn submit_listenbrainz_listen_internal(
    state: &AppState,
    token: &str,
    artist: &str,
    title: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    state
        .listenbrainz
        .submit_listen(token, artist, title, album, now, duration_ms)
        .await
}

/// Generates Last.fm authentication URL and token.
pub async fn lastfm_get_auth_url_internal(
    state: &AppState,
    api_key: Option<String>,
) -> Result<LastFmAuthUrlResult, String> {
    info!("Tauri command: lastfm_get_auth_url");
    let key = api_key
        .as_deref()
        .unwrap_or(metadata::DEFAULT_LASTFM_API_KEY);
    let token = state.lastfm.get_auth_token(Some(key)).await?;
    let auth_url = format!(
        "https://www.last.fm/api/auth/?api_key={}&token={}",
        key, token
    );
    Ok(LastFmAuthUrlResult { token, auth_url })
}

/// Fetches Last.fm web session from approved token.
pub async fn lastfm_fetch_session_internal(
    state: &AppState,
    token: &str,
    api_key: Option<&str>,
    api_secret: Option<&str>,
) -> Result<LastFmSession, String> {
    info!("Tauri command: lastfm_fetch_session");
    state.lastfm.fetch_session(token, api_key, api_secret).await
}

/// Validates existing Last.fm session key.
pub async fn lastfm_validate_session_internal(
    state: &AppState,
    session_key: &str,
    api_key: Option<&str>,
    api_secret: Option<&str>,
) -> Result<String, String> {
    info!("Tauri command: lastfm_validate_session");
    state
        .lastfm
        .validate_session(session_key, api_key, api_secret)
        .await
}

/// Updates Last.fm Now Playing status.
pub async fn lastfm_update_now_playing_internal(
    state: &AppState,
    request: &LastFmScrobbleRequest,
) -> Result<(), String> {
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
}

/// Submits Last.fm scrobble upon track playback completion.
pub async fn lastfm_scrobble_internal(
    state: &AppState,
    request: &LastFmScrobbleRequest,
) -> Result<(), String> {
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
}

// ==========================================
// TAURI COMMANDS
// ==========================================

#[tauri::command]
pub fn save_lyrics_lrc(track_path: String, lrc_content: String) -> Result<String, String> {
    metadata::save_lrc_file(&track_path, &lrc_content)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_track_metadata(path: String) -> Result<audio_engine::TrackMetadataFullDto, String> {
    audio_engine::read_track_metadata(&path)
}

#[tauri::command]
pub async fn update_track_metadata(
    track_id: i64,
    path: String,
    meta: audio_engine::TrackMetadataFullDto,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Zapis do pliku fizycznego audio przez lofty
    audio_engine::write_track_metadata(&path, &meta)?;

    // 2. Aktualizacja w bazie SQLite
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
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn is_fpcalc_available() -> Result<bool, String> {
    Ok(AcoustidClient::is_fpcalc_available().await)
}

#[tauri::command]
pub async fn identify_track_fingerprint(
    path: String,
    client_key: Option<String>,
) -> Result<Vec<TrackFingerprintMatchDto>, String> {
    identify_track_fingerprint_internal(&path, client_key).await
}

#[tauri::command]
pub async fn search_musicbrainz_releases(
    album: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Vec<ReleaseCandidateDto>, String> {
    info!(
        "Tauri command: search_musicbrainz_releases('{}', '{}')",
        album, artist
    );
    state
        .mb
        .search_releases(&album, &artist)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_and_apply_cover(
    album_id: i64,
    mbid: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: fetch_and_apply_cover(album_id: {}, mbid: '{}')",
        album_id, mbid
    );
    let path = state
        .cover_archive
        .fetch_and_cache_cover(&mbid)
        .await
        .map_err(|e| e.to_string())?;
    let path_str = path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(album_id, &path_str, Some(&mbid))
        .await
        .map_err(|e| e.to_string())?;

    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
pub async fn auto_fetch_album_cover(
    album_id: i64,
    album_title: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    info!(
        "Tauri command: auto_fetch_album_cover('{}', '{}')",
        album_title, artist
    );
    let candidates = state
        .mb
        .search_releases(&album_title, &artist)
        .await
        .map_err(|e| e.to_string())?;
    if candidates.is_empty() {
        return Ok(None);
    }

    let best = &candidates[0];
    if best.score >= 85 {
        match state.cover_archive.fetch_and_cache_cover(&best.mbid).await {
            Ok(path) => {
                let path_str = path.to_string_lossy().to_string();
                state
                    .db
                    .update_album_cover(album_id, &path_str, Some(&best.mbid))
                    .await
                    .map_err(|e| e.to_string())?;

                let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                return Ok(Some(format!("data:image/jpeg;base64,{}", b64)));
            }
            Err(e) => {
                tracing::warn!("Nie udało się pobrać okładki dla MBID {}: {}", best.mbid, e);
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn search_cover_candidates(
    album: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Vec<CoverCandidateDto>, String> {
    Ok(search_cover_candidates_internal(&state, &album, &artist).await)
}

#[tauri::command]
pub async fn apply_cover_url(
    album_id: i64,
    cover_url: String,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<String, String> {
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
) -> Result<String, String> {
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
) -> Result<String, String> {
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
        .map_err(|e| format!("Błąd dekodowania Base64: {}", e))?;

    if bytes.len() > 25 * 1024 * 1024 {
        return Err("Plik graficzny jest zbyt duży (maks. 25 MB)".to_string());
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
        state
            .db
            .upsert_album(title, art, None, None)
            .await
            .map_err(|e| e.to_string())?
    } else {
        return Err("Nieprawidłowe ID albumu".to_string());
    };

    let saved_path = state
        .cover_archive
        .save_custom_cover_bytes(actual_album_id, &bytes, clean_ext)
        .await
        .map_err(|e| e.to_string())?;
    let path_str = saved_path.to_string_lossy().to_string();

    state
        .db
        .update_album_cover(actual_album_id, &path_str, None)
        .await
        .map_err(|e| e.to_string())?;

    // Linkowanie utworu z albumem
    if let Some(tid) = track_id {
        let _ = state.db.link_track_to_album(tid, actual_album_id).await;
    }
    if let Some(title) = &album_title {
        let _ = state
            .db
            .link_tracks_by_album_title(title, actual_album_id)
            .await;
    }

    if let Some(art) = &artist {
        if let Some(alb) = &album_title {
            let cache_key = format!(
                "{}---{}",
                art.trim().to_lowercase(),
                alb.trim().to_lowercase()
            );
            if let Ok(mut cache) = state.discord_cover_cache.write() {
                cache.remove(&cache_key);
            }
            if let Some(discord) = &state.discord_rpc {
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
                    artist: art.clone(),
                    album: alb.clone(),
                    duration_ms: dur,
                    art_url: None,
                });
                discord.update_playback_status(state.engine.state(), pos, dur);
            }
        }
    }

    Ok(format!("data:{};base64,{}", mime, raw_b64))
}

#[tauri::command]
pub fn get_track_cover(track_path: String) -> Result<Option<String>, String> {
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
        for cand in &[
            "cover.jpg",
            "cover.png",
            "folder.jpg",
            "folder.png",
            "front.jpg",
            "front.png",
            "Cover.jpg",
            "Folder.jpg",
        ] {
            let cand_path = parent.join(cand);
            if cand_path.is_file() {
                if let Some(data_uri) = resolve_cover_to_data_uri(&cand_path.to_string_lossy()) {
                    return Ok(Some(data_uri));
                }
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn get_lyrics(
    track_path: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    duration_sec: Option<f64>,
    _state: State<'_, AppState>,
) -> Result<Option<LyricsDto>, String> {
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
