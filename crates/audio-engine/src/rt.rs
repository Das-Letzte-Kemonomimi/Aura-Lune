//! Helpers for code that runs on the GStreamer streaming thread
//! (the DSP element's `chain` function, the saturator, stereo widener and clip-detection pad probes).
//!
//! Rules (crates/AGENTS.md, "Real-Time Audio Safety"): no heap allocation, no I/O and no long-held locks
//! on the hot path. Buffer bytes are cast to `f32` with an alignment check
//! (`bytemuck`) instead of an unchecked `slice::from_raw_parts`.

use std::sync::atomic::{AtomicU64, Ordering};

/// View of buffer bytes as `f32` samples. `None` when the buffer is not 4-byte aligned
/// or its length is not a multiple of 4.
pub fn f32_samples(bytes: &[u8]) -> Option<&[f32]> {
    bytemuck::try_cast_slice(bytes).ok()
}

/// Mutable view of buffer bytes as `f32` samples (see [`f32_samples`]).
pub fn f32_samples_mut(bytes: &mut [u8]) -> Option<&mut [f32]> {
    bytemuck::try_cast_slice_mut(bytes).ok()
}

/// Appends `f32` samples from buffer bytes to `out`. Also works for unaligned buffers
/// (byte-by-byte copy); trailing excess bytes (< 4) are skipped.
pub fn extend_f32_samples(bytes: &[u8], out: &mut Vec<f32>) {
    if let Some(samples) = f32_samples(bytes) {
        out.extend_from_slice(samples);
        return;
    }
    out.extend(
        bytes
            .as_chunks::<4>()
            .0
            .iter()
            .map(|c| f32::from_ne_bytes(*c)),
    );
}

/// Applies `f` to every `f32` sample in the buffer in place, even when the buffer is unaligned.
pub fn map_f32_samples_in_place(bytes: &mut [u8], mut f: impl FnMut(f32) -> f32) {
    if let Some(samples) = f32_samples_mut(bytes) {
        for s in samples.iter_mut() {
            *s = f(*s);
        }
        return;
    }
    for c in bytes.as_chunks_mut::<4>().0 {
        *c = f(f32::from_ne_bytes(*c)).to_ne_bytes();
    }
}

/// Applies `f` to every stereo frame (L, R) in place, even when the buffer is unaligned.
pub fn map_stereo_frames_in_place(bytes: &mut [u8], mut f: impl FnMut(f32, f32) -> (f32, f32)) {
    if let Some(samples) = f32_samples_mut(bytes) {
        for frame in samples.as_chunks_mut::<2>().0 {
            let (l, r) = f(frame[0], frame[1]);
            *frame = [l, r];
        }
        return;
    }
    for frame in bytes.as_chunks_mut::<8>().0 {
        let (lb, rb) = frame.split_at_mut(4);
        let l = f32::from_ne_bytes([lb[0], lb[1], lb[2], lb[3]]);
        let r = f32::from_ne_bytes([rb[0], rb[1], rb[2], rb[3]]);
        let (l, r) = f(l, r);
        lb.copy_from_slice(&l.to_ne_bytes());
        rb.copy_from_slice(&r.to_ne_bytes());
    }
}

/// Whether any sample is above full scale (|s| > 1.0, i.e. past 0 dBFS). NaN never counts.
pub fn exceeds_full_scale(samples: &[f32]) -> bool {
    samples.iter().any(|s| s.abs() > 1.0)
}

/// [`exceeds_full_scale`] on raw buffer bytes, also for unaligned buffers (no copy, no allocation);
/// trailing excess bytes (< 4) are skipped.
pub fn bytes_exceed_full_scale(bytes: &[u8]) -> bool {
    if let Some(samples) = f32_samples(bytes) {
        return exceeds_full_scale(samples);
    }
    bytes
        .as_chunks::<4>()
        .0
        .iter()
        .any(|c| f32::from_ne_bytes(*c).abs() > 1.0)
}

/// Rate-limits warnings on the hot path: log the first occurrence
/// and then every `every`-th one (a DSP error on every buffer won't flood the logs).
#[derive(Debug, Default)]
pub struct RateLimiter {
    count: AtomicU64,
}

impl RateLimiter {
    pub const fn new() -> Self {
        Self {
            count: AtomicU64::new(0),
        }
    }

    /// Returns `true` when the current event should be logged.
    pub fn should_log(&self, every: u64) -> bool {
        let n = self.count.fetch_add(1, Ordering::Relaxed);
        every == 0 || n.is_multiple_of(every)
    }
}
