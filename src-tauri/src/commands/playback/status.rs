use super::desktop_sync::spawn_discord_cover_search;
use super::PlaybackStatusDto;
use crate::AppState;
use audio_engine::{EngineStatusSnapshot, PlayerEvent};
use domain::queue::QueueItem;
use domain::PlaybackState;
use std::time::Duration;
use tracing::{error, info};

/// Whether the current source is a live stream (internet radio).
pub(super) fn is_live_stream(current_track: Option<&QueueItem>, current_uri: Option<&str>) -> bool {
    if let Some(item) = current_track {
        item.id.starts_with("radio-")
            || (item.track_id.is_none()
                && (item.uri.starts_with("http://") || item.uri.starts_with("https://")))
    } else if let Some(uri) = current_uri {
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
    let mut latest_spectrum_event: Option<Vec<f32>> = None;
    let mut pending_tags: Vec<String> = Vec::new();

    for event in state.engine.poll_events() {
        match event {
            PlayerEvent::Spectrum(mags) => {
                latest_spectrum_event = Some(mags);
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
                pending_tags.push(tag);
            }
            PlayerEvent::Error(message) => {
                error!("Playback error: {message}");
                errors.push(message);
            }
            _ => {}
        }
    }

    let snap = state.engine.status_snapshot();
    let live_stream = is_live_stream(snap.current_item.as_ref(), snap.current_uri.as_deref());

    if snap.state != PlaybackState::Playing {
        if let Ok(mut s) = state.latest_spectrum.lock() {
            if !s.is_empty() {
                s.clear();
            }
        }
    } else if let Some(mags) = latest_spectrum_event {
        if let Ok(mut s) = state.latest_spectrum.lock() {
            *s = mags;
        }
    }

    for tag in pending_tags {
        handle_stream_tag(state, snap.current_item.as_ref(), live_stream, tag);
    }

    let pos_ms = snap.position.map(|d| d.as_millis() as u64).unwrap_or(0);
    let dur_ms = snap.duration.map(|d| d.as_millis() as u64);

    let prev_pos = state
        .last_reported_pos_ms
        .swap(pos_ms, std::sync::atomic::Ordering::Relaxed);
    if snap.state == PlaybackState::Playing {
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

    maybe_write_waybar(state, &snap, pos_ms, dur_ms);
    build_status_dto(state, snap, live_stream)
}

fn handle_stream_tag(
    state: &AppState,
    current_track: Option<&QueueItem>,
    live_stream: bool,
    tag: String,
) {
    if !live_stream {
        if let Ok(mut t) = state.latest_live_stream_tag.lock() {
            if t.is_some() {
                *t = None;
            }
        }
        return;
    }

    let unchanged = state
        .latest_live_stream_tag
        .lock()
        .map(|mut t| {
            if t.as_deref() == Some(tag.as_str()) {
                true
            } else {
                *t = Some(tag.clone());
                false
            }
        })
        .unwrap_or(false);
    if unchanged {
        return;
    }

    info!("Received a tag from the live stream: {tag}");

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
                None,
            );
        }
    }
}

fn maybe_write_waybar(
    state: &AppState,
    snap: &EngineStatusSnapshot,
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

    let (title, artist, album) = if let Some(item) = snap.current_item.as_ref() {
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

    let current_state = snap.state;
    let (state_str, class_str) = match current_state {
        PlaybackState::Playing => ("Playing", "playing"),
        PlaybackState::Paused => ("Paused", "paused"),
        PlaybackState::Stopped => ("Stopped", "stopped"),
    };

    let percentage = dur_ms
        .filter(|&d| d > 0)
        .map(|d| ((pos_ms as f64 / d as f64) * 100.0).clamp(0.0, 100.0) as u8)
        .unwrap_or(0);

    let vol_pct = (snap.volume * 100.0).clamp(0.0, 100.0) as u8;
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
        position_ms: (pos_ms / 1000) * 1000,
        duration_ms: dur_ms.unwrap_or(0),
    };

    let _ = desktop_integration::write_waybar_status(&waybar);
}

/// Current playback status without side effects on the engine bus (does not call
/// `poll_events` or write Waybar), safe to call from commands.
pub fn snapshot_status(state: &AppState) -> PlaybackStatusDto {
    let snap = state.engine.status_snapshot();
    let live_stream = is_live_stream(snap.current_item.as_ref(), snap.current_uri.as_deref());
    build_status_dto(state, snap, live_stream)
}

fn build_status_dto(
    state: &AppState,
    snap: EngineStatusSnapshot,
    live_stream: bool,
) -> PlaybackStatusDto {
    let pos_ms = snap.position.map(|d| d.as_millis() as u64).unwrap_or(0);
    let dur_ms = snap.duration.map(|d| d.as_millis() as u64);

    let spectrum = if snap.state == PlaybackState::Playing {
        state
            .latest_spectrum
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default()
    } else {
        Vec::new()
    };
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
        state: snap.state,
        position_ms: pos_ms,
        duration_ms: dur_ms,
        volume: snap.volume,
        pitch_semitones: snap.dsp_params.pitch_semitones,
        tempo_ratio: snap.dsp_params.tempo_ratio,
        rate_ratio: snap.dsp_params.rate_ratio,
        engine: snap.dsp_params.engine,
        capabilities: snap.capabilities,
        loop_mode: snap.loop_mode,
        shuffle: snap.shuffle,
        stop_after_current: snap.stop_after_current,
        current_track: snap.current_item,
        equalizer_enabled: snap.equalizer_enabled,
        equalizer_bands: snap.equalizer_bands,
        parametric_eq_enabled: snap.parametric_eq_enabled,
        compressor_enabled: snap.compressor_enabled,
        saturator_enabled: snap.saturator_enabled,
        limiter_enabled: snap.limiter_enabled,
        clip_detected: snap.clip_detected,
        spectrum,
        replaygain_config: snap.replaygain_config,
        replaygain_status: snap.replaygain_status,
        live_stream_title,
        is_stems_active: snap.is_stems_active,
        active_stem_project_id: snap.active_stem_project_id,
    }
}
