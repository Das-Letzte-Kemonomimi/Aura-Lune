pub mod analysis;
pub mod device;
pub mod dsp_node;
pub mod error;
pub mod metadata_editor;
pub mod model_manager;
pub mod pipeline;
pub mod transcoder;

pub use analysis::{
    analyze_track_chords_and_grid, analyze_track_key_bpm, analyze_track_replaygain,
    detect_chords_from_samples, export_chords_to_chordpro, export_chords_to_json,
    export_chords_to_text, extract_beat_grid, extract_chroma_frame, generate_chord_templates,
    transpose_chord, viterbi_smooth_chords, write_replaygain_tags_to_file, ChordDef,
    ReplayGainAnalysisResult, TrackKeyBpm,
};
pub use device::DeviceManager;
pub use error::AudioEngineError;
pub use metadata_editor::{read_track_metadata, write_track_metadata, TrackMetadataFullDto};
pub use model_manager::{
    calculate_file_sha256, get_analysis_capabilities, get_default_model_catalog, get_models_dir,
    get_stems_cache_dir, list_available_models, remove_model_file, verify_file_sha256,
};
pub use pipeline::{AudioEngine, PlayerEvent};
pub use transcoder::Transcoder;
