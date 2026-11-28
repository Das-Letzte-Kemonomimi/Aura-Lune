//! When a DSP parameter change must flush the audio already buffered downstream.
//!
//! `auralune_dsp` only affects buffers it processes after the change. Everything between it
//! and the speakers (the output queue plus the sink ring buffer, 0.8 s and up) still plays
//! with the old pitch / tempo / rate, so the sound, the spectrum and the waveform follow a
//! slider only after that latency. A flush seek to the current position drops those buffers.
//!
//! Pure decision logic, tested in `tests/dsp_resync_test.rs`.

use dsp_api::DspParams;
use std::time::Duration;

/// Quiet period after the last parameter change before the flush seek runs, so dragging a
/// slider causes one flush at the end instead of one per event.
pub const DSP_RESYNC_DEBOUNCE: Duration = Duration::from_millis(120);

/// Returns `true` when the audible result of `new` differs from `old` and already queued
/// audio would therefore play stale. Bypass ignores the stored pitch / tempo / rate.
pub fn needs_flush_resync(old: &DspParams, new: &DspParams) -> bool {
    let old_bypass = old.is_bypass();
    let new_bypass = new.is_bypass();
    if old_bypass && new_bypass {
        return false;
    }
    if old_bypass != new_bypass || old.engine != new.engine {
        return true;
    }
    (old.pitch_semitones - new.pitch_semitones).abs() > 1e-4
        || (old.tempo_ratio - new.tempo_ratio).abs() > 1e-4
        || (old.rate_ratio - new.rate_ratio).abs() > 1e-4
}
