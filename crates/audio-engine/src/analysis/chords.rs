//! Rozpoznawanie akordów (chromagram + Viterbi), siatka beatów, transpozycja i eksport.

use super::*;
use crate::AnalysisError;
use std::f64::consts::PI;

/// Struktura definicji akordu dla szablonów chromatycznych.
#[derive(Debug, Clone)]
pub struct ChordDef {
    pub root_idx: usize,
    pub quality: &'static str,
    pub symbol: String,
    pub template: [f64; 12],
}

/// Generuje komplet szablonów chromagramu dla 12 tonacji i 9 typów akordów (+ stan ciszy/brak akordu).
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
            // Normalizacja L2 szablonu
            let norm = template.iter().map(|&w| w * w).sum::<f64>().sqrt();
            if norm > 1e-6 {
                for w in template.iter_mut() {
                    *w /= norm;
                }
            }

            let symbol = match *q_name {
                "maj" => root_name.to_string(),
                "min" => format!("{}m", root_name),
                "7" => format!("{}7", root_name),
                "maj7" => format!("{}maj7", root_name),
                "min7" => format!("{}m7", root_name),
                "sus4" => format!("{}sus4", root_name),
                "sus2" => format!("{}sus2", root_name),
                "dim" => format!("{}dim", root_name),
                "aug" => format!("{}aug", root_name),
                _ => format!("{}{}", root_name, q_name),
            };

            defs.push(ChordDef {
                root_idx: root,
                quality: q_name,
                symbol,
                template,
            });
        }
    }

    // Dodanie stanu braku akordu / ciszy (No Chord = "N")
    defs.push(ChordDef {
        root_idx: 0,
        quality: "N",
        symbol: "N".to_string(),
        template: [0.0; 12],
    });

    defs
}

/// Ekstrahuje wektor chromagramu (12 klas wysokości dźwięku) dla pojedynczej klatki próbek PCM
/// przy użyciu algorytmu Goertzela dla częstotliwości stroju równomiernie temperowanego (C2 do B5).
pub fn extract_chroma_frame(frame: &[f32], sample_rate: f64) -> [f64; 12] {
    let mut chroma = [0.0f64; 12];
    if frame.len() < 128 {
        return chroma;
    }

    let n = frame.len() as f64;

    // Zakres oktaw od C2 (MIDI 36, ~65.4 Hz) do B5 (MIDI 71, ~987.8 Hz)
    for midi in 36..=71 {
        let pitch_class = (midi % 12) as usize;
        let freq = 440.0 * 2.0f64.powf((midi as f64 - 69.0) / 12.0);
        let k = (n * freq / sample_rate).round();
        if k < 1.0 || k >= (frame.len() / 2) as f64 {
            continue;
        }

        let omega = 2.0 * PI * k / n;
        let coeff = 2.0 * omega.cos();

        let mut s1 = 0.0;
        let mut s2 = 0.0;

        for &sample in frame.iter() {
            let s0 = (sample as f64) + coeff * s1 - s2;
            s2 = s1;
            s1 = s0;
        }

        let power = s1 * s1 + s2 * s2 - s1 * s2 * coeff;
        chroma[pitch_class] += power.max(0.0);
    }

    // Normalizacja wektora energii chromatycznej L2
    let norm = chroma.iter().map(|&v| v * v).sum::<f64>().sqrt();
    if norm > 1e-5 {
        for v in chroma.iter_mut() {
            *v /= norm;
        }
    } else {
        chroma = [0.0; 12];
    }

    chroma
}

/// Wyznacza siatkę uderzeń (Beat Grid) na podstawie próbek audio i wykrytego tempa BPM.
pub fn extract_beat_grid(samples: &[f32], sample_rate: f64, bpm: f64) -> Vec<BeatPoint> {
    if samples.is_empty() || bpm <= 10.0 {
        return Vec::new();
    }

    let beat_duration_sec = 60.0 / bpm;
    let beat_duration_ms = (beat_duration_sec * 1000.0).round();
    let total_duration_sec = samples.len() as f64 / sample_rate;
    let total_duration_ms = (total_duration_sec * 1000.0).round() as u64;

    // Poszukaj pierwszego silnego uderzenia (transjentu) w pierwszych 4 uderzeniach utworu
    let scan_samples = ((beat_duration_sec * 4.0) * sample_rate) as usize;
    let search_window = scan_samples.min(samples.len());

    let hop_size = 256;
    let num_hops = search_window / hop_size;
    let mut best_hop = 0;
    let mut max_energy = 0.0f64;

    for h in 0..num_hops {
        let chunk = &samples[h * hop_size..(h + 1) * hop_size];
        let energy: f64 = chunk.iter().map(|&s| (s as f64) * (s as f64)).sum();
        if energy > max_energy {
            max_energy = energy;
            best_hop = h;
        }
    }

    let initial_offset_sec = (best_hop * hop_size) as f64 / sample_rate;
    let mut current_time_ms = ((initial_offset_sec % beat_duration_sec) * 1000.0).round() as u64;

    let mut beat_grid = Vec::new();
    let mut beat_count = 0u32;

    while current_time_ms < total_duration_ms {
        let beat_in_bar = (beat_count % 4) + 1;
        beat_grid.push(BeatPoint {
            time_ms: current_time_ms,
            beat_number: beat_in_bar,
            is_downbeat: beat_in_bar == 1,
        });

        current_time_ms += beat_duration_ms as u64;
        beat_count += 1;
    }

    beat_grid
}

/// Wygładzanie sekwencji akordów algorytmem Viterbiego (HMM) z faworyzowaniem ciągłości taktu
/// oraz tonacji diatonicznej utworu.
pub fn viterbi_smooth_chords(
    emission_scores: &[Vec<f64>],
    chord_defs: &[ChordDef],
    key_root: Option<usize>,
    key_is_minor: Option<bool>,
) -> Vec<usize> {
    if emission_scores.is_empty() {
        return Vec::new();
    }

    let num_frames = emission_scores.len();
    let num_states = chord_defs.len();
    let no_chord_idx = num_states - 1;

    // Profil wag diatonicznych jeśli znana jest tonacja utworu
    let mut diatonic_bias = vec![1.0f64; num_states];
    if let (Some(root), Some(minor)) = (key_root, key_is_minor) {
        let diatonic_intervals: &[usize] = if minor {
            // Skala naturalna molowa: I, ii°, III, iv, v, VI, VII (np. Am -> Am, Bdim, C, Dm, Em, F, G)
            &[0, 2, 3, 5, 7, 8, 10]
        } else {
            // Skala durowa: I, ii, iii, IV, V, vi, vii° (np. C -> C, Dm, Em, F, G, Am, Bdim)
            &[0, 2, 4, 5, 7, 9, 11]
        };

        for (idx, def) in chord_defs.iter().enumerate() {
            if def.quality == "N" {
                continue;
            }
            let interval = (def.root_idx + 12 - root) % 12;
            if diatonic_intervals.contains(&interval) {
                diatonic_bias[idx] = 1.35; // Bonus za zgodność ze skalą utworu
            } else {
                diatonic_bias[idx] = 0.85; // Lekka kara za akordy poza tonacją
            }
        }
    }

    // viterbi DP table: [frame][state]
    let mut v = vec![vec![f64::NEG_INFINITY; num_states]; num_frames];
    let mut backpointer = vec![vec![0usize; num_states]; num_frames];

    // Inicjalizacja pierwszej klatki
    for s in 0..num_states {
        let emit = emission_scores[0][s].max(1e-6);
        v[0][s] = emit.ln() + (diatonic_bias[s]).ln();
    }

    // Pętla dynamicznego programowania
    for t in 1..num_frames {
        for s in 0..num_states {
            let mut best_val = f64::NEG_INFINITY;
            let mut best_prev = 0usize;

            for prev_s in 0..num_states {
                // Prawdopodobieństwo przejścia:
                // Pozostanie w tym samym akordzie ma wysoką wagę (0.80),
                // przejście do innego akordu (0.20), przejście do ciszy (0.05).
                let trans_prob: f64 = if prev_s == s {
                    0.82
                } else if s == no_chord_idx || prev_s == no_chord_idx {
                    0.05
                } else {
                    // Sprawdź czy odległość kwintowa (V lub IV)
                    let r1 = chord_defs[prev_s].root_idx;
                    let r2 = chord_defs[s].root_idx;
                    let diff = (r2 + 12 - r1) % 12;
                    if diff == 7 || diff == 5 {
                        0.15
                    } else {
                        0.08
                    }
                };

                let val = v[t - 1][prev_s] + trans_prob.ln();
                if val > best_val {
                    best_val = val;
                    best_prev = prev_s;
                }
            }

            let emit = emission_scores[t][s].max(1e-6);
            v[t][s] = best_val + emit.ln() + (diatonic_bias[s]).ln();
            backpointer[t][s] = best_prev;
        }
    }

    // Backtracking
    let mut path = vec![0usize; num_frames];
    let mut max_final = f64::NEG_INFINITY;
    let mut best_last = 0usize;

    for (s, &score) in v[num_frames - 1].iter().enumerate().take(num_states) {
        if score > max_final {
            max_final = score;
            best_last = s;
        }
    }
    path[num_frames - 1] = best_last;

    for t in (1..num_frames).rev() {
        path[t - 1] = backpointer[t][path[t]];
    }

    path
}

/// Wykonuje pełną analizę harmoniczną próbek audio (siatka taktowa + akordy + Viterbi).
pub fn detect_chords_from_samples(
    samples: &[f32],
    sample_rate: f64,
    bpm: f64,
    key_root: Option<usize>,
    key_is_minor: Option<bool>,
) -> (Vec<BeatPoint>, Vec<ChordSegment>) {
    let beat_grid = extract_beat_grid(samples, sample_rate, bpm);
    if beat_grid.is_empty() || samples.len() < 2048 {
        return (beat_grid, Vec::new());
    }

    let chord_defs = generate_chord_templates();
    let num_defs = chord_defs.len();
    let no_chord_idx = num_defs - 1;

    // Analiza w oknach uderzeń (per-beat analysis)
    let mut emission_scores = Vec::with_capacity(beat_grid.len());

    let frame_len = (sample_rate * 0.45).round() as usize; // ok. 450 ms okna analizy

    for (i, beat) in beat_grid.iter().enumerate() {
        let start_sample = ((beat.time_ms as f64 / 1000.0) * sample_rate) as usize;
        let end_sample = if i + 1 < beat_grid.len() {
            ((beat_grid[i + 1].time_ms as f64 / 1000.0) * sample_rate) as usize
        } else {
            (start_sample + frame_len).min(samples.len())
        };

        if start_sample >= samples.len() {
            break;
        }

        let slice = &samples[start_sample..end_sample.min(samples.len())];
        let chroma = extract_chroma_frame(slice, sample_rate);

        let energy_sum: f64 = chroma.iter().sum();
        let mut scores = vec![0.0f64; num_defs];

        if energy_sum < 1e-4 {
            // Cisza / brak energii
            scores[no_chord_idx] = 1.0;
        } else {
            for (idx, def) in chord_defs.iter().enumerate() {
                if idx == no_chord_idx {
                    scores[idx] = 0.05; // Niski koszt dla ciszy w trakcie muzyki
                } else {
                    // Cosine similarity
                    let dot: f64 = chroma
                        .iter()
                        .zip(def.template.iter())
                        .map(|(&c, &t)| c * t)
                        .sum();
                    scores[idx] = dot.max(0.01).powf(1.8); // Nieliniowe wzmocnienie szczytu
                }
            }
        }

        emission_scores.push(scores);
    }

    if emission_scores.is_empty() {
        return (beat_grid, Vec::new());
    }

    // Wygładzenie HMM (Viterbi)
    let best_path = viterbi_smooth_chords(&emission_scores, &chord_defs, key_root, key_is_minor);

    // Grupowanie identycznych sąsiadujących akordów w spójne segmenty czasowe
    let mut segments = Vec::new();
    let mut seg_start_idx = 0usize;

    for i in 1..best_path.len() {
        if best_path[i] != best_path[seg_start_idx] {
            let chord_idx = best_path[seg_start_idx];
            let def = &chord_defs[chord_idx];
            let start_ms = beat_grid[seg_start_idx].time_ms;
            let end_ms = beat_grid[i].time_ms;
            let bar = (seg_start_idx as u32 / 4) + 1;
            let beat = (seg_start_idx as u32 % 4) + 1;

            let conf = emission_scores[seg_start_idx][chord_idx].min(1.0) as f32;

            segments.push(ChordSegment {
                start_ms,
                end_ms,
                chord: def.symbol.clone(),
                root_note: CHROMATIC_NOTES[def.root_idx].to_string(),
                quality: def.quality.to_string(),
                bass_note: None,
                confidence: conf,
                beat,
                bar,
            });

            seg_start_idx = i;
        }
    }

    // Ostatni segment
    if seg_start_idx < best_path.len() {
        let chord_idx = best_path[seg_start_idx];
        let def = &chord_defs[chord_idx];
        let start_ms = beat_grid[seg_start_idx].time_ms;
        let end_ms = if best_path.len() < beat_grid.len() {
            beat_grid
                .last()
                .map(|b| b.time_ms)
                .unwrap_or(start_ms + 1000)
        } else {
            start_ms + ((60.0 / bpm) * 1000.0) as u64
        };
        let bar = (seg_start_idx as u32 / 4) + 1;
        let beat = (seg_start_idx as u32 % 4) + 1;
        let conf = emission_scores[seg_start_idx][chord_idx].min(1.0) as f32;

        segments.push(ChordSegment {
            start_ms,
            end_ms,
            chord: def.symbol.clone(),
            root_note: CHROMATIC_NOTES[def.root_idx].to_string(),
            quality: def.quality.to_string(),
            bass_note: None,
            confidence: conf,
            beat,
            bar,
        });
    }

    (beat_grid, segments)
}

/// Transponuje symbol akordu o zadaną liczbę półtonów (z obsługą notacji z basem np. C/G).
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
        if let Some(&next_c) = chars.peek() {
            if next_c == '#' || next_c == 'b' {
                root.push(chars.next().unwrap());
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

/// Eksportuje zbiór akordów do profesjonalnego formatu ChordPro (.cho / .chordpro).
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

/// Eksportuje akordy do czytelnego formatu tekstowego z podziałem na takty (| C | G | Am | F |).
pub fn export_chords_to_text(data: &TrackChordsData) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "Klucz: {} (Camelot: {}), Tempo: {:.1} BPM\n",
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

/// Eksportuje zbiór akordów do formatu JSON.
pub fn export_chords_to_json(data: &TrackChordsData) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(data)
}

/// Główna funkcja wykonująca analizę harmoniczną dla podanej ścieżki pliku lub URI.
pub fn analyze_track_chords_and_grid(
    uri_or_path: &str,
    track_id: i64,
) -> Result<TrackChordsData, AnalysisError> {
    // 1. Zdekoduj próbki do analizy (do 360 sekund)
    let samples = decode_snippet_for_analysis(uri_or_path, 360.0)?;
    let sample_rate = 22050.0;

    // 2. Wykryj BPM i tonację
    let bpm = detect_bpm_from_samples(&samples, sample_rate);
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

    // 3. Detekcja siatki taktów i akordów
    let (beat_grid, chords) =
        detect_chords_from_samples(&samples, sample_rate, bpm, Some(key_idx), Some(is_minor));

    // 4. Obliczenie hasha pliku dla unikalnego cache
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
        analyzer_version: "1.1.0-classic".to_string(),
    })
}
