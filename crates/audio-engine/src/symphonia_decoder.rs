//! Uniwersalny dekoder plików audio oparty o czystego Rusta (Symphonia).
//! Działa bez zewnętrznych bibliotek C na wszystkich platformach (Linux, Android).

use std::fs::File;
use std::path::Path;
use symphonia::core::audio::{SampleBuffer, SignalSpec};
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Zdekodowany blok lub cały utwór w postaci zunifikowanych próbek f32.
#[derive(Debug, Clone)]
pub struct DecodedAudio {
    pub sample_rate: u32,
    pub channels: usize,
    /// Próbki f32 z przeplotem (interleaved: L, R, L, R...)
    pub samples: Vec<f32>,
}

/// Dekoduje plik audio do pamięci (f32, interleaved).
/// Opcjonalnie ogranicza czas do `max_duration_sec`.
pub fn decode_audio_file(
    path: impl AsRef<Path>,
    max_duration_sec: Option<f64>,
) -> Result<DecodedAudio, String> {
    let path = path.as_ref();
    let file = File::open(path)
        .map_err(|e| format!("Nie można otworzyć pliku {}: {}", path.display(), e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions {
        enable_gapless: true,
        ..Default::default()
    };
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Błąd wykrywania formatu {}: {}", path.display(), e))?;

    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| format!("Brak obsługiwanej ścieżki audio w {}", path.display()))?;

    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| "Brak informacji o sample rate w ścieżce".to_string())?;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);

    let max_frames = max_duration_sec.map(|s| (s * sample_rate as f64) as usize);

    let decoder_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| format!("Błąd inicjalizacji dekodera: {}", e))?;

    let track_id = track.id;
    let mut samples = Vec::new();
    let mut sample_buf: Option<SampleBuffer<f32>> = None;
    let mut total_frames = 0usize;

    loop {
        if let Some(limit) = max_frames {
            if total_frames >= limit {
                break;
            }
        }

        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(Error::IoError(ref e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(Error::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(Error::IoError(_)) => break,
            Err(e) => return Err(format!("Błąd odczytu pakietu audio: {}", e)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = SignalSpec::new(decoded.spec().rate, decoded.spec().channels);
                let duration = decoded.capacity() as u64;

                let sbuf = sample_buf.get_or_insert_with(|| SampleBuffer::new(duration, spec));
                sbuf.copy_interleaved_ref(decoded);

                let packet_samples = sbuf.samples();
                let frames_in_packet = packet_samples.len() / channels;

                if let Some(limit) = max_frames {
                    let remaining_frames = limit.saturating_sub(total_frames);
                    if frames_in_packet > remaining_frames {
                        let sample_limit = remaining_frames * channels;
                        samples.extend_from_slice(&packet_samples[..sample_limit]);
                        break;
                    }
                }

                samples.extend_from_slice(packet_samples);
                total_frames += frames_in_packet;
            }
            Err(Error::IoError(_)) => break,
            Err(Error::DecodeError(msg)) => {
                tracing::warn!("Błąd dekodowania ramki: {}", msg);
                continue;
            }
            Err(Error::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(e) => {
                tracing::warn!("Błąd dekodowania pakietu: {}", e);
                break;
            }
        }
    }

    Ok(DecodedAudio {
        sample_rate,
        channels,
        samples,
    })
}

/// Dekoduje fragment utworu i konwertuje do mono o żądanym próbkowaniu (np. 22050 Hz) dla analizy BPM/Key.
pub fn decode_snippet_mono_resampled(
    path: impl AsRef<Path>,
    target_sample_rate: u32,
    max_duration_sec: f64,
) -> Result<Vec<f32>, String> {
    let decoded = decode_audio_file(path, Some(max_duration_sec))?;
    if decoded.samples.is_empty() {
        return Err("Brak zdekodowanych próbek audio".to_string());
    }

    // 1. Zmiksuj do mono
    let mono_samples = if decoded.channels == 1 {
        decoded.samples
    } else {
        let ch = decoded.channels;
        let mut mono = Vec::with_capacity(decoded.samples.len() / ch);
        for chunk in decoded.samples.chunks_exact(ch) {
            let sum: f32 = chunk.iter().sum();
            mono.push(sum / (ch as f32));
        }
        mono
    };

    // 2. Jeśli sample rate jest taki sam, zwróć mono bezpośrednio
    if decoded.sample_rate == target_sample_rate {
        return Ok(mono_samples);
    }

    // 3. Prosty resampling liniowy dla celów analizy BPM/Key
    let ratio = decoded.sample_rate as f64 / target_sample_rate as f64;
    let target_len = (mono_samples.len() as f64 / ratio) as usize;
    let mut resampled = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let src_pos = i as f64 * ratio;
        let idx = src_pos.floor() as usize;
        let frac = (src_pos - idx as f64) as f32;

        if idx + 1 < mono_samples.len() {
            let s0 = mono_samples[idx];
            let s1 = mono_samples[idx + 1];
            resampled.push(s0 + frac * (s1 - s0));
        } else if idx < mono_samples.len() {
            resampled.push(mono_samples[idx]);
        } else {
            break;
        }
    }

    Ok(resampled)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_wav_fixture() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../tests/fixtures/test_sine_440hz.wav"
        );
        let result = decode_audio_file(path, Some(1.0));
        assert!(
            result.is_ok(),
            "Dekodowanie WAV nie powiodło się: {:?}",
            result.err()
        );
        let audio = result.unwrap();
        assert_eq!(audio.sample_rate, 44100);
        assert!(!audio.samples.is_empty());
    }

    #[test]
    fn test_decode_snippet_mono() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../tests/fixtures/test_sine_440hz.wav"
        );
        let result = decode_snippet_mono_resampled(path, 22050, 1.0);
        assert!(
            result.is_ok(),
            "Resampling mono nie powiódł się: {:?}",
            result.err()
        );
        let samples = result.unwrap();
        assert!(!samples.is_empty());
    }
}
