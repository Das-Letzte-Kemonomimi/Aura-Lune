use serde::{Deserialize, Serialize};

/// Częstotliwości środkowe pasm 10-pasmowego korektora graficznego (w Hz).
pub const EQUALIZER_FREQUENCIES: [u32; 10] = [29, 59, 119, 237, 474, 947, 1889, 3770, 7523, 15011];

/// Etykiety pasm wyświetlane w interfejsie użytkownika.
pub const EQUALIZER_LABELS: [&str; 10] = [
    "31 Hz", "62 Hz", "125 Hz", "250 Hz", "500 Hz", "1 kHz", "2 kHz", "4 kHz", "8 kHz", "16 kHz",
];

pub const MIN_BAND_GAIN_DB: f64 = -24.0;
pub const MAX_BAND_GAIN_DB: f64 = 12.0;

/// Stan korektora graficznego.
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

    /// Ogranicza wzmocnienie pasma do dopuszczalnego zakresu [-24.0 dB, +12.0 dB].
    pub fn clamp_gain(gain: f64) -> f64 {
        gain.clamp(MIN_BAND_GAIN_DB, MAX_BAND_GAIN_DB)
    }

    /// Ustawia wzmocnienie wskazanego pasma.
    pub fn set_band(&mut self, band_idx: usize, gain_db: f64) -> bool {
        if band_idx < 10 {
            self.bands[band_idx] = Self::clamp_gain(gain_db);
            true
        } else {
            false
        }
    }

    /// Resetuje wszystkie pasma do poziomu 0.0 dB (Flat).
    pub fn reset(&mut self) {
        self.bands = [0.0; 10];
    }
}

/// Gotowy profil brzmieniowy korektora.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EqualizerPreset {
    pub name: String,
    pub bands: [f64; 10],
}

impl EqualizerPreset {
    pub fn new(name: impl Into<String>, bands: [f64; 10]) -> Self {
        let mut clamped = [0.0; 10];
        for (i, val) in bands.iter().enumerate() {
            clamped[i] = EqualizerState::clamp_gain(*val);
        }
        Self {
            name: name.into(),
            bands: clamped,
        }
    }

    /// Lista fabrycznych presetów brzmieniowych.
    pub fn default_presets() -> Vec<Self> {
        vec![
            Self::new("Płaski (Flat)", [0.0; 10]),
            Self::new(
                "Anime OST / Clear Voice",
                [-1.0, 0.0, 1.0, 2.5, 3.5, 4.0, 3.0, 2.0, 1.5, 2.0],
            ),
            Self::new(
                "Mocny Bass (Bass Boost)",
                [6.0, 5.0, 4.0, 2.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0],
            ),
            Self::new(
                "Elektroniczna / Dance",
                [5.0, 4.0, 2.0, 0.0, -1.0, 1.5, 3.0, 4.0, 4.5, 4.0],
            ),
            Self::new("Rock", [4.5, 3.5, 2.0, 0.5, -0.5, 1.0, 2.5, 3.5, 4.0, 3.5]),
            Self::new("Pop", [1.5, 3.0, 4.0, 3.5, 2.0, 0.0, -1.0, 1.0, 2.5, 3.0]),
            Self::new(
                "Klasyczna / Akustyczna",
                [3.5, 2.5, 1.5, 0.5, 0.0, 0.0, 1.0, 2.0, 2.5, 3.0],
            ),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_equalizer_clamping() {
        assert_eq!(EqualizerState::clamp_gain(-30.0), -24.0);
        assert_eq!(EqualizerState::clamp_gain(20.0), 12.0);
        assert_eq!(EqualizerState::clamp_gain(5.5), 5.5);
    }

    #[test]
    fn test_equalizer_set_band_and_reset() {
        let mut eq = EqualizerState::new();
        assert!(eq.set_band(0, 8.0));
        assert!(eq.set_band(9, -15.0));
        assert!(!eq.set_band(10, 5.0)); // out of bounds
        assert_eq!(eq.bands[0], 8.0);
        assert_eq!(eq.bands[9], -15.0);

        eq.reset();
        assert_eq!(eq.bands, [0.0; 10]);
    }

    #[test]
    fn test_default_presets() {
        let presets = EqualizerPreset::default_presets();
        assert!(presets.len() >= 6);
        assert_eq!(presets[0].name, "Płaski (Flat)");
        assert_eq!(presets[0].bands, [0.0; 10]);
    }
}
