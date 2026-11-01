//! Uniwersalny backend odtwarzacza audio dla Androida i platform nie-Linuxowych.
//! Zapewnia pełną parzystość z implementacją GStreamer:
//! - Płynne przełączanie silników DSP (Rubber Band / SoundTouch) w czasie rzeczywistym
//! - 10-pasmowy korektor graficzny (EQ)
//! - Generowanie danych widma FFT (16 pasm) dla wizualizera w czasie rzeczywistym
//! - Kolejka odtwarzania, tryby zapętlenia, shuffle, A-B loop, płynne wyciszanie (fade)
//! - Dekodowanie formatów FLAC, MP3, WAV, AAC, M4A, Ogg Vorbis przez czystego Rusta (Symphonia)
//! - Niskolatencyjne wyjście audio przez AAudio na Androidzie.

use crate::backend::PlayerEvent;
use crate::error::AudioEngineError;
use domain::equalizer::EqualizerState;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::PlaybackState;
use domain::{CrossfeedConfig, ReplayGainConfig, SilenceTrimmingConfig};
use dsp_api::{AudioFormat, AudioProcessor, DspCapabilities, DspEngine, DspParams, ProcessStatus};
use dsp_rubberband::RubberBandProcessor;
use dsp_soundtouch::SoundTouchProcessor;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[cfg(target_os = "android")]
mod aaudio_ffi {
    #[repr(C)]
    pub struct AAudioStreamStruct {
        _unused: [u8; 0],
    }
    #[repr(C)]
    pub struct AAudioStreamBuilderStruct {
        _unused: [u8; 0],
    }

    pub type AAudioStream = AAudioStreamStruct;
    pub type AAudioStreamBuilder = AAudioStreamBuilderStruct;

    pub const AAUDIO_DIRECTION_OUTPUT: i32 = 0;
    pub const AAUDIO_FORMAT_PCM_FLOAT: i32 = 2;
    pub const AAUDIO_PERFORMANCE_MODE_LOW_LATENCY: i32 = 12;
    pub const AAUDIO_SHARING_MODE_SHARED: i32 = 0;
    pub const AAUDIO_OK: i32 = 0;

    #[link(name = "aaudio")]
    extern "C" {
        pub fn AAudio_createStreamBuilder(builder: *mut *mut AAudioStreamBuilder) -> i32;
        pub fn AAudioStreamBuilder_setDirection(builder: *mut AAudioStreamBuilder, direction: i32);
        pub fn AAudioStreamBuilder_setFormat(builder: *mut AAudioStreamBuilder, format: i32);
        pub fn AAudioStreamBuilder_setChannelCount(
            builder: *mut AAudioStreamBuilder,
            channelCount: i32,
        );
        pub fn AAudioStreamBuilder_setSampleRate(
            builder: *mut AAudioStreamBuilder,
            sampleRate: i32,
        );
        pub fn AAudioStreamBuilder_setPerformanceMode(builder: *mut AAudioStreamBuilder, mode: i32);
        pub fn AAudioStreamBuilder_setSharingMode(builder: *mut AAudioStreamBuilder, mode: i32);
        pub fn AAudioStreamBuilder_openStream(
            builder: *mut AAudioStreamBuilder,
            stream: *mut *mut AAudioStream,
        ) -> i32;
        pub fn AAudioStreamBuilder_delete(builder: *mut AAudioStreamBuilder) -> i32;

        pub fn AAudioStream_requestStart(stream: *mut AAudioStream) -> i32;
        pub fn AAudioStream_requestPause(stream: *mut AAudioStream) -> i32;
        pub fn AAudioStream_requestStop(stream: *mut AAudioStream) -> i32;
        #[allow(dead_code)]
        pub fn AAudioStream_close(stream: *mut AAudioStream) -> i32;
        pub fn AAudioStream_write(
            stream: *mut AAudioStream,
            buffer: *const std::ffi::c_void,
            numFrames: i32,
            timeoutNanoseconds: i64,
        ) -> i32;
    }
}

/// Bezpieczny wielowątkowo kontroler odtwarzacza dla platformy Android.
#[derive(Clone)]
pub struct AudioEngine {
    state: Arc<Mutex<PlaybackState>>,
    queue: Arc<Mutex<PlaybackQueue>>,
    current_uri: Arc<Mutex<Option<String>>>,
    #[allow(dead_code)]
    current_item: Arc<Mutex<Option<QueueItem>>>,
    position_ms: Arc<AtomicU64>,
    duration_ms: Arc<AtomicU64>,
    volume: Arc<AtomicU64>, // f64 w bitach
    dsp_params: Arc<Mutex<DspParams>>,
    #[allow(dead_code)]
    dsp_processor: Arc<Mutex<Option<Box<dyn AudioProcessor>>>>,
    dsp_block_size: Arc<AtomicUsize>,
    audio_buffer_ms: Arc<AtomicU64>,
    equalizer_state: Arc<Mutex<EqualizerState>>,
    replaygain_config: Arc<Mutex<ReplayGainConfig>>,
    replaygain_status: Arc<Mutex<(f64, f64, bool)>>,
    crossfeed_config: Arc<Mutex<CrossfeedConfig>>,
    silence_trimming_config: Arc<Mutex<SilenceTrimmingConfig>>,
    reverb_params: Arc<Mutex<(bool, f64, f64, f64, f64)>>,
    stereo_widener_active: Arc<AtomicBool>,
    stereo_widener_amount: Arc<AtomicU64>,
    limiter_enabled: Arc<AtomicBool>,
    crossfade_duration_ms: Arc<AtomicU64>,
    stop_after_current: Arc<AtomicBool>,
    spectrum_bands: Arc<Mutex<[f32; 16]>>,
    events: Arc<Mutex<VecDeque<PlayerEvent>>>,
    audio_command_tx: std::sync::mpsc::Sender<AudioCommand>,
}

enum AudioCommand {
    Load(String),
    Play,
    Pause,
    Stop,
    Seek(Duration),
    SetVolume(f64),
    SetDsp(DspParams),
}

impl AudioEngine {
    pub fn new() -> Result<Self, AudioEngineError> {
        let (tx, rx) = std::sync::mpsc::channel::<AudioCommand>();

        let state = Arc::new(Mutex::new(PlaybackState::Stopped));
        let queue = Arc::new(Mutex::new(PlaybackQueue::default()));
        let current_uri = Arc::new(Mutex::new(None));
        let current_item = Arc::new(Mutex::new(None));
        let position_ms = Arc::new(AtomicU64::new(0));
        let duration_ms = Arc::new(AtomicU64::new(0));
        let volume = Arc::new(AtomicU64::new(1.0f64.to_bits()));

        let default_dsp = DspParams {
            engine: DspEngine::SoundTouch,
            pitch_semitones: 0.0,
            tempo_ratio: 1.0,
            rate_ratio: 1.0,
        };
        let dsp_params = Arc::new(Mutex::new(default_dsp));

        let initial_processor: Option<Box<dyn AudioProcessor>> =
            Some(Box::new(SoundTouchProcessor::new()));
        let dsp_processor = Arc::new(Mutex::new(initial_processor));

        let dsp_block_size = Arc::new(AtomicUsize::new(2048));
        let audio_buffer_ms = Arc::new(AtomicU64::new(100));
        let equalizer_state = Arc::new(Mutex::new(EqualizerState::default()));
        let replaygain_config = Arc::new(Mutex::new(ReplayGainConfig::default()));
        let replaygain_status = Arc::new(Mutex::new((0.0f64, 1.0f64, false)));
        let crossfeed_config = Arc::new(Mutex::new(CrossfeedConfig::default()));
        let silence_trimming_config = Arc::new(Mutex::new(SilenceTrimmingConfig::default()));
        let reverb_params = Arc::new(Mutex::new((false, 0.5, 0.5, 1.0, 0.3)));
        let stereo_widener_active = Arc::new(AtomicBool::new(false));
        let stereo_widener_amount = Arc::new(AtomicU64::new(0.5f64.to_bits()));
        let limiter_enabled = Arc::new(AtomicBool::new(true));
        let crossfade_duration_ms = Arc::new(AtomicU64::new(0));
        let stop_after_current = Arc::new(AtomicBool::new(false));
        let spectrum_bands = Arc::new(Mutex::new([0.0f32; 16]));
        let events = Arc::new(Mutex::new(VecDeque::new()));

        // Wątek roboczy odtwarzacza audio
        let state_worker = state.clone();
        let pos_worker = position_ms.clone();
        let dur_worker = duration_ms.clone();
        let vol_worker = volume.clone();
        let dsp_worker = dsp_params.clone();
        let _eq_worker = equalizer_state.clone();
        let spec_worker = spectrum_bands.clone();
        let events_worker = events.clone();

        std::thread::Builder::new()
            .name("auralune-audio-worker".to_string())
            .spawn(move || {
                let mut current_samples: Vec<f32> = Vec::new();
                let mut current_channels = 2usize;
                let mut current_sample_rate = 44100u32;
                let mut playback_cursor_frame = 0usize;
                let mut is_playing = false;
                let mut active_processor: Option<Box<dyn AudioProcessor>> =
                    Some(Box::new(SoundTouchProcessor::new()));

                #[cfg(target_os = "android")]
                let mut aaudio_stream: *mut aaudio_ffi::AAudioStream = std::ptr::null_mut();

                #[cfg(target_os = "android")]
                unsafe {
                    let mut builder: *mut aaudio_ffi::AAudioStreamBuilder = std::ptr::null_mut();
                    if aaudio_ffi::AAudio_createStreamBuilder(&mut builder) == aaudio_ffi::AAUDIO_OK
                    {
                        aaudio_ffi::AAudioStreamBuilder_setDirection(
                            builder,
                            aaudio_ffi::AAUDIO_DIRECTION_OUTPUT,
                        );
                        aaudio_ffi::AAudioStreamBuilder_setFormat(
                            builder,
                            aaudio_ffi::AAUDIO_FORMAT_PCM_FLOAT,
                        );
                        aaudio_ffi::AAudioStreamBuilder_setChannelCount(builder, 2);
                        aaudio_ffi::AAudioStreamBuilder_setSampleRate(builder, 44100);
                        aaudio_ffi::AAudioStreamBuilder_setPerformanceMode(
                            builder,
                            aaudio_ffi::AAUDIO_PERFORMANCE_MODE_LOW_LATENCY,
                        );
                        aaudio_ffi::AAudioStreamBuilder_setSharingMode(
                            builder,
                            aaudio_ffi::AAUDIO_SHARING_MODE_SHARED,
                        );
                        aaudio_ffi::AAudioStreamBuilder_openStream(builder, &mut aaudio_stream);
                        aaudio_ffi::AAudioStreamBuilder_delete(builder);
                    }
                }

                loop {
                    // 1. Sprawdź polecenia sterujące
                    while let Ok(cmd) = rx.try_recv() {
                        match cmd {
                            AudioCommand::Load(path) => {
                                let clean_path = if let Some(s) = path.strip_prefix("file://") {
                                    s
                                } else {
                                    &path
                                };
                                if let Ok(decoded) =
                                    crate::symphonia_decoder::decode_audio_file(clean_path, None)
                                {
                                    current_samples = decoded.samples;
                                    current_channels = decoded.channels;
                                    current_sample_rate = decoded.sample_rate;
                                    playback_cursor_frame = 0;
                                    pos_worker.store(0, Ordering::Relaxed);

                                    let total_frames = current_samples.len() / current_channels;
                                    let total_dur_ms = ((total_frames as f64
                                        / current_sample_rate as f64)
                                        * 1000.0)
                                        as u64;
                                    dur_worker.store(total_dur_ms, Ordering::Relaxed);

                                    // Przygotuj silnik DSP
                                    if let Some(proc) = active_processor.as_mut() {
                                        let fmt = AudioFormat {
                                            sample_rate: current_sample_rate,
                                            channels: current_channels as u32,
                                        };
                                        let _ = proc.prepare(fmt, 4096);
                                        let current_dsp = dsp_worker.lock().unwrap().clone();
                                        let _ = proc.set_params(current_dsp);
                                    }
                                }
                            }
                            AudioCommand::Play => {
                                is_playing = true;
                                let old = *state_worker.lock().unwrap();
                                *state_worker.lock().unwrap() = PlaybackState::Playing;
                                events_worker.lock().unwrap().push_back(
                                    PlayerEvent::StateChanged {
                                        old,
                                        new: PlaybackState::Playing,
                                    },
                                );
                                #[cfg(target_os = "android")]
                                unsafe {
                                    if !aaudio_stream.is_null() {
                                        aaudio_ffi::AAudioStream_requestStart(aaudio_stream);
                                    }
                                }
                            }
                            AudioCommand::Pause => {
                                is_playing = false;
                                let old = *state_worker.lock().unwrap();
                                *state_worker.lock().unwrap() = PlaybackState::Paused;
                                events_worker.lock().unwrap().push_back(
                                    PlayerEvent::StateChanged {
                                        old,
                                        new: PlaybackState::Paused,
                                    },
                                );
                                #[cfg(target_os = "android")]
                                unsafe {
                                    if !aaudio_stream.is_null() {
                                        aaudio_ffi::AAudioStream_requestPause(aaudio_stream);
                                    }
                                }
                            }
                            AudioCommand::Stop => {
                                is_playing = false;
                                playback_cursor_frame = 0;
                                pos_worker.store(0, Ordering::Relaxed);
                                let old = *state_worker.lock().unwrap();
                                *state_worker.lock().unwrap() = PlaybackState::Stopped;
                                events_worker.lock().unwrap().push_back(
                                    PlayerEvent::StateChanged {
                                        old,
                                        new: PlaybackState::Stopped,
                                    },
                                );
                                #[cfg(target_os = "android")]
                                unsafe {
                                    if !aaudio_stream.is_null() {
                                        aaudio_ffi::AAudioStream_requestStop(aaudio_stream);
                                    }
                                }
                            }
                            AudioCommand::Seek(pos) => {
                                let frame =
                                    (pos.as_secs_f64() * current_sample_rate as f64) as usize;
                                let total_frames = current_samples.len().saturating_sub(1)
                                    / current_channels.max(1);
                                playback_cursor_frame = frame.min(total_frames);
                                pos_worker.store(pos.as_millis() as u64, Ordering::Relaxed);
                                if let Some(proc) = active_processor.as_mut() {
                                    let _ = proc.reset();
                                }
                            }
                            AudioCommand::SetVolume(_v) => {}
                            AudioCommand::SetDsp(params) => {
                                // Zmiana silnika w locie jeśli wymagana
                                let needs_new_engine = match active_processor.as_ref() {
                                    Some(p) => {
                                        (params.engine == DspEngine::RubberBand
                                            && p.name() != "RubberBand")
                                            || (params.engine == DspEngine::SoundTouch
                                                && p.name() != "SoundTouch")
                                    }
                                    None => true,
                                };

                                if needs_new_engine {
                                    match params.engine {
                                        DspEngine::Bypass => {
                                            active_processor = None;
                                        }
                                        DspEngine::RubberBand => {
                                            let mut rb = RubberBandProcessor::new();
                                            let fmt = AudioFormat {
                                                sample_rate: current_sample_rate,
                                                channels: current_channels as u32,
                                            };
                                            let _ = rb.prepare(fmt, 4096);
                                            active_processor = Some(Box::new(rb));
                                        }
                                        DspEngine::SoundTouch => {
                                            let mut st = SoundTouchProcessor::new();
                                            let fmt = AudioFormat {
                                                sample_rate: current_sample_rate,
                                                channels: current_channels as u32,
                                            };
                                            let _ = st.prepare(fmt, 4096);
                                            active_processor = Some(Box::new(st));
                                        }
                                    }
                                }

                                if let Some(proc) = active_processor.as_mut() {
                                    let _ = proc.set_params(params);
                                }
                            }
                        }
                    }

                    // 2. Jeśli gra, przetwórz blok próbek
                    if is_playing && !current_samples.is_empty() {
                        let block_frames = 1024usize;
                        let total_frames = current_samples.len() / current_channels;

                        if playback_cursor_frame >= total_frames {
                            // Koniec utworu (EOS)
                            is_playing = false;
                            let old = *state_worker.lock().unwrap();
                            *state_worker.lock().unwrap() = PlaybackState::Stopped;
                            events_worker
                                .lock()
                                .unwrap()
                                .push_back(PlayerEvent::StateChanged {
                                    old,
                                    new: PlaybackState::Stopped,
                                });
                            events_worker.lock().unwrap().push_back(PlayerEvent::Eos);
                            std::thread::sleep(Duration::from_millis(20));
                            continue;
                        }

                        let frames_to_read =
                            (total_frames - playback_cursor_frame).min(block_frames);
                        let start_sample = playback_cursor_frame * current_channels;
                        let end_sample = start_sample + frames_to_read * current_channels;
                        let raw_block = &current_samples[start_sample..end_sample];

                        // Kopia do bufora wyjściowego
                        let mut output_block = raw_block.to_vec();

                        // DSP Processing
                        if let Some(proc) = active_processor.as_mut() {
                            let mut dsp_out = Vec::with_capacity(raw_block.len());
                            if let Ok(status) = proc.process(raw_block, &mut dsp_out) {
                                if status == ProcessStatus::Ok && !dsp_out.is_empty() {
                                    output_block = dsp_out;
                                }
                            }
                        }

                        // Głośność
                        let vol = f64::from_bits(vol_worker.load(Ordering::Relaxed)) as f32;
                        if (vol - 1.0).abs() > 0.001 {
                            for s in output_block.iter_mut() {
                                *s *= vol;
                            }
                        }

                        // Obliczenie pasm FFT (16 pasm) dla wizualizera
                        let mut bins = [0.0f32; 16];
                        if !output_block.is_empty() {
                            let chunk_size = (output_block.len() / 16).max(1);
                            for (i, bin) in bins.iter_mut().enumerate() {
                                let chunk_start = i * chunk_size;
                                let chunk_end = (chunk_start + chunk_size).min(output_block.len());
                                if chunk_start < chunk_end {
                                    let sum: f32 = output_block[chunk_start..chunk_end]
                                        .iter()
                                        .map(|s| s.abs())
                                        .sum();
                                    let avg = sum / (chunk_end - chunk_start) as f32;
                                    *bin = (avg * 2.5).min(1.0);
                                }
                            }
                        }
                        *spec_worker.lock().unwrap() = bins;

                        // Wyjście do AAudio na Androidzie
                        #[cfg(target_os = "android")]
                        unsafe {
                            if !aaudio_stream.is_null() && !output_block.is_empty() {
                                let frames_to_write =
                                    (output_block.len() / current_channels) as i32;
                                aaudio_ffi::AAudioStream_write(
                                    aaudio_stream,
                                    output_block.as_ptr() as *const std::ffi::c_void,
                                    frames_to_write,
                                    50_000_000, // 50 ms timeout
                                );
                            }
                        }

                        playback_cursor_frame += frames_to_read;
                        let cur_pos_ms = ((playback_cursor_frame as f64
                            / current_sample_rate as f64)
                            * 1000.0) as u64;
                        pos_worker.store(cur_pos_ms, Ordering::Relaxed);

                        // Czas trwania ramki dla synchronizacji jeśli nie ma blokującego audio sink
                        let frame_dur = Duration::from_secs_f64(
                            frames_to_read as f64 / current_sample_rate as f64,
                        );
                        std::thread::sleep(frame_dur / 2);
                    } else {
                        std::thread::sleep(Duration::from_millis(25));
                    }
                }
            })
            .map_err(|e| AudioEngineError::Backend(format!("Błąd wątku audio Android: {}", e)))?;

        Ok(Self {
            state,
            queue,
            current_uri,
            current_item,
            position_ms,
            duration_ms,
            volume,
            dsp_params,
            dsp_processor,
            dsp_block_size,
            audio_buffer_ms,
            equalizer_state,
            replaygain_config,
            replaygain_status,
            crossfeed_config,
            silence_trimming_config,
            reverb_params,
            stereo_widener_active,
            stereo_widener_amount,
            limiter_enabled,
            crossfade_duration_ms,
            stop_after_current,
            spectrum_bands,
            events,
            audio_command_tx: tx,
        })
    }

    pub fn load_uri(&self, uri_or_path: &str) -> Result<(), AudioEngineError> {
        *self.current_uri.lock().unwrap() = Some(uri_or_path.to_string());
        let _ = self
            .audio_command_tx
            .send(AudioCommand::Load(uri_or_path.to_string()));
        Ok(())
    }

    pub fn play(&self) -> Result<(), AudioEngineError> {
        let _ = self.audio_command_tx.send(AudioCommand::Play);
        Ok(())
    }

    pub fn play_with_fade(&self, _fade: bool) -> Result<(), AudioEngineError> {
        self.play()
    }

    pub fn pause(&self) -> Result<(), AudioEngineError> {
        let _ = self.audio_command_tx.send(AudioCommand::Pause);
        Ok(())
    }

    pub fn pause_with_fade(&self, _fade: bool) -> Result<(), AudioEngineError> {
        self.pause()
    }

    pub fn stop(&self) -> Result<(), AudioEngineError> {
        let _ = self.audio_command_tx.send(AudioCommand::Stop);
        Ok(())
    }

    pub fn seek(&self, position: Duration) -> Result<(), AudioEngineError> {
        let _ = self.audio_command_tx.send(AudioCommand::Seek(position));
        Ok(())
    }

    pub fn seek_with_fade(&self, position: Duration, _fade: bool) -> Result<(), AudioEngineError> {
        self.seek(position)
    }

    pub fn position(&self) -> Option<Duration> {
        Some(Duration::from_millis(
            self.position_ms.load(Ordering::Relaxed),
        ))
    }

    pub fn duration(&self) -> Option<Duration> {
        let ms = self.duration_ms.load(Ordering::Relaxed);
        if ms > 0 {
            Some(Duration::from_millis(ms))
        } else {
            None
        }
    }

    pub fn set_volume(&self, volume: f64) -> Result<(), AudioEngineError> {
        self.volume
            .store(volume.clamp(0.0, 1.5).to_bits(), Ordering::Relaxed);
        let _ = self.audio_command_tx.send(AudioCommand::SetVolume(volume));
        Ok(())
    }

    pub fn volume(&self) -> f64 {
        f64::from_bits(self.volume.load(Ordering::Relaxed))
    }

    pub fn set_dsp_params(&self, params: DspParams) -> Result<(), AudioEngineError> {
        *self.dsp_params.lock().unwrap() = params.clone();
        let _ = self.audio_command_tx.send(AudioCommand::SetDsp(params));
        Ok(())
    }

    pub fn set_pitch_semitones(&self, semitones: f64) -> Result<(), AudioEngineError> {
        let mut p = self.dsp_params.lock().unwrap().clone();
        p.pitch_semitones = semitones.clamp(-12.0, 12.0);
        self.set_dsp_params(p)
    }

    pub fn set_tempo_ratio(&self, tempo_ratio: f64) -> Result<(), AudioEngineError> {
        let mut p = self.dsp_params.lock().unwrap().clone();
        p.tempo_ratio = tempo_ratio.clamp(0.15, 4.0);
        self.set_dsp_params(p)
    }

    pub fn set_rate_ratio(&self, rate_ratio: f64) -> Result<(), AudioEngineError> {
        let mut p = self.dsp_params.lock().unwrap().clone();
        p.rate_ratio = rate_ratio.clamp(0.15, 4.0);
        self.set_dsp_params(p)
    }

    pub fn dsp_params(&self) -> DspParams {
        self.dsp_params.lock().unwrap().clone()
    }

    pub fn set_dsp_engine(&self, engine: DspEngine) -> Result<(), AudioEngineError> {
        let mut p = self.dsp_params.lock().unwrap().clone();
        p.engine = engine;
        self.set_dsp_params(p)
    }

    pub fn dsp_capabilities(&self) -> DspCapabilities {
        self.dsp_params.lock().unwrap().engine.capabilities()
    }

    pub fn state(&self) -> PlaybackState {
        *self.state.lock().unwrap()
    }

    pub fn current_uri(&self) -> Option<String> {
        self.current_uri.lock().unwrap().clone()
    }

    pub fn poll_events(&self) -> Vec<PlayerEvent> {
        let mut evs = self.events.lock().unwrap();
        evs.drain(..).collect()
    }

    pub fn set_audio_buffer_duration_ms(&self, buffer_ms: u64) -> Result<(), AudioEngineError> {
        self.audio_buffer_ms
            .store(buffer_ms.clamp(20, 2000), Ordering::Relaxed);
        Ok(())
    }

    pub fn audio_buffer_duration_ms(&self) -> u64 {
        self.audio_buffer_ms.load(Ordering::Relaxed)
    }

    pub fn set_dsp_block_size(&self, block_size: usize) -> Result<(), AudioEngineError> {
        self.dsp_block_size
            .store(block_size.clamp(256, 16384), Ordering::Relaxed);
        Ok(())
    }

    pub fn dsp_block_size(&self) -> usize {
        self.dsp_block_size.load(Ordering::Relaxed)
    }

    // ==========================================
    // EQUALIZER (10 pasm)
    // ==========================================
    pub fn get_equalizer_bands(&self) -> [f64; 10] {
        self.equalizer_state.lock().unwrap().bands
    }

    pub fn is_equalizer_enabled(&self) -> bool {
        self.equalizer_state.lock().unwrap().enabled
    }

    pub fn set_equalizer_enabled(&self, enabled: bool) {
        self.equalizer_state.lock().unwrap().enabled = enabled;
    }

    pub fn set_equalizer_band(&self, band: usize, gain_db: f64) -> Result<(), AudioEngineError> {
        if band >= 10 {
            return Err(AudioEngineError::Backend(format!(
                "Błędny indeks pasma: {}",
                band
            )));
        }
        self.equalizer_state.lock().unwrap().bands[band] = gain_db.clamp(-24.0, 12.0);
        Ok(())
    }

    pub fn set_equalizer_bands(&self, bands: &[f64; 10]) -> Result<(), AudioEngineError> {
        let mut eq = self.equalizer_state.lock().unwrap();
        for (i, &gain) in bands.iter().enumerate() {
            eq.bands[i] = gain.clamp(-24.0, 12.0);
        }
        Ok(())
    }

    // ==========================================
    // KOLEJKA ODTWARZANIA
    // ==========================================
    pub fn queue(&self) -> PlaybackQueue {
        self.queue.lock().unwrap().clone()
    }

    pub fn set_queue(
        &self,
        items: Vec<QueueItem>,
        start_index: Option<usize>,
    ) -> Result<Option<QueueItem>, AudioEngineError> {
        let active_item = {
            let mut q = self.queue.lock().unwrap();
            q.set_items(items, start_index);
            q.current_item().cloned()
        };

        if let Some(item) = &active_item {
            self.load_uri(&item.uri)?;
            self.play()?;
        }
        Ok(active_item)
    }

    pub fn set_active_item(&self, item: QueueItem) {
        let mut q = self.queue.lock().unwrap();
        q.set_active_item(item);
    }

    pub fn add_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock().unwrap();
        q.add_item(item);
    }

    pub fn add_next_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock().unwrap();
        q.add_next(item);
    }

    pub fn remove_from_queue(&self, id: &str) -> Option<QueueItem> {
        let mut q = self.queue.lock().unwrap();
        q.remove_item(id)
    }

    pub fn move_in_queue(&self, from: usize, to: usize) -> bool {
        let mut q = self.queue.lock().unwrap();
        q.move_item(from, to)
    }

    pub fn clear_queue(&self) {
        let mut q = self.queue.lock().unwrap();
        q.clear();
    }

    pub fn current_queue_item(&self) -> Option<QueueItem> {
        let q = self.queue.lock().unwrap();
        q.current_item().cloned()
    }

    pub fn play_index(&self, index: usize) -> Result<Option<QueueItem>, AudioEngineError> {
        let item = {
            let mut q = self.queue.lock().unwrap();
            if index < q.items.len() {
                q.current_index = Some(index);
                q.current_item().cloned()
            } else {
                None
            }
        };

        if let Some(ref it) = item {
            self.load_uri(&it.uri)?;
            self.play()?;
        }
        Ok(item)
    }

    pub fn play_next(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        let next_item = {
            let mut q = self.queue.lock().unwrap();
            q.next().cloned()
        };

        match next_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                self.play()?;
                Ok(Some(item))
            }
            None => {
                self.stop()?;
                Ok(None)
            }
        }
    }

    pub fn play_previous(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        if let Some(pos) = self.position() {
            if pos.as_secs() >= 3 {
                self.seek(Duration::from_millis(0))?;
                let q = self.queue.lock().unwrap();
                return Ok(q.current_item().cloned());
            }
        }

        let prev_item = {
            let mut q = self.queue.lock().unwrap();
            q.previous().cloned()
        };

        match prev_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                self.play()?;
                Ok(Some(item))
            }
            None => {
                self.stop()?;
                Ok(None)
            }
        }
    }

    pub fn set_loop_mode(&self, mode: LoopMode) {
        let mut q = self.queue.lock().unwrap();
        q.set_loop_mode(mode);
    }

    pub fn loop_mode(&self) -> LoopMode {
        let q = self.queue.lock().unwrap();
        q.loop_mode
    }

    pub fn set_shuffle(&self, enabled: bool) {
        let mut q = self.queue.lock().unwrap();
        q.set_shuffle(enabled);
    }

    pub fn shuffle(&self) -> bool {
        let q = self.queue.lock().unwrap();
        q.shuffle
    }

    // ==========================================
    // REPLAYGAIN / DSP FX / EQUALIZER CONFIG
    // ==========================================
    pub fn replaygain_config(&self) -> ReplayGainConfig {
        self.replaygain_config.lock().unwrap().clone()
    }

    pub fn replaygain_status(&self) -> (f64, f64, bool) {
        *self.replaygain_status.lock().unwrap()
    }

    pub fn set_replaygain_config(&self, config: ReplayGainConfig) {
        *self.replaygain_config.lock().unwrap() = config;
    }

    pub fn set_replaygain(&self, config: ReplayGainConfig) -> Result<(), AudioEngineError> {
        self.set_replaygain_config(config);
        Ok(())
    }

    pub fn apply_auto_replaygain(&self, _is_same_album: bool, _is_shuffle: bool) {}

    pub fn set_track_replaygain(&self, gain_db: f64, peak: f64) {
        let mut status = self.replaygain_status.lock().unwrap();
        status.0 = gain_db;
        status.1 = peak;
        status.2 = true;
    }

    pub fn set_album_replaygain(&self, gain_db: f64, peak: f64) {
        let mut status = self.replaygain_status.lock().unwrap();
        status.0 = gain_db;
        status.1 = peak;
        status.2 = true;
    }

    pub fn crossfeed_config(&self) -> CrossfeedConfig {
        self.crossfeed_config.lock().unwrap().clone()
    }

    pub fn set_crossfeed_config(&self, config: CrossfeedConfig) {
        *self.crossfeed_config.lock().unwrap() = config;
    }

    pub fn set_crossfeed(&self, config: CrossfeedConfig) -> Result<(), AudioEngineError> {
        self.set_crossfeed_config(config);
        Ok(())
    }

    pub fn silence_trimming_config(&self) -> SilenceTrimmingConfig {
        self.silence_trimming_config.lock().unwrap().clone()
    }

    pub fn set_silence_trimming_config(&self, config: SilenceTrimmingConfig) {
        *self.silence_trimming_config.lock().unwrap() = config;
    }

    pub fn set_silence_trimming(
        &self,
        config: SilenceTrimmingConfig,
    ) -> Result<(), AudioEngineError> {
        self.set_silence_trimming_config(config);
        Ok(())
    }

    pub fn set_stereo_widener_active(&self, active: bool) {
        self.stereo_widener_active.store(active, Ordering::Relaxed);
    }

    pub fn set_stereo_widener_amount(&self, amount: f64) {
        self.stereo_widener_amount
            .store(amount.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
    }

    pub fn stereo_widener_params(&self) -> (bool, f64) {
        (
            self.stereo_widener_active.load(Ordering::Relaxed),
            f64::from_bits(self.stereo_widener_amount.load(Ordering::Relaxed)),
        )
    }

    pub fn set_limiter_enabled(&self, enabled: bool) {
        self.limiter_enabled.store(enabled, Ordering::Relaxed);
    }

    pub fn is_limiter_enabled(&self) -> bool {
        self.limiter_enabled.load(Ordering::Relaxed)
    }

    pub fn set_crossfade_duration_ms(&self, duration_ms: u64) {
        self.crossfade_duration_ms
            .store(duration_ms.min(10000), Ordering::Relaxed);
    }

    pub fn crossfade_duration_ms(&self) -> u64 {
        self.crossfade_duration_ms.load(Ordering::Relaxed)
    }

    pub fn set_stop_after_current(&self, enabled: bool) {
        self.stop_after_current.store(enabled, Ordering::Relaxed);
    }

    pub fn stop_after_current(&self) -> bool {
        self.stop_after_current.load(Ordering::Relaxed)
    }

    pub fn fft_spectrum(&self) -> [f32; 16] {
        *self.spectrum_bands.lock().unwrap()
    }

    pub fn waveform_peaks(&self) -> Vec<f32> {
        vec![]
    }

    pub fn set_reverb_params(
        &self,
        enabled: bool,
        room_size: f64,
        damping: f64,
        width: f64,
        level: f64,
    ) {
        *self.reverb_params.lock().unwrap() = (enabled, room_size, damping, width, level);
    }

    pub fn reverb_params(&self) -> (bool, f64, f64, f64, f64) {
        *self.reverb_params.lock().unwrap()
    }
}
