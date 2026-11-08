//! Główny potok odtwarzacza GStreamer z dynamicznym procesorem DSP.

use crate::error::AudioEngineError;
use domain::crossfeed::CrossfeedConfig;
use domain::dynamics::{DynamicsState, SaturatorConfig};
use domain::equalizer::EqualizerState;
use domain::parametric_eq::ParametricEqState;
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
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex, RwLock};
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
    TrackLooped,
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
    peq_preamp: gst::Element,
    peq_equalizer: gst::Element,
    compressor: gst::Element,
    compressor_makeup: gst::Element,
    _saturator: gst::Element,
    saturator_config: Arc<RwLock<SaturatorConfig>>,
    bs2b: Option<gst::Element>,
    cutter: Option<gst::Element>,
    rgvolume: gst::Element,
    rgvolume_child: Option<gst_base::BaseTransform>,
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
    parametric_eq_state: ParametricEqState,
    dynamics_state: DynamicsState,
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
    _stereo_widener: gst::Element,
    stereo_widener_config: Arc<RwLock<domain::dynamics::StereoWidenerConfig>>,
    crossfade_duration_ms: u64,
}

/// Bezpieczny wielowątkowo kontroler potoku audio.
#[derive(Clone)]
pub struct AudioEngine {
    inner: Arc<Mutex<PipelineInner>>,
    queue: Arc<Mutex<PlaybackQueue>>,
    replaygain_mode: Arc<AtomicU8>,
    stop_after_current: Arc<AtomicBool>,
    fade_generation: Arc<AtomicU64>,
    is_fading_in: Arc<AtomicBool>,
}

impl AudioEngine {
    /// Inicjalizuje GStreamer oraz tworzy bazowy potok odtwarzacza.
    pub fn new() -> Result<Self, AudioEngineError> {
        static GST_INIT_ONCE: std::sync::Once = std::sync::Once::new();
        GST_INIT_ONCE.call_once(|| {
            let _ = gst::init();
            let _ = gst::ElementFactory::make("equalizer-10bands").build();
            let _ = gst::ElementFactory::make("equalizer-nbands").build();
        });
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

        let peq_preamp = gst::ElementFactory::make("volume")
            .name("peq_preamp")
            .property("volume", 1.0f64)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        let peq_equalizer = gst::ElementFactory::make("equalizer-nbands")
            .name("peq_equalizer")
            .property("num-bands", 1u32)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("equalizer-nbands"))?;

        // Moduły Studia Dynamiki:
        // 1. Kompresor dynamiki (audiodynamic)
        let compressor = match gst::ElementFactory::make("audiodynamic")
            .name("compressor_dynamics")
            .property_from_str("mode", "compressor")
            .property_from_str("characteristics", "soft-knee")
            .property("ratio", 3.0f32)
            .property("threshold", 0.125f32)
            .build()
        {
            Ok(c) => {
                if let Ok(transform) = c.clone().dynamic_cast::<gst_base::BaseTransform>() {
                    transform.set_passthrough(true); // Domyślnie wyłączony (bypass)
                }
                c
            }
            Err(e) => {
                warn!("Brak elementu audiodynamic (gst-plugins-good): {:?}", e);
                return Err(AudioEngineError::MissingElement("audiodynamic"));
            }
        };

        // 2. Wzmocnienie wyrównawcze (makeup gain) kompresora
        let compressor_makeup = gst::ElementFactory::make("volume")
            .name("compressor_makeup")
            .property("volume", 1.0f64)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        // 3. Saturator analogowy (lampa elektronowa / taśma) z sondą bufora F32LE
        let saturator = gst::ElementFactory::make("identity")
            .name("analog_saturator")
            .property("silent", true)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("identity"))?;

        let saturator_config = Arc::new(RwLock::new(domain::dynamics::SaturatorConfig::default()));
        let sat_cfg_clone = Arc::clone(&saturator_config);

        if let Some(src_pad) = saturator.static_pad("src") {
            src_pad.add_probe(gst::PadProbeType::BUFFER, move |_pad, info| {
                if let Some(gst::PadProbeData::Buffer(ref mut buffer)) = info.data {
                    let config = if let Ok(guard) = sat_cfg_clone.read() {
                        *guard
                    } else {
                        return gst::PadProbeReturn::Ok;
                    };

                    if !config.enabled || config.mode == domain::dynamics::SaturatorMode::Off {
                        return gst::PadProbeReturn::Ok;
                    }

                    let buffer_mut = buffer.make_mut();
                    if let Ok(mut map) = buffer_mut.map_writable() {
                        let slice = map.as_mut_slice();
                        let f32_count = slice.len() / std::mem::size_of::<f32>();
                        if f32_count > 0 {
                            let f32_slice = unsafe {
                                std::slice::from_raw_parts_mut(
                                    slice.as_mut_ptr() as *mut f32,
                                    f32_count,
                                )
                            };
                            for s in f32_slice.iter_mut() {
                                *s = config.process_sample(*s);
                            }
                        }
                    }
                }
                gst::PadProbeReturn::Ok
            });
        }

        // 4. Stereo Widener (baza stereo / Stereo Stage) z natywną sondą bufora F32LE (Mid-Side Matrix)
        let stereo_widener = gst::ElementFactory::make("identity")
            .name("stereo_widener")
            .property("silent", true)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("identity"))?;

        let stereo_widener_config =
            Arc::new(RwLock::new(domain::dynamics::StereoWidenerConfig::default()));
        let widener_cfg_clone = Arc::clone(&stereo_widener_config);

        if let Some(src_pad) = stereo_widener.static_pad("src") {
            src_pad.add_probe(gst::PadProbeType::BUFFER, move |_pad, info| {
                if let Some(gst::PadProbeData::Buffer(ref mut buffer)) = info.data {
                    let config = if let Ok(guard) = widener_cfg_clone.read() {
                        *guard
                    } else {
                        return gst::PadProbeReturn::Ok;
                    };

                    if !config.enabled || config.width <= 0.0 {
                        return gst::PadProbeReturn::Ok;
                    }

                    // Bezpieczna weryfikacja: Stereo Widener przetwarza wyłącznie 2-kanałowy strumień stereo
                    if let Some(caps) = _pad.current_caps() {
                        if let Some(s) = caps.structure(0) {
                            if let Ok(channels) = s.get::<i32>("channels") {
                                if channels != 2 {
                                    return gst::PadProbeReturn::Ok;
                                }
                            }
                        }
                    }

                    let buffer_mut = buffer.make_mut();
                    if let Ok(mut map) = buffer_mut.map_writable() {
                        let slice = map.as_mut_slice();
                        let f32_count = slice.len() / std::mem::size_of::<f32>();
                        if f32_count >= 2 {
                            let f32_slice = unsafe {
                                std::slice::from_raw_parts_mut(
                                    slice.as_mut_ptr() as *mut f32,
                                    f32_count,
                                )
                            };

                            for frame in f32_slice.as_chunks_mut::<2>().0 {
                                let (l, r) = config.process_frame(frame[0], frame[1]);
                                frame[0] = l;
                                frame[1] = r;
                            }
                        }
                    }
                }
                gst::PadProbeReturn::Ok
            });
        }

        let spectrum = gst::ElementFactory::make("spectrum")
            .name("spectrum_analyzer")
            .property("bands", 64u32)
            .property("threshold", -75i32)
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

        // Bufor kolejki przed sinkiem: 600ms — zapewnia całkowitą odporność
        // na zacięcia (stuttering/xruny) i I/O jitter przy odtwarzaniu z dysków zewnętrznych (USB)
        // oraz przy dekodowaniu gęstych plików FLAC i intensywnym DSP.
        let queue_sink = gst::ElementFactory::make("queue")
            .name("queue_sink")
            .property("max-size-time", 600_000_000u64)
            .property("max-size-buffers", 0u32)
            .property("max-size-bytes", 0u32)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("queue"))?;

        // Preferencja: pipewiresink z processing-deadline 100ms (domyślnie slave-method=none),
        // co eliminuje underruny w sesji PipeWire i sztuczne resamplingi zegara GStreamera.
        let sink = match gst::ElementFactory::make("pipewiresink")
            .name("sink")
            .property("processing-deadline", 100_000_000u64)
            .build()
        {
            Ok(pw_sink) => {
                info!("Zainicjalizowano wyjście PipeWire (100ms deadline, slave-method: none)");
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

        let rgvolume_child = rgvolume
            .clone()
            .dynamic_cast::<gst::Bin>()
            .ok()
            .and_then(|bin| bin.by_name("rgvolume-volume"))
            .and_then(|elem| elem.dynamic_cast::<gst_base::BaseTransform>().ok());

        // Domyślnie ReplayGain jest wyłączony (Off) - ustawiamy passthrough, aby strumień audio przechodził bez żadnych modyfikacji
        if let Some(ref child) = rgvolume_child {
            child.set_passthrough(true);
        }

        let rglimiter = gst::ElementFactory::make("rglimiter")
            .name("rglimiter")
            .property("enabled", false)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("rglimiter"))?;

        let audioconvert_sink = gst::ElementFactory::make("audioconvert")
            .name("audioconvert_sink")
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
            &peq_preamp,
            &peq_equalizer,
            &compressor,
            &compressor_makeup,
            &saturator,
            &stereo_widener,
            &queue_sink,
            &audioconvert_out,
            &rgvolume,
            &rglimiter,
            &volume,
            &spectrum,
            &audioconvert_sink,
            &sink,
        ])?;

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

        // equalizer -> peq_preamp -> peq_equalizer
        equalizer.link(&peq_preamp).map_err(|_| {
            AudioEngineError::ElementLink("Błąd linkowania equalizer z peq_preamp".into())
        })?;
        peq_preamp.link(&peq_equalizer).map_err(|_| {
            AudioEngineError::ElementLink("Błąd linkowania peq_preamp z peq_equalizer".into())
        })?;

        // peq_equalizer -> compressor -> compressor_makeup -> saturator
        peq_equalizer.link(&compressor).map_err(|_| {
            AudioEngineError::ElementLink("Błąd linkowania peq_equalizer z compressor".into())
        })?;
        compressor.link(&compressor_makeup).map_err(|_| {
            AudioEngineError::ElementLink("Błąd linkowania compressor z compressor_makeup".into())
        })?;
        compressor_makeup.link(&saturator).map_err(|_| {
            AudioEngineError::ElementLink("Błąd linkowania compressor_makeup z saturator".into())
        })?;
        saturator.link(&stereo_widener).map_err(|_| {
            AudioEngineError::ElementLink("Błąd linkowania saturator ze stereo_widener".into())
        })?;

        // stereo_widener -> (bs2b) -> queue_sink
        if let Some(ref bs) = bs2b {
            stereo_widener.link(bs).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania stereo_widener z bs2b".into())
            })?;
            bs.link(&queue_sink).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania bs2b z queue_sink".into())
            })?;
        } else {
            stereo_widener.link(&queue_sink).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania stereo_widener z queue_sink".into())
            })?;
        }

        // queue_sink -> audioconvert_out -> (cutter -> audioconvert_cutter) -> rgvolume -> rglimiter -> spectrum -> volume -> audioconvert_sink -> sink
        let mut out_chain: Vec<&gst::Element> = Vec::new();
        out_chain.push(&queue_sink);
        out_chain.push(&audioconvert_out);
        if let Some(ref ct) = cutter {
            out_chain.push(ct);
            out_chain.push(&audioconvert_cutter);
        }
        out_chain.push(&rgvolume);
        out_chain.push(&rglimiter);
        out_chain.push(&spectrum);
        out_chain.push(&volume);
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
            peq_preamp,
            peq_equalizer,
            compressor,
            compressor_makeup,
            _saturator: saturator,
            saturator_config,
            bs2b,
            cutter,
            rgvolume: rgvolume.clone(),
            rgvolume_child,
            rglimiter,
            _spectrum: spectrum,
            volume,
            queue_sink: queue_sink.clone(),
            sink,
            audio_buffer_ms: 600,
            dsp_block_size: 2048,
            state: PlaybackState::Stopped,
            dsp_params: DspParams::default(),
            last_active_dsp: None,
            equalizer_state: EqualizerState::default(),
            parametric_eq_state: ParametricEqState::default(),
            dynamics_state: domain::dynamics::DynamicsState::default(),
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
            _stereo_widener: stereo_widener,
            stereo_widener_config,
            crossfade_duration_ms: 1500,
        }));

        let replaygain_mode = Arc::new(AtomicU8::new(ReplayGainMode::Off as u8));

        let queue = Arc::new(Mutex::new(PlaybackQueue::new()));
        let stop_after_current = Arc::new(AtomicBool::new(false));
        let fade_generation = Arc::new(AtomicU64::new(0));
        let is_fading_in = Arc::new(AtomicBool::new(false));
        Ok(Self {
            inner,
            queue,
            replaygain_mode,
            stop_after_current,
            fade_generation,
            is_fading_in,
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

        // Zatrzymanie potoku przed przebudową wejścia (State::Null całkowicie resetuje EOS na zlewkach audio PipeWire)
        let _ = inner.pipeline.set_state(gst::State::Null);
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

        // Bezpieczna synchronizacja stanu nowego elementu z potokiem
        if let Err(err) = uri_decoder.sync_state_with_parent() {
            debug!(
                "sync_state_with_parent informacja (normalne przy State::Null): {:?}",
                err
            );
        }
        inner.uri_decoder = Some(uri_decoder);
        inner.current_uri = Some(uri.to_string());
        inner.state = PlaybackState::Stopped;

        info!("Załadowano URI: {}", uri);
        Ok(())
    }

    /// Rozpoczyna lub wznawia odtwarzanie.
    pub fn play(&self) -> Result<(), AudioEngineError> {
        let uri_to_load = {
            let inner = self.inner.lock().unwrap();
            if inner.current_uri.is_none() {
                self.queue
                    .lock()
                    .unwrap()
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
            let mut inner = self.inner.lock().unwrap();
            if inner.current_uri.is_none() {
                debug!("Brak załadowanego pliku lub aktywnego utworu w kolejce — pomijam play");
                return Ok(());
            }
            inner.state = PlaybackState::Playing;
            inner.volume.set_property("volume", inner.user_volume);
            (
                inner.pipeline.clone(),
                inner.volume.clone(),
                inner.user_volume,
            )
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
            let inner = self.inner.lock().unwrap();
            if inner.current_uri.is_none() {
                self.queue
                    .lock()
                    .unwrap()
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
            let mut inner = self.inner.lock().unwrap();
            if inner.current_uri.is_none() {
                debug!("Brak załadowanego pliku lub aktywnego utworu w kolejce — pomijam play_with_fade");
                return Ok(());
            }
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
        volume.set_property("volume", target_vol);

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
        pipeline.set_state(gst::State::Null)?;
        debug!("Stan potoku zmieniony na Stopped (Null)");
        Ok(())
    }

    /// Przewija do zadanej pozycji w czasie (natychmiastowy skok).
    pub fn seek(&self, position: Duration) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
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
        self.fade_generation.fetch_add(1, Ordering::SeqCst);
        self.is_fading_in.store(false, Ordering::SeqCst);
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
    /// Domyślnie: 600 ms (dostępne wartości: 50 ms - 4000 ms).
    pub fn set_audio_buffer_duration_ms(&self, buffer_ms: u64) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        let clamped = buffer_ms.clamp(50, 4000);
        inner.audio_buffer_ms = clamped;
        let time_ns = clamped * 1_000_000u64;
        inner.queue_sink.set_property("max-size-time", time_ns);
        if inner.sink.find_property("processing-deadline").is_some() {
            let deadline_ns = (clamped / 4).clamp(20, 250) * 1_000_000u64;
            inner.sink.set_property("processing-deadline", deadline_ns);
        }
        info!(
            "Zaktualizowano bufor wyjściowy audio na {} ms (processing-deadline: {} ms)",
            clamped,
            (clamped / 4).clamp(20, 250)
        );
        Ok(())
    }

    /// Pobiera aktualny rozmiar bufora wyjściowego audio w milisekundach (domyślnie 600 ms).
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

                        // Sprawdź flagę "Stop After Current Track" (foobar2000 classic)
                        let stop_after_current =
                            self.stop_after_current.swap(false, Ordering::SeqCst);
                        if stop_after_current {
                            info!("'Stop After Current Track' aktywny — zatrzymuję potok audio i nie przechodzę do kolejnego utworu");
                            let old_state = {
                                let mut inner = self.inner.lock().unwrap();
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
                                info!("LoopMode::Track (global) — przeładowuję i powtarzam utwór od nowa: {}", uri);
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
                                } else {
                                    events.push(PlayerEvent::TrackLooped);
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
                                    "LoopMode::Queue (pojedynczy utwór) — przeładowuję i powtarzam utwór od nowa: {}",
                                    uri
                                );
                                if let Err(load_err) = self.load_uri(&uri) {
                                    error!("Błąd ładowania URI: {}", load_err);
                                    let mut inner = self.inner.lock().unwrap();
                                    inner.state = PlaybackState::Stopped;
                                } else if let Err(play_err) = self.play() {
                                    error!("Błąd odtwarzania: {}", play_err);
                                    let mut inner = self.inner.lock().unwrap();
                                    inner.state = PlaybackState::Stopped;
                                } else {
                                    events.push(PlayerEvent::TrackLooped);
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
                            let next_item = {
                                let mut q = self.queue.lock().unwrap();
                                q.next().cloned()
                            };
                            match next_item {
                                Some(item) => {
                                    if let Err(e) = self.load_uri(&item.uri) {
                                        error!("Błąd ładowania następnego utworu po EOS: {}", e);
                                    } else {
                                        let (crossfade_ms, user_vol) = {
                                            let inner = self.inner.lock().unwrap();
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
                                                // Obsługa kanałów stereo/wielokanałowych
                                                let sub_mags: Vec<f32> = sub_list
                                                    .as_slice()
                                                    .iter()
                                                    .filter_map(extract_floats)
                                                    .collect();
                                                if raw_db.is_empty() {
                                                    raw_db = sub_mags;
                                                } else {
                                                    for (idx, &s) in sub_mags.iter().enumerate() {
                                                        if idx < raw_db.len() {
                                                            raw_db[idx] = raw_db[idx].max(s);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } else if let Ok(arr) = val.get::<gst::ArrayRef>() {
                                        raw_db = arr
                                            .as_slice()
                                            .iter()
                                            .filter_map(extract_floats)
                                            .collect();
                                    }

                                    if !raw_db.is_empty() {
                                        // Normalizacja decybeli (-75 dBFS..0 dBFS -> 0.0..1.0)
                                        let normalized: Vec<f32> = raw_db
                                            .iter()
                                            .map(|&db| ((db + 75.0) / 75.0).clamp(0.0, 1.0))
                                            .collect();

                                        let display_bands = if normalized.len() >= 64 {
                                            log_pool_to_16_bands(&normalized)
                                        } else {
                                            normalized
                                        };

                                        events.push(PlayerEvent::Spectrum(display_bands));
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
                let q = self.queue.lock().unwrap();
                q.loop_mode == LoopMode::Track
            };

            if !is_track_loop {
                let (is_playing, crossfade_ms, user_vol, volume) = {
                    let inner = self.inner.lock().unwrap();
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
    // METODY OBSŁUGI KOREKTORA PARAMETRYCZNEGO (PEQ)
    // ==========================================

    /// Zwraca aktualny stan korektora parametrycznego.
    pub fn get_parametric_eq_state(&self) -> ParametricEqState {
        let inner = self.inner.lock().unwrap();
        inner.parametric_eq_state.clone()
    }

    /// Sprawdza, czy korektor parametryczny jest włączony.
    pub fn is_parametric_eq_enabled(&self) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.parametric_eq_state.enabled
    }

    /// Ustawia i aplikuje kompletny stan korektora parametrycznego (pasma, preamp, bypass).
    pub fn set_parametric_eq_state(
        &self,
        state: &ParametricEqState,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        inner.parametric_eq_state = state.clone();

        let enabled = state.enabled;

        // 1. Preamp: linear = 10^(preamp_db / 20.0)
        let linear_preamp = if enabled {
            10.0f64.powf(
                state
                    .preamp_db
                    .clamp(domain::MIN_PREAMP_DB, domain::MAX_PREAMP_DB)
                    / 20.0,
            )
        } else {
            1.0
        };
        inner.peq_preamp.set_property("volume", linear_preamp);

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

        Ok(())
    }

    /// Włącza lub wyłącza korektor parametryczny (bypass).
    pub fn set_parametric_eq_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = {
            let inner = self.inner.lock().unwrap();
            inner.parametric_eq_state.clone()
        };
        state.enabled = enabled;
        self.set_parametric_eq_state(&state)
    }

    /// Ustawia wzmocnienie przedwzmacniacza PEQ (preamp) w dB.
    pub fn set_parametric_eq_preamp(&self, preamp_db: f64) -> Result<(), AudioEngineError> {
        let mut state = {
            let inner = self.inner.lock().unwrap();
            inner.parametric_eq_state.clone()
        };
        state.preamp_db = preamp_db;
        self.set_parametric_eq_state(&state)
    }

    // ==========================================
    // METODY OBSŁUGI STUDIA DYNAMIKI (COMPRESSOR, SATURATOR, LIMITER)
    // ==========================================

    /// Pobiera bieżący stan Studia Dynamiki (kompresor, saturator, limiter).
    pub fn get_dynamics_state(&self) -> domain::dynamics::DynamicsState {
        let inner = self.inner.lock().unwrap();
        inner.dynamics_state
    }

    pub fn is_compressor_enabled(&self) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.dynamics_state.compressor.enabled
    }

    pub fn is_saturator_enabled(&self) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.dynamics_state.saturator.enabled
    }

    /// Aplikuje kompletny stan Studia Dynamiki w locie bez trzasków i przerw.
    pub fn set_dynamics_state(
        &self,
        state: &domain::dynamics::DynamicsState,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock().unwrap();
        inner.dynamics_state = *state;

        // 1. Kompresor dynamiki
        let comp = state.compressor.clamped();
        inner.compressor.set_property("ratio", comp.ratio);
        inner
            .compressor
            .set_property("threshold", comp.linear_threshold());
        inner.compressor.set_property_from_str(
            "characteristics",
            if comp.soft_knee {
                "soft-knee"
            } else {
                "hard-knee"
            },
        );
        if let Ok(transform) = inner
            .compressor
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(!comp.enabled);
        }

        // Makeup gain
        let makeup_vol = if comp.enabled {
            comp.linear_makeup_gain()
        } else {
            1.0f64
        };
        inner.compressor_makeup.set_property("volume", makeup_vol);

        // 2. Saturator analogowy
        if let Ok(mut guard) = inner.saturator_config.write() {
            *guard = state.saturator.clamped();
        }

        // 3. Limiter słuchawkowy (rglimiter)
        inner
            .rglimiter
            .set_property("enabled", state.limiter.enabled);

        Ok(())
    }

    pub fn set_compressor_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = self.get_dynamics_state();
        state.compressor.enabled = enabled;
        self.set_dynamics_state(&state)
    }

    pub fn set_saturator_enabled(&self, enabled: bool) -> Result<(), AudioEngineError> {
        let mut state = self.get_dynamics_state();
        state.saturator.enabled = enabled;
        self.set_dynamics_state(&state)
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
        let (_crossfade_ms, user_vol, is_playing, volume) = {
            let inner = self.inner.lock().unwrap();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (
                inner.crossfade_duration_ms,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
            )
        };

        let active_item = {
            let mut q = self.queue.lock().unwrap();
            q.set_items(items, start_index);
            q.current_item().cloned()
        };

        if let Some(item) = &active_item {
            if is_playing && user_vol > 0.001 {
                let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
                Self::fade_out_equal_power(
                    &volume,
                    user_vol,
                    Duration::from_millis(20),
                    &self.fade_generation,
                    gen,
                );
            }
            self.load_uri(&item.uri)?;
            self.play_with_fade(true)?;
        }
        Ok(active_item)
    }

    /// Przywraca elementy i indeks kolejki bez natychmiastowego ładowania i odtwarzania przez GStreamer (bezpieczny start aplikacji).
    pub fn restore_queue(&self, items: Vec<QueueItem>, current_index: Option<usize>) {
        let mut q = self.queue.lock().unwrap();
        q.set_items(items, current_index);
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
        let (item, user_vol, is_playing, volume, is_same_track) = {
            let mut q = self.queue.lock().unwrap();
            let inner = self.inner.lock().unwrap();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            let current_uri = inner.current_uri.clone();
            let item = if index < q.items.len() {
                q.current_index = Some(index);
                if q.shuffle && !q.shuffle_order.is_empty() {
                    if let Some(pos) = q.shuffle_order.iter().position(|&x| x == index) {
                        q.shuffle_cursor = pos;
                    }
                }
                q.current_item().cloned()
            } else {
                None
            };
            let is_same = match (&item, &current_uri) {
                (Some(it), Some(cur)) => &it.uri == cur,
                _ => false,
            };
            (
                item,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
                is_same,
            )
        };

        if let Some(item) = &item {
            if is_same_track {
                if is_playing {
                    // Ten sam utwór i już gra — przewijamy do początku i upewniamy się, że głośność jest nominalna
                    self.seek(Duration::ZERO)?;
                    volume.set_property("volume", user_vol);
                } else {
                    self.play_with_fade(true)?;
                }
            } else {
                if is_playing && user_vol > 0.001 {
                    // Szybki anti-pop ramp (20 ms) przy bezpośrednim kliknięciu utworu w kolejce:
                    // eliminuje trzaski DAC bez wprowadzania opóźnień ani zamrażania UI (zero-freeze).
                    let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
                    Self::fade_out_equal_power(
                        &volume,
                        user_vol,
                        Duration::from_millis(20),
                        &self.fade_generation,
                        gen,
                    );
                }
                self.load_uri(&item.uri)?;
                self.play_with_fade(true)?;
            }
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
            let fade_out_ms = (crossfade_ms / 8).clamp(30, 150);
            let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
            Self::fade_out_equal_power(
                &volume,
                user_vol,
                Duration::from_millis(fade_out_ms),
                &self.fade_generation,
                gen,
            );
        }

        let next_item = {
            let mut q = self.queue.lock().unwrap();
            q.next().cloned()
        };

        match next_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                if crossfade_ms > 0 && user_vol > 0.001 {
                    let fade_in_ms = crossfade_ms / 2;
                    self.play_with_fade_duration(Duration::from_millis(fade_in_ms))?;
                } else {
                    self.play_with_fade(true)?;
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
            let fade_out_ms = (crossfade_ms / 8).clamp(30, 150);
            let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
            Self::fade_out_equal_power(
                &volume,
                user_vol,
                Duration::from_millis(fade_out_ms),
                &self.fade_generation,
                gen,
            );
        }

        let prev_item = {
            let mut q = self.queue.lock().unwrap();
            q.previous().cloned()
        };

        match prev_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                if crossfade_ms > 0 && user_vol > 0.001 {
                    let fade_in_ms = crossfade_ms / 2;
                    self.play_with_fade_duration(Duration::from_millis(fade_in_ms))?;
                } else {
                    self.play_with_fade(true)?;
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

    /// Włącza lub wyłącza tryb "Stop After Current Track" (zatrzymanie po zakończeniu bieżącego utworu).
    pub fn set_stop_after_current(&self, enabled: bool) {
        self.stop_after_current.store(enabled, Ordering::SeqCst);
    }

    /// Pobiera aktualny stan flagi "Stop After Current Track".
    pub fn stop_after_current(&self) -> bool {
        self.stop_after_current.load(Ordering::SeqCst)
    }

    /// Konfiguruje normalizację głośności ReplayGain (EBU R128 / ReplayGain 2.0).
    pub fn set_replaygain(&self, config: ReplayGainConfig) -> Result<(), AudioEngineError> {
        self.replaygain_mode
            .store(config.mode as u8, Ordering::Relaxed);
        let mut inner = self.inner.lock().unwrap();
        inner.replaygain_config = config;
        match config.mode {
            ReplayGainMode::Off => {
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(true);
                }
                inner.rgvolume.set_property("pre-amp", 0.0f64);
                inner.rgvolume.set_property("fallback-gain", 0.0f64);
                inner.rglimiter.set_property("enabled", false);
            }
            ReplayGainMode::Track => {
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(false);
                }
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
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(false);
                }
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
                if let Some(ref child) = inner.rgvolume_child {
                    child.set_passthrough(false);
                }
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
        if inner.replaygain_config.mode == ReplayGainMode::Off {
            return (0.0, 0.0, false);
        }
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

    /// Wykonuje płynne wyciszenie (fade-out) głośności z krzywą equal-power (cosinusową).
    fn fade_out_equal_power(
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
    fn fade_in_equal_power(
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
            let mut inner = self.inner.lock().unwrap();
            if inner.current_uri.is_none() {
                debug!("Brak załadowanego pliku lub aktywnego utworu w kolejce — pomijam play_with_fade");
                return Ok(());
            }
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

    /// Włącza lub wyłącza rozszerzanie bazy stereo (Stereo Widener).
    pub fn set_stereo_widener_active(&self, active: bool) {
        let config = {
            let inner = self.inner.lock().unwrap();
            Arc::clone(&inner.stereo_widener_config)
        };
        if let Ok(mut cfg) = config.write() {
            cfg.enabled = active;
        };
    }

    /// Ustawia intensywność rozszerzania stereo w zakresie 0.0 - 1.0.
    pub fn set_stereo_widener_amount(&self, amount: f64) {
        let config = {
            let inner = self.inner.lock().unwrap();
            Arc::clone(&inner.stereo_widener_config)
        };
        let clamped = amount.clamp(0.0, 1.0) as f32;
        if let Ok(mut cfg) = config.write() {
            cfg.width = clamped;
        };
    }

    /// Zwraca parametry rozszerzania stereo: (active, amount).
    pub fn stereo_widener_params(&self) -> (bool, f64) {
        let config = {
            let inner = self.inner.lock().unwrap();
            Arc::clone(&inner.stereo_widener_config)
        };
        let res = if let Ok(cfg) = config.read() {
            (cfg.enabled, cfg.width as f64)
        } else {
            (false, 0.15)
        };
        res
    }

    /// Włącza lub wyłącza True-Peak Limiter (rglimiter) oraz synchronizuje stan Studia Dynamiki.
    pub fn set_limiter_enabled(&self, enabled: bool) {
        let mut inner = self.inner.lock().unwrap();
        inner.dynamics_state.limiter.enabled = enabled;
        inner.rglimiter.set_property("enabled", enabled);
    }

    /// Sprawdza, czy True-Peak Limiter (rglimiter) jest włączony.
    pub fn is_limiter_enabled(&self) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.dynamics_state.limiter.enabled
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

/// Bezpieczne czyszczenie zasobów GStreamer przy zwolnieniu kontrolera potoku.
impl Drop for PipelineInner {
    fn drop(&mut self) {
        let _ = self.pipeline.set_state(gst::State::Null);
    }
}

/// Logarytmiczne grupowanie 64 liniowych pasm FFT na 16 percepcyjnych pasm widma.
/// Zapewnia równomierną i czułą dynamikę od sub-basu (30-60 Hz) do najwyższych tonów (16-20 kHz).
fn log_pool_to_16_bands(raw: &[f32]) -> Vec<f32> {
    if raw.len() < 16 {
        return raw.to_vec();
    }
    let bin_ranges: [(usize, usize); 16] = [
        (0, 1),   // 0: Sub-bass (~0 - 344 Hz)
        (1, 2),   // 1: Bass (~344 - 688 Hz)
        (2, 3),   // 2: Low Mids (~688 - 1032 Hz)
        (3, 4),   // 3: Midrange (~1032 - 1376 Hz)
        (4, 5),   // 4: Midrange (~1376 - 1720 Hz)
        (5, 6),   // 5: Upper Mids (~1720 - 2064 Hz)
        (6, 7),   // 6: Upper Mids (~2064 - 2408 Hz)
        (7, 8),   // 7: Presence low (~2408 - 2752 Hz)
        (8, 10),  // 8: Presence (~2752 - 3440 Hz)
        (10, 12), // 9: Presence high (~3440 - 4128 Hz)
        (12, 15), // 10: Brilliance low (~4128 - 5160 Hz)
        (15, 19), // 11: Brilliance mid (~5160 - 6536 Hz)
        (19, 24), // 12: Brilliance high (~6536 - 8260 Hz)
        (24, 32), // 13: Treble (~8260 - 11000 Hz)
        (32, 44), // 14: High Treble (~11000 - 15100 Hz)
        (44, 64), // 15: Air (~15100 - 22050 Hz)
    ];

    let mut out = Vec::with_capacity(16);
    for (start, end) in bin_ranges {
        let s = start.min(raw.len());
        let e = end.min(raw.len()).max(s + 1);
        let slice = &raw[s..e];
        let max_val = slice.iter().copied().fold(0.0f32, f32::max);
        let avg_val = slice.iter().sum::<f32>() / slice.len() as f32;
        out.push((max_val * 0.7 + avg_val * 0.3).clamp(0.0, 1.0));
    }
    out
}
