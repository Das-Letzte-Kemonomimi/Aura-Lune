//! Domain data structures for stem projects (Moises-like), the hierarchical
//! instrument taxonomy and the fader volume mapping.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Processing status of a stem project.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StemProjectStatus {
    #[default]
    Queued,
    Separating,
    Ready,
    Failed,
}

/// Quality rating / origin level of a stem.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StemQualityTier {
    #[default]
    HighQuality, // Produced directly by a dedicated neural model
    Experimental, // Experimental model / fusion
    DspFallback,  // Produced by a classic Linkwitz-Riley DSP filter
    Unavailable,  // Needs an extra model pack to be installed
}

/// A single channel (instrument track) in a stem project.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemChannel {
    pub id: String,                    // np. "lead_vocal", "kick", "bass"
    pub name: String,                  // e.g. "Lead Vocal", "Kick Drum"
    pub parent_stem: Option<String>,   // np. Some("vocals"), Some("drums")
    pub file_path: String,             // Path to the WAV/FLAC audio file in the cache
    pub color_hex: String,             // Channel colour in the UI
    pub quality_tier: StemQualityTier, // Quality / model
    pub volume: f32,                   // 0.0 .. 1.0 (default 0.75 = 0 dB)
    pub pan: f32,                      // -1.0 (L) .. +1.0 (R), default 0.0
    pub mute: bool,                    // true = muted
    pub solo: bool,                    // true = solo listening
}

/// A saved mix (fader and parameter preset) in a stem project.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChannelMixSetting {
    pub volume: f32,
    pub pan: f32,
    pub mute: bool,
    pub solo: bool,
}

/// A complete named mix within a project.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemProjectMix {
    pub id: Option<i64>,
    pub project_id: i64,
    pub name: String,
    pub is_default: bool,
    pub channels: HashMap<String, ChannelMixSetting>,
    pub master_volume: f32, // 0.0 .. 1.0, default 1.0
    pub updated_at: String,
}

/// Stem project entity.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemProject {
    pub id: i64,
    pub track_id: i64,
    pub track_hash: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover_uri: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub status: StemProjectStatus,
    pub progress: f32, // 0.0 .. 1.0
    pub model_name: String,
    pub disk_size_bytes: u64,
    pub channels: Vec<StemChannel>,
    pub active_mix_name: Option<String>,
}

/// Information about a model pack to download in the Model Manager.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelPackInfo {
    pub id: String, // e.g. "pack_core_4stem", "pack_extended_6stem"
    pub name: String,
    pub description: String,
    pub category: String, // "Base", "Vocals", "Drums", "Instruments"
    pub unlocked_stems: Vec<String>,
    pub model_files: Vec<String>,
    pub total_size_bytes: u64,
    pub license: String,
    pub source_url: String,
    pub sha256: String,
    pub is_installed: bool,
    pub gpu_recommended: bool,
    pub speed_estimate_sec_per_min: f32, // Estimated time per minute of audio
}

// =========================================================================
// VOLUME CURVE MAPPING
// 0% = silence (-inf dB)
// 75% = unity gain (0 dB, 1.0x linear)
// 100% = +6.02 dB headroom boost (~2.0x linear)
// =========================================================================

/// Converts a fader value [0.0 .. 1.0] to a linear signal gain factor.
///
/// - `slider == 0.0` -> 0.0 (full mute / -inf dB)
/// - `slider == 0.75` -> 1.0 (unity gain / 0.0 dB)
/// - `slider == 1.0` -> ~2.0 (+6.02 dB)
pub fn slider_to_linear_gain(slider: f32) -> f32 {
    let v = slider.clamp(0.0, 1.0);
    if v <= 0.0001 {
        0.0
    } else if v <= 0.75 {
        // Smooth power curve imitating an analogue studio fader
        let norm = v / 0.75;
        norm.powf(2.0)
    } else {
        // Smooth boost from 1.0 (0 dB) to 2.0 (+6.02 dB) over 75% - 100%
        let boost_norm = (v - 0.75) / 0.25;
        1.0 + boost_norm * (2.0f32 - 1.0)
    }
}

/// Converts a linear gain factor to a fader value [0.0 .. 1.0].
pub fn linear_gain_to_slider(gain: f32) -> f32 {
    let g = gain.max(0.0);
    if g <= 0.0001 {
        0.0
    } else if g <= 1.0 {
        g.sqrt() * 0.75
    } else {
        let boost_norm = ((g - 1.0) / (2.0 - 1.0)).min(1.0);
        0.75 + boost_norm * 0.25
    }
}

/// Returns the value in decibels (dB) for the given fader position [0.0 .. 1.0].
pub fn slider_to_db(slider: f32) -> f32 {
    let gain = slider_to_linear_gain(slider);
    if gain <= 0.00001 {
        -100.0 // Represents silence
    } else {
        20.0 * gain.log10()
    }
}

/// Returns the default HEX colour for the given stem type.
pub fn default_stem_color(stem_id: &str) -> &'static str {
    match stem_id {
        // Vocals
        "lead_vocal" | "vocals" => "#f43f5e",    // Rose Pink
        "backing_vocals" | "choir" => "#fb7185", // Soft Rose
        // Drums
        "drums" => "#f59e0b",      // Amber
        "kick" => "#ea580c",       // Deep Orange
        "snare" => "#fbbf24",      // Warm Yellow
        "hihat" => "#fef08a",      // Bright Light Yellow
        "toms" => "#d97706",       // Ochre
        "cymbals" => "#fcd34d",    // Gold
        "percussion" => "#fb923c", // Orange
        // Bass
        "bass" => "#0ea5e9", // Vivid Cyan
        // Guitars
        "guitar" | "guitars" => "#10b981", // Emerald Green
        "lead_guitar" => "#34d399",        // Light Emerald
        "rhythm_guitar" => "#059669",      // Deep Green
        "acoustic_guitar" => "#84cc16",    // Lime Green
        // Keys and synths
        "piano" => "#8b5cf6",          // Purple
        "electric_piano" => "#a855f7", // Violet
        "synth" => "#d946ef",          // Fuchsia / Neon Pink
        // Orchestral section
        "strings" => "#06b6d4",   // Cyan
        "brass" => "#eab308",     // Brass Gold
        "woodwinds" => "#14b8a6", // Teal
        // Other
        _ => "#94a3b8", // Slate Gray
    }
}

/// Returns a readable stem label (PL / EN).
pub fn default_stem_label(stem_id: &str, lang_is_pl: bool) -> &'static str {
    match stem_id {
        "vocals" => {
            if lang_is_pl {
                "Wokal"
            } else {
                "Vocals"
            }
        }
        "lead_vocal" => {
            if lang_is_pl {
                "Wokal prowadzący"
            } else {
                "Lead Vocal"
            }
        }
        "backing_vocals" => {
            if lang_is_pl {
                "Chórki / Harmonie"
            } else {
                "Backing Vocals"
            }
        }
        "drums" => {
            if lang_is_pl {
                "Perkusja (Całość)"
            } else {
                "Drums (Full)"
            }
        }
        "kick" => {
            if lang_is_pl {
                "Stopa (Kick)"
            } else {
                "Kick Drum"
            }
        }
        "snare" => {
            if lang_is_pl {
                "Werbel (Snare)"
            } else {
                "Snare Drum"
            }
        }
        "hihat" => {
            if lang_is_pl {
                "Talerz Hi-Hat"
            } else {
                "Hi-Hat"
            }
        }
        "toms" => {
            if lang_is_pl {
                "Kotły (Tomy)"
            } else {
                "Toms"
            }
        }
        "cymbals" => {
            if lang_is_pl {
                "Talerze (Cymbals)"
            } else {
                "Cymbals / Ride"
            }
        }
        "bass" => {
            if lang_is_pl {
                "Bas"
            } else {
                "Bass"
            }
        }
        "guitars" | "guitar" => {
            if lang_is_pl {
                "Gitary"
            } else {
                "Guitars"
            }
        }
        "lead_guitar" => {
            if lang_is_pl {
                "Gitara solowa"
            } else {
                "Lead Guitar"
            }
        }
        "rhythm_guitar" => {
            if lang_is_pl {
                "Gitara rytmiczna"
            } else {
                "Rhythm Guitar"
            }
        }
        "acoustic_guitar" => {
            if lang_is_pl {
                "Gitara akustyczna"
            } else {
                "Acoustic Guitar"
            }
        }
        "piano" => {
            if lang_is_pl {
                "Fortepian / Pianino"
            } else {
                "Piano"
            }
        }
        "synth" => {
            if lang_is_pl {
                "Syntezatory / Pady"
            } else {
                "Synths & Pads"
            }
        }
        "strings" => {
            if lang_is_pl {
                "Smyczki (Strings)"
            } else {
                "Strings"
            }
        }
        "brass" => {
            if lang_is_pl {
                "Instrumenty dęte blaszane"
            } else {
                "Brass"
            }
        }
        "woodwinds" => {
            if lang_is_pl {
                "Dęte drewniane (Winds)"
            } else {
                "Woodwinds"
            }
        }
        _ => {
            if lang_is_pl {
                "Pozostałe (Other)"
            } else {
                "Other / Instrumental"
            }
        }
    }
}

/// Linear gain of a stem project channel in the mixer.
///
/// A muted channel and, when any channel is soloed, every channel without solo
/// get 0. The rest: the fader curve (`slider_to_linear_gain`) × the master volume.
pub fn effective_channel_gain(channel: &StemChannel, any_solo: bool, master_volume: f32) -> f64 {
    if channel.mute || (any_solo && !channel.solo) {
        return 0.0;
    }
    (slider_to_linear_gain(channel.volume) * master_volume) as f64
}
