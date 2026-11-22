//! Obsługa magistrali GStreamera (EOS, błędy, tagi, spektrum) — wywoływana przez ticker odtwarzania.

use super::*;

impl AudioEngine {
    /// Odpytuje magistralę GStreamera o oczekujące komunikaty bez blokowania wątku.
    pub fn poll_events(&self) -> Vec<PlayerEvent> {
        let mut events = Vec::new();
        let pipeline = {
            let inner = self.inner.lock_safe();
            inner.pipeline.clone()
        };

        if let Some(bus) = pipeline.bus() {
            while let Some(msg) = bus.pop() {
                use gst::MessageView;
                match msg.view() {
                    MessageView::Eos(..) => {
                        info!("Otrzymano komunikat EOS (koniec strumienia)");

                        // Sprawdź flagę "Stop After Current Track" (foobar2000 classic)
                        let stop_after_current =
                            self.stop_after_current.swap(false, Ordering::SeqCst);
                        if stop_after_current {
                            info!("'Stop After Current Track' aktywny — zatrzymuję potok audio i nie przechodzę do kolejnego utworu");
                            let old_state = {
                                let mut inner = self.inner.lock_safe();
                                let old = inner.state;
                                inner.state = PlaybackState::Stopped;
                                let _ = inner.pipeline.set_state(gst::State::Null);
                                old
                            };
                            events.push(PlayerEvent::StateChanged {
                                old: old_state,
                                new: PlaybackState::Stopped,
                            });
                            events.push(PlayerEvent::Eos);
                            continue;
                        }

                        let (loop_mode, queue_is_empty) = {
                            let q = self.queue.lock_safe();
                            (q.loop_mode, q.items.is_empty())
                        };

                        if loop_mode == LoopMode::Track {
                            // Globalne powtórzenie bieżącego utworu — działa zawsze, niezależnie czy utwór
                            // został uruchomiony z kolejki, biblioteki, albumu czy pojedynczego pliku
                            let current_uri = {
                                let inner = self.inner.lock_safe();
                                inner.current_uri.clone()
                            };
                            if let Some(uri) = current_uri {
                                info!("LoopMode::Track (global) — przeładowuję i powtarzam utwór od nowa: {}", uri);
                                if let Err(load_err) = self.load_uri(&uri) {
                                    error!("Błąd ładowania URI przy powtarzaniu: {}", load_err);
                                    let mut inner = self.inner.lock_safe();
                                    inner.state = PlaybackState::Stopped;
                                } else if let Err(play_err) = self.play() {
                                    error!(
                                        "Błąd odtwarzania przy powtarzaniu utworu: {}",
                                        play_err
                                    );
                                    let mut inner = self.inner.lock_safe();
                                    inner.state = PlaybackState::Stopped;
                                } else {
                                    events.push(PlayerEvent::TrackLooped);
                                }
                            } else {
                                warn!("LoopMode::Track aktywny, ale brak URI do powtórzenia");
                                let mut inner = self.inner.lock_safe();
                                inner.state = PlaybackState::Stopped;
                            }
                        } else if loop_mode == LoopMode::Queue && queue_is_empty {
                            // Pojedynczy utwór odtworzony poza kolejką z aktywnym trybem zapętlania (Queue / Loop All)
                            let current_uri = {
                                let inner = self.inner.lock_safe();
                                inner.current_uri.clone()
                            };
                            if let Some(uri) = current_uri {
                                info!(
                                    "LoopMode::Queue (pojedynczy utwór) — przeładowuję i powtarzam utwór od nowa: {}",
                                    uri
                                );
                                if let Err(load_err) = self.load_uri(&uri) {
                                    error!("Błąd ładowania URI: {}", load_err);
                                    let mut inner = self.inner.lock_safe();
                                    inner.state = PlaybackState::Stopped;
                                } else if let Err(play_err) = self.play() {
                                    error!("Błąd odtwarzania: {}", play_err);
                                    let mut inner = self.inner.lock_safe();
                                    inner.state = PlaybackState::Stopped;
                                } else {
                                    events.push(PlayerEvent::TrackLooped);
                                }
                            } else {
                                let mut inner = self.inner.lock_safe();
                                inner.state = PlaybackState::Stopped;
                            }
                        } else {
                            {
                                let mut inner = self.inner.lock_safe();
                                inner.state = PlaybackState::Stopped;
                            }
                            // Automatyczne przejście do następnego utworu w kolejce
                            let next_item = {
                                let mut q = self.queue.lock_safe();
                                q.next().cloned()
                            };
                            match next_item {
                                Some(item) => {
                                    if let Err(e) = self.load_uri(&item.uri) {
                                        error!("Błąd ładowania następnego utworu po EOS: {}", e);
                                    } else {
                                        let (crossfade_ms, user_vol) = {
                                            let inner = self.inner.lock_safe();
                                            (inner.crossfade_duration_ms, inner.user_volume)
                                        };
                                        if crossfade_ms > 0 && user_vol > 0.001 {
                                            let fade_in_ms = crossfade_ms / 2;
                                            let _ = self.play_with_fade_duration(
                                                Duration::from_millis(fade_in_ms),
                                            );
                                        } else {
                                            let _ = self.play();
                                        }
                                        info!(
                                            "Kolejka: automatyczne płynne przejście po EOS do utworu: {}",
                                            item.title
                                        );
                                    }
                                }
                                None => {
                                    let _ = self.stop();
                                }
                            }
                        }
                        events.push(PlayerEvent::Eos);
                    }
                    MessageView::Error(err) => {
                        let error_msg = format!(
                            "GStreamer Error od {}: {} ({:?})",
                            msg.src()
                                .map(|s| s.path_string().to_string())
                                .unwrap_or_default(),
                            err.error(),
                            err.debug()
                        );
                        error!("{}", error_msg);
                        let mut inner = self.inner.lock_safe();
                        inner.state = PlaybackState::Stopped;
                        events.push(PlayerEvent::Error(error_msg));
                    }
                    MessageView::Warning(warn) => {
                        let warn_msg =
                            format!("GStreamer Warning: {} ({:?})", warn.error(), warn.debug());
                        warn!("{}", warn_msg);
                        events.push(PlayerEvent::Warning(warn_msg));
                    }
                    MessageView::Buffering(buffering) => {
                        let percent = buffering.percent();
                        debug!("Buforowanie: {}%", percent);
                        events.push(PlayerEvent::Buffering(percent));
                    }
                    MessageView::StateChanged(state_changed) => {
                        let pipeline_obj: &gst::Object = pipeline.upcast_ref();
                        if msg.src() == Some(pipeline_obj) {
                            let old_gst = state_changed.old();
                            let new_gst = state_changed.current();
                            let map_state = |s: gst::State| match s {
                                gst::State::Playing => PlaybackState::Playing,
                                gst::State::Paused => PlaybackState::Paused,
                                _ => PlaybackState::Stopped,
                            };
                            let old = map_state(old_gst);
                            let new = map_state(new_gst);
                            if old != new {
                                debug!("Zmiana stanu potoku: {:?} -> {:?}", old, new);
                                events.push(PlayerEvent::StateChanged { old, new });
                            }
                        }
                    }
                    MessageView::Element(elem_msg) => {
                        if let Some(structure) = elem_msg.structure() {
                            if structure.name() == "spectrum" {
                                if let Ok(val) = structure.value("magnitude") {
                                    let mut channel_mags: Vec<Vec<f32>> = Vec::new();
                                    let mut raw_db = Vec::new();

                                    let extract_floats = |v: &glib::SendValue| -> Option<f32> {
                                        v.get::<f32>()
                                            .ok()
                                            .or_else(|| v.get::<f64>().ok().map(|d| d as f32))
                                    };

                                    if let Ok(list) = val.get::<gst::ListRef>() {
                                        for item in list.as_slice() {
                                            if let Some(db) = extract_floats(item) {
                                                raw_db.push(db);
                                            } else if let Ok(sub_list) = item.get::<gst::ListRef>()
                                            {
                                                let sub_mags: Vec<f32> = sub_list
                                                    .as_slice()
                                                    .iter()
                                                    .filter_map(extract_floats)
                                                    .collect();
                                                channel_mags.push(sub_mags);
                                            }
                                        }
                                    } else if let Ok(arr) = val.get::<gst::ArrayRef>() {
                                        raw_db = arr
                                            .as_slice()
                                            .iter()
                                            .filter_map(extract_floats)
                                            .collect();
                                    }

                                    if channel_mags.len() >= 2 {
                                        // Prawdziwa stereofonia: emitujemy 32 pasma (16 kanał lewy + 16 kanał prawy)
                                        let left_raw = &channel_mags[0];
                                        let right_raw = &channel_mags[1];
                                        let left_norm: Vec<f32> = left_raw
                                            .iter()
                                            .map(|&db| ((db + 75.0) / 75.0).clamp(0.0, 1.0))
                                            .collect();
                                        let right_norm: Vec<f32> = right_raw
                                            .iter()
                                            .map(|&db| ((db + 75.0) / 75.0).clamp(0.0, 1.0))
                                            .collect();
                                        let left_bands = if left_norm.len() >= 64 {
                                            log_pool_to_16_bands(&left_norm)
                                        } else {
                                            left_norm
                                        };
                                        let right_bands = if right_norm.len() >= 64 {
                                            log_pool_to_16_bands(&right_norm)
                                        } else {
                                            right_norm
                                        };
                                        let mut stereo_spectrum = left_bands;
                                        stereo_spectrum.extend(right_bands);
                                        events.push(PlayerEvent::Spectrum(stereo_spectrum));
                                    } else {
                                        let mono_src = if !channel_mags.is_empty() {
                                            &channel_mags[0]
                                        } else {
                                            &raw_db
                                        };
                                        if !mono_src.is_empty() {
                                            // Normalizacja decybeli (-75 dBFS..0 dBFS -> 0.0..1.0)
                                            let normalized: Vec<f32> = mono_src
                                                .iter()
                                                .map(|&db| ((db + 75.0) / 75.0).clamp(0.0, 1.0))
                                                .collect();

                                            let display_bands = if normalized.len() >= 64 {
                                                log_pool_to_16_bands(&normalized)
                                            } else {
                                                normalized
                                            };
                                            let mut stereo_spectrum = display_bands.clone();
                                            stereo_spectrum.extend(display_bands);
                                            events.push(PlayerEvent::Spectrum(stereo_spectrum));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    MessageView::Tag(tag_msg) => {
                        let tags = tag_msg.tags();
                        let title = tags.get::<gst::tags::Title>().map(|t| t.get().to_string());
                        let artist = tags.get::<gst::tags::Artist>().map(|a| a.get().to_string());
                        if title.is_some() || artist.is_some() {
                            let tag_text = match (artist, title) {
                                (Some(a), Some(t)) => format!("{} - {}", a, t),
                                (None, Some(t)) => t,
                                (Some(a), None) => a,
                                (None, None) => String::new(),
                            };
                            if !tag_text.is_empty() {
                                events.push(PlayerEvent::Tag(tag_text));
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        // Sprawdź czy utwór zbliża się do końca (pre-EOS equal-power fade-out dla płynnego przejścia)
        if !self.is_fading_in.load(Ordering::Relaxed) {
            let is_track_loop = {
                let q = self.queue.lock_safe();
                q.loop_mode == LoopMode::Track
            };

            if !is_track_loop {
                let (is_playing, crossfade_ms, user_vol, volume) = {
                    let inner = self.inner.lock_safe();
                    (
                        inner.state == PlaybackState::Playing,
                        inner.crossfade_duration_ms,
                        inner.user_volume,
                        inner.volume.clone(),
                    )
                };

                if is_playing && crossfade_ms > 0 && user_vol > 0.001 {
                    let fade_out_ms = crossfade_ms / 2;
                    if let (Some(pos), Some(dur)) = (self.position(), self.duration()) {
                        if dur > pos {
                            let remaining_ms = (dur - pos).as_millis() as u64;
                            if remaining_ms <= fade_out_ms {
                                let t = remaining_ms as f64 / fade_out_ms as f64;
                                let gain = (t * std::f64::consts::FRAC_PI_2).sin();
                                volume.set_property("volume", user_vol * gain);
                            } else {
                                let cur_vol: f64 = volume.property("volume");
                                if (cur_vol - user_vol).abs() > 0.01 {
                                    volume.set_property("volume", user_vol);
                                }
                            }
                        }
                    }
                }
            }
        }

        events
    }

    // ==========================================
    // METODY OBSŁUGI KOREKTORA GRAFICZNEGO (EQ)
    // ==========================================
}
