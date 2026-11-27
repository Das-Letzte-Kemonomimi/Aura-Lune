use serde::{Deserialize, Serialize};

/// Analogue saturation mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SaturatorMode {
    /// Off
    Off,
    /// Vacuum tube (triode) warmth: even harmonics, soft bass
    TubeWarmth,
    /// Tape saturation (symmetric peak rounding): dense, analogue sound
    TapeSaturation,
    /// Stronger harmonic saturation (overdrive / lo-fi excitement)
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
            Self::Off => "Off (Bypass)",
            Self::TubeWarmth => "Tube Warmth",
            Self::TapeSaturation => "Tape Saturation",
            Self::Overdrive => "Harmonic Saturation (Overdrive)",
        }
    }
}

/// Dynamic range compressor configuration
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CompressorConfig {
    pub enabled: bool,
    /// Compression threshold in dBFS (-60.0 to 0.0, default -18.0)
    pub threshold_db: f32,
    /// Compression ratio (1.0:1 to 20.0:1, default 3.0)
    pub ratio: f32,
    /// Soft knee vs hard knee
    pub soft_knee: bool,
    /// Makeup gain in dB (0.0 to +24.0 dB)
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

    /// Converts the dBFS threshold to a linear amplitude [0.0, 1.0] for GStreamer `audiodynamic`
    pub fn linear_threshold(&self) -> f32 {
        let clamped_db = self.threshold_db.clamp(-60.0, 0.0);
        10.0f32.powf(clamped_db / 20.0)
    }

    /// Converts the makeup gain in dB to a linear volume multiplier
    pub fn linear_makeup_gain(&self) -> f64 {
        let clamped_db = self.makeup_gain_db.clamp(0.0, 24.0);
        10.0f64.powf(clamped_db as f64 / 20.0)
    }
}

/// Analogue saturation configuration (Tube & Tape Saturator)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SaturatorConfig {
    pub enabled: bool,
    pub mode: SaturatorMode,
    /// Drive factor (1.0 to 5.0, default 1.5)
    pub drive: f32,
    /// Warmth / even-harmonic asymmetry (0.0 to 1.0)
    pub warmth: f32,
    /// Processed-to-clean signal ratio (dry/wet, 0.0 to 1.0)
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

    /// Processes a single F32 audio sample using the current saturation mode
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
                // Symmetric tape saturation (hyperbolic tangent curve)
                let x = sample * drive;
                let norm = (2.0 / std::f32::consts::PI) * (x).atan();
                // Subtle softening of the extreme peaks
                norm / (1.0 + 0.1 * drive)
            }
            SaturatorMode::TubeWarmth => {
                // Asymmetric tube saturation (adds the 2nd harmonic)
                let x = sample * drive;
                let asym = if x >= 0.0 {
                    x / (1.0 + x * (0.4 + 0.3 * warmth))
                } else {
                    x / (1.0 - x * (0.2 + 0.1 * warmth))
                };
                asym / (1.0 + 0.15 * drive)
            }
            SaturatorMode::Overdrive => {
                // Harder hyperbolic saturation
                let x = sample * drive;
                x.tanh() / (drive * 0.4).max(1.0)
            }
        };

        (1.0 - mix) * sample + mix * saturated
    }
}

/// Headphone protection limiter configuration
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LimiterConfig {
    /// Whether the peak limiter is active
    pub enabled: bool,
    /// Ceiling level in dBFS (e.g. -0.2 dBFS)
    pub ceiling_db: f32,
}

impl Default for LimiterConfig {
    fn default() -> Self {
        Self {
            enabled: true, // Hearing protection is on by default
            ceiling_db: -0.2,
        }
    }
}

/// Stereo base widening configuration (Stereo Widener / Stereo Stage)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct StereoWidenerConfig {
    pub enabled: bool,
    /// Widening amount from 0.0 (0%, no change) to 1.0 (100%, maximum stage width)
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

    /// Processes a stereo frame (left and right channel) in a mid-side (M/S) matrix.
    #[inline(always)]
    pub fn process_frame(&self, left: f32, right: f32) -> (f32, f32) {
        if !self.enabled || self.width <= 0.0 {
            return (left, right);
        }

        let mid = (left + right) * 0.5;
        let side = (left - right) * 0.5;

        // Side scaling: from 1.0 (no change) to 2.2 (+120% stereo width)
        let side_gain = 1.0 + self.width * 1.2;
        // Gain trim that prevents digital clipping at a wide stereo base
        let gain_trim = 1.0 / (1.0 + self.width * 0.2);

        let new_side = side * side_gain;
        let out_l = (mid + new_side) * gain_trim;
        let out_r = (mid - new_side) * gain_trim;

        (out_l, out_r)
    }
}

/// Combined Dynamics Studio state (Compressor + Saturator + Limiter)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct DynamicsState {
    pub compressor: CompressorConfig,
    pub saturator: SaturatorConfig,
    pub limiter: LimiterConfig,
}

/// Built-in Dynamics Studio preset
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
                description: "Warm triode saturation of even harmonics with gentle 2:1 compression.".into(),
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
                description: "Dense analog bass, softened treble and the tight dynamics of magnetic tape.".into(),
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
                description: "Articulate vocals, tight broadcast-style compression and optimal speech and singing intelligibility.".into(),
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
                description: "Heavier harmonic saturation for a vinyl and lo-fi hip-hop aesthetic.".into(),
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
                description: "Subtle dynamics levelling and an active limiter that shields your ears from sudden loudness spikes.".into(),
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
                name: "Direct Bypass".into(),
                description: "All dynamics and saturation modules off (bit-perfect).".into(),
                state: DynamicsState::default(),
            },
        ]
    }
}
