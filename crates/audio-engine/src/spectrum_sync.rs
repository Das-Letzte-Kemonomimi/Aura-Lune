//! Releases spectrum frames when their audio is heard, not when it is analysed.
//!
//! The `spectrum` analyser runs upstream of the sink's ring buffer (and, before the
//! graph reorder, of the 600 ms output queue), so its bus messages describe audio that
//! plays hundreds of milliseconds later. [`SpectrumSync`] keeps frames keyed by their
//! stream time and hands out the newest one the sink position has reached.
//!
//! Pure and generic over the frame payload (the engine stores `gst::Message`s and parses
//! only the released one); tested in `tests/spectrum_sync_test.rs`.
//! Runs on the playback ticker thread, never on a streaming thread.

use std::collections::VecDeque;
use std::time::Duration;

/// Upper bound of pending frames (12.8 s at the 100 ms interval: more than the
/// largest 4 s queue plus a 4 s sink buffer). The oldest frame is dropped when full.
pub const SPECTRUM_SYNC_CAPACITY: usize = 128;
/// Frames are released this much before their mid-point is heard. The ticker emits every
/// 100 ms and each frame stays on screen for one tick, so half a tick centres it.
pub const SPECTRUM_RELEASE_LOOKAHEAD: Duration = Duration::from_millis(50);
/// A released frame older than this (e.g. right after a forward seek) is dropped instead of shown.
pub const SPECTRUM_MAX_STALENESS: Duration = Duration::from_millis(250);

/// Pending spectrum frames ordered by stream time.
#[derive(Debug)]
pub struct SpectrumSync<T> {
    pending: VecDeque<(Duration, T)>,
    last_pushed: Option<Duration>,
}

impl<T> Default for SpectrumSync<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T> SpectrumSync<T> {
    pub fn new() -> Self {
        Self {
            pending: VecDeque::with_capacity(SPECTRUM_SYNC_CAPACITY),
            last_pushed: None,
        }
    }

    /// Queues a frame describing audio at stream time `at` (the analysis window's mid-point).
    /// A frame earlier than the previous one marks a discontinuity (seek, new track,
    /// stop and replay): every pending frame belongs to the old timeline and is dropped.
    pub fn push(&mut self, at: Duration, frame: T) {
        if self.last_pushed.is_some_and(|last| at < last) {
            self.pending.clear();
        }
        if self.pending.len() >= SPECTRUM_SYNC_CAPACITY {
            self.pending.pop_front();
        }
        self.pending.push_back((at, frame));
        self.last_pushed = Some(at);
    }

    /// Returns the newest frame whose time the sink has reached (`heard` is the sink
    /// position in stream time), dropping every older one. Frames still ahead of the
    /// listener stay pending; a frame that is already too old is discarded.
    pub fn release(&mut self, heard: Duration) -> Option<T> {
        let target = heard + SPECTRUM_RELEASE_LOOKAHEAD;
        let mut chosen = None;
        while self.pending.front().is_some_and(|(at, _)| *at <= target) {
            chosen = self.pending.pop_front();
        }
        chosen
            .filter(|(at, _)| target.saturating_sub(*at) <= SPECTRUM_MAX_STALENESS)
            .map(|(_, frame)| frame)
    }

    /// Drops all pending frames (stop).
    pub fn clear(&mut self) {
        self.pending.clear();
        self.last_pushed = None;
    }

    pub fn len(&self) -> usize {
        self.pending.len()
    }

    pub fn is_empty(&self) -> bool {
        self.pending.is_empty()
    }
}
