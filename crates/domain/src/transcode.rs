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
    /// Wybór silnika DSP: "RubberBand" lub "SoundTouch" (domyślnie "RubberBand").
    #[serde(default)]
    pub engine: Option<String>,
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
            engine: None,
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
