//! AudioProcessor implementation for the Rubber Band library.

use crate::ffi::*;
use dsp_api::{
    semitones_to_pitch_ratio, AudioFormat, AudioProcessor, DspEngine, DspError, DspParams,
    ProcessStatus,
};
use tracing::debug;

/// DSP processor based on Rubber Band.
pub struct RubberBandProcessor {
    state: Option<RubberBandState>,
    format: Option<AudioFormat>,
    params: DspParams,
    in_channels: Vec<Vec<f32>>,
    in_ptrs: Vec<*const f32>,
    out_channels: Vec<Vec<f32>>,
    out_ptrs: Vec<*mut f32>,
}

// RubberBandState points to a C++ instance owned solely by this processor.
// rubberband_delete frees it in the Drop destructor.
unsafe impl Send for RubberBandProcessor {}

impl Default for RubberBandProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl RubberBandProcessor {
    /// Pulls every ready frame from the library and appends it (interleaved) to
    /// `output`. The channel buffers grow only on the first larger block, so the steady
    /// state does not allocate. Returns the number of frames pulled.
    fn retrieve_available(
        &mut self,
        state: RubberBandState,
        channels: usize,
        output: &mut Vec<f32>,
    ) -> usize {
        let mut total = 0;
        loop {
            let available = unsafe { rubberband_available(state) };
            if available <= 0 {
                break;
            }
            let avail_frames = available as usize;
            for (ptr, ch) in self
                .out_ptrs
                .iter_mut()
                .zip(&mut self.out_channels[..channels])
            {
                if ch.len() < avail_frames {
                    ch.resize(avail_frames, 0.0);
                }
                *ptr = ch.as_mut_ptr();
            }

            let retrieved = unsafe {
                rubberband_retrieve(state, self.out_ptrs.as_ptr(), avail_frames as u32) as usize
            };
            if retrieved == 0 {
                break;
            }

            total += retrieved;
            output.reserve(retrieved * channels);
            for f in 0..retrieved {
                output.extend(self.out_channels[..channels].iter().map(|ch| ch[f]));
            }
        }
        total
    }

    pub fn new() -> Self {
        Self {
            state: None,
            format: None,
            params: DspParams {
                engine: DspEngine::RubberBand,
                ..Default::default()
            },
            in_channels: Vec::new(),
            in_ptrs: Vec::new(),
            out_channels: Vec::new(),
            out_ptrs: Vec::new(),
        }
    }
}

impl Drop for RubberBandProcessor {
    fn drop(&mut self) {
        if let Some(state) = self.state.take() {
            unsafe {
                rubberband_delete(state);
            }
        }
    }
}

impl AudioProcessor for RubberBandProcessor {
    fn name(&self) -> &'static str {
        "RubberBand"
    }

    fn prepare(&mut self, format: AudioFormat, max_block_frames: usize) -> Result<(), DspError> {
        if let Some(old) = self.state.take() {
            unsafe {
                rubberband_delete(old);
            }
        }

        let channels = format.channels as usize;
        let sample_rate = format.sample_rate;

        // Rubber Band configuration:
        // - REALTIME + ENGINE_FASTER: efficient real-time engine (R2) with low CPU overhead
        // - PITCH_HIGH_QUALITY: highest pitch processing quality
        // - TRANSIENTS_CRISP + DETECTOR_COMPOUND: precise preservation of percussive transients
        // - WINDOW_STANDARD: balanced time-frequency window
        let mut options = RUBBERBAND_OPTION_PROCESS_REALTIME
            | RUBBERBAND_OPTION_ENGINE_FASTER
            | RUBBERBAND_OPTION_PITCH_HIGH_QUALITY
            | RUBBERBAND_OPTION_TRANSIENTS_CRISP
            | RUBBERBAND_OPTION_DETECTOR_COMPOUND
            | RUBBERBAND_OPTION_WINDOW_STANDARD;
        if channels > 1 {
            options |= RUBBERBAND_OPTION_CHANNELS_TOGETHER;
        }
        let initial_pitch = self.params.pitch_scale() * self.params.rate_ratio;
        let initial_time_ratio = 1.0 / (self.params.tempo_ratio * self.params.rate_ratio);

        let state = unsafe {
            rubberband_new(
                sample_rate,
                channels as u32,
                options,
                initial_time_ratio,
                initial_pitch,
            )
        };

        if state.is_null() {
            return Err(DspError::Internal {
                engine: "RubberBand",
                message: "rubberband_new returned a NULL pointer".to_string(),
            });
        }

        self.state = Some(state);
        self.format = Some(format);

        let safe_block = max_block_frames.max(8192);
        unsafe {
            rubberband_set_max_process_size(state, safe_block as u32);
        }

        self.in_channels = vec![Vec::with_capacity(1024); channels];
        self.in_ptrs = vec![std::ptr::null(); channels];
        self.out_channels = vec![vec![0.0f32; 8192]; channels];
        self.out_ptrs = vec![std::ptr::null_mut(); channels];

        debug!(
            "Initialised RubberBandProcessor for {} Hz, {} channels (max_process_size={})",
            sample_rate, channels, safe_block
        );
        Ok(())
    }

    fn set_params(&mut self, params: DspParams) -> Result<(), DspError> {
        params.validate()?;
        self.params = params;

        if let Some(state) = self.state {
            let pitch_scale = semitones_to_pitch_ratio(params.pitch_semitones) * params.rate_ratio;
            let time_ratio = 1.0 / (params.tempo_ratio * params.rate_ratio);

            unsafe {
                rubberband_set_pitch_scale(state, pitch_scale);
                rubberband_set_time_ratio(state, time_ratio);
            }
        }
        Ok(())
    }

    fn process(&mut self, input: &[f32], output: &mut Vec<f32>) -> Result<ProcessStatus, DspError> {
        let state = self.state.ok_or_else(|| DspError::Internal {
            engine: "RubberBand",
            message: "Processor not prepared (call prepare)".into(),
        })?;

        let format = self
            .format
            .ok_or_else(|| DspError::FormatError("No prepared format".into()))?;
        let channels = format.channels as usize;

        if input.is_empty() {
            return Ok(ProcessStatus::Buffering);
        }

        let chunk_size_frames = 1024;
        let chunk_size_samples = chunk_size_frames * channels;
        let mut total_retrieved = 0;

        for chunk in input.chunks(chunk_size_samples) {
            let cur_frames = chunk.len() / channels;

            // 1. De-interleave into the channel buffers
            for ch in &mut self.in_channels[..channels] {
                ch.clear();
            }
            for frame in chunk.chunks_exact(channels) {
                for (c, &sample) in frame.iter().enumerate() {
                    self.in_channels[c].push(sample);
                }
            }
            for (ptr, ch) in self.in_ptrs.iter_mut().zip(&self.in_channels[..channels]) {
                *ptr = ch.as_ptr();
            }

            // 2. Przetwarzanie w bibliotece Rubber Band
            unsafe {
                rubberband_process(state, self.in_ptrs.as_ptr(), cur_frames as u32, 0);
            }

            // 3. Pull all available processed frames
            total_retrieved += self.retrieve_available(state, channels, output);
        }

        if total_retrieved > 0 {
            Ok(ProcessStatus::Ok)
        } else {
            Ok(ProcessStatus::Buffering)
        }
    }

    fn latency_frames(&self) -> usize {
        if let Some(state) = self.state {
            unsafe { rubberband_get_latency(state) as usize }
        } else {
            0
        }
    }

    fn reset(&mut self) -> Result<(), DspError> {
        if let Some(state) = self.state {
            unsafe {
                rubberband_reset(state);
            }
        }
        for c in &mut self.in_channels {
            c.clear();
        }
        for c in &mut self.out_channels {
            c.clear();
        }
        Ok(())
    }

    fn drain(&mut self, output: &mut Vec<f32>) -> Result<ProcessStatus, DspError> {
        let state = match self.state {
            Some(s) => s,
            None => return Ok(ProcessStatus::Eos),
        };
        let format = match self.format {
            Some(f) => f,
            None => return Ok(ProcessStatus::Eos),
        };
        let channels = format.channels as usize;

        // Pass the final signal (final = 1) with valid channel buffer pointers
        for (ptr, ch) in self
            .in_ptrs
            .iter_mut()
            .zip(&mut self.in_channels[..channels])
        {
            if ch.is_empty() {
                ch.resize(1, 0.0);
            }
            *ptr = ch.as_ptr();
        }
        unsafe {
            rubberband_process(state, self.in_ptrs.as_ptr(), 0, 1);
        }

        if self.retrieve_available(state, channels, output) > 0 {
            Ok(ProcessStatus::Ok)
        } else {
            Ok(ProcessStatus::Eos)
        }
    }
}
