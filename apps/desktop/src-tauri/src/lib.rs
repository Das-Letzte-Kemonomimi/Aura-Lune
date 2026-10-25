//! Backend desktopowy Auralune (Tauri 2).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Wątek audio i surowe próbki PCM są całkowicie odizolowane od WebView i bazy danych.
//! Komendy Tauri służą wyłącznie do sterowania odtwarzaczem, odpytywania stanu i indeksowania.

use audio_engine::{
    analyze_track_replaygain, write_replaygain_tags_to_file, AudioEngine, DeviceManager,
    PlayerEvent, ReplayGainAnalysisResult, TrackKeyBpm, Transcoder,
};
use domain::crossfeed::CrossfeedConfig;
use domain::device::{AudioCard, BluetoothCodec};
use domain::equalizer::EqualizerPreset;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::renamer::{
    format_pattern_for_track, resolve_renamed_path, RenamePreviewItem, RenamerTrackInfo,
};
use domain::replaygain::ReplayGainConfig;
use domain::silence::SilenceTrimmingConfig;
use domain::transcode::{DspExportSettings, ExportFormat, TimeRange};
use domain::{
    ImportM3uResult, M3uEntry, M3uPlaylist, PlaybackState, Playlist, Theme, TrackBookmark,
};
use downloads::{DownloadJob, DownloadManager};
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use library::LibraryScanner;
use metadata::{
    CoverArtArchiveClient, CoverCandidateDto, LastFmClient, LastFmSession, ListenBrainzClient,
    MusicBrainzClient, ReleaseCandidateDto,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use storage::{AlbumRecord, ArtistRecord, Database, DspPresetRecord, DuplicateGroup, TrackRecord};
use tauri::{Manager, State};
use tracing::{error, info};

pub struct AppState {
    pub engine: Arc<AudioEngine>,
    pub db: Arc<Database>,
    pub scanner: Arc<LibraryScanner>,
    pub rt: Arc<tokio::runtime::Runtime>,
    pub mpris: Option<Arc<desktop_integration::MprisController>>,
    pub discord_rpc: Option<Arc<desktop_integration::DiscordRpcController>>,
    pub mb: Arc<MusicBrainzClient>,

    pub cover_archive: Arc<CoverArtArchiveClient>,
    pub listenbrainz: Arc<ListenBrainzClient>,
    pub lastfm: Arc<LastFmClient>,
    pub downloads: Arc<DownloadManager>,
    pub latest_spectrum: Arc<Mutex<Vec<f32>>>,
    pub discord_cover_cache: Arc<std::sync::RwLock<std::collections::HashMap<String, String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub current_track: Option<QueueItem>,
    pub equalizer_enabled: bool,
    pub equalizer_bands: [f64; 10],
    pub spectrum: Vec<f32>,
    pub replaygain_config: ReplayGainConfig,
    pub replaygain_status: (f64, f64, bool),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummaryDto {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayGainScanSummaryDto {
    pub total_tracks: usize,
    pub scanned: usize,
    pub errors: usize,
}

#[tauri::command]
fn load_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: load_file('{}')", path);
    state.engine.load_uri(&path).map_err(|e| e.to_string())?;

    let db = state.db.clone();
    let path_clone = path.clone();
    let track_opt = state
        .rt
        .block_on(async move { db.get_track_by_path(&path_clone).await.ok().flatten() });

    let queue_item = if let Some(t) = track_opt {
        QueueItem {
            id: format!("track-{}", t.id),
            track_id: Some(t.id),
            uri: t.path.clone(),
            title: t.title.clone(),
            artist: t.artist.clone(),
            album: t.album_artist.clone(),
            duration_ms: t.duration_ms as u64,
        }
    } else {
        let title = std::path::Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&path)
            .to_string();
        QueueItem {
            id: format!(
                "file-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ),
            track_id: None,
            uri: path.clone(),
            title,
            artist: "Plik lokalny".to_string(),
            album: None,
            duration_ms: 0,
        }
    };

    state.engine.set_active_item(queue_item.clone());
    sync_mpris_from_queue_item(&queue_item, &state);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn play(state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .play_with_fade(true)
        .map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }
    if let Some(discord) = &state.discord_rpc {
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
        discord.update_playback_status(PlaybackState::Playing, pos, dur);
    }
    Ok(())
}

#[tauri::command]
fn pause(state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .pause_with_fade(true)
        .map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Paused).await;
        });
    }
    if let Some(discord) = &state.discord_rpc {
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
        discord.update_playback_status(PlaybackState::Paused, pos, dur);
    }
    Ok(())
}

#[tauri::command]
fn stop(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.stop().map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Stopped).await;
        });
    }
    if let Some(discord) = &state.discord_rpc {
        discord.clear_activity();
    }
    Ok(())
}

#[tauri::command]
fn seek(position_ms: u64, fade: Option<bool>, state: State<'_, AppState>) -> Result<(), String> {
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

#[tauri::command]
fn set_pitch(semitones: f64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .set_pitch_semitones(semitones)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_tempo(
    tempo_ratio: Option<f64>,
    ratio: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let r = tempo_ratio.or(ratio).unwrap_or(1.0);
    state.engine.set_tempo_ratio(r).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_tempo_ratio(
    tempo_ratio: Option<f64>,
    ratio: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let r = tempo_ratio.or(ratio).unwrap_or(1.0);
    state.engine.set_tempo_ratio(r).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_pitch_semitones(semitones: f64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .set_pitch_semitones(semitones)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_rate(
    rate_ratio: Option<f64>,
    rate: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let r = rate_ratio.or(rate).unwrap_or(1.0);
    state.engine.set_rate_ratio(r).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_rate_ratio(
    rate_ratio: Option<f64>,
    rate: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let r = rate_ratio.or(rate).unwrap_or(1.0);
    state.engine.set_rate_ratio(r).map_err(|e| e.to_string())
}

#[tauri::command]
fn reset_dsp(state: State<'_, AppState>) -> Result<PlaybackStatusDto, String> {
    let current = state.engine.dsp_params();
    let reset_params = DspParams::new(current.engine, 0.0, 1.0, 1.0).map_err(|e| e.to_string())?;
    state
        .engine
        .set_dsp_params(reset_params)
        .map_err(|e| e.to_string())?;
    Ok(get_status(state))
}

#[tauri::command]
fn set_reverb_params(
    enabled: bool,
    room_size: Option<f64>,
    damping: Option<f64>,
    width: Option<f64>,
    level: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let r_size = room_size.unwrap_or(0.5);
    let damp = damping.unwrap_or(0.2);
    let w = width.unwrap_or(1.0);
    let lev = level.unwrap_or(0.4);
    state
        .engine
        .set_reverb_params(enabled, r_size, damp, w, lev);
    Ok(())
}

#[tauri::command]
fn set_stereo_widener(
    active: bool,
    amount: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: set_stereo_widener(active: {}, amount: {:?})",
        active, amount
    );
    state.engine.set_stereo_widener_active(active);
    if let Some(amt) = amount {
        state.engine.set_stereo_widener_amount(amt);
    }
    Ok(())
}

#[tauri::command]
fn get_stereo_widener(state: State<'_, AppState>) -> Result<(bool, f64), String> {
    Ok(state.engine.stereo_widener_params())
}

#[tauri::command]
fn set_limiter_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_limiter_enabled({})", enabled);
    state.engine.set_limiter_enabled(enabled);
    Ok(())
}

#[tauri::command]
fn is_limiter_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.engine.is_limiter_enabled())
}

#[tauri::command]
fn set_crossfade_duration(duration_ms: u64, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_crossfade_duration({} ms)", duration_ms);
    state.engine.set_crossfade_duration_ms(duration_ms);
    Ok(())
}

#[tauri::command]
fn get_crossfade_duration(state: State<'_, AppState>) -> Result<u64, String> {
    Ok(state.engine.crossfade_duration_ms())
}

#[tauri::command]
fn get_default_music_dir() -> Result<String, String> {
    if let Ok(home) = std::env::var("HOME") {
        let music = std::path::Path::new(&home).join("Music");
        if music.exists() {
            return Ok(music.to_string_lossy().to_string());
        }
        let downloads = std::path::Path::new(&home).join("Downloads");
        if downloads.exists() {
            return Ok(downloads.to_string_lossy().to_string());
        }
        return Ok(home);
    }
    Ok("/tmp".to_string())
}

#[tauri::command]
fn set_dsp_engine(
    engine: DspEngine,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, String> {
    info!("Tauri command: set_dsp_engine({:?})", engine);
    state
        .engine
        .set_dsp_engine(engine)
        .map_err(|e| e.to_string())?;
    Ok(get_status(state))
}

#[tauri::command]
fn get_dsp_capabilities(state: State<'_, AppState>) -> DspCapabilities {
    state.engine.dsp_capabilities()
}

#[tauri::command]
fn save_dsp_preset(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    let dsp = state.engine.dsp_params();
    let db = state.db.clone();
    let engine_str = match dsp.engine {
        DspEngine::Bypass => "Bypass",
        DspEngine::SoundTouch => "SoundTouch",
        DspEngine::RubberBand => "RubberBand",
    };

    state
        .rt
        .block_on(async move {
            db.save_dsp_preset(
                &name,
                engine_str,
                dsp.pitch_semitones,
                dsp.tempo_ratio,
                dsp.rate_ratio,
            )
            .await
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dsp_presets(state: State<'_, AppState>) -> Result<Vec<DspPresetRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_dsp_presets().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_dsp_preset(
    preset: DspPresetRecord,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, String> {
    let engine = if preset.engine.eq_ignore_ascii_case("Bypass") {
        DspEngine::Bypass
    } else if preset.engine.eq_ignore_ascii_case("RubberBand") {
        DspEngine::RubberBand
    } else {
        DspEngine::SoundTouch
    };

    let params = DspParams::new(
        engine,
        preset.pitch_semitones,
        preset.tempo_ratio,
        preset.rate_ratio,
    )
    .map_err(|e| e.to_string())?;

    state
        .engine
        .set_dsp_params(params)
        .map_err(|e| e.to_string())?;
    Ok(get_status(state))
}

#[tauri::command]
fn set_volume(volume: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.set_volume(volume).map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_volume(volume).await;
        });
    }
    Ok(())
}

fn normalize_art_url(art_url: Option<&str>) -> Option<String> {
    let url = art_url?.trim();
    if url.is_empty() {
        return None;
    }
    if url.starts_with("http://")
        || url.starts_with("https://")
        || url.starts_with("data:image/")
        || url.starts_with("file://")
    {
        return Some(url.to_string());
    }
    let path = std::path::Path::new(url);
    if path.exists() && path.is_file() {
        return Some(format!("file://{}", path.to_string_lossy()));
    }
    None
}

#[tauri::command]
fn update_mpris_metadata(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    art_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
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
        let cache_key = format!(
            "{}---{}",
            artist.trim().to_lowercase(),
            album.trim().to_lowercase()
        );

        // Do Discord RPC przekazujemy wyłącznie publiczne adresy HTTPS/HTTP.
        // Lokalny plik (file://) ani base64 nie są dostępne w internecie i psują widok na profilu Discorda.
        let effective_discord_art = if let Some(art) = &normalized_art {
            if art.starts_with("http://") || art.starts_with("https://") {
                if let Ok(mut cache) = state.discord_cover_cache.write() {
                    if !cache_key.is_empty() {
                        cache.insert(cache_key.clone(), art.clone());
                    }
                }
                Some(art.clone())
            } else {
                state
                    .discord_cover_cache
                    .read()
                    .ok()
                    .and_then(|cache| cache.get(&cache_key).cloned())
            }
        } else {
            state
                .discord_cover_cache
                .read()
                .ok()
                .and_then(|cache| cache.get(&cache_key).cloned())
        };

        discord.update_track(desktop_integration::DiscordTrackInfo {
            title: title.clone(),
            artist: artist.clone(),
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

        // Jeśli brak adresu HTTPS w pamięci podręcznej i metadane nie są puste,
        // pobierz w tle okładkę z Deezer/iTunes/MusicBrainz i uaktualnij Discorda
        let needs_online_search = effective_discord_art.is_none();

        if needs_online_search
            && (!artist.trim().is_empty() || !album.trim().is_empty() || !title.trim().is_empty())
        {
            let discord_clone = discord.clone();
            let cover_archive = state.cover_archive.clone();
            let cache_clone = state.discord_cover_cache.clone();
            let title_c = title.clone();
            let artist_c = artist.clone();
            let album_c = album.clone();
            state.rt.spawn(async move {
                let mut candidates = cover_archive
                    .search_cover_candidates(&album_c, &artist_c)
                    .await;
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
    Ok(())
}

#[tauri::command]
fn get_status(state: State<'_, AppState>) -> PlaybackStatusDto {
    let events = state.engine.poll_events();
    for event in events {
        if let PlayerEvent::Spectrum(mags) = event {
            if let Ok(mut s) = state.latest_spectrum.lock() {
                *s = mags;
            }
        }
    }
    let pos_ms = state
        .engine
        .position()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let dur_ms = state.engine.duration().map(|d| d.as_millis() as u64);
    let dsp = state.engine.dsp_params();
    let capabilities = state.engine.dsp_capabilities();

    let q = state.engine.queue();
    let current_track = q.current_item().cloned();
    let spectrum = state
        .latest_spectrum
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();

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
        current_track,
        equalizer_enabled: state.engine.is_equalizer_enabled(),
        equalizer_bands: state.engine.get_equalizer_bands(),
        spectrum,
        replaygain_config: state.engine.replaygain_config(),
        replaygain_status: state.engine.replaygain_status(),
    }
}

#[tauri::command]
fn set_equalizer_band(band: usize, gain_db: f64, state: State<'_, AppState>) -> Result<(), String> {
    info!(
        "Tauri command: set_equalizer_band({}, {} dB)",
        band, gain_db
    );
    state
        .engine
        .set_equalizer_band(band, gain_db)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_equalizer_bands(bands: [f64; 10], state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_equalizer_bands({:?})", bands);
    state
        .engine
        .set_equalizer_bands(&bands)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_equalizer_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_equalizer_enabled({})", enabled);
    state.engine.set_equalizer_enabled(enabled);
    Ok(())
}

#[tauri::command]
fn get_equalizer_presets() -> Vec<EqualizerPreset> {
    EqualizerPreset::default_presets()
}

#[tauri::command]
fn get_replaygain_config(state: State<'_, AppState>) -> ReplayGainConfig {
    state.engine.replaygain_config()
}

#[tauri::command]
fn set_replaygain_config(
    config: ReplayGainConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Tauri command: set_replaygain_config({:?})", config);
    state
        .engine
        .set_replaygain(config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn apply_auto_replaygain(is_same_album: bool, is_shuffle: bool, state: State<'_, AppState>) {
    state
        .engine
        .apply_auto_replaygain(is_same_album, is_shuffle);
}

#[tauri::command]
fn get_crossfeed_config(state: State<'_, AppState>) -> CrossfeedConfig {
    state.engine.crossfeed_config()
}

#[tauri::command]
fn set_crossfeed_config(config: CrossfeedConfig, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_crossfeed_config({:?})", config);
    state
        .engine
        .set_crossfeed(config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_silence_trimming_config(state: State<'_, AppState>) -> SilenceTrimmingConfig {
    state.engine.silence_trimming_config()
}

#[tauri::command]
fn set_silence_trimming_config(
    config: SilenceTrimmingConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Tauri command: set_silence_trimming_config({:?})", config);
    state
        .engine
        .set_silence_trimming(config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_replaygain_status(state: State<'_, AppState>) -> (f64, f64, bool) {
    state.engine.replaygain_status()
}

#[tauri::command]
fn scan_track_replaygain(
    track_id: i64,
    write_tags: bool,
    state: State<'_, AppState>,
) -> Result<ReplayGainAnalysisResult, String> {
    info!(
        "Tauri command: scan_track_replaygain(track_id={}, write_tags={})",
        track_id, write_tags
    );
    let db = state.db.clone();
    let track = state
        .rt
        .block_on(async move { db.get_track_by_id(track_id).await })
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Nie znaleziono utworu o ID {}", track_id))?;

    let result = analyze_track_replaygain(&track.path)?;

    // Zapis do bazy danych SQLite
    let db_update = state.db.clone();
    let gain = result.track_gain_db;
    let peak = result.track_peak;
    state
        .rt
        .block_on(async move {
            db_update
                .update_track_replaygain(track_id, gain, peak)
                .await
        })
        .map_err(|e| e.to_string())?;

    // Opcjonalny zapis tagów do pliku
    if write_tags {
        if let Err(e) = write_replaygain_tags_to_file(&track.path, gain, peak) {
            tracing::warn!(
                "Nie udało się zapisać tagów ReplayGain do {}: {}",
                track.path,
                e
            );
        }
    }

    Ok(result)
}

#[tauri::command]
fn scan_library_replaygain(
    write_tags: bool,
    state: State<'_, AppState>,
) -> Result<ReplayGainScanSummaryDto, String> {
    info!(
        "Tauri command: scan_library_replaygain(write_tags={})",
        write_tags
    );
    let db = state.db.clone();
    let tracks = state
        .rt
        .block_on(async move { db.list_tracks().await })
        .map_err(|e| e.to_string())?;

    let total_tracks = tracks.len();
    let mut scanned = 0;
    let mut errors = 0;

    for track in tracks {
        match analyze_track_replaygain(&track.path) {
            Ok(res) => {
                let db_inner = state.db.clone();
                let tid = track.id;
                let g = res.track_gain_db;
                let p = res.track_peak;
                let _ = state
                    .rt
                    .block_on(async move { db_inner.update_track_replaygain(tid, g, p).await });
                if write_tags {
                    let _ = write_replaygain_tags_to_file(&track.path, g, p);
                }
                scanned += 1;
            }
            Err(err) => {
                tracing::warn!("Błąd analizy ReplayGain dla {}: {}", track.path, err);
                errors += 1;
            }
        }
    }

    Ok(ReplayGainScanSummaryDto {
        total_tracks,
        scanned,
        errors,
    })
}

#[tauri::command]
fn list_devices() -> Result<Vec<AudioCard>, String> {
    DeviceManager::list_cards().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_device_profile(card_name: String, profile_name: String) -> Result<(), String> {
    DeviceManager::set_card_profile(&card_name, &profile_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_bluetooth_codec(card_name: String, codec: BluetoothCodec) -> Result<(), String> {
    DeviceManager::set_bluetooth_codec(&card_name, &codec).map_err(|e| e.to_string())
}

#[tauri::command]
fn enable_pro_audio(card_name: String) -> Result<(), String> {
    DeviceManager::enable_pro_audio(&card_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn disable_pro_audio(card_name: String) -> Result<String, String> {
    DeviceManager::disable_pro_audio(&card_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_card_profile(card_name: String, profile: String) -> Result<(), String> {
    DeviceManager::set_card_profile(&card_name, &profile).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_lyrics_lrc(track_path: String, lrc_content: String) -> Result<String, String> {
    metadata::save_lrc_file(&track_path, &lrc_content)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_app_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state
        .db
        .get_app_setting(&key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_app_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .set_app_setting(&key, &value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn transcode_file(
    input_path: String,
    output_path: String,
    format: ExportFormat,
    dsp_settings: Option<DspExportSettings>,
    time_range: Option<TimeRange>,
) -> Result<(), String> {
    Transcoder::transcode_with_dsp(
        &input_path,
        &output_path,
        format,
        dsp_settings.as_ref(),
        time_range.as_ref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn scan_library(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, String> {
    info!("Tauri command: scan_library('{}')", folder_path);
    let summary = state
        .scanner
        .scan_directory(&folder_path, &state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

#[tauri::command]
async fn scan_paths(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, String> {
    info!("Tauri command: scan_paths({:?})", paths);
    let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    let summary = state
        .scanner
        .scan_paths(&path_bufs, &state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

fn is_kde_environment() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .map(|d| d.to_uppercase().contains("KDE"))
        .unwrap_or(false)
        || std::env::var("KDE_FULL_SESSION").is_ok()
}

#[tauri::command]
async fn pick_folder() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getexistingdirectory",
                    &home,
                    "--title",
                    "Wybierz folder z muzyką (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--directory",
                    "--title=Wybierz folder z muzyką",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_files() -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<Vec<String>> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getopenfilename",
                    &home,
                    "*.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff|Pliki audio (*.flac, *.mp3, *.ogg, *.opus, *.wav, *.m4a)",
                    "--multiple",
                    "--separate-output",
                    "--title",
                    "Wybierz pliki audio (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let paths_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !paths_str.is_empty() {
                        let paths: Vec<String> = paths_str
                            .lines()
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                        return Some(paths);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<Vec<String>> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--multiple",
                    "--separator=|",
                    "--title=Wybierz pliki audio",
                    "--file-filter=Pliki audio (FLAC, MP3, OGG, OPUS, WAV, M4A) | *.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff",
                ])
                .output()
            {
                if output.status.success() {
                    let paths_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !paths_str.is_empty() {
                        let paths: Vec<String> = paths_str
                            .split('|')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                        return Some(paths);
                    }
                }
            }
            None
        };

        let selected = if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        };

        selected.unwrap_or_default()
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_image_file() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let pictures = std::env::var("HOME")
            .map(|h| format!("{}/Pictures", h))
            .unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getopenfilename",
                    &pictures,
                    "*.png *.jpg *.jpeg *.webp *.gif *.mp4 *.webm|Tapety i animowane wideo (*.png, *.jpg, *.mp4, *.webm)",
                    "--title",
                    "Wybierz tapetę lub animowane tło wideo (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--title=Wybierz tapetę lub animowane tło wideo",
                    "--file-filter=Obrazy i wideo (PNG, JPG, WebP, MP4, WebM) | *.png *.jpg *.jpeg *.webp *.gif *.mp4 *.webm",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_single_audio_file() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getopenfilename",
                    &home,
                    "*.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff|Pliki audio (*.flac, *.mp3, *.ogg, *.opus, *.wav, *.m4a)",
                    "--title",
                    "Wybierz plik źródłowy do transkodowania (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--title=Wybierz plik źródłowy do transkodowania",
                    "--file-filter=Pliki audio (FLAC, MP3, OGG, OPUS, WAV, M4A) | *.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_save_destination(
    default_name: String,
    extension: String,
) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let target_file = format!("{}/{}", home, default_name);
        let filter = format!("*.{}|Pliki (*.{})", extension, extension);

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getsavefilename",
                    &target_file,
                    &filter,
                    "--title",
                    "Wybierz miejsce docelowe zapisu (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--save",
                    "--confirm-overwrite",
                    &format!("--filename={}", target_file),
                    "--title=Wybierz miejsce docelowe zapisu",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_custom_file(title: String, filter: String) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args(["--getopenfilename", &home, &filter, "--title", &title])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            let filter_arg = format!("--file-filter={}", filter);
            let title_arg = format!("--title={}", title);
            if let Ok(output) = std::process::Command::new("zenity")
                .args(["--file-selection", &title_arg, &filter_arg])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_containing_folder(file_path: String) -> Result<String, String> {
    info!("Tauri command: open_containing_folder('{}')", file_path);
    tokio::task::spawn_blocking(move || {
        let clean = if let Some(stripped) = file_path.strip_prefix("file://") {
            stripped
        } else {
            &file_path
        };

        let p = std::path::Path::new(clean);
        let abs_path = if p.is_absolute() {
            p.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(p)
        };

        let target_dir = if abs_path.is_dir() {
            abs_path.clone()
        } else {
            abs_path
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| std::path::PathBuf::from("."))
        };

        // 1. Jeśli to środowisko KDE Plasma, użyj natywnego polecenia Dolphin z opcją --select
        if is_kde_environment() {
            if abs_path.exists() && !abs_path.is_dir() {
                if std::process::Command::new("dolphin")
                    .arg("--select")
                    .arg(&abs_path)
                    .spawn()
                    .is_ok()
                {
                    return Ok(target_dir.to_string_lossy().to_string());
                }
            } else if std::process::Command::new("dolphin")
                .arg(&target_dir)
                .spawn()
                .is_ok()
            {
                return Ok(target_dir.to_string_lossy().to_string());
            }
        }

        // 2. Standard DBus: org.freedesktop.FileManager1.ShowItems (Dolphin, Nautilus, Nemo, Thunar)
        if abs_path.exists() && !abs_path.is_dir() {
            let uri = format!("file://{}", abs_path.to_string_lossy());
            if let Ok(mut child) = std::process::Command::new("dbus-send")
                .args([
                    "--session",
                    "--dest=org.freedesktop.FileManager1",
                    "--type=method_call",
                    "/org/freedesktop/FileManager1",
                    "org.freedesktop.FileManager1.ShowItems",
                    &format!("array:string:{}", uri),
                    "string:\"\"",
                ])
                .spawn()
            {
                if let Ok(status) = child.wait() {
                    if status.success() {
                        return Ok(target_dir.to_string_lossy().to_string());
                    }
                }
            }
        }

        // 3. Fallback dla dedykowanych menedżerów plików z flagą --select (np. Nautilus / Nemo / Thunar)
        if abs_path.exists() && !abs_path.is_dir() {
            for fm in &["nautilus", "nemo", "thunar"] {
                if std::process::Command::new(fm)
                    .arg("--select")
                    .arg(&abs_path)
                    .spawn()
                    .is_ok()
                {
                    return Ok(target_dir.to_string_lossy().to_string());
                }
            }
        }

        // 4. Uniwersalny fallback: xdg-open na katalogu nadrzędnym
        let _ = std::process::Command::new("xdg-open")
            .arg(&target_dir)
            .spawn()
            .map_err(|e| format!("Błąd otwierania folderu w menedżerze plików: {}", e))?;

        Ok(target_dir.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Dozwolone są wyłącznie bezpieczne adresy URL (http/https)".to_string());
    }
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Błąd otwierania odnośnika w przeglądarce: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_library_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_tracks().await })
        .map_err(|e| e.to_string())
}

fn resolve_cover_to_data_uri(path_str: &str) -> Option<String> {
    if path_str.starts_with("data:")
        || path_str.starts_with("http://")
        || path_str.starts_with("https://")
    {
        return Some(path_str.to_string());
    }

    let clean_path = if let Some(stripped) = path_str.strip_prefix("file://") {
        stripped
    } else {
        path_str
    };

    let path = std::path::Path::new(clean_path);
    if !path.exists() {
        return None;
    }

    let bytes = std::fs::read(path).ok()?;
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn get_library_albums(state: State<'_, AppState>) -> Result<Vec<AlbumRecord>, String> {
    let db = state.db.clone();
    let albums = state
        .rt
        .block_on(async move { db.list_albums().await })
        .map_err(|e| e.to_string())?;

    let mut resolved = Vec::with_capacity(albums.len());
    for mut album in albums {
        if let Some(cp) = &album.cover_path {
            album.cover_path = resolve_cover_to_data_uri(cp);
        }
        resolved.push(album);
    }
    Ok(resolved)
}

#[tauri::command]
fn get_library_artists(state: State<'_, AppState>) -> Result<Vec<ArtistRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_artists().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_bookmark(
    track_id: i64,
    position_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.save_bookmark(track_id, position_ms).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_bookmark(track_id: i64, state: State<'_, AppState>) -> Result<Option<u64>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.get_bookmark(track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_bookmark(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.delete_bookmark(track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite(track_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.toggle_favorite(track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_track_rating(
    track_id: i64,
    rating: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .set_track_rating(track_id, rating)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_track_metadata(path: String) -> Result<audio_engine::TrackMetadataFullDto, String> {
    audio_engine::read_track_metadata(&path)
}

#[tauri::command]
async fn update_track_metadata(
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
fn parse_cue_sheet_content(cue_content: String) -> Result<domain::CueSheet, String> {
    domain::CueSheet::parse(&cue_content)
}

#[tauri::command]
async fn list_smart_playlist_tracks(
    smart_type: String,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    match smart_type.as_str() {
        "favorites" => state
            .db
            .list_favorite_tracks()
            .await
            .map_err(|e| e.to_string()),
        "top_played" => state
            .db
            .list_top_played_tracks(25)
            .await
            .map_err(|e| e.to_string()),
        "recently_played" => state
            .db
            .list_recently_played_tracks(50)
            .await
            .map_err(|e| e.to_string()),
        "hires" => state
            .db
            .list_hires_tracks()
            .await
            .map_err(|e| e.to_string()),
        "forgotten" => state
            .db
            .list_forgotten_tracks(50)
            .await
            .map_err(|e| e.to_string()),
        "high_bpm" => state
            .db
            .list_high_bpm_tracks(130.0)
            .await
            .map_err(|e| e.to_string()),
        "top_rated" => state
            .db
            .list_top_rated_tracks()
            .await
            .map_err(|e| e.to_string()),
        _ => Err("Nieznany typ inteligentnej playlisty".to_string()),
    }
}

#[tauri::command]
fn show_desktop_notification(
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), String> {
    let mut cmd = std::process::Command::new("notify-send");
    cmd.arg("-a").arg("Auralune");
    cmd.arg("-u").arg("normal");
    cmd.arg("-h").arg("string:desktop-entry:auralune");
    if let Some(ic) = icon {
        cmd.arg("-i").arg(ic);
    }
    cmd.arg(&title).arg(&body);
    let _ = cmd.spawn();
    Ok(())
}

#[tauri::command]
fn record_track_play(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.record_track_play(track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn record_track_listening(
    track_id: i64,
    duration_ms: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .record_track_listening(track_id, duration_ms)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_recap_summary(
    period: String,
    state: State<'_, AppState>,
) -> Result<storage::RecapSummaryDto, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let since_epoch = match period.as_str() {
        "week" => now.saturating_sub(7 * 86400),
        "month" => now.saturating_sub(30 * 86400),
        "year" => now.saturating_sub(365 * 86400),
        _ => 0, // all_time
    };

    state
        .db
        .get_recap_summary(&period, since_epoch)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn reset_track_plays(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.reset_track_plays(track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_favorite_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_favorite_tracks().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_recently_played_tracks(
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    let db = state.db.clone();
    let l = limit.unwrap_or(30);
    state
        .rt
        .block_on(async move { db.list_recently_played_tracks(l).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_top_played_tracks(
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    let db = state.db.clone();
    let l = limit.unwrap_or(30);
    state
        .rt
        .block_on(async move { db.list_top_played_tracks(l).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_hires_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_hires_tracks().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_themes(state: State<'_, AppState>) -> Result<Vec<Theme>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_themes().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_active_theme(state: State<'_, AppState>) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let active_id = db
                .get_app_setting("active_theme_id")
                .await?
                .unwrap_or_else(|| "cyber-kitsune".to_string());
            if let Some(theme) = db.get_theme(&active_id).await? {
                Ok(theme)
            } else {
                db.get_theme("cyber-kitsune").await?.ok_or_else(|| {
                    storage::StorageError::Migration("Nie znaleziono domyślnego motywu".to_string())
                })
            }
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn set_active_theme(theme_id: String, state: State<'_, AppState>) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            db.set_app_setting("active_theme_id", &theme_id).await?;
            Ok(theme)
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn save_theme(theme: Theme, state: State<'_, AppState>) -> Result<(), String> {
    theme.validate()?;
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.save_theme(&theme).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_theme_background(
    theme_id: String,
    background_ref: Option<String>,
    overlay_opacity: f32,
    blur_radius: f32,
    state: State<'_, AppState>,
) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let mut theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            theme.background_ref = background_ref;
            theme.overlay_opacity = overlay_opacity;
            theme.blur_radius = blur_radius;
            theme.validate().map_err(storage::StorageError::Migration)?;
            db.save_theme(&theme).await?;
            Ok(theme)
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn export_theme_json(theme_id: String, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            serde_json::to_string_pretty(&theme)
                .map_err(|e| storage::StorageError::Migration(e.to_string()))
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn import_theme_json(json_content: String, state: State<'_, AppState>) -> Result<Theme, String> {
    let theme: Theme =
        serde_json::from_str(&json_content).map_err(|e| format!("Błąd parsowania JSON: {}", e))?;
    theme.validate()?;
    let db = state.db.clone();
    let theme_clone = theme.clone();
    state
        .rt
        .block_on(async move {
            db.save_theme(&theme_clone).await?;
            db.set_app_setting("active_theme_id", &theme_clone.id)
                .await?;
            Ok::<(), storage::StorageError>(())
        })
        .map_err(|e| e.to_string())?;
    Ok(theme)
}

#[tauri::command]
fn upload_background_image(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Wskazany plik nie istnieje".to_string());
    }
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => {
            return Err(
                "Obsługiwane są pliki PNG, JPG, WebP oraz animowane wideo tła MP4/WebM".to_string(),
            )
        }
    };

    let bytes = std::fs::read(path).map_err(|e| format!("Błąd odczytu pliku: {}", e))?;
    let max_size = if mime.starts_with("video/") {
        100 * 1024 * 1024
    } else {
        25 * 1024 * 1024
    };
    if bytes.len() > max_size {
        return Err(format!(
            "Plik tła jest zbyt duży (maks. {} MB)",
            max_size / (1024 * 1024)
        ));
    }

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn search_musicbrainz_releases(
    album: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Vec<ReleaseCandidateDto>, String> {
    info!(
        "Tauri command: search_musicbrainz_releases('{}', '{}')",
        album, artist
    );
    let mb = state.mb.clone();
    state
        .rt
        .block_on(async move { mb.search_releases(&album, &artist).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn fetch_and_apply_cover(
    album_id: i64,
    mbid: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: fetch_and_apply_cover(album_id: {}, mbid: '{}')",
        album_id, mbid
    );
    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let path = cover_archive
            .fetch_and_cache_cover(&mbid)
            .await
            .map_err(|e| e.to_string())?;
        let path_str = path.to_string_lossy().to_string();

        db.update_album_cover(album_id, &path_str, Some(&mbid))
            .await
            .map_err(|e| e.to_string())?;

        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:image/jpeg;base64,{}", b64))
    })
}

#[tauri::command]
fn auto_fetch_album_cover(
    album_id: i64,
    album_title: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    info!(
        "Tauri command: auto_fetch_album_cover('{}', '{}')",
        album_title, artist
    );
    let mb = state.mb.clone();
    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let candidates = mb
            .search_releases(&album_title, &artist)
            .await
            .map_err(|e| e.to_string())?;
        if candidates.is_empty() {
            return Ok(None);
        }

        let best = &candidates[0];
        if best.score >= 85 {
            match cover_archive.fetch_and_cache_cover(&best.mbid).await {
                Ok(path) => {
                    let path_str = path.to_string_lossy().to_string();
                    db.update_album_cover(album_id, &path_str, Some(&best.mbid))
                        .await
                        .map_err(|e| e.to_string())?;

                    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    return Ok(Some(format!("data:image/jpeg;base64,{}", b64)));
                }
                Err(e) => {
                    tracing::warn!("Nie udało się pobrać okładki dla MBID {}: {}", best.mbid, e);
                }
            }
        }

        Ok(None)
    })
}

#[tauri::command]
fn search_cover_candidates(
    album: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Vec<CoverCandidateDto>, String> {
    info!(
        "Tauri command: search_cover_candidates('{}', '{}')",
        album, artist
    );
    let cover_archive = state.cover_archive.clone();
    let candidates = state
        .rt
        .block_on(async move { cover_archive.search_cover_candidates(&album, &artist).await });
    Ok(candidates)
}

#[tauri::command]
fn apply_cover_url(
    album_id: i64,
    cover_url: String,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: apply_cover_url(album_id: {}, url: '{}')",
        album_id, cover_url
    );
    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let actual_album_id = if album_id > 0 {
            album_id
        } else if let Some(title) = &album_title {
            let art = artist.as_deref().unwrap_or("Unknown");
            db.upsert_album(title, art, None, None)
                .await
                .map_err(|e| e.to_string())?
        } else {
            return Err("Nieprawidłowe ID albumu".to_string());
        };

        let path = cover_archive
            .download_cover_from_url(&cover_url, &format!("album_{}", actual_album_id))
            .await
            .map_err(|e| e.to_string())?;
        let path_str = path.to_string_lossy().to_string();

        db.update_album_cover(actual_album_id, &path_str, None)
            .await
            .map_err(|e| e.to_string())?;

        // Linkowanie utworów z albumem
        if let Some(tid) = track_id {
            let _ = db.link_track_to_album(tid, actual_album_id).await;
        }
        if let Some(title) = &album_title {
            let _ = db.link_tracks_by_album_title(title, actual_album_id).await;
        }

        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:image/jpeg;base64,{}", b64))
    })
}

#[tauri::command]
fn apply_custom_cover_file(
    album_id: i64,
    file_path: String,
    album_title: Option<String>,
    artist: Option<String>,
    track_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: apply_custom_cover_file(album_id: {}, path: '{}')",
        album_id, file_path
    );
    let path = std::path::Path::new(&file_path);
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

    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let actual_album_id = if album_id > 0 {
            album_id
        } else if let Some(title) = &album_title {
            let art = artist.as_deref().unwrap_or("Unknown");
            db.upsert_album(title, art, None, None)
                .await
                .map_err(|e| e.to_string())?
        } else {
            return Err("Nieprawidłowe ID albumu".to_string());
        };

        let saved_path = cover_archive
            .save_custom_cover_file(actual_album_id, path)
            .await
            .map_err(|e| e.to_string())?;
        let path_str = saved_path.to_string_lossy().to_string();

        db.update_album_cover(actual_album_id, &path_str, None)
            .await
            .map_err(|e| e.to_string())?;

        // Linkowanie utworu z albumem
        if let Some(tid) = track_id {
            let _ = db.link_track_to_album(tid, actual_album_id).await;
        }
        if let Some(title) = &album_title {
            let _ = db.link_tracks_by_album_title(title, actual_album_id).await;
        }

        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:{};base64,{}", mime, b64))
    })
}

#[tauri::command]
fn apply_custom_cover_data(
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

    use base64::Engine;
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

    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let actual_album_id = if album_id > 0 {
            album_id
        } else if let Some(title) = &album_title {
            let art = artist.as_deref().unwrap_or("Unknown");
            db.upsert_album(title, art, None, None)
                .await
                .map_err(|e| e.to_string())?
        } else {
            return Err("Nieprawidłowe ID albumu".to_string());
        };

        let saved_path = cover_archive
            .save_custom_cover_bytes(actual_album_id, &bytes, clean_ext)
            .await
            .map_err(|e| e.to_string())?;
        let path_str = saved_path.to_string_lossy().to_string();

        db.update_album_cover(actual_album_id, &path_str, None)
            .await
            .map_err(|e| e.to_string())?;

        // Linkowanie utworu z albumem
        if let Some(tid) = track_id {
            let _ = db.link_track_to_album(tid, actual_album_id).await;
        }
        if let Some(title) = &album_title {
            let _ = db.link_tracks_by_album_title(title, actual_album_id).await;
        }

        Ok(format!("data:{};base64,{}", mime, raw_b64))
    })
}

#[tauri::command]
fn get_track_cover(track_path: String) -> Result<Option<String>, String> {
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
                    use base64::Engine;
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
fn get_lyrics(
    track_path: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    duration_sec: Option<f64>,
    state: State<'_, AppState>,
) -> Result<Option<metadata::LyricsDto>, String> {
    info!("Tauri command: get_lyrics('{}' - '{}')", artist, title);
    let lyrics = state.rt.block_on(async move {
        metadata::fetch_lyrics_online_or_local(
            track_path.as_deref(),
            &title,
            &artist,
            album.as_deref(),
            duration_sec,
        )
        .await
    });
    Ok(lyrics)
}

#[tauri::command]
fn set_mini_player_mode(mini: bool, window: tauri::Window) -> Result<(), String> {
    info!("Tauri command: set_mini_player_mode({})", mini);
    if mini {
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(320.0, 120.0)));
        let _ = window.set_size(tauri::LogicalSize::new(360.0, 150.0));
        let _ = window.set_always_on_top(true);
    } else {
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(320.0, 120.0)));
        let _ = window.set_size(tauri::LogicalSize::new(1080.0, 760.0));
        let _ = window.set_always_on_top(false);
    }
    Ok(())
}

fn sync_mpris_from_queue_item(item: &QueueItem, state: &AppState) {
    let title = item.title.clone();
    let artist = item.artist.clone();
    let album = item.album.clone().unwrap_or_default();
    let duration_ms = item.duration_ms;
    let cache_key = format!(
        "{}---{}",
        artist.trim().to_lowercase(),
        album.trim().to_lowercase()
    );
    let cached_art = state
        .discord_cover_cache
        .read()
        .ok()
        .and_then(|c| c.get(&cache_key).cloned());

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

        if needs_online_search && (!artist.trim().is_empty() || !album.trim().is_empty()) {
            let discord_clone = discord.clone();
            let cover_archive = state.cover_archive.clone();
            let cache_clone = state.discord_cover_cache.clone();
            let title_c = title.clone();
            let artist_c = artist.clone();
            let album_c = album.clone();
            state.rt.spawn(async move {
                let mut candidates = cover_archive
                    .search_cover_candidates(&album_c, &artist_c)
                    .await;
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

fn persist_queue_state(state: &AppState) {
    let queue = state.engine.queue();
    let db = state.db.clone();
    state.rt.spawn(async move {
        if let Err(e) = db.save_queue_state(&queue).await {
            tracing::warn!("Nie udało się zapisać stanu kolejki: {}", e);
        }
    });
}

#[tauri::command]
fn get_queue(state: State<'_, AppState>) -> PlaybackQueue {
    state.engine.queue()
}

#[tauri::command]
fn set_queue(
    items: Vec<QueueItem>,
    start_index: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: set_queue ({} utworów)", items.len());
    let active = state
        .engine
        .set_queue(items, start_index)
        .map_err(|e| e.to_string())?;
    if let Some(item) = &active {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(active)
}

#[tauri::command]
fn add_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: add_to_queue('{}')", item.title);
    state.engine.add_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

/// Dodaje wiele ścieżek URI do kolejki za jednym razem — bez sekwencyjnych round-tripów
/// do SQLite. Operacja persist jest wywoływana raz po dodaniu wszystkich elementów.
#[tauri::command]
async fn add_uris_to_queue(uris: Vec<String>, state: State<'_, AppState>) -> Result<usize, String> {
    info!("Tauri command: add_uris_to_queue({} ścieżek)", uris.len());
    if uris.is_empty() {
        return Ok(0);
    }

    // Rozwiń rekurencyjnie foldery i zbierz wyłącznie pliki audio
    let mut resolved_files = Vec::new();
    for uri in uris {
        let path = std::path::Path::new(&uri);
        if path.is_dir() {
            for entry in walkdir::WalkDir::new(path)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                if p.is_file() && library::LibraryScanner::is_supported_audio_extension(p) {
                    resolved_files.push(p.to_string_lossy().to_string());
                }
            }
        } else if (path.is_file() && library::LibraryScanner::is_supported_audio_extension(path))
            || uri.starts_with("http://")
            || uri.starts_with("https://")
        {
            resolved_files.push(uri);
        }
    }

    if resolved_files.is_empty() {
        return Ok(0);
    }

    let db = state.db.clone();
    let mut added = 0usize;

    for uri in &resolved_files {
        // Sprawdź bazę danych w poszukiwaniu metadanych (asynchronicznie)
        let track_opt = db.get_track_by_path(uri).await.ok().flatten();

        let item = if let Some(t) = track_opt {
            QueueItem {
                id: format!("track-{}", t.id),
                track_id: Some(t.id),
                uri: t.path.clone(),
                title: t.title.clone(),
                artist: t.artist.clone(),
                album: t.album_artist.clone(),
                duration_ms: t.duration_ms as u64,
            }
        } else {
            let title = std::path::Path::new(uri)
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or(uri)
                .to_string();
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_micros();
            QueueItem {
                id: format!("drop-{}-{}", ts, added),
                track_id: None,
                uri: uri.to_string(),
                title,
                artist: String::new(),
                album: None,
                duration_ms: 0,
            }
        };

        state.engine.add_to_queue(item);
        added += 1;
    }

    // Zapis stanu kolejki tylko raz po dodaniu wszystkich elementów
    persist_queue_state(&state);
    Ok(added)
}

#[tauri::command]
fn add_next_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: add_next_to_queue('{}')", item.title);
    state.engine.add_next_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn remove_from_queue(id: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: remove_from_queue('{}')", id);
    state.engine.remove_from_queue(&id);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn reorder_queue(
    from_idx: usize,
    to_idx: usize,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    info!("Tauri command: reorder_queue({} -> {})", from_idx, to_idx);
    let res = state.engine.move_in_queue(from_idx, to_idx);
    persist_queue_state(&state);
    Ok(res)
}

#[tauri::command]
fn clear_queue(state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: clear_queue()");
    state.engine.clear_queue();
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn play_queue_index(index: usize, state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_queue_index({})", index);
    let active = state.engine.play_index(index).map_err(|e| e.to_string())?;
    if let Some(item) = &active {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(active)
}

#[tauri::command]
fn play_next(state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_next()");
    let next_item = state.engine.play_next().map_err(|e| e.to_string())?;
    if let Some(item) = &next_item {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(next_item)
}

#[tauri::command]
fn play_previous(state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_previous()");
    let prev_item = state.engine.play_previous().map_err(|e| e.to_string())?;
    if let Some(item) = &prev_item {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(prev_item)
}

#[tauri::command]
fn set_loop_mode(mode: LoopMode, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_loop_mode({:?})", mode);
    state.engine.set_loop_mode(mode);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn toggle_shuffle(state: State<'_, AppState>) -> Result<bool, String> {
    let current = state.engine.shuffle();
    let new_val = !current;
    info!("Tauri command: toggle_shuffle({} -> {})", current, new_val);
    state.engine.set_shuffle(new_val);
    persist_queue_state(&state);
    Ok(new_val)
}

#[tauri::command]
fn create_playlist(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    info!("Tauri command: create_playlist('{}')", name);
    state
        .rt
        .block_on(async { state.db.create_playlist(&name).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_playlist(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: delete_playlist({})", playlist_id);
    state
        .rt
        .block_on(async { state.db.delete_playlist(playlist_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    state
        .rt
        .block_on(async { state.db.list_playlists().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: add_track_to_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .rt
        .block_on(async { state.db.add_track_to_playlist(playlist_id, track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: remove_track_from_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .rt
        .block_on(async {
            state
                .db
                .remove_track_from_playlist(playlist_id, track_id)
                .await
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_playlist_tracks(
    playlist_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    state
        .rt
        .block_on(async { state.db.get_playlist_tracks(playlist_id).await })
        .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistExportDto {
    pub name: String,
    pub track_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileBackupDto {
    pub version: String,
    pub exported_at_timestamp: u64,
    pub dsp_presets: Vec<DspPresetRecord>,
    pub themes: Vec<Theme>,
    pub playlists: Vec<PlaylistExportDto>,
}

#[tauri::command]
fn export_playlist_m3u8(
    playlist_id: i64,
    export_path: String,
    use_relative_paths: bool,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: export_playlist_m3u8(playlist_id: {}, export_path: '{}', relative: {})",
        playlist_id, export_path, use_relative_paths
    );
    let tracks = state
        .rt
        .block_on(async { state.db.get_playlist_tracks(playlist_id).await })
        .map_err(|e| format!("Błąd pobierania utworów playlisty: {}", e))?;

    let playlists = state
        .rt
        .block_on(async { state.db.list_playlists().await })
        .map_err(|e| format!("Błąd pobierania listy playlist: {}", e))?;

    let playlist_name = playlists
        .iter()
        .find(|p| p.id == playlist_id)
        .map(|p| p.name.clone())
        .unwrap_or_else(|| format!("Playlist_{}", playlist_id));

    let entries: Vec<M3uEntry> = tracks
        .into_iter()
        .map(|t| M3uEntry {
            path_or_uri: t.path,
            title: Some(t.title),
            artist: Some(t.artist),
            duration_seconds: Some(t.duration_ms / 1000),
        })
        .collect();

    let export_dir = std::path::Path::new(&export_path).parent();
    let content =
        M3uPlaylist::export_to_m3u8(&playlist_name, &entries, export_dir, use_relative_paths);

    fs::write(&export_path, content)
        .map_err(|e| format!("Nie udało się zapisać pliku M3U8: {}", e))?;

    Ok(format!(
        "Pomyślnie wyeksportowano playlistę '{}' ({} utworów)",
        playlist_name,
        entries.len()
    ))
}

#[tauri::command]
fn import_playlist_m3u8(
    file_path: String,
    custom_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<ImportM3uResult, String> {
    info!("Tauri command: import_playlist_m3u8('{}')", file_path);

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Nie udało się odczytać pliku M3U/M3U8: {}", e))?;

    let path_obj = std::path::Path::new(&file_path);
    let base_dir = path_obj.parent();

    let fallback_name = path_obj
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Zaimportowana Playlista");

    let playlist_name = custom_name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| fallback_name.to_string());

    let m3u = M3uPlaylist::parse(&content, &playlist_name, base_dir)?;

    state.rt.block_on(async {
        let playlist_id = state
            .db
            .create_playlist(&m3u.name)
            .await
            .map_err(|e| format!("Błąd tworzenia playlisty w bazie: {}", e))?;

        let mut matched_tracks = 0;
        let mut missing_tracks = Vec::new();

        for entry in &m3u.entries {
            if let Some(track) = state
                .db
                .find_track_by_path_or_uri(&entry.path_or_uri)
                .await
                .unwrap_or(None)
            {
                if let Err(e) = state.db.add_track_to_playlist(playlist_id, track.id).await {
                    error!("Błąd dodawania utworu {} do playlisty: {}", track.id, e);
                } else {
                    matched_tracks += 1;
                }
            } else {
                missing_tracks.push(entry.path_or_uri.clone());
            }
        }

        Ok(ImportM3uResult {
            playlist_id,
            playlist_name: m3u.name,
            total_entries: m3u.entries.len(),
            matched_tracks,
            missing_tracks,
        })
    })
}

#[tauri::command]
fn export_profile_backup(
    destination_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: export_profile_backup(dest: {:?})",
        destination_path
    );
    state.rt.block_on(async {
        let presets = state.db.list_dsp_presets().await.unwrap_or_default();
        let themes = state.db.list_themes().await.unwrap_or_default();
        let playlists = state.db.list_playlists().await.unwrap_or_default();

        let mut playlist_exports = Vec::new();
        for pl in playlists {
            let tracks = state
                .db
                .get_playlist_tracks(pl.id)
                .await
                .unwrap_or_default();
            playlist_exports.push(PlaylistExportDto {
                name: pl.name,
                track_paths: tracks.into_iter().map(|t| t.path).collect(),
            });
        }

        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let backup = ProfileBackupDto {
            version: env!("CARGO_PKG_VERSION").to_string(),
            exported_at_timestamp: now_ts,
            dsp_presets: presets,
            themes,
            playlists: playlist_exports,
        };

        let json = serde_json::to_string_pretty(&backup)
            .map_err(|e| format!("Błąd serializacji kopii profilu: {}", e))?;

        if let Some(dest) = destination_path {
            fs::write(&dest, &json)
                .map_err(|e| format!("Błąd zapisu pliku kopii zapasowej: {}", e))?;
            Ok(format!("Pomyślnie zapisano kopię profilu w: {}", dest))
        } else {
            Ok(json)
        }
    })
}

#[tauri::command]
fn import_profile_backup(
    file_path_or_json: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Tauri command: import_profile_backup");
    let json_content = if file_path_or_json.trim().starts_with('{') {
        file_path_or_json
    } else {
        fs::read_to_string(&file_path_or_json)
            .map_err(|e| format!("Błąd odczytu pliku kopii zapasowej: {}", e))?
    };

    let backup: ProfileBackupDto = serde_json::from_str(&json_content)
        .map_err(|e| format!("Nieprawidłowy format pliku JSON kopii profilu: {}", e))?;

    state.rt.block_on(async {
        let mut restored_presets = 0;
        let mut restored_themes = 0;
        let mut restored_playlists = 0;

        for preset in backup.dsp_presets {
            if state
                .db
                .save_dsp_preset(
                    &preset.name,
                    &preset.engine,
                    preset.pitch_semitones,
                    preset.tempo_ratio,
                    preset.rate_ratio,
                )
                .await
                .is_ok()
            {
                restored_presets += 1;
            }
        }

        for theme in backup.themes {
            if state.db.save_theme(&theme).await.is_ok() {
                restored_themes += 1;
            }
        }

        for pl in backup.playlists {
            if let Ok(pl_id) = state.db.create_playlist(&pl.name).await {
                restored_playlists += 1;
                for path in pl.track_paths {
                    if let Ok(Some(track)) = state.db.find_track_by_path_or_uri(&path).await {
                        let _ = state.db.add_track_to_playlist(pl_id, track.id).await;
                    }
                }
            }
        }

        Ok(format!(
            "Pomyślnie przywrócono profil (wersja kopii: {}): {} presetów DSP, {} motywów, {} playlist.",
            backup.version, restored_presets, restored_themes, restored_playlists
        ))
    })
}

#[tauri::command]
async fn validate_listenbrainz_token(
    token: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Tauri command: validate_listenbrainz_token");
    state.listenbrainz.validate_token(&token).await
}

#[tauri::command]
async fn submit_listenbrainz_playing_now(
    token: String,
    artist: String,
    title: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .listenbrainz
        .submit_playing_now(&token, &artist, &title, album.as_deref(), duration_ms)
        .await
}

#[tauri::command]
async fn submit_listenbrainz_listen(
    token: String,
    artist: String,
    title: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    state
        .listenbrainz
        .submit_listen(&token, &artist, &title, album.as_deref(), now, duration_ms)
        .await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastFmAuthUrlResult {
    pub token: String,
    pub auth_url: String,
}

#[tauri::command]
async fn lastfm_get_auth_url(
    api_key: Option<String>,
    state: State<'_, AppState>,
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

#[tauri::command]
async fn lastfm_fetch_session(
    token: String,
    api_key: Option<String>,
    api_secret: Option<String>,
    state: State<'_, AppState>,
) -> Result<LastFmSession, String> {
    info!("Tauri command: lastfm_fetch_session");
    state
        .lastfm
        .fetch_session(&token, api_key.as_deref(), api_secret.as_deref())
        .await
}

#[tauri::command]
async fn lastfm_validate_session(
    session_key: String,
    api_key: Option<String>,
    api_secret: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Tauri command: lastfm_validate_session");
    state
        .lastfm
        .validate_session(&session_key, api_key.as_deref(), api_secret.as_deref())
        .await
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

#[tauri::command]
async fn lastfm_update_now_playing(
    request: LastFmScrobbleRequest,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let track_info = metadata::LastFmTrackInfo {
        artist: &request.artist,
        track: &request.track,
        album: request.album.as_deref(),
        duration_sec: request.duration_sec,
    };
    let auth = metadata::LastFmAuthOverride {
        api_key: request.api_key.as_deref(),
        api_secret: request.api_secret.as_deref(),
    };
    state
        .lastfm
        .update_now_playing(&request.session_key, track_info, auth)
        .await
}

#[tauri::command]
async fn lastfm_scrobble(
    request: LastFmScrobbleRequest,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let track_info = metadata::LastFmTrackInfo {
        artist: &request.artist,
        track: &request.track,
        album: request.album.as_deref(),
        duration_sec: request.duration_sec,
    };
    let auth = metadata::LastFmAuthOverride {
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

#[tauri::command]
fn get_discord_rpc_status(
    state: State<'_, AppState>,
) -> Result<desktop_integration::DiscordRpcStatus, String> {
    if let Some(discord) = &state.discord_rpc {
        Ok(discord.get_status())
    } else {
        Ok(desktop_integration::DiscordRpcStatus {
            enabled: false,
            connected: false,
            client_id: desktop_integration::DEFAULT_DISCORD_CLIENT_ID.to_string(),
            current_activity: None,
        })
    }
}

#[tauri::command]
async fn set_discord_rpc_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_discord_rpc_enabled({})", enabled);
    if let Some(discord) = &state.discord_rpc {
        discord.set_enabled(enabled);
    }
    state
        .db
        .set_app_setting(
            "discord_rpc_enabled",
            if enabled { "true" } else { "false" },
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn set_discord_rpc_client_id(
    client_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Tauri command: set_discord_rpc_client_id('{}')", client_id);
    let trimmed = client_id.trim().to_string();
    if let Some(discord) = &state.discord_rpc {
        discord.set_client_id(trimmed.clone());
    }
    state
        .db
        .set_app_setting("discord_rpc_client_id", &trimmed)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_track_bookmarks(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<TrackBookmark>, String> {
    state
        .db
        .get_track_bookmarks(track_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_track_bookmark(
    track_id: i64,
    name: String,
    position_ms: u64,
    state: State<'_, AppState>,
) -> Result<TrackBookmark, String> {
    state
        .db
        .add_track_bookmark(track_id, &name, position_ms)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_track_bookmark(
    bookmark_id: i64,
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .update_track_bookmark(bookmark_id, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_track_bookmark(bookmark_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .db
        .delete_track_bookmark(bookmark_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn find_duplicate_tracks(state: State<'_, AppState>) -> Result<Vec<DuplicateGroup>, String> {
    state
        .db
        .find_duplicate_tracks()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_track_record(
    track_id: i64,
    delete_file: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if delete_file {
        if let Ok(Some(track)) = state.db.get_track_by_id(track_id).await {
            let p = PathBuf::from(&track.path);
            if p.exists() {
                let _ = fs::remove_file(p);
            }
        }
    }
    state
        .db
        .delete_track(track_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn preview_rename_tracks(
    pattern: String,
    track_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<RenamePreviewItem>, String> {
    let mut items = Vec::new();
    for id in track_ids {
        if let Ok(Some(track)) = state.db.get_track_by_id(id).await {
            let ext = std::path::Path::new(&track.path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or(&track.format);

            let album_title = if let Some(a_id) = track.album_id {
                state
                    .db
                    .get_album_by_id(a_id)
                    .await
                    .ok()
                    .flatten()
                    .map(|a| a.title)
            } else {
                None
            };

            let info = RenamerTrackInfo {
                title: &track.title,
                artist: &track.artist,
                album_artist: track.album_artist.as_deref(),
                album: album_title.as_deref(),
                track_no: track.track_no,
                disc_no: track.disc_no,
                ext,
            };

            let formatted = format_pattern_for_track(&pattern, &info);

            match resolve_renamed_path(&track.path, &formatted) {
                Ok(new_path) => {
                    let new_path_str = new_path.to_string_lossy().to_string();
                    let will_overwrite = new_path.exists() && new_path_str != track.path;
                    items.push(RenamePreviewItem {
                        track_id: track.id,
                        old_path: track.path,
                        new_path: new_path_str,
                        will_overwrite,
                        is_valid: true,
                        error: None,
                    });
                }
                Err(err) => {
                    items.push(RenamePreviewItem {
                        track_id: track.id,
                        old_path: track.path,
                        new_path: String::new(),
                        will_overwrite: false,
                        is_valid: false,
                        error: Some(err),
                    });
                }
            }
        }
    }
    Ok(items)
}

#[tauri::command]
async fn execute_rename_tracks(
    items: Vec<(i64, String)>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let mut renamed_count = 0;
    for (track_id, target_path) in items {
        if let Ok(Some(track)) = state.db.get_track_by_id(track_id).await {
            let old_p = std::path::Path::new(&track.path);
            let new_p = std::path::Path::new(&target_path);

            if old_p == new_p {
                continue;
            }

            if let Some(parent) = new_p.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if fs::rename(old_p, new_p).is_ok() {
                let _ = state.db.update_track_path(track_id, &target_path).await;
                renamed_count += 1;
            }
        }
    }
    Ok(renamed_count)
}

#[tauri::command]
async fn add_download_job(
    remote_url: String,
    destination_path: String,
    expected_sha256: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: add_download_job(url: '{}', dest: '{}')",
        remote_url, destination_path
    );
    state
        .downloads
        .add_download_job(remote_url, destination_path, expected_sha256)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn cancel_download_job(job_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    info!("Tauri command: cancel_download_job('{}')", job_id);
    Ok(state.downloads.cancel_download(&job_id))
}

#[tauri::command]
fn list_download_jobs(state: State<'_, AppState>) -> Result<Vec<DownloadJob>, String> {
    Ok(state.downloads.list_jobs())
}

#[tauri::command]
async fn set_app_icon_style(
    style: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let clean = if style == "classic" {
        "classic"
    } else {
        "lineout"
    };
    state
        .db
        .set_app_setting("app_icon_style", clean)
        .await
        .map_err(|e| e.to_string())?;

    update_system_icons(&app, clean)?;
    Ok(clean.to_string())
}

#[tauri::command]
async fn get_app_icon_style(state: State<'_, AppState>) -> Result<String, String> {
    let style = state
        .db
        .get_app_setting("app_icon_style")
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "lineout".to_string());
    Ok(style)
}

#[tauri::command]
async fn detect_track_key_bpm(
    path: String,
    track_id: Option<i64>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackKeyBpm, String> {
    let recompute = force_recompute.unwrap_or(false);
    // 1. Sprawdź, czy mamy już zapisany BPM i klucz w bazie danych (chyba że wymuszono przeliczenie)
    if !recompute {
        if let Some(id) = track_id {
            if let Ok(Some((bpm, key_name))) = state.db.get_track_key_bpm(id).await {
                if let Some((base_key_index, is_minor)) =
                    audio_engine::analysis::parse_musical_key(&key_name)
                {
                    let camelot = if is_minor {
                        audio_engine::analysis::CAMELOT_MINOR[base_key_index].to_string()
                    } else {
                        audio_engine::analysis::CAMELOT_MAJOR[base_key_index].to_string()
                    };
                    return Ok(TrackKeyBpm {
                        bpm,
                        key_name,
                        camelot,
                        base_key_index,
                        is_minor,
                        source: "database".to_string(),
                    });
                }
            }
        }
    }

    // 2. Jeśli nie ma w bazie, wykonaj analizę w tle (tokio spawn_blocking)
    let path_clone = path.clone();
    let analysis_res =
        tokio::task::spawn_blocking(move || audio_engine::analyze_track_key_bpm(&path_clone))
            .await
            .map_err(|e| format!("Błąd wątku analizy: {}", e))?
            .map_err(|e| format!("Błąd analizy: {}", e))?;

    // 3. Jeśli mamy track_id, zapisz wynik w bazie danych
    if let Some(id) = track_id {
        let db = state.db.clone();
        let bpm = analysis_res.bpm;
        let key_name = analysis_res.key_name.clone();
        let _ = db.update_track_key_bpm(id, bpm, &key_name).await;
    }

    Ok(analysis_res)
}

#[tauri::command]
async fn save_track_key_bpm(
    track_id: i64,
    bpm: f64,
    key_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .update_track_key_bpm(track_id, bpm, &key_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn update_system_icons(app: &tauri::AppHandle, style: &str) -> Result<(), String> {
    let clean_style = if style == "classic" {
        "classic"
    } else {
        "lineout"
    };

    // Wbudowane ikony aplikacji bez zależności od lokalnych ścieżek dewelopera
    let icon_bytes: Vec<u8> = if clean_style == "classic" {
        include_bytes!("../icons/icon_classic.png").to_vec()
    } else {
        include_bytes!("../icons/icon_lineout.png").to_vec()
    };

    // 1. Zaktualizuj ikonę okna Tauri w locie
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(tauri_icon) = tauri::image::Image::from_bytes(&icon_bytes) {
            let _ = window.set_icon(tauri_icon);
        }
    }

    // 2. Zainstaluj w ~/.local/share/icons/hicolor dla środowiska Wayland / KDE Plasma
    if let Some(home) = std::env::var_os("HOME") {
        let base_icons = std::path::PathBuf::from(home.clone()).join(".local/share/icons/hicolor");
        let sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
        for s in sizes {
            let dir = base_icons.join(format!("{}x{}/apps", s, s));
            let _ = std::fs::create_dir_all(&dir);

            let specific_bytes = if clean_style == "lineout" {
                std::fs::read(format!("/tmp/lineout_{}.png", s))
                    .unwrap_or_else(|_| icon_bytes.clone())
            } else {
                icon_bytes.clone()
            };

            let _ = std::fs::write(dir.join("auralune.png"), &specific_bytes);
            let _ = std::fs::write(dir.join("auralune-desktop.png"), &specific_bytes);
        }

        // 3. Zaktualizuj pliki .desktop w ~/.local/share/applications
        let apps_dir = std::path::PathBuf::from(home).join(".local/share/applications");
        let _ = std::fs::create_dir_all(&apps_dir);
        let desktop_content = r#"[Desktop Entry]
Name=Auralune
GenericName=Music Player
GenericName[pl]=Odtwarzacz muzyki
Comment=Poweramp & foobar2000 inspired Linux music player with anime aesthetics and real-time DSP
Comment[pl]=Inspirowany Powerampem i foobar2000 odtwarzacz muzyki dla Linuksa z estetyką anime i silnikiem DSP
Exec=auralune %U
Icon=auralune
Terminal=false
Type=Application
Categories=AudioVideo;Audio;Player;
MimeType=audio/flac;audio/mpeg;audio/ogg;audio/opus;audio/x-wav;audio/aac;audio/m4a;audio/x-m4a;
StartupNotify=true
StartupWMClass=auralune
Keywords=audio;music;player;dsp;soundtouch;rubberband;mpris;pipewire;
"#;
        let _ = std::fs::write(apps_dir.join("auralune.desktop"), desktop_content);
        let _ = std::fs::write(apps_dir.join("auralune-desktop.desktop"), desktop_content);

        // 4. Odśwież pamięć podręczną ikon
        let _ = std::process::Command::new("gtk-update-icon-cache")
            .arg("-f")
            .arg("-t")
            .arg(base_icons)
            .output();
    }

    Ok(())
}

pub fn run() {
    #[cfg(target_os = "linux")]
    {
        glib::set_prgname(Some("auralune"));
        glib::set_application_name("Auralune");

        // Rozwiązanie problemu brakujących wtyczek GStreamer i procesów pomocniczych WebKit2GTK w AppImage
        let host_gst_dirs = [
            "/usr/lib/gstreamer-1.0",
            "/usr/lib64/gstreamer-1.0",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
            "/usr/local/lib/gstreamer-1.0",
        ];
        let mut valid_gst_dirs = Vec::new();
        for dir in &host_gst_dirs {
            if std::path::Path::new(dir).is_dir() {
                valid_gst_dirs.push(*dir);
            }
        }
        if !valid_gst_dirs.is_empty() {
            let joined = valid_gst_dirs.join(":");
            if let Ok(current) = std::env::var("GST_PLUGIN_SYSTEM_PATH_1_0") {
                if !current.contains("/gstreamer-1.0") {
                    std::env::set_var(
                        "GST_PLUGIN_SYSTEM_PATH_1_0",
                        format!("{}:{}", current, joined),
                    );
                }
            } else {
                std::env::set_var("GST_PLUGIN_SYSTEM_PATH_1_0", &joined);
            }

            if let Ok(current) = std::env::var("GST_PLUGIN_PATH_1_0") {
                if !current.contains("/gstreamer-1.0") {
                    std::env::set_var("GST_PLUGIN_PATH_1_0", format!("{}:{}", current, joined));
                }
            } else {
                std::env::set_var("GST_PLUGIN_PATH_1_0", &joined);
            }

            if let Ok(current) = std::env::var("GST_PLUGIN_PATH") {
                if !current.contains("/gstreamer-1.0") {
                    std::env::set_var("GST_PLUGIN_PATH", format!("{}:{}", current, joined));
                }
            } else {
                std::env::set_var("GST_PLUGIN_PATH", &joined);
            }
        }

        // gst-plugin-scanner
        if std::env::var("GST_PLUGIN_SCANNER").is_err() {
            let scanner_paths = [
                "/usr/lib/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib64/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-plugin-scanner",
                "/usr/libexec/gstreamer-1.0/gst-plugin-scanner",
            ];
            for scanner in &scanner_paths {
                if std::path::Path::new(scanner).is_file() {
                    std::env::set_var("GST_PLUGIN_SCANNER", scanner);
                    break;
                }
            }
        }

        // WebKit2GTK procesy pomocnicze (WebKitNetworkProcess, WebKitWebProcess)
        // W AppImage linuxdeploy ustawia GTK_EXE_PREFIX na zasoby wewnątrz AppDir, przez co WebKit nie znajduje procesów potomnych
        if std::env::var("WEBKIT_EXEC_PATH").is_err() {
            let webkit_paths = [
                "/usr/lib/webkit2gtk-4.1",
                "/usr/lib64/webkit2gtk-4.1",
                "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1",
                "/usr/libexec/webkit2gtk-4.1",
            ];
            for wp in &webkit_paths {
                if std::path::Path::new(wp).is_dir() {
                    std::env::set_var("WEBKIT_EXEC_PATH", wp);
                    break;
                }
            }
        }
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let rt = Arc::new(tokio::runtime::Runtime::new().expect("Błąd tworzenia runtime tokio"));

    let engine = match AudioEngine::new() {
        Ok(e) => Arc::new(e),
        Err(err) => {
            error!("Nie udało się zainicjalizować silnika audio: {:?}", err);
            panic!("Krytyczny błąd silnika audio: {:?}", err);
        }
    };

    tauri::Builder::default()
        .setup({
            let rt = rt.clone();
            let engine = engine.clone();
            move |app| {
                let data_dir = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| PathBuf::from("."));
                let _ = fs::create_dir_all(&data_dir);
                let db_path = data_dir.join("auralune_library.db");
                let cache_dir = data_dir.join("cache");

                let db = rt.block_on(async {
                    Database::open(&db_path)
                        .await
                        .expect("Błąd otwarcia bazy SQLite")
                });

                // Przywrócenie ostatniego stanu kolejki odtwarzania z bazy danych
                if let Ok(Some(saved_queue)) = rt.block_on(async { db.load_queue_state().await }) {
                    info!(
                        "Wczytano zapisany stan kolejki ({} utworów)",
                        saved_queue.items.len()
                    );
                    let loop_mode = saved_queue.loop_mode;
                    let shuffle = saved_queue.shuffle;
                    let items = saved_queue.items;
                    let current_index = saved_queue.current_index;
                    let _ = engine.set_queue(items, current_index);
                    engine.set_loop_mode(loop_mode);
                    engine.set_shuffle(shuffle);
                    let _ = engine.pause();
                }

                let scanner = LibraryScanner::new(&cache_dir);
                let mb = Arc::new(MusicBrainzClient::new());
                let cover_archive = Arc::new(CoverArtArchiveClient::new(&cache_dir));

                let mpris = rt.block_on(async {
                    match desktop_integration::MprisController::start(engine.clone()).await {
                        Ok(controller) => {
                            info!("Zainicjalizowano serwis MPRIS D-Bus: org.mpris.MediaPlayer2.auralune");
                            Some(Arc::new(controller))
                        }
                        Err(e) => {
                            tracing::warn!("MPRIS D-Bus niedostępny w tej sesji: {}", e);
                            None
                        }
                    }
                });

                // Sprawdź czy korektor graficzny EQ ma być automatycznie włączony przy starcie
                let eq_startup = rt.block_on(async {
                    db.get_app_setting("eq_enabled_on_startup").await.unwrap_or(None)
                });
                if let Some(val) = eq_startup {
                    let enabled = val == "true";
                    engine.set_equalizer_enabled(enabled);
                } else {
                    engine.set_equalizer_enabled(false);
                }

                // Sprawdź czy ustawienia DSP mają być automatycznie przywracane przy starcie
                let dsp_startup = rt.block_on(async {
                    db.get_app_setting("dsp_restore_on_startup").await.unwrap_or(None)
                });
                if dsp_startup.as_deref() == Some("true") {
                    if let Some(saved_json) = rt.block_on(async {
                        db.get_app_setting("dsp_saved_settings").await.unwrap_or(None)
                    }) {
                        #[derive(serde::Deserialize)]
                        struct SavedDsp {
                            engine: String,
                            pitch_semitones: f64,
                            tempo_ratio: f64,
                            rate_ratio: f64,
                        }
                        if let Ok(saved) = serde_json::from_str::<SavedDsp>(&saved_json) {
                            let target_engine = match saved.engine.as_str() {
                                "Bypass" => DspEngine::Bypass,
                                "SoundTouch" => DspEngine::SoundTouch,
                                _ => DspEngine::RubberBand,
                            };
                            let _ = engine.set_dsp_engine(target_engine);
                            if let Ok(params) = DspParams::new(
                                target_engine,
                                saved.pitch_semitones,
                                saved.tempo_ratio,
                                saved.rate_ratio,
                            ) {
                                let _ = engine.set_dsp_params(params);
                            }
                            tracing::info!(
                                "Przywrócono zapisane ustawienia DSP przy starcie: {:?}, pitch={}, tempo={}, rate={}",
                                target_engine,
                                saved.pitch_semitones,
                                saved.tempo_ratio,
                                saved.rate_ratio
                            );
                        }
                    }
                }

                // Wczytanie wybranego stylu ikony aplikacji (domyślnie: lineout dopasowany do motywu)
                let icon_style = rt.block_on(async {
                    db.get_app_setting("app_icon_style").await.unwrap_or(None)
                }).unwrap_or_else(|| "lineout".to_string());

                let discord_enabled = rt.block_on(async {
                    db.get_app_setting("discord_rpc_enabled").await.unwrap_or(None)
                }).map(|v| v == "true").unwrap_or(true);

                let discord_client_id = rt.block_on(async {
                    db.get_app_setting("discord_rpc_client_id").await.unwrap_or(None)
                });

                let discord_rpc = Some(desktop_integration::DiscordRpcController::start(
                    Some(rt.handle()),
                    discord_enabled,
                    discord_client_id,
                ));


                let app_state = AppState {
                    engine,
                    db: Arc::new(db),
                    scanner: Arc::new(scanner),
                    rt,
                    mpris,
                    discord_rpc,
                    mb,
                    cover_archive,
                    listenbrainz: Arc::new(ListenBrainzClient::new()),
                    lastfm: Arc::new(LastFmClient::new()),
                    downloads: Arc::new(DownloadManager::new()),
                    latest_spectrum: Arc::new(Mutex::new(vec![0.0f32; 16])),
                    discord_cover_cache: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
                };

                app.manage(app_state);


                // Aplikacja wybranego stylu ikony aplikacji
                let _ = update_system_icons(app.handle(), &icon_style);

                // Inicjalizacja zasobnika systemowego (System Tray) na pulpicie Linuksa
                let show_i = tauri::menu::MenuItem::with_id(app, "tray_show", "🌸 Pokaż Auralune / Show Window", true, None::<&str>)?;
                let play_i = tauri::menu::MenuItem::with_id(app, "tray_play_pause", "⏯️ Odtwórz / Wstrzymaj (Play/Pause)", true, None::<&str>)?;
                let next_i = tauri::menu::MenuItem::with_id(app, "tray_next", "⏭️ Następny utwór / Next", true, None::<&str>)?;
                let prev_i = tauri::menu::MenuItem::with_id(app, "tray_prev", "⏮️ Poprzedni utwór / Previous", true, None::<&str>)?;
                let quit_i = tauri::menu::MenuItem::with_id(app, "tray_quit", "🚪 Zakończ / Quit", true, None::<&str>)?;
                let tray_menu = tauri::menu::Menu::with_items(app, &[&show_i, &play_i, &next_i, &prev_i, &quit_i])?;

                if let Some(default_icon) = app.default_window_icon() {
                    let _ = tauri::tray::TrayIconBuilder::new()
                        .icon(default_icon.clone())
                        .tooltip("Auralune — Kitsune Music Player")
                        .menu(&tray_menu)
                        .show_menu_on_left_click(false)
                        .on_menu_event(|app, event| {
                            match event.id.as_ref() {
                                "tray_show" => {
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.unminimize();
                                        let _ = window.set_focus();
                                    }
                                }
                                "tray_play_pause" => {
                                    let state = app.state::<AppState>();
                                    if state.engine.state() == domain::PlaybackState::Playing {
                                        let _ = state.engine.pause();
                                    } else {
                                        let _ = state.engine.play();
                                    }
                                }
                                "tray_next" => {
                                    let state = app.state::<AppState>();
                                    let _ = state.engine.play_next();
                                }
                                "tray_prev" => {
                                    let state = app.state::<AppState>();
                                    let _ = state.engine.play_previous();
                                }
                                "tray_quit" => {
                                    app.exit(0);
                                }
                                _ => {}
                            }
                        })
                        .on_tray_icon_event(|tray, event| {
                            if let tauri::tray::TrayIconEvent::Click {
                                button: tauri::tray::MouseButton::Left,
                                button_state: tauri::tray::MouseButtonState::Up,
                                ..
                            } = event {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.unminimize();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        })
                        .build(app);
                }

                // Obsługa minimalizacji do zasobnika systemowego przy zamykaniu okna
                if let Some(main_window) = app.get_webview_window("main") {
                    let main_window_clone = main_window.clone();
                    let app_handle = app.handle().clone();
                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            let state = app_handle.state::<AppState>();
                            let close_to_tray = state
                                .rt
                                .block_on(async {
                                    state
                                        .db
                                        .get_app_setting("close_to_tray")
                                        .await
                                        .unwrap_or(None)
                                })
                                .unwrap_or_else(|| "true".to_string());

                            if close_to_tray == "true" {
                                api.prevent_close();
                                let _ = main_window_clone.hide();
                            }
                        }
                    });
                }

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_file,
            play,
            pause,
            stop,
            seek,
            set_pitch,
            set_pitch_semitones,
            set_tempo,
            set_tempo_ratio,
            set_rate,
            set_rate_ratio,
            reset_dsp,
            set_dsp_engine,
            get_dsp_capabilities,
            save_dsp_preset,
            list_dsp_presets,
            load_dsp_preset,
            set_volume,
            get_status,
            set_equalizer_band,
            set_equalizer_bands,
            set_equalizer_enabled,
            get_equalizer_presets,
            get_replaygain_config,
            set_replaygain_config,
            get_replaygain_status,
            apply_auto_replaygain,
            get_crossfeed_config,
            set_crossfeed_config,
            get_silence_trimming_config,
            set_silence_trimming_config,
            scan_track_replaygain,
            scan_library_replaygain,
            list_devices,
            set_device_profile,
            set_bluetooth_codec,
            enable_pro_audio,
            disable_pro_audio,
            set_card_profile,
            save_lyrics_lrc,
            get_app_setting,
            set_app_setting,
            transcode_file,
            scan_library,
            scan_paths,
            pick_folder,
            pick_files,
            pick_image_file,
            pick_single_audio_file,
            pick_save_destination,
            pick_custom_file,
            open_containing_folder,
            open_external_url,
            get_app_version,
            get_library_tracks,
            get_library_albums,
            get_library_artists,
            save_bookmark,
            get_bookmark,
            delete_bookmark,
            update_mpris_metadata,
            list_themes,
            get_active_theme,
            set_active_theme,
            save_theme,
            update_theme_background,
            export_theme_json,
            import_theme_json,
            upload_background_image,
            search_musicbrainz_releases,
            fetch_and_apply_cover,
            auto_fetch_album_cover,
            search_cover_candidates,
            apply_cover_url,
            apply_custom_cover_file,
            apply_custom_cover_data,
            get_track_cover,
            get_queue,
            set_queue,
            add_to_queue,
            add_uris_to_queue,
            add_next_to_queue,
            remove_from_queue,
            reorder_queue,
            clear_queue,
            play_queue_index,
            play_next,
            play_previous,
            set_loop_mode,
            toggle_shuffle,
            create_playlist,
            delete_playlist,
            list_playlists,
            add_track_to_playlist,
            remove_track_from_playlist,
            get_playlist_tracks,
            get_lyrics,
            set_mini_player_mode,
            toggle_favorite,
            record_track_play,
            record_track_listening,
            get_recap_summary,
            reset_track_plays,
            set_reverb_params,
            get_favorite_tracks,
            get_recently_played_tracks,
            get_top_played_tracks,
            get_hires_tracks,
            set_app_icon_style,
            get_app_icon_style,
            detect_track_key_bpm,
            save_track_key_bpm,
            set_track_rating,
            get_track_metadata,
            update_track_metadata,
            parse_cue_sheet_content,
            list_smart_playlist_tracks,
            show_desktop_notification,
            export_playlist_m3u8,
            import_playlist_m3u8,
            export_profile_backup,
            import_profile_backup,
            validate_listenbrainz_token,
            submit_listenbrainz_playing_now,
            submit_listenbrainz_listen,
            add_download_job,
            cancel_download_job,
            list_download_jobs,
            set_stereo_widener,
            get_stereo_widener,
            set_limiter_enabled,
            is_limiter_enabled,
            set_crossfade_duration,
            get_crossfade_duration,
            get_default_music_dir,
            get_discord_rpc_status,
            set_discord_rpc_enabled,
            set_discord_rpc_client_id,
            get_track_bookmarks,
            add_track_bookmark,
            update_track_bookmark,
            delete_track_bookmark,
            find_duplicate_tracks,
            delete_track_record,
            preview_rename_tracks,
            execute_rename_tracks,
            lastfm_get_auth_url,
            lastfm_fetch_session,
            lastfm_validate_session,
            lastfm_update_now_playing,
            lastfm_scrobble,
        ])
        .run(tauri::generate_context!())
        .expect("Błąd podczas uruchamiania aplikacji Tauri");
}
