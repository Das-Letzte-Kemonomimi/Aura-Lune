//! Główny potok odtwarzacza GStreamer z dynamicznym procesorem DSP.

use crate::error::AudioEngineError;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::PlaybackState;
use dsp_api::{semitones_to_pitch_ratio, DspCapabilities, DspEngine, DspParams};
use gst::prelude::*;
use gstreamer as gst;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// Zdarzenia emitowane przez magistralę (Bus) odtwarzacza.
#[derive(Debug, Clone, PartialEq)]
pub enum PlayerEvent {
    StateChanged {
        old: PlaybackState,
        new: PlaybackState,
    },
    Eos,
    Error(String),
    Warning(String),
    Buffering(i32),
}

/// Wewnętrzny stan potoku audio.
struct PipelineInner {
    pipeline: gst::Pipeline,
    uri_decoder: Option<gst::Element>,
    audioconvert_in: gst::Element,
    pitch: gst::Element,
    volume: gst::Element,
    _sink: gst::Element,
    state: PlaybackState,
    dsp_params: DspParams,
}

/// Bezpieczny wielowątkowo kontroler potoku audio.
#[derive(Clone)]
pub struct AudioEngine {
    inner: Arc<Mutex<PipelineInner>>,
    queue: Arc<Mutex<PlaybackQueue>>,
}

impl AudioEngine {
    /// Inicjalizuje GStreamer oraz tworzy bazowy potok odtwarzacza.
    pub fn new() -> Result<Self, AudioEngineError> {
        gst::init()?;

        let pipeline = gst::Pipeline::with_name("auralune-audio-pipeline");

        let audioconvert_in = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_in")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        let audioresample = gst::ElementFactory::make("audioresample")
            .name("audioresample")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioresample"))?;

        let pitch = gst::ElementFactory::make("pitch")
            .name("dsp_pitch")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("pitch"))?;

        let audioconvert_out = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_out")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        let volume = gst::ElementFactory::make("volume")
            .name("volume")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        // Preferencja: pipewiresink, z bezpiecznym fallbackiem na autoaudiosink
        let sink = match gst::ElementFactory::make("pipewiresink")
            .name("sink")
            .build()
        {
            Ok(pw_sink) => {
                info!("Zainicjalizowano wyjście PipeWire (pipewiresink)");
                pw_sink
            }
            Err(_) => {
                warn!("Brak pipewiresink, używam fallbacku autoaudiosink");
                gst::ElementFactory::make("autoaudiosink")
                    .name("sink")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("autoaudiosink"))?
            }
        };

        // Dodanie statycznych elementów do potoku
        pipeline.add_many([
            &audioconvert_in,
            &audioresample,
            &pitch,
            &audioconvert_out,
            &volume,
            &sink,
        ])?;

        // Połączenie elementów przetwarzania audio:
        // audioconvert_in -> audioresample -> pitch -> audioconvert_out -> volume -> sink
        gst::Element::link_many([
            &audioconvert_in,
            &audioresample,
            &pitch,
            &audioconvert_out,
            &volume,
            &sink,
        ])
        .map_err(|_| {
            AudioEngineError::ElementLink("Nie udało się połączyć łańcucha audio".into())
        })?;

        // Ustawienie domyślnych parametrów DSP
        pitch.set_property("pitch", 1.0f32);
        pitch.set_property("tempo", 1.0f32);
        pitch.set_property("rate", 1.0f32);

        let inner = Arc::new(Mutex::new(PipelineInner {
            pipeline,
            uri_decoder: None,
            audioconvert_in,
            pitch,
            volume,
            _sink: sink,
            state: PlaybackState::Stopped,
            dsp_params: DspParams::default(),
        }));

        let queue = Arc::new(Mutex::new(PlaybackQueue::new()));
        Ok(Self { inner, queue })
    }

    /// Ładuje plik lokalny lub URI do odtwarzania.
    pub fn load_uri(&self, uri_or_path: &str) -> Result<(), AudioEngineError> {
        let uri = if uri_or_path.starts_with("file://")
            || uri_or_path.starts_with("http://")
            || uri_or_path.starts_with("https://")
        {
            uri_or_path.to_string()
        } else {
            let path = Path::new(uri_or_path);
            if !path.exists() {
                return Err(AudioEngineError::FileNotFound(uri_or_path.to_string()));
            }
            let canonical = path.canonicalize()?;
            format!("file://{}", canonical.display())
        };

        let mut inner = self.inner.lock().unwrap();

        // Zatrzymanie potoku przed przebudową wejścia
        let _ = inner.pipeline.set_state(gst::State::Ready);

        // Usunięcie poprzedniego dekodera, jeśli istniał
        if let Some(old_decoder) = inner.uri_decoder.take() {
            let _ = old_decoder.set_state(gst::State::Null);
            let _ = inner.pipeline.remove(&old_decoder);
        }

        let uri_decoder = gst::ElementFactory::make("uridecodebin")
            .property("uri", &uri)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("uridecodebin"))?;

        inner.pipeline.add(&uri_decoder)?;

        let convert_sink_pad = inner
            .audioconvert_in
            .static_pad("sink")
            .ok_or_else(|| AudioEngineError::MissingElement("audioconvert.sink"))?;

        uri_decoder.connect_pad_added(move |_bin, src_pad| {
            if convert_sink_pad.is_linked() {
                return;
            }
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            if let Some(structure) = caps.structure(0) {
                if structure.name().starts_with("audio/") {
                    if let Err(err) = src_pad.link(&convert_sink_pad) {
                        error!("Błąd linkowania strumienia audio decodebin: {:?}", err);
                    } else {
                        debug!("Pomyślnie podłączono dekodowany strumień audio");
                    }
                }
            }
        });

        // Synchronizacja stanu nowego elementu z potokiem
        uri_decoder.sync_state_with_parent()?;
        inner.uri_decoder = Some(uri_decoder);
        inner.state = PlaybackState::Stopped;

        info!("Załadowano URI: {}", uri);
        Ok(())
    }

    /// Rozpoczyna lub wznawia odtwarzanie.
    pub fn play(&self) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        inner.pipeline.set_state(gst::State::Playing)?;
        inner.state = PlaybackState::Playing;
        debug!("Stan potoku zmieniony na Playing");
        Ok(())
    }

    /// Wstrzymuje odtwarzanie (pauza).
    pub fn pause(&self) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        inner.pipeline.set_state(gst::State::Paused)?;
        inner.state = PlaybackState::Paused;
        debug!("Stan potoku zmieniony na Paused");
        Ok(())
    }

    /// Zatrzymuje odtwarzanie i resetuje pozycję.
    pub fn stop(&self) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        inner.pipeline.set_state(gst::State::Ready)?;
        inner.state = PlaybackState::Stopped;
        debug!("Stan potoku zmieniony na Stopped (Ready)");
        Ok(())
    }

    /// Przewija do zadanej pozycji w czasie.
    pub fn seek(&self, position: Duration) -> Result<(), AudioEngineError> {
        let inner = self.inner.lock().unwrap();
        let position_ns = gst::ClockTime::from_nseconds(position.as_nanos() as u64);
        inner.pipeline.seek_simple(
            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
            position_ns,
        )?;
        debug!("Wykonano seek do {:?}", position);
        Ok(())
    }

    /// Zwraca aktualną pozycję odtwarzania.
    pub fn position(&self) -> Option<Duration> {
        let inner = self.inner.lock().unwrap();
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

    /// Zwraca całkowity czas trwania załadowanego utworu.
    pub fn duration(&self) -> Option<Duration> {
        let inner = self.inner.lock().unwrap();
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

    /// Ustawia głośność (zakres 0.0 do 1.0+).
    pub fn set_volume(&self, volume: f64) -> Result<(), AudioEngineError> {
        let inner = self.inner.lock().unwrap();
        let clamped = volume.clamp(0.0, 2.0);
        inner.volume.set_property("volume", clamped);
        debug!("Ustawiono głośność na: {:.2}", clamped);
        Ok(())
    }

    /// Pobiera aktualną głośność.
    pub fn volume(&self) -> f64 {
        let inner = self.inner.lock().unwrap();
        inner.volume.property::<f64>("volume")
    }

    /// Aktualizuje parametry DSP w locie.
    pub fn set_dsp_params(&self, params: DspParams) -> Result<(), AudioEngineError> {
        params.validate()?;
        let mut inner = self.inner.lock().unwrap();

        let pitch_ratio = semitones_to_pitch_ratio(params.pitch_semitones) as f32;
        let tempo_ratio = params.tempo_ratio as f32;
        let rate_ratio = params.rate_ratio as f32;

        inner.pitch.set_property("pitch", pitch_ratio);
        inner.pitch.set_property("tempo", tempo_ratio);
        inner.pitch.set_property("rate", rate_ratio);

        inner.dsp_params = params;
        debug!(
            "Zaktualizowano DSP: pitch={:.2} st ({:.3}x), tempo={:.2}x, rate={:.2}x",
            params.pitch_semitones, pitch_ratio, tempo_ratio, rate_ratio
        );
        Ok(())
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
        let inner = self.inner.lock().unwrap();
        inner.dsp_params
    }

    /// Przełącza silnik DSP (SoundTouch lub Rubber Band).
    pub fn set_dsp_engine(&self, engine: DspEngine) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        if current.engine == engine {
            return Ok(());
        }

        let mut updated = current;
        updated.engine = engine;

        let caps = engine.capabilities();
        updated.pitch_semitones = updated
            .pitch_semitones
            .clamp(caps.min_pitch_semitones, caps.max_pitch_semitones);
        updated.tempo_ratio = updated
            .tempo_ratio
            .clamp(caps.min_tempo_ratio, caps.max_tempo_ratio);

        self.set_dsp_params(updated)?;
        info!("Przełączono silnik DSP na {}", caps.name);
        Ok(())
    }

    /// Zwraca właściwości i ograniczenia aktualnego silnika DSP.
    pub fn dsp_capabilities(&self) -> DspCapabilities {
        self.dsp_params().engine.capabilities()
    }

    /// Zwraca aktualny stan odtwarzacza.
    pub fn state(&self) -> PlaybackState {
        let inner = self.inner.lock().unwrap();
        inner.state
    }

    /// Odpytuje magistralę GStreamera o oczekujące komunikaty bez blokowania wątku.
    pub fn poll_events(&self) -> Vec<PlayerEvent> {
        let mut events = Vec::new();
        let pipeline = {
            let inner = self.inner.lock().unwrap();
            inner.pipeline.clone()
        };

        if let Some(bus) = pipeline.bus() {
            while let Some(msg) = bus.pop() {
                use gst::MessageView;
                match msg.view() {
                    MessageView::Eos(..) => {
                        info!("Otrzymano komunikat EOS (koniec strumienia)");
                        {
                            let mut inner = self.inner.lock().unwrap();
                            inner.state = PlaybackState::Stopped;
                        }
                        // Automatyczne przejście do następnego utworu w kolejce
                        if let Ok(Some(next_track)) = self.play_next() {
                            info!(
                                "Kolejka: automatyczne przejście po EOS do utworu: {}",
                                next_track.title
                            );
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
                        let mut inner = self.inner.lock().unwrap();
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
                    _ => {}
                }
            }
        }
        events
    }

    // ==========================================
    // METODY OBSŁUGI KOLEJKI ODTWARZANIA (QUEUE)
    // ==========================================

    /// Zwraca kopię bieżącego stanu kolejki odtwarzania.
    pub fn queue(&self) -> PlaybackQueue {
        self.queue.lock().unwrap().clone()
    }

    /// Ustawia nową zawartość kolejki i opcjonalnie rozpoczyna odtwarzanie od wskazanego indeksu.
    pub fn set_queue(
        &self,
        items: Vec<QueueItem>,
        start_index: Option<usize>,
    ) -> Result<Option<QueueItem>, AudioEngineError> {
        let active_item = {
            let mut q = self.queue.lock().unwrap();
            q.set_items(items, start_index);
            q.current_item().cloned()
        };

        if let Some(item) = &active_item {
            self.load_uri(&item.uri)?;
            self.play()?;
        }
        Ok(active_item)
    }

    /// Dodaje utwór na koniec bieżącej kolejki.
    pub fn add_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock().unwrap();
        q.add_item(item);
    }

    /// Wstawia utwór jako następny po bieżącym.
    pub fn add_next_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock().unwrap();
        q.add_next(item);
    }

    /// Usuwa utwór z kolejki po unikalnym identyfikatorze.
    pub fn remove_from_queue(&self, id: &str) -> Option<QueueItem> {
        let mut q = self.queue.lock().unwrap();
        q.remove_item(id)
    }

    /// Zmienia kolejność utworu w kolejce.
    pub fn move_in_queue(&self, from: usize, to: usize) -> bool {
        let mut q = self.queue.lock().unwrap();
        q.move_item(from, to)
    }

    /// Czyści całą kolejkę odtwarzania.
    pub fn clear_queue(&self) {
        let mut q = self.queue.lock().unwrap();
        q.clear();
    }

    /// Odtwarza utwór ze wskazanego indeksu w kolejce.
    pub fn play_index(&self, index: usize) -> Result<Option<QueueItem>, AudioEngineError> {
        let item = {
            let mut q = self.queue.lock().unwrap();
            if index < q.items.len() {
                q.current_index = Some(index);
                q.current_item().cloned()
            } else {
                None
            }
        };

        if let Some(item) = &item {
            self.load_uri(&item.uri)?;
            self.play()?;
        }
        Ok(item)
    }

    /// Przechodzi do następnego utworu w kolejce według trybów Loop i Shuffle.
    pub fn play_next(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        let next_item = {
            let mut q = self.queue.lock().unwrap();
            q.next().cloned()
        };

        match next_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                self.play()?;
                Ok(Some(item))
            }
            None => {
                self.stop()?;
                Ok(None)
            }
        }
    }

    /// Przechodzi do poprzedniego utworu w kolejce (lub resetuje bieżący, jeśli grał > 3s).
    pub fn play_previous(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        if let Some(pos) = self.position() {
            if pos.as_secs() >= 3 {
                self.seek(Duration::from_millis(0))?;
                let q = self.queue.lock().unwrap();
                return Ok(q.current_item().cloned());
            }
        }

        let prev_item = {
            let mut q = self.queue.lock().unwrap();
            q.previous().cloned()
        };

        match prev_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                self.play()?;
                Ok(Some(item))
            }
            None => Ok(None),
        }
    }

    /// Ustawia tryb powtarzania (None, Track, Queue).
    pub fn set_loop_mode(&self, mode: LoopMode) {
        let mut q = self.queue.lock().unwrap();
        q.set_loop_mode(mode);
    }

    /// Pobiera aktualny tryb powtarzania.
    pub fn loop_mode(&self) -> LoopMode {
        let q = self.queue.lock().unwrap();
        q.loop_mode
    }

    /// Włącza lub wyłącza tryb odtwarzania losowego (Shuffle).
    pub fn set_shuffle(&self, enabled: bool) {
        let mut q = self.queue.lock().unwrap();
        q.set_shuffle(enabled);
    }

    /// Pobiera stan trybu odtwarzania losowego (Shuffle).
    pub fn shuffle(&self) -> bool {
        let q = self.queue.lock().unwrap();
        q.shuffle
    }
}
