use serde::{Deserialize, Serialize};

/// Centre frequencies of the 10-band graphic equaliser bands (in Hz).
pub const EQUALIZER_FREQUENCIES: [u32; 10] = [29, 59, 119, 237, 474, 947, 1889, 3770, 7523, 15011];

/// Band labels shown in the user interface.
pub const EQUALIZER_LABELS: [&str; 10] = [
    "31 Hz", "62 Hz", "125 Hz", "250 Hz", "500 Hz", "1 kHz", "2 kHz", "4 kHz", "8 kHz", "16 kHz",
];

pub const MIN_BAND_GAIN_DB: f64 = -24.0;
pub const MAX_BAND_GAIN_DB: f64 = 12.0;

/// Graphic equaliser state.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EqualizerState {
    pub enabled: bool,
    pub bands: [f64; 10],
}

impl Default for EqualizerState {
    fn default() -> Self {
        Self {
            enabled: false,
            bands: [0.0; 10],
        }
    }
}

impl EqualizerState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Clamps a band gain to the allowed range [-24.0 dB, +12.0 dB].
    pub fn clamp_gain(gain: f64) -> f64 {
        gain.clamp(MIN_BAND_GAIN_DB, MAX_BAND_GAIN_DB)
    }

    /// Sets the gain of the given band.
    pub fn set_band(&mut self, band_idx: usize, gain_db: f64) -> bool {
        if band_idx < 10 {
            self.bands[band_idx] = Self::clamp_gain(gain_db);
            true
        } else {
            false
        }
    }

    /// Resets every band to 0.0 dB (Flat).
    pub fn reset(&mut self) {
        self.bands = [0.0; 10];
    }
}

/// A ready-made equaliser sound profile.
///
/// `id` is the stable kebab-case key the frontend selects and localises by;
/// `name` is the English display text it falls back to.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EqualizerPreset {
    pub id: String,
    pub name: String,
    pub bands: [f64; 10],
}

impl EqualizerPreset {
    pub fn new(id: impl Into<String>, name: impl Into<String>, bands: [f64; 10]) -> Self {
        let mut clamped = [0.0; 10];
        for (i, val) in bands.iter().enumerate() {
            clamped[i] = EqualizerState::clamp_gain(*val);
        }
        Self {
            id: id.into(),
            name: name.into(),
            bands: clamped,
        }
    }

    /// The built-in sound presets.
    pub fn default_presets() -> Vec<Self> {
        vec![
            Self::new("flat", "Flat", [0.0; 10]),
            Self::new(
                "anime-ost",
                "Anime OST / Clear Voice",
                [-1.0, 0.0, 1.0, 2.5, 3.5, 4.0, 3.0, 2.0, 1.5, 2.0],
            ),
            Self::new(
                "bass-boost",
                "Bass Boost",
                [6.0, 5.0, 4.0, 2.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0],
            ),
            Self::new(
                "electronic",
                "Electronic / Dance",
                [5.0, 4.0, 2.0, 0.0, -1.0, 1.5, 3.0, 4.0, 4.5, 4.0],
            ),
            Self::new(
                "rock",
                "Rock",
                [4.5, 3.5, 2.0, 0.5, -0.5, 1.0, 2.5, 3.5, 4.0, 3.5],
            ),
            Self::new(
                "pop",
                "Pop",
                [1.5, 3.0, 4.0, 3.5, 2.0, 0.0, -1.0, 1.0, 2.5, 3.0],
            ),
            Self::new(
                "acoustic",
                "Classical / Acoustic",
                [3.5, 2.5, 1.5, 0.5, 0.0, 0.0, 1.0, 2.0, 2.5, 3.0],
            ),
        ]
    }
}
