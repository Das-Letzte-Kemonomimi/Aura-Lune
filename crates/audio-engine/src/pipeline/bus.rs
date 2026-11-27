//! GStreamer bus handling (EOS, errors, tags, spectrum), called by the playback ticker.

use super::*;

impl AudioEngine {
    /// Polls the GStreamer bus for pending messages without blocking the thread,
    /// handles end of track (repeat / next / stop) and the fade-out before EOS.
    pub fn poll_events(&self) -> Vec<PlayerEvent> {
        let mut events = Vec::new();
        let pipeline = self.inner.lock_safe().pipeline.clone();
        let mut last_spectrum_msg: Option<gst::Message> = None;

        if let Some(bus) = pipeline.bus() {
            while let Some(msg) = bus.pop() {
                if self.is_spectrum_message(&msg) {
                    last_spectrum_msg = Some(msg);
                    continue;
                }
                self.handle_bus_message(&pipeline, &msg, &mut events);
            }
        }

        if let Some(spec_msg) = last_spectrum_msg {
            if let Some(spectrum) = spec_msg.structure().and_then(spectrum_from_structure) {
                events.push(PlayerEvent::Spectrum(spectrum));
            }
        }

        let (pos, dur) = self.pre_eos_probe_pos_dur();
        self.apply_pre_eos_fade(pos, dur);
        events
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

/// Extracts the stereo spectrum from a `spectrum` element message (the `magnitude` field).
fn spectrum_from_structure(structure: &gst::StructureRef) -> Option<Vec<f32>> {
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
    let mut flat_db: Vec<f32> = Vec::with_capacity(64);
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
    crate::spectrum::stereo_display_spectrum(&channel_mags, &flat_db)
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
