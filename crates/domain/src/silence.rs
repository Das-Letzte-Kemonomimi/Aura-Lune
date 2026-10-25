use serde::{Deserialize, Serialize};

/// Konfiguracja automatycznego pomijania ciszy (Silence Trimming / Auto-skip silence).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SilenceTrimmingConfig {
    /// Czy automatyczne pomijanie ciszy jest aktywne.
    pub enabled: bool,
    /// Próg poziomu głośności w dBFS, poniżej którego dźwięk uznawany jest za ciszę (-80.0 dB do -20.0 dB).
    pub threshold_db: f64,
}

impl Default for SilenceTrimmingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold_db: -50.0,
        }
    }
}

impl SilenceTrimmingConfig {
    pub fn clamped(mut self) -> Self {
        self.threshold_db = self.threshold_db.clamp(-80.0, -20.0);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_silence_trimming_defaults_and_clamping() {
        let cfg = SilenceTrimmingConfig::default();
        assert!(!cfg.enabled);
        assert_eq!(cfg.threshold_db, -50.0);

        let clamped = SilenceTrimmingConfig {
            enabled: true,
            threshold_db: -120.0,
        }
        .clamped();
        assert_eq!(clamped.threshold_db, -80.0);

        let clamped_high = SilenceTrimmingConfig {
            enabled: true,
            threshold_db: 5.0,
        }
        .clamped();
        assert_eq!(clamped_high.threshold_db, -20.0);
    }
}
