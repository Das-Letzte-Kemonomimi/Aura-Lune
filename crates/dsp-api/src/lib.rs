//! Shared DSP contract, parameter models and math conversions.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// DSP operation errors.
#[derive(Debug, Error, PartialEq)]
pub enum DspError {
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
    #[error("Audio format configuration error: {0}")]
    FormatError(String),
    #[error("Internal error in processor {engine}: {message}")]
    Internal {
        engine: &'static str,
        message: String,
    },
}

/// DSP engines available for pitch and tempo changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum DspEngine {
    #[default]
    Bypass,
    RubberBand,
    SoundTouch,
}

impl DspEngine {
    /// Name stored in settings and presets and sent to the UI.
    pub fn as_str(self) -> &'static str {
        match self {
            DspEngine::Bypass => "Bypass",
            DspEngine::RubberBand => "RubberBand",
            DspEngine::SoundTouch => "SoundTouch",
        }
    }

    /// Case-insensitive name lookup; an unknown name means `Bypass`.
    pub fn from_name(name: &str) -> Self {
        if name.eq_ignore_ascii_case("RubberBand") {
            DspEngine::RubberBand
        } else if name.eq_ignore_ascii_case("SoundTouch") {
            DspEngine::SoundTouch
        } else {
            DspEngine::Bypass
        }
    }
}

impl std::fmt::Display for DspEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Capabilities and limits of the selected DSP engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DspCapabilities {
    pub engine: DspEngine,
    pub name: String,
    pub min_pitch_semitones: f64,
    pub max_pitch_semitones: f64,
    pub min_tempo_ratio: f64,
    pub max_tempo_ratio: f64,
    pub supports_formants: bool,
    pub description: String,
}

impl DspEngine {
    pub fn capabilities(&self) -> DspCapabilities {
        match self {
            DspEngine::Bypass => DspCapabilities {
                engine: *self,
                name: "Direct Bypass (No DSP)".to_string(),
                min_pitch_semitones: -24.0,
                max_pitch_semitones: 24.0,
                min_tempo_ratio: 0.15,
                max_tempo_ratio: 4.0,
                supports_formants: false,
                description:
                    "Bit-perfect direct stream without DSP (zero CPU overhead)".to_string(),
            },
            DspEngine::RubberBand => DspCapabilities {
                engine: *self,
                name: "Rubber Band".to_string(),
                min_pitch_semitones: -24.0,
                max_pitch_semitones: 24.0,
                min_tempo_ratio: 0.15,
                max_tempo_ratio: 4.0,
                supports_formants: true,
                description:
                    "Precise Rubber Band R3 engine (as in Music Speed Changer, clean tempo down to 15%, transients)".to_string(),
            },
            DspEngine::SoundTouch => DspCapabilities {
                engine: *self,
                name: "SoundTouch".to_string(),
                min_pitch_semitones: -12.0,
                max_pitch_semitones: 12.0,
                min_tempo_ratio: 0.5,
                max_tempo_ratio: 2.0,
                supports_formants: false,
                description:
                    "Lightweight SoundTouch engine (low CPU overhead)".to_string(),
            },
        }
    }
}

/// Audio stream format for the DSP processor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AudioFormat {
    pub sample_rate: u32,
    pub channels: u32,
}

impl AudioFormat {
    pub fn new(sample_rate: u32, channels: u32) -> Result<Self, DspError> {
        if sample_rate == 0 {
            return Err(DspError::FormatError("Sample rate must be > 0".to_string()));
        }
        if channels == 0 || channels > 16 {
            return Err(DspError::FormatError(
                "Channel count must be within 1..=16".to_string(),
            ));
        }
        Ok(Self {
            sample_rate,
            channels,
        })
    }
}

/// DSP processing parameters.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct DspParams {
    /// Silnik DSP.
    pub engine: DspEngine,
    /// Pitch in semitones (0.0 = no change, e.g. -12.0 to +12.0).
    pub pitch_semitones: f64,
    /// Tempo multiplier (1.0 = normal length, 0.5 = 2x slower, 2.0 = 2x faster).
    pub tempo_ratio: f64,
    /// Rate multiplier (tempo and pitch change together, 1.0 = normal).
    pub rate_ratio: f64,
}

impl Default for DspParams {
    fn default() -> Self {
        Self {
            engine: DspEngine::default(),
            pitch_semitones: 0.0,
            tempo_ratio: 1.0,
            rate_ratio: 1.0,
        }
    }
}

impl DspParams {
    pub fn new(
        engine: DspEngine,
        pitch_semitones: f64,
        tempo_ratio: f64,
        rate_ratio: f64,
    ) -> Result<Self, DspError> {
        let params = Self {
            engine,
            pitch_semitones,
            tempo_ratio,
            rate_ratio,
        };
        params.validate()?;
        Ok(params)
    }

    /// Validates the parameter ranges.
    pub fn validate(&self) -> Result<(), DspError> {
        if !self.pitch_semitones.is_finite()
            || self.pitch_semitones < -24.0
            || self.pitch_semitones > 24.0
        {
            return Err(DspError::InvalidParameter(format!(
                "pitch_semitones ({}) outside the allowed range [-24.0, 24.0]",
                self.pitch_semitones
            )));
        }
        if !self.tempo_ratio.is_finite() || self.tempo_ratio < 0.15 || self.tempo_ratio > 4.0 {
            return Err(DspError::InvalidParameter(format!(
                "tempo_ratio ({}) outside the allowed range [0.15, 4.0]",
                self.tempo_ratio
            )));
        }
        if !self.rate_ratio.is_finite() || self.rate_ratio < 0.15 || self.rate_ratio > 4.0 {
            return Err(DspError::InvalidParameter(format!(
                "rate_ratio ({}) outside the allowed range [0.15, 4.0]",
                self.rate_ratio
            )));
        }
        Ok(())
    }

    /// Computes the linear pitch multiplier ($2^{semitones / 12}$).
    pub fn pitch_scale(&self) -> f64 {
        semitones_to_pitch_ratio(self.pitch_semitones)
    }

    /// Checks whether the parameters mean no change to the sound (Bypass).
    pub fn is_bypass(&self) -> bool {
        self.engine == DspEngine::Bypass
            || (self.pitch_semitones.abs() < 1e-4
                && (self.tempo_ratio - 1.0).abs() < 1e-4
                && (self.rate_ratio - 1.0).abs() < 1e-4)
    }
}

/// Converts pitch from semitones to a linear multiplier (scale).
///
/// Formula: $scale = 2^{\frac{semitones}{12}}$.
#[inline]
pub fn semitones_to_pitch_ratio(semitones: f64) -> f64 {
    2.0f64.powf(semitones / 12.0)
}

/// Converts a linear pitch multiplier to semitones.
///
/// Formula: $semitones = 12 \cdot \log_2(ratio)$.
#[inline]
pub fn pitch_ratio_to_semitones(ratio: f64) -> f64 {
    12.0 * ratio.log2()
}

/// Converts cents to semitones (100 cents = 1 semitone).
#[inline]
pub fn cents_to_semitones(cents: f64) -> f64 {
    cents / 100.0
}

/// Converts semitones to cents.
#[inline]
pub fn semitones_to_cents(semitones: f64) -> f64 {
    semitones * 100.0
}

/// Status operacji przetwarzania bloku audio.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessStatus {
    /// Output samples were produced.
    Ok,
    /// No output samples (e.g. initial buffering / latency).
    Buffering,
    /// Processing finished (EOS/drain complete).
    Eos,
}

/// Ujednolicony interfejs procesora DSP.
pub trait AudioProcessor: Send {
    /// Returns the engine name.
    fn name(&self) -> &'static str;

    /// Prepares the processor for the given sample format.
    fn prepare(&mut self, format: AudioFormat, max_block_frames: usize) -> Result<(), DspError>;

    /// Updates the DSP parameters on the fly.
    fn set_params(&mut self, params: DspParams) -> Result<(), DspError>;

    /// Processes an input block of interleaved f32 samples into the output buffer.
    fn process(&mut self, input: &[f32], output: &mut Vec<f32>) -> Result<ProcessStatus, DspError>;

    /// Returns the engine latency in frames.
    fn latency_frames(&self) -> usize;

    /// Resets the internal filter state (e.g. after a seek).
    fn reset(&mut self) -> Result<(), DspError>;

    /// Drains the processor's internal buffers at the end of a track (EOS).
    fn drain(&mut self, output: &mut Vec<f32>) -> Result<ProcessStatus, DspError>;
}
