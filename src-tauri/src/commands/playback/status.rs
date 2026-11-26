use super::desktop_sync::spawn_discord_cover_search;
use super::PlaybackStatusDto;
use crate::AppState;
use audio_engine::PlayerEvent;
use domain::queue::QueueItem;
use domain::PlaybackState;
use std::time::Duration;
use tracing::{error, info};

/// Whether the current source is a live stream (internet radio).
pub(super) fn is_live_stream(state: &AppState, current_track: Option<&QueueItem>) -> bool {
    if let Some(item) = current_track {
        item.id.starts_with("radio-")
            || (item.track_id.is_none()
                && (item.uri.starts_with("http://") || item.uri.starts_with("https://")))
    } else if let Some(uri) = state.engine.current_uri() {
        uri.starts_with("http://") || uri.starts_with("https://")
    } else {
        false
    }
}

/// One playback ticker tick: the **only** place that drains the engine bus
/// (`poll_events`: EOS → next track, loop, tags, spectrum), detects position jumps back
/// and writes the Waybar status. Called only by `setup::playback_ticker`; commands
/// read [`snapshot_status`] or the buffered `AppState.last_status`.
pub fn tick_status(state: &AppState, errors: &mut Vec<String>) -> PlaybackStatusDto {
    let current_track = state.engine.queue().current_item().cloned();
    let live_stream = is_live_stream(state, current_track.as_ref());

    for event in state.engine.poll_events() {
        match event {
            PlayerEvent::Spectrum(mags) => {
                if let Ok(mut s) = state.latest_spectrum.lock() {
                    *s = mags;
                }
            }
            PlayerEvent::TrackLooped => {
                info!("get_status: received PlayerEvent::TrackLooped (track looped / Repeat)");
                if let Some(discord) = &state.discord_rpc {
                    discord.track_looped();
                }
                if let Some(mpris) = &state.mpris {
                    let m = mpris.clone();
                    state.rt.spawn(async move {
                        m.emit_seeked(0).await;
                    });
                }
            }
            PlayerEvent::Tag(tag) => {
                handle_stream_tag(state, current_track.as_ref(), live_stream, tag);
            }
            PlayerEvent::Error(message) => {
                error!("Playback error: {message}");
                errors.push(message);
            }
            _ => {}
        }
    }

    let pos_ms = state
        .engine
        .position()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let dur_ms = state.engine.duration().map(|d| d.as_millis() as u64);

    let prev_pos = state
        .last_reported_pos_ms
        .swap(pos_ms, std::sync::atomic::Ordering::Relaxed);
    if state.engine.state() == PlaybackState::Playing {
        let is_loop_restart = prev_pos > 3000 && pos_ms < 2500;
        let is_major_rewind = prev_pos > pos_ms + 4000;
        if is_loop_restart || is_major_rewind {
            info!(
                "Detected a position jump back/loop from {prev_pos} ms to {pos_ms} ms, syncing Discord RPC and MPRIS"
            );
            if let Some(discord) = &state.discord_rpc {
                discord.update_playback_status(PlaybackState::Playing, pos_ms, dur_ms.unwrap_or(0));
            }
            if let Some(mpris) = &state.mpris {
                let m = mpris.clone();
                state.rt.spawn(async move {
                    m.emit_seeked(pos_ms).await;
                });
            }
        }
    }

    maybe_write_waybar(state, current_track.as_ref(), pos_ms, dur_ms);
    snapshot_status(state)
}

fn handle_stream_tag(
    state: &AppState,
    current_track: Option<&QueueItem>,
    live_stream: bool,
    tag: String,
) {
    if !live_stream {
        if let Ok(mut t) = state.latest_live_stream_tag.lock() {
            *t = None;
        }
        return;
    }

    info!("Received a tag from the live stream: {tag}");
    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
        *t = Some(tag.clone());
    }

    let (parsed_artist, parsed_title) = if let Some((a, t)) = tag.split_once(" - ") {
        (a.trim().to_string(), t.trim().to_string())
    } else {
        let station = current_track
            .map(|i| i.title.clone())
            .unwrap_or_else(|| "Internet Radio".to_string());
        (station, tag.trim().to_string())
    };

    let station_album = current_track
        .map(|i| i.title.clone())
        .unwrap_or_else(|| "Internet Radio".to_string());

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        let t_c = parsed_title.clone();
        let a_c = parsed_artist.clone();
        let al_c = station_album.clone();
        state.rt.spawn(async move {
            m.update_track(desktop_integration::MprisTrackInfo {
                title: t_c,
                artist: a_c,
                album: al_c,
                duration_ms: 0,
                art_url: None,
            })
            .await;
        });
    }

    if let Some(discord) = &state.discord_rpc {
        let cache_key = format!(
            "{}---{}",
            parsed_artist.trim().to_lowercase(),
            parsed_title.trim().to_lowercase()
        );
        let cached_art = state
            .discord_cover_cache
            .read()
            .ok()
            .and_then(|c| c.get(&cache_key).cloned());

        discord.update_track(desktop_integration::DiscordTrackInfo {
            title: parsed_title.clone(),
            artist: parsed_artist.clone(),
            album: station_album.clone(),
            duration_ms: 0,
            art_url: cached_art.clone(),
        });

        if cached_art.is_none()
            && !parsed_artist.trim().is_empty()
            && !parsed_title.trim().is_empty()
        {
            spawn_discord_cover_search(
                state,
                discord,
                desktop_integration::DiscordTrackInfo {
                    title: parsed_title,
                    artist: parsed_artist,
                    album: station_album,
                    duration_ms: 0,
                    art_url: None,
                },
                false,
                cache_key,
            );
        }
    }
}

fn maybe_write_waybar(
    state: &AppState,
    current_track: Option<&QueueItem>,
    pos_ms: u64,
    dur_ms: Option<u64>,
) {
    let should_update = state
        .last_waybar_write
        .lock()
        .map(|mut last_t| {
            if last_t.elapsed() >= Duration::from_millis(500) {
                *last_t = std::time::Instant::now();
                true
            } else {
                false
            }
        })
        .unwrap_or(false);

    if !should_update {
        return;
    }

    let (title, artist, album) = if let Some(item) = current_track {
        (
            item.title.clone(),
            if item.artist.is_empty() {
                "Unknown Artist".to_string()
            } else {
                item.artist.clone()
            },
            item.album.clone().unwrap_or_default(),
        )
    } else {
        (
            "No Track".to_string(),
            "Auralune".to_string(),
            String::new(),
        )
    };

    let current_state = state.engine.state();
    let (state_str, class_str) = match current_state {
        PlaybackState::Playing => ("Playing", "playing"),
        PlaybackState::Paused => ("Paused", "paused"),
        PlaybackState::Stopped => ("Stopped", "stopped"),
    };

    let percentage = dur_ms
        .filter(|&d| d > 0)
        .map(|d| ((pos_ms as f64 / d as f64) * 100.0).clamp(0.0, 100.0) as u8)
        .unwrap_or(0);

    let vol_pct = (state.engine.volume() * 100.0).clamp(0.0, 100.0) as u8;
    let text = if current_state == PlaybackState::Stopped || title == "No Track" {
        "Auralune: Stopped".to_string()
    } else {
        format!("{artist} - {title}")
    };
    let tooltip = format!("{title}\n{artist}\n{album}\nStatus: {state_str} | Vol: {vol_pct}%");

    let waybar = desktop_integration::WaybarStatus {
        text,
        alt: class_str.to_string(),
        tooltip,
        class: class_str.to_string(),
        percentage,
        volume: vol_pct,
        art_url: None,
        title,
        artist,
        album,
        state: state_str.to_string(),
        position_ms: pos_ms,
        duration_ms: dur_ms.unwrap_or(0),
    };

    let _ = desktop_integration::write_waybar_status(&waybar);
}

/// Current playback status without side effects on the engine bus (does not call
/// `poll_events` or write Waybar), safe to call from commands.
pub fn snapshot_status(state: &AppState) -> PlaybackStatusDto {
    let q = state.engine.queue();
    let current_track = q.current_item().cloned();
    let live_stream = is_live_stream(state, current_track.as_ref());
    let pos_ms = state
        .engine
        .position()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let dur_ms = state.engine.duration().map(|d| d.as_millis() as u64);
    let dsp = state.engine.dsp_params();
    let capabilities = state.engine.dsp_capabilities();

    let spectrum = state
        .latest_spectrum
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let live_stream_title = if live_stream {
        state
            .latest_live_stream_tag
            .lock()
            .ok()
            .and_then(|t| t.clone())
    } else {
        if let Ok(mut t) = state.latest_live_stream_tag.lock() {
            if t.is_some() {
                *t = None;
            }
        }
        None
    };

    PlaybackStatusDto {
        state: state.engine.state(),
        position_ms: pos_ms,
        duration_ms: dur_ms,
        volume: state.engine.volume(),
        pitch_semitones: dsp.pitch_semitones,
        tempo_ratio: dsp.tempo_ratio,
        rate_ratio: dsp.rate_ratio,
        engine: dsp.engine,
        capabilities,
        loop_mode: q.loop_mode,
        shuffle: q.shuffle,
        stop_after_current: state.engine.stop_after_current(),
        current_track,
        equalizer_enabled: state.engine.is_equalizer_enabled(),
        equalizer_bands: state.engine.get_equalizer_bands(),
        parametric_eq_enabled: state.engine.is_parametric_eq_enabled(),
        compressor_enabled: state.engine.is_compressor_enabled(),
        saturator_enabled: state.engine.is_saturator_enabled(),
        limiter_enabled: state.engine.is_limiter_enabled(),
        spectrum,
        replaygain_config: state.engine.replaygain_config(),
        replaygain_status: state.engine.replaygain_status(),
        live_stream_title,
        is_stems_active: state.engine.is_stems_active(),
        active_stem_project_id: state.engine.active_stem_project_id(),
    }
}
