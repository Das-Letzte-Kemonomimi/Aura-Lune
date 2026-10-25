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
    /// Inteligentny wybór (Auto): Album Gain dla spójnego albumu, Track Gain dla trybu losowego lub miksu.
    Auto,
}

impl ReplayGainMode {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Off => "Wyłączony (Off)",
            Self::Track => "Utwór (Track Gain)",
            Self::Album => "Album (Album Gain)",
            Self::Auto => "Inteligentny (Auto Track/Album)",
        }
    }
}

/// Konfiguracja normalizacji ReplayGain.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ReplayGainConfig {
    pub mode: ReplayGainMode,
    /// Dodatkowe wzmocnienie przedwzmacniacza w dB (-12.0 dB do +12.0 dB).
    pub pre_amp_db: f64,
    /// Domyślne wzmocnienie dla utworów bez tagów ReplayGain w dB (np. -6.0 dB).
    pub fallback_gain_db: f64,
    /// Ochrona przed obcinaniem sygnału / przesterem (ReplayGain Limiter).
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replaygain_defaults() {
        let cfg = ReplayGainConfig::default();
        assert_eq!(cfg.mode, ReplayGainMode::Off);
        assert_eq!(cfg.pre_amp_db, 0.0);
        assert_eq!(cfg.fallback_gain_db, -6.0);
        assert!(cfg.prevent_clipping);
    }

    #[test]
    fn test_replaygain_modes_display() {
        assert_eq!(ReplayGainMode::Off.display_name(), "Wyłączony (Off)");
        assert_eq!(
            ReplayGainMode::Auto.display_name(),
            "Inteligentny (Auto Track/Album)"
        );
    }
}
