//! Główny potok odtwarzacza GStreamer z dynamicznym procesorem DSP.
//!
//! `AudioEngine` jest zdefiniowany tutaj (stan współdzielony, typy zdarzeń, pomocnicze funkcje);
//! metody są pogrupowane tematycznie w podmodułach (osobne bloki `impl AudioEngine`):
//! `graph`, `source`, `transport`, `fades`, `dsp`, `bus`, `queue_ops`, `equalizer`, `effects`.
//!
//! Kolejność blokad: `inner` może być trzymany podczas pobierania `queue`, nigdy odwrotnie.

mod bus;
mod dsp;
mod effects;
mod equalizer;
mod fades;
mod graph;
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
use domain::{slider_to_linear_gain, PlaybackState, StemChannel};
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use gst::prelude::*;
use gst_base::prelude::BaseTransformExt;
use gstreamer as gst;
use gstreamer_base as gst_base;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicU8, Ordering};
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
        let eq_p = if self.equalizer_state.enabled {
            self.eq_preamp_db
        } else {
            0.0
        };
        let peq_p = if self.parametric_eq_state.enabled {
            self.parametric_eq_state.preamp_db
        } else {
            0.0
        };
        let total_db = (eq_p + peq_p).clamp(-24.0, 12.0);
        let linear = 10.0f64.powf(total_db / 20.0);
        self.peq_preamp.set_property("volume", linear);
    }
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
    volume_element: gst::Element,
    atomic_volume: Arc<AtomicU64>,
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
