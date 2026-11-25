pub mod analysis;
pub mod device;
pub mod dsp_node;
pub mod error;
pub mod hpss;
pub mod metadata_editor;
pub mod model_manager;
pub mod pipeline;
pub mod rt;
pub mod spectrum;
pub mod stem_separator;
pub(crate) mod sync;
pub mod transcoder;
pub mod uri;

pub use analysis::{
    analyze_track_chords_and_grid, analyze_track_key_bpm, analyze_track_replaygain,
    analyze_track_transcription, chord_emissions, decode_complete_for_analysis,
    decode_snippet_for_analysis, decode_stereo_for_stems, detect_chords_from_samples,
    detect_chords_with_grid, detect_notes_from_samples, detect_silence_bounds,
    export_chords_to_chordpro, export_chords_to_json, export_chords_to_text,
    export_transcription_to_json, export_transcription_to_midi, extract_beat_grid,
    extract_chroma_frame, extract_track_waveform_peaks, generate_chord_templates,
    midi_pitch_to_name, parse_chord_symbol, transpose_chord, viterbi_smooth_chords,
    write_replaygain_tags_to_file, ChordDef, ReplayGainAnalysisResult, TrackKeyBpm,
    WaveformAccumulator, CHORD_ANALYZER_VERSION, TRANSCRIPTION_ANALYZER_VERSION,
};
pub use device::DeviceManager;
pub use error::{AnalysisError, AudioEngineError, TagError};
pub use metadata_editor::{read_track_metadata, write_track_metadata, TrackMetadataFullDto};
pub use model_manager::{
    calculate_file_sha256, get_analysis_capabilities, get_default_model_catalog,
    get_model_packs_catalog, get_models_dir, get_stem_projects_cache_dir, get_stems_cache_dir,
    list_available_model_packs, list_available_models, remove_model_file, verify_file_sha256,
};
pub use pipeline::{AudioEngine, PlayerEvent};
pub use stem_separator::{write_wav_file, write_wav_file_stereo, StemSeparator};
pub use transcoder::Transcoder;
