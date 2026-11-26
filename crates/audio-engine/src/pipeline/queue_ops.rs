//! Playback queue: edits and track transitions (next/previous/index).

use super::*;

impl AudioEngine {
    /// Returns a copy of the current playback queue state.
    pub fn queue(&self) -> PlaybackQueue {
        self.queue.lock_safe().clone()
    }

    /// Replaces the queue contents and optionally starts playing from the given index.
    pub fn set_queue(
        &self,
        items: Vec<QueueItem>,
        start_index: Option<usize>,
    ) -> Result<Option<QueueItem>, AudioEngineError> {
        let ctx = self.switch_context();
        let active_item = {
            let mut q = self.queue.lock_safe();
            q.set_items(items, start_index);
            q.current_item().cloned()
        };

        if let Some(item) = &active_item {
            self.fade_out_before_switch(&ctx, ANTI_POP_FADE);
            self.load_uri(&item.uri)?;
            self.play_with_fade(true)?;
        }
        Ok(active_item)
    }

    /// Restores the queue items and index without loading or playing anything in GStreamer (safe app start).
    pub fn restore_queue(&self, items: Vec<QueueItem>, current_index: Option<usize>) {
        let mut q = self.queue.lock_safe();
        q.set_items(items, current_index);
    }

    /// Sets or adds the current active track to the queue.
    pub fn set_active_item(&self, item: QueueItem) {
        let mut q = self.queue.lock_safe();
        q.set_active_item(item);
    }

    /// Appends a track to the end of the current queue.
    pub fn add_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock_safe();
        q.add_item(item);
    }

    /// Inserts a track to play next, after the current one.
    pub fn add_next_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock_safe();
        q.add_next(item);
    }

    /// Removes a track from the queue by its unique ID.
    pub fn remove_from_queue(&self, id: &str) -> Option<QueueItem> {
        let mut q = self.queue.lock_safe();
        q.remove_item(id)
    }

    /// Moves a track within the queue.
    pub fn move_in_queue(&self, from: usize, to: usize) -> bool {
        let mut q = self.queue.lock_safe();
        q.move_item(from, to)
    }

    /// Clears the whole playback queue.
    pub fn clear_queue(&self) {
        let mut q = self.queue.lock_safe();
        q.clear();
    }

    /// Returns a copy of the current track in the playback queue.
    pub fn current_queue_item(&self) -> Option<QueueItem> {
        let q = self.queue.lock_safe();
        q.current_item().cloned()
    }

    /// Plays the track at the given queue index.
    pub fn play_index(&self, index: usize) -> Result<Option<QueueItem>, AudioEngineError> {
        // Lock order: `inner` may be held while taking `queue`, but never the reverse.
        // Take a snapshot of the engine state first (lock released), then modify the queue.
        let (user_vol, is_playing, volume, current_uri) = {
            let inner = self.inner.lock_safe();
            (
                self.volume(),
                inner.pipeline.current_state() == gst::State::Playing,
                inner.volume.clone(),
                inner.current_uri.clone(),
            )
        };
        let (item, is_same_track) = {
            let mut q = self.queue.lock_safe();
            let item = if index < q.items.len() {
                q.current_index = Some(index);
                if q.shuffle && !q.shuffle_order.is_empty() {
                    if let Some(pos) = q.shuffle_order.iter().position(|&x| x == index) {
                        q.shuffle_cursor = pos;
                    }
                }
                q.current_item().cloned()
            } else {
                None
            };
            let is_same = match (&item, &current_uri) {
                (Some(it), Some(cur)) => &it.uri == cur,
                _ => false,
            };
            (item, is_same)
        };

        if let Some(item) = &item {
            if is_same_track {
                if is_playing {
                    // Same track and already playing: seek to the start and make sure the volume is nominal
                    self.seek(Duration::ZERO)?;
                    volume.set_property("volume", user_vol);
                } else {
                    self.play_with_fade(true)?;
                }
            } else {
                // Quick anti-pop ramp when a queue track is clicked directly:
                // removes DAC clicks without adding latency or freezing the UI.
                self.fade_out_before_switch(
                    &SwitchContext {
                        crossfade_ms: 0,
                        user_vol,
                        is_playing,
                        volume: volume.clone(),
                    },
                    ANTI_POP_FADE,
                );
                self.load_uri(&item.uri)?;
                self.play_with_fade(true)?;
            }
        }
        Ok(item)
    }

    /// Moves to the next track in the queue according to the loop and shuffle modes,
    /// with an equal-power transition when crossfade is enabled.
    pub fn play_next(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        let ctx = self.switch_context();
        if ctx.crossfade_ms > 0 {
            let fade_out_ms = (ctx.crossfade_ms / 8).clamp(30, 150);
            self.fade_out_before_switch(&ctx, Duration::from_millis(fade_out_ms));
        }

        let next_item = {
            let mut q = self.queue.lock_safe();
            q.next().cloned()
        };

        match next_item {
            Some(item) => {
                self.start_switched_track(&ctx, &item.uri)?;
                Ok(Some(item))
            }
            None => {
                self.stop()?;
                Ok(None)
            }
        }
    }

    /// Moves to the previous track in the queue (or restarts the current one if it played > 3 s).
    pub fn play_previous(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        if let Some(pos) = self.position() {
            if pos.as_secs() >= 3 {
                self.seek(Duration::from_millis(0))?;
                let q = self.queue.lock_safe();
                return Ok(q.current_item().cloned());
            }
        }

        let ctx = self.switch_context();
        if ctx.crossfade_ms > 0 {
            let fade_out_ms = (ctx.crossfade_ms / 8).clamp(30, 150);
            self.fade_out_before_switch(&ctx, Duration::from_millis(fade_out_ms));
        }

        let prev_item = {
            let mut q = self.queue.lock_safe();
            q.previous().cloned()
        };

        match prev_item {
            Some(item) => {
                self.start_switched_track(&ctx, &item.uri)?;
                Ok(Some(item))
            }
            None => Ok(None),
        }
    }

    /// Sets the repeat mode (None, Track, Queue).
    pub fn set_loop_mode(&self, mode: LoopMode) {
        let mut q = self.queue.lock_safe();
        q.set_loop_mode(mode);
    }

    /// Returns the current repeat mode.
    pub fn loop_mode(&self) -> LoopMode {
        let q = self.queue.lock_safe();
        q.loop_mode
    }

    /// Enables or disables shuffle.
    pub fn set_shuffle(&self, enabled: bool) {
        let mut q = self.queue.lock_safe();
        q.set_shuffle(enabled);
    }

    /// Returns the shuffle state.
    pub fn shuffle(&self) -> bool {
        let q = self.queue.lock_safe();
        q.shuffle
    }

    /// Enables or disables "Stop After Current Track" (stop when the current track ends).
    pub fn set_stop_after_current(&self, enabled: bool) {
        self.stop_after_current.store(enabled, Ordering::SeqCst);
    }

    /// Returns the current state of the "Stop After Current Track" flag.
    pub fn stop_after_current(&self) -> bool {
        self.stop_after_current.load(Ordering::SeqCst)
    }

    /// State snapshot needed for a smooth track switch (taken before the queue lock).
    fn switch_context(&self) -> SwitchContext {
        let inner = self.inner.lock_safe();
        SwitchContext {
            crossfade_ms: inner.crossfade_duration_ms,
            user_vol: self.volume(),
            is_playing: inner.pipeline.current_state() == gst::State::Playing,
            volume: inner.volume.clone(),
        }
    }

    /// Fades out the playing track on an equal-power curve before switching (cancels earlier fades).
    fn fade_out_before_switch(&self, ctx: &SwitchContext, duration: Duration) {
        if !ctx.is_playing || ctx.user_vol <= 0.001 {
            return;
        }
        let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
        Self::fade_out_equal_power(
            &ctx.volume,
            ctx.user_vol,
            duration,
            &self.fade_generation,
            gen,
        );
    }

    /// Loads a new track and starts it: with a crossfade ramp-in (half the duration) if enabled,
    /// otherwise with a micro fade-in.
    fn start_switched_track(&self, ctx: &SwitchContext, uri: &str) -> Result<(), AudioEngineError> {
        self.load_uri(uri)?;
        if ctx.crossfade_ms > 0 && ctx.user_vol > 0.001 {
            self.play_with_fade_duration(Duration::from_millis(ctx.crossfade_ms / 2))
        } else {
            self.play_with_fade(true)
        }
    }
}

/// Duration of the short fade on a direct track switch (avoids DAC clicks).
const ANTI_POP_FADE: Duration = Duration::from_millis(20);

/// Engine state needed for a smooth track switch.
struct SwitchContext {
    crossfade_ms: u64,
    user_vol: f64,
    is_playing: bool,
    volume: gst::Element,
}
