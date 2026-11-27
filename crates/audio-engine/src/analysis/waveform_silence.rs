//! One decode feeding both the spectral seekbar waveform and the silence scanner.
//!
//! On the first play of a track with silence trimming on, the waveform and the silence bounds
//! are both missing, and each would otherwise run its own full 22.05 kHz mono decode.

use super::silence::LimitedSilenceScanner;
use super::*;
use crate::AnalysisError;
use domain::analysis::TrackWaveformData;
use std::sync::atomic::{AtomicBool, Ordering};

/// Waveform and silence bounds from one decode.
#[derive(Debug)]
pub struct WaveformAndSilence {
    /// `None` when the decode was cancelled before the end or produced no samples.
    pub waveform: Option<TrackWaveformData>,
    /// Same contract as [`detect_silence_bounds`]: `Ok(None)` for silent tracks or a cancel.
    pub silence: Result<Option<domain::SilenceBounds>, AnalysisError>,
}

/// Decodes a track once and returns its spectral waveform (`count` buckets, as
/// [`extract_track_waveform_spectrum`]) and its silence bounds (as [`detect_silence_bounds`]).
/// A cancel stops the decode and returns neither.
pub fn analyze_waveform_and_silence(
    uri_or_path: &str,
    count: usize,
    track_id: Option<i64>,
    threshold_db: f64,
    expected_duration_ms: Option<u64>,
    cancel: Option<&AtomicBool>,
) -> Result<WaveformAndSilence, AnalysisError> {
    let cancelled = || cancel.is_some_and(|c| c.load(Ordering::Relaxed));
    let session = decode::DecodeSession::open(uri_or_path, ANALYSIS_SAMPLE_RATE, 1)?;
    let mut waveform = SpectralWaveformAccumulator::new(ANALYSIS_SAMPLE_RATE);
    let mut silence = LimitedSilenceScanner::new(threshold_db);
    let end = session.run(MAX_DECODE, |chunk| {
        waveform.push(chunk);
        silence.push(chunk);
        !cancelled()
    });
    if cancelled() {
        return Ok(WaveformAndSilence {
            waveform: None,
            silence: Ok(None),
        });
    }
    if end == decode::DecodeEnd::TimedOut {
        tracing::warn!("Waveform + silence {uri_or_path}: decode timed out, partial waveform");
    }
    let waveform = (count > 0 && !waveform.is_empty()).then(|| waveform.finish(count, track_id));
    Ok(WaveformAndSilence {
        waveform,
        silence: silence.finish(end, expected_duration_ms),
    })
}
