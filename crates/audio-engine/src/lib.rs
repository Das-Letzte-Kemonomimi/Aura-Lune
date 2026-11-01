pub mod analysis;
pub mod backend;
pub mod device;
#[cfg(target_os = "linux")]
pub mod dsp_node;
pub mod error;
pub mod metadata_editor;
pub mod pipeline;
#[cfg(target_os = "linux")]
pub mod transcoder;

pub use analysis::{
    analyze_track_key_bpm, analyze_track_replaygain, write_replaygain_tags_to_file,
    ReplayGainAnalysisResult, TrackKeyBpm,
};
pub use backend::{AudioBackend, PlayerEvent};
pub use device::DeviceManager;
pub use error::AudioEngineError;
pub use metadata_editor::{read_track_metadata, write_track_metadata, TrackMetadataFullDto};
pub use pipeline::AudioEngine;
#[cfg(target_os = "linux")]
pub use transcoder::Transcoder;
