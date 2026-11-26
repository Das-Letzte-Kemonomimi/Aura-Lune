//! Dynamics effects, ReplayGain, crossfeed, silence trimming, stereo widener and limiter.

use super::*;

impl AudioEngine {
    /// Returns the current Dynamics Studio state (compressor, saturator, limiter).
    pub fn get_dynamics_state(&self) -> domain::dynamics::DynamicsState {
        let inner = self.inner.lock_safe();
        inner.dynamics_state
    }

    pub fn is_compressor_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.dynamics_state.compressor.enabled
    }

    pub fn is_saturator_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.dynamics_state.saturator.enabled
    }

    /// Applies a complete Dynamics Studio state on the fly, without clicks or gaps.
    pub fn set_dynamics_state(
        &self,
        state: &domain::dynamics::DynamicsState,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.dynamics_state = *state;

        // 1. Dynamics compressor
        let comp = state.compressor.clamped();
        inner.compressor.set_property("ratio", comp.ratio);
        inner
            .compressor
            .set_property("threshold", comp.linear_threshold());
        inner.compressor.set_property_from_str(
            "characteristics",
            if comp.soft_knee {
                "soft-knee"
            } else {
                "hard-knee"
            },
        );
        if let Ok(transform) = inner
            .compressor
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(!comp.enabled);
        }

        // Makeup gain
        let makeup_vol = if comp.enabled {
            comp.linear_makeup_gain()
        } else {
            1.0f64
        };
        inner.compressor_makeup.set_property("volume", makeup_vol);

        // 2. Analog saturator
        inner.saturator_config.store(state.saturator.clamped());

        // 3. Headphone limiter (rglimiter), combined with the ReplayGain clipping guard
        inner.apply_limiter_state();

        Ok(())
    }

    pub fn set_compressor_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = self.get_dynamics_state();
        state.compressor.enabled = enabled;
        self.set_dynamics_state(&state)
    }

    pub fn set_saturator_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = self.get_dynamics_state();
        state.saturator.enabled = enabled;
        self.set_dynamics_state(&state)
    }

    // ==========================================
    // REPLAYGAIN, CROSSFEED AND STEREO EFFECTS
    // ==========================================

    /// Configures ReplayGain loudness normalisation (EBU R128 / ReplayGain 2.0).
    pub fn set_replaygain(&self, config: ReplayGainConfig) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.replaygain_config = config;
        match config.mode {
            ReplayGainMode::Off => {
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(true);
                }
                inner.rgvolume.set_property("pre-amp", 0.0f64);
                inner.rgvolume.set_property("fallback-gain", 0.0f64);
                inner.rgvolume.set_property("headroom", 0.0f64);
            }
            ReplayGainMode::Track | ReplayGainMode::Album | ReplayGainMode::Auto => {
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(false);
                }
                // Auto starts with Track Gain (safe for shuffle and mixed queues);
                // `apply_auto_replaygain` switches to Album Gain when a whole album plays.
                let album_mode = config.mode == ReplayGainMode::Album;
                inner.rgvolume.set_property("album-mode", album_mode);
                let params = config.rgvolume_params();
                inner.rgvolume.set_property("pre-amp", params.pre_amp_db);
                inner
                    .rgvolume
                    .set_property("fallback-gain", params.fallback_gain_db);
                // Raised headroom lets untagged boosts through; rglimiter guards the peaks.
                inner.rgvolume.set_property("headroom", params.headroom_db);
            }
        }
        // RG Off drops only the ReplayGain clipping guard, never a user-enabled limiter.
        inner.apply_limiter_state();
        debug!(
            "ReplayGain updated: mode={:?}, tagged preamp={:.1} dB, untagged preamp={:.1} dB, limiter={}",
            config.mode, config.pre_amp_db, config.fallback_gain_db, config.prevent_clipping
        );
        Ok(())
    }

    /// Adjusts the ReplayGain mode dynamically in Auto mode (Track vs Album Gain).
    pub fn apply_auto_replaygain(&self, is_same_album: bool, is_shuffle: bool) {
        let inner = self.inner.lock_safe();
        if inner.replaygain_config.mode == ReplayGainMode::Auto {
            let use_album_gain = is_same_album && !is_shuffle;
            inner.rgvolume.set_property("album-mode", use_album_gain);
            debug!(
                "ReplayGain Auto: album mode set to {} (same_album={}, shuffle={})",
                use_album_gain, is_same_album, is_shuffle
            );
        }
    }

    /// Whether rgvolume currently uses Album Gain (true) or Track Gain (false).
    pub fn replaygain_album_mode(&self) -> bool {
        self.inner
            .lock_safe()
            .rgvolume
            .property::<bool>("album-mode")
    }

    /// Returns the current ReplayGain configuration.
    pub fn replaygain_config(&self) -> ReplayGainConfig {
        self.inner.lock_safe().replaygain_config
    }

    /// Returns the current ReplayGain status: (target_gain_db, result_gain_db, effective limiter state).
    pub fn replaygain_status(&self) -> (f64, f64, bool) {
        let inner = self.inner.lock_safe();
        if inner.replaygain_config.mode == ReplayGainMode::Off {
            return (0.0, 0.0, inner.effective_limiter_enabled());
        }
        let target: f64 = inner.rgvolume.property("target-gain");
        let result: f64 = inner.rgvolume.property("result-gain");
        (target, result, inner.effective_limiter_enabled())
    }

    /// Configures the Bauer stereophonic-to-binaural filter (crossfeed, bs2b) for headphone listening.
    pub fn set_crossfeed(&self, config: CrossfeedConfig) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.crossfeed_config = config;
        if let Some(ref bs) = inner.bs2b {
            bs.set_property("fcut", config.fcut_hz as i32);
            bs.set_property("feed", config.feed_tenth_db as i32);
            if let Ok(transform) = bs.clone().dynamic_cast::<gst_base::BaseTransform>() {
                transform.set_passthrough(!config.enabled);
            }
        }
        debug!(
            "Crossfeed updated: enabled={}, fcut={}Hz, feed={:.1}dB",
            config.enabled,
            config.fcut_hz,
            config.feed_db()
        );
        Ok(())
    }

    /// Returns the current crossfeed configuration.
    pub fn crossfeed_config(&self) -> CrossfeedConfig {
        self.inner.lock_safe().crossfeed_config
    }

    /// Configures automatic silence trimming (auto-skip silence).
    /// The engine only stores the configuration: `detect_silence_bounds` finds the silence, and the
    /// backend playback status loop skips it (seeking past the start, ending early).
    pub fn set_silence_trimming(
        &self,
        config: SilenceTrimmingConfig,
    ) -> Result<(), AudioEngineError> {
        let clamped = config.clamped();
        let mut inner = self.inner.lock_safe();
        inner.silence_trimming_config = clamped;
        debug!(
            "Silence trimming updated: enabled={}, threshold={:.1}dB",
            clamped.enabled, clamped.threshold_db
        );
        Ok(())
    }

    /// Returns the current silence-trimming configuration.
    pub fn silence_trimming_config(&self) -> SilenceTrimmingConfig {
        self.inner.lock_safe().silence_trimming_config
    }

    /// Enables or disables stereo widening.
    pub fn set_stereo_widener_active(&self, active: bool) {
        // Read-modify-write under the `inner` lock so concurrent changes don't overwrite each other.
        let inner = self.inner.lock_safe();
        let config = &inner.stereo_widener_config;
        config.store(domain::dynamics::StereoWidenerConfig {
            enabled: active,
            ..config.load()
        });
    }

    /// Sets the stereo widening amount in the 0.0 - 1.0 range.
    pub fn set_stereo_widener_amount(&self, amount: f64) {
        let clamped = amount.clamp(0.0, 1.0) as f32;
        let inner = self.inner.lock_safe();
        let config = &inner.stereo_widener_config;
        config.store(domain::dynamics::StereoWidenerConfig {
            width: clamped,
            ..config.load()
        });
    }

    /// Returns the stereo widening parameters: (active, amount).
    pub fn stereo_widener_params(&self) -> (bool, f64) {
        let config = {
            let inner = self.inner.lock_safe();
            Arc::clone(&inner.stereo_widener_config)
        };
        let cfg = config.load();
        (cfg.enabled, cfg.width as f64)
    }

    /// Enables or disables the true-peak limiter (rglimiter) and syncs the Dynamics Studio state.
    pub fn set_limiter_enabled(&self, enabled: bool) {
        let mut inner = self.inner.lock_safe();
        inner.dynamics_state.limiter.enabled = enabled;
        inner.apply_limiter_state();
    }

    /// Whether the user switched the true-peak limiter on (Dynamics Studio), regardless of ReplayGain.
    pub fn is_limiter_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.dynamics_state.limiter.enabled
    }

    /// Whether rglimiter is actually running: the user switch or the ReplayGain clipping guard.
    pub fn effective_limiter_enabled(&self) -> bool {
        self.inner.lock_safe().rglimiter.property::<bool>("enabled")
    }

    /// Whether a sample above 0 dBFS reached the limiter since the last reset.
    pub fn clip_detected(&self) -> bool {
        self.clip_latched.load(Ordering::Relaxed)
    }

    /// Clears the clip indicator latch.
    pub fn reset_clip_indicator(&self) {
        self.clip_latched.store(false, Ordering::Relaxed);
    }
}
