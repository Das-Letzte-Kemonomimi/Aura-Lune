use serde::{Deserialize, Serialize};

/// Automatic silence skipping configuration (silence trimming / auto-skip silence).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SilenceTrimmingConfig {
    /// Whether automatic silence skipping is on.
    pub enabled: bool,
    /// Level threshold in dBFS below which sound counts as silence (-80.0 dB to -20.0 dB).
    pub threshold_db: f64,
}

impl Default for SilenceTrimmingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold_db: -50.0,
        }
    }
}

impl SilenceTrimmingConfig {
    pub fn clamped(mut self) -> Self {
        self.threshold_db = self.threshold_db.clamp(-80.0, -20.0);
        self
    }
}

/// Detected sound boundaries in a track (everything outside them is silence).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SilenceBounds {
    /// Start of the first segment above the threshold (ms).
    pub start_ms: u64,
    /// End of the last segment above the threshold (ms). `None` when the end of the track was
    /// not analysed (e.g. decoding was interrupted); trailing silence is then not skipped.
    pub end_ms: Option<u64>,
}

/// Length of the RMS window used to detect silence.
pub const SILENCE_WINDOW_MS: u64 = 50;
/// Minimum leading silence worth skipping.
pub const MIN_LEADING_SILENCE_MS: u64 = 500;
/// Minimum trailing silence worth skipping.
pub const MIN_TRAILING_SILENCE_MS: u64 = 1_000;
/// Margin before the first sound, so the attack of the first note is not cut.
pub const LEADING_PREROLL_MS: u64 = 100;

/// Finds the sound boundaries in mono `f32` samples (range -1.0..=1.0).
///
/// The signal is split into [`SILENCE_WINDOW_MS`] windows; a window is "sound" when its
/// RMS level in dBFS exceeds `threshold_db`. Returns `None` when the whole signal is silence.
/// `end_ms` is always set: the caller decides whether the analysis covered the whole track.
pub fn find_silence_bounds(
    samples: &[f32],
    sample_rate: u32,
    threshold_db: f64,
) -> Option<SilenceBounds> {
    let mut scanner = SilenceScanner::new(sample_rate, threshold_db);
    scanner.push(samples);
    scanner.finish()
}

/// Streaming version of [`find_silence_bounds`]: samples come in chunks (e.g. straight
/// from the decoder), with constant memory, so the whole track need not be kept.
#[derive(Debug, Clone)]
pub struct SilenceScanner {
    sample_rate: u32,
    window: usize,
    threshold_rms: f64,
    window_sum_sq: f64,
    window_len: usize,
    samples_seen: usize,
    first_audible_start: Option<usize>,
    last_audible_end: Option<usize>,
}

impl SilenceScanner {
    pub fn new(sample_rate: u32, threshold_db: f64) -> Self {
        let window = ((sample_rate as u64 * SILENCE_WINDOW_MS) / 1000).max(1) as usize;
        Self {
            sample_rate,
            window,
            threshold_rms: 10f64.powf(threshold_db / 20.0),
            window_sum_sq: 0.0,
            window_len: 0,
            samples_seen: 0,
            first_audible_start: None,
            last_audible_end: None,
        }
    }

    /// Adds the next chunk of samples.
    pub fn push(&mut self, samples: &[f32]) {
        for &s in samples {
            self.window_sum_sq += (s as f64) * (s as f64);
            self.window_len += 1;
            self.samples_seen += 1;
            if self.window_len == self.window {
                self.close_window();
            }
        }
    }

    /// Number of samples processed so far.
    pub fn samples_seen(&self) -> usize {
        self.samples_seen
    }

    /// Finishes the analysis (with an incomplete last window) and returns the sound boundaries.
    pub fn finish(mut self) -> Option<SilenceBounds> {
        if self.window_len > 0 {
            self.close_window();
        }
        if self.sample_rate == 0 {
            return None;
        }
        let first = self.first_audible_start?;
        let last_end = self.last_audible_end?;
        let to_ms = |sample_idx: usize| (sample_idx as u64 * 1000) / self.sample_rate as u64;
        Some(SilenceBounds {
            start_ms: to_ms(first),
            end_ms: Some(to_ms(last_end)),
        })
    }

    fn close_window(&mut self) {
        let rms = (self.window_sum_sq / self.window_len as f64).sqrt();
        if rms > self.threshold_rms {
            let start = self.samples_seen - self.window_len;
            self.first_audible_start.get_or_insert(start);
            self.last_audible_end = Some(self.samples_seen);
        }
        self.window_sum_sq = 0.0;
        self.window_len = 0;
    }
}

/// Action the player should take when skipping silence.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrimAction {
    /// Seek to the given position (skip the leading silence).
    SeekTo(u64),
    /// End the track (skip the trailing silence).
    FinishTrack,
}

/// Decides whether to skip silence at the current playback moment.
///
/// - Leading silence is skipped only once per track (`leading_done`) and only at the very
///   start of playback: a later manual seek into silence is not "corrected".
/// - Trailing silence is skipped once `end_ms` is reached, if it is long enough.
pub fn trim_action(
    position_ms: u64,
    duration_ms: u64,
    bounds: &SilenceBounds,
    leading_done: bool,
) -> Option<TrimAction> {
    if !leading_done
        && bounds.start_ms >= MIN_LEADING_SILENCE_MS
        && position_ms + LEADING_PREROLL_MS < bounds.start_ms
        && position_ms < MIN_LEADING_SILENCE_MS
    {
        return Some(TrimAction::SeekTo(bounds.start_ms - LEADING_PREROLL_MS));
    }
    if let Some(end_ms) = bounds.end_ms {
        let trailing = duration_ms.saturating_sub(end_ms);
        if duration_ms > 0 && trailing >= MIN_TRAILING_SILENCE_MS && position_ms >= end_ms {
            return Some(TrimAction::FinishTrack);
        }
    }
    None
}
