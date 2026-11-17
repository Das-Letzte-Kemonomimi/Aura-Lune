use crate::AppState;
use domain::{EqualizerPreset, ParametricEqState};
use dsp_api::DspEngine;
use tracing::info;

/// Internal helper for pitch shift adjustment in semitones (-24.0 to +24.0).
pub fn set_pitch_internal(state: &AppState, semitones: f64) -> Result<(), String> {
    let clamped = semitones.clamp(-24.0, 24.0);
    state
        .engine
        .set_pitch_semitones(clamped)
        .map_err(|e| e.to_string())
}

/// Internal helper for tempo ratio adjustment (0.15 to 4.0).
pub fn set_tempo_internal(
    state: &AppState,
    tempo_ratio: Option<f64>,
    ratio: Option<f64>,
) -> Result<(), String> {
    let r = tempo_ratio.or(ratio).unwrap_or(1.0).clamp(0.15, 4.0);
    state.engine.set_tempo_ratio(r).map_err(|e| e.to_string())
}

/// Internal helper for playback rate adjustment (0.25 to 3.0).
pub fn set_rate_internal(
    state: &AppState,
    rate_ratio: Option<f64>,
    rate: Option<f64>,
) -> Result<(), String> {
    let r = rate_ratio.or(rate).unwrap_or(1.0).clamp(0.25, 3.0);
    state.engine.set_rate_ratio(r).map_err(|e| e.to_string())
}

/// Sets active DSP engine (Bypass, RubberBand, SoundTouch) with parameter preservation.
pub fn set_dsp_engine_internal(state: &AppState, engine_str: &str) -> Result<(), String> {
    let engine = match engine_str {
        "RubberBand" => DspEngine::RubberBand,
        "SoundTouch" => DspEngine::SoundTouch,
        _ => DspEngine::Bypass,
    };
    state.engine.set_dsp_engine(engine).map_err(|e| e.to_string())
}

/// Sets a single band of the 10-band graphic equalizer.
pub fn set_equalizer_band_internal(state: &AppState, band: usize, gain_db: f64) -> Result<(), String> {
    if band >= 10 {
        return Err(format!("Numer pasma {} jest nieprawidłowy (dozwolone 0-9)", band));
    }
    let clamped = gain_db.clamp(-24.0, 24.0);
    state
        .engine
        .set_equalizer_band(band, clamped)
        .map_err(|e| e.to_string())
}

/// Sets all 10 bands of the graphic equalizer.
pub fn set_equalizer_bands_internal(state: &AppState, bands: &[f64; 10]) -> Result<(), String> {
    let mut clamped = [0.0; 10];
    for (i, &g) in bands.iter().enumerate() {
        clamped[i] = g.clamp(-24.0, 24.0);
    }
    state
        .engine
        .set_equalizer_bands(&clamped)
        .map_err(|e| e.to_string())
}

/// Toggles graphic equalizer processing.
pub fn set_equalizer_enabled_internal(state: &AppState, enabled: bool) -> Result<(), String> {
    state.engine.set_equalizer_enabled(enabled);
    Ok(())
}

/// Sets graphic equalizer pre-amp gain in dB.
pub fn set_equalizer_preamp_internal(state: &AppState, preamp_db: f64) -> Result<(), String> {
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
) -> Result<(), String> {
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
) -> Result<(), String> {
    state
        .engine
        .set_parametric_eq_state(eq_state)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_equalizer_presets_not_empty() {
        let presets = get_equalizer_presets_internal();
        assert!(!presets.is_empty());
        assert!(presets.iter().any(|p| p.name.contains("Flat")));
    }
}
