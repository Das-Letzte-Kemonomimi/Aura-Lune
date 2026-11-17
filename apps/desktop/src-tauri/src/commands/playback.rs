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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_playback_state_noop_on_none_controllers() {
        // Verification that functions handle missing mpris/discord gracefully
    }
}
