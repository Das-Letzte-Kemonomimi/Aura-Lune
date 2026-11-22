//! Efekty dynamiki, ReplayGain, crossfeed, pomijanie ciszy, stereo widener i limiter.

use super::*;

impl AudioEngine {
    /// Pobiera bieżący stan Studia Dynamiki (kompresor, saturator, limiter).
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

    /// Aplikuje kompletny stan Studia Dynamiki w locie bez trzasków i przerw.
    pub fn set_dynamics_state(
        &self,
        state: &domain::dynamics::DynamicsState,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.dynamics_state = *state;

        // 1. Kompresor dynamiki
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

        // 2. Saturator analogowy
        inner.saturator_config.store(state.saturator.clamped());

        // 3. Limiter słuchawkowy (rglimiter)
        inner
            .rglimiter
            .set_property("enabled", state.limiter.enabled);

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
    // METODY OBSŁUGI KOLEJKI ODTWARZANIA (QUEUE)
    // ==========================================

    /// Konfiguruje normalizację głośności ReplayGain (EBU R128 / ReplayGain 2.0).
    pub fn set_replaygain(&self, config: ReplayGainConfig) -> Result<(), AudioEngineError> {
        self.replaygain_mode
            .store(config.mode as u8, Ordering::Relaxed);
        let mut inner = self.inner.lock_safe();
        inner.replaygain_config = config;
        match config.mode {
            ReplayGainMode::Off => {
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(true);
                }
                inner.rgvolume.set_property("pre-amp", 0.0f64);
                inner.rgvolume.set_property("fallback-gain", 0.0f64);
                inner.rglimiter.set_property("enabled", false);
            }
            ReplayGainMode::Track | ReplayGainMode::Album | ReplayGainMode::Auto => {
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(false);
                }
                // Auto startuje od Track Gain (bezpieczne dla shuffle i mieszanych kolejek);
                // `apply_auto_replaygain` przełącza na Album Gain przy odtwarzaniu całego albumu.
                let album_mode = config.mode == ReplayGainMode::Album;
                inner.rgvolume.set_property("album-mode", album_mode);
                inner.rgvolume.set_property("pre-amp", config.pre_amp_db);
                inner
                    .rgvolume
                    .set_property("fallback-gain", config.fallback_gain_db);
                inner
                    .rglimiter
                    .set_property("enabled", config.prevent_clipping);
            }
        }
        debug!(
            "Zaktualizowano ReplayGain: mode={:?}, pre_amp={:.1} dB, fallback={:.1} dB, limiter={}",
            config.mode, config.pre_amp_db, config.fallback_gain_db, config.prevent_clipping
        );
        Ok(())
    }

    /// Dynamicznie dostosowuje tryb ReplayGain w trybie Auto (Track vs Album Gain).
    pub fn apply_auto_replaygain(&self, is_same_album: bool, is_shuffle: bool) {
        let inner = self.inner.lock_safe();
        if inner.replaygain_config.mode == ReplayGainMode::Auto {
            let use_album_gain = is_same_album && !is_shuffle;
            inner.rgvolume.set_property("album-mode", use_album_gain);
            debug!(
                "ReplayGain Auto: ustawiono album-mode na {} (same_album={}, shuffle={})",
                use_album_gain, is_same_album, is_shuffle
            );
        }
    }

    /// Czy element rgvolume używa obecnie Album Gain (true) czy Track Gain (false).
    pub fn replaygain_album_mode(&self) -> bool {
        self.inner
            .lock()
            .unwrap()
            .rgvolume
            .property::<bool>("album-mode")
    }

    /// Pobiera bieżącą konfigurację ReplayGain.
    pub fn replaygain_config(&self) -> ReplayGainConfig {
        self.inner.lock_safe().replaygain_config
    }

    /// Zwraca bieżący status normalizacji ReplayGain: (target_gain_db, result_gain_db, limiter_enabled).
    pub fn replaygain_status(&self) -> (f64, f64, bool) {
        let inner = self.inner.lock_safe();
        if inner.replaygain_config.mode == ReplayGainMode::Off {
            return (0.0, 0.0, false);
        }
        let target: f64 = inner.rgvolume.property("target-gain");
        let result: f64 = inner.rgvolume.property("result-gain");
        let limiter: bool = inner.rglimiter.property("enabled");
        (target, result, limiter)
    }

    /// Konfiguruje filtr Bauer stereophonic-to-binaural (Crossfeed bs2b) dla odsłuchu słuchawkowego.
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
            "Zaktualizowano Crossfeed: enabled={}, fcut={}Hz, feed={:.1}dB",
            config.enabled,
            config.fcut_hz,
            config.feed_db()
        );
        Ok(())
    }

    /// Pobiera bieżącą konfigurację Crossfeed.
    pub fn crossfeed_config(&self) -> CrossfeedConfig {
        self.inner.lock_safe().crossfeed_config
    }

    /// Konfiguruje automatyczne pomijanie ciszy (Silence Trimming / Auto-skip silence).
    /// Silnik tylko przechowuje konfigurację — ciszę wykrywa `detect_silence_bounds`, a pomija
    /// ją backendowa pętla statusu odtwarzania (przewinięcie początku, wcześniejsze zakończenie).
    pub fn set_silence_trimming(
        &self,
        config: SilenceTrimmingConfig,
    ) -> Result<(), AudioEngineError> {
        let clamped = config.clamped();
        let mut inner = self.inner.lock_safe();
        inner.silence_trimming_config = clamped;
        debug!(
            "Zaktualizowano Silence Trimming: enabled={}, threshold={:.1}dB",
            clamped.enabled, clamped.threshold_db
        );
        Ok(())
    }

    /// Pobiera bieżącą konfigurację pomijania ciszy.
    pub fn silence_trimming_config(&self) -> SilenceTrimmingConfig {
        self.inner.lock_safe().silence_trimming_config
    }

    /// Włącza lub wyłącza rozszerzanie bazy stereo (Stereo Widener).
    pub fn set_stereo_widener_active(&self, active: bool) {
        // Odczyt-modyfikacja-zapis pod blokadą `inner`, aby równoległe zmiany nie nadpisywały się.
        let inner = self.inner.lock_safe();
        let config = &inner.stereo_widener_config;
        config.store(domain::dynamics::StereoWidenerConfig {
            enabled: active,
            ..config.load()
        });
    }

    /// Ustawia intensywność rozszerzania stereo w zakresie 0.0 - 1.0.
    pub fn set_stereo_widener_amount(&self, amount: f64) {
        let clamped = amount.clamp(0.0, 1.0) as f32;
        let inner = self.inner.lock_safe();
        let config = &inner.stereo_widener_config;
        config.store(domain::dynamics::StereoWidenerConfig {
            width: clamped,
            ..config.load()
        });
    }

    /// Zwraca parametry rozszerzania stereo: (active, amount).
    pub fn stereo_widener_params(&self) -> (bool, f64) {
        let config = {
            let inner = self.inner.lock_safe();
            Arc::clone(&inner.stereo_widener_config)
        };
        let cfg = config.load();
        (cfg.enabled, cfg.width as f64)
    }

    /// Włącza lub wyłącza True-Peak Limiter (rglimiter) oraz synchronizuje stan Studia Dynamiki.
    pub fn set_limiter_enabled(&self, enabled: bool) {
        let mut inner = self.inner.lock_safe();
        inner.dynamics_state.limiter.enabled = enabled;
        inner.rglimiter.set_property("enabled", enabled);
    }

    /// Sprawdza, czy True-Peak Limiter (rglimiter) jest włączony.
    pub fn is_limiter_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.dynamics_state.limiter.enabled
    }
}
