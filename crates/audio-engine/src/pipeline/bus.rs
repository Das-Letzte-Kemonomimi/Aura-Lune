//! Obsługa magistrali GStreamera (EOS, błędy, tagi, spektrum) — wywoływana przez ticker odtwarzania.

use super::*;

impl AudioEngine {
    /// Odpytuje magistralę GStreamera o oczekujące komunikaty bez blokowania wątku,
    /// obsługuje koniec utworu (powtarzanie / następny / stop) i płynne wyciszenie przed EOS.
    pub fn poll_events(&self) -> Vec<PlayerEvent> {
        let mut events = Vec::new();
        let pipeline = self.inner.lock_safe().pipeline.clone();

        if let Some(bus) = pipeline.bus() {
            while let Some(msg) = bus.pop() {
                self.handle_bus_message(&pipeline, &msg, &mut events);
            }
        }

        self.apply_pre_eos_fade();
        events
    }

    fn handle_bus_message(
        &self,
        pipeline: &gst::Pipeline,
        msg: &gst::Message,
        events: &mut Vec<PlayerEvent>,
    ) {
        use gst::MessageView;
        match msg.view() {
            MessageView::Eos(..) => {
                info!("Otrzymano komunikat EOS (koniec strumienia)");
                self.handle_eos(events);
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
                self.mark_stopped();
                events.push(PlayerEvent::Error(error_msg));
            }
            MessageView::Warning(warn) => {
                let warn_msg = format!("GStreamer Warning: {} ({:?})", warn.error(), warn.debug());
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
                if msg.src() != Some(pipeline_obj) {
                    return;
                }
                let map_state = |s: gst::State| match s {
                    gst::State::Playing => PlaybackState::Playing,
                    gst::State::Paused => PlaybackState::Paused,
                    _ => PlaybackState::Stopped,
                };
                let old = map_state(state_changed.old());
                let new = map_state(state_changed.current());
                if old != new {
                    debug!("Zmiana stanu potoku: {:?} -> {:?}", old, new);
                    events.push(PlayerEvent::StateChanged { old, new });
                }
            }
            MessageView::Element(elem_msg) => {
                if let Some(spectrum) = elem_msg.structure().and_then(spectrum_from_structure) {
                    events.push(PlayerEvent::Spectrum(spectrum));
                }
            }
            MessageView::Tag(tag_msg) => {
                if let Some(text) = tag_text(&tag_msg.tags()) {
                    events.push(PlayerEvent::Tag(text));
                }
            }
            _ => {}
        }
    }

    /// Koniec utworu: „stop po bieżącym”, powtarzanie albo przejście do następnego.
    fn handle_eos(&self, events: &mut Vec<PlayerEvent>) {
        // Flaga "Stop After Current Track" (foobar2000 classic) — jednorazowa.
        if self.stop_after_current.swap(false, Ordering::SeqCst) {
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
            return;
        }

        let (loop_mode, queue_is_empty) = {
            let q = self.queue.lock_safe();
            (q.loop_mode, q.items.is_empty())
        };
        match loop_mode {
            // Globalne powtórzenie bieżącego utworu — niezależnie, skąd utwór został uruchomiony.
            LoopMode::Track => self.replay_current("LoopMode::Track", events),
            // Pojedynczy utwór poza kolejką z aktywnym zapętlaniem całości.
            LoopMode::Queue if queue_is_empty => {
                self.replay_current("LoopMode::Queue (pojedynczy utwór)", events)
            }
            _ => self.advance_after_eos(),
        }
    }

    /// Przeładowuje bieżące URI i odtwarza je od początku (`PlayerEvent::TrackLooped`).
    fn replay_current(&self, reason: &str, events: &mut Vec<PlayerEvent>) {
        let Some(uri) = self.inner.lock_safe().current_uri.clone() else {
            warn!("{} aktywny, ale brak URI do powtórzenia", reason);
            self.mark_stopped();
            return;
        };
        info!(
            "{} — przeładowuję i powtarzam utwór od nowa: {}",
            reason, uri
        );
        if let Err(e) = self.load_uri(&uri) {
            error!("Błąd ładowania URI przy powtarzaniu: {}", e);
            self.mark_stopped();
        } else if let Err(e) = self.play() {
            error!("Błąd odtwarzania przy powtarzaniu utworu: {}", e);
            self.mark_stopped();
        } else {
            events.push(PlayerEvent::TrackLooped);
        }
    }

    /// Automatyczne przejście do następnego utworu w kolejce (z crossfade, jeśli włączony).
    fn advance_after_eos(&self) {
        self.mark_stopped();
        let next_item = self.queue.lock_safe().next().cloned();
        let Some(item) = next_item else {
            let _ = self.stop();
            return;
        };
        if let Err(e) = self.load_uri(&item.uri) {
            error!("Błąd ładowania następnego utworu po EOS: {}", e);
            return;
        }
        let (crossfade_ms, user_vol) = {
            let inner = self.inner.lock_safe();
            (inner.crossfade_duration_ms, inner.user_volume)
        };
        if crossfade_ms > 0 && user_vol > 0.001 {
            let _ = self.play_with_fade_duration(Duration::from_millis(crossfade_ms / 2));
        } else {
            let _ = self.play();
        }
        info!(
            "Kolejka: automatyczne płynne przejście po EOS do utworu: {}",
            item.title
        );
    }

    fn mark_stopped(&self) {
        self.inner.lock_safe().state = PlaybackState::Stopped;
    }

    /// Gdy utwór zbliża się do końca, wycisza go krzywą equal-power (pierwsza połowa crossfade).
    fn apply_pre_eos_fade(&self) {
        if self.is_fading_in.load(Ordering::Relaxed) {
            return;
        }
        if self.queue.lock_safe().loop_mode == LoopMode::Track {
            return;
        }
        let (is_playing, crossfade_ms, user_vol, volume) = {
            let inner = self.inner.lock_safe();
            (
                inner.state == PlaybackState::Playing,
                inner.crossfade_duration_ms,
                inner.user_volume,
                inner.volume.clone(),
            )
        };
        if !is_playing || crossfade_ms == 0 || user_vol <= 0.001 {
            return;
        }
        let fade_out_ms = crossfade_ms / 2;
        let (Some(pos), Some(dur)) = (self.position(), self.duration()) else {
            return;
        };
        if dur <= pos {
            return;
        }
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

/// Wyciąga widmo stereo z komunikatu elementu `spectrum` (pole `magnitude`).
fn spectrum_from_structure(structure: &gst::StructureRef) -> Option<Vec<f32>> {
    if structure.name() != "spectrum" {
        return None;
    }
    let val = structure.value("magnitude").ok()?;
    let as_f32 = |v: &glib::SendValue| -> Option<f32> {
        v.get::<f32>()
            .ok()
            .or_else(|| v.get::<f64>().ok().map(|d| d as f32))
    };

    let mut channel_mags: Vec<Vec<f32>> = Vec::new();
    let mut flat_db = Vec::new();
    if let Ok(list) = val.get::<gst::ListRef>() {
        for item in list.as_slice() {
            if let Some(db) = as_f32(item) {
                flat_db.push(db);
            } else if let Ok(sub_list) = item.get::<gst::ListRef>() {
                channel_mags.push(sub_list.as_slice().iter().filter_map(as_f32).collect());
            }
        }
    } else if let Ok(arr) = val.get::<gst::ArrayRef>() {
        flat_db = arr.as_slice().iter().filter_map(as_f32).collect();
    }
    crate::spectrum::stereo_display_spectrum(&channel_mags, &flat_db)
}

/// Tekst „Wykonawca - Tytuł” z tagów strumienia (np. radia internetowego).
fn tag_text(tags: &gst::TagListRef) -> Option<String> {
    let title = tags.get::<gst::tags::Title>().map(|t| t.get().to_string());
    let artist = tags.get::<gst::tags::Artist>().map(|a| a.get().to_string());
    let text = match (artist, title) {
        (Some(a), Some(t)) => format!("{} - {}", a, t),
        (None, Some(t)) => t,
        (Some(a), None) => a,
        (None, None) => return None,
    };
    (!text.is_empty()).then_some(text)
}
