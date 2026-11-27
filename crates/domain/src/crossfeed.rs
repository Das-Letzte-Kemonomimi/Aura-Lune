use serde::{Deserialize, Serialize};

/// Built-in presets of the Bauer stereophonic-to-binaural filter (bs2b / crossfeed).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum CrossfeedPreset {
    /// Default virtual speaker profile (30° spread, 3 metres away): 700 Hz, 4.5 dB.
    #[default]
    Default,
    /// The popular Chu Moy crossfeed circuit: 700 Hz, 6.0 dB.
    ChuMoy,
    /// Jan Meier CORDA headphone amplifier profile: 650 Hz, 9.0 dB.
    JanMeier,
    /// The user's own parameters.
    Custom,
}

impl CrossfeedPreset {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Default => "Default (30°, 3m — 700 Hz / 4.5 dB)",
            Self::ChuMoy => "Chu Moy (Popular — 700 Hz / 6.0 dB)",
            Self::JanMeier => "Jan Meier Corda (Subtle — 650 Hz / 9.0 dB)",
            Self::Custom => "Custom",
        }
    }
}

/// Crossfeed filter configuration for headphones.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossfeedConfig {
    pub enabled: bool,
    pub preset: CrossfeedPreset,
    /// Low-pass cutoff frequency in Hz (300 Hz - 2000 Hz, default 700 Hz).
    pub fcut_hz: u32,
    /// Channel feed level in 0.1 dB (10 - 150, i.e. 1.0 dB - 15.0 dB, default 45 = 4.5 dB).
    pub feed_tenth_db: u32,
}

impl Default for CrossfeedConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            preset: CrossfeedPreset::Default,
            fcut_hz: 700,
            feed_tenth_db: 45,
        }
    }
}

impl CrossfeedConfig {
    /// Sets the parameters from the selected preset.
    pub fn with_preset(preset: CrossfeedPreset) -> Self {
        let mut cfg = Self::default();
        cfg.apply_preset(preset);
        cfg
    }

    /// Overwrites the frequency and feed with the values of the given preset.
    pub fn apply_preset(&mut self, preset: CrossfeedPreset) {
        self.preset = preset;
        match preset {
            CrossfeedPreset::Default => {
                self.fcut_hz = 700;
                self.feed_tenth_db = 45;
            }
            CrossfeedPreset::ChuMoy => {
                self.fcut_hz = 700;
                self.feed_tenth_db = 60;
            }
            CrossfeedPreset::JanMeier => {
                self.fcut_hz = 650;
                self.feed_tenth_db = 90;
            }
            CrossfeedPreset::Custom => {}
        }
    }

    /// Feed level as a floating-point dB value (e.g. 4.5 dB).
    pub fn feed_db(&self) -> f32 {
        self.feed_tenth_db as f32 / 10.0
    }
}
