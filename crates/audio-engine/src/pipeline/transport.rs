//! Sterowanie odtwarzaniem: play/pauza/stop, przewijanie i pozycja.

use super::*;

impl AudioEngine {
    /// Rozpoczyna lub wznawia odtwarzanie.
    pub fn play(&self) -> Result<(), AudioEngineError> {
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

        let (pipeline, volume, user_vol) = {
            let mut inner = self.inner.lock_safe();
            if inner.current_uri.is_none() {
                debug!("Brak załadowanego pliku lub aktywnego utworu w kolejce — pomijam play");
                return Ok(());
            }
            inner.state = PlaybackState::Playing;
            inner.volume.set_property("volume", self.volume());
            (inner.pipeline.clone(), inner.volume.clone(), self.volume())
        };
        pipeline.set_state(gst::State::Playing)?;
        volume.set_property("volume", user_vol);
        debug!(
            "Stan potoku zmieniony na Playing (głośność: {:.2})",
            user_vol
        );
        Ok(())
    }

    /// Wznawia odtwarzanie z opcjonalnym mikro-fade-in (ok. 30ms).
    pub fn play_with_fade(&self, fade: bool) -> Result<(), AudioEngineError> {
        if !fade {
            return self.play();
        }

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

        // Wykonanie zmiany stanu potoku poza blokadą mutexu inner
        pipeline.set_state(gst::State::Playing)?;

        let steps = 4;
        for i in 1..=steps {
            let factor = (i as f64) / (steps as f64);
            volume.set_property("volume", target_vol * factor);
            std::thread::sleep(Duration::from_millis(8));
        }
        volume.set_property("volume", target_vol);

        debug!("Stan potoku zmieniony na Playing z mikro-fade-in");
        Ok(())
    }

    /// Wstrzymuje odtwarzanie (pauza).
    pub fn pause(&self) -> Result<(), AudioEngineError> {
        let pipeline = {
            let mut inner = self.inner.lock_safe();
            inner.state = PlaybackState::Paused;
            inner.pipeline.clone()
        };
        pipeline.set_state(gst::State::Paused)?;
        debug!("Stan potoku zmieniony na Paused");
        Ok(())
    }

    /// Wstrzymuje odtwarzanie (pauza) z opcjonalnym mikro-fade-out (ok. 30ms).
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
        debug!("Stan potoku zmieniony na Paused z mikro-fade-out");
        Ok(())
    }

    /// Zwraca surową pozycję ze zlewu odtwarzania (zegar urządzenia audio).
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

    /// Zwraca całkowity czas trwania załadowanego pliku (z demuxera/dekodera).
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

    /// Oblicza rzeczywistą pozycję w pliku źródłowym, synchronizując oś czasu z potokiem i silnikiem DSP.
    pub(super) fn calculate_media_position(inner: &PipelineInner) -> Option<Duration> {
        let sink_pos = Self::query_raw_sink_position(inner).unwrap_or(inner.base_sink_pts);

        // Jeśli podczas prerollu/seeku zapytanie do sinka zwraca 0, a pozycja bazowa jest > 0, zachowaj pozycję bazową
        if sink_pos == Duration::ZERO && inner.base_media_pos > Duration::ZERO {
            return if let Some(dur) = Self::query_raw_duration(inner) {
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

        if let Some(dur) = Self::query_raw_duration(inner) {
            Some(pos.min(dur))
        } else {
            Some(pos)
        }
    }

    /// Zatrzymuje odtwarzanie i resetuje pozycję.
    pub fn stop(&self) -> Result<(), AudioEngineError> {
        let pipeline = {
            let mut inner = self.inner.lock_safe();
            inner.state = PlaybackState::Stopped;
            inner.base_media_pos = Duration::ZERO;
            inner.base_sink_pts = Duration::ZERO;
            inner.pipeline.clone()
        };
        pipeline.set_state(gst::State::Null)?;
        debug!("Stan potoku zmieniony na Stopped (Null)");
        Ok(())
    }

    /// Przewija do zadanej pozycji w czasie (natychmiastowy skok).
    pub fn seek(&self, position: Duration) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        // Jeśli nie załadowano jeszcze żadnego URI lub potok jest w stanie spoczynku (Null),
        // po prostu zapamiętujemy pozycję jako punkt początkowy bez błędu BoolError
        if inner.current_uri.is_none() || inner.pipeline.current_state() == gst::State::Null {
            inner.base_media_pos = position;
            inner.base_sink_pts = position;
            debug!(
                "Zapisano pozycję początkową seek w stanie oczekiwania: {:?}",
                position
            );
            return Ok(());
        }

        let position_ns = gst::ClockTime::from_nseconds(position.as_nanos() as u64);
        if let Err(err) = inner.pipeline.seek_simple(
            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
            position_ns,
        ) {
            debug!(
                "Ostrzeżenie seek_simple (np. brak gotowego prerollu): {:?}",
                err
            );
        }
        inner.base_media_pos = position;
        inner.base_sink_pts = position;
        debug!("Wykonano seek do {:?}", position);
        Ok(())
    }

    /// Przewija do zadanej pozycji z opcjonalnym miękkim wyciszeniem (mikro-fade out/in).
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

        // 1. Łagodny, miękki mikro-fade-out (4 kroki po 8ms = 32ms)
        let fade_out_steps = 4;
        for i in (0..fade_out_steps).rev() {
            let factor = (i as f64) / (fade_out_steps as f64);
            let curve = factor * factor; // Naturalna kwadratowa krzywa wygaszania
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

        // 2. Właściwy skok czasowy w potoku GStreamer
        self.seek(position)?;

        // 3. Krótka stabilizacja bufora po skoku (10ms)
        std::thread::sleep(Duration::from_millis(10));

        // 4. Płynny powrót głośności (6 kroków po 8ms = 48ms)
        let fade_in_steps = 6;
        for i in 1..=fade_in_steps {
            let factor = (i as f64) / (fade_in_steps as f64);
            let curve = (factor * std::f64::consts::FRAC_PI_2).sin(); // Płynne wejście sinusa
            {
                let inner = self.inner.lock_safe();
                if inner.seek_seq != current_seq {
                    return Ok(());
                }
                inner.volume.set_property("volume", target_vol * curve);
            }
            std::thread::sleep(step_delay);
        }

        // 5. Ostateczne upewnienie się, że głośność powróciła do zadanej przez użytkownika
        {
            let inner = self.inner.lock_safe();
            if inner.seek_seq == current_seq {
                inner.volume.set_property("volume", target_vol);
            }
        }

        Ok(())
    }

    /// Zwraca aktualną pozycję odtwarzania w osi czasu pliku źródłowego (z uwzględnieniem DSP).
    pub fn position(&self) -> Option<Duration> {
        let inner = self.inner.lock_safe();
        Self::calculate_media_position(&inner)
    }

    /// Zwraca całkowity czas trwania załadowanego utworu.
    pub fn duration(&self) -> Option<Duration> {
        let inner = self.inner.lock_safe();
        Self::query_raw_duration(&inner)
    }

    /// Zwraca aktualny stan odtwarzacza.
    pub fn state(&self) -> PlaybackState {
        let inner = self.inner.lock_safe();
        inner.state
    }
}
