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
    #[serde(alias = "pitchSemitones")]
    pub pitch_semitones: f64,
    /// Mnożnik tempa (0.25 do 4.0).
    #[serde(alias = "tempoRatio")]
    pub tempo_ratio: f64,
    /// Mnożnik szybkości odtwarzania (0.25 do 4.0).
    #[serde(alias = "rateRatio")]
    pub rate_ratio: f64,
    /// Poziom pogłosu (0.0 do 1.0).
    #[serde(alias = "reverbLevel")]
    pub reverb_level: f32,
    /// 10 pasm korektora graficznego (-24.0 do +12.0 dB).
    #[serde(alias = "eqBands")]
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

/// Zakres czasowy do eksportu / transkodowania fragmentu utworu (np. wycięcie pętli A-B).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRange {
    /// Czas startu w milisekundach (Marker A).
    #[serde(alias = "startMs")]
    pub start_ms: u64,
    /// Czas końca w milisekundach (Marker B). Jeśli `None`, eksport trwa do końca utworu.
    #[serde(alias = "endMs")]
    pub end_ms: Option<u64>,
}

impl TimeRange {
    /// Tworzy nowy zakres czasowy A-B z walidacją poprawności kolejności znaczników.
    pub fn new(start_ms: u64, end_ms: Option<u64>) -> Result<Self, &'static str> {
        if let Some(end) = end_ms {
            if end <= start_ms {
                return Err(
                    "Czas końcowy (Punkt B) musi być większy niż czas początkowy (Punkt A)",
                );
            }
        }
        Ok(Self { start_ms, end_ms })
    }

    /// Sprawdza, czy zakres jest aktywny (ogranicza czas utworu).
    pub fn is_active(&self) -> bool {
        self.start_ms > 0 || self.end_ms.is_some()
    }

    /// Zwraca długość trwania fragmentu w milisekundach, jeśli zdefiniowano Punkt B.
    pub fn duration_ms(&self) -> Option<u64> {
        self.end_ms.map(|end| end.saturating_sub(self.start_ms))
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

    #[test]
    fn test_time_range_validation() {
        let valid = TimeRange::new(500, Some(1500));
        assert!(valid.is_ok());
        let range = valid.unwrap();
        assert!(range.is_active());
        assert_eq!(range.duration_ms(), Some(1000));

        let invalid = TimeRange::new(1500, Some(500));
        assert!(invalid.is_err());

        let equal = TimeRange::new(1000, Some(1000));
        assert!(equal.is_err());

        let start_only = TimeRange::new(1000, None);
        assert!(start_only.is_ok());
        let range_start = start_only.unwrap();
        assert!(range_start.is_active());
        assert_eq!(range_start.duration_ms(), None);

        let zero_unbounded = TimeRange::new(0, None);
        assert!(zero_unbounded.is_ok());
        assert!(!zero_unbounded.unwrap().is_active());
    }
}
