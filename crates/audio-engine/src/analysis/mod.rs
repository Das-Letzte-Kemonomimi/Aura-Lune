//! Automatic musical key and tempo (BPM) detection.
//!
//! Uses:
//! 1. The Krumhansl-Schmuckler key-finding algorithm on a chromagram profile (12 pitch classes)
//!    to detect the key (Major/Minor) and its Camelot code (e.g. 8A, 8B).
//! 2. Autocorrelation of the energy transient envelope (onset detection) to detect the BPM.
//! 3. Optional ID3/Vorbis tag metadata (BPM, TKEY/INITIALKEY) when available.

mod beat_grid;
mod chords;
mod chroma;
mod decode;
mod key_bpm;
mod replaygain;
mod silence;
mod transcription;
mod waveform;

pub use chords::*;
pub use decode::*;
pub use key_bpm::*;
pub use replaygain::*;
pub use silence::*;
pub use transcription::*;
pub use waveform::*;

use crate::model_manager::calculate_file_sha256;
use domain::analysis::{
    BeatPoint, ChordSegment, DetectedNote, TrackChordsData, TrackTranscriptionData,
};
use serde::{Deserialize, Serialize};

pub const CHROMATIC_NOTES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// Camelot Wheel:
// Minor: 1A=G#m, 2A=D#m, 3A=A#m, 4A=Fm, 5A=Cm, 6A=Gm, 7A=Dm, 8A=Am, 9A=Em, 10A=Bm, 11A=F#m, 12A=C#m
pub const CAMELOT_MINOR: [&str; 12] = [
    "5A",  // C
    "12A", // C#
    "7A",  // D
    "2A",  // D#
    "9A",  // E
    "4A",  // F
    "11A", // F#
    "6A",  // G
    "1A",  // G#
    "8A",  // A
    "3A",  // A#
    "10A", // B
];

// Major: 1B=B, 2B=F#, 3B=Db, 4B=Ab, 5B=Eb, 6B=Bb, 7B=F, 8B=C, 9B=G, 10B=D, 11B=A, 12B=E
pub const CAMELOT_MAJOR: [&str; 12] = [
    "8B",  // C
    "3B",  // C# (Db)
    "10B", // D
    "5B",  // D# (Eb)
    "12B", // E
    "7B",  // F
    "2B",  // F#
    "9B",  // G
    "4B",  // G# (Ab)
    "11B", // A
    "6B",  // A# (Bb)
    "1B",  // B
];

// Krumhansl-Schmuckler profiles (weights for the major and minor scales)
const KRUMHANSL_MAJOR: [f64; 12] = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const KRUMHANSL_MINOR: [f64; 12] = [
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

/// Key and tempo detection result for a track.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackKeyBpm {
    pub bpm: f64,
    pub key_name: String,      // np. "A min", "C Maj"
    pub camelot: String,       // np. "8A", "8B"
    pub base_key_index: usize, // 0 = C, 1 = C#, ..., 9 = A, 11 = B
    pub is_minor: bool,
    pub source: String, // "tag" or "acoustic"
}

/// Parses a string holding a musical key (Camelot or letter notation).
pub fn parse_musical_key(raw: &str) -> Option<(usize, bool)> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }

    let upper = s.to_uppercase();

    // Check the Camelot wheel (e.g. "8A", "8B", "11A", "4B")
    if let Some(c) = upper.strip_suffix('A') {
        if let Ok(num) = c.parse::<usize>() {
            let target = format!("{}A", num);
            for (idx, cam) in CAMELOT_MINOR.iter().enumerate() {
                if *cam == target {
                    return Some((idx, true));
                }
            }
        }
    }
    if let Some(c) = upper.strip_suffix('B') {
        if let Ok(num) = c.parse::<usize>() {
            let target = format!("{}B", num);
            for (idx, cam) in CAMELOT_MAJOR.iter().enumerate() {
                if *cam == target {
                    return Some((idx, false));
                }
            }
        }
    }

    // Check the standard notation (Am, C#m, C Maj, G#, F# minor, etc.)
    let is_minor = upper.contains("MIN") || (upper.contains('M') && !upper.contains("MAJ"));

    let note_part = s
        .chars()
        .take_while(|c| c.is_alphabetic() || *c == '#' || *c == 'b')
        .collect::<String>();
    let clean_note = if note_part.ends_with('m') || note_part.ends_with('M') {
        &note_part[..note_part.len() - 1]
    } else {
        &note_part
    };

    let mapped_note = match clean_note.to_uppercase().as_str() {
        "C" => Some(0),
        "C#" | "DB" => Some(1),
        "D" => Some(2),
        "D#" | "EB" => Some(3),
        "E" => Some(4),
        "F" => Some(5),
        "F#" | "GB" => Some(6),
        "G" => Some(7),
        "G#" | "AB" => Some(8),
        "A" => Some(9),
        "A#" | "BB" => Some(10),
        "B" => Some(11),
        _ => None,
    };

    mapped_note.map(|idx| (idx, is_minor))
}
