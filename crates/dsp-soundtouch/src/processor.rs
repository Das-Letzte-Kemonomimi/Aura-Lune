//! AudioProcessor implementation for the SoundTouch library.

use crate::ffi::*;
use dsp_api::{
    semitones_to_pitch_ratio, AudioFormat, AudioProcessor, DspEngine, DspError, DspParams,
    ProcessStatus,
};
use tracing::debug;

/// DSP processor based on SoundTouch.
pub struct SoundTouchProcessor {
    handle: Option<SoundTouchHandle>,
    format: Option<AudioFormat>,
    params: DspParams,
    out_buffer: Vec<f32>,
}

unsafe impl Send for SoundTouchProcessor {}

impl Default for SoundTouchProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl SoundTouchProcessor {
    pub fn new() -> Self {
        Self {
            handle: None,
            format: None,
            params: DspParams {
                engine: DspEngine::SoundTouch,
                ..Default::default()
            },
            out_buffer: Vec::new(),
        }
    }
}

impl Drop for SoundTouchProcessor {
    fn drop(&mut self) {
        if let Some(h) = self.handle.take() {
            unsafe {
                soundtouch_destroy(h);
            }
        }
    }
}

impl AudioProcessor for SoundTouchProcessor {
    fn name(&self) -> &'static str {
        "SoundTouch"
    }

    fn prepare(&mut self, format: AudioFormat, max_block_frames: usize) -> Result<(), DspError> {
        if let Some(old) = self.handle.take() {
            unsafe {
                soundtouch_destroy(old);
            }
        }

        let handle = unsafe { soundtouch_create() };
        if handle.is_null() {
            return Err(DspError::Internal {
                engine: "SoundTouch",
                message: "Failed to create a SoundTouch instance".to_string(),
            });
        }

        unsafe {
            soundtouch_set_sample_rate(handle, format.sample_rate);
            soundtouch_set_channels(handle, format.channels);

            // Enable the pitch transposer's anti-aliasing filter
            soundtouch_set_setting(handle, SETTING_USE_AA_FILTER, 1);
            // The maximum AA filter length (128 taps) greatly reduces hiss and artefacts
            soundtouch_set_setting(handle, SETTING_AA_FILTER_LENGTH, 128);
            // Disable quickseek in favour of the precise sample correlation algorithm
            soundtouch_set_setting(handle, SETTING_USE_QUICKSEEK, 0);
        }

        self.handle = Some(handle);
        self.format = Some(format);
        self.out_buffer = vec![0.0f32; max_block_frames * format.channels as usize * 4];

        // Apply the initial parameters
        self.set_params(self.params)?;

        debug!(
            "Initialised SoundTouchProcessor for {} Hz, {} channels (AA 128-tap, exact seek)",
            format.sample_rate, format.channels
        );
        Ok(())
    }

    fn set_params(&mut self, params: DspParams) -> Result<(), DspError> {
        params.validate()?;
        self.params = params;

        if let Some(handle) = self.handle {
            let pitch_ratio = semitones_to_pitch_ratio(params.pitch_semitones);
            unsafe {
                soundtouch_set_rate(handle, params.rate_ratio);
                soundtouch_set_tempo(handle, params.tempo_ratio);
                soundtouch_set_pitch(handle, pitch_ratio);

                // Adapt the parameters to the tempo for polyphonic music
                if params.tempo_ratio < 0.75 {
                    // A longer sequence and a steadier seek window remove wave jitter and metallic flutter
                    soundtouch_set_setting(handle, SETTING_SEQUENCE_MS, 75);
                    soundtouch_set_setting(handle, SETTING_SEEKWINDOW_MS, 25);
                    soundtouch_set_setting(handle, SETTING_OVERLAP_MS, 14);
                } else {
                    // Standard SoundTouch characteristics for music
                    soundtouch_set_setting(handle, SETTING_SEQUENCE_MS, 0);
                    soundtouch_set_setting(handle, SETTING_SEEKWINDOW_MS, 0);
                    soundtouch_set_setting(handle, SETTING_OVERLAP_MS, 8);
                }
            }
        }
        Ok(())
    }

    fn process(&mut self, input: &[f32], output: &mut Vec<f32>) -> Result<ProcessStatus, DspError> {
        let handle = self.handle.ok_or_else(|| DspError::Internal {
            engine: "SoundTouch",
            message: "Processor not prepared (call prepare)".into(),
        })?;

        let format = self
            .format
            .ok_or_else(|| DspError::FormatError("No prepared format".into()))?;
        let channels = format.channels as usize;

        if input.is_empty() {
            return Ok(ProcessStatus::Buffering);
        }

        let num_frames = input.len() / channels;

        unsafe {
            soundtouch_put_samples(handle, input.as_ptr(), num_frames as u32);
        }

        let max_recv_frames = self.out_buffer.len() / channels;
        let mut total_retrieved = 0;

        loop {
            let received = unsafe {
                soundtouch_receive_samples(
                    handle,
                    self.out_buffer.as_mut_ptr(),
                    max_recv_frames as u32,
                )
            } as usize;

            if received == 0 {
                break;
            }

            total_retrieved += received;
            output.extend_from_slice(&self.out_buffer[..received * channels]);
        }

        if total_retrieved > 0 {
            Ok(ProcessStatus::Ok)
        } else {
            Ok(ProcessStatus::Buffering)
        }
    }

    fn latency_frames(&self) -> usize {
        // SoundTouch buffers a minimum number of frames that depends on the parameters (usually <100ms)
        0
    }

    fn reset(&mut self) -> Result<(), DspError> {
        if let Some(handle) = self.handle {
            unsafe {
                soundtouch_clear(handle);
            }
        }
        Ok(())
    }

    fn drain(&mut self, output: &mut Vec<f32>) -> Result<ProcessStatus, DspError> {
        let handle = match self.handle {
            Some(h) => h,
            None => return Ok(ProcessStatus::Eos),
        };
        let format = match self.format {
            Some(f) => f,
            None => return Ok(ProcessStatus::Eos),
        };
        let channels = format.channels as usize;

        unsafe {
            soundtouch_flush(handle);
        }

        let max_recv_frames = self.out_buffer.len() / channels;
        let mut total_retrieved = 0;

        loop {
            let received = unsafe {
                soundtouch_receive_samples(
                    handle,
                    self.out_buffer.as_mut_ptr(),
                    max_recv_frames as u32,
                )
            } as usize;

            if received == 0 {
                break;
            }

            total_retrieved += received;
            output.extend_from_slice(&self.out_buffer[..received * channels]);
        }

        if total_retrieved > 0 {
            Ok(ProcessStatus::Ok)
        } else {
            Ok(ProcessStatus::Eos)
        }
    }
}
