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

/// Opcjonalne parametry DSP aplikowane podczas eksportu / transkodowania utworu.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DspExportSettings {
    /// Przesunięcie wysokości dźwięku w półtonach (-12.0 do +12.0).
    pub pitch_semitones: f64,
    /// Mnożnik tempa (0.25 do 4.0).
    pub tempo_ratio: f64,
    /// Mnożnik szybkości odtwarzania (0.25 do 4.0).
    pub rate_ratio: f64,
    /// Poziom pogłosu (0.0 do 1.0).
    pub reverb_level: f32,
    /// 10 pasm korektora graficznego (-24.0 do +12.0 dB).
    pub eq_bands: Option<Vec<f64>>,
}

impl Default for DspExportSettings {
    fn default() -> Self {
        Self {
            pitch_semitones: 0.0,
            tempo_ratio: 1.0,
            rate_ratio: 1.0,
            reverb_level: 0.0,
            eq_bands: None,
        }
    }
}

impl DspExportSettings {
    /// Sprawdza, czy jakiekolwiek parametry DSP odbiegają od domyślnych (Bypass).
    pub fn is_active(&self) -> bool {
        self.pitch_semitones.abs() > 0.001
            || (self.tempo_ratio - 1.0).abs() > 0.001
            || (self.rate_ratio - 1.0).abs() > 0.001
            || self.reverb_level > 0.001
            || self
                .eq_bands
                .as_ref()
                .is_some_and(|bands| bands.iter().any(|b| b.abs() > 0.1))
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
