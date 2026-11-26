//! Tempo detection (onset-envelope autocorrelation) and key detection (Krumhansl-Schmuckler).

use super::*;
use crate::AnalysisError;
use lofty::file::TaggedFileExt;
use std::f64::consts::PI;

/// Detects the BPM from the autocorrelation of the energy onset envelope of an audio signal.
pub fn detect_bpm_from_samples(samples: &[f32], sample_rate: f64) -> f64 {
    if samples.len() < 2048 {
        return 128.0;
    }

    // Skip the intro (the first 20 s if there are >= 45 s of samples, otherwise 15%)
    let skip_samples = if samples.len() >= (45.0 * sample_rate) as usize {
        (20.0 * sample_rate) as usize
    } else {
        (samples.len() as f64 * 0.15) as usize
    };
    let max_analysis_samples = (45.0 * sample_rate) as usize;
    let end_samples = (skip_samples + max_analysis_samples).min(samples.len());
    let analysis_samples = &samples[skip_samples..end_samples];

    let hop_size = 512usize;
    let hops_per_sec = sample_rate / (hop_size as f64);
    let num_hops = analysis_samples.len() / hop_size;

    if num_hops < 30 {
        return 128.0;
    }

    // 1. RMS energy envelope for every hop window
    let mut energy = Vec::with_capacity(num_hops);
    for h in 0..num_hops {
        let chunk = &analysis_samples[h * hop_size..(h + 1) * hop_size];
        let sum_sq: f64 = chunk.iter().map(|&s| (s as f64) * (s as f64)).sum();
        energy.push((sum_sq / hop_size as f64).sqrt());
    }

    // 2. Onsets (positive energy difference)
    let mut onset = Vec::with_capacity(num_hops);
    onset.push(0.0);
    for h in 1..num_hops {
        let diff = energy[h] - energy[h - 1];
        onset.push(if diff > 0.0 { diff } else { 0.0 });
    }

    // Remove the DC component (local moving average)
    let win = 15;
    let mut onset_filtered = Vec::with_capacity(num_hops);
    for i in 0..num_hops {
        let start = i.saturating_sub(win);
        let end = (i + win + 1).min(num_hops);
        let avg: f64 = onset[start..end].iter().sum::<f64>() / (end - start) as f64;
        let val = (onset[i] - avg).max(0.0);
        onset_filtered.push(val);
    }

    // 3. Autocorrelation over the 65–185 BPM range
    let min_bpm = 65.0;
    let max_bpm = 185.0;
    let lag_min = ((60.0 / max_bpm) * hops_per_sec).round() as usize;
    let lag_max = ((60.0 / min_bpm) * hops_per_sec).round() as usize;

    let mut best_lag = lag_min;
    let mut best_corr = -1.0;

    let mut corr_values = vec![0.0; lag_max + 2];

    for lag in lag_min..=lag_max {
        if lag >= num_hops {
            break;
        }
        let mut sum = 0.0;
        for i in 0..(num_hops - lag) {
            sum += onset_filtered[i] * onset_filtered[i + lag];
        }
        corr_values[lag] = sum;
        if sum > best_corr {
            best_corr = sum;
            best_lag = lag;
        }
    }

    if best_corr <= 0.0 || best_lag <= 1 {
        return 128.0;
    }

    // 4. Parabolic interpolation around the peak
    let y1 = corr_values[best_lag - 1];
    let y2 = corr_values[best_lag];
    let y3 = corr_values[best_lag + 1];

    let denom = 2.0 * (y1 - 2.0 * y2 + y3);
    let delta = if denom.abs() > 1e-6 {
        (y1 - y3) / denom
    } else {
        0.0
    };

    let fine_lag = (best_lag as f64 + delta).max(1.0);
    let mut bpm = (60.0 * hops_per_sec) / fine_lag;

    // Check the doubled tempo (harmonic at half the lag, half_lag)
    let half_lag = best_lag / 2;
    if half_lag >= lag_min && corr_values[half_lag] >= 0.70 * corr_values[best_lag] {
        let y1_h = corr_values[half_lag - 1];
        let y2_h = corr_values[half_lag];
        let y3_h = corr_values[half_lag + 1];
        let denom_h = 2.0 * (y1_h - 2.0 * y2_h + y3_h);
        let delta_h = if denom_h.abs() > 1e-6 {
            (y1_h - y3_h) / denom_h
        } else {
            0.0
        };
        let fine_half_lag = (half_lag as f64 + delta_h).max(1.0);
        bpm = (60.0 * hops_per_sec) / fine_half_lag;
    } else if bpm < 85.0 {
        bpm *= 2.0;
    }

    // Octave correction: the standard track tempo range [75 .. 185]
    while bpm < 75.0 {
        bpm *= 2.0;
    }
    while bpm > 185.0 {
        bpm /= 2.0;
    }

    (bpm * 10.0).round() / 10.0
}

/// Detects the musical key with the Krumhansl-Schmuckler algorithm.
pub fn detect_key_from_samples(samples: &[f32], sample_rate: f64) -> (usize, bool) {
    if samples.is_empty() {
        return (0, false); // C Maj
    }

    let mut chroma = [0.0f64; 12];

    // STFT window: 4096 samples (~185 ms), hop: 2048 samples (50% overlap)
    let frame_size = 4096usize;
    let hop_size = 2048usize;

    // Skip the intro (the first 20 s if the file is >= 45 s long, otherwise the first 15%)
    let skip_samples = if samples.len() >= (45.0 * sample_rate) as usize {
        (20.0 * sample_rate) as usize
    } else {
        (samples.len() as f64 * 0.15) as usize
    };
    let max_analysis_samples = (45.0 * sample_rate) as usize;
    let end_samples = (skip_samples + max_analysis_samples).min(samples.len());
    let analysis_samples = &samples[skip_samples..end_samples];

    let num_frames = analysis_samples.len().saturating_sub(frame_size) / hop_size;
    if num_frames == 0 {
        return (0, false);
    }

    // Hann window
    let hanning: Vec<f64> = (0..frame_size)
        .map(|n| 0.5 * (1.0 - (2.0 * PI * n as f64 / (frame_size - 1) as f64).cos()))
        .collect();

    // Accumulate magnitudes per frame, which avoids destructive phase interference.
    // Analyse octaves 2 to 5 (100 Hz to 1350 Hz) to avoid sub-bass (kick) interference < 100 Hz.
    for f_idx in 0..num_frames {
        let frame_start = f_idx * hop_size;
        let frame = &analysis_samples[frame_start..frame_start + frame_size];

        for (p, chroma_slot) in chroma.iter_mut().enumerate() {
            let mut note_frame_energy = 0.0;
            for octave in 2..=5 {
                let f = 440.0 * 2.0f64.powf(((p as i32 - 9) as f64) / 12.0 + (octave as f64 - 4.0));
                if !(100.0..=1350.0).contains(&f) {
                    continue;
                }

                let omega = 2.0 * PI * f / sample_rate;
                let mut re = 0.0f64;
                let mut im = 0.0f64;

                for i in (0..frame_size).step_by(2) {
                    let s = frame[i] as f64 * hanning[i];
                    let angle = omega * (i as f64);
                    re += s * angle.cos();
                    im -= s * angle.sin();
                }

                note_frame_energy += (re * re + im * im).sqrt();
            }
            *chroma_slot += note_frame_energy;
        }
    }

    // Normalise the chroma vector
    let chroma_norm: f64 = chroma.iter().map(|&x| x * x).sum::<f64>().sqrt();
    if chroma_norm > 1e-6 {
        for val in chroma.iter_mut() {
            *val /= chroma_norm;
        }
    }

    // Pearson correlation with the major/minor profiles for all 12 rotations
    let mut best_score = -2.0;
    let mut best_key = 0;
    let mut best_is_minor = false;

    for r in 0..12 {
        let mut rotated_chroma = [0.0; 12];
        for i in 0..12 {
            rotated_chroma[i] = chroma[(i + r) % 12];
        }

        let score_major = pearson_correlation(&rotated_chroma, &KRUMHANSL_MAJOR);
        let score_minor = pearson_correlation(&rotated_chroma, &KRUMHANSL_MINOR);

        if score_major > best_score {
            best_score = score_major;
            best_key = r;
            best_is_minor = false;
        }
        if score_minor > best_score {
            best_score = score_minor;
            best_key = r;
            best_is_minor = true;
        }
    }

    (best_key, best_is_minor)
}

fn pearson_correlation(x: &[f64; 12], y: &[f64; 12]) -> f64 {
    let mean_x = x.iter().sum::<f64>() / 12.0;
    let mean_y = y.iter().sum::<f64>() / 12.0;

    let mut num = 0.0;
    let mut den_x = 0.0;
    let mut den_y = 0.0;

    for i in 0..12 {
        let dx = x[i] - mean_x;
        let dy = y[i] - mean_y;
        num += dx * dy;
        den_x += dx * dx;
        den_y += dy * dy;
    }

    let den = (den_x * den_y).sqrt();
    if den > 1e-9 {
        num / den
    } else {
        0.0
    }
}

/// Reads a trustworthy tempo (40–280 BPM) from a local file's tags.
pub fn read_bpm_tag(uri_or_path: &str) -> Option<f64> {
    let local = crate::uri::local_path(uri_or_path);
    let tagged = lofty::probe::Probe::open(local.as_path())
        .ok()?
        .read()
        .ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let bpm: f64 = tag
        .get_string(lofty::tag::ItemKey::Bpm)?
        .trim()
        .parse()
        .ok()?;
    (40.0..=280.0).contains(&bpm).then_some(bpm)
}

/// Main analysis entry point: inspects a file and returns a full BPM and key result.
pub fn analyze_track_key_bpm(uri_or_path: &str) -> Result<TrackKeyBpm, AnalysisError> {
    // 1. Try reading the file's tags with lofty (if it is a local file)
    let local = crate::uri::local_path(uri_or_path);
    let file_path = local.as_path();

    let mut detected_bpm: Option<f64> = None;
    let mut detected_key: Option<(usize, bool)> = None;

    if let Ok(probe) = lofty::probe::Probe::open(file_path) {
        if let Ok(tagged_file) = probe.read() {
            if let Some(tag) = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag())
            {
                // BPM from tags
                if let Some(bpm_str) = tag.get_string(lofty::tag::ItemKey::Bpm) {
                    if let Ok(b) = bpm_str.parse::<f64>() {
                        if (40.0..=280.0).contains(&b) {
                            detected_bpm = Some((b * 10.0).round() / 10.0);
                        }
                    }
                }
                // Key from tags
                if let Some(key_str) = tag.get_string(lofty::tag::ItemKey::InitialKey) {
                    if let Some(parsed) = parse_musical_key(key_str) {
                        detected_key = Some(parsed);
                    }
                }
            }
        }
    }

    // If both values are in the metadata, return immediately
    if let (Some(bpm), Some((base_key_index, is_minor))) = (detected_bpm, detected_key) {
        let key_name = format!(
            "{} {}",
            CHROMATIC_NOTES[base_key_index],
            if is_minor { "m" } else { "Maj" }
        );
        let camelot = if is_minor {
            CAMELOT_MINOR[base_key_index].to_string()
        } else {
            CAMELOT_MAJOR[base_key_index].to_string()
        };
        return Ok(TrackKeyBpm {
            bpm,
            key_name,
            camelot,
            base_key_index,
            is_minor,
            source: "tag".to_string(),
        });
    }

    // 2. Acoustic analysis of the audio samples (when tags are missing or incomplete)
    let samples = decode_snippet_for_analysis(uri_or_path, 70.0)?;

    let final_bpm = match detected_bpm {
        Some(b) => b,
        None => detect_bpm_from_samples(&samples, 22050.0),
    };

    let (base_key_index, is_minor) = match detected_key {
        Some(k) => k,
        None => detect_key_from_samples(&samples, 22050.0),
    };

    let key_name = format!(
        "{} {}",
        CHROMATIC_NOTES[base_key_index],
        if is_minor { "m" } else { "Maj" }
    );
    let camelot = if is_minor {
        CAMELOT_MINOR[base_key_index].to_string()
    } else {
        CAMELOT_MAJOR[base_key_index].to_string()
    };

    Ok(TrackKeyBpm {
        bpm: final_bpm,
        key_name,
        camelot,
        base_key_index,
        is_minor,
        source: "acoustic".to_string(),
    })
}
