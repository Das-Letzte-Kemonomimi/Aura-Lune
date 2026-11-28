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
mod snapshot;
mod source;
mod transport;

pub use snapshot::EngineStatusSnapshot;

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
    /// Desired bs2b passthrough, read by `probes::install_crossfeed_passthrough_guard`.
    crossfeed_bypass: Arc<AtomicBool>,
    rgvolume: gst::Element,
    rgvolume_child: Option<gst_base::BaseTransform>,
    rglimiter: gst::Element,
    spectrum: gst::Element,
    volume: gst::Element,
    queue_sink: gst::Element,
    sink: gst::Element,
    audio_buffer_ms: u64,
    dsp_block_size: usize,
    state: PlaybackState,
    cached_duration: Option<Duration>,
    dsp_params: DspParams,
    cached_capabilities: DspCapabilities,
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
    /// Deferred seek target stored while the pipeline was `State::Null` (or unprerolled),
    /// applied silently in `State::Paused` before transitioning to `Playing`.
    pending_seek: Option<Duration>,
    seek_seq: u64,
    source_gen: u64,
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
    /// The element `freeverb` is linked after: the output queue, so reverb (like the other
    /// steady effects downstream) is applied in the sink-paced thread and heard sooner.
    fn reverb_upstream(&self) -> &gst::Element {
        &self.queue_sink
    }

    /// Pushes the stored graphic EQ gains to the filter, or flat gains while the EQ is off,
    /// so a disabled equaliser never colours the sound.
    fn apply_equalizer_bands(&self) {
        for i in 0..10 {
            let val = if self.equalizer_state.enabled {
                self.equalizer_state.bands[i]
            } else {
                0.0
            };
            self.equalizer.set_property(&format!("band{i}"), val);
        }
    }

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

    /// Whether the limiter should run, from the user switch and the ReplayGain settings.
    fn effective_limiter_enabled(&self) -> bool {
        domain::replaygain::effective_limiter_enabled(
            self.dynamics_state.limiter.enabled,
            self.replaygain_config.mode,
            self.replaygain_config.prevent_clipping,
        )
    }

    /// The only writer of `rglimiter.enabled`: every limiter or ReplayGain change goes through here,
    /// so the order of those changes no longer decides the result.
    fn apply_limiter_state(&self) {
        self.rglimiter
            .set_property("enabled", self.effective_limiter_enabled());
    }
}

/// Thread-safe audio pipeline controller.
#[derive(Clone)]
pub struct AudioEngine {
    inner: Arc<Mutex<PipelineInner>>,
    queue: Arc<Mutex<PlaybackQueue>>,
    stop_after_current: Arc<AtomicBool>,
    fade_generation: Arc<AtomicU64>,
    /// Bumped on every DSP parameter change; the debounced flush resync runs only for the latest.
    dsp_resync_gen: Arc<AtomicU64>,
    is_fading_in: Arc<AtomicBool>,
    volume_element: gst::Element,
    atomic_volume: Arc<AtomicU64>,
    /// Persistent fader worker handle (exits cleanly when the last engine clone drops).
    volume_fader: Option<fades::VolumeFader>,
    /// Fast lock-free mirror of `silence_trimming_config.enabled` checked on every ticker frame.
    silence_trimming_enabled: Arc<AtomicBool>,
    /// Latched by the clip probes (`probes::install_clip_probes`) when a sample exceeds 0 dBFS.
    clip_latched: Arc<AtomicBool>,
    /// Serialises source teardown/load transitions without holding `inner` across GStreamer waits.
    source_lock: Arc<Mutex<()>>,
    /// Serialises control-plane reverb graph relink operations outside `inner`.
    reverb_switch_lock: Arc<Mutex<()>>,
    /// Latest desired reverb link state read by a deferred `IDLE` probe when paused.
    reverb_target: Arc<AtomicBool>,
    /// Prevents stacking multiple deferred `IDLE` probes if `reverb` toggles while paused.
    reverb_probe_pending: Arc<AtomicBool>,
    /// Spectrum frames held until the sink plays their audio (`bus::release_heard_spectrum`).
    /// Touched only by the playback ticker and `stop`, never by a streaming thread.
    spectrum_sync: Arc<Mutex<crate::spectrum_sync::SpectrumSync<gst::Message>>>,
}

/// Releases the GStreamer resources safely when the pipeline controller is dropped.
impl Drop for PipelineInner {
    fn drop(&mut self) {
        let _ = self.pipeline.set_state(gst::State::Null);
    }
}
