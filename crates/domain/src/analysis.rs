//! Modele domenowe dla analizy muzycznej (akordy, transkrypcja nutowa, separacja ścieżek, modele AI).

use serde::{Deserialize, Serialize};

/// Informacje o akordzie w zadanym przedziale czasowym.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChordSegment {
    pub start_ms: u64,
    pub end_ms: u64,
    pub chord: String,             // np. "C", "Am", "G7", "Fmaj7", "N" (No chord)
    pub root_note: String,         // np. "C", "A", "G"
    pub quality: String,           // np. "maj", "min", "7", "maj7", "min7", "sus4", "dim", "aug"
    pub bass_note: Option<String>, // np. "G" w "C/G" (slash chords)
    pub confidence: f32,           // 0.0 .. 1.0
    pub beat: u32,                 // numer uderzenia w takcie (1, 2, 3, 4)
    pub bar: u32,                  // numer taktu (1, 2, 3...)
}

/// Pojedynczy punkt siatki taktowej (Beat Grid).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BeatPoint {
    pub time_ms: u64,
    pub beat_number: u32,  // 1, 2, 3, 4...
    pub is_downbeat: bool, // true dla 1. uderzenia taktu
}

/// Zestaw danych harmonicznych i siatki rytmicznej dla utworu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackChordsData {
    pub track_id: i64,
    pub file_hash: String,
    pub bpm: f64,
    pub key: String,     // np. "C Maj", "A min"
    pub camelot: String, // np. "8B", "8A"
    pub beat_grid: Vec<BeatPoint>,
    pub chords: Vec<ChordSegment>,
    pub analyzer_version: String,
}

/// Pojedyncza nuta wykryta w procesie polifonicznej transkrypcji nutowej.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DetectedNote {
    pub onset_ms: u64,
    pub duration_ms: u64,
    pub midi_pitch: u8,       // 0 .. 127 (60 = C4)
    pub pitch_name: String,   // np. "C4", "A#3", "F5"
    pub cents_offset: i8,     // odchylenie od stroju równomiernie temperowanego (-50 .. +50)
    pub velocity: u8,         // 1 .. 127
    pub stem: Option<String>, // np. "vocals", "bass", "piano", "guitar"
}

/// Zestaw nut transkrypcji utworu (dla Piano-Roll i eksportu MIDI).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackTranscriptionData {
    pub track_id: i64,
    pub file_hash: String,
    pub notes: Vec<DetectedNote>,
    pub bpm: f64,
    pub analyzer_version: String,
}

/// Metadane rozdzielonych ścieżek audio (Stems) dla utworu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemSeparationData {
    pub track_id: i64,
    pub file_hash: String,
    pub model_name: String,
    pub stems_dir: String,
    pub vocals_path: String,
    pub drums_path: String,
    pub bass_path: String,
    pub other_path: String,
    pub piano_path: Option<String>,
    pub guitar_path: Option<String>,
}

/// Typ zadania modelu uczenia maszynowego.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum AiTaskType {
    StemSeparation,
    ChordDetection,
    NoteTranscription,
}

impl AiTaskType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AiTaskType::StemSeparation => "stem_separation",
            AiTaskType::ChordDetection => "chord_detection",
            AiTaskType::NoteTranscription => "note_transcription",
        }
    }

    pub fn from_str_repr(s: &str) -> Option<Self> {
        match s {
            "stem_separation" => Some(AiTaskType::StemSeparation),
            "chord_detection" => Some(AiTaskType::ChordDetection),
            "note_transcription" => Some(AiTaskType::NoteTranscription),
            _ => None,
        }
    }
}

/// Informacje o modelu AI zarejestrowanym w menedżerze modeli.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AiModelInfo {
    pub id: String,   // unikalny identyfikator, np. "htdemucs_v4", "basic_pitch"
    pub name: String, // czytelna nazwa, np. "HTDemucs v4 (4-Stem Studio)"
    pub task_type: AiTaskType,
    pub file_path: String,
    pub file_size: u64,
    pub sha256: String,
    pub license: String, // np. "MIT", "Apache-2.0"
    pub download_url: Option<String>,
    pub is_installed: bool,
    pub description: String,
}

/// Możliwości silnika analizy muzycznej raportowane frontendowi.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisCapabilities {
    pub ml_enabled: bool,
    pub onnx_available: bool,
    pub gpu_available: bool,
    pub acceleration_provider: String, // "CPU", "CUDA", "ROCm", "Vulkan", "None"
    pub models: Vec<AiModelInfo>,
}

/// Stan miksera ścieżek (Stem Mixer).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StemMixerState {
    pub enabled: bool,
    pub vocals_volume: f32, // 0.0 .. 1.5 (1.0 = 0 dB)
    pub drums_volume: f32,
    pub bass_volume: f32,
    pub other_volume: f32,
    pub piano_volume: f32,
    pub guitar_volume: f32,
    pub vocals_mute: bool,
    pub drums_mute: bool,
    pub bass_mute: bool,
    pub other_mute: bool,
    pub piano_mute: bool,
    pub guitar_mute: bool,
    pub solo_stem: Option<String>, // np. Some("vocals")
    pub karaoke_mode: bool,        // szybkie wyciszenie wokalu (vocals_mute = true)
}

impl Default for StemMixerState {
    fn default() -> Self {
        Self {
            enabled: false,
            vocals_volume: 1.0,
            drums_volume: 1.0,
            bass_volume: 1.0,
            other_volume: 1.0,
            piano_volume: 1.0,
            guitar_volume: 1.0,
            vocals_mute: false,
            drums_mute: false,
            bass_mute: false,
            other_mute: false,
            piano_mute: false,
            guitar_mute: false,
            solo_stem: None,
            karaoke_mode: false,
        }
    }
}
