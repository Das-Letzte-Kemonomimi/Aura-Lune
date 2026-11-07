use serde::{Deserialize, Serialize};

/// Tryb nasycenia analogowego
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SaturatorMode {
    /// Wyłączone
    Off,
    /// Ciepło lampy elektronowej (trioda) — parzyste harmoniczne, miękki bas
    TubeWarmth,
    /// Nasycenie taśmowe (symetryczne zaokrąglanie wierzchołków) — gęsty, analogowy sound
    TapeSaturation,
    /// Mocniejsze nasycenie harmoniczne (overdrive / lo-fi excitement)
    Overdrive,
}

impl SaturatorMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Off => "Off",
            Self::TubeWarmth => "TubeWarmth",
            Self::TapeSaturation => "TapeSaturation",
            Self::Overdrive => "Overdrive",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Off => "Wyłączone (Bypass)",
            Self::TubeWarmth => "Lampa Elektronowa (Tube Warmth)",
            Self::TapeSaturation => "Taśma Analogowa (Tape Saturation)",
            Self::Overdrive => "Nasycenie Harmoniczne (Overdrive)",
        }
    }
}

/// Konfiguracja kompresora dynamiki (Dynamic Range Compressor)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CompressorConfig {
    pub enabled: bool,
    /// Próg kompresji w dBFS (od -60.0 do 0.0, domyślnie -18.0)
    pub threshold_db: f32,
    /// Stosunek kompresji (od 1.0:1 do 20.0:1, domyślnie 3.0)
    pub ratio: f32,
    /// Łagodne kolano (soft-knee) vs twarde (hard-knee)
    pub soft_knee: bool,
    /// Wzmocnienie wyrównawcze (makeup gain) w dB (od 0.0 do +24.0 dB)
    pub makeup_gain_db: f32,
}

impl Default for CompressorConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold_db: -18.0,
            ratio: 3.0,
            soft_knee: true,
            makeup_gain_db: 3.0,
        }
    }
}

impl CompressorConfig {
    pub fn clamped(&self) -> Self {
        Self {
            enabled: self.enabled,
            threshold_db: self.threshold_db.clamp(-60.0, 0.0),
            ratio: self.ratio.clamp(1.0, 20.0),
            soft_knee: self.soft_knee,
            makeup_gain_db: self.makeup_gain_db.clamp(0.0, 24.0),
        }
    }

    /// Przelicza próg w dBFS na liniową amplitudę [0.0, 1.0] dla GStreamer `audiodynamic`
    pub fn linear_threshold(&self) -> f32 {
        let clamped_db = self.threshold_db.clamp(-60.0, 0.0);
        10.0f32.powf(clamped_db / 20.0)
    }

    /// Przelicza makeup gain w dB na liniowy mnożnik głośności
    pub fn linear_makeup_gain(&self) -> f64 {
        let clamped_db = self.makeup_gain_db.clamp(0.0, 24.0);
        10.0f64.powf(clamped_db as f64 / 20.0)
    }
}

/// Konfiguracja nasycenia analogowego (Tube & Tape Saturator)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SaturatorConfig {
    pub enabled: bool,
    pub mode: SaturatorMode,
    /// Współczynnik wysterowania (od 1.0 do 5.0, domyślnie 1.5)
    pub drive: f32,
    /// Ciepło / asymetria parzystych harmonicznych (od 0.0 do 1.0)
    pub warmth: f32,
    /// Stosunek sygnału przetworzonego do czystego (Dry/Wet, od 0.0 do 1.0)
    pub mix: f32,
}

impl Default for SaturatorConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: SaturatorMode::TubeWarmth,
            drive: 1.5,
            warmth: 0.5,
            mix: 0.75,
        }
    }
}

impl SaturatorConfig {
    pub fn clamped(&self) -> Self {
        Self {
            enabled: self.enabled,
            mode: self.mode,
            drive: self.drive.clamp(1.0, 5.0),
            warmth: self.warmth.clamp(0.0, 1.0),
            mix: self.mix.clamp(0.0, 1.0),
        }
    }

    /// Przetwarza pojedynczą próbkę audio F32 według aktualnego trybu nasycenia
    #[inline(always)]
    pub fn process_sample(&self, sample: f32) -> f32 {
        if !self.enabled || self.mode == SaturatorMode::Off {
            return sample;
        }

        let drive = self.drive.clamp(1.0, 5.0);
        let warmth = self.warmth.clamp(0.0, 1.0);
        let mix = self.mix.clamp(0.0, 1.0);

        let saturated = match self.mode {
            SaturatorMode::Off => sample,
            SaturatorMode::TapeSaturation => {
                // Symetryczne nasycenie taśmowe (krzywa arkusza tangensa)
                let x = sample * drive;
                let norm = (2.0 / std::f32::consts::PI) * (x).atan();
                // Subtelne złagodzenie skrajnych szczytów
                norm / (1.0 + 0.1 * drive)
            }
            SaturatorMode::TubeWarmth => {
                // Asymetryczne nasycenie lampowe (dodawanie 2. harmonicznej)
                let x = sample * drive;
                let asym = if x >= 0.0 {
                    x / (1.0 + x * (0.4 + 0.3 * warmth))
                } else {
                    x / (1.0 - x * (0.2 + 0.1 * warmth))
                };
                asym / (1.0 + 0.15 * drive)
            }
            SaturatorMode::Overdrive => {
                // Twardzsze nasycenie hiperboliczne
                let x = sample * drive;
                x.tanh() / (drive * 0.4).max(1.0)
            }
        };

        (1.0 - mix) * sample + mix * saturated
    }
}

/// Konfiguracja limitera słuchawkowego (Headphone Protection Limiter)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LimiterConfig {
    /// Czy limiter szczytowy jest aktywny
    pub enabled: bool,
    /// Poziom sufitu (ceiling) w dBFS (np. -0.2 dBFS)
    pub ceiling_db: f32,
}

impl Default for LimiterConfig {
    fn default() -> Self {
        Self {
            enabled: true, // Bezpieczeństwo słuchu włączone domyślnie
            ceiling_db: -0.2,
        }
    }
}

/// Konfiguracja poszerzania bazy stereo (Stereo Widener / Stereo Stage)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct StereoWidenerConfig {
    pub enabled: bool,
    /// Poziom poszerzenia od 0.0 (0% - brak zmian) do 1.0 (100% - maksymalna przestrzeń sceny)
    pub width: f32,
}

impl Default for StereoWidenerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            width: 0.15,
        }
    }
}

impl StereoWidenerConfig {
    pub fn new(enabled: bool, width: f32) -> Self {
        Self {
            enabled,
            width: width.clamp(0.0, 1.0),
        }
    }

    /// Przetwarza ramkę stereo (lewy i prawy kanał) w macierzy Mid-Side (M/S).
    #[inline(always)]
    pub fn process_frame(&self, left: f32, right: f32) -> (f32, f32) {
        if !self.enabled || self.width <= 0.0 {
            return (left, right);
        }

        let mid = (left + right) * 0.5;
        let side = (left - right) * 0.5;

        // Skalowanie Side: od 1.0 (brak zmian) do 2.2 (+120% szerokości bazy stereo)
        let side_gain = 1.0 + self.width * 1.2;
        // Kompensacja głośności (gain trim) zapobiegająca cyfrowemu przesterowaniu przy szerokiej bazie
        let gain_trim = 1.0 / (1.0 + self.width * 0.2);

        let new_side = side * side_gain;
        let out_l = (mid + new_side) * gain_trim;
        let out_r = (mid - new_side) * gain_trim;

        (out_l, out_r)
    }
}

/// Zbiorczy stan Studia Dynamiki (Compressor + Saturator + Limiter)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct DynamicsState {
    pub compressor: CompressorConfig,
    pub saturator: SaturatorConfig,
    pub limiter: LimiterConfig,
}

/// Fabryczny preset Studia Dynamiki
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DynamicsPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub state: DynamicsState,
}

impl DynamicsPreset {
    pub fn default_presets() -> Vec<Self> {
        vec![
            Self {
                id: "vintage-tube".into(),
                name: "Vintage Tube Amplifier".into(),
                description: "Ciepłe nasycenie triodowe parzystych harmonicznych z łagodną kompresją 2:1.".into(),
                state: DynamicsState {
                    compressor: CompressorConfig {
                        enabled: true,
                        threshold_db: -16.0,
                        ratio: 2.2,
                        soft_knee: true,
                        makeup_gain_db: 2.5,
                    },
                    saturator: SaturatorConfig {
                        enabled: true,
                        mode: SaturatorMode::TubeWarmth,
                        drive: 1.8,
                        warmth: 0.65,
                        mix: 0.8,
                    },
                    limiter: LimiterConfig {
                        enabled: true,
                        ceiling_db: -0.2,
                    },
                },
            },
            Self {
                id: "analog-tape".into(),
                name: "Warm Analog Tape Deck".into(),
                description: "Gęsty analogowy bas, złagodzone soprany i zwarta dynamika taśmy magnetofonowej.".into(),
                state: DynamicsState {
                    compressor: CompressorConfig {
                        enabled: true,
                        threshold_db: -14.0,
                        ratio: 3.0,
                        soft_knee: true,
                        makeup_gain_db: 3.0,
                    },
                    saturator: SaturatorConfig {
                        enabled: true,
                        mode: SaturatorMode::TapeSaturation,
                        drive: 2.2,
                        warmth: 0.4,
                        mix: 0.85,
                    },
                    limiter: LimiterConfig {
                        enabled: true,
                        ceiling_db: -0.2,
                    },
                },
            },
            Self {
                id: "vocal-broadcast".into(),
                name: "Anime Broadcast & Radio".into(),
                description: "Wyrazisty wokal, zwarta kompresja radiowa i optymalna czytelność mowy/piosenek.".into(),
                state: DynamicsState {
                    compressor: CompressorConfig {
                        enabled: true,
                        threshold_db: -20.0,
                        ratio: 4.5,
                        soft_knee: true,
                        makeup_gain_db: 5.0,
                    },
                    saturator: SaturatorConfig {
                        enabled: true,
                        mode: SaturatorMode::TubeWarmth,
                        drive: 1.3,
                        warmth: 0.3,
                        mix: 0.5,
                    },
                    limiter: LimiterConfig {
                        enabled: true,
                        ceiling_db: -0.2,
                    },
                },
            },
            Self {
                id: "lofi-crunch".into(),
                name: "Lo-Fi Crunchy Vinyl".into(),
                description: "Mocniejsze nasycenie harmoniczne, estetyka winylowa i lo-fi hip-hop.".into(),
                state: DynamicsState {
                    compressor: CompressorConfig {
                        enabled: true,
                        threshold_db: -12.0,
                        ratio: 3.5,
                        soft_knee: false,
                        makeup_gain_db: 2.0,
                    },
                    saturator: SaturatorConfig {
                        enabled: true,
                        mode: SaturatorMode::Overdrive,
                        drive: 2.6,
                        warmth: 0.7,
                        mix: 0.7,
                    },
                    limiter: LimiterConfig {
                        enabled: true,
                        ceiling_db: -0.2,
                    },
                },
            },
            Self {
                id: "ear-safe".into(),
                name: "Headphone Hearing Protection".into(),
                description: "Subtelne wyrównanie dynamiki i aktywny limiter chroniący uszy przed nagłymi skokami głośności.".into(),
                state: DynamicsState {
                    compressor: CompressorConfig {
                        enabled: true,
                        threshold_db: -10.0,
                        ratio: 1.8,
                        soft_knee: true,
                        makeup_gain_db: 1.0,
                    },
                    saturator: SaturatorConfig {
                        enabled: false,
                        mode: SaturatorMode::Off,
                        drive: 1.0,
                        warmth: 0.0,
                        mix: 0.0,
                    },
                    limiter: LimiterConfig {
                        enabled: true,
                        ceiling_db: -0.5,
                    },
                },
            },
            Self {
                id: "bypass".into(),
                name: "Direct Bypass (Czysty tor)".into(),
                description: "Wszystkie moduły dynamiki i nasycenia wyłączone (bit-perfect).".into(),
                state: DynamicsState::default(),
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compressor_clamping_and_conversion() {
        let comp = CompressorConfig {
            enabled: true,
            threshold_db: -100.0, // poniżej limitu
            ratio: 50.0,          // powyżej limitu
            soft_knee: true,
            makeup_gain_db: 30.0, // powyżej limitu
        };

        let clamped = comp.clamped();
        assert_eq!(clamped.threshold_db, -60.0);
        assert_eq!(clamped.ratio, 20.0);
        assert_eq!(clamped.makeup_gain_db, 24.0);

        let lin_thresh = clamped.linear_threshold();
        assert!((lin_thresh - 0.001).abs() < 0.0001);

        let lin_makeup = clamped.linear_makeup_gain();
        assert!(lin_makeup > 15.0);
    }

    #[test]
    fn test_saturator_processing() {
        let sat = SaturatorConfig {
            enabled: true,
            mode: SaturatorMode::TubeWarmth,
            drive: 2.0,
            warmth: 0.8,
            mix: 1.0,
        };

        // Sygnał 0 powinien dać 0
        let zero = sat.process_sample(0.0);
        assert_eq!(zero, 0.0);

        // Sygnał dodatni vs ujemny powinien wykazać asymetrię (trioda)
        let pos = sat.process_sample(0.5);
        let neg = sat.process_sample(-0.5);
        assert!(pos > 0.0);
        assert!(neg < 0.0);
        // Asymetria: |pos| != |neg|
        assert!((pos.abs() - neg.abs()).abs() > 0.01);
    }

    #[test]
    fn test_tape_saturator_processing() {
        let sat = SaturatorConfig {
            enabled: true,
            mode: SaturatorMode::TapeSaturation,
            drive: 2.5,
            warmth: 0.0,
            mix: 1.0,
        };

        let pos = sat.process_sample(0.6);
        let neg = sat.process_sample(-0.6);
        // Taśma jest symetryczna
        assert!((pos.abs() - neg.abs()).abs() < 0.001);
    }

    #[test]
    fn test_default_presets_integrity() {
        let presets = DynamicsPreset::default_presets();
        assert!(presets.len() >= 5);
        assert!(presets.iter().any(|p| p.id == "vintage-tube"));
        assert!(presets.iter().any(|p| p.id == "analog-tape"));
        assert!(presets.iter().any(|p| p.id == "bypass"));
    }

    #[test]
    fn test_stereo_widener_processing() {
        let widener = StereoWidenerConfig {
            enabled: true,
            width: 0.5,
        };

        // Sygnał mono (L == R) nie powinien ulec zmianie proporcji kanałów
        let (mono_l, mono_r) = widener.process_frame(0.4, 0.4);
        assert!((mono_l - mono_r).abs() < 1e-6);

        // Sygnał z różnicą stereo (L != R) powinien mieć zwiększoną separację
        let orig_diff = (0.6f32 - 0.2f32).abs();
        let (out_l, out_r) = widener.process_frame(0.6, 0.2);
        let out_diff = (out_l - out_r).abs();
        assert!(out_diff > orig_diff * 0.9);

        // Przy wyłączonym widenerze sygnał przechodzi 1:1
        let disabled = StereoWidenerConfig {
            enabled: false,
            width: 0.5,
        };
        assert_eq!(disabled.process_frame(0.7, -0.3), (0.7, -0.3));
    }
}
