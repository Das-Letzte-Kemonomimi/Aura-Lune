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
        }
    }

    fn is_bypass(&self) -> bool {
        self.params.is_bypass()
    }

    fn prepare_if_needed(&mut self, rate: u32, channels: u32) {
        if let Some(fmt) = self.format {
            if fmt.sample_rate == rate && fmt.channels == channels {
                return;
            }
        }

        if let Ok(new_fmt) = AudioFormat::new(rate, channels) {
            info!(
                "AuraluneDsp: Przygotowanie silników dla {} Hz, {} kanałów",
                rate, channels
            );
            if let Err(e) = self.rubberband.prepare(new_fmt, 4096) {
                warn!("Błąd prepare RubberBand: {:?}", e);
            }
            if let Err(e) = self.soundtouch.prepare(new_fmt, 4096) {
                warn!("Błąd prepare SoundTouch: {:?}", e);
            }
            let _ = self.rubberband.set_params(self.params);
            let _ = self.soundtouch.set_params(self.params);
            self.format = Some(new_fmt);
        }
    }

    fn set_params(&mut self, params: DspParams) -> Result<(), DspError> {
        params.validate()?;
        self.params = params;
        if self.format.is_some() {
            let _ = self.rubberband.set_params(params);
            let _ = self.soundtouch.set_params(params);
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

        // 2. Jeśli parametry są fabryczne (1.0x / 0 st) -> Bit-perfect BYPASS
        if state.is_bypass() {
            // Wypychamy resztki z FIFO, aby nie tracić próbek wyprodukowanych
            // przez poprzednią sesję DSP (eliminuje trzaski na granicy przejścia)
            if let Some(fmt) = state.format {
                let channels = fmt.channels as usize;
                let sample_rate = fmt.sample_rate as u64;

                while !state.fifo.is_empty() {
                    let drain_samples = state.fifo.len().min(4096 * channels);
                    let out_frames = drain_samples / channels;
                    let out_duration_ns = (out_frames as u64 * 1_000_000_000) / sample_rate;
                    let byte_len = drain_samples * std::mem::size_of::<f32>();

                    if let Ok(mut tail_buf) = gst::Buffer::with_size(byte_len) {
                        let buf_mut = tail_buf.make_mut();
                        if let Ok(mut map) = buf_mut.map_writable() {
                            let dst: &mut [f32] = unsafe {
                                std::slice::from_raw_parts_mut(
                                    map.as_mut_ptr() as *mut f32,
                                    drain_samples,
                                )
                            };
                            for s in dst.iter_mut() {
                                *s = state.fifo.pop_front().unwrap_or(0.0);
                            }
                        }
                        if let Some(pts) = state.current_pts {
                            buf_mut.set_pts(gst::ClockTime::from_nseconds(pts));
                            state.current_pts = Some(pts + out_duration_ns);
                        }
                        buf_mut.set_duration(gst::ClockTime::from_nseconds(out_duration_ns));
                        let _ = srcpad.push(tail_buf);
                    } else {
                        state.fifo.clear();
                        break;
                    }
                }
            } else {
                state.fifo.clear();
            }

            // Resetuj stan procesorów, aby nie wypuściły brudnych próbek
            // przy następnej aktywacji DSP
            let _ = state.rubberband.reset();
            let _ = state.soundtouch.reset();

            // Jeśli format jest znany, utrzymujemy ciągłość znaczników czasowych bufora,
            // aby downstream sink nie dostawał cofających się znaczników PTS przy przejściu z trybu spowolnionego do bypass
            if let Some(fmt) = state.format {
                let channels = fmt.channels as usize;
                let sample_rate = fmt.sample_rate as u64;
                let num_floats = buffer.size() / std::mem::size_of::<f32>();
                let in_frames = num_floats / channels;
                let duration_ns = (in_frames as u64 * 1_000_000_000) / sample_rate;

                let buffer_pts = buffer.pts().map(|p| p.nseconds());
                let pts = state.current_pts.or(buffer_pts).unwrap_or(0);
                state.current_pts = Some(pts + duration_ns);

                let mut out_buf = buffer;
                {
                    let buf_mut = out_buf.make_mut();
                    buf_mut.set_pts(gst::ClockTime::from_nseconds(pts));
                    buf_mut.set_duration(gst::ClockTime::from_nseconds(duration_ns));
                }
                drop(state);
                return srcpad.push(out_buf);
            }

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

        // Bezpieczny zapas poduszki FIFO (cushion), aby niwelować zmienność
        // produkcji ramek w oknach FFT Rubber Band / SoundTouch, zwłaszcza przy
        // zwolnionym tempie (< 0.5x) na dużych buforach FLAC (4096 ramek).
        let cushion_frames = 2048;
        let cushion_samples = cushion_frames * channels;

        let available_samples = state.fifo.len();
        // Jeśli nie osiągnęliśmy jeszcze minimalnego bufora rozruchowego, akumulujemy
        if available_samples < cushion_samples {
            drop(state);
            return Ok(gst::FlowSuccess::Ok);
        }

        // Dostępna nadwyżka ponad bezpieczną poduszkę
        let surplus_samples = available_samples.saturating_sub(cushion_samples);

        // Oblicz docelową liczbę próbek do wyemitowania na podstawie tempa
        let in_frames = num_floats / channels;
        let speed = (state.params.tempo_ratio * state.params.rate_ratio).max(0.05);
        let expected_out_frames = ((in_frames as f64) / speed).round() as usize;
        let target_samples = (expected_out_frames * channels).max(channels);

        let drain_samples = if surplus_samples >= target_samples {
            // Jeśli mamy pełną docelową porcję, emitujemy ją (plus małą korekcję przy wzroście bufora)
            if surplus_samples > target_samples * 2 {
                target_samples + (128 * channels)
            } else {
                target_samples
            }
        } else {
            // Jeśli nadwyżka jest mniejsza niż target, emitujemy tylko bezpieczną nadwyżkę,
            // chroniąc poduszkę cushion_samples przed całkowitym wyzerowaniem.
            (surplus_samples / channels) * channels
        };

        if drain_samples == 0 {
            drop(state);
            return Ok(gst::FlowSuccess::Ok);
        }

        let out_frames = drain_samples / channels;
        let out_duration_ns = (out_frames as u64 * 1_000_000_000) / sample_rate;

        let buffer_pts = buffer.pts().map(|p| p.nseconds());
        let current_pts = state.current_pts.or(buffer_pts).unwrap_or(0);
        state.current_pts = Some(current_pts + out_duration_ns);

        let byte_len = drain_samples * std::mem::size_of::<f32>();
        let mut gst_out_buffer =
            gst::Buffer::with_size(byte_len).map_err(|_| gst::FlowError::Error)?;

        {
            let out_buf_mut = gst_out_buffer.make_mut();
            {
                let mut out_map = out_buf_mut
                    .map_writable()
                    .map_err(|_| gst::FlowError::Error)?;
                let dst_slice: &mut [f32] = unsafe {
                    std::slice::from_raw_parts_mut(out_map.as_mut_ptr() as *mut f32, drain_samples)
                };
                for sample in dst_slice.iter_mut() {
                    *sample = state.fifo.pop_front().unwrap_or(0.0);
                }
            }

            out_buf_mut.set_pts(gst::ClockTime::from_nseconds(current_pts));
            out_buf_mut.set_duration(gst::ClockTime::from_nseconds(out_duration_ns));
        }

        drop(state);
        srcpad.push(gst_out_buffer)
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
