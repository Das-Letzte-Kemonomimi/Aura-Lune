//! Chord recognition (chromagram → cosine emissions → Viterbi), bar segmentation,
//! transposition and export.
//!
//! Flow: `chroma.rs` (STFT, peaks, tuning) → median chromagram per beat →
//! cosine similarity to templates → softmax with temperature → Viterbi → segments
//! (each one inside a single bar).

use super::chroma::{normalize_chroma, StftChroma};
use super::*;
use crate::AnalysisError;

pub use super::beat_grid::extract_beat_grid;
pub use super::chroma::extract_chroma_frame;

/// Chord algorithm version stored in the cache; entries from another version are ignored.
pub const CHORD_ANALYZER_VERSION: &str = "2.1.0-chroma-hmm";

/// Maximum length of analysed audio (seconds).
pub const CHORD_ANALYSIS_MAX_SECONDS: f64 = 900.0;

/// Probability of staying on the same chord on the next beat.
pub const SELF_TRANSITION_PROB: f64 = 0.4;
/// How much more likely a move by a fourth/fifth is than any other chord change.
pub const FOURTH_FIFTH_TRANSITION_BONUS: f64 = 2.0;
/// Softmax temperature of the emissions (lower = sharper evidence from the chromagram).
pub const EMISSION_TEMPERATURE: f64 = 0.1;
/// Similarity multiplier for seventh, sus, diminished and augmented chords.
pub const COMPLEX_CHORD_PRIOR: f64 = 0.92;
/// Weak probability boost for diatonic chords (≤ 1.1×).
pub const DIATONIC_PRIOR: f64 = 1.1;
/// Absolute RMS silence threshold.
const SILENCE_RMS_ABS: f64 = 1e-3;
/// A beat is silence when its RMS < this fraction of the track's median RMS.
const SILENCE_RMS_REL: f64 = 0.05;
/// Probability floor applied before taking the logarithm.
const MIN_PROB: f64 = 1e-12;

/// Chord definition used to build the chroma templates.
#[derive(Debug, Clone)]
pub struct ChordDef {
    pub root_idx: usize,
    pub quality: &'static str,
    pub symbol: String,
    pub template: [f64; 12],
    /// Cosine similarity multiplier (< 1 for extended chords, so triads win).
    pub prior: f64,
}

/// Builds the full set of chroma templates for 12 roots and 9 chord types (+ the silence / no-chord state).
pub fn generate_chord_templates() -> Vec<ChordDef> {
    let qualities: [(&str, &[usize], &[f64]); 9] = [
        ("maj", &[0, 4, 7], &[1.0, 0.8, 0.8]),
        ("min", &[0, 3, 7], &[1.0, 0.8, 0.8]),
        ("7", &[0, 4, 7, 10], &[1.0, 0.7, 0.7, 0.6]),
        ("maj7", &[0, 4, 7, 11], &[1.0, 0.7, 0.7, 0.6]),
        ("min7", &[0, 3, 7, 10], &[1.0, 0.7, 0.7, 0.6]),
        ("sus4", &[0, 5, 7], &[1.0, 0.8, 0.7]),
        ("sus2", &[0, 2, 7], &[1.0, 0.7, 0.7]),
        ("dim", &[0, 3, 6], &[1.0, 0.8, 0.8]),
        ("aug", &[0, 4, 8], &[1.0, 0.8, 0.8]),
    ];

    let mut defs = Vec::with_capacity(12 * 9 + 1);

    for (root, &root_name) in CHROMATIC_NOTES.iter().enumerate() {
        for (q_name, intervals, weights) in qualities.iter() {
            let mut template = [0.0; 12];
            for (idx, &interval) in intervals.iter().enumerate() {
                let note_idx = (root + interval) % 12;
                template[note_idx] = weights[idx];
            }
            normalize_chroma(&mut template);

            let suffix = match *q_name {
                "maj" => "",
                "min" => "m",
                "min7" => "m7",
                other => other,
            };
            let prior = if matches!(*q_name, "maj" | "min") {
                1.0
            } else {
                COMPLEX_CHORD_PRIOR
            };

            defs.push(ChordDef {
                root_idx: root,
                quality: q_name,
                symbol: format!("{root_name}{suffix}"),
                template,
                prior,
            });
        }
    }

    // Add the no-chord / silence state (No Chord = "N")
    defs.push(ChordDef {
        root_idx: 0,
        quality: "N",
        symbol: "N".to_string(),
        template: [0.0; 12],
        prior: 1.0,
    });

    defs
}

/// Derives a chord's root and quality from its symbol (e.g. `"Dm7"`, `"C#maj7/G"`); unknown
/// suffixes give the quality `"maj"`. Returns `("N", "N")` for no chord.
pub fn parse_chord_symbol(symbol: &str) -> (String, &'static str) {
    let main = symbol.trim().split('/').next().unwrap_or("");
    if main.is_empty() || main == "N" {
        return ("N".to_string(), "N");
    }
    let mut chars = main.chars();
    let mut root = String::new();
    if let Some(c) = chars.next() {
        root.push(c.to_ascii_uppercase());
    }
    let rest: String = chars.collect();
    let (accidental, suffix) = match rest.strip_prefix(['#', 'b']) {
        Some(tail) => (&rest[..1], tail),
        None => ("", rest.as_str()),
    };
    root.push_str(accidental);

    let quality = match suffix {
        "" | "M" => "maj",
        "m" | "min" | "-" => "min",
        "7" => "7",
        "maj7" | "M7" => "maj7",
        "m7" | "min7" | "-7" => "min7",
        "sus4" | "sus" => "sus4",
        "sus2" => "sus2",
        "dim" | "o" => "dim",
        "aug" | "+" => "aug",
        s if s.starts_with("maj") => "maj7",
        s if s.starts_with("min") || (s.starts_with('m') && !s.starts_with("ma")) => {
            if s.contains('7') {
                "min7"
            } else {
                "min"
            }
        }
        s if s.contains('7') => "7",
        _ => "maj",
    };
    (root, quality)
}

/// Emissions of one beat: `(probabilities, similarities)` for each state.
///
/// Similarity is the cosine of chromagram and template times the chord's `prior`. Probabilities are
/// the softmax of the similarities with temperature [`EMISSION_TEMPERATURE`], so the evidence scale
/// matches the transition probability scale. For silence the "N" state wins.
pub fn chord_emissions(
    chroma: &[f64; 12],
    silent: bool,
    defs: &[ChordDef],
) -> (Vec<f64>, Vec<f64>) {
    let no_chord = defs.len() - 1;
    let mut sims = vec![0.0f64; defs.len()];
    if silent {
        sims[no_chord] = 1.0;
    } else {
        for (idx, def) in defs.iter().enumerate().take(no_chord) {
            let dot: f64 = chroma
                .iter()
                .zip(def.template.iter())
                .map(|(c, t)| c * t)
                .sum();
            sims[idx] = (dot * def.prior).clamp(0.0, 1.0);
        }
    }
    let max = sims.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let mut probs: Vec<f64> = sims
        .iter()
        .map(|s| ((s - max) / EMISSION_TEMPERATURE).exp())
        .collect();
    let total: f64 = probs.iter().sum();
    for p in probs.iter_mut() {
        *p /= total;
    }
    (probs, sims)
}

/// Matrix of transition log-probabilities (row = previous state, column = next).
/// Rows are normalised; staying = [`SELF_TRANSITION_PROB`], the rest is spread evenly
/// with a [`FOURTH_FIFTH_TRANSITION_BONUS`] for moves by a fourth/fifth.
fn log_transition_matrix(defs: &[ChordDef]) -> Vec<f64> {
    let n = defs.len();
    let no_chord = n - 1;
    let mut log_trans = vec![0.0f64; n * n];
    for prev in 0..n {
        let weight = |next: usize| -> f64 {
            if next == prev {
                return 0.0;
            }
            if prev == no_chord || next == no_chord {
                return 1.0;
            }
            let diff = (defs[next].root_idx + 12 - defs[prev].root_idx) % 12;
            if diff == 5 || diff == 7 {
                FOURTH_FIFTH_TRANSITION_BONUS
            } else {
                1.0
            }
        };
        let total: f64 = (0..n).map(weight).sum();
        for next in 0..n {
            let p = if next == prev {
                SELF_TRANSITION_PROB
            } else {
                (1.0 - SELF_TRANSITION_PROB) * weight(next) / total
            };
            log_trans[prev * n + next] = p.max(MIN_PROB).ln();
        }
    }
    log_trans
}

/// Smooths the chord sequence with the Viterbi algorithm (HMM).
///
/// `emission_probs[t][s]` are emission probabilities (e.g. from [`chord_emissions`]). Transitions
/// are normalised, and the key only adds a weak diatonic prior ([`DIATONIC_PRIOR`]).
pub fn viterbi_smooth_chords(
    emission_probs: &[Vec<f64>],
    chord_defs: &[ChordDef],
    key_root: Option<usize>,
    key_is_minor: Option<bool>,
) -> Vec<usize> {
    if emission_probs.is_empty() {
        return Vec::new();
    }

    let num_frames = emission_probs.len();
    let n = chord_defs.len();

    let mut diatonic_log = vec![0.0f64; n];
    if let (Some(root), Some(minor)) = (key_root, key_is_minor) {
        let scale: &[usize] = if minor {
            &[0, 2, 3, 5, 7, 8, 10]
        } else {
            &[0, 2, 4, 5, 7, 9, 11]
        };
        for (idx, def) in chord_defs.iter().enumerate() {
            if def.quality != "N" && scale.contains(&((def.root_idx + 12 - root) % 12)) {
                diatonic_log[idx] = DIATONIC_PRIOR.ln();
            }
        }
    }

    let log_trans = log_transition_matrix(chord_defs);
    let log_emit = |t: usize, s: usize| emission_probs[t][s].max(MIN_PROB).ln() + diatonic_log[s];

    let mut score: Vec<f64> = (0..n).map(|s| log_emit(0, s)).collect();
    let mut next_score = vec![0.0f64; n];
    let mut backpointer = vec![0u16; num_frames * n];

    for t in 1..num_frames {
        for s in 0..n {
            let mut best = f64::NEG_INFINITY;
            let mut best_prev = 0usize;
            for (prev, &prev_score) in score.iter().enumerate() {
                let val = prev_score + log_trans[prev * n + s];
                if val > best {
                    best = val;
                    best_prev = prev;
                }
            }
            next_score[s] = best + log_emit(t, s);
            backpointer[t * n + s] = best_prev as u16;
        }
        std::mem::swap(&mut score, &mut next_score);
    }

    let mut best_last = 0usize;
    let mut best_val = f64::NEG_INFINITY;
    for (s, &v) in score.iter().enumerate() {
        if v > best_val {
            best_val = v;
            best_last = s;
        }
    }
    let mut path = vec![0usize; num_frames];
    path[num_frames - 1] = best_last;
    for t in (1..num_frames).rev() {
        path[t - 1] = backpointer[t * n + path[t]] as usize;
    }
    path
}

/// A single beat between two identical chords is noise, so it is absorbed.
fn absorb_single_beat_flickers(path: &mut [usize]) {
    for i in 1..path.len().saturating_sub(1) {
        if path[i] != path[i - 1] && path[i - 1] == path[i + 1] {
            path[i] = path[i - 1];
        }
    }
}

/// Runs the full harmonic analysis of audio samples (bar grid + chords + Viterbi).
pub fn detect_chords_from_samples(
    samples: &[f32],
    sample_rate: f64,
    bpm: f64,
    key_root: Option<usize>,
    key_is_minor: Option<bool>,
) -> (Vec<BeatPoint>, Vec<ChordSegment>) {
    let beat_grid = extract_beat_grid(samples, sample_rate, bpm);
    let chords = detect_chords_with_grid(samples, sample_rate, &beat_grid, key_root, key_is_minor);
    (beat_grid, chords)
}

/// Recognises chords on a given beat grid. Every returned segment fits in one bar
/// and carries its real bar number; the last segment reaches the end of the analysed audio.
/// Beats before the first downbeat (the pickup) are skipped.
pub fn detect_chords_with_grid(
    samples: &[f32],
    sample_rate: f64,
    beat_grid: &[BeatPoint],
    key_root: Option<usize>,
    key_is_minor: Option<bool>,
) -> Vec<ChordSegment> {
    let first = beat_grid.iter().position(|b| b.is_downbeat).unwrap_or(0);
    let beats = &beat_grid[first..];
    if beats.is_empty() || sample_rate <= 0.0 {
        return Vec::new();
    }
    let stft = StftChroma::compute(samples, sample_rate);
    if stft.chroma.is_empty() {
        return Vec::new();
    }
    let audio_end_ms = (samples.len() as f64 / sample_rate * 1000.0).round() as u64;

    let chord_defs = generate_chord_templates();
    let mut rms_sorted = stft.rms.clone();
    rms_sorted.sort_by(|a, b| a.total_cmp(b));
    let median_rms = rms_sorted[rms_sorted.len() / 2];
    let silence_rms = SILENCE_RMS_ABS.max(SILENCE_RMS_REL * median_rms);

    let mut emissions = Vec::with_capacity(beats.len());
    let mut similarities = Vec::with_capacity(beats.len());
    for (i, beat) in beats.iter().enumerate() {
        let end_ms = beats.get(i + 1).map_or(audio_end_ms, |b| b.time_ms);
        let (chroma, rms) = stft.beat_chroma(beat.time_ms as f64, end_ms as f64);
        let silent = rms < silence_rms || chroma.iter().all(|&c| c == 0.0);
        let (probs, sims) = chord_emissions(&chroma, silent, &chord_defs);
        emissions.push(probs);
        similarities.push(sims);
    }

    let mut path = viterbi_smooth_chords(&emissions, &chord_defs, key_root, key_is_minor);
    absorb_single_beat_flickers(&mut path);

    segments_per_bar(beats, &path, &similarities, &chord_defs, audio_end_ms)
}

/// Turns a chord path (one state per beat) into segments that never cross a bar line.
fn segments_per_bar(
    beats: &[BeatPoint],
    path: &[usize],
    similarities: &[Vec<f64>],
    chord_defs: &[ChordDef],
    audio_end_ms: u64,
) -> Vec<ChordSegment> {
    let mut segments = Vec::new();
    let mut bar = 0u32;
    let mut run_start = 0usize;
    let mut run_bar = 0u32;

    let flush = |run_start: usize, run_end: usize, run_bar: u32, segments: &mut Vec<_>| {
        let def = &chord_defs[path[run_start]];
        let start_ms = beats[run_start].time_ms;
        let end_ms = beats
            .get(run_end)
            .map_or(audio_end_ms.max(start_ms + 1), |b| b.time_ms);
        let confidence = (run_start..run_end)
            .map(|i| similarities[i][path[i]])
            .sum::<f64>()
            / (run_end - run_start) as f64;
        segments.push(ChordSegment {
            start_ms,
            end_ms,
            chord: def.symbol.clone(),
            root_note: CHROMATIC_NOTES[def.root_idx].to_string(),
            quality: def.quality.to_string(),
            bass_note: None,
            confidence: confidence as f32,
            beat: beats[run_start].beat_number,
            bar: run_bar,
        });
    };

    for (i, beat) in beats.iter().enumerate() {
        if beat.is_downbeat {
            bar += 1;
        }
        if i == 0 {
            run_bar = bar.max(1);
            continue;
        }
        if beat.is_downbeat || path[i] != path[run_start] {
            flush(run_start, i, run_bar, &mut segments);
            run_start = i;
            run_bar = bar.max(1);
        }
    }
    flush(run_start, beats.len(), run_bar, &mut segments);
    segments
}

/// Transposes a chord symbol by a number of semitones (slash chords such as C/G included).
pub fn transpose_chord(chord: &str, semitones: i32) -> String {
    let s = chord.trim();
    if s.is_empty() || s == "N" {
        return s.to_string();
    }

    if let Some((main, bass)) = s.split_once('/') {
        let trans_main = transpose_single_chord(main, semitones);
        let trans_bass = transpose_single_note(bass, semitones);
        return format!("{}/{}", trans_main, trans_bass);
    }

    transpose_single_chord(s, semitones)
}

fn transpose_single_chord(chord: &str, semitones: i32) -> String {
    let mut chars = chord.chars().peekable();
    let mut root = String::new();

    if let Some(c) = chars.next() {
        root.push(c);
        if let Some(next_c) = chars.peek().copied() {
            if next_c == '#' || next_c == 'b' {
                chars.next();
                root.push(next_c);
            }
        }
    }

    let remainder: String = chars.collect();
    let trans_root = transpose_single_note(&root, semitones);
    format!("{}{}", trans_root, remainder)
}

fn transpose_single_note(note: &str, semitones: i32) -> String {
    let clean = note.trim();
    let idx_opt = match clean.to_uppercase().as_str() {
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

    if let Some(idx) = idx_opt {
        let new_idx = (idx + semitones).rem_euclid(12) as usize;
        CHROMATIC_NOTES[new_idx].to_string()
    } else {
        note.to_string()
    }
}

/// Exports a chord set to the ChordPro format (.cho / .chordpro).
pub fn export_chords_to_chordpro(data: &TrackChordsData, title: &str, artist: &str) -> String {
    let mut out = String::new();
    out.push_str(&format!("{{title: {}}}\n", title));
    out.push_str(&format!("{{artist: {}}}\n", artist));
    out.push_str(&format!("{{key: {}}}\n", data.key));
    out.push_str(&format!("{{tempo: {:.1}}}\n", data.bpm));
    out.push_str("{comment: Generated by Auralune Music Analysis Engine}\n\n");

    let mut current_bar = 0u32;
    for seg in data.chords.iter() {
        if seg.bar != current_bar {
            if current_bar > 0 {
                out.push_str(" |\n");
            }
            current_bar = seg.bar;
            out.push_str(&format!("| [{}]", seg.chord));
        } else {
            out.push_str(&format!(" [{}]", seg.chord));
        }
    }
    if current_bar > 0 {
        out.push_str(" |\n");
    }

    out
}

/// Exports chords to a readable text format split into bars (| C | G | Am | F |).
pub fn export_chords_to_text(data: &TrackChordsData) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "Key: {} (Camelot: {}), Tempo: {:.1} BPM
",
        data.key, data.camelot, data.bpm
    ));
    out.push_str("====================================================\n\n");

    let mut current_bar = 0u32;
    let mut bars_in_line = 0;

    for seg in data.chords.iter() {
        if seg.bar != current_bar {
            if current_bar > 0 {
                out.push_str(" | ");
                bars_in_line += 1;
                if bars_in_line >= 4 {
                    out.push('\n');
                    bars_in_line = 0;
                }
            }
            current_bar = seg.bar;
            out.push_str(&format!("| {:<5}", seg.chord));
        } else {
            out.push_str(&format!(" {:<5}", seg.chord));
        }
    }
    if current_bar > 0 {
        out.push_str(" |\n");
    }

    out
}

/// Exports a chord set to JSON.
pub fn export_chords_to_json(data: &TrackChordsData) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(data)
}

/// Entry point of the harmonic analysis for a file path or URI.
///
/// Analyses the whole track (up to [`CHORD_ANALYSIS_MAX_SECONDS`]). A decode timeout
/// is an error, so an incomplete result never reaches the cache.
/// A trustworthy tempo from the file's tags takes precedence over acoustic detection.
pub fn analyze_track_chords_and_grid(
    uri_or_path: &str,
    track_id: i64,
) -> Result<TrackChordsData, AnalysisError> {
    let samples = decode_complete_for_analysis(uri_or_path, CHORD_ANALYSIS_MAX_SECONDS)?;
    let sample_rate = ANALYSIS_SAMPLE_RATE as f64;

    let bpm =
        read_bpm_tag(uri_or_path).unwrap_or_else(|| detect_bpm_from_samples(&samples, sample_rate));
    let (key_idx, is_minor) = detect_key_from_samples(&samples, sample_rate);
    let key_name = format!(
        "{} {}",
        CHROMATIC_NOTES[key_idx],
        if is_minor { "min" } else { "Maj" }
    );
    let camelot = if is_minor {
        CAMELOT_MINOR[key_idx].to_string()
    } else {
        CAMELOT_MAJOR[key_idx].to_string()
    };

    let (beat_grid, chords) =
        detect_chords_from_samples(&samples, sample_rate, bpm, Some(key_idx), Some(is_minor));

    let local = crate::uri::local_path(uri_or_path);
    let path = local.as_path();
    let file_hash = if path.exists() {
        calculate_file_sha256(path).unwrap_or_else(|_| "hash_unknown".to_string())
    } else {
        format!("hash_{}", track_id)
    };

    Ok(TrackChordsData {
        track_id,
        file_hash,
        bpm,
        key: key_name,
        camelot,
        beat_grid,
        chords,
        analyzer_version: CHORD_ANALYZER_VERSION.to_string(),
    })
}
