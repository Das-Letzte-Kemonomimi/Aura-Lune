//! Note transcription and export to MIDI/JSON.

use super::*;
use crate::AnalysisError;
use std::f64::consts::PI;

/// Transcription algorithm version. Changing it invalidates stored results (the cache is versioned).
pub const TRANSCRIPTION_ANALYZER_VERSION: &str = "1.2.0-salience-f64";

/// Start time (ms) of the frame with the given index, computed in `f64` (no accumulated truncated step).
fn frame_to_ms(frame: u64, hop_ms: f64) -> u64 {
    (frame as f64 * hop_ms).round() as u64
}

/// Converts a MIDI note number (0 .. 127) to a readable pitch name (e.g. 60 -> "C4", 69 -> "A4").
pub fn midi_pitch_to_name(pitch: u8) -> String {
    let note_names = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    let note = note_names[(pitch % 12) as usize];
    let octave = (pitch / 12) as i32 - 1;
    format!("{}{}", note, octave)
}

/// Detects notes in a PCM sample buffer (spectral peak tracking with pitch salience).
pub fn detect_notes_from_samples(
    samples: &[f32],
    sample_rate: f64,
    stem_name: Option<&str>,
) -> Vec<DetectedNote> {
    if samples.is_empty() || sample_rate < 8000.0 {
        return Vec::new();
    }

    let window_size = 2048;
    let hop_size = 1024;
    // Fractional frame step (ms): truncating to an integer (46.44 → 46) moved notes ~1% earlier.
    let hop_ms = hop_size as f64 / sample_rate * 1000.0;
    let num_frames = if samples.len() > window_size {
        (samples.len() - window_size) / hop_size
    } else {
        0
    };

    if num_frames == 0 {
        return Vec::new();
    }

    // MIDI range: E1 (28) to C7 (96)
    let min_midi = 28u8;
    let max_midi = 96u8;
    let num_pitches = (max_midi - min_midi + 1) as usize;

    // Precompute the frequency of every MIDI note
    let mut pitch_freqs = Vec::with_capacity(num_pitches);
    for m in min_midi..=max_midi {
        let freq = 440.0 * 2.0f64.powf((m as f64 - 69.0) / 12.0);
        pitch_freqs.push(freq);
    }

    // Low notes round to the same Goertzel bin `k` (≈10.8 Hz bins at 22.05 kHz), so each distinct
    // bin is filtered once per frame and its power shared by every pitch that maps to it.
    let mut bin_coeffs: Vec<(f64, f64)> = Vec::new(); // (k, 2·cos ω)
    let pitch_bins: Vec<Option<usize>> = pitch_freqs
        .iter()
        .map(|&freq| {
            let k = (window_size as f64 * freq / sample_rate).round();
            if k < 1.0 || k >= (window_size / 2) as f64 {
                return None;
            }
            if bin_coeffs.last().map(|&(last_k, _)| last_k) != Some(k) {
                let omega = 2.0 * PI * k / (window_size as f64);
                bin_coeffs.push((k, 2.0 * omega.cos()));
            }
            Some(bin_coeffs.len() - 1)
        })
        .collect();

    let mut active_notes: Vec<(u8, u64, u64, f64)> = Vec::new(); // (midi_pitch, start_frame, last_frame, max_energy)
    let mut finished_notes: Vec<DetectedNote> = Vec::new();
    // Per-frame buffers, reused across frames.
    let mut bin_powers = vec![0.0f64; bin_coeffs.len()];
    let mut frame_energies = vec![0.0f64; num_pitches];
    let mut current_frame_pitches: Vec<(u8, f64)> = Vec::new();
    let mut still_active: Vec<bool> = Vec::new();

    for f_idx in 0..num_frames {
        let start = f_idx * hop_size;
        let end = start + window_size;
        let frame = &samples[start..end];

        let rms = (frame.iter().map(|&s| (s as f64) * (s as f64)).sum::<f64>()
            / frame.len() as f64)
            .sqrt();
        if rms < 0.005 {
            finalize_active_notes(&mut active_notes, &mut finished_notes, hop_ms, stem_name);
            continue;
        }

        for (power, &(_, coeff)) in bin_powers.iter_mut().zip(&bin_coeffs) {
            let mut s1 = 0.0;
            let mut s2 = 0.0;
            for &sample in frame.iter() {
                let s0 = (sample as f64) + coeff * s1 - s2;
                s2 = s1;
                s1 = s0;
            }
            *power = (s1 * s1 + s2 * s2 - s1 * s2 * coeff).max(0.0);
        }

        let mut max_p_energy = 0.0f64;
        for (energy, bin) in frame_energies.iter_mut().zip(&pitch_bins) {
            *energy = bin.map_or(0.0, |b| bin_powers[b]);
            if *energy > max_p_energy {
                max_p_energy = *energy;
            }
        }

        let threshold = (max_p_energy * 0.25).max(1e-4);
        current_frame_pitches.clear();

        for (p_idx, &energy) in frame_energies.iter().enumerate() {
            if energy >= threshold {
                let is_local_max = (p_idx == 0 || energy >= frame_energies[p_idx - 1])
                    && (p_idx + 1 == num_pitches || energy >= frame_energies[p_idx + 1]);
                if is_local_max {
                    let midi_pitch = min_midi + p_idx as u8;
                    current_frame_pitches.push((midi_pitch, energy));
                }
            }
        }

        still_active.clear();
        still_active.resize(active_notes.len(), false);
        for &(midi, energy) in &current_frame_pitches {
            if let Some(pos) = active_notes.iter().position(|n| n.0 == midi) {
                still_active[pos] = true;
                active_notes[pos].2 = f_idx as u64;
                if energy > active_notes[pos].3 {
                    active_notes[pos].3 = energy;
                }
            } else {
                active_notes.push((midi, f_idx as u64, f_idx as u64, energy));
                still_active.push(true);
            }
        }

        let mut i = 0;
        while i < active_notes.len() {
            if !still_active[i] {
                let (midi, start_f, last_f, max_e) = active_notes.remove(i);
                still_active.remove(i);
                if last_f > start_f {
                    let onset_ms = frame_to_ms(start_f, hop_ms);
                    let duration_ms = frame_to_ms(last_f - start_f + 1, hop_ms).max(50);
                    let vel = ((max_e.sqrt() * 100.0).clamp(40.0, 127.0)) as u8;
                    finished_notes.push(DetectedNote {
                        onset_ms,
                        duration_ms,
                        midi_pitch: midi,
                        pitch_name: midi_pitch_to_name(midi),
                        cents_offset: 0,
                        velocity: vel,
                        stem: stem_name.map(|s| s.to_string()),
                    });
                }
            } else {
                i += 1;
            }
        }
    }

    finalize_active_notes(&mut active_notes, &mut finished_notes, hop_ms, stem_name);

    finished_notes.sort_by_key(|n| n.onset_ms);
    finished_notes
}

fn finalize_active_notes(
    active_notes: &mut Vec<(u8, u64, u64, f64)>,
    finished_notes: &mut Vec<DetectedNote>,
    hop_ms: f64,
    stem_name: Option<&str>,
) {
    for (midi, start_f, last_f, max_e) in active_notes.drain(..) {
        if last_f > start_f {
            let onset_ms = frame_to_ms(start_f, hop_ms);
            let duration_ms = frame_to_ms(last_f - start_f + 1, hop_ms).max(50);
            let vel = ((max_e.sqrt() * 100.0).clamp(40.0, 127.0)) as u8;
            finished_notes.push(DetectedNote {
                onset_ms,
                duration_ms,
                midi_pitch: midi,
                pitch_name: midi_pitch_to_name(midi),
                cents_offset: 0,
                velocity: vel,
                stem: stem_name.map(|s| s.to_string()),
            });
        }
    }
}

/// Exports the detected notes to a standard MIDI file (.mid, SMF Type 0/1).
pub fn export_transcription_to_midi(notes: &[DetectedNote], bpm: f64) -> Vec<u8> {
    let safe_bpm = if (20.0..=400.0).contains(&bpm) {
        bpm
    } else {
        120.0
    };
    let ppq: u16 = 480;

    let mut stem_groups: std::collections::BTreeMap<String, Vec<&DetectedNote>> =
        std::collections::BTreeMap::new();
    for note in notes {
        let stem_key = note.stem.clone().unwrap_or_else(|| "main".to_string());
        stem_groups.entry(stem_key).or_default().push(note);
    }

    if stem_groups.is_empty() {
        let mut empty = Vec::new();
        empty.extend_from_slice(b"MThd");
        empty.extend_from_slice(&6u32.to_be_bytes());
        empty.extend_from_slice(&0u16.to_be_bytes());
        empty.extend_from_slice(&1u16.to_be_bytes());
        empty.extend_from_slice(&ppq.to_be_bytes());
        empty.extend_from_slice(b"MTrk");
        empty.extend_from_slice(&4u32.to_be_bytes());
        empty.extend_from_slice(&[0x00, 0xFF, 0x2F, 0x00]);
        return empty;
    }

    let num_tracks = stem_groups.len() as u16;
    let format = if num_tracks > 1 { 1u16 } else { 0u16 };

    let mut file_bytes = Vec::new();
    // 1. MThd Header
    file_bytes.extend_from_slice(b"MThd");
    file_bytes.extend_from_slice(&6u32.to_be_bytes());
    file_bytes.extend_from_slice(&format.to_be_bytes());
    file_bytes.extend_from_slice(&num_tracks.to_be_bytes());
    file_bytes.extend_from_slice(&ppq.to_be_bytes());

    // 2. One MTrk per track
    for (stem_name, track_notes) in stem_groups {
        let mut track_events: Vec<(u32, u8, u8, u8)> = Vec::new();

        for note in track_notes {
            let onset_ticks =
                (note.onset_ms as f64 * safe_bpm * ppq as f64 / 60000.0).round() as u32;
            let duration_ticks = (note.duration_ms as f64 * safe_bpm * ppq as f64 / 60000.0)
                .round()
                .max(1.0) as u32;
            let off_ticks = onset_ticks + duration_ticks;

            // Note On (0x90)
            track_events.push((
                onset_ticks,
                0x90,
                note.midi_pitch,
                note.velocity.clamp(1, 127),
            ));
            // Note Off (0x80)
            track_events.push((off_ticks, 0x80, note.midi_pitch, 0));
        }

        track_events.sort_by(|a, b| {
            if a.0 != b.0 {
                a.0.cmp(&b.0)
            } else {
                a.1.cmp(&b.1)
            }
        });

        let mut track_data = Vec::new();

        // Delta 0: Track Name Meta Event (0xFF 0x03)
        write_midi_vlq(0, &mut track_data);
        track_data.push(0xFF);
        track_data.push(0x03);
        let name_bytes = stem_name.as_bytes();
        write_midi_vlq(name_bytes.len() as u32, &mut track_data);
        track_data.extend_from_slice(name_bytes);

        // Delta 0: Set Tempo Meta Event (0xFF 0x51 0x03)
        let us_per_quarter = (60_000_000.0 / safe_bpm).round() as u32;
        write_midi_vlq(0, &mut track_data);
        track_data.push(0xFF);
        track_data.push(0x51);
        track_data.push(0x03);
        track_data.push(((us_per_quarter >> 16) & 0xFF) as u8);
        track_data.push(((us_per_quarter >> 8) & 0xFF) as u8);
        track_data.push((us_per_quarter & 0xFF) as u8);

        let mut current_tick = 0u32;
        for (abs_tick, status, d1, d2) in track_events {
            let delta = abs_tick.saturating_sub(current_tick);
            current_tick = abs_tick;

            write_midi_vlq(delta, &mut track_data);
            track_data.push(status);
            track_data.push(d1);
            track_data.push(d2);
        }

        // Delta 0: End of Track (0xFF 0x2F 0x00)
        write_midi_vlq(0, &mut track_data);
        track_data.push(0xFF);
        track_data.push(0x2F);
        track_data.push(0x00);

        file_bytes.extend_from_slice(b"MTrk");
        file_bytes.extend_from_slice(&(track_data.len() as u32).to_be_bytes());
        file_bytes.extend_from_slice(&track_data);
    }

    file_bytes
}

fn write_midi_vlq(mut value: u32, out: &mut Vec<u8>) {
    let mut buf = [0u8; 4];
    let mut count = 0;
    buf[count] = (value & 0x7F) as u8;
    value >>= 7;

    while value > 0 {
        count += 1;
        buf[count] = ((value & 0x7F) | 0x80) as u8;
        value >>= 7;
    }

    for i in (0..=count).rev() {
        out.push(buf[i]);
    }
}

/// Exports transcription data to JSON.
pub fn export_transcription_to_json(
    data: &TrackTranscriptionData,
) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(data)
}

/// Runs a full note transcription of the given track.
pub fn analyze_track_transcription(
    uri_or_path: &str,
    track_id: i64,
) -> Result<TrackTranscriptionData, AnalysisError> {
    let samples = decode_snippet_for_analysis(uri_or_path, 300.0)
        .map_err(|e| format!("Failed to decode audio for transcription: {}", e))?;
    let sample_rate = 22050.0;

    let bpm = detect_bpm_from_samples(&samples, sample_rate);
    let notes = detect_notes_from_samples(&samples, sample_rate, None);

    let local = crate::uri::local_path(uri_or_path);
    let path = local.as_path();
    let file_hash = if path.exists() {
        cached_file_sha256(path).unwrap_or_else(|_| format!("hash_{track_id}"))
    } else {
        format!("hash_{}", track_id)
    };

    Ok(TrackTranscriptionData {
        track_id,
        file_hash,
        notes,
        bpm,
        analyzer_version: TRANSCRIPTION_ANALYZER_VERSION.to_string(),
    })
}
