use serde::{Deserialize, Serialize};

/// ReplayGain 2.0 / EBU R128 loudness normalisation mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ReplayGainMode {
    /// Normalisation off (Bypass).
    #[default]
    Off,
    /// Per-track loudness matching (Track Gain).
    Track,
    /// Per-album loudness matching (Album Gain): keeps the dynamics between tracks.
    Album,
    /// Smart choice (Auto): Album Gain for a coherent album, Track Gain for shuffle or a mix.
    Auto,
}

impl ReplayGainMode {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Off => "Off",
            Self::Track => "Track (Track Gain)",
            Self::Album => "Album (Album Gain)",
            Self::Auto => "Smart (Auto Track/Album)",
        }
    }
}

/// ReplayGain normalisation configuration.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ReplayGainConfig {
    pub mode: ReplayGainMode,
    /// Extra preamp gain in dB (-12.0 dB to +12.0 dB).
    pub pre_amp_db: f64,
    /// Default gain in dB for tracks without ReplayGain tags (e.g. -6.0 dB).
    pub fallback_gain_db: f64,
    /// Protection against clipping / distortion (ReplayGain limiter).
    pub prevent_clipping: bool,
}

impl Default for ReplayGainConfig {
    fn default() -> Self {
        Self {
            mode: ReplayGainMode::Off,
            pre_amp_db: 0.0,
            fallback_gain_db: -6.0,
            prevent_clipping: true,
        }
    }
}
