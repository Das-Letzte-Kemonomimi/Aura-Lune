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
