//! Waveform peaks and FFT spectral profile for drawing the seekbar waveform.

use super::decode::{DecodeEnd, DecodeSession, ANALYSIS_SAMPLE_RATE};
use crate::hpss::fft_radix2;
use crate::AnalysisError;
use domain::analysis::TrackWaveformData;
use std::f64::consts::PI;
use std::time::Duration;

/// Cache version for the FFT spectral waveform extractor.
/// Bump whenever FFT binning, compression, or normalisation changes.
pub const WAVEFORM_ANALYZER_VERSION: &str = "fft-v2";

/// Weight of the bucket's sample peak in the drawn amplitude. Kept small: on loud masters the
/// sample peak sits near full scale in almost every bucket and would flatten the wave into a block.
const PEAK_WEIGHT: f32 = 0.25;
/// Weight of the bucket's RMS (perceived loudness) in the drawn amplitude.
const RMS_WEIGHT: f32 = 0.75;
/// Amplitudes are scaled so this percentile of the buckets reaches 1.0; a few transients cannot
/// squash the rest of the track.
const NORMALISE_PERCENTILE: f32 = 0.98;
/// Contrast exponent (> 1) applied after normalising, so mid-level buckets stand clearly below loud ones.
const CONTRAST_EXPONENT: f32 = 1.5;
/// Smallest drawn amplitude, so silence still leaves a visible stub.
const MIN_AMPLITUDE: f32 = 0.05;

/// Turns raw per-bucket levels into drawable amplitudes in `MIN_AMPLITUDE..=1.0`, rounded to 3 decimals.
fn shape_levels(raw: &[f32]) -> Vec<f32> {
    if raw.is_empty() {
        return Vec::new();
    }
    let mut sorted: Vec<f32> = raw.to_vec();
    sorted.sort_by(f32::total_cmp);
    let idx = ((sorted.len() - 1) as f32 * NORMALISE_PERCENTILE).round() as usize;
    let reference = sorted[idx.min(sorted.len() - 1)].max(0.0001);
    raw.iter()
        .map(|&level| {
            let norm = (level / reference).clamp(0.0, 1.0).powf(CONTRAST_EXPONENT);
            (norm.clamp(MIN_AMPLITUDE, 1.0) * 1000.0).round() / 1000.0
        })
        .collect()
}

/// Decode sample rate for the amplitude-only waveform helper.
const WAVEFORM_SAMPLE_RATE: u32 = 11_025;
/// Number of samples in one amplitude statistics block (peak + sum of squares).
const BLOCK_SAMPLES: usize = 256;
/// Longest decode time; a longer decode yields a waveform of the beginning of the track.
pub(super) const MAX_DECODE: Duration = Duration::from_secs(60);

/// FFT window size for the spectral seekbar analyser (~46.4 ms at 22,050 Hz, ~21.5 Hz/bin).
const SPECTRAL_FFT_SIZE: usize = 1024;
/// Hop size between consecutive FFT frames (50% overlap).
const SPECTRAL_HOP_SIZE: usize = 512;
/// Logarithmic perceptual compression strength for FFT band energies.
const BAND_LOG_GAMMA: f32 = 12.0;

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

    /// `count` normalised values in `0.05..=1.0` (loudness-weighted: see [`PEAK_WEIGHT`], [`RMS_WEIGHT`]).
    pub fn finish(mut self, count: usize) -> Vec<f32> {
        if self.current.2 > 0 {
            self.blocks.push(self.current);
        }
        let nb = self.blocks.len();
        let mut peaks = Vec::with_capacity(count);
        for i in 0..count {
            let start = i * nb / count;
            let end = ((i + 1) * nb / count).min(nb);
            if start >= end {
                peaks.push(0.0);
                continue;
            }
            let (mut max_val, mut sum_sq, mut n) = (0.0f32, 0.0f64, 0u64);
            for &(m, s, c) in &self.blocks[start..end] {
                max_val = max_val.max(m);
                sum_sq += s;
                n += c as u64;
            }
            let rms = (sum_sq / n.max(1) as f64).sqrt() as f32;
            peaks.push(PEAK_WEIGHT * max_val + RMS_WEIGHT * rms);
        }
        shape_levels(&peaks)
    }
}

/// Compact per-frame summary produced during streaming FFT decoding.
#[derive(Debug, Clone, Copy, Default)]
struct SpectralFrame {
    peak: f32,
    rms_sq: f32,
    low_sq: f32,
    mid_sq: f32,
    high_sq: f32,
}

/// Streaming STFT/FFT spectral waveform accumulator.
///
/// Computes Hann-windowed radix-2 FFT frames (`SPECTRAL_FFT_SIZE`, 50% overlap) on incoming
/// mono PCM chunks and stores only one 20-byte summary per frame, keeping memory bounded
/// even for multi-hour tracks.
pub struct SpectralWaveformAccumulator {
    sample_rate: u32,
    window: Vec<f32>,
    window_energy_norm: f32,
    re: Vec<f32>,
    im: Vec<f32>,
    ring: Vec<f32>,
    frames: Vec<SpectralFrame>,
    saw_samples: bool,
}

impl SpectralWaveformAccumulator {
    pub fn new(sample_rate: u32) -> Self {
        let window: Vec<f32> = (0..SPECTRAL_FFT_SIZE)
            .map(|i| (0.5 - 0.5 * (2.0 * PI * i as f64 / SPECTRAL_FFT_SIZE as f64).cos()) as f32)
            .collect();
        let window_sq_sum: f32 = window.iter().map(|&w| w * w).sum();
        // Parseval normalisation factor from raw DFT bins to frame RMS energy.
        let window_energy_norm = (SPECTRAL_FFT_SIZE as f32 * window_sq_sum).max(1.0);
        Self {
            sample_rate: sample_rate.max(1),
            window,
            window_energy_norm,
            re: vec![0.0; SPECTRAL_FFT_SIZE],
            im: vec![0.0; SPECTRAL_FFT_SIZE],
            ring: Vec::with_capacity(SPECTRAL_FFT_SIZE * 2),
            frames: Vec::new(),
            saw_samples: false,
        }
    }

    pub fn is_empty(&self) -> bool {
        !self.saw_samples
    }

    pub fn push(&mut self, samples: &[f32]) {
        if samples.is_empty() {
            return;
        }
        self.saw_samples = true;
        self.ring.extend_from_slice(samples);

        let mut consumed = 0usize;
        while self.ring.len() - consumed >= SPECTRAL_FFT_SIZE {
            self.analyze_window(consumed, SPECTRAL_FFT_SIZE);
            consumed += SPECTRAL_HOP_SIZE;
        }
        if consumed > 0 {
            self.ring.drain(..consumed);
        }
    }

    fn analyze_window(&mut self, start: usize, len: usize) {
        let valid_len = len.min(SPECTRAL_FFT_SIZE);
        let slice = &self.ring[start..start + valid_len];

        let mut peak = 0.0f32;
        let mut sum_sq = 0.0f32;
        for &s in slice {
            peak = peak.max(s.abs());
            sum_sq += s * s;
        }
        let rms_sq = sum_sq / valid_len.max(1) as f32;

        self.re.fill(0.0);
        self.im.fill(0.0);
        for ((re, &s), &w) in self
            .re
            .iter_mut()
            .zip(&slice[..valid_len])
            .zip(&self.window)
        {
            *re = s * w;
        }
        fft_radix2(&mut self.re, &mut self.im, false);

        // Positive spectrum bins (excluding DC bin 0 and Nyquist).
        let half = SPECTRAL_FFT_SIZE / 2;
        let hz_per_bin = self.sample_rate as f32 / SPECTRAL_FFT_SIZE as f32;
        let low_end_bin = ((250.0 / hz_per_bin).round() as usize).clamp(2, half);
        let mid_end_bin = ((2_500.0 / hz_per_bin).round() as usize).clamp(low_end_bin + 1, half);

        let mut low_power = 0.0f32;
        let mut mid_power = 0.0f32;
        let mut high_power = 0.0f32;

        // Real signal symmetry: positive bins 1..half carry half the AC power, so ×2 recovers full power.
        for k in 1..half {
            let p = 2.0 * (self.re[k] * self.re[k] + self.im[k] * self.im[k]);
            if k < low_end_bin {
                low_power += p;
            } else if k < mid_end_bin {
                mid_power += p;
            } else {
                high_power += p;
            }
        }

        self.frames.push(SpectralFrame {
            peak,
            rms_sq,
            low_sq: low_power / self.window_energy_norm,
            mid_sq: mid_power / self.window_energy_norm,
            high_sq: high_power / self.window_energy_norm,
        });
    }

    /// Aggregates all streamed FFT frames into `count` seekbar buckets.
    pub fn finish(mut self, count: usize, track_id: Option<i64>) -> TrackWaveformData {
        if count == 0 {
            return TrackWaveformData {
                track_id,
                sample_count: 0,
                peaks: Vec::new(),
                bands: Vec::new(),
                analyzer_version: WAVEFORM_ANALYZER_VERSION.to_string(),
            };
        }

        // Flush any remaining tail samples (or very short tracks < SPECTRAL_FFT_SIZE).
        if !self.ring.is_empty()
            && (self.frames.is_empty() || self.ring.len() >= SPECTRAL_HOP_SIZE / 2)
        {
            let rem = self.ring.len().min(SPECTRAL_FFT_SIZE);
            self.analyze_window(0, rem);
        }

        let nf = self.frames.len();
        if nf == 0 {
            return TrackWaveformData {
                track_id,
                sample_count: count,
                peaks: vec![0.05; count],
                bands: vec![[0.0, 0.0, 0.0]; count],
                analyzer_version: WAVEFORM_ANALYZER_VERSION.to_string(),
            };
        }

        let mut raw_peaks = Vec::with_capacity(count);
        let mut raw_bands = Vec::with_capacity(count);
        let mut max_global_band = 0.0001f32;

        for i in 0..count {
            let start = i * nf / count;
            let end = ((i + 1) * nf / count).min(nf);
            if start >= end {
                raw_peaks.push(0.0);
                raw_bands.push([0.0, 0.0, 0.0]);
                continue;
            }

            let slice = &self.frames[start..end];
            let n = slice.len() as f32;
            let mut max_peak = 0.0f32;
            let mut sum_rms_sq = 0.0f32;
            let mut sum_low_sq = 0.0f32;
            let mut sum_mid_sq = 0.0f32;
            let mut sum_high_sq = 0.0f32;

            for f in slice {
                max_peak = max_peak.max(f.peak);
                sum_rms_sq += f.rms_sq;
                sum_low_sq += f.low_sq;
                sum_mid_sq += f.mid_sq;
                sum_high_sq += f.high_sq;
            }

            let rms = (sum_rms_sq / n).sqrt();
            let low = (sum_low_sq / n).sqrt();
            let mid = (sum_mid_sq / n).sqrt();
            let high = (sum_high_sq / n).sqrt();
            let spectral_rms = ((sum_low_sq + sum_mid_sq + sum_high_sq) / n).sqrt();

            let combined = PEAK_WEIGHT * max_peak + RMS_WEIGHT * rms.max(spectral_rms);
            max_global_band = max_global_band.max(low).max(mid).max(high);

            raw_peaks.push(combined);
            raw_bands.push([low, mid, high]);
        }

        let log_denom = (1.0 + BAND_LOG_GAMMA).ln();
        let peaks = shape_levels(&raw_peaks);

        let bands: Vec<[f32; 3]> = raw_bands
            .into_iter()
            .map(|[l, m, h]| {
                let compress = |v: f32| -> f32 {
                    let ratio = (v / max_global_band).clamp(0.0, 1.0);
                    let compressed =
                        ((1.0 + BAND_LOG_GAMMA * ratio).ln() / log_denom).clamp(0.0, 1.0);
                    (compressed * 1000.0).round() / 1000.0
                };
                [compress(l), compress(m), compress(h)]
            })
            .collect();

        TrackWaveformData {
            track_id,
            sample_count: count,
            peaks,
            bands,
            analyzer_version: WAVEFORM_ANALYZER_VERSION.to_string(),
        }
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

/// Extracts both normalised amplitude peaks and 3-band FFT spectral energy (`[low, mid, high]`)
/// across the whole track in `count` seekbar buckets.
pub fn extract_track_waveform_spectrum(
    uri_or_path: &str,
    count: usize,
    track_id: Option<i64>,
) -> Result<TrackWaveformData, AnalysisError> {
    if count == 0 {
        return Ok(TrackWaveformData {
            track_id,
            sample_count: 0,
            peaks: Vec::new(),
            bands: Vec::new(),
            analyzer_version: WAVEFORM_ANALYZER_VERSION.to_string(),
        });
    }
    let session = DecodeSession::open(uri_or_path, ANALYSIS_SAMPLE_RATE, 1)?;
    let mut acc = SpectralWaveformAccumulator::new(ANALYSIS_SAMPLE_RATE);
    let end = session.run(MAX_DECODE, |chunk| {
        acc.push(chunk);
        true
    });
    if acc.is_empty() {
        return Err(match end {
            DecodeEnd::Failed(e) => format!("Failed to decode the track: {e}").into(),
            _ => "No audio samples to build the spectral waveform from".into(),
        });
    }
    if end == DecodeEnd::TimedOut {
        tracing::warn!("Spectral waveform {uri_or_path}: decode timed out, partial waveform");
    }
    Ok(acc.finish(count, track_id))
}
