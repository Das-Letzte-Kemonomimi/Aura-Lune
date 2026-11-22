//! Wykrywanie ciszy na początku i końcu utworu.

use super::*;
use crate::AnalysisError;

/// Wykrywa ciszę na początku i końcu utworu (do pomijania ciszy podczas odtwarzania).
///
/// `expected_duration_ms` to długość utworu znana z tagów/biblioteki. Jeśli dekodowanie nie
/// objęło całego utworu (limit czasu), granica końcowa jest odrzucana (`end_ms = None`),
/// aby nigdy nie ucinać muzyki przed jej końcem.
pub fn detect_silence_bounds(
    uri_or_path: &str,
    threshold_db: f64,
    expected_duration_ms: Option<u64>,
) -> Result<Option<domain::SilenceBounds>, AnalysisError> {
    const MAX_DECODE_SEC: f64 = 2.0 * 60.0 * 60.0;
    let samples = decode_mono_22k(
        uri_or_path,
        MAX_DECODE_SEC,
        std::time::Duration::from_secs(20),
    )?;
    let decoded_ms = samples.len() as u64 * 1000 / ANALYSIS_SAMPLE_RATE as u64;
    let Some(mut bounds) =
        domain::silence::find_silence_bounds(&samples, ANALYSIS_SAMPLE_RATE, threshold_db)
    else {
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
