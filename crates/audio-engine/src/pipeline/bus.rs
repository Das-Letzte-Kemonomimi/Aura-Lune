//! GStreamer bus handling (EOS, errors, tags, spectrum), called by the playback ticker.

use super::*;

impl AudioEngine {
    /// Polls the GStreamer bus for pending messages without blocking the thread,
    /// handles end of track (repeat / next / stop) and the fade-out before EOS.
    pub fn poll_events(&self) -> Vec<PlayerEvent> {
        let mut events = Vec::new();
        let pipeline = self.inner.lock_safe().pipeline.clone();
        let mut spectrum_msgs: Vec<gst::Message> = Vec::new();

        if let Some(bus) = pipeline.bus() {
            while let Some(msg) = bus.pop() {
                if self.is_spectrum_message(&msg) {
                    spectrum_msgs.push(msg);
                    continue;
                }
                self.handle_bus_message(&pipeline, &msg, &mut events);
            }
        }

        if let Some(spectrum) = self.release_heard_spectrum(spectrum_msgs) {
            events.push(PlayerEvent::Spectrum(spectrum));
        }

        let (pos, dur) = self.pre_eos_probe_pos_dur();
        self.apply_pre_eos_fade(pos, dur);
        events
    }

    /// Queues the new analyser messages by stream time and returns the bands of the one
    /// the sink is playing now. The analyser sits upstream of the sink's ring buffer, so
    /// its messages arrive before their audio is heard (measured: 0.7-0.8 s when it sat
    /// before the 600 ms queue, still 0.1-1.7 s after it depending on the sink buffer);
    /// emitting them on arrival made the bars run ahead.
    fn release_heard_spectrum(&self, msgs: Vec<gst::Message>) -> Option<Vec<f32>> {
        if msgs.is_empty() && self.spectrum_sync.lock_safe().is_empty() {
            return None; // visualiser off: skip the position query
        }
        let (heard, sample_rate) = {
            let inner = self.inner.lock_safe();
            (
                Self::query_raw_sink_position(&inner),
                analyser_sample_rate(&inner.spectrum),
            )
        };
        let mut sync = self.spectrum_sync.lock_safe();
        let mut untimed = None;
        for msg in msgs {
            match msg.structure().and_then(spectrum_frame_time) {
                Some(at) => sync.push(at, msg),
                // No timestamps: fall back to showing it on arrival.
                None => untimed = Some(msg),
            }
        }
        let msg = heard.and_then(|pos| sync.release(pos)).or(untimed)?;
        drop(sync);
        msg.structure()
            .and_then(|s| spectrum_from_structure(s, sample_rate))
    }

    /// Drops pending spectrum frames (playback stopped).
    pub(super) fn clear_spectrum_sync(&self) {
        self.spectrum_sync.lock_safe().clear();
    }

    fn is_spectrum_message(&self, msg: &gst::Message) -> bool {
        matches!(
            msg.view(),
            gst::MessageView::Element(elem_msg)
                if elem_msg
                    .structure()
                    .is_some_and(|s| s.name() == "spectrum")
        )
    }

    fn handle_bus_message(
        &self,
        pipeline: &gst::Pipeline,
        msg: &gst::Message,
        events: &mut Vec<PlayerEvent>,
    ) {
        use gst::MessageView;
        match msg.view() {
            MessageView::Eos(..) => {
                info!("Received the EOS message (end of stream)");
                self.handle_eos(events);
                events.push(PlayerEvent::Eos);
            }
            MessageView::DurationChanged(..) => {
                self.inner.lock_safe().cached_duration = None;
            }
            MessageView::Error(err) => {
                let error_msg = format!(
                    "GStreamer error from {}: {} ({:?})",
                    msg.src()
                        .map(|s| s.path_string().to_string())
                        .unwrap_or_default(),
                    err.error(),
                    err.debug()
                );
                error!("{}", error_msg);
                self.mark_stopped();
                events.push(PlayerEvent::Error(error_msg));
            }
            MessageView::Warning(warn) => {
                let warn_msg = format!("GStreamer Warning: {} ({:?})", warn.error(), warn.debug());
                warn!("{}", warn_msg);
                events.push(PlayerEvent::Warning(warn_msg));
            }
            MessageView::Buffering(buffering) => {
                let percent = buffering.percent();
                debug!("Buffering: {}%", percent);
                events.push(PlayerEvent::Buffering(percent));
            }
            MessageView::StateChanged(state_changed) => {
                let pipeline_obj: &gst::Object = pipeline.upcast_ref();
                if msg.src() != Some(pipeline_obj) {
                    return;
                }
                let map_state = |s: gst::State| match s {
                    gst::State::Playing => PlaybackState::Playing,
                    gst::State::Paused => PlaybackState::Paused,
                    _ => PlaybackState::Stopped,
                };
                let old = map_state(state_changed.old());
                let new = map_state(state_changed.current());
                if old != new {
                    debug!("Pipeline state change: {:?} -> {:?}", old, new);
                    events.push(PlayerEvent::StateChanged { old, new });
                }
            }
            MessageView::Tag(tag_msg) => {
                if let Some(text) = tag_text(&tag_msg.tags()) {
                    events.push(PlayerEvent::Tag(text));
                }
            }
            _ => {}
        }
    }

    /// End of track: "stop after current", repeat, or move to the next one.
    fn handle_eos(&self, events: &mut Vec<PlayerEvent>) {
        // The "Stop After Current Track" flag (foobar2000 classic) is one-shot.
        if self.stop_after_current.swap(false, Ordering::SeqCst) {
            info!("'Stop After Current Track' is active; stopping the audio pipeline instead of moving to the next track");
            let old_state = {
                let mut inner = self.inner.lock_safe();
                let old = inner.state;
                inner.state = PlaybackState::Stopped;
                let _ = inner.pipeline.set_state(gst::State::Null);
                old
            };
            events.push(PlayerEvent::StateChanged {
                old: old_state,
                new: PlaybackState::Stopped,
            });
            return;
        }

        let (loop_mode, queue_is_empty) = {
            let q = self.queue.lock_safe();
            (q.loop_mode, q.items.is_empty())
        };
        match loop_mode {
            // Global repeat of the current track, wherever it was started from.
            LoopMode::Track => self.replay_current("LoopMode::Track", events),
            // A single track outside the queue with repeat-all on.
            LoopMode::Queue if queue_is_empty => {
                self.replay_current("LoopMode::Queue (single track)", events)
            }
            _ => self.advance_after_eos(),
        }
    }

    /// Reloads the current URI and plays it from the start (`PlayerEvent::TrackLooped`).
    fn replay_current(&self, reason: &str, events: &mut Vec<PlayerEvent>) {
        let Some(uri) = self.inner.lock_safe().current_uri.clone() else {
            warn!("{} is active, but there is no URI to repeat", reason);
            self.mark_stopped();
            return;
        };
        info!(
            "{}: reloading and replaying the track from the start: {}",
            reason, uri
        );
        if let Err(e) = self.load_uri(&uri) {
            error!("Failed to load the URI for repeat: {}", e);
            self.mark_stopped();
        } else if let Err(e) = self.play() {
            error!("Failed to play the track for repeat: {}", e);
            self.mark_stopped();
        } else {
            events.push(PlayerEvent::TrackLooped);
        }
    }

    /// Automatically moves to the next track in the queue (with crossfade, if enabled).
    fn advance_after_eos(&self) {
        self.mark_stopped();
        let next_item = self.queue.lock_safe().next().cloned();
        let Some(item) = next_item else {
            let _ = self.stop();
            return;
        };
        if let Err(e) = self.load_uri(&item.uri) {
            error!("Failed to load the next track after EOS: {}", e);
            return;
        }
        let (crossfade_ms, user_vol) = {
            let inner = self.inner.lock_safe();
            (inner.crossfade_duration_ms, self.volume())
        };
        if crossfade_ms > 0 && user_vol > 0.001 {
            let _ = self.play_with_fade_duration(Duration::from_millis(crossfade_ms / 2));
        } else {
            let _ = self.play();
        }
        info!(
            "Queue: automatic transition after EOS to track: {}",
            item.title
        );
    }

    fn mark_stopped(&self) {
        self.inner.lock_safe().state = PlaybackState::Stopped;
    }

    fn pre_eos_probe_pos_dur(&self) -> (Option<Duration>, Option<Duration>) {
        if self.is_fading_in.load(Ordering::Relaxed) {
            return (None, None);
        }
        let user_vol = self.volume();
        if user_vol <= 0.001 {
            return (None, None);
        }
        let mut inner = self.inner.lock_safe();
        if inner.state != PlaybackState::Playing || inner.crossfade_duration_ms == 0 {
            return (None, None);
        }
        if self.queue.lock_safe().loop_mode == LoopMode::Track {
            return (None, None);
        }
        let dur = Self::duration_locked(&mut inner);
        let pos = Self::calculate_media_position(&mut inner);
        (pos, dur)
    }

    /// As a track nears its end, fade it out on an equal-power curve (first half of the crossfade).
    fn apply_pre_eos_fade(&self, pos: Option<Duration>, dur: Option<Duration>) {
        let (Some(pos), Some(dur)) = (pos, dur) else {
            return;
        };
        if dur <= pos {
            return;
        }
        let (crossfade_ms, user_vol, volume) = {
            let inner = self.inner.lock_safe();
            (
                inner.crossfade_duration_ms,
                self.volume(),
                inner.volume.clone(),
            )
        };
        if crossfade_ms == 0 || user_vol <= 0.001 {
            return;
        }
        let fade_out_ms = crossfade_ms / 2;
        let remaining_ms = (dur - pos).as_millis() as u64;
        if remaining_ms <= fade_out_ms {
            let t = remaining_ms as f64 / fade_out_ms as f64;
            let gain = (t * std::f64::consts::FRAC_PI_2).sin();
            volume.set_property("volume", user_vol * gain);
        } else {
            let cur_vol: f64 = volume.property("volume");
            if (cur_vol - user_vol).abs() > 0.01 {
                volume.set_property("volume", user_vol);
            }
        }
    }
}

/// Mid-point of a spectrum message's analysis interval in stream time
/// (`stream-time + duration / 2`), the same timeline the sink position query reports.
fn spectrum_frame_time(structure: &gst::StructureRef) -> Option<Duration> {
    let stream_time = structure.get::<u64>("stream-time").ok()?;
    if stream_time == u64::MAX {
        return None; // GST_CLOCK_TIME_NONE
    }
    let duration = structure
        .get::<u64>("duration")
        .ok()
        .filter(|&d| d != u64::MAX)
        .unwrap_or(0);
    Some(Duration::from_nanos(
        stream_time.saturating_add(duration / 2),
    ))
}

/// Sample rate negotiated on the analyser's input (needed to map FFT bins to Hz).
fn analyser_sample_rate(spectrum: &gst::Element) -> u32 {
    spectrum
        .static_pad("sink")
        .and_then(|pad| pad.current_caps())
        .and_then(|caps| caps.structure(0).and_then(|s| s.get::<i32>("rate").ok()))
        .and_then(|rate| u32::try_from(rate).ok())
        .filter(|&rate| rate > 0)
        .unwrap_or(crate::spectrum::DEFAULT_SAMPLE_RATE)
}

/// Extracts the stereo spectrum from a `spectrum` element message (the `magnitude` field).
fn spectrum_from_structure(structure: &gst::StructureRef, sample_rate: u32) -> Option<Vec<f32>> {
    if structure.name() != "spectrum" {
        return None;
    }
    let val = structure.value("magnitude").ok()?;
    let as_f32 = |v: &glib::SendValue| -> Option<f32> {
        v.get::<f32>()
            .ok()
            .or_else(|| v.get::<f64>().ok().map(|d| d as f32))
    };

    let mut channel_mags: Vec<Vec<f32>> = Vec::with_capacity(2);
    let mut flat_db: Vec<f32> = Vec::new();
    if let Ok(list) = val.get::<gst::ListRef>() {
        let items = list.as_slice();
        for item in items {
            if let Some(db) = as_f32(item) {
                flat_db.push(db);
            } else if let Ok(sub_list) = item.get::<gst::ListRef>() {
                let sub = sub_list.as_slice();
                let mut ch = Vec::with_capacity(sub.len());
                ch.extend(sub.iter().filter_map(as_f32));
                channel_mags.push(ch);
            }
        }
    } else if let Ok(arr) = val.get::<gst::ArrayRef>() {
        let items = arr.as_slice();
        flat_db.reserve(items.len());
        flat_db.extend(items.iter().filter_map(as_f32));
    }
    crate::spectrum::stereo_display_spectrum(&channel_mags, &flat_db, sample_rate)
}

/// "Artist - Title" text from the stream tags (e.g. internet radio).
fn tag_text(tags: &gst::TagListRef) -> Option<String> {
    let title = tags.get::<gst::tags::Title>().map(|t| t.get().to_string());
    let artist = tags.get::<gst::tags::Artist>().map(|a| a.get().to_string());
    let text = match (artist, title) {
        (Some(a), Some(t)) => format!("{} - {}", a, t),
        (None, Some(t)) => t,
        (Some(a), None) => a,
        (None, None) => return None,
    };
    (!text.is_empty()).then_some(text)
}
