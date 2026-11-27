//! Playback control: play/pause/stop, seeking and position.

use super::*;

impl AudioEngine {
    /// Ensures a URI is loaded (from the active queue item if needed) and applies any deferred
    /// initial seek silently in `State::Paused` before transitioning the sink to `Playing`.
    fn prepare_for_playback(
        &self,
        initial_volume_zero: bool,
    ) -> Result<Option<(gst::Pipeline, gst::Element, f64)>, AudioEngineError> {
        let uri_to_load = {
            let inner = self.inner.lock_safe();
            if inner.current_uri.is_none() {
                self.queue
                    .lock_safe()
                    .current_item()
                    .map(|it| it.uri.clone())
            } else {
                None
            }
        };

        if let Some(uri) = uri_to_load {
            self.load_uri(&uri)?;
        }

        let (pipeline, pending_seek) = {
            let mut inner = self.inner.lock_safe();
            if inner.current_uri.is_none() {
                return Ok(None);
            }
            (inner.pipeline.clone(), inner.pending_seek.take())
        };

        if let Some(pos) = pending_seek {
            // Preroll silently to Paused so GStreamer can seek to `pos` before emitting any audio.
            pipeline.set_state(gst::State::Paused)?;
            let (state_res, current, pending) = pipeline.state(gst::ClockTime::from_mseconds(1500));
            debug!(
                "Preroll before initial seek {:?}: {:?} (current={:?}, pending={:?})",
                pos, state_res, current, pending
            );
            let position_ns = gst::ClockTime::from_nseconds(pos.as_nanos() as u64);
            if let Err(err) = pipeline.seek_simple(
                gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                position_ns,
            ) {
                warn!("Initial seek to {:?} failed: {:?}", pos, err);
                let mut inner = self.inner.lock_safe();
                inner.base_media_pos = Duration::ZERO;
                inner.base_sink_pts = Duration::ZERO;
            } else {
                let _ = pipeline.state(gst::ClockTime::from_mseconds(1000));
                let mut inner = self.inner.lock_safe();
                inner.base_media_pos = pos;
                inner.base_sink_pts = pos;
            }
        }

        let target_vol = self.volume();
        let mut inner = self.inner.lock_safe();
        if inner.current_uri.is_none() {
            return Ok(None);
        }
        inner.volume.set_property(
            "volume",
            if initial_volume_zero {
                0.0f64
            } else {
                target_vol
            },
        );
        inner.state = PlaybackState::Playing;
        Ok(Some((
            inner.pipeline.clone(),
            inner.volume.clone(),
            target_vol,
        )))
    }

    /// Starts or resumes playback.
    pub fn play(&self) -> Result<(), AudioEngineError> {
        let Some((pipeline, volume, user_vol)) = self.prepare_for_playback(false)? else {
            debug!("No file loaded and no active track in the queue; skipping play");
            return Ok(());
        };
        pipeline.set_state(gst::State::Playing)?;
        volume.set_property("volume", user_vol);
        debug!(
            "Pipeline state changed to Playing (volume: {:.2})",
            user_vol
        );
        Ok(())
    }

    /// Resumes playback with an optional micro fade-in (about 30 ms).
    pub fn play_with_fade(&self, fade: bool) -> Result<(), AudioEngineError> {
        if !fade {
            return self.play();
        }

        let Some((pipeline, volume, target_vol)) = self.prepare_for_playback(true)? else {
            debug!("No file loaded and no active track in the queue; skipping play_with_fade");
            return Ok(());
        };

        // Change the pipeline state outside the `inner` mutex
        pipeline.set_state(gst::State::Playing)?;

        let steps = 4;
        for i in 1..=steps {
            let factor = (i as f64) / (steps as f64);
            volume.set_property("volume", target_vol * factor);
            std::thread::sleep(Duration::from_millis(8));
        }
        volume.set_property("volume", target_vol);

        debug!("Pipeline state changed to Playing with a micro fade-in");
        Ok(())
    }

    /// Pauses playback.
    pub fn pause(&self) -> Result<(), AudioEngineError> {
        let pipeline = {
            let mut inner = self.inner.lock_safe();
            inner.state = PlaybackState::Paused;
            inner.pipeline.clone()
        };
        pipeline.set_state(gst::State::Paused)?;
        debug!("Pipeline state changed to Paused");
        Ok(())
    }

    /// Pauses playback with an optional micro fade-out (about 30 ms).
    pub fn pause_with_fade(&self, fade: bool) -> Result<(), AudioEngineError> {
        if !fade {
            return self.pause();
        }

        let (pipeline, volume, target_vol) = {
            let inner = self.inner.lock_safe();
            (inner.pipeline.clone(), inner.volume.clone(), self.volume())
        };

        let steps = 4;
        for i in (0..steps).rev() {
            let factor = (i as f64) / (steps as f64);
            volume.set_property("volume", target_vol * factor);
            std::thread::sleep(Duration::from_millis(8));
        }

        pipeline.set_state(gst::State::Paused)?;
        volume.set_property("volume", target_vol);
        {
            let mut inner = self.inner.lock_safe();
            inner.state = PlaybackState::Paused;
        }
        debug!("Pipeline state changed to Paused with a micro fade-out");
        Ok(())
    }

    /// Returns the raw position from the playback sink (the audio device clock).
    pub(super) fn query_raw_sink_position(inner: &PipelineInner) -> Option<Duration> {
        let mut q = gst::query::Position::new(gst::Format::Time);
        if inner.pipeline.query(&mut q) {
            match q.result() {
                gst::GenericFormattedValue::Time(Some(t)) => {
                    Some(Duration::from_nanos(t.nseconds()))
                }
                _ => None,
            }
        } else {
            None
        }
    }

    /// Returns the total duration of the loaded file (from the demuxer/decoder).
    pub(super) fn query_raw_duration(inner: &PipelineInner) -> Option<Duration> {
        let mut q = gst::query::Duration::new(gst::Format::Time);
        if inner.pipeline.query(&mut q) {
            match q.result() {
                gst::GenericFormattedValue::Time(Some(t)) => {
                    Some(Duration::from_nanos(t.nseconds()))
                }
                _ => None,
            }
        } else {
            None
        }
    }

    /// Returns the cached track duration, querying GStreamer once until invalidated on
    /// `load_uri`/`stop`/`DurationChanged`.
    pub(super) fn duration_locked(inner: &mut PipelineInner) -> Option<Duration> {
        if inner.cached_duration.is_some() {
            return inner.cached_duration;
        }
        let queried = Self::query_raw_duration(inner);
        if queried.is_some() {
            inner.cached_duration = queried;
        }
        queried
    }

    /// Computes the real position in the source file, syncing the timeline with the pipeline and the DSP engine.
    pub(super) fn calculate_media_position(inner: &mut PipelineInner) -> Option<Duration> {
        let sink_pos = Self::query_raw_sink_position(inner).unwrap_or(inner.base_sink_pts);

        // If the sink query returns 0 during preroll/seek and the base position is > 0, keep the base position
        if sink_pos == Duration::ZERO && inner.base_media_pos > Duration::ZERO {
            return if let Some(dur) = Self::duration_locked(inner) {
                Some(inner.base_media_pos.min(dur))
            } else {
                Some(inner.base_media_pos)
            };
        }

        let speed = if inner.dsp_params.is_bypass() {
            1.0
        } else {
            (inner.dsp_params.tempo_ratio * inner.dsp_params.rate_ratio).max(0.01)
        };

        let elapsed_sink = if sink_pos >= inner.base_sink_pts {
            sink_pos - inner.base_sink_pts
        } else {
            Duration::ZERO
        };

        let elapsed_media_nanos = (elapsed_sink.as_nanos() as f64 * speed).round() as u64;
        let pos = inner.base_media_pos + Duration::from_nanos(elapsed_media_nanos);

        if let Some(dur) = Self::duration_locked(inner) {
            Some(pos.min(dur))
        } else {
            Some(pos)
        }
    }

    /// Stops playback and resets the position.
    pub fn stop(&self) -> Result<(), AudioEngineError> {
        let _source_guard = self.source_lock.lock_safe();
        let (pipeline, unlinked_fv) = {
            let mut inner = self.inner.lock_safe();
            inner.state = PlaybackState::Stopped;
            inner.cached_duration = None;
            inner.base_media_pos = Duration::ZERO;
            inner.base_sink_pts = Duration::ZERO;
            inner.pending_seek = None;
            inner.source_gen = inner.source_gen.wrapping_add(1);
            let unlinked_fv = if !self.reverb_target.load(Ordering::Acquire) {
                inner
                    .freeverb
                    .as_ref()
                    .filter(|fv| !Self::is_fv_linked(inner.dsp.upcast_ref(), fv))
                    .cloned()
            } else {
                None
            };
            (inner.pipeline.clone(), unlinked_fv)
        };
        pipeline.set_state(gst::State::Null)?;
        if let Some(fv) = unlinked_fv {
            fv.set_locked_state(true);
            let _ = fv.set_state(gst::State::Null);
        }
        debug!("Pipeline state changed to Stopped (Null)");
        Ok(())
    }

    /// Seeks to the given position (an immediate jump).
    pub fn seek(&self, position: Duration) -> Result<(), AudioEngineError> {
        let (pipeline, source_gen) = {
            let mut inner = self.inner.lock_safe();
            // If no URI is loaded yet or the pipeline is idle (Null),
            // remember the position to apply silently during preroll before playing.
            if inner.current_uri.is_none() || inner.pipeline.current_state() == gst::State::Null {
                inner.base_media_pos = position;
                inner.base_sink_pts = position;
                inner.pending_seek = if position.is_zero() {
                    None
                } else {
                    Some(position)
                };
                debug!(
                    "Stored the initial seek position while idle: {:?}",
                    position
                );
                return Ok(());
            }
            (inner.pipeline.clone(), inner.source_gen)
        };

        let position_ns = gst::ClockTime::from_nseconds(position.as_nanos() as u64);
        let seek_res = pipeline.seek_simple(
            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
            position_ns,
        );

        let mut inner = self.inner.lock_safe();
        if inner.source_gen != source_gen {
            return Ok(());
        }
        if let Err(err) = seek_res {
            debug!(
                "seek_simple warning (e.g. preroll not ready yet): {:?}",
                err
            );
            inner.pending_seek = if position.is_zero() {
                None
            } else {
                Some(position)
            };
        } else {
            inner.pending_seek = None;
        }
        inner.base_media_pos = position;
        inner.base_sink_pts = position;
        debug!("Seeked to {:?}", position);
        Ok(())
    }

    /// Seeks to the given position with an optional soft micro fade out/in.
    pub fn seek_with_fade(&self, position: Duration, fade: bool) -> Result<(), AudioEngineError> {
        if !fade {
            return self.seek(position);
        }

        let (is_playing, target_vol, current_seq) = {
            let mut inner = self.inner.lock_safe();
            inner.seek_seq = inner.seek_seq.wrapping_add(1);
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (is_playing, self.volume(), inner.seek_seq)
        };

        if !is_playing || target_vol <= 0.001 {
            return self.seek(position);
        }

        let step_delay = Duration::from_millis(8);

        // 1. Gentle micro fade-out (4 steps of 8 ms = 32 ms)
        let fade_out_steps = 4;
        for i in (0..fade_out_steps).rev() {
            let factor = (i as f64) / (fade_out_steps as f64);
            let curve = factor * factor; // Natural quadratic fade curve
            {
                let inner = self.inner.lock_safe();
                if inner.seek_seq != current_seq {
                    return Ok(());
                }
                inner.volume.set_property("volume", target_vol * curve);
            }
            std::thread::sleep(step_delay);
        }

        {
            let inner = self.inner.lock_safe();
            if inner.seek_seq != current_seq {
                return Ok(());
            }
            inner.volume.set_property("volume", 0.0f64);
        }

        // 2. The actual seek in the GStreamer pipeline
        self.seek(position)?;

        // 3. Short buffer settling after the seek (10 ms)
        std::thread::sleep(Duration::from_millis(10));

        // 4. Smooth volume return (6 steps of 8 ms = 48 ms)
        let fade_in_steps = 6;
        for i in 1..=fade_in_steps {
            let factor = (i as f64) / (fade_in_steps as f64);
            let curve = (factor * std::f64::consts::FRAC_PI_2).sin(); // Smooth sine ramp-in
            {
                let inner = self.inner.lock_safe();
                if inner.seek_seq != current_seq {
                    return Ok(());
                }
                inner.volume.set_property("volume", target_vol * curve);
            }
            std::thread::sleep(step_delay);
        }

        // 5. Finally make sure the volume is back at the user's setting
        {
            let inner = self.inner.lock_safe();
            if inner.seek_seq == current_seq {
                inner.volume.set_property("volume", target_vol);
            }
        }

        Ok(())
    }

    /// Returns the current playback position on the source file's timeline (accounting for DSP).
    pub fn position(&self) -> Option<Duration> {
        let mut inner = self.inner.lock_safe();
        Self::calculate_media_position(&mut inner)
    }

    /// Returns the total duration of the loaded track.
    pub fn duration(&self) -> Option<Duration> {
        let mut inner = self.inner.lock_safe();
        Self::duration_locked(&mut inner)
    }

    /// Returns the current player state.
    pub fn state(&self) -> PlaybackState {
        let inner = self.inner.lock_safe();
        inner.state
    }
}
