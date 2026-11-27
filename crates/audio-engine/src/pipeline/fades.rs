//! Volume, smooth (equal-power) transitions and crossfade.

use super::*;
use std::sync::Condvar;

#[derive(Debug, Clone, Copy)]
struct FadeTarget {
    start_vol: f64,
    target_vol: f64,
    duration: Duration,
    gen_id: u64,
}

#[derive(Default)]
struct FaderState {
    target: Option<FadeTarget>,
    stop: bool,
}

struct VolumeFaderInner {
    state: Mutex<FaderState>,
    cvar: Condvar,
    thread: Mutex<Option<std::thread::JoinHandle<()>>>,
}

impl Drop for VolumeFaderInner {
    fn drop(&mut self) {
        {
            let mut guard = self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            guard.stop = true;
            guard.target = None;
            self.cvar.notify_all();
        }
        if let Some(handle) = self
            .thread
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
        {
            let _ = handle.join();
        }
    }
}

/// Persistent single-thread volume fader owned by [`AudioEngine`].
#[derive(Clone)]
pub(super) struct VolumeFader(Arc<VolumeFaderInner>);

impl VolumeFader {
    pub(super) fn spawn(volume_el: gst::Element, fade_gen: Arc<AtomicU64>) -> Self {
        let inner = Arc::new(VolumeFaderInner {
            state: Mutex::new(FaderState::default()),
            cvar: Condvar::new(),
            thread: Mutex::new(None),
        });
        let worker_inner = Arc::clone(&inner);
        let handle = std::thread::Builder::new()
            .name("aura-volume-fader".into())
            .spawn(move || Self::worker_loop(&worker_inner, &volume_el, &fade_gen));

        match handle {
            Ok(h) => {
                *inner
                    .thread
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(h);
            }
            Err(e) => {
                warn!("Failed to start persistent volume fader thread: {}", e);
            }
        }
        Self(inner)
    }

    fn set_target(&self, target: Option<FadeTarget>) {
        let mut guard = self
            .0
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        guard.target = target;
        self.0.cvar.notify_one();
    }

    fn worker_loop(inner: &VolumeFaderInner, volume_el: &gst::Element, fade_gen: &Arc<AtomicU64>) {
        loop {
            let target = {
                let mut guard = inner
                    .state
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                while !guard.stop && guard.target.is_none() {
                    guard = inner
                        .cvar
                        .wait(guard)
                        .unwrap_or_else(std::sync::PoisonError::into_inner);
                }
                if guard.stop {
                    return;
                }
                guard.target.take()
            };

            let Some(target) = target else {
                continue;
            };

            // 10 ms floor: the UI's "instant" mode asks for 15 ms, a click-free ramp that still feels immediate.
            let total_ms = target.duration.as_millis().clamp(10, 500) as u64;
            let step_ms = 8u64;
            let steps = (total_ms / step_ms).clamp(4, 40) as usize;
            let step_time = Duration::from_millis((total_ms / steps as u64).max(1));

            for i in 1..=steps {
                if fade_gen.load(Ordering::Relaxed) != target.gen_id {
                    break;
                }
                let t = (i as f64) / (steps as f64);
                // Smooth (cosine) S-curve: gentle acceleration and deceleration without jumps
                let factor = (1.0 - (t * std::f64::consts::PI).cos()) * 0.5;
                let interpolated =
                    target.start_vol + (target.target_vol - target.start_vol) * factor;
                volume_el.set_property("volume", interpolated);

                let guard = inner
                    .state
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                if guard.stop {
                    return;
                }
                if guard.target.is_some() || fade_gen.load(Ordering::Relaxed) != target.gen_id {
                    break;
                }
                let (after, _) = inner
                    .cvar
                    .wait_timeout_while(guard, step_time, |s| !s.stop && s.target.is_none())
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                if after.stop {
                    return;
                }
                if after.target.is_some() {
                    break;
                }
            }

            if fade_gen.load(Ordering::Relaxed) == target.gen_id {
                volume_el.set_property("volume", target.target_vol);
            }
        }
    }
}

impl AudioEngine {
    /// Sets the volume (range 0.0 to 1.0+) immediately, without blocking on the main pipeline mutex.
    pub fn set_volume(&self, volume: f64) -> Result<(), AudioEngineError> {
        self.fade_generation.fetch_add(1, Ordering::SeqCst);
        self.is_fading_in.store(false, Ordering::SeqCst);
        if let Some(fader) = &self.volume_fader {
            fader.set_target(None);
        }
        let clamped = volume.clamp(0.0, 2.0);
        self.atomic_volume
            .store(clamped.to_bits(), Ordering::Relaxed);
        self.volume_element.set_property("volume", clamped);
        debug!("Volume set to: {:.2}", clamped);
        Ok(())
    }

    /// Sets the volume with smooth interpolation (S-curve ramp), avoiding digital clicks.
    pub fn set_volume_smooth(
        &self,
        volume: f64,
        duration: Duration,
    ) -> Result<(), AudioEngineError> {
        let current_gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.is_fading_in.store(false, Ordering::SeqCst);
        let clamped = volume.clamp(0.0, 2.0);
        let start_vol = self.volume_element.property::<f64>("volume");
        self.atomic_volume
            .store(clamped.to_bits(), Ordering::Relaxed);

        if duration.is_zero() || (start_vol - clamped).abs() < 0.005 {
            if let Some(fader) = &self.volume_fader {
                fader.set_target(None);
            }
            self.volume_element.set_property("volume", clamped);
            debug!("Volume set immediately to: {:.2}", clamped);
            return Ok(());
        }

        if let Some(fader) = &self.volume_fader {
            fader.set_target(Some(FadeTarget {
                start_vol,
                target_vol: clamped,
                duration,
                gen_id: current_gen,
            }));
        } else {
            self.volume_element.set_property("volume", clamped);
        }

        debug!(
            "Started a smooth volume transition to: {:.2} ({} ms)",
            clamped,
            duration.as_millis()
        );
        Ok(())
    }

    /// Returns the current user-set volume (a lock-free atomic).
    pub fn volume(&self) -> f64 {
        f64::from_bits(self.atomic_volume.load(Ordering::Relaxed))
    }

    /// Fades the volume out on an equal-power (cosine) curve.
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
            // Equal-power cosine curve: from 1.0 (start) to 0.0 (end)
            let gain = (t * std::f64::consts::FRAC_PI_2).cos();
            volume.set_property("volume", start_vol * gain);
            std::thread::sleep(step_time);
        }
        if fade_gen.load(Ordering::Relaxed) == current_gen {
            volume.set_property("volume", 0.0f64);
        }
    }

    /// Fades the volume in on an equal-power (sine) curve.
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
            // Equal-power sine curve: from 0.0 (start) to 1.0 (end)
            let gain = (t * std::f64::consts::FRAC_PI_2).sin();
            volume.set_property("volume", target_vol * gain);
            std::thread::sleep(step_time);
        }
        if fade_gen.load(Ordering::Relaxed) == current_gen {
            volume.set_property("volume", target_vol);
        }
        is_fading_in.store(false, Ordering::SeqCst);
    }

    /// Resumes playback with an equal-power fade-in of the given duration.
    pub fn play_with_fade_duration(&self, duration: Duration) -> Result<(), AudioEngineError> {
        let current_gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
        let (pipeline, volume, target_vol) = {
            let mut inner = self.inner.lock_safe();
            if inner.current_uri.is_none() {
                debug!("No file loaded and no active track in the queue; skipping play_with_fade");
                return Ok(());
            }
            inner.volume.set_property("volume", 0.0f64);
            inner.state = PlaybackState::Playing;
            (inner.pipeline.clone(), inner.volume.clone(), self.volume())
        };

        // Change the pipeline state outside the `inner` mutex
        pipeline.set_state(gst::State::Playing)?;

        if target_vol <= 0.001 || duration.is_zero() {
            volume.set_property("volume", target_vol);
            return Ok(());
        }

        let fade_gen = Arc::clone(&self.fade_generation);
        let is_fading_in = Arc::clone(&self.is_fading_in);
        let pipeline_wait = pipeline.clone();
        std::thread::spawn(move || {
            // Wait for the pipeline preroll (up to 150 ms) in the background, so audio buffers reach
            // the output before the fade-in curve starts, without blocking the calling (IPC/UI) thread
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

    /// Sets the crossfade duration in milliseconds (0 - 8000 ms).
    pub fn set_crossfade_duration_ms(&self, duration_ms: u64) {
        let mut inner = self.inner.lock_safe();
        inner.crossfade_duration_ms = duration_ms.clamp(0, 8000);
    }

    /// Returns the current crossfade duration in milliseconds.
    pub fn crossfade_duration_ms(&self) -> u64 {
        let inner = self.inner.lock_safe();
        inner.crossfade_duration_ms
    }
}
