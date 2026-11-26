//! Waveform peaks for drawing the waveform.

use super::decode::{DecodeEnd, DecodeSession};
use crate::AnalysisError;
use std::time::Duration;

/// Decode sample rate for the waveform (enough for the amplitude envelope).
const WAVEFORM_SAMPLE_RATE: u32 = 11_025;
/// Number of samples in one statistics block (peak + sum of squares).
const BLOCK_SAMPLES: usize = 256;
/// Longest decode time; a longer decode yields a waveform of the beginning of the track.
const MAX_DECODE: Duration = Duration::from_secs(60);

/// Streaming waveform accumulator. Instead of keeping every sample it stores
/// statistics per block of [`BLOCK_SAMPLES`] samples, so memory does not grow with the track
/// length the way the signal does (2 h at 11 kHz is about 4 MB instead of about 320 MB).
#[derive(Debug, Default)]
pub struct WaveformAccumulator {
    blocks: Vec<(f32, f64, u32)>,
    current: (f32, f64, u32),
}

impl WaveformAccumulator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, samples: &[f32]) {
        for &s in samples {
            let (max, sum_sq, n) = &mut self.current;
            *max = max.max(s.abs());
            *sum_sq += (s as f64) * (s as f64);
            *n += 1;
            if *n as usize == BLOCK_SAMPLES {
                self.blocks.push(std::mem::take(&mut self.current));
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        self.blocks.is_empty() && self.current.2 == 0
    }

    /// `count` normalised values in `0.05..=1.0` (0.7 × peak + 0.3 × RMS).
    pub fn finish(mut self, count: usize) -> Vec<f32> {
        if self.current.2 > 0 {
            self.blocks.push(self.current);
        }
        let nb = self.blocks.len();
        let mut peaks = Vec::with_capacity(count);
        let mut max_global_peak: f32 = 0.0001;
        for i in 0..count {
            let start = i * nb / count;
            let end = ((i + 1) * nb / count).min(nb);
            if start >= end {
                peaks.push(0.05);
                continue;
            }
            let (mut max_val, mut sum_sq, mut n) = (0.0f32, 0.0f64, 0u64);
            for &(m, s, c) in &self.blocks[start..end] {
                max_val = max_val.max(m);
                sum_sq += s;
                n += c as u64;
            }
            let rms = (sum_sq / n.max(1) as f64).sqrt() as f32;
            let bucket_val = 0.7 * max_val + 0.3 * rms;
            max_global_peak = max_global_peak.max(bucket_val);
            peaks.push(bucket_val);
        }
        for p in peaks.iter_mut() {
            let norm = (*p / max_global_peak).clamp(0.05, 1.0);
            *p = (norm * 1000.0).round() / 1000.0;
        }
        peaks
    }
}

/// Extracts normalised peak/RMS amplitude values for the whole track
/// in a given number of buckets (e.g. 160) for rendering the waveform.
pub fn extract_track_waveform_peaks(
    uri_or_path: &str,
    count: usize,
) -> Result<Vec<f32>, AnalysisError> {
    if count == 0 {
        return Ok(Vec::new());
    }
    let session = DecodeSession::open(uri_or_path, WAVEFORM_SAMPLE_RATE, 1)?;
    let mut acc = WaveformAccumulator::new();
    let end = session.run(MAX_DECODE, |chunk| {
        acc.push(chunk);
        true
    });
    if acc.is_empty() {
        return Err(match end {
            DecodeEnd::Failed(e) => format!("Failed to decode the track: {e}").into(),
            _ => "No audio samples to build the waveform from".into(),
        });
    }
    if end == DecodeEnd::TimedOut {
        tracing::warn!("Waveform {uri_or_path}: decode timed out, partial waveform");
    }
    Ok(acc.finish(count))
}
