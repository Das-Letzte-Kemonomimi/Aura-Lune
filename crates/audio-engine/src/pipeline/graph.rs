//! Budowa grafu potoku GStreamera (`AudioEngine::new`): elementy, sondy efektów i połączenia.

use super::*;

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

        // Bufor wejściowy audio (decoupler dekodowania od DSP)
        let queue_in = gst::ElementFactory::make("queue")
            .name("queue_in")
            .property("max-size-time", 500_000_000u64)
            .property("max-size-buffers", 0u32)
            .property("max-size-bytes", 0u32)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("queue"))?;

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
        if let Ok(transform) = equalizer.clone().dynamic_cast::<gst_base::BaseTransform>() {
            transform.set_passthrough(true); // Domyślnie wyłączony (Bypass bit-perfect)
        }

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
        if let Ok(transform) = peq_equalizer
            .clone()
            .dynamic_cast::<gst_base::BaseTransform>()
        {
            transform.set_passthrough(true); // Domyślnie wyłączony (Bypass bit-perfect)
        }

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

        // 3–4. Saturator analogowy i Stereo Widener — elementy `identity` z sondami F32LE
        //      (kod wątku strumieniowego w `probes.rs`).
        let (saturator, saturator_config) = super::probes::build_saturator()?;
        let (stereo_widener, stereo_widener_config) = super::probes::build_stereo_widener()?;

        let spectrum = gst::ElementFactory::make("spectrum")
            .name("spectrum_analyzer")
            .property("bands", 64u32)
            .property("threshold", -75i32)
            .property("interval", 33_333_333u64)
            .property("message-magnitude", true)
            .property("post-messages", true)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("spectrum"))?;

        let volume = gst::ElementFactory::make("volume")
            .name("volume")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        // Bufor kolejki wyjściowej audio: 600ms bez sztucznego min-threshold (0 = wyłączony),
        // co eliminuje mikro-przycięcia i zatory czasowe przed zlewem wyjściowym.
        let queue_sink = gst::ElementFactory::make("queue")
            .name("queue_sink")
            .property("max-size-time", 600_000_000u64)
            .property("min-threshold-time", 0u64)
            .property("max-size-buffers", 0u32)
            .property("max-size-bytes", 0u32)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("queue"))?;

        let audioresample_sink = gst::ElementFactory::make("audioresample")
            .name("audioresample_sink")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioresample"))?;

        // Preferencja wyjścia audio:
        // 1. pulsesink: łączy się z demonem pipewire-pulse / PulseAudio.
        //    Posiada dojrzały mechanizm ring-bufora sprzętowego (GstAudioBaseSink) z konfigurowalnym
        //    buffer-time (200ms) i latency-time (10ms). Gwarantuje absolutnie beztrzaskowe odtwarzanie
        //    na zewnętrznych przetwornikach USB (np. Focusrite Scarlett Solo).
        // 2. pipewiresink: bezpośredni fallback dla natywnego PipeWire.
        // 3. autoaudiosink: ogólny fallback systemowy GStreamera.
        let sink = if let Ok(pulse) = gst::ElementFactory::make("pulsesink")
            .name("sink")
            .property("client-name", "Auralune")
            .property("buffer-time", 200_000i64)
            .property("latency-time", 10_000i64)
            .property("provide-clock", true)
            .build()
        {
            let stream_props = gst::Structure::builder("application-properties")
                .field("media.role", "music")
                .build();
            pulse.set_property("stream-properties", &stream_props);
            info!("Zainicjalizowano wyjście PulseAudio / PipeWire-Pulse (200ms buffer-time, 10ms latency)");
            pulse
        } else {
            let pw_stream_props = gst::Structure::builder("pipewire-stream-properties")
                .field("media.type", "Audio")
                .field("media.category", "Playback")
                .field("media.role", "Music")
                .field("node.name", "Auralune")
                .field("node.description", "Auralune Music Player")
                .field("application.name", "Auralune")
                .build();

            match gst::ElementFactory::make("pipewiresink")
                .name("sink")
                .property("stream-properties", &pw_stream_props)
                .build()
            {
                Ok(pw_sink) => {
                    info!("Zainicjalizowano wyjście PipeWire (role: Music)");
                    pw_sink
                }
                Err(_) => {
                    warn!("Brak pulsesink i pipewiresink, używam fallbacku autoaudiosink");
                    gst::ElementFactory::make("autoaudiosink")
                        .name("sink")
                        .build()
                        .map_err(|_| AudioEngineError::MissingElement("autoaudiosink"))?
                }
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

        // Dodanie statycznych elementów do potoku wejściowego i DSP
        pipeline.add_many([
            &queue_in,
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

        pipeline.add_many([
            &equalizer,
            &peq_preamp,
            &peq_equalizer,
            &compressor,
            &compressor_makeup,
            &saturator,
            &stereo_widener,
            &rgvolume,
            &rglimiter,
            &spectrum,
            &volume,
            &queue_sink,
            &audioconvert_sink,
            &audioresample_sink,
            &sink,
        ])?;

        if let Some(ref bs) = bs2b {
            pipeline.add(bs)?;
        }

        // Połączenie elementów przetwarzania audio:
        // queue_in -> audioconvert_in -> audioresample -> capsfilter_dsp -> dsp
        gst::Element::link_many([
            &queue_in,
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

        // stereo_widener -> (bs2b) -> rgvolume
        if let Some(ref bs) = bs2b {
            stereo_widener.link(bs).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania stereo_widener z bs2b".into())
            })?;
            bs.link(&rgvolume).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania bs2b z rgvolume".into())
            })?;
        } else {
            stereo_widener.link(&rgvolume).map_err(|_| {
                AudioEngineError::ElementLink("Błąd linkowania stereo_widener z rgvolume".into())
            })?;
        }

        // rgvolume -> rglimiter -> spectrum -> audioconvert_sink -> audioresample_sink -> queue_sink -> volume -> sink
        // Umieszczenie volume bezpośrednio przed zlewem (po queue_sink) gwarantuje zerowe opóźnienie
        // bufora przy zmianie głośności suwakiem (natychmiastowa reakcja sprzętowa bez opóźnienia bufora kolejki).
        gst::Element::link_many([
            &rgvolume,
            &rglimiter,
            &spectrum,
            &audioconvert_sink,
            &audioresample_sink,
            &queue_sink,
            &volume,
            &sink,
        ])
        .map_err(|_| {
            AudioEngineError::ElementLink(
                "Nie udało się połączyć wyjściowego łańcucha audio ze spectrum, kolejką, volume i zlewem".into(),
            )
        })?;

        let volume_element = volume.clone();
        let atomic_volume = Arc::new(AtomicU64::new(1.0f64.to_bits()));

        let inner = Arc::new(Mutex::new(PipelineInner {
            pipeline,
            uri_decoder: None,
            current_uri: None,
            queue_in,
            _audioconvert_in: audioconvert_in,
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
            eq_preamp_db: 0.0,
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
            seek_seq: 0,
            _stereo_widener: stereo_widener,
            stereo_widener_config,
            crossfade_duration_ms: 1500,
            stem_mixer_elements: None,
            stem_mixer_state: StemMixerState::default(),
            original_track_uri: None,
            active_stem_project_id: None,
        }));

        let queue = Arc::new(Mutex::new(PlaybackQueue::new()));
        let stop_after_current = Arc::new(AtomicBool::new(false));
        let fade_generation = Arc::new(AtomicU64::new(0));
        let is_fading_in = Arc::new(AtomicBool::new(false));
        Ok(Self {
            inner,
            queue,
            stop_after_current,
            fade_generation,
            is_fading_in,
            volume_element,
            atomic_volume,
        })
    }
}
