//! Korektor graficzny (10 pasm) i parametryczny.

use super::*;

impl AudioEngine {
    /// Zwraca aktualne wzmocnienia 10 pasm korektora graficznego (w dB).
    pub fn get_equalizer_bands(&self) -> [f64; 10] {
        let inner = self.inner.lock_safe();
        inner.equalizer_state.bands
    }

    /// Sprawdza, czy korektor graficzny jest włączony.
    pub fn is_equalizer_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.equalizer_state.enabled
    }

    /// Włącza lub wyłącza korektor graficzny (bypass bez usuwania z potoku).
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

    /// Ustawia wzmocnienie pojedynczego pasma korektora graficznego (w dB: -24.0 do +12.0).
    /// Automatycznie aktywuje korektor, zapewniając natychmiastową reakcję dźwięku na ruch suwaka.
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

    /// Ustawia wzmocnienia wszystkich 10 pasm korektora graficznego jednocześnie.
    /// Automatycznie aktywuje korektor, aplikując wszystkie pasma bezpośrednio do potoku GStreamera.
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

    /// Ustawia wzmocnienie przedwzmacniacza (preamp) dla korektora graficznego w dB.
    pub fn set_equalizer_preamp(&self, preamp_db: f64) {
        let mut inner = self.inner.lock_safe();
        inner.eq_preamp_db = preamp_db.clamp(-24.0, 12.0);
        inner.update_preamp_volume();
    }

    /// Zwraca aktualne wzmocnienie przedwzmacniacza korektora graficznego w dB.
    pub fn get_equalizer_preamp(&self) -> f64 {
        let inner = self.inner.lock_safe();
        inner.eq_preamp_db
    }

    // ==========================================
    // METODY OBSŁUGI KOREKTORA PARAMETRYCZNEGO (PEQ)
    // ==========================================

    /// Zwraca aktualny stan korektora parametrycznego.
    pub fn get_parametric_eq_state(&self) -> ParametricEqState {
        let inner = self.inner.lock_safe();
        inner.parametric_eq_state.clone()
    }

    /// Sprawdza, czy korektor parametryczny jest włączony.
    pub fn is_parametric_eq_enabled(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.parametric_eq_state.enabled
    }

    /// Ustawia i aplikuje kompletny stan korektora parametrycznego (pasma, preamp, bypass).
    pub fn set_parametric_eq_state(
        &self,
        state: &ParametricEqState,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.parametric_eq_state = state.clone();

        let enabled = state.enabled;

        // 1. Zsynchronizowany Preamp (EQ + PEQ)
        inner.update_preamp_volume();

        // 2. Pasma korektora parametrycznego
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

    /// Włącza lub wyłącza korektor parametryczny (bypass).
    pub fn set_parametric_eq_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = {
            let inner = self.inner.lock_safe();
            inner.parametric_eq_state.clone()
        };
        state.enabled = enabled;
        self.set_parametric_eq_state(&state)
    }

    /// Ustawia wzmocnienie przedwzmacniacza PEQ (preamp) w dB.
    pub fn set_parametric_eq_preamp(&self, preamp_db: f64) -> Result<(), AudioEngineError> {
        let mut state = {
            let inner = self.inner.lock_safe();
            inner.parametric_eq_state.clone()
        };
        state.preamp_db = preamp_db;
        self.set_parametric_eq_state(&state)
    }

    // ==========================================
    // METODY OBSŁUGI STUDIA DYNAMIKI (COMPRESSOR, SATURATOR, LIMITER)
    // ==========================================
}
