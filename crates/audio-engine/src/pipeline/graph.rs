//! Builds the GStreamer pipeline graph (`AudioEngine::new`): elements, effect probes and links.

use super::*;

impl AudioEngine {
    /// Initialises GStreamer and builds the base player pipeline.
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

        // Audio input buffer (decouples decoding from the DSP)
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

        // Force F32LE for the DSP processors
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

        // Dedicated DSP element (Bypass / Rubber Band / SoundTouch)
        let dsp = crate::dsp_node::AuraluneDsp::new(Some("auralune_dsp"));

        let equalizer = gst::ElementFactory::make("equalizer-10bands")
            .name("equalizer_10bands")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("equalizer-10bands"))?;
        if let Ok(transform) = equalizer.clone().dynamic_cast::<gst_base::BaseTransform>() {
            transform.set_passthrough(true); // Off by default (bit-perfect bypass)
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
            transform.set_passthrough(true); // Off by default (bit-perfect bypass)
        }

        // Dynamics Studio modules:
        // 1. Dynamics compressor (audiodynamic)
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
                    transform.set_passthrough(true); // Off by default (bypass)
                }
                c
            }
            Err(e) => {
                warn!("audiodynamic element missing (gst-plugins-good): {:?}", e);
                return Err(AudioEngineError::MissingElement("audiodynamic"));
            }
        };

        // 2. Compressor makeup gain
        let compressor_makeup = gst::ElementFactory::make("volume")
            .name("compressor_makeup")
            .property("volume", 1.0f64)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        // 3–4. Analog saturator and stereo widener: `identity` elements with F32LE probes
        //      (streaming-thread code in `probes.rs`).
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

        // Audio output queue: 600 ms without an artificial min-threshold (0 = off),
        // which removes micro-dropouts and timing stalls before the output sink.
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

        // Audio output preference:
        // 1. pulsesink: connects to the pipewire-pulse / PulseAudio daemon.
        //    It has a mature hardware ring-buffer (GstAudioBaseSink) with configurable
        //    buffer-time (200 ms) and latency-time (10 ms), which gives click-free playback
        //    on external USB converters (e.g. Focusrite Scarlett Solo).
        // 2. pipewiresink: direct fallback for native PipeWire.
        // 3. autoaudiosink: GStreamer's generic system fallback.
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
            info!("Initialised the PulseAudio / PipeWire-Pulse output (200ms buffer-time, 10ms latency)");
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
                    info!("Initialised the PipeWire output (role: Music)");
                    pw_sink
                }
                Err(_) => {
                    warn!("Neither pulsesink nor pipewiresink is available; falling back to autoaudiosink");
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
                warn!("freeverb element missing (gst-plugins-bad): {:?}", e);
                None
            }
        };

        // Add the static elements to the input and DSP pipeline
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

        // ReplayGain is off by default, so set passthrough to let the audio stream through unmodified
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

        // Bauer stereophonic-to-binaural element (crossfeed, bs2b) for headphone listening
        let bs2b = match gst::ElementFactory::make("bs2b")
            .name("bs2b_crossfeed")
            .property("fcut", 700i32)
            .property("feed", 45i32)
            .build()
        {
            Ok(el) => {
                if let Ok(transform) = el.clone().dynamic_cast::<gst_base::BaseTransform>() {
                    transform.set_passthrough(true); // Bypass by default
                }
                Some(el)
            }
            Err(e) => {
                warn!("bs2b element missing (gst-plugins-bad): {:?}", e);
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

        // Link the audio processing elements:
        // queue_in -> audioconvert_in -> audioresample -> capsfilter_dsp -> dsp
        gst::Element::link_many([
            &queue_in,
            &audioconvert_in,
            &audioresample,
            &capsfilter_dsp,
            dsp.upcast_ref(),
        ])
        .map_err(|_| AudioEngineError::ElementLink("Failed to link the DSP input".into()))?;

        // DSP -> (freeverb) -> equalizer
        if let Some(ref fv) = freeverb {
            dsp.upcast_ref::<gst::Element>().link(fv).map_err(|_| {
                AudioEngineError::ElementLink("Failed to link DSP to freeverb".into())
            })?;
            fv.link(&equalizer).map_err(|_| {
                AudioEngineError::ElementLink("Failed to link freeverb to equalizer".into())
            })?;
        } else {
            dsp.upcast_ref::<gst::Element>()
                .link(&equalizer)
                .map_err(|_| {
                    AudioEngineError::ElementLink("Failed to link DSP to equalizer".into())
                })?;
        }

        // equalizer -> peq_preamp -> peq_equalizer
        equalizer.link(&peq_preamp).map_err(|_| {
            AudioEngineError::ElementLink("Failed to link equalizer to peq_preamp".into())
        })?;
        peq_preamp.link(&peq_equalizer).map_err(|_| {
            AudioEngineError::ElementLink("Failed to link peq_preamp to peq_equalizer".into())
        })?;

        // peq_equalizer -> compressor -> compressor_makeup -> saturator
        peq_equalizer.link(&compressor).map_err(|_| {
            AudioEngineError::ElementLink("Failed to link peq_equalizer to compressor".into())
        })?;
        compressor.link(&compressor_makeup).map_err(|_| {
            AudioEngineError::ElementLink("Failed to link compressor to compressor_makeup".into())
        })?;
        compressor_makeup.link(&saturator).map_err(|_| {
            AudioEngineError::ElementLink("Failed to link compressor_makeup to saturator".into())
        })?;
        saturator.link(&stereo_widener).map_err(|_| {
            AudioEngineError::ElementLink("Failed to link saturator to stereo_widener".into())
        })?;

        // stereo_widener -> (bs2b) -> rgvolume
        if let Some(ref bs) = bs2b {
            stereo_widener.link(bs).map_err(|_| {
                AudioEngineError::ElementLink("Failed to link stereo_widener to bs2b".into())
            })?;
            bs.link(&rgvolume).map_err(|_| {
                AudioEngineError::ElementLink("Failed to link bs2b to rgvolume".into())
            })?;
        } else {
            stereo_widener.link(&rgvolume).map_err(|_| {
                AudioEngineError::ElementLink("Failed to link stereo_widener to rgvolume".into())
            })?;
        }

        // rgvolume -> rglimiter -> spectrum -> audioconvert_sink -> audioresample_sink -> queue_sink -> volume -> sink
        // Placing volume right before the sink (after queue_sink) means a volume slider change
        // takes effect immediately, without waiting for the queue buffer.
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
                "Failed to link the audio output chain to spectrum, queue, volume and sink".into(),
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
            user_preamp_db: 0.0,
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
