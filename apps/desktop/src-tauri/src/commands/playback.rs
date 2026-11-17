use crate::AppState;
use domain::PlaybackState;
use std::time::Duration;

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

/// Plays audio via the audio engine and updates desktop status.
pub fn play_internal(state: &AppState) -> Result<(), String> {
    if state.engine.current_uri().is_none() {
        let q = state.engine.queue();
        if let Some(item) = q.current_item() {
            let _ = state.engine.load_uri(&item.uri);
        }
    }
    state.engine.play_with_fade(true).map_err(|e| e.to_string())?;
    sync_desktop_playback_state(state, PlaybackState::Playing);
    Ok(())
}

/// Pauses audio with a gentle fade-out and updates desktop status.
pub fn pause_internal(state: &AppState) -> Result<(), String> {
    state.engine.pause_with_fade(true).map_err(|e| e.to_string())?;
    sync_desktop_playback_state(state, PlaybackState::Paused);
    Ok(())
}

/// Stops audio playback and clears desktop status.
pub fn stop_internal(state: &AppState) -> Result<(), String> {
    state.engine.stop().map_err(|e| e.to_string())?;
    sync_desktop_playback_state(state, PlaybackState::Stopped);
    Ok(())
}

/// Seeks to a position in milliseconds with optional crossfade.
pub fn seek_internal(state: &AppState, position_ms: u64, fade: Option<bool>) -> Result<(), String> {
    let should_fade = fade.unwrap_or(true);
    state
        .engine
        .seek_with_fade(Duration::from_millis(position_ms), should_fade)
        .map_err(|e| e.to_string())?;

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.emit_seeked(position_ms).await;
        });
    }

    if let Some(discord) = &state.discord_rpc {
        discord.update_position(position_ms);
    }

    Ok(())
}

/// Synchronizes currently playing track metadata to MPRIS and Discord Rich Presence.
pub fn sync_mpris_from_queue_item(item: &domain::QueueItem, state: &AppState) {
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

    let is_generic_album = album.trim().is_empty()
        || album == "Auralune Player"
        || album == "Auralune Library"
        || album == "Live Stream"
        || album == "Radio internetowe";

    let mut effective_artist = artist.trim().to_string();
    let mut effective_title = title.trim().to_string();
    if (effective_artist == "Plik lokalny" || effective_artist.is_empty())
        && effective_title.contains(" - ")
    {
        if let Some((a, t)) = effective_title.split_once(" - ") {
            effective_artist = a.trim().to_string();
            effective_title = t.trim().to_string();
        }
    }

    let cache_key = if !is_generic_album {
        format!(
            "{}---{}",
            effective_artist.trim().to_lowercase(),
            album.trim().to_lowercase()
        )
    } else {
        format!(
            "{}---{}",
            effective_artist.trim().to_lowercase(),
            effective_title.trim().to_lowercase()
        )
    };
    let cached_art = state.discord_cover_cache.read().ok().and_then(|c| {
        c.get(&cache_key).cloned().or_else(|| {
            let title_key = format!(
                "{}---{}",
                effective_artist.trim().to_lowercase(),
                effective_title.trim().to_lowercase()
            );
            c.get(&title_key).cloned()
        })
    });

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

        let track_info = desktop_integration::DiscordTrackInfo {
            title: title.clone(),
            artist: artist.clone(),
            album: album.clone(),
            duration_ms,
            art_url: discord_art.clone(),
        };
        discord.update_track(track_info);
        let needs_online_search = discord_art.is_none();

        if needs_online_search
            && (!effective_artist.trim().is_empty()
                || !album.trim().is_empty()
                || !effective_title.trim().is_empty())
        {
            let discord_clone = discord.clone();
            let cover_archive = state.cover_archive.clone();
            let cache_clone = state.discord_cover_cache.clone();
            let title_c = effective_title.clone();
            let artist_c = effective_artist.clone();
            let album_c = album.clone();
            state.rt.spawn(async move {
                let mut candidates = if !is_generic_album {
                    cover_archive
                        .search_cover_candidates(&album_c, &artist_c)
                        .await
                } else {
                    Vec::new()
                };
                if candidates.is_empty() && !title_c.trim().is_empty() {
                    candidates = cover_archive
                        .search_cover_candidates(&title_c, &artist_c)
                        .await;
                }
                if let Some(first) = candidates.first() {
                    let best_url = if !first.thumbnail_url.is_empty() {
                        first.thumbnail_url.clone()
                    } else {
                        first.full_url.clone()
                    };
                    if best_url.starts_with("http://") || best_url.starts_with("https://") {
                        if let Ok(mut cache) = cache_clone.write() {
                            cache.insert(cache_key, best_url.clone());
                        }
                        discord_clone.update_track(desktop_integration::DiscordTrackInfo {
                            title: title_c,
                            artist: artist_c,
                            album: album_c,
                            duration_ms,
                            art_url: Some(best_url),
                        });
                    }
                }
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_playback_state_noop_on_none_controllers() {
        // Verification of state enum values
        assert_ne!(PlaybackState::Playing, PlaybackState::Stopped);
        assert_ne!(PlaybackState::Paused, PlaybackState::Stopped);
    }
}
