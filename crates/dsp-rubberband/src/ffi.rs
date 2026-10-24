//! FFI do biblioteki Rubber Band (C ABI z rubberband-c.h).

use std::os::raw::{c_double, c_float, c_int, c_uint, c_void};

pub type RubberBandState = *mut c_void;

pub const RUBBERBAND_OPTION_PROCESS_OFFLINE: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_PROCESS_REALTIME: c_int = 0x00000001;

pub const RUBBERBAND_OPTION_ENGINE_FASTER: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_ENGINE_FINER: c_int = 0x20000000;

pub const RUBBERBAND_OPTION_FORMANT_SHIFTED: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_FORMANT_PRESERVED: c_int = 0x01000000;

pub const RUBBERBAND_OPTION_PITCH_HIGH_SPEED: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_PITCH_HIGH_QUALITY: c_int = 0x02000000;
pub const RUBBERBAND_OPTION_PITCH_HIGH_CONSISTENCY: c_int = 0x04000000;

pub const RUBBERBAND_OPTION_CHANNELS_APART: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_CHANNELS_TOGETHER: c_int = 0x10000000;

pub const RUBBERBAND_OPTION_SMOOTHING_OFF: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_SMOOTHING_ON: c_int = 0x00800000;

pub const RUBBERBAND_OPTION_TRANSIENTS_CRISP: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_TRANSIENTS_MIXED: c_int = 0x00000100;
pub const RUBBERBAND_OPTION_TRANSIENTS_SMOOTH: c_int = 0x00000200;

pub const RUBBERBAND_OPTION_DETECTOR_COMPOUND: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_DETECTOR_PERCUSSIVE: c_int = 0x00000400;
pub const RUBBERBAND_OPTION_DETECTOR_SOFT: c_int = 0x00000800;

pub const RUBBERBAND_OPTION_WINDOW_STANDARD: c_int = 0x00000000;
pub const RUBBERBAND_OPTION_WINDOW_SHORT: c_int = 0x00100000;
pub const RUBBERBAND_OPTION_WINDOW_LONG: c_int = 0x00200000;

extern "C" {
    pub fn rubberband_new(
        sample_rate: c_uint,
        channels: c_uint,
        options: c_int,
        initial_time_ratio: c_double,
        initial_pitch_scale: c_double,
    ) -> RubberBandState;

    pub fn rubberband_delete(state: RubberBandState);
    pub fn rubberband_reset(state: RubberBandState);

    pub fn rubberband_set_time_ratio(state: RubberBandState, ratio: c_double);
    pub fn rubberband_set_pitch_scale(state: RubberBandState, scale: c_double);

    pub fn rubberband_get_time_ratio(state: RubberBandState) -> c_double;
    pub fn rubberband_get_pitch_scale(state: RubberBandState) -> c_double;

    pub fn rubberband_get_latency(state: RubberBandState) -> c_uint;
    pub fn rubberband_get_start_delay(state: RubberBandState) -> c_uint;
    pub fn rubberband_get_preferred_start_pad(state: RubberBandState) -> c_uint;

    pub fn rubberband_process(
        state: RubberBandState,
        input: *const *const c_float,
        samples: c_uint,
        final_: c_int,
    );

    pub fn rubberband_available(state: RubberBandState) -> c_int;

    pub fn rubberband_retrieve(
        state: RubberBandState,
        output: *const *mut c_float,
        samples: c_uint,
    ) -> c_uint;

    pub fn rubberband_get_channel_count(state: RubberBandState) -> c_uint;
}
