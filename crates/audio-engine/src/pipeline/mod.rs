//! The main GStreamer player pipeline with a dynamic DSP processor.
//!
//! `AudioEngine` is defined here (shared state, event types, helpers);
//! its methods are grouped by theme in submodules (separate `impl AudioEngine` blocks):
//! `graph`, `source`, `transport`, `fades`, `dsp`, `bus`, `queue_ops`, `equalizer`, `effects`.
//!
//! Lock order: `inner` may be held while taking `queue`, never the reverse.

mod bus;
mod dsp;
mod effects;
mod equalizer;
mod fades;
mod graph;
mod probes;
mod queue_ops;
mod source;
mod transport;

use crate::error::AudioEngineError;
use crate::sync::LockExt;
use crossbeam_utils::atomic::AtomicCell;
use domain::analysis::{StemMixerState, StemSeparationData};
use domain::crossfeed::CrossfeedConfig;
use domain::dynamics::{DynamicsState, SaturatorConfig};
use domain::equalizer::EqualizerState;
use domain::parametric_eq::ParametricEqState;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::replaygain::{ReplayGainConfig, ReplayGainMode};
use domain::silence::SilenceTrimmingConfig;
use domain::{PlaybackState, StemChannel};
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use gst::prelude::*;
use gst_base::prelude::BaseTransformExt;
use gstreamer as gst;
use gstreamer_base as gst_base;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// Events emitted by the player bus.
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

/// Internal state of the audio pipeline.
struct PipelineInner {
    pipeline: gst::Pipeline,
    uri_decoder: Option<gst::Element>,
    current_uri: Option<String>,
    queue_in: gst::Element,
    _audioconvert_in: gst::Element,
    dsp: crate::dsp_node::AuraluneDsp,
    freeverb: Option<gst::Element>,
    equalizer: gst::Element,
    peq_preamp: gst::Element,
    peq_equalizer: gst::Element,
    compressor: gst::Element,
    compressor_makeup: gst::Element,
    _saturator: gst::Element,
    saturator_config: Arc<AtomicCell<SaturatorConfig>>,
    bs2b: Option<gst::Element>,
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
    eq_preamp_db: f64,
    /// User preamp (dB), always applied regardless of the equalisers.
    user_preamp_db: f64,
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
    seek_seq: u64,
    _stereo_widener: gst::Element,
    stereo_widener_config: Arc<AtomicCell<domain::dynamics::StereoWidenerConfig>>,
    crossfade_duration_ms: u64,
    stem_mixer_elements: Option<StemMixerHandles>,
    stem_mixer_state: StemMixerState,
    original_track_uri: Option<String>,
    active_stem_project_id: Option<i64>,
}

struct StemMixerHandles {
    audiomixer: gst::Element,
    stem_volumes: std::collections::HashMap<String, gst::Element>,
    stem_elements: Vec<gst::Element>,
}

impl PipelineInner {
    fn update_preamp_volume(&self) {
        let total_db = domain::equalizer::combined_preamp_db(
            self.user_preamp_db,
            self.equalizer_state.enabled,
            self.eq_preamp_db,
            self.parametric_eq_state.enabled,
            self.parametric_eq_state.preamp_db,
        );
        let linear = 10.0f64.powf(total_db / 20.0);
        self.peq_preamp.set_property("volume", linear);
    }
}

/// Thread-safe audio pipeline controller.
#[derive(Clone)]
pub struct AudioEngine {
    inner: Arc<Mutex<PipelineInner>>,
    queue: Arc<Mutex<PlaybackQueue>>,
    stop_after_current: Arc<AtomicBool>,
    fade_generation: Arc<AtomicU64>,
    is_fading_in: Arc<AtomicBool>,
    volume_element: gst::Element,
    atomic_volume: Arc<AtomicU64>,
}

/// Releases the GStreamer resources safely when the pipeline controller is dropped.
impl Drop for PipelineInner {
    fn drop(&mut self) {
        let _ = self.pipeline.set_state(gst::State::Null);
    }
}
