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
    if url.is_empty() {
        return None;
    }
    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("data:image/") {
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

fn lookup_discord_cached_art(
    state: &AppState,
    keys: &ParsedMetadataKeys,
    cache_key: &str,
) -> Option<String> {
    state.discord_cover_cache.read().ok().and_then(|cache| {
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
    let cached_art = lookup_discord_cached_art(state, &keys, &keys.cache_key);

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
            );
        }
    }
}

#[tauri::command]
pub fn update_mpris_metadata(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    art_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let normalized_art = normalize_art_url(art_url.as_deref());

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
            _ => lookup_discord_cached_art(&state, &keys, &keys.cache_key),
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
            );
        }
    }

    Ok(())
}

/// Searches for a cover online in the background (by album first when `search_album`, then by title),
/// stores the URL in the Discord cover cache and updates Rich Presence.
pub(super) fn spawn_discord_cover_search(
    state: &AppState,
    discord: &std::sync::Arc<desktop_integration::DiscordRpcController>,
    track: desktop_integration::DiscordTrackInfo,
    search_album: bool,
    cache_key: String,
) {
    let discord = discord.clone();
    let cover_archive = state.cover_archive.clone();
    let cache = state.discord_cover_cache.clone();
    state.rt.spawn(async move {
        let mut candidates = if search_album {
            cover_archive
                .search_cover_candidates(&track.album, &track.artist)
                .await
        } else {
            Vec::new()
        };
        if candidates.is_empty() && !track.title.trim().is_empty() {
            candidates = cover_archive
                .search_cover_candidates(&track.title, &track.artist)
                .await;
        }
        let Some(first) = candidates.first() else {
            return;
        };
        let best_url = if first.thumbnail_url.is_empty() {
            first.full_url.clone()
        } else {
            first.thumbnail_url.clone()
        };
        if !(best_url.starts_with("http://") || best_url.starts_with("https://")) {
            return;
        }
        if let Ok(mut c) = cache.write() {
            c.insert(cache_key, best_url.clone());
        }
        discord.update_track(desktop_integration::DiscordTrackInfo {
            art_url: Some(best_url),
            ..track
        });
    });
}
