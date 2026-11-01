//! Kontrakt abstrakcyjnego backendu audio dla Auralune (Linux GStreamer vs Android Oboe/AAudio).

use crate::error::AudioEngineError;
use domain::crossfeed::CrossfeedConfig;
use domain::replaygain::ReplayGainConfig;
use domain::silence::SilenceTrimmingConfig;
use domain::PlaybackState;
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use std::time::Duration;

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

/// Abstrakcyjny interfejs niskopoziomowego silnika audio.
pub trait AudioBackend: Send + Sync {
    fn load_uri(&mut self, uri_or_path: &str) -> Result<(), AudioEngineError>;
    fn play(&mut self) -> Result<(), AudioEngineError>;
    fn play_with_fade(&mut self, fade: bool) -> Result<(), AudioEngineError>;
    fn play_with_fade_duration(&mut self, duration: Duration) -> Result<(), AudioEngineError>;
    fn pause(&mut self) -> Result<(), AudioEngineError>;
    fn pause_with_fade(&mut self, fade: bool) -> Result<(), AudioEngineError>;
    fn stop(&mut self) -> Result<(), AudioEngineError>;
    fn seek(&mut self, position: Duration) -> Result<(), AudioEngineError>;
    fn seek_with_fade(&mut self, position: Duration, fade: bool) -> Result<(), AudioEngineError>;
    fn position(&self) -> Option<Duration>;
    fn duration(&self) -> Option<Duration>;
    fn set_volume(&mut self, volume: f64) -> Result<(), AudioEngineError>;
    fn volume(&self) -> f64;
    fn set_dsp_params(&mut self, params: DspParams) -> Result<(), AudioEngineError>;
    fn dsp_params(&self) -> DspParams;
    fn set_reverb_params(
        &mut self,
        enabled: bool,
        room_size: f64,
        damping: f64,
        width: f64,
        level: f64,
    );
    fn reverb_params(&self) -> (bool, f64, f64, f64, f64);
    fn set_pitch_semitones(&mut self, semitones: f64) -> Result<(), AudioEngineError>;
    fn set_tempo_ratio(&mut self, tempo_ratio: f64) -> Result<(), AudioEngineError>;
    fn set_rate_ratio(&mut self, rate_ratio: f64) -> Result<(), AudioEngineError>;
    fn set_audio_buffer_duration_ms(&mut self, buffer_ms: u64) -> Result<(), AudioEngineError>;
    fn audio_buffer_duration_ms(&self) -> u64;
    fn set_dsp_block_size(&mut self, block_size: usize) -> Result<(), AudioEngineError>;
    fn dsp_block_size(&self) -> usize;
    fn set_dsp_engine(&mut self, engine: DspEngine) -> Result<(), AudioEngineError>;
    fn dsp_capabilities(&self) -> DspCapabilities;
    fn state(&self) -> PlaybackState;
    fn current_uri(&self) -> Option<String>;
    fn poll_events(&mut self) -> Vec<PlayerEvent>;
    fn get_equalizer_bands(&self) -> [f64; 10];
    fn is_equalizer_enabled(&self) -> bool;
    fn set_equalizer_enabled(&mut self, enabled: bool);
    fn set_equalizer_band(&mut self, band: usize, gain_db: f64) -> Result<(), AudioEngineError>;
    fn set_equalizer_bands(&mut self, bands: &[f64; 10]) -> Result<(), AudioEngineError>;
    fn set_replaygain(&mut self, config: ReplayGainConfig) -> Result<(), AudioEngineError>;
    fn apply_auto_replaygain(&mut self, is_same_album: bool, is_shuffle: bool);
    fn replaygain_config(&self) -> ReplayGainConfig;
    fn replaygain_status(&self) -> (f64, f64, bool);
    fn set_crossfeed(&mut self, config: CrossfeedConfig) -> Result<(), AudioEngineError>;
    fn crossfeed_config(&self) -> CrossfeedConfig;
    fn set_silence_trimming(
        &mut self,
        config: SilenceTrimmingConfig,
    ) -> Result<(), AudioEngineError>;
    fn silence_trimming_config(&self) -> SilenceTrimmingConfig;
    fn set_stereo_widener_active(&mut self, active: bool);
    fn set_stereo_widener_amount(&mut self, amount: f64);
    fn stereo_widener_params(&self) -> (bool, f64);
    fn set_limiter_enabled(&mut self, enabled: bool);
    fn is_limiter_enabled(&self) -> bool;
    fn set_crossfade_duration_ms(&mut self, duration_ms: u64);
    fn crossfade_duration_ms(&self) -> u64;
    fn is_playing(&self) -> bool;
    fn fade_out_volume(&mut self, duration: Duration);
}
