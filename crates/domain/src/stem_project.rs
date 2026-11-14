//! Domenowe struktury danych dla projektów stemów (Moises-like Stem Projects),
//! hierarchicznej taksonomii instrumentów oraz mapowania głośności suwaków.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Status przetwarzania projektu stemów.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StemProjectStatus {
    #[default]
    Queued,
    Separating,
    Ready,
    Failed,
}

/// Ocena jakości / poziom pochodzenia danego stemu.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StemQualityTier {
    #[default]
    HighQuality, // Wytworzony bezpośrednio dedykowanym modelem neuronowym
    Experimental, // Model eksperymentalny / fuzja
    DspFallback,  // Wytworzony klasycznym filtrem Linkwitz-Riley DSP
    Unavailable,  // Wymaga instalacji dodatkowego pakietu modeli
}

/// Pojedynczy kanał (ścieżka instrumentu) w projekcie stemów.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemChannel {
    pub id: String,                    // np. "lead_vocal", "kick", "bass"
    pub name: String,                  // np. "Lead Vocal", "Stopa perkusyjna"
    pub parent_stem: Option<String>,   // np. Some("vocals"), Some("drums")
    pub file_path: String,             // Ścieżka do pliku audio WAV/FLAC w cache
    pub color_hex: String,             // Kolor kanału w UI
    pub quality_tier: StemQualityTier, // Jakość / model
    pub volume: f32,                   // 0.0 .. 1.0 (domyślnie 0.75 = 0 dB)
    pub pan: f32,                      // -1.0 (L) .. +1.0 (R), domyślnie 0.0
    pub mute: bool,                    // true = wyciszony
    pub solo: bool,                    // true = odsłuch w trybie solo
}

/// Zapisany miks (preset faderów i parametrów) w projekcie stemów.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChannelMixSetting {
    pub volume: f32,
    pub pan: f32,
    pub mute: bool,
    pub solo: bool,
}

/// Kompletny nazwany miks w ramach projektu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemProjectMix {
    pub id: Option<i64>,
    pub project_id: i64,
    pub name: String,
    pub is_default: bool,
    pub channels: HashMap<String, ChannelMixSetting>,
    pub master_volume: f32, // 0.0 .. 1.0, domyślnie 1.0
    pub updated_at: String,
}

/// Encja projektu stemów (Stem Project).
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

/// Informacje o pakiecie modeli do pobrania w Model Managerze.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelPackInfo {
    pub id: String, // np. "pack_core_4stem", "pack_extended_6stem"
    pub name: String,
    pub description: String,
    pub category: String, // "Baza", "Wokal", "Perkusja", "Instrumentarium"
    pub unlocked_stems: Vec<String>,
    pub model_files: Vec<String>,
    pub total_size_bytes: u64,
    pub license: String,
    pub source_url: String,
    pub sha256: String,
    pub is_installed: bool,
    pub gpu_recommended: bool,
    pub speed_estimate_sec_per_min: f32, // Estymacja czasu na 1 minutę audio
}

// =========================================================================
// ZARZĄDZANIE KRZYWĄ GŁOŚNOŚCI (VOLUME MAPPING)
// 0% = cisza (-inf dB)
// 75% = unity gain (0 dB, 1.0x liniowo)
// 100% = +6.02 dB headroom boost (~2.0x liniowo)
// =========================================================================

/// Przelicza wartość suwaka [0.0 .. 1.0] na liniowy współczynnik wzmocnienia sygnału.
///
/// - `slider == 0.0` -> 0.0 (pełne wyciszenie / -inf dB)
/// - `slider == 0.75` -> 1.0 (unity gain / 0.0 dB)
/// - `slider == 1.0` -> ~2.0 (+6.02 dB)
pub fn slider_to_linear_gain(slider: f32) -> f32 {
    let v = slider.clamp(0.0, 1.0);
    if v <= 0.0001 {
        0.0
    } else if v <= 0.75 {
        // Płynna krzywa potęgowa symulująca zachowanie analogowego tłumika studyjnego
        let norm = v / 0.75;
        norm.powf(2.0)
    } else {
        // Płynny boost od 1.0 (0 dB) do 2.0 (+6.02 dB) w zakresie 75% - 100%
        let boost_norm = (v - 0.75) / 0.25;
        1.0 + boost_norm * (2.0f32 - 1.0)
    }
}

/// Przelicza liniowy współczynnik wzmocnienia na wartość suwaka [0.0 .. 1.0].
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

/// Zwraca wartość w decybelach (dB) dla podanej pozycji suwaka [0.0 .. 1.0].
pub fn slider_to_db(slider: f32) -> f32 {
    let gain = slider_to_linear_gain(slider);
    if gain <= 0.00001 {
        -100.0 // Reprezentacja ciszy
    } else {
        20.0 * gain.log10()
    }
}

/// Zwraca domyślny kolor HEX dla zadanego typu stemu.
pub fn default_stem_color(stem_id: &str) -> &'static str {
    match stem_id {
        // Wokale
        "lead_vocal" | "vocals" => "#f43f5e",   // Rose Pink
        "backing_vocals" | "choir" => "#fb7185", // Soft Rose
        // Perkusja
        "drums" => "#f59e0b",     // Amber
        "kick" => "#ea580c",      // Deep Orange
        "snare" => "#fbbf24",     // Warm Yellow
        "hihat" => "#fef08a",     // Bright Light Yellow
        "toms" => "#d97706",      // Ochre
        "cymbals" => "#fcd34d",   // Gold
        "percussion" => "#fb923c", // Orange
        // Bas
        "bass" => "#0ea5e9", // Vivid Cyan
        // Gitary
        "guitar" | "guitars" => "#10b981",    // Emerald Green
        "lead_guitar" => "#34d399",          // Light Emerald
        "rhythm_guitar" => "#059669",        // Deep Green
        "acoustic_guitar" => "#84cc16",      // Lime Green
        // Klawisze i Syntezatory
        "piano" => "#8b5cf6",         // Purple
        "electric_piano" => "#a855f7", // Violet
        "synth" => "#d946ef",         // Fuchsia / Neon Pink
        // Sekcja orkiestrowa
        "strings" => "#06b6d4",   // Cyan
        "brass" => "#eab308",     // Brass Gold
        "woodwinds" => "#14b8a6", // Teal
        // Pozostałe
        _ => "#94a3b8", // Slate Gray
    }
}

/// Zwraca czytelną etykietę stemu (PL / EN).
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
                "Hi-Hat"
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_volume_mapping_keypoints() {
        // 0% -> 0.0 gain (cisza)
        assert_eq!(slider_to_linear_gain(0.0), 0.0);
        assert!(slider_to_db(0.0) <= -90.0);

        // 75% -> 1.0 gain (0.0 dB unity gain)
        let gain_75 = slider_to_linear_gain(0.75);
        assert!((gain_75 - 1.0).abs() < 1e-5);
        assert!(slider_to_db(0.75).abs() < 1e-4);

        // 100% -> 2.0 gain (~+6.02 dB headroom boost)
        let gain_100 = slider_to_linear_gain(1.0);
        assert!((gain_100 - 2.0).abs() < 1e-5);
        assert!((slider_to_db(1.0) - 6.0206).abs() < 0.01);
    }

    #[test]
    fn test_volume_mapping_monotonicity_and_roundtrip() {
        let mut prev_gain = -1.0;
        for i in 0..=100 {
            let slider = i as f32 / 100.0;
            let gain = slider_to_linear_gain(slider);
            assert!(gain >= prev_gain, "Monotonicity violated at slider {}", slider);
            prev_gain = gain;

            let recovered_slider = linear_gain_to_slider(gain);
            assert!(
                (recovered_slider - slider).abs() < 1e-4,
                "Roundtrip failed for slider {}: got {}",
                slider,
                recovered_slider
            );
        }
    }

    #[test]
    fn test_default_stem_colors_and_labels() {
        assert_eq!(default_stem_color("lead_vocal"), "#f43f5e");
        assert_eq!(default_stem_color("kick"), "#ea580c");
        assert_eq!(default_stem_color("bass"), "#0ea5e9");
        assert_eq!(default_stem_color("piano"), "#8b5cf6");

        assert_eq!(default_stem_label("lead_vocal", true), "Wokal prowadzący");
        assert_eq!(default_stem_label("lead_vocal", false), "Lead Vocal");
        assert_eq!(default_stem_label("kick", true), "Stopa (Kick)");
        assert_eq!(default_stem_label("kick", false), "Kick Drum");
    }
}
