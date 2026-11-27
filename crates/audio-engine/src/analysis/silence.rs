//! Detects silence at the start and end of a track.

use super::*;
use crate::AnalysisError;

/// Longest stretch of audio scanned for silence (2 h).
const SILENCE_MAX_DECODE_SEC: f64 = 2.0 * 60.0 * 60.0;

/// Detects silence at the start and end of a track (used to skip silence during playback).
///
/// `expected_duration_ms` is the track length known from tags or the library. If decoding did not
/// cover the whole track (timeout), the end bound is discarded (`end_ms = None`)
/// so music is never cut off before it ends.
pub fn detect_silence_bounds(
    uri_or_path: &str,
    threshold_db: f64,
    expected_duration_ms: Option<u64>,
    cancel: Option<&std::sync::atomic::AtomicBool>,
) -> Result<Option<domain::SilenceBounds>, AnalysisError> {
    let cancelled = || cancel.is_some_and(|c| c.load(std::sync::atomic::Ordering::Relaxed));
    // Streaming: samples go straight into the RMS scanner, so memory stays constant
    // (previously the whole track, up to ~635 MB for 2 h, was buffered in a Vec).
    let session = decode::DecodeSession::open(uri_or_path, ANALYSIS_SAMPLE_RATE, 1)?;
    let mut scanner = LimitedSilenceScanner::new(threshold_db);
    let end = session.run(std::time::Duration::from_secs(20), |chunk| {
        scanner.push(chunk);
        !scanner.is_full() && !cancelled()
    });
    if cancelled() {
        return Ok(None);
    }
    scanner.finish(end, expected_duration_ms)
}

/// A [`domain::SilenceScanner`] at [`ANALYSIS_SAMPLE_RATE`] that stops taking samples after
/// [`SILENCE_MAX_DECODE_SEC`], shared by [`detect_silence_bounds`] and the combined
/// waveform + silence decode.
pub(super) struct LimitedSilenceScanner {
    scanner: domain::SilenceScanner,
    target: usize,
}

impl LimitedSilenceScanner {
    pub(super) fn new(threshold_db: f64) -> Self {
        Self {
            scanner: domain::SilenceScanner::new(ANALYSIS_SAMPLE_RATE, threshold_db),
            target: (SILENCE_MAX_DECODE_SEC * ANALYSIS_SAMPLE_RATE as f64) as usize,
        }
    }

    pub(super) fn push(&mut self, chunk: &[f32]) {
        let room = self.target.saturating_sub(self.scanner.samples_seen());
        self.scanner.push(&chunk[..chunk.len().min(room)]);
    }

    pub(super) fn is_full(&self) -> bool {
        self.scanner.samples_seen() >= self.target
    }

    /// The bounds found, with `end_ms` dropped unless the whole track (per
    /// `expected_duration_ms`) was decoded.
    pub(super) fn finish(
        self,
        end: decode::DecodeEnd,
        expected_duration_ms: Option<u64>,
    ) -> Result<Option<domain::SilenceBounds>, AnalysisError> {
        let decoded = self.scanner.samples_seen();
        let scanner = decode::finish(decoded > 0, end, self.scanner, "mono")?;
        let decoded_ms = decoded as u64 * 1000 / ANALYSIS_SAMPLE_RATE as u64;
        let Some(mut bounds) = scanner.finish() else {
            return Ok(None);
        };
        let decoded_whole_track = match expected_duration_ms {
            Some(expected) if expected > 0 => decoded_ms + 1_500 >= expected,
            _ => false,
        };
        if !decoded_whole_track {
            bounds.end_ms = None;
        }
        Ok(Some(bounds))
    }
}
