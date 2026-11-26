//! Detects silence at the start and end of a track.

use super::*;
use crate::AnalysisError;

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
    const MAX_DECODE_SEC: f64 = 2.0 * 60.0 * 60.0;
    // Streaming: samples go straight into the RMS scanner, so memory stays constant
    // (previously the whole track, up to ~635 MB for 2 h, was buffered in a Vec).
    let session = decode::DecodeSession::open(uri_or_path, ANALYSIS_SAMPLE_RATE, 1)?;
    let target = (MAX_DECODE_SEC * ANALYSIS_SAMPLE_RATE as f64) as usize;
    let mut scanner = domain::SilenceScanner::new(ANALYSIS_SAMPLE_RATE, threshold_db);
    let end = session.run(std::time::Duration::from_secs(20), |chunk| {
        let room = target.saturating_sub(scanner.samples_seen());
        scanner.push(&chunk[..chunk.len().min(room)]);
        scanner.samples_seen() < target && !cancelled()
    });
    if cancelled() {
        return Ok(None);
    }
    let decoded = scanner.samples_seen();
    let scanner = decode::finish(decoded > 0, end, scanner, "mono")?;
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
