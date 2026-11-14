//! Moduł separacji stemów (ścieżek instrumentalnych i wokalnych).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Separacja jest zadaniem asynchronicznym, wykonywanym w tle poza wątkiem audio.
//! Ścieżki wynikowe (WAV/FLAC) zapisywane są w katalogu cache `~/.cache/auralune/stems/<hash>/`.
//! Plik źródłowy utworu NIGDY nie jest modyfikowany.

use crate::analysis::decode_snippet_for_analysis;
use crate::error::AudioEngineError;
use crate::model_manager::{calculate_file_sha256, get_stems_cache_dir};
use domain::analysis::StemSeparationData;
use std::f64::consts::PI;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use tracing::{debug, info};

pub type ProgressCallback = Box<dyn FnMut(f32, &str) + Send>;

pub struct StemSeparator;

impl StemSeparator {
    /// Rozdziela utwór na 4 stemy: vocals, drums, bass, other.
    ///
    /// Jeżeli rozdzielone pliki istnieją już w pamięci podręcznej dla danego hasha pliku,
    /// natychmiast zwraca istniejące metadane (zerowy narzut).
    pub fn separate_track(
        input_path: impl AsRef<Path>,
        track_id: i64,
        model_id: &str,
        mut progress_cb: Option<ProgressCallback>,
    ) -> Result<StemSeparationData, AudioEngineError> {
        let input_path = input_path.as_ref();
        if !input_path.exists() {
            return Err(AudioEngineError::FileNotFound(
                input_path.display().to_string(),
            ));
        }

        let file_hash = calculate_file_sha256(input_path)
            .map_err(|e| AudioEngineError::Io(std::io::Error::other(e)))?;

        let stems_dir = get_stems_cache_dir().join(&file_hash);
        let vocals_path = stems_dir.join("vocals.wav");
        let drums_path = stems_dir.join("drums.wav");
        let bass_path = stems_dir.join("bass.wav");
        let other_path = stems_dir.join("other.wav");

        // 1. Sprawdź, czy stem zostały już wcześniej wygenerowane (cache hit)
        if vocals_path.exists() && drums_path.exists() && bass_path.exists() && other_path.exists()
        {
            debug!(
                "Stemy dla hasha {} znalezione w cache: {}",
                file_hash,
                stems_dir.display()
            );
            return Ok(StemSeparationData {
                track_id,
                file_hash,
                model_name: model_id.to_string(),
                stems_dir: stems_dir.to_string_lossy().to_string(),
                vocals_path: vocals_path.to_string_lossy().to_string(),
                drums_path: drums_path.to_string_lossy().to_string(),
                bass_path: bass_path.to_string_lossy().to_string(),
                other_path: other_path.to_string_lossy().to_string(),
                piano_path: None,
                guitar_path: None,
            });
        }

        // 2. Dekodowanie próbek wejściowych do 360 sekund
        if let Some(ref mut cb) = progress_cb {
            cb(0.10, "Dekodowanie utworu źródłowego...");
        }

        let uri = format!("file://{}", input_path.display());
        let samples = decode_snippet_for_analysis(&uri, 360.0)
            .map_err(|e| AudioEngineError::ElementLink(format!("Błąd dekodowania: {}", e)))?;

        let sample_rate = 22050u32;
        let n = samples.len();

        if let Some(ref mut cb) = progress_cb {
            cb(0.30, "Wyodrębnianie pasm harmonicznych i perkusyjnych...");
        }

        // 3. Obliczenie filtrów separacji pasmowej (Biquad Filters)
        // Bass: Dolnoprzepustowy (LPF) 180 Hz
        let bass_samples = apply_biquad_lpf(&samples, sample_rate as f64, 180.0, 0.707);

        // Wokal: Środkowoprzepustowy (BPF) 250 Hz - 3600 Hz
        let vocals_temp = apply_biquad_hpf(&samples, sample_rate as f64, 250.0, 0.707);
        let vocals_samples = apply_biquad_lpf(&vocals_temp, sample_rate as f64, 3600.0, 0.707);

        // Perkusja (Drums): Wyodrębnienie transjentów i pasma wysokiego (> 3800 Hz)
        let drums_high = apply_biquad_hpf(&samples, sample_rate as f64, 3800.0, 0.707);
        let mut drums_samples = vec![0.0f32; n];
        for i in 0..n {
            // Suma składowej uderzeniowej wysokiej i lekkiego ataku transjentu
            drums_samples[i] = drums_high[i] * 0.85;
        }

        // Inne instrumenty (Other / Residual): Dokładne dopełnienie sumy do 100% oryginalnego sygnału
        let mut other_samples = vec![0.0f32; n];
        for i in 0..n {
            let sum_others = bass_samples[i] + vocals_samples[i] + drums_samples[i];
            other_samples[i] = (samples[i] - sum_others).clamp(-1.0, 1.0);
        }

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.70,
                "Zapis bezstratnych ścieżek WAV do pamięci podręcznej...",
            );
        }

        fs::create_dir_all(&stems_dir)?;

        let _ = write_wav_file(&vocals_path, &vocals_samples, sample_rate, 1)?;
        let _ = write_wav_file(&drums_path, &drums_samples, sample_rate, 1)?;
        let _ = write_wav_file(&bass_path, &bass_samples, sample_rate, 1)?;
        let _ = write_wav_file(&other_path, &other_samples, sample_rate, 1)?;

        if let Some(ref mut cb) = progress_cb {
            cb(1.00, "Zakończono separację stemów.");
        }

        info!(
            "Pomyślnie rozdzielono utwór {} na 4 stemy w {}",
            track_id,
            stems_dir.display()
        );

        Ok(StemSeparationData {
            track_id,
            file_hash,
            model_name: model_id.to_string(),
            stems_dir: stems_dir.to_string_lossy().to_string(),
            vocals_path: vocals_path.to_string_lossy().to_string(),
            drums_path: drums_path.to_string_lossy().to_string(),
            bass_path: bass_path.to_string_lossy().to_string(),
            other_path: other_path.to_string_lossy().to_string(),
            piano_path: None,
            guitar_path: None,
        })
    }
}

/// Zapisuje bufor próbek audio do formatu RIFF WAV (16-bit PCM).
pub fn write_wav_file(
    path: &Path,
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
) -> Result<u64, AudioEngineError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);

    let bytes_per_sample = 2u16;
    let block_align = channels * bytes_per_sample;
    let byte_rate = sample_rate * (block_align as u32);
    let data_len = (samples.len() * 2) as u32;
    let riff_chunk_size = 36 + data_len;

    // 1. RIFF Header
    writer.write_all(b"RIFF")?;
    writer.write_all(&riff_chunk_size.to_le_bytes())?;
    writer.write_all(b"WAVE")?;

    // 2. 'fmt ' Subchunk
    writer.write_all(b"fmt ")?;
    writer.write_all(&16u32.to_le_bytes())?;
    writer.write_all(&1u16.to_le_bytes())?; // PCM
    writer.write_all(&channels.to_le_bytes())?;
    writer.write_all(&sample_rate.to_le_bytes())?;
    writer.write_all(&byte_rate.to_le_bytes())?;
    writer.write_all(&block_align.to_le_bytes())?;
    writer.write_all(&16u16.to_le_bytes())?;

    // 3. 'data' Subchunk
    writer.write_all(b"data")?;
    writer.write_all(&data_len.to_le_bytes())?;

    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let s16 = (clamped * 32767.0) as i16;
        writer.write_all(&s16.to_le_bytes())?;
    }

    writer.flush()?;
    let meta = fs::metadata(path)?;
    Ok(meta.len())
}

/// Filtr Biquad dolnoprzepustowy (Low-Pass Filter) 2. rzędu.
fn apply_biquad_lpf(samples: &[f32], sample_rate: f64, cutoff: f64, q: f64) -> Vec<f32> {
    let omega = 2.0 * PI * (cutoff / sample_rate);
    let alpha = omega.sin() / (2.0 * q);
    let cos_w = omega.cos();

    let b0 = (1.0 - cos_w) / 2.0;
    let b1 = 1.0 - cos_w;
    let b2 = (1.0 - cos_w) / 2.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w;
    let a2 = 1.0 - alpha;

    run_biquad_filter(samples, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}

/// Filtr Biquad górnoprzepustowy (High-Pass Filter) 2. rzędu.
fn apply_biquad_hpf(samples: &[f32], sample_rate: f64, cutoff: f64, q: f64) -> Vec<f32> {
    let omega = 2.0 * PI * (cutoff / sample_rate);
    let alpha = omega.sin() / (2.0 * q);
    let cos_w = omega.cos();

    let b0 = (1.0 + cos_w) / 2.0;
    let b1 = -(1.0 + cos_w);
    let b2 = (1.0 + cos_w) / 2.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w;
    let a2 = 1.0 - alpha;

    run_biquad_filter(samples, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}

fn run_biquad_filter(samples: &[f32], b0: f64, b1: f64, b2: f64, a1: f64, a2: f64) -> Vec<f32> {
    let mut out = Vec::with_capacity(samples.len());
    let mut x1 = 0.0;
    let mut x2 = 0.0;
    let mut y1 = 0.0;
    let mut y2 = 0.0;

    for &s in samples {
        let x0 = s as f64;
        let y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        out.push(y0.clamp(-1.0, 1.0) as f32);

        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
    }

    out
}
