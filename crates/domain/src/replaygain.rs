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
    /// Preamp for files WITH ReplayGain tags, in dB (-12.0 to +12.0), added to their tag gain.
    pub pre_amp_db: f64,
    /// Preamp for files WITHOUT ReplayGain tags, in dB (-15.0 to +15.0): the total gain such
    /// a file gets, independent of `pre_amp_db` (see [`ReplayGainConfig::rgvolume_params`]).
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

/// Range of the preamp for files with ReplayGain tags.
pub const TAGGED_PREAMP_MIN_DB: f64 = -12.0;
pub const TAGGED_PREAMP_MAX_DB: f64 = 12.0;
/// Range of the preamp for files without ReplayGain tags.
pub const UNTAGGED_PREAMP_MIN_DB: f64 = -15.0;
pub const UNTAGGED_PREAMP_MAX_DB: f64 = 15.0;

/// Property values for GStreamer's `rgvolume` element.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RgVolumeParams {
    pub pre_amp_db: f64,
    pub fallback_gain_db: f64,
    pub headroom_db: f64,
}

impl ReplayGainConfig {
    /// Maps the two user-facing preamps onto `rgvolume` properties.
    ///
    /// `rgvolume` adds `pre-amp` to untagged files too (`fallback-gain + pre-amp`), and caps a
    /// positive total on them at `headroom` because they carry no peak. So:
    /// `pre-amp = tagged`, `fallback-gain = untagged - tagged`, `headroom = max(0, untagged)`,
    /// which makes an untagged file get exactly the untagged preamp, boosts included.
    pub fn rgvolume_params(&self) -> RgVolumeParams {
        let tagged = self
            .pre_amp_db
            .clamp(TAGGED_PREAMP_MIN_DB, TAGGED_PREAMP_MAX_DB);
        let untagged = self
            .fallback_gain_db
            .clamp(UNTAGGED_PREAMP_MIN_DB, UNTAGGED_PREAMP_MAX_DB);
        RgVolumeParams {
            pre_amp_db: tagged,
            fallback_gain_db: untagged - tagged,
            headroom_db: untagged.max(0.0),
        }
    }
}
