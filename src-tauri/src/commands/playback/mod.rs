mod desktop_sync;
mod status;

pub use desktop_sync::*;
pub use status::*;

use super::error::CommandError;
use crate::commands::queue::persist_queue_state;
use crate::AppState;
use domain::queue::{LoopMode, QueueItem};
use domain::replaygain::ReplayGainConfig;
use domain::PlaybackState;
use dsp_api::{DspCapabilities, DspEngine};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, State};
use tracing::info;

const MPRIS_VOLUME_INTERVAL: Duration = Duration::from_millis(100);

/// Coalesces rapid volume changes (slider drags) to at most 10 Hz for MPRIS `PropertiesChanged`.
#[derive(Default)]
pub struct MprisVolumeCoalescer {
    pending_bits: AtomicU64,
    scheduled: AtomicBool,
    last_sent: Mutex<Option<Instant>>,
}

impl MprisVolumeCoalescer {
    pub fn schedule_update(
        self: &Arc<Self>,
        mpris: &Arc<desktop_integration::MprisController>,
        rt: &tokio::runtime::Runtime,
        volume: f64,
    ) {
        self.pending_bits.store(volume.to_bits(), Ordering::SeqCst);
        if self
            .scheduled
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }
        let this = Arc::clone(self);
        let m = mpris.clone();
        rt.spawn(async move {
            loop {
                let wait = {
                    let guard = this
                        .last_sent
                        .lock()
                        .unwrap_or_else(std::sync::PoisonError::into_inner);
                    guard
                        .map(|t| MPRIS_VOLUME_INTERVAL.saturating_sub(t.elapsed()))
                        .unwrap_or(Duration::ZERO)
                };
                if !wait.is_zero() {
                    tokio::time::sleep(wait).await;
                }
                this.scheduled.store(false, Ordering::SeqCst);
                let vol = f64::from_bits(this.pending_bits.load(Ordering::SeqCst));
                {
                    let mut guard = this
                        .last_sent
                        .lock()
                        .unwrap_or_else(std::sync::PoisonError::into_inner);
                    *guard = Some(Instant::now());
                }
                m.update_volume(vol).await;
                if !this.scheduled.load(Ordering::SeqCst) {
                    break;
                }
            }
        });
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlaybackStatusDto {
    pub state: PlaybackState,
    pub position_ms: u64,
    pub duration_ms: Option<u64>,
    pub volume: f64,
    pub pitch_semitones: f64,
    pub tempo_ratio: f64,
    pub rate_ratio: f64,
    pub engine: DspEngine,
    pub capabilities: DspCapabilities,
    pub loop_mode: LoopMode,
    pub shuffle: bool,
    pub stop_after_current: bool,
    pub current_track: Option<QueueItem>,
    pub equalizer_enabled: bool,
    pub equalizer_bands: [f64; 10],
    pub parametric_eq_enabled: bool,
    pub compressor_enabled: bool,
    pub saturator_enabled: bool,
    pub limiter_enabled: bool,
    /// A sample above 0 dBFS was seen since the last `reset_clip_indicator`.
    pub clip_detected: bool,
    pub spectrum: Vec<f32>,
    pub replaygain_config: ReplayGainConfig,
    pub replaygain_status: (f64, f64, bool),
    pub live_stream_title: Option<String>,
    pub is_stems_active: bool,
    pub active_stem_project_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SampleTrackDto {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: u64,
    pub genre: Option<String>,
}

pub fn resolve_or_extract_sample_track(data_dir: &Path) -> Option<SampleTrackDto> {
    let candidates = [
        data_dir.join("sample").join("Skrzydła Białe.flac"),
        PathBuf::from("tests/fixtures/Skrzydła Białe.flac"),
        PathBuf::from("/usr/share/auralune/Skrzydła Białe.flac"),
    ];

    for candidate in &candidates {
        if candidate.exists() && candidate.is_file() {
            let path_str = candidate
                .canonicalize()
                .unwrap_or_else(|_| candidate.clone())
                .to_string_lossy()
                .to_string();
            return Some(SampleTrackDto {
                path: path_str,
                title: "Skrzydła Białe".to_string(),
                artist: "Das Letzte Kemonomimi".to_string(),
                album: Some("Skrzydła Białe".to_string()),
                duration_ms: 56820,
                genre: Some("Folk-Rock".to_string()),
            });
        }
    }

    static EMBEDDED_SAMPLE: &[u8] = include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../tests/fixtures/Skrzydła Białe.flac"
    ));
    let target_path = data_dir.join("sample").join("Skrzydła Białe.flac");
    if let Some(parent) = target_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if std::fs::write(&target_path, EMBEDDED_SAMPLE).is_ok() {
        let path_str = target_path
            .canonicalize()
            .unwrap_or_else(|_| target_path.clone())
            .to_string_lossy()
            .to_string();
        Some(SampleTrackDto {
            path: path_str,
            title: "Skrzydła Białe".to_string(),
            artist: "Das Letzte Kemonomimi".to_string(),
            album: Some("Skrzydła Białe".to_string()),
            duration_ms: 56820,
            genre: Some("Folk-Rock".to_string()),
        })
    } else {
        None
    }
}

pub fn normalize_path_or_url(input: &str, cwd: Option<&str>) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.starts_with("file://") {
        if let Ok(parsed) = url::Url::parse(trimmed) {
            if let Ok(path) = parsed.to_file_path() {
                if path.exists() {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
        let stripped = trimmed.trim_start_matches("file://");
        let p = Path::new(stripped);
        if p.exists() {
            return Some(p.to_string_lossy().to_string());
        }
    } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Some(trimmed.to_string());
    }

    let p = Path::new(trimmed);
    if p.is_file() {
        if let Ok(canonical) = p.canonicalize() {
            return Some(canonical.to_string_lossy().to_string());
        }
        return Some(trimmed.to_string());
    }

    if let Some(c) = cwd {
        let joined = Path::new(c).join(trimmed);
        if joined.is_file() {
            if let Ok(canonical) = joined.canonicalize() {
                return Some(canonical.to_string_lossy().to_string());
            }
            return Some(joined.to_string_lossy().to_string());
        }
    }

    None
}

pub fn is_supported_audio(path: &str) -> bool {
    let p = Path::new(path);
    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
        matches!(
            ext.to_ascii_lowercase().as_str(),
            "mp3"
                | "flac"
                | "ogg"
                | "opus"
                | "wav"
                | "wave"
                | "m4a"
                | "aac"
                | "alac"
                | "aiff"
                | "aif"
                | "wma"
                | "m3u"
                | "m3u8"
                | "cue"
        )
    } else {
        false
    }
}

pub fn extract_audio_paths_from_args(args: &[String], cwd: Option<&str>) -> Vec<String> {
    let mut results = Vec::new();
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        if let Some(valid_path) = normalize_path_or_url(arg, cwd) {
            if is_supported_audio(&valid_path)
                || valid_path.starts_with("http://")
                || valid_path.starts_with("https://")
            {
                results.push(valid_path);
            }
        }
    }
    results
}

pub async fn resolve_queue_item(path: &str, state: &AppState) -> QueueItem {
    let mut track_opt = state
        .db
        .find_track_by_path_or_uri(path)
        .await
        .ok()
        .flatten();
    if track_opt.is_none() {
        if let Ok(canonical) = Path::new(path).canonicalize() {
            let canon_str = canonical.to_string_lossy().to_string();
            track_opt = state
                .db
                .find_track_by_path_or_uri(&canon_str)
                .await
                .ok()
                .flatten();
        }
    }

    if let Some(tr) = track_opt {
        return state.db.queue_item_for_track(&tr).await;
    }

    let fallback_stem = Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown Track".to_string());

    // Reading tags (lofty) is blocking I/O, so off the Tokio threads.
    let owned_path = path.to_string();
    let tags = tokio::task::spawn_blocking(move || audio_engine::read_track_metadata(&owned_path))
        .await
        .ok()
        .and_then(Result::ok);

    let (title, artist, album, duration_ms) = if let Some(m) = tags {
        let t = if !m.title.trim().is_empty() {
            m.title
        } else if let Some((_, parsed_title)) = fallback_stem.split_once(" - ") {
            parsed_title.trim().to_string()
        } else {
            fallback_stem.clone()
        };

        let a = if !m.artist.trim().is_empty() {
            m.artist
        } else if let Some((parsed_artist, _)) = fallback_stem.split_once(" - ") {
            parsed_artist.trim().to_string()
        } else {
            "Local File".to_string()
        };

        (t, a, m.album, 0)
    } else if let Some((a, t)) = fallback_stem.split_once(" - ") {
        (t.trim().to_string(), a.trim().to_string(), None, 0)
    } else {
        (fallback_stem, "Local File".to_string(), None, 0)
    };

    QueueItem {
        id: crate::commands::queue::new_queue_item_id("file"),
        track_id: None,
        uri: path.to_string(),
        title,
        artist,
        album,
        duration_ms,
    }
}

pub async fn enqueue_and_play_files(
    files: Vec<String>,
    state: &AppState,
    app_handle: &tauri::AppHandle,
) {
    if files.is_empty() {
        return;
    }

    info!("Processing and playing external files: {files:?}");

    let playback_mode = state
        .db
        .get_app_setting("album_playback_mode")
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| "replace".to_string());

    let mut new_items = Vec::new();
    for f in &files {
        new_items.push(resolve_queue_item(f, state).await);
    }

    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
        *t = None;
    }

    if playback_mode == "append" {
        let state_bg = state.clone();
        tokio::task::spawn_blocking(move || {
            let mut items = state_bg.engine.with_queue(|q| q.items.clone());
            let start_index = items.len();
            items.extend(new_items);
            let _ = state_bg.engine.set_queue(items, Some(start_index));
            let _ = state_bg.engine.play_with_fade(true);
        })
        .await
        .map_err(|e| tracing::warn!("enqueue_and_play_files failed: {}", e))
        .ok();
    } else {
        let first_item = new_items.first().cloned();
        let state_bg = state.clone();
        let played = tokio::task::spawn_blocking(move || {
            let _ = state_bg.engine.set_queue(new_items, Some(0));
            if let Some(ref first) = first_item {
                state_bg.engine.set_active_item(first.clone());
            }
            let _ = state_bg.engine.play_with_fade(true);
            first_item
        })
        .await
        .ok()
        .flatten();
        if let Some(first) = played {
            sync_mpris_from_queue_item(&first, state);
        }
    }

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }

    persist_queue_state(state);
    let _ = app_handle.emit("queue_changed", ());
}

/// Plays audio via the audio engine and updates desktop status.
pub fn play_internal(state: &AppState) -> Result<(), CommandError> {
    if state.engine.current_uri().is_none() {
        if let Some(item) = state.engine.current_item() {
            let _ = state.engine.load_uri(&item.uri);
        }
    }
    state.engine.play_with_fade(true)?;
    sync_desktop_playback_state(state, PlaybackState::Playing);
    Ok(())
}

/// Pauses audio with a gentle fade-out and updates desktop status.
pub fn pause_internal(state: &AppState) -> Result<(), CommandError> {
    state.engine.pause_with_fade(true)?;
    sync_desktop_playback_state(state, PlaybackState::Paused);
    Ok(())
}

/// Stops audio playback and clears desktop status.
pub fn stop_internal(state: &AppState) -> Result<(), CommandError> {
    state.engine.stop()?;
    sync_desktop_playback_state(state, PlaybackState::Stopped);
    Ok(())
}

/// Seeks to a position in milliseconds with optional crossfade.
pub fn seek_internal(
    state: &AppState,
    position_ms: u64,
    fade: Option<bool>,
) -> Result<(), CommandError> {
    let should_fade = fade.unwrap_or(true);
    state
        .engine
        .seek_with_fade(Duration::from_millis(position_ms), should_fade)?;

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

#[tauri::command]
pub async fn load_file(path: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    info!("Tauri command: load_file('{path}')");
    let state_bg = state.inner().clone();
    let path_bg = path.clone();
    tokio::task::spawn_blocking(move || state_bg.engine.load_uri(&path_bg)).await??;

    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
        *t = None;
    }

    let queue_item = resolve_queue_item(&path, &state).await;

    state.engine.set_active_item(queue_item.clone());
    sync_mpris_from_queue_item(&queue_item, &state);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub async fn play(state: State<'_, AppState>) -> Result<(), CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> { play_internal(&state) })
        .await?
}

#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> Result<(), CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> { pause_internal(&state) })
        .await?
}

#[tauri::command]
pub async fn stop(state: State<'_, AppState>) -> Result<(), CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> { stop_internal(&state) })
        .await?
}

#[tauri::command]
pub async fn seek(
    position_ms: u64,
    fade: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        seek_internal(&state, position_ms, fade)
    })
    .await?
}

#[tauri::command]
pub fn set_volume(
    volume: f64,
    smooth: Option<bool>,
    fade_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let is_smooth = smooth.unwrap_or(false);
    if is_smooth {
        let duration = Duration::from_millis(fade_ms.unwrap_or(90));
        state.engine.set_volume_smooth(volume, duration)?;
    } else {
        state.engine.set_volume(volume)?;
    }
    if let Some(mpris) = &state.mpris {
        state.mpris_volume.schedule_update(mpris, &state.rt, volume);
    }
    Ok(())
}

/// Enables or disables GStreamer spectrum bus messages based on mounted UI consumers.
#[tauri::command]
pub fn set_spectrum_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), CommandError> {
    state.engine.set_spectrum_enabled(enabled);
    Ok(())
}

/// Returns the last status computed by the playback ticker (a cheap snapshot copy).
/// Before the first ticker tick, a snapshot is returned without draining the bus.
#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> PlaybackStatusDto {
    if let Some(cached) = state.last_status.read().ok().and_then(|s| s.clone()) {
        return (*cached).clone();
    }
    snapshot_status(&state)
}

#[tauri::command]
pub fn get_default_music_dir() -> Result<String, CommandError> {
    if let Ok(home) = std::env::var("HOME") {
        let music = Path::new(&home).join("Music");
        if music.exists() {
            return Ok(music.to_string_lossy().to_string());
        }
        let downloads = Path::new(&home).join("Downloads");
        if downloads.exists() {
            return Ok(downloads.to_string_lossy().to_string());
        }
        return Ok(home);
    }
    Ok("/tmp".to_string())
}

#[tauri::command]
pub async fn get_sample_track(
    app: tauri::AppHandle,
) -> Result<Option<SampleTrackDto>, CommandError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    Ok(tokio::task::spawn_blocking(move || resolve_or_extract_sample_track(&data_dir)).await?)
}
