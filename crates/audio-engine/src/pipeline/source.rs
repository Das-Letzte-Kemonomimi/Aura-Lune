//! Źródła dźwięku: ładowanie plików/strumieni, stemy i projekty wielościeżkowe.

use super::*;

impl AudioEngine {
    /// Ładuje plik lokalny lub URI do odtwarzania z pełną obsługą znaków japońskich i spacji w URI.
    pub fn load_uri(&self, uri_or_path: &str) -> Result<(), AudioEngineError> {
        let uri = crate::uri::media_uri_checked(uri_or_path)?;

        let mut inner = self.inner.lock_safe();
        let queue_sink_pad = Self::teardown_source(&mut inner)?;

        let uri_decoder = gst::ElementFactory::make("uridecodebin")
            .property("uri", &uri)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("uridecodebin"))?;

        inner.pipeline.add(&uri_decoder)?;

        let queue_pad_clone = queue_sink_pad.clone();
        uri_decoder.connect_pad_added(move |_bin, src_pad| {
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            if let Some(structure) = caps.structure(0) {
                if structure.name().starts_with("audio/") {
                    if queue_pad_clone.is_linked() {
                        if let Some(peer) = queue_pad_clone.peer() {
                            let _ = peer.unlink(&queue_pad_clone);
                        }
                    }
                    if let Err(err) = src_pad.link(&queue_pad_clone) {
                        error!(
                            "Błąd linkowania strumienia audio decodebin do queue_in: {:?}",
                            err
                        );
                    } else {
                        debug!("Pomyślnie podłączono dekodowany strumień audio do queue_in");
                    }
                }
            }
        });

        // Bezpieczna synchronizacja stanu nowego elementu z potokiem
        if let Err(err) = uri_decoder.sync_state_with_parent() {
            debug!(
                "sync_state_with_parent informacja (normalne przy State::Null): {:?}",
                err
            );
        }
        inner.uri_decoder = Some(uri_decoder);
        inner.current_uri = Some(uri.to_string());
        if !uri.starts_with("stem") {
            inner.original_track_uri = Some(uri.to_string());
            inner.active_stem_project_id = None;
        }
        inner.state = PlaybackState::Stopped;

        info!("Załadowano URI: {}", uri);
        Ok(())
    }

    /// Ładuje zestaw rozdzielonych stemów utworu do potoku z synchronicznym mikserem wielościeżkowym (audiomixer).
    ///
    /// Każdy stem (vocals, drums, bass, other) ma własny element regulacji głośności `volume`,
    /// co pozwala na płynne, bezszelestne regulowanie balansu, solo oraz natychmiastowe wyciszenie wokalu (tryb Karaoke).
    pub fn load_stems(
        &self,
        stems: &StemSeparationData,
        initial_state: StemMixerState,
        original_uri: Option<String>,
        seek_pos: Option<Duration>,
        start_playing: bool,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        let queue_sink_pad = Self::teardown_source(&mut inner)?;
        let audiomixer = Self::add_stem_mixer(&inner, &queue_sink_pad)?;

        let stem_list = [
            ("vocals", &stems.vocals_path),
            ("drums", &stems.drums_path),
            ("bass", &stems.bass_path),
            ("other", &stems.other_path),
        ];

        let mut stem_volumes = std::collections::HashMap::new();
        let mut stem_elements = Vec::new();

        for (name, path_str) in stem_list {
            let uri = crate::uri::media_uri(path_str);
            let gain = initial_state.get_effective_volume(name);
            let (volume, elements) = Self::add_stem_branch(&inner, &audiomixer, &uri, gain)?;
            stem_volumes.insert(name.to_string(), volume);
            stem_elements.extend(elements);
        }

        let _ = audiomixer.sync_state_with_parent();

        if let Some(orig) = original_uri {
            inner.original_track_uri = Some(orig);
        }
        inner.active_stem_project_id = None;
        inner.stem_mixer_elements = Some(StemMixerHandles {
            audiomixer,
            stem_volumes,
            stem_elements,
        });
        inner.stem_mixer_state = initial_state;
        inner.current_uri = Some(format!("stems://{}", stems.track_id));

        Self::start_stem_source(&mut inner, self.volume(), seek_pos, start_playing);

        info!("Załadowano stemy dla utworu {}", stems.track_id);
        Ok(())
    }

    /// Aktualizuje wzmocnienie i wyciszenie poszczególnych ścieżek w mikserze stemów w czasie rzeczywistym.
    pub fn set_stem_mixer_state(&self, state: StemMixerState) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.stem_mixer_state = state.clone();

        if let Some(ref handles) = inner.stem_mixer_elements {
            for (name, vol_el) in &handles.stem_volumes {
                let eff_vol = state.get_effective_volume(name);
                vol_el.set_property("volume", eff_vol);
            }
        }
        Ok(())
    }

    /// Pobiera bieżący stan miksera stemów.
    pub fn get_stem_mixer_state(&self) -> StemMixerState {
        let inner = self.inner.lock_safe();
        inner.stem_mixer_state.clone()
    }

    /// Ładuje multitrack dla projektu stemów (Moises-like Stem Project) z dowolną liczbą kanałów.
    /// Wszystkie kanały miksowane są synchronicznie próbka w próbkę przez `audiomixer`
    /// zintegrowany z głównym łańcuchem DSP (Rubber Band, SoundTouch, EQ, Limiter).
    pub fn load_stem_project_channels(
        &self,
        project_id: i64,
        channels: &[StemChannel],
        master_volume: f32,
        original_uri: Option<String>,
        seek_pos: Option<Duration>,
        start_playing: bool,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        let queue_sink_pad = Self::teardown_source(&mut inner)?;
        let audiomixer = Self::add_stem_mixer(&inner, &queue_sink_pad)?;

        let has_solo = channels.iter().any(|c| c.solo);
        let mut stem_volumes = std::collections::HashMap::new();
        let mut stem_elements = Vec::new();

        for ch in channels {
            let uri = crate::uri::media_uri(&ch.file_path);
            let gain = domain::effective_channel_gain(ch, has_solo, master_volume);
            let (volume, elements) = Self::add_stem_branch(&inner, &audiomixer, &uri, gain)?;
            stem_volumes.insert(ch.id.clone(), volume);
            stem_elements.extend(elements);
        }

        let _ = audiomixer.sync_state_with_parent();

        if let Some(orig) = original_uri {
            inner.original_track_uri = Some(orig);
        }
        inner.active_stem_project_id = Some(project_id);
        inner.stem_mixer_elements = Some(StemMixerHandles {
            audiomixer,
            stem_volumes,
            stem_elements,
        });
        inner.current_uri = Some(format!("stemproject://{}", project_id));

        Self::start_stem_source(&mut inner, self.volume(), seek_pos, start_playing);

        info!(
            "Załadowano projekt stemów {} (liczba kanałów: {})",
            project_id,
            channels.len()
        );
        Ok(())
    }

    /// Aktualizuje wzmocnienia wszystkich kanałów projektu w czasie rzeczywistym.
    pub fn apply_stem_project_mix(
        &self,
        channels: &[StemChannel],
        master_volume: f32,
    ) -> Result<(), AudioEngineError> {
        let inner = self.inner.lock_safe();
        let has_solo = channels.iter().any(|c| c.solo);

        if let Some(ref handles) = inner.stem_mixer_elements {
            for ch in channels {
                let gain = domain::effective_channel_gain(ch, has_solo, master_volume);

                if let Some(vol_el) = handles.stem_volumes.get(&ch.id) {
                    vol_el.set_property("volume", gain);
                }
            }
        }
        Ok(())
    }

    /// Przywraca odtwarzanie oryginalnego utworu (wyjście z trybu miksera stemów / Stem Project),
    /// z zachowaniem bieżącej pozycji odtwarzania oraz stanu odtwarzania (Playing / Paused).
    pub fn restore_original_track(&self) -> Result<(), AudioEngineError> {
        let (orig_uri, pos, was_playing) = {
            let inner = self.inner.lock_safe();
            let pos = inner
                .pipeline
                .query_position::<gst::ClockTime>()
                .map(|t| Duration::from_nanos(t.nseconds()))
                .unwrap_or(inner.base_media_pos);
            let was_playing = inner.state == PlaybackState::Playing;
            let uri = inner.original_track_uri.clone().or_else(|| {
                self.queue
                    .lock_safe()
                    .current_item()
                    .map(|it| it.uri.clone())
            });
            (uri, pos, was_playing)
        };

        if let Some(uri) = orig_uri {
            info!(
                "Przywracanie oryginalnego utworu: {} (pozycja: {:?}, was_playing: {})",
                uri, pos, was_playing
            );
            self.load_uri(&uri)?;
            if !pos.is_zero() {
                let _ = self.seek(pos);
            }
            if was_playing {
                let _ = self.play();
            }
            Ok(())
        } else {
            Err(AudioEngineError::FileNotFound(
                "Brak zapisanego oryginalnego utworu do przywrócenia".into(),
            ))
        }
    }

    /// Czy w potoku audio aktywne są stemy (audiomixer).
    pub fn is_stems_active(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.stem_mixer_elements.is_some()
    }

    /// ID aktywnego projektu stemów (jeśli jest załadowany).
    pub fn active_stem_project_id(&self) -> Option<i64> {
        let inner = self.inner.lock_safe();
        inner.active_stem_project_id
    }

    /// URI oryginalnego utworu skojarzonego ze stemami.
    pub fn original_track_uri(&self) -> Option<String> {
        let inner = self.inner.lock_safe();
        inner.original_track_uri.clone()
    }

    /// Zwraca bieżące załadowane URI odtwarzacza (globalne).
    pub fn current_uri(&self) -> Option<String> {
        let inner = self.inner.lock_safe();
        inner.current_uri.clone()
    }

    /// Zatrzymuje potok i usuwa bieżące źródło (dekoder lub mikser stemów), zostawiając
    /// odłączony pad wejściowy `queue_in`, do którego można podłączyć nowe źródło.
    ///
    /// `State::Null` całkowicie resetuje EOS na zlewach audio PipeWire; reset DSP usuwa
    /// zalegające próbki, aby uniknąć trzasków po zmianie utworu.
    fn teardown_source(inner: &mut PipelineInner) -> Result<gst::Pad, AudioEngineError> {
        let _ = inner.pipeline.set_state(gst::State::Null);
        inner.base_media_pos = Duration::ZERO;
        inner.base_sink_pts = Duration::ZERO;
        inner.dsp.reset();

        let queue_sink_pad = inner
            .queue_in
            .static_pad("sink")
            .ok_or_else(|| AudioEngineError::MissingElement("queue_in.sink"))?;
        if let Some(peer) = queue_sink_pad.peer() {
            let _ = peer.unlink(&queue_sink_pad);
        }

        if let Some(old_decoder) = inner.uri_decoder.take() {
            let _ = old_decoder.set_state(gst::State::Null);
            let _ = inner.pipeline.remove(&old_decoder);
        }
        if let Some(old_stems) = inner.stem_mixer_elements.take() {
            let _ = old_stems.audiomixer.set_state(gst::State::Null);
            for el in &old_stems.stem_elements {
                let _ = el.set_state(gst::State::Null);
                let _ = inner.pipeline.remove(el);
            }
            let _ = inner.pipeline.remove(&old_stems.audiomixer);
        }
        Ok(queue_sink_pad)
    }

    /// Dodaje `audiomixer` połączony z wejściem `queue_in` (źródło stemów / projektu).
    fn add_stem_mixer(
        inner: &PipelineInner,
        queue_sink_pad: &gst::Pad,
    ) -> Result<gst::Element, AudioEngineError> {
        let audiomixer = gst::ElementFactory::make("audiomixer")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audiomixer"))?;
        inner.pipeline.add(&audiomixer)?;
        audiomixer
            .static_pad("src")
            .ok_or(AudioEngineError::MissingElement("audiomixer.src"))?
            .link(queue_sink_pad)?;
        Ok(audiomixer)
    }

    /// Buduje gałąź jednego stemu: `uridecodebin → audioconvert → audioresample → volume → mikser`.
    /// Zwraca element `volume` (do regulacji w mikserze) oraz wszystkie utworzone elementy.
    fn add_stem_branch(
        inner: &PipelineInner,
        audiomixer: &gst::Element,
        uri: &str,
        gain: f64,
    ) -> Result<(gst::Element, [gst::Element; 4]), AudioEngineError> {
        let make = |factory: &'static str| {
            gst::ElementFactory::make(factory)
                .build()
                .map_err(|_| AudioEngineError::MissingElement(factory))
        };
        let decoder = gst::ElementFactory::make("uridecodebin")
            .property("uri", uri)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("uridecodebin"))?;
        let audioconvert = make("audioconvert")?;
        let audioresample = make("audioresample")?;
        let volume = gst::ElementFactory::make("volume")
            .property("volume", gain)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        inner
            .pipeline
            .add_many([&decoder, &audioconvert, &audioresample, &volume])?;
        gst::Element::link_many([&audioconvert, &audioresample, &volume])
            .map_err(|_| AudioEngineError::ElementLink("Błąd łączenia gałęzi stemu".into()))?;

        let mixer_sink_pad = audiomixer
            .request_pad_simple("sink_%u")
            .ok_or(AudioEngineError::MissingElement("audiomixer.sink_%u"))?;
        volume
            .static_pad("src")
            .ok_or(AudioEngineError::MissingElement("volume.src"))?
            .link(&mixer_sink_pad)?;

        let conv_sink_pad = audioconvert
            .static_pad("sink")
            .ok_or(AudioEngineError::MissingElement("audioconvert.sink"))?;
        decoder.connect_pad_added(move |_bin, src_pad| {
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            let is_audio = caps
                .structure(0)
                .is_some_and(|s| s.name().starts_with("audio/"));
            if is_audio && !conv_sink_pad.is_linked() {
                let _ = src_pad.link(&conv_sink_pad);
            }
        });

        for el in [&decoder, &audioconvert, &audioresample, &volume] {
            let _ = el.sync_state_with_parent();
        }
        Ok((
            volume.clone(),
            [decoder, audioconvert, audioresample, volume],
        ))
    }

    /// Wspólne zakończenie ładowania stemów / projektu: pozycja bazowa po przełączeniu
    /// (zachowanie miejsca w utworze) i opcjonalny start odtwarzania z przewinięciem.
    fn start_stem_source(
        inner: &mut PipelineInner,
        user_volume: f64,
        seek_pos: Option<Duration>,
        start_playing: bool,
    ) {
        if let Some(pos) = seek_pos {
            inner.base_media_pos = pos;
            inner.base_sink_pts = pos;
        }
        if !start_playing {
            inner.state = PlaybackState::Stopped;
            return;
        }
        inner.state = PlaybackState::Playing;
        inner.volume.set_property("volume", user_volume);
        let _ = inner.pipeline.set_state(gst::State::Playing);
        if let Some(pos) = seek_pos {
            let _ = inner.pipeline.seek_simple(
                gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                gst::ClockTime::from_nseconds(pos.as_nanos() as u64),
            );
        }
    }
}
