use serde::{Deserialize, Serialize};

/// Wbudowane presety filtra Bauer stereophonic-to-binaural (bs2b / Crossfeed).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum CrossfeedPreset {
    /// Domyślny profil wirtualnych głośników (rozstawienie 30°, odległość 3 metry) - 700 Hz, 4.5 dB.
    #[default]
    Default,
    /// Popularny obwód Chu Moy Crossfeeder - 700 Hz, 6.0 dB.
    ChuMoy,
    /// Profil wzmacniaczy słuchawkowych Jan Meier CORDA - 650 Hz, 9.0 dB.
    JanMeier,
    /// Własne parametry użytkowniczki.
    Custom,
}

impl CrossfeedPreset {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Default => "Domyślny (30°, 3m — 700 Hz / 4.5 dB)",
            Self::ChuMoy => "Chu Moy (Popularny — 700 Hz / 6.0 dB)",
            Self::JanMeier => "Jan Meier Corda (Subtelny — 650 Hz / 9.0 dB)",
            Self::Custom => "Niestandardowy (Custom)",
        }
    }
}

/// Konfiguracja filtra Crossfeed dla słuchawek.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossfeedConfig {
    pub enabled: bool,
    pub preset: CrossfeedPreset,
    /// Częstotliwość odcięcia dolnoprzepustowego w Hz (300 Hz - 2000 Hz, domyślnie 700 Hz).
    pub fcut_hz: u32,
    /// Poziom sprzężenia kanałów w 0.1 dB (10 - 150, czyli 1.0 dB - 15.0 dB, domyślnie 45 = 4.5 dB).
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
    /// Ustawia parametry według wybranego presetu.
    pub fn with_preset(preset: CrossfeedPreset) -> Self {
        let mut cfg = Self::default();
        cfg.apply_preset(preset);
        cfg
    }

    /// Nadpisuje częstotliwość i feed wartościami ze wskazanego presetu.
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

    /// Poziom feedu jako wartość zmiennoprzecinkowa w dB (np. 4.5 dB).
    pub fn feed_db(&self) -> f32 {
        self.feed_tenth_db as f32 / 10.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crossfeed_defaults_and_presets() {
        let mut cfg = CrossfeedConfig::default();
        assert!(!cfg.enabled);
        assert_eq!(cfg.preset, CrossfeedPreset::Default);
        assert_eq!(cfg.fcut_hz, 700);
        assert_eq!(cfg.feed_tenth_db, 45);
        assert_eq!(cfg.feed_db(), 4.5);

        cfg.apply_preset(CrossfeedPreset::ChuMoy);
        assert_eq!(cfg.fcut_hz, 700);
        assert_eq!(cfg.feed_tenth_db, 60);
        assert_eq!(cfg.feed_db(), 6.0);

        cfg.apply_preset(CrossfeedPreset::JanMeier);
        assert_eq!(cfg.fcut_hz, 650);
        assert_eq!(cfg.feed_tenth_db, 90);
        assert_eq!(cfg.feed_db(), 9.0);
    }
}
