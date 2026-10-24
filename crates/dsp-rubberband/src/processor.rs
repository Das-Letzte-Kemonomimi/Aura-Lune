//! Implementacja cechy AudioProcessor dla biblioteki Rubber Band.

use crate::ffi::*;
use dsp_api::{
    semitones_to_pitch_ratio, AudioFormat, AudioProcessor, DspEngine, DspError, DspParams,
    ProcessStatus,
};
use tracing::debug;

/// Procesor DSP bazujący na Rubber Band.
pub struct RubberBandProcessor {
    state: Option<RubberBandState>,
    format: Option<AudioFormat>,
    params: DspParams,
    in_channels: Vec<Vec<f32>>,
    in_ptrs: Vec<*const f32>,
    out_channels: Vec<Vec<f32>>,
    out_ptrs: Vec<*mut f32>,
}

// RubberBandState jest wskaźnikiem na instancję C++ zarządzaną wyłącznie przez ten procesor.
// rubberband_delete zwalnia zasoby w destruktorze Drop.
unsafe impl Send for RubberBandProcessor {}

impl Default for RubberBandProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl RubberBandProcessor {
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

        // Konfiguracja Rubber Band:
        // - REALTIME + ENGINE_FASTER: wydajny silnik czasu rzeczywistego (R2) z niskim narzutem CPU
        // - PITCH_HIGH_QUALITY: najwyższa jakość przetwarzania wysokości tonu
        // - TRANSIENTS_CRISP + DETECTOR_COMPOUND: precyzyjne zachowanie transjentów perkusyjnych
        // - WINDOW_STANDARD: zbalansowane okno czasowo-częstotliwościowe
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
                message: "rubberband_new zwrócił wskaźnik NULL".to_string(),
            });
        }

        self.state = Some(state);
        self.format = Some(format);

        let safe_block = max_block_frames.max(4096);
        self.in_channels = vec![Vec::with_capacity(safe_block); channels];
        self.in_ptrs = vec![std::ptr::null(); channels];
        self.out_channels = vec![vec![0.0f32; safe_block * 4]; channels];
        self.out_ptrs = vec![std::ptr::null_mut(); channels];

        debug!(
            "Zainicjalizowano RubberBandProcessor dla {} Hz, {} kanałów",
            sample_rate, channels
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
            message: "Procesor nie został przygotowany (wywołaj prepare)".into(),
        })?;

        let format = self
            .format
            .ok_or_else(|| DspError::FormatError("Brak przygotowanego formatu".into()))?;
        let channels = format.channels as usize;

        if input.is_empty() {
            return Ok(ProcessStatus::Buffering);
        }

        let num_frames = input.len() / channels;

        // 1. De-interleave do buforów kanałowych
        for c in 0..channels {
            self.in_channels[c].clear();
        }
        for frame in input.chunks_exact(channels) {
            for (c, &sample) in frame.iter().enumerate() {
                self.in_channels[c].push(sample);
            }
        }
        for c in 0..channels {
            self.in_ptrs[c] = self.in_channels[c].as_ptr();
        }

        // 2. Przetwarzanie w bibliotece Rubber Band
        unsafe {
            rubberband_process(state, self.in_ptrs.as_ptr(), num_frames as u32, 0);
        }

        // 3. Pobranie wszystkich dostępnych przetworzonych ramek (w pętli, aby uniknąć głodzenia bufora)
        let mut total_retrieved = 0;
        loop {
            let available = unsafe { rubberband_available(state) };
            if available <= 0 {
                break;
            }
            let avail_frames = available as usize;
            for c in 0..channels {
                if self.out_channels[c].len() < avail_frames {
                    self.out_channels[c].resize(avail_frames, 0.0);
                }
                self.out_ptrs[c] = self.out_channels[c].as_mut_ptr();
            }

            let retrieved = unsafe {
                rubberband_retrieve(state, self.out_ptrs.as_ptr(), avail_frames as u32) as usize
            };

            if retrieved == 0 {
                break;
            }

            total_retrieved += retrieved;
            output.reserve(retrieved * channels);
            for f in 0..retrieved {
                for c in 0..channels {
                    output.push(self.out_channels[c][f]);
                }
            }
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

        // Przekazanie sygnału finalnego (final = 1) z prawidłowymi wskaźnikami buforów kanałów
        for c in 0..channels {
            if self.in_channels[c].is_empty() {
                self.in_channels[c].resize(1, 0.0);
            }
            self.in_ptrs[c] = self.in_channels[c].as_ptr();
        }
        unsafe {
            rubberband_process(state, self.in_ptrs.as_ptr(), 0, 1);
        }

        let mut retrieved_any = false;
        loop {
            let avail = unsafe { rubberband_available(state) };
            if avail <= 0 {
                break;
            }
            let avail_frames = avail as usize;
            for c in 0..channels {
                if self.out_channels[c].len() < avail_frames {
                    self.out_channels[c].resize(avail_frames, 0.0);
                }
                self.out_ptrs[c] = self.out_channels[c].as_mut_ptr();
            }

            let retrieved = unsafe {
                rubberband_retrieve(state, self.out_ptrs.as_ptr(), avail_frames as u32) as usize
            };

            if retrieved == 0 {
                break;
            }

            retrieved_any = true;
            output.reserve(retrieved * channels);
            for f in 0..retrieved {
                for c in 0..channels {
                    output.push(self.out_channels[c][f]);
                }
            }
        }

        if retrieved_any {
            Ok(ProcessStatus::Ok)
        } else {
            Ok(ProcessStatus::Eos)
        }
    }
}
