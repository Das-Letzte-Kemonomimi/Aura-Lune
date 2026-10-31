//! Własny element GStreamer dla silników DSP Auralune (Bypass, Rubber Band, SoundTouch).

use dsp_api::{AudioFormat, AudioProcessor, DspCapabilities, DspEngine, DspError, DspParams};
use dsp_rubberband::RubberBandProcessor;
use dsp_soundtouch::SoundTouchProcessor;
use glib::prelude::*;
use gst::prelude::*;
use gst::subclass::prelude::*;
use gstreamer as gst;
use std::sync::{Arc, LazyLock, Mutex};
use tracing::{debug, info, warn};

static PAD_TEMPLATES: LazyLock<Vec<gst::PadTemplate>> = LazyLock::new(|| {
    let caps = gst::Caps::builder("audio/x-raw")
        .field("format", "F32LE")
        .field("rate", gst::IntRange::new(8000, 192000))
        .field("channels", gst::IntRange::new(1, 8))
        .field("layout", "interleaved")
        .build();

    let sink_pad_template = gst::PadTemplate::new(
        "sink",
        gst::PadDirection::Sink,
        gst::PadPresence::Always,
        &caps,
    )
    .unwrap();

    let src_pad_template = gst::PadTemplate::new(
        "src",
        gst::PadDirection::Src,
        gst::PadPresence::Always,
        &caps,
    )
    .unwrap();

    vec![sink_pad_template, src_pad_template]
});

static ELEMENT_METADATA: LazyLock<gst::subclass::ElementMetadata> = LazyLock::new(|| {
    gst::subclass::ElementMetadata::new(
        "Auralune DSP Processor",
        "Filter/Effect/Audio",
        "Audio pitch shifter and time stretcher supporting Rubber Band and SoundTouch",
        "Auralune Team",
    )
});

struct DspNodeState {
    params: DspParams,
    format: Option<AudioFormat>,
    rubberband: RubberBandProcessor,
    soundtouch: SoundTouchProcessor,
    fifo: std::collections::VecDeque<f32>,
    out_buffer: Vec<f32>,
    current_pts: Option<u64>,
    block_size: usize,
}

impl DspNodeState {
    fn new() -> Self {
        Self {
            params: DspParams::default(),
            format: None,
            rubberband: RubberBandProcessor::new(),
            soundtouch: SoundTouchProcessor::new(),
            fifo: std::collections::VecDeque::with_capacity(32768),
            out_buffer: Vec::with_capacity(16384),
            current_pts: None,
            block_size: 2048,
        }
    }

    fn is_bypass(&self) -> bool {
        self.params.engine == DspEngine::Bypass
    }

    fn prepare_if_needed(&mut self, rate: u32, channels: u32) {
        if let Some(fmt) = self.format {
            if fmt.sample_rate == rate && fmt.channels == channels {
                return;
            }
        }

        if let Ok(new_fmt) = AudioFormat::new(rate, channels) {
            info!(
                "AuraluneDsp: Przygotowanie silników dla {} Hz, {} kanałów (block_size: {})",
                rate, channels, self.block_size
            );
            let prep_block = self.block_size.max(2048);
            if let Err(e) = self.rubberband.prepare(new_fmt, prep_block) {
                warn!("Błąd prepare RubberBand: {:?}", e);
            }
            if let Err(e) = self.soundtouch.prepare(new_fmt, prep_block) {
                warn!("Błąd prepare SoundTouch: {:?}", e);
            }
            let _ = self.rubberband.set_params(self.params);
            let _ = self.soundtouch.set_params(self.params);
            self.format = Some(new_fmt);
        }
    }

    fn set_block_size(&mut self, size: usize) {
        let clamped = size.clamp(512, 16384);
        self.block_size = clamped;
        if let Some(fmt) = self.format {
            let prep_block = clamped.max(2048);
            let _ = self.rubberband.prepare(fmt, prep_block);
            let _ = self.soundtouch.prepare(fmt, prep_block);
            let _ = self.rubberband.set_params(self.params);
            let _ = self.soundtouch.set_params(self.params);
        }
        info!(
            "AuraluneDsp: Zaktualizowano block_size na {} ramek",
            clamped
        );
    }

    fn set_params(&mut self, params: DspParams) -> Result<(), DspError> {
        params.validate()?;
        let old_params = self.params;
        self.params = params;
        if self.format.is_some() {
            let _ = self.rubberband.set_params(params);
            let _ = self.soundtouch.set_params(params);
        }

        // Gdy zmienia się prędkość (tempo/rate) lub tonacja, natychmiast zredukuj zalegające
        // w FIFO próbki wygenerowane na starych parametrach. Zapobiega to efektowi opóźnienia
        // oraz "pływania" dźwięku przed ustabilizowaniem nowej wartości.
        let params_changed = (old_params.rate_ratio - params.rate_ratio).abs() > 1e-4
            || (old_params.tempo_ratio - params.tempo_ratio).abs() > 1e-4
            || (old_params.pitch_semitones - params.pitch_semitones).abs() > 1e-4;

        if params_changed {
            let channels = self.format.map(|f| f.channels as usize).unwrap_or(2);
            let max_keep = 512 * channels;
            if self.fifo.len() > max_keep {
                self.fifo.truncate(max_keep);
            }
        }

        Ok(())
    }

    fn set_engine(&mut self, engine: DspEngine) {
        let old_engine = self.params.engine;
        self.params.engine = engine;

        // Przy zmianie silnika resetuj oba procesory i czyść FIFO,
        // aby próbki z poprzedniego silnika nie mieszały się z nowym
        if old_engine != engine {
            let _ = self.rubberband.reset();
            let _ = self.soundtouch.reset();
            self.fifo.clear();
            // Zachowujemy self.current_pts, aby nie powodować skoków znaczników czasowych dla sinka
            debug!(
                "AuraluneDsp: Silnik zmieniony {:?} -> {:?}, reset buforów",
                old_engine, engine
            );
        }
    }

    fn reset(&mut self) {
        let _ = self.rubberband.reset();
        let _ = self.soundtouch.reset();
        self.fifo.clear();
        self.current_pts = None;
    }
}

pub struct AuraluneDspImpl {
    sinkpad: gst::Pad,
    srcpad: gst::Pad,
    state: Arc<Mutex<DspNodeState>>,
}

#[glib::object_subclass]
impl ObjectSubclass for AuraluneDspImpl {
    const NAME: &'static str = "AuraluneDsp";
    type Type = AuraluneDsp;
    type ParentType = gst::Element;

    fn with_class(klass: &Self::Class) -> Self {
        let templ = klass.pad_template("sink").unwrap();
        let sinkpad = gst::Pad::builder_from_template(&templ).build();

        let templ = klass.pad_template("src").unwrap();
        let srcpad = gst::Pad::builder_from_template(&templ).build();

        Self {
            sinkpad,
            srcpad,
            state: Arc::new(Mutex::new(DspNodeState::new())),
        }
    }
}

impl ObjectImpl for AuraluneDspImpl {
    fn constructed(&self) {
        self.parent_constructed();
        let obj = self.obj();
        obj.add_pad(&self.sinkpad).unwrap();
        obj.add_pad(&self.srcpad).unwrap();

        let srcpad_clone = self.srcpad.clone();
        let state_chain = Arc::clone(&self.state);

        unsafe {
            self.sinkpad
                .set_chain_function(move |pad, _parent, buffer| {
                    Self::chain(pad, &srcpad_clone, &state_chain, buffer)
                });

            let srcpad_event = self.srcpad.clone();
            let state_event = Arc::clone(&self.state);
            self.sinkpad
                .set_event_function(move |_pad, _parent, event| {
                    Self::sink_event(&srcpad_event, &state_event, event)
                });

            let sinkpad_src_event = self.sinkpad.clone();
            self.srcpad.set_event_function(move |_pad, _parent, event| {
                sinkpad_src_event.push_event(event)
            });

            let sinkpad_query = self.sinkpad.clone();
            self.srcpad
                .set_query_function(move |_pad, _parent, query| sinkpad_query.peer_query(query));
        }
    }
}

impl GstObjectImpl for AuraluneDspImpl {}

impl ElementImpl for AuraluneDspImpl {
    fn metadata() -> Option<&'static gst::subclass::ElementMetadata> {
        Some(&*ELEMENT_METADATA)
    }

    fn pad_templates() -> &'static [gst::PadTemplate] {
        PAD_TEMPLATES.as_ref()
    }
}

impl AuraluneDspImpl {
    fn chain(
        sinkpad: &gst::Pad,
        srcpad: &gst::Pad,
        state_arc: &Arc<Mutex<DspNodeState>>,
        buffer: gst::Buffer,
    ) -> Result<gst::FlowSuccess, gst::FlowError> {
        let mut state = state_arc.lock().unwrap();

        // 1. Sprawdzenie i aktualizacja formatu próbek (Caps)
        if let Some(caps) = sinkpad.current_caps() {
            if let Some(s) = caps.structure(0) {
                if let (Ok(rate), Ok(channels)) = (s.get::<i32>("rate"), s.get::<i32>("channels")) {
                    state.prepare_if_needed(rate as u32, channels as u32);
                }
            }
        }

        // 2. Jeśli tryb Bypass -> Czysty, bit-perfect passthrough
        if state.is_bypass() {
            state.fifo.clear();
            state.current_pts = None;
            drop(state);
            return srcpad.push(buffer);
        }

        // 3. Przetwarzanie DSP (Rubber Band lub SoundTouch)
        let fmt = match state.format {
            Some(f) => f,
            None => {
                drop(state);
                return srcpad.push(buffer);
            }
        };

        let map = match buffer.map_readable() {
            Ok(m) => m,
            Err(_) => return Ok(gst::FlowSuccess::Ok),
        };

        let num_floats = map.len() / std::mem::size_of::<f32>();
        let input_samples: &[f32] =
            unsafe { std::slice::from_raw_parts(map.as_ptr() as *const f32, num_floats) };

        let channels = fmt.channels as usize;
        let sample_rate = fmt.sample_rate as u64;

        let mut out_buffer = std::mem::take(&mut state.out_buffer);
        out_buffer.clear();
        let engine = state.params.engine;

        let status = match engine {
            DspEngine::Bypass => Ok(dsp_api::ProcessStatus::Ok),
            DspEngine::RubberBand => state.rubberband.process(input_samples, &mut out_buffer),
            DspEngine::SoundTouch => state.soundtouch.process(input_samples, &mut out_buffer),
        };

        if let Err(err) = status {
            warn!("Błąd przetwarzania DSP ({:?}): {:?}", engine, err);
            drop(map);
            state.out_buffer = out_buffer;
            drop(state);
            return srcpad.push(buffer);
        }

        drop(map);

        // Umieść wyprodukowane próbki w elastycznym buforze FIFO
        if !out_buffer.is_empty() {
            state.fifo.extend(out_buffer.iter().copied());
        }
        state.out_buffer = out_buffer;

        // Jeśli w buforze FIFO nie ma jeszcze próbek (np. wstępne buforowanie), czekamy na kolejny pakiet
        if state.fifo.is_empty() {
            drop(state);
            return Ok(gst::FlowSuccess::Ok);
        }

        let mut buffers_to_push = Vec::with_capacity(8);

        // Drenujemy wszystkie dostępne próbki w blokach do block_size ramek.
        // Wszelkie próbki wyprodukowane przez DSP są natychmiast wypychane w dół potoku,
        // co zapobiega zawieszeniu prerollu GStreamera oraz głodzeniu zlewu PipeWire.
        while !state.fifo.is_empty() {
            let available_samples = state.fifo.len();
            let drain_samples = available_samples.min(state.block_size * channels);
            let out_frames = drain_samples / channels;
            let out_duration_ns = (out_frames as u64 * 1_000_000_000) / sample_rate;

            let buffer_pts = buffer.pts().map(|p| p.nseconds());
            let current_pts = state.current_pts.or(buffer_pts).unwrap_or(0);
            state.current_pts = Some(current_pts + out_duration_ns);

            let byte_len = drain_samples * std::mem::size_of::<f32>();
            if let Ok(mut gst_out_buffer) = gst::Buffer::with_size(byte_len) {
                let out_buf_mut = gst_out_buffer.make_mut();
                if let Ok(mut out_map) = out_buf_mut.map_writable() {
                    let dst_slice: &mut [f32] = unsafe {
                        std::slice::from_raw_parts_mut(
                            out_map.as_mut_ptr() as *mut f32,
                            drain_samples,
                        )
                    };
                    for sample in dst_slice.iter_mut() {
                        *sample = state.fifo.pop_front().unwrap_or(0.0);
                    }
                }

                out_buf_mut.set_pts(gst::ClockTime::from_nseconds(current_pts));
                out_buf_mut.set_duration(gst::ClockTime::from_nseconds(out_duration_ns));
                buffers_to_push.push(gst_out_buffer);
            } else {
                break;
            }
        }

        drop(state);

        for buf in buffers_to_push {
            srcpad.push(buf)?;
        }

        Ok(gst::FlowSuccess::Ok)
    }

    fn sink_event(
        srcpad: &gst::Pad,
        state_arc: &Arc<Mutex<DspNodeState>>,
        event: gst::Event,
    ) -> bool {
        use gst::EventView;
        match event.view() {
            EventView::FlushStop(..) | EventView::Seek(..) => {
                if let Ok(mut state) = state_arc.lock() {
                    state.reset();
                }
                srcpad.push_event(event)
            }
            EventView::Segment(seg) => {
                if let Ok(mut state) = state_arc.lock() {
                    let position = match seg.segment().position() {
                        gst::GenericFormattedValue::Time(Some(t)) => t.nseconds(),
                        _ => 0,
                    };
                    state.current_pts = Some(position);
                }
                srcpad.push_event(event)
            }
            EventView::Eos(..) => {
                // Drain resztek bufora procesora do FIFO
                let mut state = state_arc.lock().unwrap();
                let mut out_buffer = std::mem::take(&mut state.out_buffer);
                out_buffer.clear();
                let engine = state.params.engine;
                let _ = match engine {
                    DspEngine::Bypass => Ok(dsp_api::ProcessStatus::Eos),
                    DspEngine::RubberBand => state.rubberband.drain(&mut out_buffer),
                    DspEngine::SoundTouch => state.soundtouch.drain(&mut out_buffer),
                };

                if !out_buffer.is_empty() {
                    state.fifo.extend(out_buffer.iter().copied());
                }

                if let Some(fmt) = state.format {
                    let channels = fmt.channels as usize;
                    let sample_rate = fmt.sample_rate as u64;

                    while !state.fifo.is_empty() {
                        let drain_samples = state.fifo.len().min(4096 * channels);
                        let out_frames = drain_samples / channels;
                        let out_duration_ns = (out_frames as u64 * 1_000_000_000) / sample_rate;
                        let byte_len = drain_samples * std::mem::size_of::<f32>();

                        if let Ok(mut gst_out_buffer) = gst::Buffer::with_size(byte_len) {
                            let out_buf_mut = gst_out_buffer.make_mut();
                            {
                                if let Ok(mut out_map) = out_buf_mut.map_writable() {
                                    let dst_slice: &mut [f32] = unsafe {
                                        std::slice::from_raw_parts_mut(
                                            out_map.as_mut_ptr() as *mut f32,
                                            drain_samples,
                                        )
                                    };
                                    for sample in dst_slice.iter_mut() {
                                        *sample = state.fifo.pop_front().unwrap_or(0.0);
                                    }
                                }
                            }
                            if let Some(pts) = state.current_pts {
                                out_buf_mut.set_pts(gst::ClockTime::from_nseconds(pts));
                                state.current_pts = Some(pts + out_duration_ns);
                            }
                            out_buf_mut
                                .set_duration(gst::ClockTime::from_nseconds(out_duration_ns));
                            let _ = srcpad.push(gst_out_buffer);
                        } else {
                            break;
                        }
                    }
                }
                state.out_buffer = out_buffer;
                drop(state);
                srcpad.push_event(event)
            }
            _ => srcpad.push_event(event),
        }
    }
}

glib::wrapper! {
    pub struct AuraluneDsp(ObjectSubclass<AuraluneDspImpl>) @extends gst::Element, gst::Object;
}

impl AuraluneDsp {
    pub fn new(name: Option<&str>) -> Self {
        glib::Object::builder()
            .property("name", name.unwrap_or("auralune_dsp"))
            .build()
    }

    pub fn set_params(&self, params: DspParams) -> Result<(), DspError> {
        let imp = self.imp();
        let mut state = imp.state.lock().unwrap();
        state.set_params(params)
    }

    pub fn set_engine(&self, engine: DspEngine) {
        let imp = self.imp();
        let mut state = imp.state.lock().unwrap();
        state.set_engine(engine);
    }

    pub fn set_block_size(&self, size: usize) {
        let imp = self.imp();
        let mut state = imp.state.lock().unwrap();
        state.set_block_size(size);
    }

    pub fn block_size(&self) -> usize {
        let imp = self.imp();
        let state = imp.state.lock().unwrap();
        state.block_size
    }

    pub fn dsp_params(&self) -> DspParams {
        let imp = self.imp();
        let state = imp.state.lock().unwrap();
        state.params
    }

    pub fn dsp_capabilities(&self) -> DspCapabilities {
        self.dsp_params().engine.capabilities()
    }

    pub fn reset(&self) {
        let imp = self.imp();
        let mut state = imp.state.lock().unwrap();
        state.reset();
    }
}

pub fn register_dsp_element() -> Result<(), glib::BoolError> {
    gst::Element::register(
        None,
        "auralune_dsp",
        gst::Rank::NONE,
        AuraluneDsp::static_type(),
    )
}
