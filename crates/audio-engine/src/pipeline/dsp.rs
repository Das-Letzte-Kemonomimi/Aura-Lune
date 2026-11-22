//! Parametry DSP (tonacja, tempo, prędkość, silnik), pogłos i rozmiary buforów.

use super::*;

impl AudioEngine {
    /// Aktualizuje parametry DSP w locie.
    pub fn set_dsp_params(&self, params: DspParams) -> Result<(), AudioEngineError> {
        params.validate()?;
        let mut inner = self.inner.lock_safe();

        // Jeśli parametry dotyczą silnika z przetwarzaniem, zapamiętujemy je
        if params.engine != DspEngine::Bypass {
            inner.last_active_dsp = Some(params);
        } else if let Some(ref mut last) = inner.last_active_dsp {
            last.pitch_semitones = params.pitch_semitones;
            last.tempo_ratio = params.tempo_ratio;
            last.rate_ratio = params.rate_ratio;
        }

        // Przed zmianą parametrów prędkości (tempo/rate) synchronizujemy punkt bazowy osi czasu.
        // Zapobiega to jakimkolwiek skokom pozycji podczas przesuwania suwaków w czasie odtwarzania.
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
                Self::calculate_media_position(&inner).unwrap_or(inner.base_media_pos);
            let current_sink = Self::query_raw_sink_position(&inner).unwrap_or(inner.base_sink_pts);
            inner.base_media_pos = current_media;
            inner.base_sink_pts = current_sink;
        }

        inner.dsp.set_params(params)?;
        inner.dsp_params = params;
        debug!(
            "Zaktualizowano DSP: engine={:?}, pitch={:.2} st, tempo={:.2}x, rate={:.2}x",
            params.engine, params.pitch_semitones, params.tempo_ratio, params.rate_ratio
        );
        Ok(())
    }

    /// Ustawia parametry pogłosu (Reverb).
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

    /// Pobiera aktualne parametry pogłosu (enabled, room_size, damping, width, level).
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

    /// Ustawia wysokość dźwięku w półtonach w locie.
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

    /// Ustawia mnożnik tempa w locie.
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

    /// Ustawia mnożnik szybkości w locie.
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

    /// Zwraca aktualne parametry DSP.
    pub fn dsp_params(&self) -> DspParams {
        let inner = self.inner.lock_safe();
        inner.dsp_params
    }

    /// Ustawia rozmiar bufora wyjściowego audio w milisekundach (długość kolejki przed zlewem).
    /// Domyślnie: 600 ms (dostępne wartości: 50 ms - 4000 ms).
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
            "Zaktualizowano bufor wyjściowy audio na {} ms (queue: {} ms, buffer-time)",
            clamped, clamped
        );
        Ok(())
    }

    /// Pobiera aktualny rozmiar bufora wyjściowego audio w milisekundach (domyślnie 600 ms).
    pub fn audio_buffer_duration_ms(&self) -> u64 {
        let inner = self.inner.lock_safe();
        inner.audio_buffer_ms
    }

    /// Ustawia rozmiar bloku bufora przetwarzania DSP w ramkach.
    /// Domyślnie: 2048 ramek (~46 ms). Dostępne wartości: 512 do 16384 ramek.
    pub fn set_dsp_block_size(&self, block_size: usize) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        let clamped = block_size.clamp(512, 16384);
        inner.dsp_block_size = clamped;
        inner.dsp.set_block_size(clamped);
        info!("Zaktualizowano rozmiar bloku DSP na {} ramek", clamped);
        Ok(())
    }

    /// Pobiera aktualny rozmiar bloku bufora DSP w ramkach (domyślnie 2048 ramek).
    pub fn dsp_block_size(&self) -> usize {
        let inner = self.inner.lock_safe();
        inner.dsp_block_size
    }

    /// Przełącza silnik DSP (SoundTouch, Rubber Band lub Bypass).
    pub fn set_dsp_engine(&self, engine: DspEngine) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        if current.engine == engine {
            return Ok(());
        }

        let is_active_playback = {
            let inner = self.inner.lock_safe();
            inner.state == PlaybackState::Playing || inner.state == PlaybackState::Paused
        };

        // Obliczamy bieżącą pozycję w utworze źródłowym przed zmianą silnika
        let current_pos = self.position().unwrap_or(Duration::ZERO);

        let mut inner = self.inner.lock_safe();

        // Jeśli opuszczamy aktywny silnik DSP (RubberBand / SoundTouch), zapamiętujemy parametry
        if current.engine != DspEngine::Bypass {
            inner.last_active_dsp = Some(current);
        }

        let caps = engine.capabilities();
        let target_params = match engine {
            DspEngine::Bypass => {
                // Przechodzimy w Bypass: zachowujemy bieżące parametry użytkowniczki w statusie,
                // by nie zostały zresetowane po powrocie do silnika przetwarzania
                DspParams {
                    engine: DspEngine::Bypass,
                    pitch_semitones: current.pitch_semitones,
                    tempo_ratio: current.tempo_ratio,
                    rate_ratio: current.rate_ratio,
                }
            }
            target_engine => {
                // Wracamy do RubberBand lub SoundTouch:
                // Przywracamy zapamiętane wartości parametrów sprzed przejścia w tryb Bypass!
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
        inner.base_media_pos = current_pos;
        inner.base_sink_pts = current_pos;
        drop(inner);

        // Jeśli odtwarzanie jest aktywne, wykonaj natychmiastowy seek do bieżącej pozycji.
        // Oczyszcza to zbuforowane w kolejkach zdezsynchronizowane próbki i gwarantuje,
        // że nowy silnik (lub czysty strumień Bypass) startuje od dokładnie tej samej sekundy
        // z idealnie wyrównanymi znacznikami czasu PTS w GStreamerze (brak efektu flangera i szarpnięć).
        if is_active_playback {
            if let Err(e) = self.seek(current_pos) {
                warn!(
                    "Błąd resynchronizacji seek przy zmianie silnika DSP: {:?}",
                    e
                );
            }
        }

        info!("Przełączono silnik DSP na {}", caps.name);
        Ok(())
    }

    /// Zwraca właściwości i ograniczenia aktualnego silnika DSP.
    pub fn dsp_capabilities(&self) -> DspCapabilities {
        self.dsp_params().engine.capabilities()
    }
}
