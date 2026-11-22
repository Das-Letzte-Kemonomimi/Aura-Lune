use super::error::CommandError;
use crate::commands::playback::{get_status_internal, PlaybackStatusDto};
use crate::AppState;
use audio_engine::{
    analyze_track_replaygain, write_replaygain_tags_to_file, ReplayGainAnalysisResult,
};
use domain::crossfeed::CrossfeedConfig;
use domain::equalizer::EqualizerPreset;
use domain::replaygain::ReplayGainConfig;
use domain::silence::SilenceTrimmingConfig;
use domain::{DynamicsPreset, DynamicsState, ParametricEqPreset, ParametricEqState};
use dsp_api::{DspEngine, DspParams};
use serde::{Deserialize, Serialize};
use storage::DspPresetRecord;
use tauri::State;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayGainScanSummaryDto {
    pub total_tracks: usize,
    pub scanned: usize,
    pub errors: usize,
}

// ----------------------------------------------------------------------------
// Internal Helpers
// ----------------------------------------------------------------------------

/// Internal helper for pitch shift adjustment in semitones (-24.0 to +24.0).
pub fn set_pitch_internal(state: &AppState, semitones: f64) -> Result<(), CommandError> {
    let clamped = semitones.clamp(-24.0, 24.0);
    state
        .engine
        .set_pitch_semitones(clamped)
        .map_err(CommandError::from)
}

/// Internal helper for tempo ratio adjustment (0.15 to 4.0).
pub fn set_tempo_internal(
    state: &AppState,
    tempo_ratio: Option<f64>,
    ratio: Option<f64>,
) -> Result<(), CommandError> {
    let r = tempo_ratio.or(ratio).unwrap_or(1.0).clamp(0.15, 4.0);
    state.engine.set_tempo_ratio(r).map_err(CommandError::from)
}

/// Internal helper for playback rate adjustment (0.25 to 3.0).
pub fn set_rate_internal(
    state: &AppState,
    rate_ratio: Option<f64>,
    rate: Option<f64>,
) -> Result<(), CommandError> {
    let r = rate_ratio.or(rate).unwrap_or(1.0).clamp(0.25, 3.0);
    state.engine.set_rate_ratio(r).map_err(CommandError::from)
}

/// Sets active DSP engine (Bypass, RubberBand, SoundTouch) with parameter preservation.
pub fn set_dsp_engine_internal(state: &AppState, engine_str: &str) -> Result<(), CommandError> {
    let engine = DspEngine::from_name(engine_str);
    state
        .engine
        .set_dsp_engine(engine)
        .map_err(CommandError::from)
}

/// Sets a single band of the 10-band graphic equalizer.
pub fn set_equalizer_band_internal(
    state: &AppState,
    band: usize,
    gain_db: f64,
) -> Result<(), CommandError> {
    if band >= 10 {
        return Err(format!("Numer pasma {} jest nieprawidłowy (dozwolone 0-9)", band).into());
    }
    let clamped = gain_db.clamp(-24.0, 24.0);
    state
        .engine
        .set_equalizer_band(band, clamped)
        .map_err(CommandError::from)
}

/// Sets all 10 bands of the graphic equalizer.
pub fn set_equalizer_bands_internal(
    state: &AppState,
    bands: &[f64; 10],
) -> Result<(), CommandError> {
    let mut clamped = [0.0; 10];
    for (i, &g) in bands.iter().enumerate() {
        clamped[i] = g.clamp(-24.0, 24.0);
    }
    state
        .engine
        .set_equalizer_bands(&clamped)
        .map_err(CommandError::from)
}

/// Toggles graphic equalizer processing.
pub fn set_equalizer_enabled_internal(state: &AppState, enabled: bool) -> Result<(), CommandError> {
    state.engine.set_equalizer_enabled(enabled);
    Ok(())
}

/// Sets graphic equalizer pre-amp gain in dB.
pub fn set_equalizer_preamp_internal(state: &AppState, preamp_db: f64) -> Result<(), CommandError> {
    let clamped = preamp_db.clamp(-24.0, 24.0);
    state.engine.set_equalizer_preamp(clamped);
    Ok(())
}

/// Applies an AutoEQ profile with pre-amp attenuation.
pub fn apply_auto_eq_profile_internal(
    state: &AppState,
    profile_name: &str,
    bands: &[f64; 10],
    preamp_db: f64,
) -> Result<(), CommandError> {
    info!(
        "Applying AutoEQ profile '{}' with preamp {} dB",
        profile_name, preamp_db
    );
    set_equalizer_bands_internal(state, bands)?;
    set_equalizer_preamp_internal(state, preamp_db)?;
    set_equalizer_enabled_internal(state, true)?;
    Ok(())
}

/// Returns default factory equalizer presets.
pub fn get_equalizer_presets_internal() -> Vec<EqualizerPreset> {
    EqualizerPreset::default_presets()
}

/// Returns current parametric equalizer state.
pub fn get_parametric_eq_state_internal(state: &AppState) -> ParametricEqState {
    state.engine.get_parametric_eq_state()
}

/// Updates parametric equalizer state.
pub fn set_parametric_eq_state_internal(
    state: &AppState,
    eq_state: &ParametricEqState,
) -> Result<(), CommandError> {
    state
        .engine
        .set_parametric_eq_state(eq_state)
        .map_err(CommandError::from)
}

// ----------------------------------------------------------------------------
// Tauri Command Handlers
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn set_pitch(semitones: f64, state: State<'_, AppState>) -> Result<(), CommandError> {
    set_pitch_internal(&state, semitones)
}

#[tauri::command]
pub fn set_tempo(
    tempo_ratio: Option<f64>,
    ratio: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_tempo_internal(&state, tempo_ratio, ratio)
}

#[tauri::command]
pub fn set_rate(
    rate_ratio: Option<f64>,
    rate: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_rate_internal(&state, rate_ratio, rate)
}

#[tauri::command]
pub fn set_dsp_params(
    engine: Option<String>,
    pitch_semitones: Option<f64>,
    tempo_ratio: Option<f64>,
    rate_ratio: Option<f64>,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, CommandError> {
    let current = state.engine.dsp_params();
    let target_engine = if let Some(ref eng_str) = engine {
        DspEngine::from_name(eng_str)
    } else {
        current.engine
    };

    let target_pitch = pitch_semitones.unwrap_or(current.pitch_semitones);
    let target_tempo = tempo_ratio.unwrap_or(current.tempo_ratio);
    let target_rate = rate_ratio.unwrap_or(current.rate_ratio);

    state.engine.set_dsp_engine(target_engine)?;

    let params = DspParams::new(target_engine, target_pitch, target_tempo, target_rate)?;

    state.engine.set_dsp_params(params)?;

    Ok(get_status_internal(&state))
}

#[tauri::command]
pub fn reset_dsp(state: State<'_, AppState>) -> Result<PlaybackStatusDto, CommandError> {
    let current = state.engine.dsp_params();
    let reset_params = DspParams::new(current.engine, 0.0, 1.0, 1.0)?;
    state.engine.set_dsp_params(reset_params)?;
    Ok(get_status_internal(&state))
}

#[tauri::command]
pub fn set_reverb_params(
    enabled: bool,
    room_size: Option<f64>,
    damping: Option<f64>,
    width: Option<f64>,
    level: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
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
pub fn set_stereo_widener(
    active: bool,
    amount: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
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
pub fn set_limiter_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), CommandError> {
    info!("Tauri command: set_limiter_enabled({})", enabled);
    state.engine.set_limiter_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub fn set_crossfade_duration(
    duration_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: set_crossfade_duration({} ms)", duration_ms);
    state.engine.set_crossfade_duration_ms(duration_ms);
    Ok(())
}

#[tauri::command]
pub fn set_dsp_engine(
    engine: DspEngine,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, CommandError> {
    info!("Tauri command: set_dsp_engine({:?})", engine);
    state.engine.set_dsp_engine(engine)?;
    Ok(get_status_internal(&state))
}

#[tauri::command]
pub fn set_audio_buffer_duration_ms(
    buffer_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!(
        "Tauri command: set_audio_buffer_duration_ms({} ms)",
        buffer_ms
    );
    state.engine.set_audio_buffer_duration_ms(buffer_ms)?;
    let db = state.db.clone();
    state.rt.spawn(async move {
        let _ = db
            .set_app_setting("audio_buffer_ms", &buffer_ms.to_string())
            .await;
    });
    Ok(())
}

#[tauri::command]
pub fn get_audio_buffer_duration_ms(state: State<'_, AppState>) -> Result<u64, CommandError> {
    Ok(state.engine.audio_buffer_duration_ms())
}

#[tauri::command]
pub fn set_dsp_block_size(
    block_size: usize,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: set_dsp_block_size({} ramek)", block_size);
    state.engine.set_dsp_block_size(block_size)?;
    let db = state.db.clone();
    state.rt.spawn(async move {
        let _ = db
            .set_app_setting("dsp_block_size", &block_size.to_string())
            .await;
    });
    Ok(())
}

#[tauri::command]
pub fn get_dsp_block_size(state: State<'_, AppState>) -> Result<usize, CommandError> {
    Ok(state.engine.dsp_block_size())
}

#[tauri::command]
pub async fn save_dsp_preset(
    name: String,
    state: State<'_, AppState>,
) -> Result<i64, CommandError> {
    let dsp = state.engine.dsp_params();
    let engine_str = dsp.engine.as_str();

    state
        .db
        .save_dsp_preset(
            &name,
            engine_str,
            dsp.pitch_semitones,
            dsp.tempo_ratio,
            dsp.rate_ratio,
        )
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_dsp_presets(
    state: State<'_, AppState>,
) -> Result<Vec<DspPresetRecord>, CommandError> {
    state
        .db
        .list_dsp_presets()
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn load_dsp_preset(
    preset: DspPresetRecord,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, CommandError> {
    let engine = DspEngine::from_name(&preset.engine);

    let params = DspParams::new(
        engine,
        preset.pitch_semitones,
        preset.tempo_ratio,
        preset.rate_ratio,
    )?;

    state.engine.set_dsp_params(params)?;
    Ok(get_status_internal(&state))
}

#[tauri::command]
pub fn set_equalizer_band(
    band: usize,
    gain_db: f64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_equalizer_band_internal(&state, band, gain_db)
}

#[tauri::command]
pub fn set_equalizer_bands(
    bands: [f64; 10],
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_equalizer_bands_internal(&state, &bands)
}

#[tauri::command]
pub fn set_equalizer_enabled(
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_equalizer_enabled_internal(&state, enabled)
}

#[tauri::command]
pub fn set_equalizer_params(
    enabled: bool,
    bands: Option<Vec<f64>>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_equalizer_enabled_internal(&state, enabled)?;
    if let Some(b) = bands {
        if b.len() == 10 {
            let mut arr = [0.0; 10];
            arr.copy_from_slice(&b);
            set_equalizer_bands_internal(&state, &arr)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_equalizer_preamp(
    preamp_db: f64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_equalizer_preamp_internal(&state, preamp_db)
}

#[tauri::command]
pub fn apply_auto_eq_profile(
    profile_name: String,
    bands: [f64; 10],
    preamp_db: f64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    apply_auto_eq_profile_internal(&state, &profile_name, &bands, preamp_db)
}

#[tauri::command]
pub fn get_equalizer_presets() -> Vec<EqualizerPreset> {
    get_equalizer_presets_internal()
}

#[tauri::command]
pub fn get_parametric_eq_state(state: State<'_, AppState>) -> ParametricEqState {
    get_parametric_eq_state_internal(&state)
}

#[tauri::command]
pub fn set_parametric_eq_state(
    eq_state: ParametricEqState,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_parametric_eq_state_internal(&state, &eq_state)
}

#[tauri::command]
pub fn get_parametric_eq_presets() -> Vec<ParametricEqPreset> {
    ParametricEqPreset::default_presets()
}

#[tauri::command]
pub fn parse_equalizer_apo_config(text: String) -> Result<ParametricEqState, CommandError> {
    ParametricEqState::parse_equalizer_apo(&text).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_dynamics_state(state: State<'_, AppState>) -> DynamicsState {
    state.engine.get_dynamics_state()
}

#[tauri::command]
pub fn set_dynamics_state(
    dynamics_state: DynamicsState,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!(
        "Tauri command: set_dynamics_state(comp={}, sat={}, lim={})",
        dynamics_state.compressor.enabled,
        dynamics_state.saturator.enabled,
        dynamics_state.limiter.enabled
    );
    state
        .engine
        .set_dynamics_state(&dynamics_state)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_dynamics_presets() -> Vec<DynamicsPreset> {
    DynamicsPreset::default_presets()
}

#[tauri::command]
pub fn set_replaygain_config(
    config: ReplayGainConfig,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: set_replaygain_config({:?})", config);
    state
        .engine
        .set_replaygain(config)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn apply_auto_replaygain(is_same_album: bool, is_shuffle: bool, state: State<'_, AppState>) {
    state
        .engine
        .apply_auto_replaygain(is_same_album, is_shuffle);
}

#[tauri::command]
pub fn set_crossfeed_config(
    config: CrossfeedConfig,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: set_crossfeed_config({:?})", config);
    state
        .engine
        .set_crossfeed(config)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn set_silence_trimming_config(
    config: SilenceTrimmingConfig,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    info!("Tauri command: set_silence_trimming_config({:?})", config);
    state
        .engine
        .set_silence_trimming(config)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn scan_track_replaygain(
    track_id: i64,
    write_tags: bool,
    state: State<'_, AppState>,
) -> Result<ReplayGainAnalysisResult, CommandError> {
    info!(
        "Tauri command: scan_track_replaygain(track_id={}, write_tags={})",
        track_id, write_tags
    );
    let track = state
        .db
        .get_track_by_id(track_id)
        .await?
        .ok_or_else(|| format!("Nie znaleziono utworu o ID {}", track_id))?;

    let result = analyze_track_replaygain(&track.path)?;

    // Zapis do bazy danych SQLite
    let gain = result.track_gain_db;
    let peak = result.track_peak;
    state
        .db
        .update_track_replaygain(track_id, gain, peak)
        .await?;

    // Opcjonalny zapis tagów do pliku
    if write_tags {
        if let Err(e) = write_replaygain_tags_to_file(&track.path, gain, peak) {
            warn!(
                "Nie udało się zapisać tagów ReplayGain do {}: {}",
                track.path, e
            );
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn scan_library_replaygain(
    write_tags: bool,
    state: State<'_, AppState>,
) -> Result<ReplayGainScanSummaryDto, CommandError> {
    info!(
        "Tauri command: scan_library_replaygain(write_tags={})",
        write_tags
    );
    let tracks = state.db.list_tracks().await?;

    let total_tracks = tracks.len();
    let mut scanned = 0;
    let mut errors = 0;

    for track in tracks {
        match analyze_track_replaygain(&track.path) {
            Ok(res) => {
                let tid = track.id;
                let g = res.track_gain_db;
                let p = res.track_peak;
                let _ = state.db.update_track_replaygain(tid, g, p).await;
                if write_tags {
                    let _ = write_replaygain_tags_to_file(&track.path, g, p);
                }
                scanned += 1;
            }
            Err(err) => {
                warn!("Błąd analizy ReplayGain dla {}: {}", track.path, err);
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
