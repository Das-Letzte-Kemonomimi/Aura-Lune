//! Głośność, płynne przejścia (equal-power) i crossfade.

use super::*;

impl AudioEngine {
    /// Ustawia głośność (zakres 0.0 do 1.0+) w sposób bezzwłoczny bez blokowania na głównym mutexie potoku.
    pub fn set_volume(&self, volume: f64) -> Result<(), AudioEngineError> {
        self.fade_generation.fetch_add(1, Ordering::SeqCst);
        self.is_fading_in.store(false, Ordering::SeqCst);
        let clamped = volume.clamp(0.0, 2.0);
        self.atomic_volume
            .store(clamped.to_bits(), Ordering::Relaxed);
        self.volume_element.set_property("volume", clamped);
        debug!("Ustawiono głośność na: {:.2}", clamped);
        Ok(())
    }

    /// Ustawia głośność z płynną interpolacją (Smooth Fade / S-curve ramp), zapobiegając trzaskom cyfrowym.
    pub fn set_volume_smooth(
        &self,
        volume: f64,
        duration: Duration,
    ) -> Result<(), AudioEngineError> {
        let current_gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.is_fading_in.store(false, Ordering::SeqCst);
        let clamped = volume.clamp(0.0, 2.0);
        let current_vol = self.volume();
        self.atomic_volume
            .store(clamped.to_bits(), Ordering::Relaxed);

        if duration.is_zero() || (current_vol - clamped).abs() < 0.005 {
            self.volume_element.set_property("volume", clamped);
            debug!("Ustawiono głośność natychmiastowo na: {:.2}", clamped);
            return Ok(());
        }

        let volume_el = self.volume_element.clone();
        let fade_gen = Arc::clone(&self.fade_generation);

        let _ = std::thread::Builder::new()
            .name("aura-volume-smooth".into())
            .spawn(move || {
                let total_ms = duration.as_millis().clamp(20, 500) as u64;
                let step_ms = 8u64;
                let steps = (total_ms / step_ms).clamp(4, 40) as usize;
                let step_time = Duration::from_millis((total_ms / steps as u64).max(1));

                for i in 1..=steps {
                    if fade_gen.load(Ordering::Relaxed) != current_gen {
                        return;
                    }
                    let t = (i as f64) / (steps as f64);
                    // Płynna krzywa S (cosinusowa): łagodne przyspieszenie i wyhamowanie bez skoków
                    let factor = (1.0 - (t * std::f64::consts::PI).cos()) * 0.5;
                    let interpolated = current_vol + (clamped - current_vol) * factor;
                    volume_el.set_property("volume", interpolated);
                    std::thread::sleep(step_time);
                }

                if fade_gen.load(Ordering::Relaxed) == current_gen {
                    volume_el.set_property("volume", clamped);
                }
            });

        debug!(
            "Uruchomiono płynne przejście głośności do: {:.2} ({} ms)",
            clamped,
            duration.as_millis()
        );
        Ok(())
    }

    /// Pobiera aktualną głośność zadaną przez użytkownika (zmienna atomowa bez blokowania).
    pub fn volume(&self) -> f64 {
        f64::from_bits(self.atomic_volume.load(Ordering::Relaxed))
    }

    /// Wykonuje płynne wyciszenie (fade-out) głośności z krzywą equal-power (cosinusową).
    pub(super) fn fade_out_equal_power(
        volume: &gst::Element,
        start_vol: f64,
        duration: Duration,
        fade_gen: &Arc<AtomicU64>,
        current_gen: u64,
    ) {
        if start_vol <= 0.001 || duration.is_zero() {
            volume.set_property("volume", 0.0f64);
            return;
        }
        let total_ms = duration.as_millis() as u64;
        let step_ms = 8u64;
        let steps = (total_ms / step_ms).clamp(4, 50) as usize;
        let step_time = Duration::from_millis((total_ms / steps as u64).max(1));

        for i in 1..=steps {
            if fade_gen.load(Ordering::Relaxed) != current_gen {
                return;
            }
            let t = (i as f64) / (steps as f64);
            // Krzywa equal-power cosinusowa: od 1.0 (start) do 0.0 (koniec)
            let gain = (t * std::f64::consts::FRAC_PI_2).cos();
            volume.set_property("volume", start_vol * gain);
            std::thread::sleep(step_time);
        }
        if fade_gen.load(Ordering::Relaxed) == current_gen {
            volume.set_property("volume", 0.0f64);
        }
    }

    /// Wykonuje płynne wejście (fade-in) głośności z krzywą equal-power (sinusową).
    pub(super) fn fade_in_equal_power(
        volume: gst::Element,
        target_vol: f64,
        duration: Duration,
        fade_gen: Arc<AtomicU64>,
        is_fading_in: Arc<AtomicBool>,
        current_gen: u64,
    ) {
        is_fading_in.store(true, Ordering::SeqCst);
        if target_vol <= 0.001 || duration.is_zero() {
            volume.set_property("volume", target_vol);
            is_fading_in.store(false, Ordering::SeqCst);
            return;
        }
        let total_ms = duration.as_millis() as u64;
        let step_ms = 10u64;
        let steps = (total_ms / step_ms).clamp(6, 100) as usize;
        let step_time = Duration::from_millis((total_ms / steps as u64).max(1));

        for i in 1..=steps {
            if fade_gen.load(Ordering::Relaxed) != current_gen {
                is_fading_in.store(false, Ordering::SeqCst);
                return;
            }
            let t = (i as f64) / (steps as f64);
            // Krzywa equal-power sinusowa: od 0.0 (start) do 1.0 (koniec)
            let gain = (t * std::f64::consts::FRAC_PI_2).sin();
            volume.set_property("volume", target_vol * gain);
            std::thread::sleep(step_time);
        }
        if fade_gen.load(Ordering::Relaxed) == current_gen {
            volume.set_property("volume", target_vol);
        }
        is_fading_in.store(false, Ordering::SeqCst);
    }

    /// Wznawia odtwarzanie z płynnym wejściem głośności o zadanym czasie trwania wg krzywej equal-power.
    pub fn play_with_fade_duration(&self, duration: Duration) -> Result<(), AudioEngineError> {
        let current_gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
        let (pipeline, volume, target_vol) = {
            let mut inner = self.inner.lock_safe();
            if inner.current_uri.is_none() {
                debug!("Brak załadowanego pliku lub aktywnego utworu w kolejce — pomijam play_with_fade");
                return Ok(());
            }
            inner.volume.set_property("volume", 0.0f64);
            inner.state = PlaybackState::Playing;
            (inner.pipeline.clone(), inner.volume.clone(), self.volume())
        };

        // Zmiana stanu potoku poza blokadą mutexu inner
        pipeline.set_state(gst::State::Playing)?;

        if target_vol <= 0.001 || duration.is_zero() {
            volume.set_property("volume", target_vol);
            return Ok(());
        }

        let fade_gen = Arc::clone(&self.fade_generation);
        let is_fading_in = Arc::clone(&self.is_fading_in);
        let pipeline_wait = pipeline.clone();
        std::thread::spawn(move || {
            // Poczekaj na preroll potoku (do 150ms) w tle, aby bufory audio dotarły do wyjścia
            // przed startem krzywej fade-in, bez blokowania wątku wywołującego (IPC/UI)
            let _ = pipeline_wait.state(gst::ClockTime::from_mseconds(150));
            Self::fade_in_equal_power(
                volume,
                target_vol,
                duration,
                fade_gen,
                is_fading_in,
                current_gen,
            );
        });

        Ok(())
    }

    /// Ustawia czas płynnego przejścia (crossfade) w milisekundach (0 - 8000 ms).
    pub fn set_crossfade_duration_ms(&self, duration_ms: u64) {
        let mut inner = self.inner.lock_safe();
        inner.crossfade_duration_ms = duration_ms.clamp(0, 8000);
    }

    /// Pobiera bieżący czas crossfade w milisekundach.
    pub fn crossfade_duration_ms(&self) -> u64 {
        let inner = self.inner.lock_safe();
        inner.crossfade_duration_ms
    }
}
