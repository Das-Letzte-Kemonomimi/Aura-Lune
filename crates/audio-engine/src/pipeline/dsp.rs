//! DSP parameters (pitch, tempo, rate, engine), reverb and buffer sizes.

use super::*;

impl AudioEngine {
    /// Updates the DSP parameters on the fly.
    pub fn set_dsp_params(&self, params: DspParams) -> Result<(), AudioEngineError> {
        params.validate()?;
        let mut inner = self.inner.lock_safe();

        // If the parameters belong to a processing engine, remember them
        if params.engine != DspEngine::Bypass {
            inner.last_active_dsp = Some(params);
        } else if let Some(ref mut last) = inner.last_active_dsp {
            last.pitch_semitones = params.pitch_semitones;
            last.tempo_ratio = params.tempo_ratio;
            last.rate_ratio = params.rate_ratio;
        }

        // Before changing speed parameters (tempo/rate), sync the timeline's base point.
        // This prevents any position jumps while sliders move during playback.
        let old_speed = if inner.dsp_params.is_bypass() {
            1.0
        } else {
            (inner.dsp_params.tempo_ratio * inner.dsp_params.rate_ratio).max(0.01)
        };
        let new_speed = if params.is_bypass() {
            1.0
        } else {
            (params.tempo_ratio * params.rate_ratio).max(0.01)
        };

        if (old_speed - new_speed).abs() > 1e-4 || inner.dsp_params.engine != params.engine {
            let current_media =
                Self::calculate_media_position(&mut inner).unwrap_or(inner.base_media_pos);
            let current_sink = Self::query_raw_sink_position(&inner).unwrap_or(inner.base_sink_pts);
            inner.base_media_pos = current_media;
            inner.base_sink_pts = current_sink;
        }

        inner.dsp.set_params(params)?;
        if inner.dsp_params.engine != params.engine {
            inner.cached_capabilities = params.engine.capabilities();
        }
        inner.dsp_params = params;
        debug!(
            "DSP updated: engine={:?}, pitch={:.2} st, tempo={:.2}x, rate={:.2}x",
            params.engine, params.pitch_semitones, params.tempo_ratio, params.rate_ratio
        );
        Ok(())
    }

    /// Sets the reverb parameters.
    pub fn set_reverb_params(
        &self,
        enabled: bool,
        room_size: f64,
        damping: f64,
        width: f64,
        level: f64,
    ) {
        let mut inner = self.inner.lock_safe();
        inner.reverb_enabled = enabled;
        inner.reverb_room_size = room_size.clamp(0.0, 1.0);
        inner.reverb_damping = damping.clamp(0.0, 1.0);
        inner.reverb_width = width.clamp(0.0, 1.0);
        inner.reverb_level = level.clamp(0.0, 1.0);

        if let Some(ref fv) = inner.freeverb {
            let actual_level = if enabled {
                inner.reverb_level as f32
            } else {
                0.0f32
            };
            fv.set_property("level", actual_level);
            fv.set_property("room-size", inner.reverb_room_size as f32);
            fv.set_property("damping", inner.reverb_damping as f32);
            fv.set_property("width", inner.reverb_width as f32);
        }
    }

    /// Returns the current reverb parameters (enabled, room_size, damping, width, level).
    pub fn reverb_params(&self) -> (bool, f64, f64, f64, f64) {
        let inner = self.inner.lock_safe();
        (
            inner.reverb_enabled,
            inner.reverb_room_size,
            inner.reverb_damping,
            inner.reverb_width,
            inner.reverb_level,
        )
    }

    /// Sets the pitch in semitones on the fly.
    pub fn set_pitch_semitones(&self, semitones: f64) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        let updated = DspParams::new(
            current.engine,
            semitones,
            current.tempo_ratio,
            current.rate_ratio,
        )?;
        self.set_dsp_params(updated)
    }

    /// Sets the tempo multiplier on the fly.
    pub fn set_tempo_ratio(&self, tempo_ratio: f64) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        let updated = DspParams::new(
            current.engine,
            current.pitch_semitones,
            tempo_ratio,
            current.rate_ratio,
        )?;
        self.set_dsp_params(updated)
    }

    /// Sets the rate multiplier on the fly.
    pub fn set_rate_ratio(&self, rate_ratio: f64) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        let updated = DspParams::new(
            current.engine,
            current.pitch_semitones,
            current.tempo_ratio,
            rate_ratio,
        )?;
        self.set_dsp_params(updated)
    }

    /// Returns the current DSP parameters.
    pub fn dsp_params(&self) -> DspParams {
        let inner = self.inner.lock_safe();
        inner.dsp_params
    }

    /// Sets the audio output buffer size in milliseconds (queue length before the sink).
    /// Default: 600 ms (allowed values: 50 ms - 4000 ms).
    pub fn set_audio_buffer_duration_ms(&self, buffer_ms: u64) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        let clamped = buffer_ms.clamp(50, 4000);
        inner.audio_buffer_ms = clamped;
        let time_ns = clamped * 1_000_000u64;
        inner.queue_sink.set_property("max-size-time", time_ns);
        inner.queue_sink.set_property("min-threshold-time", 0u64);
        if inner.sink.find_property("buffer-time").is_some() {
            let buffer_us = (clamped * 1000) as i64;
            inner.sink.set_property("buffer-time", buffer_us);
        } else if inner.sink.find_property("processing-deadline").is_some() {
            let deadline_ns = (clamped / 25).clamp(10, 25) * 1_000_000u64;
            inner.sink.set_property("processing-deadline", deadline_ns);
        }
        info!(
            "Audio output buffer updated to {} ms (queue: {} ms, buffer-time)",
            clamped, clamped
        );
        Ok(())
    }

    /// Returns the current audio output buffer size in milliseconds (default 600 ms).
    pub fn audio_buffer_duration_ms(&self) -> u64 {
        let inner = self.inner.lock_safe();
        inner.audio_buffer_ms
    }

    /// Sets the DSP processing block size in frames.
    /// Default: 2048 frames (~46 ms). Allowed values: 512 to 16384 frames.
    pub fn set_dsp_block_size(&self, block_size: usize) -> Result<(), AudioEngineError> {
        let clamped = block_size.clamp(512, 16384);
        // `set_block_size` prepares both processors again (expensive), outside the
        // `inner` lock, so `position()`, MPRIS and commands don't wait.
        let dsp = {
            let mut inner = self.inner.lock_safe();
            inner.dsp_block_size = clamped;
            inner.dsp.clone()
        };
        dsp.set_block_size(clamped);
        info!("DSP block size updated to {} frames", clamped);
        Ok(())
    }

    /// Returns the current DSP block size in frames (default 2048 frames).
    pub fn dsp_block_size(&self) -> usize {
        let inner = self.inner.lock_safe();
        inner.dsp_block_size
    }

    /// Switches the DSP engine (SoundTouch, Rubber Band or Bypass).
    pub fn set_dsp_engine(&self, engine: DspEngine) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        if current.engine == engine {
            return Ok(());
        }

        let is_active_playback = {
            let inner = self.inner.lock_safe();
            inner.state == PlaybackState::Playing || inner.state == PlaybackState::Paused
        };

        // Compute the current position in the source track before switching engines
        let current_pos = self.position().unwrap_or(Duration::ZERO);

        let mut inner = self.inner.lock_safe();

        // Going from Bypass into processing needs no seek: in Bypass buffers pass unchanged
        // (stream time == media time), so the engine starts from the next buffer's PTS and the
        // timeline only needs rebasing (as with an on-the-fly tempo change). Other transitions
        // (to Bypass, Rubber Band <-> SoundTouch) carry accumulated PTS drift and still seek.
        let entering_from_bypass = is_active_playback
            && current.engine == DspEngine::Bypass
            && engine != DspEngine::Bypass;
        let rebase_media = Self::calculate_media_position(&mut inner).unwrap_or(current_pos);
        let rebase_sink = Self::query_raw_sink_position(&inner).unwrap_or(inner.base_sink_pts);

        // When leaving an active DSP engine (RubberBand / SoundTouch), remember its parameters
        if current.engine != DspEngine::Bypass {
            inner.last_active_dsp = Some(current);
        }

        let caps = engine.capabilities();
        let target_params = match engine {
            DspEngine::Bypass => {
                // Going to Bypass: keep the user's current parameters in the status
                // so they aren't reset when a processing engine comes back
                DspParams {
                    engine: DspEngine::Bypass,
                    pitch_semitones: current.pitch_semitones,
                    tempo_ratio: current.tempo_ratio,
                    rate_ratio: current.rate_ratio,
                }
            }
            target_engine => {
                // Back to RubberBand or SoundTouch:
                // restore the parameter values saved before switching to Bypass.
                let remembered = inner.last_active_dsp.unwrap_or(current);
                DspParams {
                    engine: target_engine,
                    pitch_semitones: remembered
                        .pitch_semitones
                        .clamp(caps.min_pitch_semitones, caps.max_pitch_semitones),
                    tempo_ratio: remembered
                        .tempo_ratio
                        .clamp(caps.min_tempo_ratio, caps.max_tempo_ratio),
                    rate_ratio: remembered.rate_ratio.clamp(0.15, 4.0),
                }
            }
        };

        inner.dsp.set_engine(engine);
        let _ = inner.dsp.set_params(target_params);
        inner.dsp_params = target_params;
        inner.cached_capabilities = caps.clone();
        if entering_from_bypass {
            inner.base_media_pos = rebase_media;
            inner.base_sink_pts = rebase_sink;
        } else {
            inner.base_media_pos = current_pos;
            inner.base_sink_pts = current_pos;
        }
        drop(inner);

        // If playback is active, seek to the current position right away.
        // That flushes desynchronised samples buffered in the queues and makes sure
        // the new engine (or the clean Bypass stream) starts at exactly the same second
        // with perfectly aligned GStreamer PTS timestamps (no flanging or stutter).
        if is_active_playback && !entering_from_bypass {
            if let Err(e) = self.seek(current_pos) {
                warn!("Resync seek failed after the DSP engine change: {:?}", e);
            }
        }

        info!("Switched the DSP engine to {}", caps.name);
        Ok(())
    }

    /// Returns the properties and limits of the current DSP engine.
    pub fn dsp_capabilities(&self) -> DspCapabilities {
        self.inner.lock_safe().cached_capabilities.clone()
    }

    /// Enables or disables GStreamer `spectrum` bus messages when UI visualizers mount/unmount.
    pub fn set_spectrum_enabled(&self, enabled: bool) {
        self.inner
            .lock_safe()
            .spectrum
            .set_property("post-messages", enabled);
    }
}
