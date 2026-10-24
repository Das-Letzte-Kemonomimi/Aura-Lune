//! FFI do mostu C dla biblioteki SoundTouch.

use std::os::raw::{c_double, c_float, c_int, c_uint, c_void};

pub type SoundTouchHandle = *mut c_void;

extern "C" {
    pub fn soundtouch_create() -> SoundTouchHandle;
    pub fn soundtouch_destroy(handle: SoundTouchHandle);

    pub fn soundtouch_set_sample_rate(handle: SoundTouchHandle, sample_rate: c_uint) -> c_int;
    pub fn soundtouch_set_channels(handle: SoundTouchHandle, channels: c_uint) -> c_int;
    pub fn soundtouch_set_rate(handle: SoundTouchHandle, rate: c_double) -> c_int;
    pub fn soundtouch_set_tempo(handle: SoundTouchHandle, tempo: c_double) -> c_int;
    pub fn soundtouch_set_pitch(handle: SoundTouchHandle, pitch: c_double) -> c_int;
    pub fn soundtouch_set_pitch_semitones(handle: SoundTouchHandle, semitones: c_double) -> c_int;

    pub fn soundtouch_put_samples(
        handle: SoundTouchHandle,
        samples: *const c_float,
        num_frames: c_uint,
    ) -> c_int;

    pub fn soundtouch_receive_samples(
        handle: SoundTouchHandle,
        output: *mut c_float,
        max_frames: c_uint,
    ) -> c_uint;

    pub fn soundtouch_num_samples(handle: SoundTouchHandle) -> c_uint;

    pub fn soundtouch_flush(handle: SoundTouchHandle) -> c_int;
    pub fn soundtouch_clear(handle: SoundTouchHandle) -> c_int;

    pub fn soundtouch_set_setting(
        handle: SoundTouchHandle,
        setting_id: c_int,
        value: c_int,
    ) -> c_int;
    pub fn soundtouch_get_setting(handle: SoundTouchHandle, setting_id: c_int) -> c_int;
}

pub const SETTING_USE_AA_FILTER: c_int = 0;
pub const SETTING_AA_FILTER_LENGTH: c_int = 1;
pub const SETTING_USE_QUICKSEEK: c_int = 2;
pub const SETTING_SEQUENCE_MS: c_int = 3;
pub const SETTING_SEEKWINDOW_MS: c_int = 4;
pub const SETTING_OVERLAP_MS: c_int = 5;
pub const SETTING_NOMINAL_INPUT_SEQUENCE: c_int = 6;
pub const SETTING_NOMINAL_OUTPUT_SEQUENCE: c_int = 7;
pub const SETTING_INITIAL_LATENCY: c_int = 8;
