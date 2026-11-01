pub mod analysis;
#[cfg(not(target_os = "linux"))]
pub mod android_backend;
pub mod backend;
pub mod device;
#[cfg(target_os = "linux")]
pub mod dsp_node;
pub mod error;
pub mod metadata_editor;
#[cfg(target_os = "linux")]
pub mod pipeline;
pub mod symphonia_decoder;
pub mod transcoder;

pub use analysis::{
    analyze_track_key_bpm, analyze_track_replaygain, write_replaygain_tags_to_file,
    ReplayGainAnalysisResult, TrackKeyBpm,
};
#[cfg(not(target_os = "linux"))]
pub use android_backend::AudioEngine;
pub use backend::{AudioBackend, PlayerEvent};
pub use device::DeviceManager;
pub use error::AudioEngineError;
pub use metadata_editor::{read_track_metadata, write_track_metadata, TrackMetadataFullDto};
#[cfg(target_os = "linux")]
pub use pipeline::AudioEngine;
pub use transcoder::Transcoder;
