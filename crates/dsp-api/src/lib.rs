//! Wspólny kontrakt DSP, modele parametrów i konwersje matematyczne.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Błędy operacji DSP.
#[derive(Debug, Error, PartialEq)]
pub enum DspError {
    #[error("Nieprawidłowy parametr: {0}")]
    InvalidParameter(String),
    #[error("Błąd konfiguracji formatu audio: {0}")]
    FormatError(String),
    #[error("Błąd wewnętrzny procesora {engine}: {message}")]
    Internal {
        engine: &'static str,
        message: String,
    },
}

/// Dostępne silniki DSP do zmiany wysokości i tempa dźwięku.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum DspEngine {
    #[default]
    Bypass,
    RubberBand,
    SoundTouch,
}

impl DspEngine {
    /// Nazwa zapisywana w ustawieniach, presetach i wysyłana do interfejsu.
    pub fn as_str(self) -> &'static str {
        match self {
            DspEngine::Bypass => "Bypass",
            DspEngine::RubberBand => "RubberBand",
            DspEngine::SoundTouch => "SoundTouch",
        }
    }

    /// Odczyt nazwy bez rozróżniania wielkości liter; nieznana nazwa oznacza `Bypass`.
    pub fn from_name(name: &str) -> Self {
        if name.eq_ignore_ascii_case("RubberBand") {
            DspEngine::RubberBand
        } else if name.eq_ignore_ascii_case("SoundTouch") {
            DspEngine::SoundTouch
        } else {
            DspEngine::Bypass
        }
    }
}

impl std::fmt::Display for DspEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Zdolności i ograniczenia wybranego silnika DSP.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DspCapabilities {
    pub engine: DspEngine,
    pub name: String,
    pub min_pitch_semitones: f64,
    pub max_pitch_semitones: f64,
    pub min_tempo_ratio: f64,
    pub max_tempo_ratio: f64,
    pub supports_formants: bool,
    pub description: String,
}

impl DspEngine {
    pub fn capabilities(&self) -> DspCapabilities {
        match self {
            DspEngine::Bypass => DspCapabilities {
                engine: *self,
                name: "Brak DSP (Direct Bypass)".to_string(),
                min_pitch_semitones: -24.0,
                max_pitch_semitones: 24.0,
                min_tempo_ratio: 0.15,
                max_tempo_ratio: 4.0,
                supports_formants: false,
                description:
                    "Czysty strumień bit-perfect bez procesora DSP (zerowe obciążenie)".to_string(),
            },
            DspEngine::RubberBand => DspCapabilities {
                engine: *self,
                name: "Rubber Band".to_string(),
                min_pitch_semitones: -24.0,
                max_pitch_semitones: 24.0,
                min_tempo_ratio: 0.15,
                max_tempo_ratio: 4.0,
                supports_formants: true,
                description:
                    "Precyzyjny silnik Rubber Band R3 (jak w Music Speed Changer, czyste tempo do 15%, transjenty)".to_string(),
            },
            DspEngine::SoundTouch => DspCapabilities {
                engine: *self,
                name: "SoundTouch".to_string(),
                min_pitch_semitones: -12.0,
                max_pitch_semitones: 12.0,
                min_tempo_ratio: 0.5,
                max_tempo_ratio: 2.0,
                supports_formants: false,
                description:
                    "Lekki silnik SoundTouch (niski narzut CPU)".to_string(),
            },
        }
    }
}

/// Format strumienia audio dla procesora DSP.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AudioFormat {
    pub sample_rate: u32,
    pub channels: u32,
}

impl AudioFormat {
    pub fn new(sample_rate: u32, channels: u32) -> Result<Self, DspError> {
        if sample_rate == 0 {
            return Err(DspError::FormatError(
                "Częstotliwość próbkowania musi być > 0".to_string(),
            ));
        }
        if channels == 0 || channels > 16 {
            return Err(DspError::FormatError(
                "Liczba kanałów musi mieścić się w zakresie 1..=16".to_string(),
            ));
        }
        Ok(Self {
            sample_rate,
            channels,
        })
    }
}

/// Parametry przetwarzania DSP.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct DspParams {
    /// Silnik DSP.
    pub engine: DspEngine,
    /// Wysokość dźwięku w półtonach (0.0 = brak zmiany, np. -12.0 do +12.0).
    pub pitch_semitones: f64,
    /// Mnożnik tempa (1.0 = normalna długość, 0.5 = 2x wolniej, 2.0 = 2x szybciej).
    pub tempo_ratio: f64,
    /// Mnożnik szybkości (tempo i pitch zmieniają się razem, 1.0 = normalnie).
    pub rate_ratio: f64,
}

impl Default for DspParams {
    fn default() -> Self {
        Self {
            engine: DspEngine::default(),
            pitch_semitones: 0.0,
            tempo_ratio: 1.0,
            rate_ratio: 1.0,
        }
    }
}

impl DspParams {
    pub fn new(
        engine: DspEngine,
        pitch_semitones: f64,
        tempo_ratio: f64,
        rate_ratio: f64,
    ) -> Result<Self, DspError> {
        let params = Self {
            engine,
            pitch_semitones,
            tempo_ratio,
            rate_ratio,
        };
        params.validate()?;
        Ok(params)
    }

    /// Waliduje zakresy parametrów.
    pub fn validate(&self) -> Result<(), DspError> {
        if !self.pitch_semitones.is_finite()
            || self.pitch_semitones < -24.0
            || self.pitch_semitones > 24.0
        {
            return Err(DspError::InvalidParameter(format!(
                "pitch_semitones ({}) poza dozwolonym zakresem [-24.0, 24.0]",
                self.pitch_semitones
            )));
        }
        if !self.tempo_ratio.is_finite() || self.tempo_ratio < 0.15 || self.tempo_ratio > 4.0 {
            return Err(DspError::InvalidParameter(format!(
                "tempo_ratio ({}) poza dozwolonym zakresem [0.15, 4.0]",
                self.tempo_ratio
            )));
        }
        if !self.rate_ratio.is_finite() || self.rate_ratio < 0.15 || self.rate_ratio > 4.0 {
            return Err(DspError::InvalidParameter(format!(
                "rate_ratio ({}) poza dozwolonym zakresem [0.15, 4.0]",
                self.rate_ratio
            )));
        }
        Ok(())
    }

    /// Oblicza liniowy mnożnik pitch ($2^{semitones / 12}$).
    pub fn pitch_scale(&self) -> f64 {
        semitones_to_pitch_ratio(self.pitch_semitones)
    }

    /// Sprawdza, czy parametry oznaczają brak modyfikacji dźwięku (Bypass).
    pub fn is_bypass(&self) -> bool {
        self.engine == DspEngine::Bypass
            || (self.pitch_semitones.abs() < 1e-4
                && (self.tempo_ratio - 1.0).abs() < 1e-4
                && (self.rate_ratio - 1.0).abs() < 1e-4)
    }
}

/// Przelicza wysokość dźwięku z półtonów na mnożnik liniowy (skalę).
///
/// Wzór: $scale = 2^{\frac{semitones}{12}}$.
#[inline]
pub fn semitones_to_pitch_ratio(semitones: f64) -> f64 {
    2.0f64.powf(semitones / 12.0)
}

/// Przelicza liniowy mnożnik wysokości na półtony.
///
/// Wzór: $semitones = 12 \cdot \log_2(ratio)$.
#[inline]
pub fn pitch_ratio_to_semitones(ratio: f64) -> f64 {
    12.0 * ratio.log2()
}

/// Konwersja centów na półtony (100 centów = 1 półton).
#[inline]
pub fn cents_to_semitones(cents: f64) -> f64 {
    cents / 100.0
}

/// Konwersja półtonów na centy.
#[inline]
pub fn semitones_to_cents(semitones: f64) -> f64 {
    semitones * 100.0
}

/// Status operacji przetwarzania bloku audio.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessStatus {
    /// Wyprodukowano próbki wyjściowe.
    Ok,
    /// Brak próbek wyjściowych (np. buforowanie początkowe / latencja).
    Buffering,
    /// Zakończono przetwarzanie (EOS/drain zakończony).
    Eos,
}

/// Ujednolicony interfejs procesora DSP.
pub trait AudioProcessor: Send {
    /// Zwraca nazwę silnika.
    fn name(&self) -> &'static str;

    /// Przygotowuje procesor do zadanego formatu próbek.
    fn prepare(&mut self, format: AudioFormat, max_block_frames: usize) -> Result<(), DspError>;

    /// Aktualizuje parametry DSP w locie.
    fn set_params(&mut self, params: DspParams) -> Result<(), DspError>;

    /// Przetwarza wejściowy blok splecionych (interleaved) próbek f32 do bufora wyjściowego.
    fn process(&mut self, input: &[f32], output: &mut Vec<f32>) -> Result<ProcessStatus, DspError>;

    /// Zwraca opóźnienie silnika w ramkach.
    fn latency_frames(&self) -> usize;

    /// Resetuje stan wewnętrznych filtrów (np. po operacji seek).
    fn reset(&mut self) -> Result<(), DspError>;

    /// Opróżnia wewnętrzne bufory procesora przy końcu utworu (EOS).
    fn drain(&mut self, output: &mut Vec<f32>) -> Result<ProcessStatus, DspError>;
}
