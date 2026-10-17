use serde::{Deserialize, Serialize};

/// Formaty docelowe do eksportu / transkodowania utworów.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExportFormat {
    /// Ogg Opus z konfigurowalnym bitrate (kbps, np. 128, 192, 256, 320).
    Opus { bitrate_kbps: u32 },
    /// Bezstratny FLAC z poziomem kompresji (0-8, domyślnie 5).
    Flac { compression_level: u32 },
    /// Nieskompresowany PCM WAV (16-bit lub 24-bit).
    Wav,
}

impl Default for ExportFormat {
    fn default() -> Self {
        Self::Opus { bitrate_kbps: 192 }
    }
}

impl ExportFormat {
    /// Zwraca standardowe rozszerzenie pliku dla danego formatu.
    pub fn extension(&self) -> &'static str {
        match self {
            Self::Opus { .. } => "opus",
            Self::Flac { .. } => "flac",
            Self::Wav => "wav",
        }
    }

    /// Czytelna nazwa formatu.
    pub fn display_name(&self) -> String {
        match self {
            Self::Opus { bitrate_kbps } => format!("Opus ({} kbps)", bitrate_kbps),
            Self::Flac { compression_level } => format!("FLAC (kompresja {})", compression_level),
            Self::Wav => "WAV (PCM)".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_format_extension() {
        assert_eq!(ExportFormat::Opus { bitrate_kbps: 160 }.extension(), "opus");
        assert_eq!(
            ExportFormat::Flac {
                compression_level: 5
            }
            .extension(),
            "flac"
        );
        assert_eq!(ExportFormat::Wav.extension(), "wav");
    }
}
