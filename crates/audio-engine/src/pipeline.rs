//! Główny potok odtwarzacza GStreamer z dynamicznym procesorem DSP.

use crate::error::AudioEngineError;
use domain::crossfeed::CrossfeedConfig;
use domain::equalizer::EqualizerState;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::replaygain::{ReplayGainConfig, ReplayGainMode};
use domain::silence::SilenceTrimmingConfig;
use domain::PlaybackState;
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use gst::prelude::*;
use gst_base::prelude::BaseTransformExt;
use gstreamer as gst;
use gstreamer_base as gst_base;
use std::path::Path;
use std::sync::atomic::{AtomicU8, Ordering};
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
    Spectrum(Vec<f32>),
    Tag(String),
}

/// Wewnętrzny stan potoku audio.
struct PipelineInner {
    pipeline: gst::Pipeline,
    uri_decoder: Option<gst::Element>,
    current_uri: Option<String>,
    audioconvert_in: gst::Element,
    dsp: crate::dsp_node::AuraluneDsp,
    freeverb: Option<gst::Element>,
    equalizer: gst::Element,
    bs2b: Option<gst::Element>,
    cutter: Option<gst::Element>,
    rgvolume: gst::Element,
    rglimiter: gst::Element,
    _spectrum: gst::Element,
    volume: gst::Element,
    queue_sink: gst::Element,
    sink: gst::Element,
    audio_buffer_ms: u64,
    dsp_block_size: usize,
    state: PlaybackState,
    dsp_params: DspParams,
    last_active_dsp: Option<DspParams>,
    equalizer_state: EqualizerState,
    replaygain_config: ReplayGainConfig,
    crossfeed_config: CrossfeedConfig,
    silence_trimming_config: SilenceTrimmingConfig,
    reverb_enabled: bool,
    reverb_room_size: f64,
    reverb_damping: f64,
    reverb_width: f64,
    reverb_level: f64,
    base_media_pos: Duration,
    base_sink_pts: Duration,
    user_volume: f64,
    seek_seq: u64,
    stereo_widener: Option<gst::Element>,
    stereo_widener_active: bool,
    stereo_widener_amount: f64,
    crossfade_duration_ms: u64,
}

/// Bezpieczny wielowątkowo kontroler potoku audio.
#[derive(Clone)]
pub struct AudioEngine {
    inner: Arc<Mutex<PipelineInner>>,
    queue: Arc<Mutex<PlaybackQueue>>,
    replaygain_mode: Arc<AtomicU8>,
}

impl AudioEngine {
    /// Inicjalizuje GStreamer oraz tworzy bazowy potok odtwarzacza.
    pub fn new() -> Result<Self, AudioEngineError> {
        gst::init()?;
        let _ = crate::dsp_node::register_dsp_element();

        let pipeline = gst::Pipeline::with_name("auralune-audio-pipeline");

        let audioconvert_in = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_in")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        let audioresample = gst::ElementFactory::make("audioresample")
            .name("audioresample")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioresample"))?;

        // Wymuszenie formatu F32LE dla procesorów DSP
        let capsfilter_dsp = gst::ElementFactory::make("capsfilter")
            .name("capsfilter_dsp")
            .property(
                "caps",
                gst::Caps::builder("audio/x-raw")
                    .field("format", "F32LE")
                    .field("layout", "interleaved")
                    .build(),
            )
            .build()
            .map_err(|_| AudioEngineError::MissingElement("capsfilter"))?;

        // Dedykowany element DSP (Bypass / Rubber Band / SoundTouch)
        let dsp = crate::dsp_node::AuraluneDsp::new(Some("auralune_dsp"));

        let equalizer = gst::ElementFactory::make("equalizer-10bands")
            .name("equalizer_10bands")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("equalizer-10bands"))?;

        let spectrum = gst::ElementFactory::make("spectrum")
            .name("spectrum_analyzer")
            .property("bands", 16u32)
            .property("threshold", -60i32)
            .property("interval", 33_333_333u64)
            .property("message-magnitude", true)
            .property("post-messages", true)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("spectrum"))?;

        let audioconvert_out = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_out")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        let volume = gst::ElementFactory::make("volume")
            .name("volume")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        // Bufor kolejki przed sinkiem: 80ms maks — zapewnia natychmiastową, słyszalną reakcję
        // na przesunięcie suwaków DSP (tempo, pitch, playback rate) bez wyczuwalnego opóźnienia i bez xrunów.
        let queue_sink = gst::ElementFactory::make("queue")
            .name("queue_sink")
            .property("max-size-time", 80_000_000u64)
            .property("max-size-buffers", 0u32)
            .property("max-size-bytes", 0u32)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("queue"))?;

        // Preferencja: pipewiresink z marginesem 40ms (domyślnie slave-method=none),
        // co eliminuje sztuczne resamplingi zegara GStreamera wywołujące efekt "pływania" dźwięku.
        let sink = match gst::ElementFactory::make("pipewiresink")
            .name("sink")
            .property("processing-deadline", 40_000_000u64)
            .build()
        {
            Ok(pw_sink) => {
                info!("Zainicjalizowano wyjście PipeWire (40ms deadline, slave-method: none)");
                pw_sink
            }
            Err(_) => {
                warn!("Brak pipewiresink, używam fallbacku autoaudiosink");
                let auto_sink = gst::ElementFactory::make("autoaudiosink")
                    .name("sink")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("autoaudiosink"))?;
                if auto_sink.find_property("slave-method").is_some() {
                    auto_sink.set_property("slave-method", 0i32);
                }
                auto_sink
            }
        };

        let freeverb = match gst::ElementFactory::make("freeverb")
            .name("freeverb")
            .property("level", 0.0f32)
            .property("room-size", 0.5f32)
            .property("damping", 0.2f32)
            .property("width", 1.0f32)
            .build()
        {
            Ok(fv) => Some(fv),
            Err(e) => {
                warn!("Brak elementu freeverb (gst-plugins-bad): {:?}", e);
                None
            }
        };

        // Dodanie statycznych elementów do potoku
        pipeline.add_many([
            &audioconvert_in,
            &audioresample,
            &capsfilter_dsp,
            dsp.upcast_ref(),
        ])?;

        if let Some(ref fv) = freeverb {
            pipeline.add(fv)?;
        }

        let rgvolume = gst::ElementFactory::make("rgvolume")
            .name("rgvolume")
            .property("album-mode", false)
            .property("pre-amp", 0.0f64)
            .property("fallback-gain", 0.0f64)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("rgvolume"))?;

        let rglimiter = gst::ElementFactory::make("rglimiter")
            .name("rglimiter")
            .property("enabled", false)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("rglimiter"))?;

        let audioconvert_sink = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_sink")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        let stereo = match gst::ElementFactory::make("stereo")
            .name("stereo_widener")
            .property("active", false)
            .property("stereo", 0.1f32)
            .build()
        {
            Ok(s) => Some(s),
            Err(e) => {
                warn!("Brak elementu stereo (gst-plugins-good): {:?}", e);
                None
            }
        };

        let audioconvert_stereo = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_stereo")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        // Element Bauer stereophonic-to-binaural (Crossfeed bs2b) dla odsłuchu słuchawkowego
        let bs2b = match gst::ElementFactory::make("bs2b")
            .name("bs2b_crossfeed")
            .property("fcut", 700i32)
            .property("feed", 45i32)
            .build()
        {
            Ok(el) => {
                if let Ok(transform) = el.clone().dynamic_cast::<gst_base::BaseTransform>() {
                    transform.set_passthrough(true); // Domyślnie tryb bypass
                }
                Some(el)
            }
            Err(e) => {
                warn!("Brak elementu bs2b (gst-plugins-bad): {:?}", e);
                None
            }
        };

        // Element automatycznego pomijania ciszy (Silence Trimming cutter)
        let cutter = match gst::ElementFactory::make("cutter")
            .name("cutter_silence")
            .property("leaky", false) // Domyślnie wyłączony bypass
            .property("threshold-dB", -50.0f64)
            .property("run-length", 500_000_000u64)
            .property("pre-length", 200_000_000u64)
            .build()
        {
            Ok(c) => Some(c),
            Err(e) => {
                warn!("Brak elementu cutter (gst-plugins-good): {:?}", e);
                None
            }
        };

        let audioconvert_cutter = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_cutter")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        pipeline.add_many([
            &equalizer,
            &queue_sink,
            &audioconvert_out,
            &rgvolume,
            &rglimiter,
            &volume,
            &spectrum,
            &audioconvert_sink,
            &sink,
        ])?;

        if let Some(ref st) = stereo {
            pipeline.add_many([st, &audioconvert_stereo])?;
        }
        if let Some(ref bs) = bs2b {
            pipeline.add(bs)?;
        }
        if let Some(ref ct) = cutter {
            pipeline.add_many([ct, &audioconvert_cutter])?;
        }

        // Połączenie elementów przetwarzania audio:
        // audioconvert_in -> audioresample -> capsfilter_dsp -> dsp
        gst::Element::link_many([
            &audioconvert_in,
            &audioresample,
            &capsfilter_dsp,
            dsp.upcast_ref(),
        ])
        .map_err(|_| AudioEngineError::ElementLink("Nie udało się połączyć wejścia DSP".into()))?;

        // DSP -> (freeverb) -> equalizer
        if let Some(ref fv) = freeverb {
            dsp.upcast_ref::<gst::Element>().link(fv).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania DSP z freeverb".into())
            })?;
            fv.link(&equalizer).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania freeverb z equalizer".into())
            })?;
        } else {
            dsp.upcast_ref::<gst::Element>()
                .link(&equalizer)
                .map_err(|_| {
                    AudioEngineError::ElementLink("Błąd linkowania DSP z equalizer".into())
                })?;
        }

        // equalizer -> (bs2b) -> queue_sink
        if let Some(ref bs) = bs2b {
            equalizer.link(bs).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania equalizer z bs2b".into())
            })?;
            bs.link(&queue_sink).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania bs2b z queue_sink".into())
            })?;
        } else {
            equalizer.link(&queue_sink).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania equalizer z queue_sink".into())
            })?;
        }

        // queue_sink -> audioconvert_out -> (stereo -> audioconvert_stereo) -> (cutter -> audioconvert_cutter) -> rgvolume -> rglimiter -> volume -> spectrum -> audioconvert_sink -> sink
        let mut out_chain: Vec<&gst::Element> = Vec::new();
        out_chain.push(&queue_sink);
        out_chain.push(&audioconvert_out);
        if let Some(ref st) = stereo {
            out_chain.push(st);
            out_chain.push(&audioconvert_stereo);
        }
        if let Some(ref ct) = cutter {
            out_chain.push(ct);
            out_chain.push(&audioconvert_cutter);
        }
        out_chain.push(&rgvolume);
        out_chain.push(&rglimiter);
        out_chain.push(&volume);
        out_chain.push(&spectrum);
        out_chain.push(&audioconvert_sink);
        out_chain.push(&sink);

        gst::Element::link_many(&out_chain).map_err(|_| {
            AudioEngineError::ElementLink(
                "Nie udało się połączyć wyjściowego łańcucha audio ze stereo, cutter, ReplayGain i zlewem".into(),
            )
        })?;

        let inner = Arc::new(Mutex::new(PipelineInner {
            pipeline,
            uri_decoder: None,
            current_uri: None,
            audioconvert_in,
            dsp,
            freeverb,
            equalizer,
            bs2b,
            cutter,
            rgvolume: rgvolume.clone(),
            rglimiter,
            _spectrum: spectrum,
            volume,
            queue_sink: queue_sink.clone(),
            sink,
            audio_buffer_ms: 80,
            dsp_block_size: 2048,
            state: PlaybackState::Stopped,
            dsp_params: DspParams::default(),
            last_active_dsp: None,
            equalizer_state: EqualizerState::default(),
            replaygain_config: ReplayGainConfig::default(),
            crossfeed_config: CrossfeedConfig::default(),
            silence_trimming_config: SilenceTrimmingConfig::default(),
            reverb_enabled: false,
            reverb_room_size: 0.5,
            reverb_damping: 0.2,
            reverb_width: 1.0,
            reverb_level: 0.0,
            base_media_pos: Duration::ZERO,
            base_sink_pts: Duration::ZERO,
            user_volume: 1.0,
            seek_seq: 0,
            stereo_widener: stereo,
            stereo_widener_active: false,
            stereo_widener_amount: 0.1,
            crossfade_duration_ms: 1500,
        }));

        let replaygain_mode = Arc::new(AtomicU8::new(ReplayGainMode::Off as u8));
        let rg_mode_for_notify = replaygain_mode.clone();

        // Nasłuchiwanie zmian tagów w rgvolume: gdy tryb to Off, neutralizujemy na bieżąco BEZ blokowania mutexu inner
        rgvolume.connect_notify(Some("target-gain"), move |rgv, _pspec| {
            if rg_mode_for_notify.load(Ordering::Relaxed) == ReplayGainMode::Off as u8 {
                let target: f64 = rgv.property("target-gain");
                rgv.set_property("pre-amp", -target);
            }
        });

        let queue = Arc::new(Mutex::new(PlaybackQueue::new()));
        Ok(Self {
            inner,
            queue,
            replaygain_mode,
        })
    }

    /// Ładuje plik lokalny lub URI do odtwarzania z pełną obsługą znaków japońskich i spacji w URI.
    pub fn load_uri(&self, uri_or_path: &str) -> Result<(), AudioEngineError> {
        let uri = if uri_or_path.starts_with("http://") || uri_or_path.starts_with("https://") {
            uri_or_path.to_string()
        } else if uri_or_path.starts_with("file://") {
            // Bezpieczna obsługa URI z prefiksem file:// (ochrona przed podwójnym kodowaniem %20 -> %2520)
            if let Ok((path, _)) = glib::filename_from_uri(uri_or_path) {
                if path.exists() {
                    glib::filename_to_uri(&path, None)
                        .map(|u| u.to_string())
                        .unwrap_or_else(|_| uri_or_path.to_string())
                } else {
                    uri_or_path.to_string()
                }
            } else {
                uri_or_path.to_string()
            }
        } else {
            let path = Path::new(uri_or_path);
            if !path.exists() {
                return Err(AudioEngineError::FileNotFound(uri_or_path.to_string()));
            }
            let canonical = path.canonicalize()?;
            glib::filename_to_uri(&canonical, None)
                .map(|u| u.to_string())
                .unwrap_or_else(|_| format!("file://{}", canonical.display()))
        };

        let mut inner = self.inner.lock().unwrap();

        // Zatrzymanie potoku przed przebudową wejścia
        let _ = inner.pipeline.set_state(gst::State::Ready);
        inner.base_media_pos = Duration::ZERO;
        inner.base_sink_pts = Duration::ZERO;

        // Reset procesorów DSP i kolejki próbek, aby uniknąć trzasków i zacinania
        inner.dsp.reset();

        // Upewnienie się, że pad wejściowy audioconvert_in jest czysty i odłączony od poprzedniego strumienia
        let convert_sink_pad = inner
            .audioconvert_in
            .static_pad("sink")
            .ok_or_else(|| AudioEngineError::MissingElement("audioconvert.sink"))?;
        if convert_sink_pad.is_linked() {
            if let Some(peer) = convert_sink_pad.peer() {
                let _ = peer.unlink(&convert_sink_pad);
            }
        }

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

        let convert_pad_clone = convert_sink_pad.clone();
        uri_decoder.connect_pad_added(move |_bin, src_pad| {
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            if let Some(structure) = caps.structure(0) {
                if structure.name().starts_with("audio/") {
                    if convert_pad_clone.is_linked() {
                        if let Some(peer) = convert_pad_clone.peer() {
                            let _ = peer.unlink(&convert_pad_clone);
                        }
                    }
                    if let Err(err) = src_pad.link(&convert_pad_clone) {
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
        inner.current_uri = Some(uri.to_string());
        inner.state = PlaybackState::Stopped;

        info!("Załadowano URI: {}", uri);
        Ok(())
    }

    /// Rozpoczyna lub wznawia odtwarzanie.
    pub fn play(&self) -> Result<(), AudioEngineError> {
        let pipeline = {
            let mut inner = self.inner.lock().unwrap();
            inner.state = PlaybackState::Playing;
            inner.pipeline.clone()
        };
        pipeline.set_state(gst::State::Playing)?;
        debug!("Stan potoku zmieniony na Playing");
        Ok(())
    }

    /// Wznawia odtwarzanie z opcjonalnym mikro-fade-in (ok. 30ms).
    pub fn play_with_fade(&self, fade: bool) -> Result<(), AudioEngineError> {
        if !fade {
            return self.play();
        }

        let (pipeline, volume, target_vol) = {
            let mut inner = self.inner.lock().unwrap();
            inner.volume.set_property("volume", 0.0f64);
            inner.state = PlaybackState::Playing;
            (
                inner.pipeline.clone(),
                inner.volume.clone(),
                inner.user_volume,
            )
        };

        // Wykonanie zmiany stanu potoku poza blokadą mutexu inner
        pipeline.set_state(gst::State::Playing)?;

        let steps = 4;
        for i in 1..=steps {
            let factor = (i as f64) / (steps as f64);
            volume.set_property("volume", target_vol * factor);
            std::thread::sleep(Duration::from_millis(8));
        }

        debug!("Stan potoku zmieniony na Playing z mikro-fade-in");
        Ok(())
    }

    /// Wstrzymuje odtwarzanie (pauza).
    pub fn pause(&self) -> Result<(), AudioEngineError> {
        let pipeline = {
            let mut inner = self.inner.lock().unwrap();
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
            let inner = self.inner.lock().unwrap();
            (
                inner.pipeline.clone(),
                inner.volume.clone(),
                inner.user_volume,
            )
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
            let mut inner = self.inner.lock().unwrap();
            inner.state = PlaybackState::Paused;
        }
        debug!("Stan potoku zmieniony na Paused z mikro-fade-out");
        Ok(())
    }

    /// Zwraca surową pozycję ze zlewu odtwarzania (zegar urządzenia audio).
    fn query_raw_sink_position(inner: &PipelineInner) -> Option<Duration> {
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
    fn query_raw_duration(inner: &PipelineInner) -> Option<Duration> {
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
    fn calculate_media_position(inner: &PipelineInner) -> Option<Duration> {
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
            let mut inner = self.inner.lock().unwrap();
            inner.state = PlaybackState::Stopped;
            inner.base_media_pos = Duration::ZERO;
            inner.base_sink_pts = Duration::ZERO;
            inner.pipeline.clone()
        };
        pipeline.set_state(gst::State::Ready)?;
        debug!("Stan potoku zmieniony na Stopped (Ready)");
        Ok(())
    }

    /// Przewija do zadanej pozycji w czasie (natychmiastowy skok).
    pub fn seek(&self, position: Duration) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        let position_ns = gst::ClockTime::from_nseconds(position.as_nanos() as u64);
        inner.pipeline.seek_simple(
            gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
            position_ns,
        )?;
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
            let mut inner = self.inner.lock().unwrap();
            inner.seek_seq = inner.seek_seq.wrapping_add(1);
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (is_playing, inner.user_volume, inner.seek_seq)
        };

        if !is_playing || target_vol <= 0.001 {
            return self.seek(position);
        }

        let step_delay = Duration::from_millis(8);

        // 1. Szybki, miękki mikro-fade-out (ok. 30ms)
        let fade_out_steps = 4;
        for i in (0..fade_out_steps).rev() {
            let factor = (i as f64) / (fade_out_steps as f64);
            {
                let inner = self.inner.lock().unwrap();
                if inner.seek_seq != current_seq {
                    return Ok(());
                }
                inner.volume.set_property("volume", target_vol * factor);
            }
            std::thread::sleep(step_delay);
        }

        {
            let inner = self.inner.lock().unwrap();
            if inner.seek_seq != current_seq {
                return Ok(());
            }
            inner.volume.set_property("volume", 0.0f64);
        }

        // 2. Właściwy skok czasowy w potoku GStreamer
        self.seek(position)?;

        // 3. Krótka stabilizacja bufora po skoku
        std::thread::sleep(Duration::from_millis(15));

        // 4. Miękki powrót głośności (mikro-fade-in ok. 50ms)
        let fade_in_steps = 6;
        for i in 1..=fade_in_steps {
            let factor = (i as f64) / (fade_in_steps as f64);
            {
                let inner = self.inner.lock().unwrap();
                if inner.seek_seq != current_seq {
                    return Ok(());
                }
                inner.volume.set_property("volume", target_vol * factor);
            }
            std::thread::sleep(step_delay);
        }

        // 5. Ostateczne upewnienie się, że głośność powróciła do zadanej przez użytkownika
        {
            let inner = self.inner.lock().unwrap();
            if inner.seek_seq == current_seq {
                inner.volume.set_property("volume", target_vol);
            }
        }

        Ok(())
    }

    /// Zwraca aktualną pozycję odtwarzania w osi czasu pliku źródłowego (z uwzględnieniem DSP).
    pub fn position(&self) -> Option<Duration> {
        let inner = self.inner.lock().unwrap();
        Self::calculate_media_position(&inner)
    }

    /// Zwraca całkowity czas trwania załadowanego utworu.
    pub fn duration(&self) -> Option<Duration> {
        let inner = self.inner.lock().unwrap();
        Self::query_raw_duration(&inner)
    }

    /// Ustawia głośność (zakres 0.0 do 1.0+).
    pub fn set_volume(&self, volume: f64) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        let clamped = volume.clamp(0.0, 2.0);
        inner.user_volume = clamped;
        inner.volume.set_property("volume", clamped);
        debug!("Ustawiono głośność na: {:.2}", clamped);
        Ok(())
    }

    /// Pobiera aktualną głośność zadaną przez użytkownika.
    pub fn volume(&self) -> f64 {
        let inner = self.inner.lock().unwrap();
        inner.user_volume
    }

    /// Aktualizuje parametry DSP w locie.
    pub fn set_dsp_params(&self, params: DspParams) -> Result<(), AudioEngineError> {
        params.validate()?;
        let mut inner = self.inner.lock().unwrap();

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
        let mut inner = self.inner.lock().unwrap();
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
        let inner = self.inner.lock().unwrap();
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
        let inner = self.inner.lock().unwrap();
        inner.dsp_params
    }

    /// Ustawia rozmiar bufora wyjściowego audio w milisekundach (długość kolejki przed zlewem).
    /// Domyślnie: 80 ms (dostępne wartości: 20 ms - 2000 ms).
    pub fn set_audio_buffer_duration_ms(&self, buffer_ms: u64) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        let clamped = buffer_ms.clamp(20, 2000);
        inner.audio_buffer_ms = clamped;
        let time_ns = clamped * 1_000_000u64;
        inner.queue_sink.set_property("max-size-time", time_ns);
        if inner.sink.find_property("processing-deadline").is_some() {
            let deadline_ns = (clamped / 2).clamp(10, 500) * 1_000_000u64;
            inner.sink.set_property("processing-deadline", deadline_ns);
        }
        info!("Zaktualizowano bufor wyjściowy audio na {} ms", clamped);
        Ok(())
    }

    /// Pobiera aktualny rozmiar bufora wyjściowego audio w milisekundach (domyślnie 80 ms).
    pub fn audio_buffer_duration_ms(&self) -> u64 {
        let inner = self.inner.lock().unwrap();
        inner.audio_buffer_ms
    }

    /// Ustawia rozmiar bloku bufora przetwarzania DSP w ramkach.
    /// Domyślnie: 2048 ramek (~46 ms). Dostępne wartości: 512 do 16384 ramek.
    pub fn set_dsp_block_size(&self, block_size: usize) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        let clamped = block_size.clamp(512, 16384);
        inner.dsp_block_size = clamped;
        inner.dsp.set_block_size(clamped);
        info!("Zaktualizowano rozmiar bloku DSP na {} ramek", clamped);
        Ok(())
    }

    /// Pobiera aktualny rozmiar bloku bufora DSP w ramkach (domyślnie 2048 ramek).
    pub fn dsp_block_size(&self) -> usize {
        let inner = self.inner.lock().unwrap();
        inner.dsp_block_size
    }

    /// Przełącza silnik DSP (SoundTouch, Rubber Band lub Bypass).
    pub fn set_dsp_engine(&self, engine: DspEngine) -> Result<(), AudioEngineError> {
        let current = self.dsp_params();
        if current.engine == engine {
            return Ok(());
        }

        let is_active_playback = {
            let inner = self.inner.lock().unwrap();
            inner.state == PlaybackState::Playing || inner.state == PlaybackState::Paused
        };

        // Obliczamy bieżącą pozycję w utworze źródłowym przed zmianą silnika
        let current_pos = self.position().unwrap_or(Duration::ZERO);

        let mut inner = self.inner.lock().unwrap();

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

    /// Zwraca aktualny stan odtwarzacza.
    pub fn state(&self) -> PlaybackState {
        let inner = self.inner.lock().unwrap();
        inner.state
    }

    /// Zwraca bieżące załadowane URI odtwarzacza (globalne).
    pub fn current_uri(&self) -> Option<String> {
        let inner = self.inner.lock().unwrap();
        inner.current_uri.clone()
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

                        let (loop_mode, queue_is_empty) = {
                            let q = self.queue.lock().unwrap();
                            (q.loop_mode, q.items.is_empty())
                        };

                        if loop_mode == LoopMode::Track {
                            // Globalne powtórzenie bieżącego utworu — działa zawsze, niezależnie czy utwór
                            // został uruchomiony z kolejki, biblioteki, albumu czy pojedynczego pliku
                            let current_uri = {
                                let inner = self.inner.lock().unwrap();
                                inner.current_uri.clone()
                            };
                            if let Some(uri) = current_uri {
                                info!("LoopMode::Track (global) — powtarzam utwór: {}", uri);
                                if let Err(e) = self.seek(Duration::ZERO) {
                                    debug!(
                                        "Seek do 0 po EOS nie powiódł się ({}), przeładowuję URI: {}",
                                        e, uri
                                    );
                                    if let Err(load_err) = self.load_uri(&uri) {
                                        error!("Błąd ładowania URI przy powtarzaniu: {}", load_err);
                                        let mut inner = self.inner.lock().unwrap();
                                        inner.state = PlaybackState::Stopped;
                                    } else if let Err(play_err) = self.play() {
                                        error!(
                                            "Błąd odtwarzania przy powtarzaniu utworu: {}",
                                            play_err
                                        );
                                        let mut inner = self.inner.lock().unwrap();
                                        inner.state = PlaybackState::Stopped;
                                    }
                                } else if let Err(play_err) = self.play() {
                                    error!(
                                        "Błąd wznowienia odtwarzania po seek na początek: {}",
                                        play_err
                                    );
                                    let mut inner = self.inner.lock().unwrap();
                                    inner.state = PlaybackState::Stopped;
                                }
                            } else {
                                warn!("LoopMode::Track aktywny, ale brak URI do powtórzenia");
                                let mut inner = self.inner.lock().unwrap();
                                inner.state = PlaybackState::Stopped;
                            }
                        } else if loop_mode == LoopMode::Queue && queue_is_empty {
                            // Pojedynczy utwór odtworzony poza kolejką z aktywnym trybem zapętlania (Queue / Loop All)
                            let current_uri = {
                                let inner = self.inner.lock().unwrap();
                                inner.current_uri.clone()
                            };
                            if let Some(uri) = current_uri {
                                info!(
                                    "LoopMode::Queue (pojedynczy utwór) — powtarzam utwór: {}",
                                    uri
                                );
                                if let Err(e) = self.seek(Duration::ZERO) {
                                    debug!(
                                        "Seek do 0 po EOS nie powiódł się ({}), przeładowuję URI: {}",
                                        e, uri
                                    );
                                    if let Err(load_err) = self.load_uri(&uri) {
                                        error!("Błąd ładowania URI: {}", load_err);
                                        let mut inner = self.inner.lock().unwrap();
                                        inner.state = PlaybackState::Stopped;
                                    } else if let Err(play_err) = self.play() {
                                        error!("Błąd odtwarzania: {}", play_err);
                                        let mut inner = self.inner.lock().unwrap();
                                        inner.state = PlaybackState::Stopped;
                                    }
                                } else if let Err(play_err) = self.play() {
                                    error!("Błąd odtwarzania po seek: {}", play_err);
                                    let mut inner = self.inner.lock().unwrap();
                                    inner.state = PlaybackState::Stopped;
                                }
                            } else {
                                let mut inner = self.inner.lock().unwrap();
                                inner.state = PlaybackState::Stopped;
                            }
                        } else {
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
                    MessageView::Element(elem_msg) => {
                        if let Some(structure) = elem_msg.structure() {
                            if structure.name() == "spectrum" {
                                if let Ok(val) = structure.value("magnitude") {
                                    let mut magnitudes = Vec::new();

                                    let extract_floats = |v: &glib::SendValue| -> Option<f32> {
                                        v.get::<f32>()
                                            .ok()
                                            .or_else(|| v.get::<f64>().ok().map(|d| d as f32))
                                    };

                                    if let Ok(list) = val.get::<gst::ListRef>() {
                                        for item in list.as_slice() {
                                            if let Some(db) = extract_floats(item) {
                                                magnitudes
                                                    .push(((db + 60.0) / 60.0).clamp(0.0, 1.0));
                                            } else if let Ok(sub_list) = item.get::<gst::ListRef>()
                                            {
                                                // Obsługa kanałów stereo/wielokanałowych
                                                let sub_mags: Vec<f32> = sub_list
                                                    .as_slice()
                                                    .iter()
                                                    .filter_map(extract_floats)
                                                    .map(|db| ((db + 60.0) / 60.0).clamp(0.0, 1.0))
                                                    .collect();
                                                if magnitudes.is_empty() {
                                                    magnitudes = sub_mags;
                                                } else {
                                                    for (idx, &s) in sub_mags.iter().enumerate() {
                                                        if idx < magnitudes.len() {
                                                            magnitudes[idx] =
                                                                (magnitudes[idx] + s) * 0.5;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } else if let Ok(arr) = val.get::<gst::ArrayRef>() {
                                        magnitudes = arr
                                            .as_slice()
                                            .iter()
                                            .filter_map(extract_floats)
                                            .map(|db| ((db + 60.0) / 60.0).clamp(0.0, 1.0))
                                            .collect();
                                    }

                                    if !magnitudes.is_empty() {
                                        events.push(PlayerEvent::Spectrum(magnitudes));
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
        events
    }

    // ==========================================
    // METODY OBSŁUGI KOREKTORA GRAFICZNEGO (EQ)
    // ==========================================

    /// Zwraca aktualne wzmocnienia 10 pasm korektora graficznego (w dB).
    pub fn get_equalizer_bands(&self) -> [f64; 10] {
        let inner = self.inner.lock().unwrap();
        inner.equalizer_state.bands
    }

    /// Sprawdza, czy korektor graficzny jest włączony.
    pub fn is_equalizer_enabled(&self) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.equalizer_state.enabled
    }

    /// Włącza lub wyłącza korektor graficzny (bypass bez usuwania z potoku).
    pub fn set_equalizer_enabled(&self, enabled: bool) {
        let mut inner = self.inner.lock().unwrap();
        inner.equalizer_state.enabled = enabled;
        for i in 0..10 {
            let val = if enabled {
                inner.equalizer_state.bands[i]
            } else {
                0.0
            };
            inner.equalizer.set_property(&format!("band{}", i), val);
        }
    }

    /// Ustawia wzmocnienie pojedynczego pasma korektora graficznego (w dB: -24.0 do +12.0).
    pub fn set_equalizer_band(&self, band: usize, gain_db: f64) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        if inner.equalizer_state.set_band(band, gain_db) {
            let clamped = inner.equalizer_state.bands[band];
            if inner.equalizer_state.enabled {
                inner
                    .equalizer
                    .set_property(&format!("band{}", band), clamped);
            }
        }
        Ok(())
    }

    /// Ustawia wzmocnienia wszystkich 10 pasm korektora graficznego jednocześnie.
    pub fn set_equalizer_bands(&self, bands: &[f64; 10]) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        for (i, &gain) in bands.iter().enumerate() {
            inner.equalizer_state.set_band(i, gain);
            if inner.equalizer_state.enabled {
                inner
                    .equalizer
                    .set_property(&format!("band{}", i), inner.equalizer_state.bands[i]);
            }
        }
        Ok(())
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

    /// Ustawia lub dodaje bieżący aktywny utwór do kolejki.
    pub fn set_active_item(&self, item: QueueItem) {
        let mut q = self.queue.lock().unwrap();
        q.set_active_item(item);
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

    /// Pobiera kopię aktualnego utworu w kolejce odtwarzania.
    pub fn current_queue_item(&self) -> Option<QueueItem> {
        let q = self.queue.lock().unwrap();
        q.current_item().cloned()
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

    /// Przechodzi do następnego utworu w kolejce według trybów Loop i Shuffle,
    /// stosując płynne przejście z krzywą equal-power, jeśli włączony jest crossfade.
    pub fn play_next(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        let (crossfade_ms, user_vol, is_playing, volume) = {
            let inner = self.inner.lock().unwrap();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (
                inner.crossfade_duration_ms,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
            )
        };

        if is_playing && crossfade_ms > 0 && user_vol > 0.001 {
            let half_fade = Duration::from_millis(crossfade_ms.min(3000) / 2);
            let steps = 6;
            let step_time = half_fade / steps as u32;
            for i in (0..=steps).rev() {
                let t = (i as f64) / (steps as f64);
                let gain = (t * std::f64::consts::FRAC_PI_2).sin();
                volume.set_property("volume", user_vol * gain);
                std::thread::sleep(step_time);
            }
        }

        let next_item = {
            let mut q = self.queue.lock().unwrap();
            q.next().cloned()
        };

        match next_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                if crossfade_ms > 0 && user_vol > 0.001 {
                    self.play_with_fade_duration(Duration::from_millis(
                        crossfade_ms.min(3000) / 2,
                    ))?;
                } else {
                    self.play()?;
                }
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

        let (crossfade_ms, user_vol, is_playing, volume) = {
            let inner = self.inner.lock().unwrap();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (
                inner.crossfade_duration_ms,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
            )
        };

        if is_playing && crossfade_ms > 0 && user_vol > 0.001 {
            let half_fade = Duration::from_millis(crossfade_ms.min(3000) / 2);
            let steps = 6;
            let step_time = half_fade / steps as u32;
            for i in (0..=steps).rev() {
                let t = (i as f64) / (steps as f64);
                let gain = (t * std::f64::consts::FRAC_PI_2).sin();
                volume.set_property("volume", user_vol * gain);
                std::thread::sleep(step_time);
            }
        }

        let prev_item = {
            let mut q = self.queue.lock().unwrap();
            q.previous().cloned()
        };

        match prev_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                if crossfade_ms > 0 && user_vol > 0.001 {
                    self.play_with_fade_duration(Duration::from_millis(
                        crossfade_ms.min(3000) / 2,
                    ))?;
                } else {
                    self.play()?;
                }
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

    /// Konfiguruje normalizację głośności ReplayGain (EBU R128 / ReplayGain 2.0).
    pub fn set_replaygain(&self, config: ReplayGainConfig) -> Result<(), AudioEngineError> {
        self.replaygain_mode
            .store(config.mode as u8, Ordering::Relaxed);
        let mut inner = self.inner.lock().unwrap();
        inner.replaygain_config = config;
        match config.mode {
            ReplayGainMode::Off => {
                let target_gain: f64 = inner.rgvolume.property("target-gain");
                inner.rgvolume.set_property("pre-amp", -target_gain);
                inner.rglimiter.set_property("enabled", false);
            }
            ReplayGainMode::Track => {
                inner.rgvolume.set_property("album-mode", false);
                inner.rgvolume.set_property("pre-amp", config.pre_amp_db);
                inner
                    .rgvolume
                    .set_property("fallback-gain", config.fallback_gain_db);
                inner
                    .rglimiter
                    .set_property("enabled", config.prevent_clipping);
            }
            ReplayGainMode::Album => {
                inner.rgvolume.set_property("album-mode", true);
                inner.rgvolume.set_property("pre-amp", config.pre_amp_db);
                inner
                    .rgvolume
                    .set_property("fallback-gain", config.fallback_gain_db);
                inner
                    .rglimiter
                    .set_property("enabled", config.prevent_clipping);
            }
            ReplayGainMode::Auto => {
                inner.rgvolume.set_property("pre-amp", config.pre_amp_db);
                inner
                    .rgvolume
                    .set_property("fallback-gain", config.fallback_gain_db);
                inner
                    .rglimiter
                    .set_property("enabled", config.prevent_clipping);
            }
        }
        debug!(
            "Zaktualizowano ReplayGain: mode={:?}, pre_amp={:.1} dB, fallback={:.1} dB, limiter={}",
            config.mode, config.pre_amp_db, config.fallback_gain_db, config.prevent_clipping
        );
        Ok(())
    }

    /// Dynamicznie dostosowuje tryb ReplayGain w trybie Auto (Track vs Album Gain).
    pub fn apply_auto_replaygain(&self, is_same_album: bool, is_shuffle: bool) {
        let inner = self.inner.lock().unwrap();
        if inner.replaygain_config.mode == ReplayGainMode::Auto {
            let use_album_gain = is_same_album && !is_shuffle;
            inner.rgvolume.set_property("album-mode", use_album_gain);
            debug!(
                "ReplayGain Auto: ustawiono album-mode na {} (same_album={}, shuffle={})",
                use_album_gain, is_same_album, is_shuffle
            );
        }
    }

    /// Pobiera bieżącą konfigurację ReplayGain.
    pub fn replaygain_config(&self) -> ReplayGainConfig {
        self.inner.lock().unwrap().replaygain_config
    }

    /// Zwraca bieżący status normalizacji ReplayGain: (target_gain_db, result_gain_db, limiter_enabled).
    pub fn replaygain_status(&self) -> (f64, f64, bool) {
        let inner = self.inner.lock().unwrap();
        let target: f64 = inner.rgvolume.property("target-gain");
        let result: f64 = inner.rgvolume.property("result-gain");
        let limiter: bool = inner.rglimiter.property("enabled");
        (target, result, limiter)
    }

    /// Konfiguruje filtr Bauer stereophonic-to-binaural (Crossfeed bs2b) dla odsłuchu słuchawkowego.
    pub fn set_crossfeed(&self, config: CrossfeedConfig) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        inner.crossfeed_config = config;
        if let Some(ref bs) = inner.bs2b {
            bs.set_property("fcut", config.fcut_hz as i32);
            bs.set_property("feed", config.feed_tenth_db as i32);
            if let Ok(transform) = bs.clone().dynamic_cast::<gst_base::BaseTransform>() {
                transform.set_passthrough(!config.enabled);
            }
        }
        debug!(
            "Zaktualizowano Crossfeed: enabled={}, fcut={}Hz, feed={:.1}dB",
            config.enabled,
            config.fcut_hz,
            config.feed_db()
        );
        Ok(())
    }

    /// Pobiera bieżącą konfigurację Crossfeed.
    pub fn crossfeed_config(&self) -> CrossfeedConfig {
        self.inner.lock().unwrap().crossfeed_config
    }

    /// Konfiguruje automatyczne pomijanie ciszy (Silence Trimming / Auto-skip silence).
    pub fn set_silence_trimming(
        &self,
        config: SilenceTrimmingConfig,
    ) -> Result<(), AudioEngineError> {
        let clamped = config.clamped();
        let mut inner = self.inner.lock().unwrap();
        inner.silence_trimming_config = clamped;
        if let Some(ref c) = inner.cutter {
            c.set_property("leaky", clamped.enabled);
            c.set_property("threshold-dB", clamped.threshold_db);
        }
        debug!(
            "Zaktualizowano Silence Trimming: enabled={}, threshold={:.1}dB",
            clamped.enabled, clamped.threshold_db
        );
        Ok(())
    }

    /// Pobiera bieżącą konfigurację pomijania ciszy.
    pub fn silence_trimming_config(&self) -> SilenceTrimmingConfig {
        self.inner.lock().unwrap().silence_trimming_config
    }

    /// Wznawia odtwarzanie z płynnym wejściem głośności o zadanym czasie trwania wg krzywej equal-power.
    pub fn play_with_fade_duration(&self, duration: Duration) -> Result<(), AudioEngineError> {
        let (pipeline, volume, target_vol) = {
            let mut inner = self.inner.lock().unwrap();
            inner.volume.set_property("volume", 0.0f64);
            inner.state = PlaybackState::Playing;
            (
                inner.pipeline.clone(),
                inner.volume.clone(),
                inner.user_volume,
            )
        };

        // Zmiana stanu potoku poza blokadą mutexu inner
        pipeline.set_state(gst::State::Playing)?;

        if target_vol <= 0.001 || duration.is_zero() {
            volume.set_property("volume", target_vol);
            return Ok(());
        }

        let steps = 6;
        let step_time = duration / steps as u32;
        for i in 1..=steps {
            let t = (i as f64) / (steps as f64);
            let gain = (t * std::f64::consts::FRAC_PI_2).sin();
            volume.set_property("volume", target_vol * gain);
            std::thread::sleep(step_time);
        }

        Ok(())
    }

    /// Włącza lub wyłącza rozszerzanie bazy stereo (Stereo Widener).
    pub fn set_stereo_widener_active(&self, active: bool) {
        let mut inner = self.inner.lock().unwrap();
        inner.stereo_widener_active = active;
        if let Some(ref st) = inner.stereo_widener {
            st.set_property("active", active);
        }
    }

    /// Ustawia intensywność rozszerzania stereo w zakresie 0.0 - 1.0.
    pub fn set_stereo_widener_amount(&self, amount: f64) {
        let mut inner = self.inner.lock().unwrap();
        let clamped = amount.clamp(0.0, 1.0);
        inner.stereo_widener_amount = clamped;
        if let Some(ref st) = inner.stereo_widener {
            st.set_property("stereo", clamped as f32);
        }
    }

    /// Zwraca parametry rozszerzania stereo: (active, amount).
    pub fn stereo_widener_params(&self) -> (bool, f64) {
        let inner = self.inner.lock().unwrap();
        (inner.stereo_widener_active, inner.stereo_widener_amount)
    }

    /// Włącza lub wyłącza True-Peak Limiter (rglimiter).
    pub fn set_limiter_enabled(&self, enabled: bool) {
        let inner = self.inner.lock().unwrap();
        inner.rglimiter.set_property("enabled", enabled);
    }

    /// Sprawdza, czy True-Peak Limiter (rglimiter) jest włączony.
    pub fn is_limiter_enabled(&self) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.rglimiter.property("enabled")
    }

    /// Ustawia czas płynnego przejścia (crossfade) w milisekundach (0 - 8000 ms).
    pub fn set_crossfade_duration_ms(&self, duration_ms: u64) {
        let mut inner = self.inner.lock().unwrap();
        inner.crossfade_duration_ms = duration_ms.clamp(0, 8000);
    }

    /// Pobiera bieżący czas crossfade w milisekundach.
    pub fn crossfade_duration_ms(&self) -> u64 {
        let inner = self.inner.lock().unwrap();
        inner.crossfade_duration_ms
    }
}
