use serde::{Deserialize, Serialize};

/// Tryb normalizacji głośności ReplayGain 2.0 / EBU R128.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ReplayGainMode {
    /// Normalizacja wyłączona (Bypass).
    #[default]
    Off,
    /// Dopasowanie głośności per utwór (Track Gain).
    Track,
    /// Dopasowanie głośności per album (Album Gain) - zachowuje dynamikę między utworami.
    Album,
}

impl ReplayGainMode {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Off => "Wyłączony (Off)",
            Self::Track => "Utwór (Track Gain)",
            Self::Album => "Album (Album Gain)",
        }
    }
}

/// Konfiguracja normalizacji ReplayGain.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ReplayGainConfig {
    pub mode: ReplayGainMode,
    /// Dodatkowe wzmocnienie przedwzmacniacza w dB (-12.0 dB do +12.0 dB).
    pub pre_amp_db: f64,
}

impl Default for ReplayGainConfig {
    fn default() -> Self {
        Self {
            mode: ReplayGainMode::Off,
            pre_amp_db: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replaygain_defaults() {
        let cfg = ReplayGainConfig::default();
        assert_eq!(cfg.mode, ReplayGainMode::Off);
        assert_eq!(cfg.pre_amp_db, 0.0);
    }
}
