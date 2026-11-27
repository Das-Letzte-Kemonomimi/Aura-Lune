use super::super::error::CommandError;
use crate::AppState;
use domain::queue::QueueItem;
use domain::PlaybackState;
use tauri::State;

/// Synchronizes playback state changes to desktop integrations (MPRIS D-Bus and Discord RPC).
pub fn sync_desktop_playback_state(state: &AppState, new_state: PlaybackState) {
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(new_state).await;
        });
    }

    let Some(discord) = &state.discord_rpc else {
        return;
    };

    if new_state == PlaybackState::Stopped {
        discord.clear_activity();
        return;
    }

    let pos = state
        .engine
        .position()
        .map(|p| p.as_millis() as u64)
        .unwrap_or(0);
    let dur = state
        .engine
        .duration()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    discord.update_playback_status(new_state, pos, dur);
}

pub fn normalize_art_url(art_url: Option<&str>) -> Option<String> {
    let url = art_url?.trim();
    if url.is_empty() || url.starts_with("data:") {
        return None;
    }
    if url.starts_with("http://") || url.starts_with("https://") {
        return Some(url.to_string());
    }
    // The local cover goes to the desktop shell (MPRIS): existing image files only.
    let path = super::super::paths::ensure_readable(
        &audio_engine::uri::local_path(url),
        super::super::paths::IMAGE_EXTENSIONS,
    )
    .ok()?;
    Some(audio_engine::uri::media_uri(&path.to_string_lossy()))
}

/// Resolves `auralune-media://localhost/cover/...` (at `768` px thumbnail resolution) or HTTP(S)/local paths
/// to an MPRIS-compatible URI (`file://` or `http(s)://`), dropping `data:` URIs.
pub async fn resolve_art_url_for_mpris(state: &AppState, art_url: Option<&str>) -> Option<String> {
    let url = art_url?.trim();
    if url.is_empty() || url.starts_with("data:") {
        return None;
    }
    if url.starts_with("auralune-media://") {
        let route = crate::media_protocol::parse_media_route(url)?;
        let path = crate::media_protocol::resolve_cover_thumbnail_path(
            state,
            &route,
            Some(crate::media_protocol::LARGE_COVER_SIZE),
        )
        .await?;
        return Some(audio_engine::uri::media_uri(&path.to_string_lossy()));
    }
    normalize_art_url(Some(url))
}

struct ParsedMetadataKeys {
    effective_artist: String,
    effective_title: String,
    is_generic_album: bool,
    cache_key: String,
}

fn parse_discord_metadata_keys(title: &str, artist: &str, album: &str) -> ParsedMetadataKeys {
    let is_generic_album = album.trim().is_empty()
        || album == "Auralune Player"
        || album == "Auralune Library"
        || album == "Live Stream"
        || album == "Internet Radio"
        || album == "Radio internetowe"; // Polish name in queues saved by older versions

    let mut effective_artist = artist.trim().to_string();
    let mut effective_title = title.trim().to_string();
    if (matches!(effective_artist.as_str(), "Local File" | "Plik lokalny")
        || effective_artist.is_empty())
        && effective_title.contains(" - ")
    {
        if let Some((a, t)) = effective_title.split_once(" - ") {
            effective_artist = a.trim().to_string();
            effective_title = t.trim().to_string();
        }
    }

    let title_key = format!(
        "{}---{}",
        effective_artist.trim().to_lowercase(),
        effective_title.trim().to_lowercase()
    );
    let cache_key = if !is_generic_album {
        format!(
            "{}---{}",
            effective_artist.trim().to_lowercase(),
            album.trim().to_lowercase()
        )
    } else {
        title_key
    };

    ParsedMetadataKeys {
        effective_artist,
        effective_title,
        is_generic_album,
        cache_key,
    }
}

fn album_cache_key(album_id: Option<i64>) -> Option<String> {
    album_id
        .filter(|&id| id > 0)
        .map(|id| format!("album:{id}"))
}

fn lookup_discord_cached_art(
    state: &AppState,
    keys: &ParsedMetadataKeys,
    album_id: Option<i64>,
    cache_key: &str,
) -> Option<String> {
    state.discord_cover_cache.read().ok().and_then(|cache| {
        if let Some(akey) = album_cache_key(album_id) {
            if let Some(hit) = cache.get(&akey) {
                return Some(hit.clone());
            }
            // When album_id is known, never fall back to a generic title-only cache entry across
            // unrelated homonymous albums if the album itself had not been cached under album_id.
            return cache.get(cache_key).cloned();
        }
        cache.get(cache_key).cloned().or_else(|| {
            let title_key = format!(
                "{}---{}",
                keys.effective_artist.trim().to_lowercase(),
                keys.effective_title.trim().to_lowercase()
            );
            cache.get(&title_key).cloned()
        })
    })
}

/// Synchronizes currently playing track metadata to MPRIS and Discord Rich Presence.
pub fn sync_mpris_from_queue_item(item: &QueueItem, state: &AppState) {
    let title = item.title.clone();
    let artist = item.artist.clone();
    let album = item.album.clone().unwrap_or_default();
    let duration_ms = if item.duration_ms > 0 {
        item.duration_ms
    } else {
        state
            .engine
            .duration()
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    };

    let keys = parse_discord_metadata_keys(&title, &artist, &album);
    let cached_art = lookup_discord_cached_art(state, &keys, None, &keys.cache_key);

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        let track_info = desktop_integration::MprisTrackInfo {
            title: title.clone(),
            artist: artist.clone(),
            album: album.clone(),
            duration_ms,
            art_url: cached_art.clone(),
        };
        state.rt.spawn(async move {
            m.update_track(track_info).await;
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }

    if let Some(discord) = &state.discord_rpc {
        let discord_art = cached_art
            .as_ref()
            .filter(|u| u.starts_with("http://") || u.starts_with("https://"))
            .cloned();

        discord.update_track(desktop_integration::DiscordTrackInfo {
            title,
            artist,
            album: album.clone(),
            duration_ms,
            art_url: discord_art.clone(),
        });

        if discord_art.is_none()
            && (!keys.effective_artist.trim().is_empty()
                || !album.trim().is_empty()
                || !keys.effective_title.trim().is_empty())
        {
            spawn_discord_cover_search(
                state,
                discord,
                desktop_integration::DiscordTrackInfo {
                    title: keys.effective_title,
                    artist: keys.effective_artist,
                    album,
                    duration_ms,
                    art_url: None,
                },
                !keys.is_generic_album,
                keys.cache_key,
                item.track_id,
            );
        }
    }
}

#[tauri::command]
pub async fn update_mpris_metadata(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    art_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let normalized_art = resolve_art_url_for_mpris(&state, art_url.as_deref()).await;

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        let t_clone = title.clone();
        let a_clone = artist.clone();
        let al_clone = album.clone();
        let art_clone = normalized_art.clone();
        state.rt.spawn(async move {
            m.update_track(desktop_integration::MprisTrackInfo {
                title: t_clone,
                artist: a_clone,
                album: al_clone,
                duration_ms,
                art_url: art_clone,
            })
            .await;
        });
    }

    if let Some(discord) = &state.discord_rpc {
        let keys = parse_discord_metadata_keys(&title, &artist, &album);

        let effective_discord_art = match &normalized_art {
            Some(art) if art.starts_with("http://") || art.starts_with("https://") => {
                if let Ok(mut cache) = state.discord_cover_cache.write() {
                    if !keys.cache_key.is_empty() {
                        cache.insert(keys.cache_key.clone(), art.clone());
                    }
                }
                Some(art.clone())
            }
            _ => lookup_discord_cached_art(&state, &keys, None, &keys.cache_key),
        };

        discord.update_track(desktop_integration::DiscordTrackInfo {
            title,
            artist,
            album: album.clone(),
            duration_ms,
            art_url: effective_discord_art.clone(),
        });

        let cur_state = state.engine.state();
        let effective_state = if cur_state == PlaybackState::Stopped {
            PlaybackState::Playing
        } else {
            cur_state
        };
        let pos = state
            .engine
            .position()
            .map(|p| p.as_millis() as u64)
            .unwrap_or(0);
        let dur = if duration_ms > 0 {
            duration_ms
        } else {
            state
                .engine
                .duration()
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
        };
        discord.update_playback_status(effective_state, pos, dur);

        let current_track_id = state
            .engine
            .queue()
            .current_item()
            .filter(|i| i.title.trim() == keys.effective_title.trim())
            .and_then(|i| i.track_id);

        if effective_discord_art.is_none()
            && (!keys.effective_artist.trim().is_empty()
                || !album.trim().is_empty()
                || !keys.effective_title.trim().is_empty())
        {
            spawn_discord_cover_search(
                &state,
                discord,
                desktop_integration::DiscordTrackInfo {
                    title: keys.effective_title,
                    artist: keys.effective_artist,
                    album,
                    duration_ms,
                    art_url: None,
                },
                !keys.is_generic_album,
                keys.cache_key,
                current_track_id,
            );
        }
    }

    Ok(())
}

/// How long a failed cover lookup is not repeated (the same album on every track change).
const COVER_MISS_TTL: std::time::Duration = std::time::Duration::from_secs(600);

fn cover_misses() -> &'static std::sync::Mutex<std::collections::HashMap<String, std::time::Instant>>
{
    static MISSES: std::sync::OnceLock<
        std::sync::Mutex<std::collections::HashMap<String, std::time::Instant>>,
    > = std::sync::OnceLock::new();
    MISSES.get_or_init(Default::default)
}

fn cover_recently_missed(cache_key: &str) -> bool {
    let Ok(mut misses) = cover_misses().lock() else {
        return false;
    };
    match misses.get(cache_key) {
        Some(at) if at.elapsed() < COVER_MISS_TTL => true,
        Some(_) => {
            misses.remove(cache_key);
            false
        }
        None => false,
    }
}

fn remember_cover_miss(cache_key: String) {
    if let Ok(mut misses) = cover_misses().lock() {
        misses.insert(cache_key, std::time::Instant::now());
    }
}

/// What to search for, taken from the library when the track is in it: the album title and
/// album artist from the database are cleaner than the queue item's track artist, and a
/// MusicBrainz release id from the file tags identifies the cover exactly.
struct CoverLookup {
    album_id: Option<i64>,
    album: String,
    artist: String,
    release_mbid: Option<String>,
    context: metadata::AlbumLookupContext,
}

async fn resolve_cover_lookup(
    db: &storage::Database,
    track: &desktop_integration::DiscordTrackInfo,
    search_album: bool,
    track_id: Option<i64>,
) -> CoverLookup {
    let mut lookup = CoverLookup {
        album_id: None,
        album: if search_album {
            track.album.clone()
        } else {
            String::new()
        },
        artist: track.artist.clone(),
        release_mbid: None,
        context: metadata::AlbumLookupContext::default(),
    };
    if !search_album {
        return lookup;
    }
    let Some(track_id) = track_id else {
        return lookup;
    };
    let album_id = match db.get_track_by_id(track_id).await {
        Ok(Some(record)) => record.album_id,
        _ => None,
    };
    let Some(album_id) = album_id else {
        return lookup;
    };
    let Ok(Some(ctx)) = db.get_album_cover_context(album_id).await else {
        return lookup;
    };
    let album = ctx.album;
    lookup.album_id = Some(album.id);
    if !metadata::cover_query::is_unknown_album(&album.title) {
        lookup.album = album.title;
    }
    if !metadata::cover_query::is_neutral_artist(&album.album_artist) {
        lookup.artist = album.album_artist;
    }
    lookup.release_mbid = album.release_mbid.filter(|m| !m.trim().is_empty());
    lookup.context = metadata::AlbumLookupContext {
        year: album.year,
        track_count: Some(ctx.track_count),
        sample_tracks: ctx.sample_tracks,
        release_mbid: lookup.release_mbid.clone(),
    };
    lookup
}

/// Searches for a cover online in the background and updates Rich Presence.
///
/// Order: album-id cache / stored release MBID -> context-aware best match -> exact song lookup.
pub(super) fn spawn_discord_cover_search(
    state: &AppState,
    discord: &std::sync::Arc<desktop_integration::DiscordRpcController>,
    track: desktop_integration::DiscordTrackInfo,
    search_album: bool,
    cache_key: String,
    track_id: Option<i64>,
) {
    if cover_recently_missed(&cache_key) {
        return;
    }
    let discord = discord.clone();
    let cover_archive = state.cover_archive.clone();
    let mb = state.mb.clone();
    let db = state.db.clone();
    let cache = state.discord_cover_cache.clone();
    state.rt.spawn(async move {
        let lookup = resolve_cover_lookup(&db, &track, search_album, track_id).await;
        if let Some(akey) = album_cache_key(lookup.album_id) {
            if let Ok(c) = cache.read() {
                if let Some(cached) = c.get(&akey) {
                    discord.update_track(desktop_integration::DiscordTrackInfo {
                        art_url: Some(cached.clone()),
                        ..track
                    });
                    return;
                }
            }
        }

        let mut found = match &lookup.release_mbid {
            Some(mbid) => cover_archive.release_front_url(mbid).await,
            None => None,
        };
        if found.is_none() {
            found = cover_archive
                .find_best_cover_for_album(
                    &lookup.album,
                    &lookup.artist,
                    Some(&track.title),
                    &lookup.context,
                    Some(&mb),
                )
                .await
                .map(|c| {
                    if c.thumbnail_url.is_empty() {
                        c.full_url
                    } else {
                        c.thumbnail_url
                    }
                });
        }

        let best_url = found.filter(|u| u.starts_with("http://") || u.starts_with("https://"));
        let Some(best_url) = best_url else {
            remember_cover_miss(cache_key);
            return;
        };
        if let Ok(mut c) = cache.write() {
            if let Some(akey) = album_cache_key(lookup.album_id) {
                c.insert(akey, best_url.clone());
            } else {
                c.insert(cache_key, best_url.clone());
            }
        }
        discord.update_track(desktop_integration::DiscordTrackInfo {
            art_url: Some(best_url),
            ..track
        });
    });
}
