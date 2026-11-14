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

/// Wynik analizy głośności EBU R128 / ReplayGain 2.0 dla utworu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayGainAnalysisResult {
    /// Wzmocnienie utworu w dB (Track Gain, np. -5.2 dB).
    pub track_gain_db: f64,
    /// Szczytowa amplituda utworu (Track Peak, 1.0 = 0 dBFS).
    pub track_peak: f64,
    /// Poziom referencyjny w dB SPL (domyślnie 89.0 dB SPL).
    pub reference_level_db: f64,
    /// Wzmocnienie albumu w dB jeśli było kalkulowane.
    pub album_gain_db: Option<f64>,
    /// Szczytowa amplituda albumu jeśli była kalkulowana.
    pub album_peak: Option<f64>,
}

/// Przeprowadza pełną, bitowo dokładną analizę głośności EBU R128 / ReplayGain 2.0
/// utworu za pomocą potoku GStreamer `rganalysis` i `fakesink` (ultra-szybka analiza bez czasu rzeczywistego).
pub fn analyze_track_replaygain(uri_or_path: &str) -> Result<ReplayGainAnalysisResult, String> {
    let _ = gst::init();
    let uri = if uri_or_path.starts_with("http://") || uri_or_path.starts_with("https://") {
        uri_or_path.to_string()
    } else if uri_or_path.starts_with("file://") {
        if let Ok((path, _)) = glib::filename_from_uri(uri_or_path) {
            if path.exists() {
                glib::filename_to_uri(&path, None)
                    .map(|u| u.to_string())
                    .unwrap_or_else(|_| uri_or_path.to_string())
            } else {
                uri_or_path.to_string()
            }
        } else {
            uri_or_path.to_string()
        }
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
        .rate(44100)
        .channels(2)
        .build();

    let capsfilter = gst::ElementFactory::make("capsfilter")
        .property("caps", &caps)
        .build()
        .map_err(|e| format!("Brak capsfilter: {}", e))?;

    let rganalysis = gst::ElementFactory::make("rganalysis")
        .property("forced", true)
        .property("reference-level", 89.0f64)
        .build()
        .map_err(|e| format!("Brak rganalysis: {}", e))?;

    let fakesink = gst::ElementFactory::make("fakesink")
        .property("sync", false)
        .build()
        .map_err(|e| format!("Brak fakesink: {}", e))?;

    pipeline
        .add_many([
            &uridecodebin,
            &audioconvert,
            &audioresample,
            &capsfilter,
            &rganalysis,
            &fakesink,
        ])
        .map_err(|e| format!("Błąd dodawania elementów: {}", e))?;

    gst::Element::link_many([
        &audioconvert,
        &audioresample,
        &capsfilter,
        &rganalysis,
        &fakesink,
    ])
    .map_err(|e| format!("Błąd linkowania: {}", e))?;

    let convert_sink_pad = audioconvert
        .static_pad("sink")
        .ok_or_else(|| "Brak sink pad w audioconvert".to_string())?;

    uridecodebin.connect_pad_added(move |_bin, src_pad| {
        if convert_sink_pad.is_linked() {
            return;
        }
        let pad_caps = src_pad
            .current_caps()
            .unwrap_or_else(|| src_pad.query_caps(None));
        let is_audio = pad_caps
            .structure(0)
            .is_some_and(|s| s.name().starts_with("audio/"));

        if is_audio {
            let _ = src_pad.link(&convert_sink_pad);
        }
    });

    pipeline
        .set_state(gst::State::Playing)
        .map_err(|e| format!("Błąd uruchomienia pipeline: {:?}", e))?;

    let bus = pipeline.bus().ok_or("Brak busa w potoku")?;
    let mut track_gain = None;
    let mut track_peak = None;
    let mut ref_level = 89.0;
    let mut album_gain = None;
    let mut album_peak = None;

    let start_time = std::time::Instant::now();
    loop {
        if start_time.elapsed() > std::time::Duration::from_secs(60) {
            let _ = pipeline.set_state(gst::State::Null);
            return Err("Przekroczono limit czasu analizy ReplayGain (60s)".to_string());
        }

        if let Some(msg) = bus.timed_pop(gst::ClockTime::from_mseconds(100)) {
            match msg.view() {
                gst::MessageView::Tag(tag_msg) => {
                    let tags = tag_msg.tags();
                    if let Some(g) = tags.get::<gst::tags::TrackGain>() {
                        track_gain = Some(g.get());
                    }
                    if let Some(p) = tags.get::<gst::tags::TrackPeak>() {
                        track_peak = Some(p.get());
                    }
                    if let Some(r) = tags.get::<gst::tags::ReferenceLevel>() {
                        ref_level = r.get();
                    }
                    if let Some(ag) = tags.get::<gst::tags::AlbumGain>() {
                        album_gain = Some(ag.get());
                    }
                    if let Some(ap) = tags.get::<gst::tags::AlbumPeak>() {
                        album_peak = Some(ap.get());
                    }
                }
                gst::MessageView::Eos(..) => {
                    break;
                }
                gst::MessageView::Error(err) => {
                    let _ = pipeline.set_state(gst::State::Null);
                    return Err(format!("Błąd analizy potoku audio: {}", err.error()));
                }
                _ => {}
            }
        }
    }

    let _ = pipeline.set_state(gst::State::Null);

    let gain = track_gain.unwrap_or(0.0);
    let peak = track_peak.unwrap_or(1.0);

    Ok(ReplayGainAnalysisResult {
        track_gain_db: gain,
        track_peak: peak,
        reference_level_db: ref_level,
        album_gain_db: album_gain,
        album_peak,
    })
}

/// Zapisuje obliczone tagi ReplayGain (Track Gain i Track Peak) bezpośrednio do pliku audio.
pub fn write_replaygain_tags_to_file(path: &str, gain: f64, peak: f64) -> Result<(), String> {
    use lofty::config::WriteOptions;
    use lofty::file::AudioFile;
    use lofty::probe::Probe;
    use lofty::tag::{ItemKey, ItemValue, TagItem};

    let mut tagged_file = Probe::open(path)
        .map_err(|e| format!("Błąd otwarcia pliku: {}", e))?
        .read()
        .map_err(|e| format!("Błąd odczytu tagów: {}", e))?;

    let tag = match tagged_file.primary_tag_mut() {
        Some(primary) => primary,
        None => {
            if let Some(first) = tagged_file.first_tag_mut() {
                first
            } else {
                return Err("Brak obsługiwanego kontenera tagów w pliku audio".to_string());
            }
        }
    };

    tag.insert(TagItem::new(
        ItemKey::ReplayGainTrackGain,
        ItemValue::Text(format!("{:.2} dB", gain)),
    ));
    tag.insert(TagItem::new(
        ItemKey::ReplayGainTrackPeak,
        ItemValue::Text(format!("{:.6}", peak)),
    ));

    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Błąd zapisu tagów do pliku {}: {}", path, e))?;
    Ok(())
}

// =========================================================================
// Zaawansowana Analiza Muzyczna: Siatka Taktów (Beat Grid), Detekcja Akordów
// Szablony Chromatyczne (Chroma Matching) i Wygładzanie HMM (Viterbi)
// =========================================================================

use crate::model_manager::calculate_file_sha256;
use domain::analysis::{BeatPoint, ChordSegment, TrackChordsData};

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
) -> Result<TrackChordsData, String> {
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
    let path = Path::new(uri_or_path.trim_start_matches("file://"));
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
        analyzer_version: "1.0.8-classic".to_string(),
    })
}
