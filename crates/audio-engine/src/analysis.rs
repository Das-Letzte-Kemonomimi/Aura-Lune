//! Moduł automatycznej detekcji tonacji muzycznej (Musical Key) oraz tempa (BPM).
//!
//! Wykorzystuje:
//! 1. Krumhansl-Schmuckler Key-Finding Algorithm z profilem chromagramu (12 klas wysokości dźwięku)
//!    do precyzyjnego wykrywania tonacji (Major/Minor) oraz kodu Camelot (np. 8A, 8B).
//! 2. Algorytm autokorelacji obwiedni transjentów energii (onset detection) do wykrywania BPM.
//! 3. Opcjonalne odczytywanie metadanych tagów ID3/Vorbis (BPM, TKEY/INITIALKEY) jeśli są dostępne.

use gst::prelude::*;
use gstreamer as gst;
use gstreamer_app as gst_app;
use gstreamer_audio as gst_audio;
use lofty::file::TaggedFileExt;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use std::path::Path;

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

// Profile Krumhansla-Schmucklera (wagi dla skali durowej i molowej)
const KRUMHANSL_MAJOR: [f64; 12] = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const KRUMHANSL_MINOR: [f64; 12] = [
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

/// Wynik detekcji klucza i tempa utworu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackKeyBpm {
    pub bpm: f64,
    pub key_name: String,      // np. "A min", "C Maj"
    pub camelot: String,       // np. "8A", "8B"
    pub base_key_index: usize, // 0 = C, 1 = C#, ..., 9 = A, 11 = B
    pub is_minor: bool,
    pub source: String, // "tag" lub "acoustic"
}

/// Parsuje ciąg tekstowy reprezentujący klucz muzyczny (Camelot lub notacja literowa).
pub fn parse_musical_key(raw: &str) -> Option<(usize, bool)> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }

    let upper = s.to_uppercase();

    // Sprawdzenie koła Camelot (np. "8A", "8B", "11A", "4B")
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

    // Sprawdzenie standardowej notacji (Am, C#m, C Maj, G#, F# minor, itp.)
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

/// Dekoduje reprezentatywny fragment utworu do pamięci (mono, 22050 Hz F32LE)
/// za pomocą potoku GStreamer appsink.
pub fn decode_snippet_for_analysis(
    uri_or_path: &str,
    max_duration_sec: f64,
) -> Result<Vec<f32>, String> {
    let _ = gst::init();
    let uri = if uri_or_path.starts_with("http://") || uri_or_path.starts_with("https://") {
        uri_or_path.to_string()
    } else if uri_or_path.starts_with("file://") {
        let stripped = uri_or_path.trim_start_matches("file://");
        glib::filename_to_uri(Path::new(stripped), None)
            .map(|u| u.to_string())
            .unwrap_or_else(|_| uri_or_path.to_string())
    } else {
        let path = Path::new(uri_or_path);
        if !path.exists() {
            return Err(format!("Plik nie istnieje: {}", uri_or_path));
        }
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Błąd ścieżki: {}", e))?;
        glib::filename_to_uri(&canonical, None)
            .map(|u| u.to_string())
            .unwrap_or_else(|_| format!("file://{}", canonical.display()))
    };

    let pipeline = gst::Pipeline::new();

    let uridecodebin = gst::ElementFactory::make("uridecodebin")
        .property("uri", &uri)
        .build()
        .map_err(|e| format!("Brak uridecodebin: {}", e))?;

    let audioconvert = gst::ElementFactory::make("audioconvert")
        .build()
        .map_err(|e| format!("Brak audioconvert: {}", e))?;

    let audioresample = gst::ElementFactory::make("audioresample")
        .build()
        .map_err(|e| format!("Brak audioresample: {}", e))?;

    let caps = gst_audio::AudioCapsBuilder::new()
        .format(gst_audio::AudioFormat::F32le)
        .rate(22050)
        .channels(1)
        .build();

    let capsfilter = gst::ElementFactory::make("capsfilter")
        .property("caps", &caps)
        .build()
        .map_err(|e| format!("Brak capsfilter: {}", e))?;

    let appsink = gst_app::AppSink::builder()
        .caps(&caps)
        .property("sync", false)
        .max_buffers(2000)
        .drop(false)
        .build();

    pipeline
        .add_many([
            &uridecodebin,
            &audioconvert,
            &audioresample,
            &capsfilter,
            appsink.upcast_ref(),
        ])
        .map_err(|e| format!("Błąd dodawania do potoku: {}", e))?;

    gst::Element::link_many([
        &audioconvert,
        &audioresample,
        &capsfilter,
        appsink.upcast_ref(),
    ])
    .map_err(|e| format!("Błąd linkowania elementów: {}", e))?;

    let convert_sink_pad = audioconvert
        .static_pad("sink")
        .ok_or_else(|| "Brak sink pad w audioconvert".to_string())?;

    uridecodebin.connect_pad_added(move |_bin, src_pad| {
        if convert_sink_pad.is_linked() {
            return;
        }
        let caps = src_pad
            .current_caps()
            .unwrap_or_else(|| src_pad.query_caps(None));
        if let Some(structure) = caps.structure(0) {
            if structure.name().starts_with("audio/") {
                let _ = src_pad.link(&convert_sink_pad);
            }
        }
    });

    pipeline
        .set_state(gst::State::Playing)
        .map_err(|e| format!("Błąd uruchomienia dekodera: {}", e))?;

    let sample_rate = 22050usize;
    let target_samples = (max_duration_sec * sample_rate as f64).round() as usize;
    let mut collected: Vec<f32> = Vec::with_capacity(target_samples);

    let start_time = std::time::Instant::now();
    let max_wait = std::time::Duration::from_millis(6000);

    while collected.len() < target_samples && start_time.elapsed() < max_wait {
        if appsink.is_eos() {
            break;
        }
        if let Ok(sample) = appsink.pull_sample() {
            if let Some(buffer) = sample.buffer() {
                if let Ok(map) = buffer.map_readable() {
                    let num_floats = map.len() / std::mem::size_of::<f32>();
                    let slice = unsafe {
                        std::slice::from_raw_parts(map.as_ptr() as *const f32, num_floats)
                    };
                    collected.extend_from_slice(slice);
                }
            }
        } else {
            // Krótka przerwa w oczekiwaniu na próbki
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }

    let _ = pipeline.set_state(gst::State::Null);

    if collected.is_empty() {
        return Err("Nie udało się zdekodować próbek audio".to_string());
    }

    Ok(collected)
}

/// Wykrywa BPM na podstawie autokorelacji obwiedni onsetów energii w sygnale audio.
pub fn detect_bpm_from_samples(samples: &[f32], sample_rate: f64) -> f64 {
    if samples.len() < 2048 {
        return 128.0;
    }

    // Pomijamy intro (pierwsze 20s jeśli próbki >= 45s, w przeciwnym razie 15%)
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

    // 1. Oblicz obwiednię energii RMS dla każdego okna hop
    let mut energy = Vec::with_capacity(num_hops);
    for h in 0..num_hops {
        let chunk = &analysis_samples[h * hop_size..(h + 1) * hop_size];
        let sum_sq: f64 = chunk.iter().map(|&s| (s as f64) * (s as f64)).sum();
        energy.push((sum_sq / hop_size as f64).sqrt());
    }

    // 2. Wyznacz onset (dodatnia różnica energii)
    let mut onset = Vec::with_capacity(num_hops);
    onset.push(0.0);
    for h in 1..num_hops {
        let diff = energy[h] - energy[h - 1];
        onset.push(if diff > 0.0 { diff } else { 0.0 });
    }

    // Usunięcie stałej składowej (lokalna średnia ruchoma)
    let win = 15;
    let mut onset_filtered = Vec::with_capacity(num_hops);
    for i in 0..num_hops {
        let start = i.saturating_sub(win);
        let end = (i + win + 1).min(num_hops);
        let avg: f64 = onset[start..end].iter().sum::<f64>() / (end - start) as f64;
        let val = (onset[i] - avg).max(0.0);
        onset_filtered.push(val);
    }

    // 3. Autokorelacja dla zakresu BPM od 65 do 185
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

    // 4. Paraboliczna interpolacja wokół szczytu
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

    // Sprawdzenie podwojonego tempa (harmonika w połowie opóźnienia half_lag)
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

    // Korekta oktawowa: standardowy zakres tempa utworu [75 .. 185]
    while bpm < 75.0 {
        bpm *= 2.0;
    }
    while bpm > 185.0 {
        bpm /= 2.0;
    }

    (bpm * 10.0).round() / 10.0
}

/// Wykrywa klucz muzyczny (Musical Key) za pomocą algorytmu Krumhansla-Schmucklera.
pub fn detect_key_from_samples(samples: &[f32], sample_rate: f64) -> (usize, bool) {
    if samples.is_empty() {
        return (0, false); // C Maj
    }

    let mut chroma = [0.0f64; 12];

    // Rozmiar okna STFT: 4096 próbek (~185 ms), przesunięcie: 2048 próbek (50% nakładania)
    let frame_size = 4096usize;
    let hop_size = 2048usize;

    // Pomijamy intro (pierwsze 20s jeśli plik ma >= 45s, lub 15% na początku)
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

    // Okno Hanninga
    let hanning: Vec<f64> = (0..frame_size)
        .map(|n| 0.5 * (1.0 - (2.0 * PI * n as f64 / (frame_size - 1) as f64).cos()))
        .collect();

    // Akumulacja modułów (magnitud) energii w każdej ramce — zapobiega destrukcyjnej interferencji fazy.
    // Analizujemy oktawy 2 do 5 (100 Hz do 1350 Hz), aby uniknąć zakłóceń sub-basu (stopy) < 100 Hz.
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

    // Normalizacja wektora chromagramu
    let chroma_norm: f64 = chroma.iter().map(|&x| x * x).sum::<f64>().sqrt();
    if chroma_norm > 1e-6 {
        for val in chroma.iter_mut() {
            *val /= chroma_norm;
        }
    }

    // Obliczenie korelacji Pearsona ze wzorcami dur/moll dla wszystkich 12 rotacji
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

/// Główna funkcja analityczna: bada plik i zwraca kompleksowy wynik BPM oraz tonacji.
pub fn analyze_track_key_bpm(uri_or_path: &str) -> Result<TrackKeyBpm, String> {
    // 1. Próba odczytu tagów z pliku za pomocą lofty (jeśli to plik lokalny)
    let file_path = if uri_or_path.starts_with("file://") {
        uri_or_path.trim_start_matches("file://")
    } else {
        uri_or_path
    };

    let mut detected_bpm: Option<f64> = None;
    let mut detected_key: Option<(usize, bool)> = None;

    if let Ok(probe) = lofty::probe::Probe::open(file_path) {
        if let Ok(tagged_file) = probe.read() {
            if let Some(tag) = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag())
            {
                // Odczyt BPM z tagów
                if let Some(bpm_str) = tag.get_string(lofty::tag::ItemKey::Bpm) {
                    if let Ok(b) = bpm_str.parse::<f64>() {
                        if (40.0..=280.0).contains(&b) {
                            detected_bpm = Some((b * 10.0).round() / 10.0);
                        }
                    }
                }
                // Odczyt tonacji z tagów
                if let Some(key_str) = tag.get_string(lofty::tag::ItemKey::InitialKey) {
                    if let Some(parsed) = parse_musical_key(key_str) {
                        detected_key = Some(parsed);
                    }
                }
            }
        }
    }

    // Jeśli znaleziono oba parametry w metadanych, zwracamy wynik natychmiast
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

    // 2. Akustyczna analiza próbek audio (jeśli brak tagów lub są niepełne)
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
