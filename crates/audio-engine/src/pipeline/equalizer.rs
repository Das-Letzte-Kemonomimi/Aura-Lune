//! Graphic (10-band) and parametric equalizers.

use super::*;

impl AudioEngine {
    /// Returns the current gains of the 10 graphic equalizer bands (in dB).
    pub fn get_equalizer_bands(&self) -> [f64; 10] {
        let inner = self.inner.lock_safe();
        inner.equalizer_state.bands
    }

    /// Whether the graphic equalizer is enabled.
    pub fn is_equalizer_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.equalizer_state.enabled
    }

    /// Enables or disables the graphic equalizer (bypass, without removing it from the pipeline).
    pub fn set_equalizer_enabled(&self, enabled: bool) {
        let mut inner = self.inner.lock_safe();
        inner.equalizer_state.enabled = enabled;
        if let Ok(transform) = inner
            .equalizer
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(!enabled);
        }
        for i in 0..10 {
            let val = if enabled {
                inner.equalizer_state.bands[i]
            } else {
                0.0
            };
            inner.equalizer.set_property(&format!("band{}", i), val);
        }
        inner.update_preamp_volume();
    }

    /// Sets the gain of one graphic equalizer band (in dB: -24.0 to +12.0).
    /// Enables the equalizer automatically, so the sound reacts to the slider immediately.
    pub fn set_equalizer_band(&self, band: usize, gain_db: f64) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.equalizer_state.enabled = true;
        if let Ok(transform) = inner
            .equalizer
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(false);
        }
        if inner.equalizer_state.set_band(band, gain_db) {
            for i in 0..10 {
                let val = inner.equalizer_state.bands[i];
                inner.equalizer.set_property(&format!("band{}", i), val);
            }
        }
        inner.update_preamp_volume();
        Ok(())
    }

    /// Sets the gains of all 10 graphic equalizer bands at once.
    /// Enables the equalizer automatically and applies every band straight to the GStreamer pipeline.
    pub fn set_equalizer_bands(&self, bands: &[f64; 10]) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.equalizer_state.enabled = true;
        if let Ok(transform) = inner
            .equalizer
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(false);
        }
        for (i, &gain) in bands.iter().enumerate() {
            inner.equalizer_state.set_band(i, gain);
            inner
                .equalizer
                .set_property(&format!("band{}", i), inner.equalizer_state.bands[i]);
        }
        inner.update_preamp_volume();
        Ok(())
    }

    /// Sets the graphic equalizer preamp gain in dB.
    pub fn set_equalizer_preamp(&self, preamp_db: f64) {
        let mut inner = self.inner.lock_safe();
        inner.eq_preamp_db = preamp_db.clamp(-24.0, 12.0);
        inner.update_preamp_volume();
    }

    /// Returns the current graphic equalizer preamp gain in dB.
    pub fn get_equalizer_preamp(&self) -> f64 {
        let inner = self.inner.lock_safe();
        inner.eq_preamp_db
    }

    // ==========================================
    // PARAMETRIC EQUALIZER (PEQ)
    // ==========================================

    /// Returns the current parametric equalizer state.
    pub fn get_parametric_eq_state(&self) -> ParametricEqState {
        let inner = self.inner.lock_safe();
        inner.parametric_eq_state.clone()
    }

    /// Whether the parametric equalizer is enabled.
    pub fn is_parametric_eq_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.parametric_eq_state.enabled
    }

    /// Sets and applies the complete parametric equalizer state (bands, preamp, bypass).
    pub fn set_parametric_eq_state(
        &self,
        state: &ParametricEqState,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.parametric_eq_state = state.clone();

        let enabled = state.enabled;

        // 1. Synchronised preamp (EQ + PEQ)
        inner.update_preamp_volume();

        // 2. Parametric equalizer bands
        let num_bands = (state.bands.len().max(1) as u32).min(64);
        let current_num_bands: u32 = inner.peq_equalizer.property("num-bands");
        if current_num_bands != num_bands {
            inner.peq_equalizer.set_property("num-bands", num_bands);
        }

        if let Ok(child_proxy) = inner
            .peq_equalizer
            .clone()
            .dynamic_cast::<gst::ChildProxy>()
        {
            for (i, band) in state.bands.iter().take(64).enumerate() {
                if let Some(child) = child_proxy.child_by_index(i as u32) {
                    let gain = if enabled && band.enabled {
                        band.gain_db.clamp(
                            domain::MIN_PARAMETRIC_GAIN_DB,
                            domain::MAX_PARAMETRIC_GAIN_DB,
                        )
                    } else {
                        0.0
                    };
                    child.set_property(
                        "freq",
                        band.freq
                            .clamp(domain::MIN_PARAMETRIC_FREQ, domain::MAX_PARAMETRIC_FREQ),
                    );
                    child.set_property("bandwidth", band.bandwidth_hz().clamp(1.0, 24000.0));
                    child.set_property("gain", gain);
                    let type_str = match band.filter_type {
                        domain::ParametricFilterType::Peak => "peak",
                        domain::ParametricFilterType::LowShelf => "low-shelf",
                        domain::ParametricFilterType::HighShelf => "high-shelf",
                    };
                    child.set_property_from_str("type", type_str);
                }
            }
            if state.bands.is_empty() {
                if let Some(child) = child_proxy.child_by_index(0) {
                    child.set_property("gain", 0.0f64);
                }
            }
        }

        if let Ok(transform) = inner
            .peq_equalizer
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(!enabled || state.bands.is_empty());
        }

        Ok(())
    }

    /// Enables or disables the parametric equalizer (bypass).
    pub fn set_parametric_eq_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = {
            let inner = self.inner.lock_safe();
            inner.parametric_eq_state.clone()
        };
        state.enabled = enabled;
        self.set_parametric_eq_state(&state)
    }

    /// Sets the PEQ preamp gain in dB.
    pub fn set_parametric_eq_preamp(&self, preamp_db: f64) -> Result<(), AudioEngineError> {
        let mut state = {
            let inner = self.inner.lock_safe();
            inner.parametric_eq_state.clone()
        };
        state.preamp_db = preamp_db;
        self.set_parametric_eq_state(&state)
    }

    // ==========================================
    // DYNAMICS STUDIO (COMPRESSOR, SATURATOR, LIMITER)
    // ==========================================
}
