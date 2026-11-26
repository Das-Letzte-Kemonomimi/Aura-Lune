//! Custom GStreamer element for the Auralune DSP engines (Bypass, Rubber Band, SoundTouch).
//!
//! ## Real-time safety (crates/AGENTS.md, "Real-Time Audio Safety")
//! `chain` runs on the GStreamer streaming thread:
//! - **Bypass** (bit-perfect mode, the common case) never takes the lock: the engine is read
//!   from an atomic and the buffer is passed on unchanged.
//! - **Processing** holds the state lock only while one buffer is processed. The control
//!   thread never holds it during expensive work: new processors are
//!   prepared (`prepare`) outside the lock and only swapped in under it.
//! - No Rust heap allocation in steady state: the FIFO and output buffers have
//!   reserved capacity, and output blocks are collected in an array on the stack.
//!   (`gst::Buffer` memory comes from the GStreamer allocator meant for streaming threads.)
//! - The format (rate, channels) comes from the Caps event, not a per-buffer query.
//! - Byte-to-`f32` casts are checked (`crate::rt`); DSP errors are logged with a rate limit.

use crate::rt::{self, RateLimiter};
use crate::sync::LockExt;
use dsp_api::{AudioFormat, AudioProcessor, DspCapabilities, DspEngine, DspError, DspParams};
use dsp_rubberband::RubberBandProcessor;
use dsp_soundtouch::SoundTouchProcessor;
use glib::prelude::*;
use gst::prelude::*;
use gst::subclass::prelude::*;
use gstreamer as gst;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
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

/// Maximum number of output blocks pushed from one `chain` call.
/// The rest stays in the FIFO for the next call (or the drain at EOS).
const MAX_BLOCKS_PER_CHAIN: usize = 16;
/// Minimum block size passed to the processors in `prepare`.
const MIN_PREPARE_BLOCK: usize = 2048;
/// Assumed maximum input buffer size (frames) when reserving memory.
const TYPICAL_INPUT_FRAMES: usize = 4096;
/// The slowest tempo of both engines is 0.15×, so output can be ~6.7× longer than input.
const MAX_STRETCH_FACTOR: usize = 7;

fn engine_to_u8(engine: DspEngine) -> u8 {
    match engine {
        DspEngine::Bypass => 0,
        DspEngine::RubberBand => 1,
        DspEngine::SoundTouch => 2,
    }
}

fn is_bypass_u8(value: u8) -> bool {
    value == engine_to_u8(DspEngine::Bypass)
}

/// A pair of processors prepared for a format (created outside the state lock).
struct Processors {
    rubberband: RubberBandProcessor,
    soundtouch: SoundTouchProcessor,
}

impl Processors {
    fn unprepared() -> Self {
        Self {
            rubberband: RubberBandProcessor::new(),
            soundtouch: SoundTouchProcessor::new(),
        }
    }

    /// Creates and prepares both processors. Expensive: call without the state lock.
    fn prepared(format: AudioFormat, block_size: usize, params: DspParams) -> Self {
        let mut p = Self::unprepared();
        let prep_block = block_size.max(MIN_PREPARE_BLOCK);
        if let Err(e) = p.rubberband.prepare(format, prep_block) {
            warn!("RubberBand prepare failed: {:?}", e);
        }
        if let Err(e) = p.soundtouch.prepare(format, prep_block) {
            warn!("SoundTouch prepare failed: {:?}", e);
        }
        let _ = p.rubberband.set_params(params);
        let _ = p.soundtouch.set_params(params);
        p
    }
}

struct DspNodeState {
    params: DspParams,
    format: Option<AudioFormat>,
    processors: Processors,
    fifo: VecDeque<f32>,
    out_buffer: Vec<f32>,
    /// Copy of the input when the GStreamer buffer is not `f32`-aligned (rare).
    unaligned_input: Vec<f32>,
    current_pts: Option<u64>,
    current_offset: u64,
    block_size: usize,
}

impl DspNodeState {
    fn new() -> Self {
        Self {
            params: DspParams::default(),
            format: None,
            processors: Processors::unprepared(),
            fifo: VecDeque::with_capacity(32768),
            out_buffer: Vec::with_capacity(16384),
            unaligned_input: Vec::new(),
            current_pts: None,
            current_offset: 0,
            block_size: 2048,
        }
    }

    /// Swaps in processors prepared outside the lock and reserves buffers for the new format.
    fn install(&mut self, format: AudioFormat, processors: Processors) {
        let mut processors = processors;
        // Parameters may have changed while the processors were prepared without the lock.
        let _ = processors.rubberband.set_params(self.params);
        let _ = processors.soundtouch.set_params(self.params);
        self.processors = processors;
        self.format = Some(format);

        let channels = format.channels as usize;
        let max_out = TYPICAL_INPUT_FRAMES.max(self.block_size) * channels * MAX_STRETCH_FACTOR;
        let want = max_out.saturating_sub(self.out_buffer.capacity());
        self.out_buffer.reserve(want);
        let fifo_want = (2 * max_out).saturating_sub(self.fifo.capacity());
        self.fifo.reserve(fifo_want);
    }

    fn set_params(&mut self, params: DspParams) -> Result<(), DspError> {
        params.validate()?;
        let old_params = self.params;
        self.params = params;
        if self.format.is_some() {
            let _ = self.processors.rubberband.set_params(params);
            let _ = self.processors.soundtouch.set_params(params);
        }

        if old_params.engine != params.engine {
            self.on_engine_changed(old_params.engine, params.engine);
        }

        // When speed (tempo/rate) or pitch changes, immediately trim the samples left in the
        // FIFO that were produced with the old parameters. This avoids added latency
        // and "drifting" sound before the new value settles.
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
        if old_engine != engine {
            self.on_engine_changed(old_engine, engine);
        }
    }

    /// On an engine change reset both processors and clear the FIFO so samples from the old
    /// engine don't mix with the new one. `current_pts` is kept, so timestamps don't jump.
    fn on_engine_changed(&mut self, old_engine: DspEngine, engine: DspEngine) {
        let _ = self.processors.rubberband.reset();
        let _ = self.processors.soundtouch.reset();
        self.fifo.clear();
        debug!(
            "AuraluneDsp: engine changed {:?} -> {:?}, resetting buffers",
            old_engine, engine
        );
    }

    fn reset(&mut self) {
        let _ = self.processors.rubberband.reset();
        let _ = self.processors.soundtouch.reset();
        self.fifo.clear();
        self.current_pts = None;
        self.current_offset = 0;
    }

    /// Pops up to `max_frames` frames from the FIFO as one `gst::Buffer` with correct PTS/offsets.
    /// `fallback_pts` (the input buffer's PTS) sets the time base after a reset.
    fn take_block(&mut self, max_frames: usize, fallback_pts: Option<u64>) -> Option<gst::Buffer> {
        let fmt = self.format?;
        let channels = fmt.channels as usize;
        let sample_rate = fmt.sample_rate as u64;

        let frames = (self.fifo.len() / channels).min(max_frames);
        if frames == 0 {
            return None;
        }
        let samples = frames * channels;

        let cur_offset = self.current_offset;
        let next_offset = cur_offset + frames as u64;

        let base_pts = self.current_pts.or(fallback_pts).unwrap_or(0);
        let frame_pts_ns = base_pts + (cur_offset * 1_000_000_000) / sample_rate;
        let next_pts_ns = base_pts + (next_offset * 1_000_000_000) / sample_rate;

        let mut out = gst::Buffer::with_size(samples * std::mem::size_of::<f32>()).ok()?;
        {
            let out_mut = out.get_mut()?;
            {
                let mut map = out_mut.map_writable().ok()?;
                let fifo = &mut self.fifo;
                let bytes = map.as_mut_slice();
                match rt::f32_samples_mut(bytes) {
                    Some(dst) => {
                        for (d, s) in dst.iter_mut().zip(fifo.drain(..samples)) {
                            *d = s;
                        }
                    }
                    None => {
                        for (chunk, s) in bytes
                            .as_chunks_mut::<4>()
                            .0
                            .iter_mut()
                            .zip(fifo.drain(..samples))
                        {
                            *chunk = s.to_ne_bytes();
                        }
                    }
                }
            }
            out_mut.set_pts(gst::ClockTime::from_nseconds(frame_pts_ns));
            out_mut.set_duration(gst::ClockTime::from_nseconds(
                next_pts_ns.saturating_sub(frame_pts_ns),
            ));
            out_mut.set_offset(cur_offset);
            out_mut.set_offset_end(next_offset);
        }

        if self.current_pts.is_none() {
            self.current_pts = Some(base_pts);
        }
        self.current_offset = next_offset;
        Some(out)
    }
}

pub struct AuraluneDspImpl {
    sinkpad: gst::Pad,
    srcpad: gst::Pad,
    state: Arc<Mutex<DspNodeState>>,
    /// Active engine (for the lock-free Bypass path in `chain`).
    engine: Arc<AtomicU8>,
    /// Set when switching to Bypass: `chain` clears the FIFO once under the lock.
    bypass_reset_pending: Arc<AtomicBool>,
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
            engine: Arc::new(AtomicU8::new(engine_to_u8(DspEngine::Bypass))),
            bypass_reset_pending: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Shared handles passed to the `chain` function and the event handler.
#[derive(Clone)]
struct Shared {
    srcpad: gst::Pad,
    state: Arc<Mutex<DspNodeState>>,
    engine: Arc<AtomicU8>,
    bypass_reset_pending: Arc<AtomicBool>,
}

impl ObjectImpl for AuraluneDspImpl {
    fn constructed(&self) {
        self.parent_constructed();
        let obj = self.obj();
        obj.add_pad(&self.sinkpad).unwrap();
        obj.add_pad(&self.srcpad).unwrap();

        let shared = Shared {
            srcpad: self.srcpad.clone(),
            state: Arc::clone(&self.state),
            engine: Arc::clone(&self.engine),
            bypass_reset_pending: Arc::clone(&self.bypass_reset_pending),
        };

        unsafe {
            let chain_shared = shared.clone();
            self.sinkpad
                .set_chain_function(move |_pad, _parent, buffer| {
                    Self::chain(&chain_shared, buffer)
                });

            let event_shared = shared.clone();
            self.sinkpad
                .set_event_function(move |_pad, _parent, event| {
                    Self::sink_event(&event_shared, event)
                });

            let sinkpad_src_event = self.sinkpad.clone();
            self.srcpad.set_event_function(move |_pad, _parent, event| {
                sinkpad_src_event.push_event(event)
            });

            let srcpad_query = self.srcpad.clone();
            self.sinkpad
                .set_query_function(move |_pad, _parent, query| srcpad_query.peer_query(query));

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

static DSP_ERROR_LOG: RateLimiter = RateLimiter::new();

impl AuraluneDspImpl {
    fn chain(shared: &Shared, buffer: gst::Buffer) -> Result<gst::FlowSuccess, gst::FlowError> {
        // 1. Bypass: clean, bit-perfect passthrough without the lock.
        if is_bypass_u8(shared.engine.load(Ordering::Acquire)) {
            if shared.bypass_reset_pending.swap(false, Ordering::AcqRel) {
                let mut state = shared.state.lock_safe();
                state.fifo.clear();
                state.current_pts = None;
            }
            return shared.srcpad.push(buffer);
        }

        // 2. DSP processing (Rubber Band or SoundTouch)
        let mut blocks: [Option<gst::Buffer>; MAX_BLOCKS_PER_CHAIN] = Default::default();
        // `true`: pass the input buffer on unchanged; it is pushed only after the lock is released.
        let passthrough = 'locked: {
            let mut state = shared.state.lock_safe();
            if state.format.is_none() {
                drop(state);
                return shared.srcpad.push(buffer);
            }

            let Ok(map) = buffer.map_readable() else {
                return Ok(gst::FlowSuccess::Ok);
            };

            let state = &mut *state;
            let engine = state.params.engine;
            let mut out_buffer = std::mem::take(&mut state.out_buffer);
            out_buffer.clear();

            let input: &[f32] = match rt::f32_samples(map.as_slice()) {
                Some(samples) => samples,
                None => {
                    state.unaligned_input.clear();
                    rt::extend_f32_samples(map.as_slice(), &mut state.unaligned_input);
                    &state.unaligned_input
                }
            };

            let status = match engine {
                // Engine-switch window: the atomic flag said "process", but the state is already
                // (or still) Bypass, so pass the buffer on unchanged instead of dropping it.
                DspEngine::Bypass => {
                    drop(map);
                    state.out_buffer = out_buffer;
                    break 'locked true;
                }
                DspEngine::RubberBand => {
                    state.processors.rubberband.process(input, &mut out_buffer)
                }
                DspEngine::SoundTouch => {
                    state.processors.soundtouch.process(input, &mut out_buffer)
                }
            };

            if let Err(err) = status {
                if DSP_ERROR_LOG.should_log(500) {
                    warn!(
                        "DSP processing error ({:?}): {:?} (logged every 500 occurrences)",
                        engine, err
                    );
                }
                drop(map);
                state.out_buffer = out_buffer;
                break 'locked true;
            }

            // Put the produced samples into the elastic FIFO
            state.fifo.extend(out_buffer.iter().copied());
            state.out_buffer = out_buffer;

            // Drain available samples in blocks of up to block_size frames; pushing right away
            // avoids stalling the GStreamer preroll and starving the PipeWire sink.
            let fallback_pts = buffer.pts().map(|p| p.nseconds());
            // Under heavy slow-down (tempo < 1) the processor produces more frames than
            // MAX_BLOCKS_PER_CHAIN · block_size, so grow the block to empty the whole FIFO
            // on every call (otherwise it grows forever: reallocations and growing latency).
            let channels = state.format.map_or(1, |f| (f.channels as usize).max(1));
            let queued_frames = state.fifo.len() / channels;
            let block_size = state
                .block_size
                .max(queued_frames.div_ceil(MAX_BLOCKS_PER_CHAIN));
            for slot in blocks.iter_mut() {
                match state.take_block(block_size, fallback_pts) {
                    Some(b) => *slot = Some(b),
                    None => break,
                }
            }
            false
        };
        if passthrough {
            return shared.srcpad.push(buffer);
        }

        // Push outside the lock: a downstream element may block.
        for block in blocks.into_iter().flatten() {
            shared.srcpad.push(block)?;
        }
        Ok(gst::FlowSuccess::Ok)
    }

    fn sink_event(shared: &Shared, event: gst::Event) -> bool {
        use gst::EventView;
        match event.view() {
            EventView::FlushStop(..) => {
                shared.state.lock_safe().reset();
                shared.srcpad.push_event(event)
            }
            EventView::Caps(c) => {
                let format = c.caps().structure(0).and_then(|s| {
                    let rate = s.get::<i32>("rate").ok()?;
                    let channels = s.get::<i32>("channels").ok()?;
                    AudioFormat::new(rate as u32, channels as u32).ok()
                });
                if let Some(format) = format {
                    Self::prepare_for_format(shared, format);
                }
                shared.srcpad.push_event(event)
            }
            EventView::Segment(seg) => {
                {
                    let mut state = shared.state.lock_safe();
                    let position = match seg.segment().position() {
                        gst::GenericFormattedValue::Time(Some(t)) => t.nseconds(),
                        _ => 0,
                    };
                    state.current_pts = Some(position);
                    state.current_offset = 0;
                }
                shared.srcpad.push_event(event)
            }
            EventView::Eos(..) => {
                // Drain what is left in the processor (EOS is not a hot path, so a Vec is fine).
                let mut tail = Vec::new();
                {
                    let mut state = shared.state.lock_safe();
                    let state = &mut *state;
                    let mut out_buffer = std::mem::take(&mut state.out_buffer);
                    out_buffer.clear();
                    let _ = match state.params.engine {
                        DspEngine::Bypass => Ok(dsp_api::ProcessStatus::Eos),
                        DspEngine::RubberBand => state.processors.rubberband.drain(&mut out_buffer),
                        DspEngine::SoundTouch => state.processors.soundtouch.drain(&mut out_buffer),
                    };
                    state.fifo.extend(out_buffer.iter().copied());
                    state.out_buffer = out_buffer;
                    while let Some(block) = state.take_block(4096, None) {
                        tail.push(block);
                    }
                }
                for block in tail {
                    let _ = shared.srcpad.push(block);
                }
                shared.srcpad.push_event(event)
            }
            _ => shared.srcpad.push_event(event),
        }
    }

    /// Prepares processors for a new format. The expensive `prepare` runs outside the lock.
    fn prepare_for_format(shared: &Shared, format: AudioFormat) {
        let (block_size, params) = {
            let state = shared.state.lock_safe();
            if state.format == Some(format) {
                return;
            }
            (state.block_size, state.params)
        };
        info!(
            "AuraluneDsp: preparing engines for {} Hz, {} channels (block_size: {})",
            format.sample_rate, format.channels, block_size
        );
        let processors = Processors::prepared(format, block_size, params);
        shared.state.lock_safe().install(format, processors);
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
        let result = imp.state.lock_safe().set_params(params);
        if result.is_ok() {
            self.publish_engine(params.engine);
        }
        result
    }

    pub fn set_engine(&self, engine: DspEngine) {
        let imp = self.imp();
        imp.state.lock_safe().set_engine(engine);
        self.publish_engine(engine);
    }

    /// Changes the block size. Processors are prepared again outside the state lock,
    /// so the streaming thread never waits for the expensive `prepare`.
    pub fn set_block_size(&self, size: usize) {
        let imp = self.imp();
        let clamped = size.clamp(512, 16384);
        let (format, params) = {
            let mut state = imp.state.lock_safe();
            state.block_size = clamped;
            (state.format, state.params)
        };
        if let Some(format) = format {
            let processors = Processors::prepared(format, clamped, params);
            imp.state.lock_safe().install(format, processors);
        }
        info!("AuraluneDsp: block_size updated to {} frames", clamped);
    }

    pub fn block_size(&self) -> usize {
        self.imp().state.lock_safe().block_size
    }

    pub fn dsp_params(&self) -> DspParams {
        self.imp().state.lock_safe().params
    }

    pub fn dsp_capabilities(&self) -> DspCapabilities {
        self.dsp_params().engine.capabilities()
    }

    pub fn reset(&self) {
        self.imp().state.lock_safe().reset();
    }

    fn publish_engine(&self, engine: DspEngine) {
        let imp = self.imp();
        let previous = imp.engine.swap(engine_to_u8(engine), Ordering::AcqRel);
        if is_bypass_u8(engine_to_u8(engine)) && !is_bypass_u8(previous) {
            imp.bypass_reset_pending.store(true, Ordering::Release);
        }
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
