export interface ChordSegment {
  start_ms: number;
  end_ms: number;
  chord: string;
  root_note: string;
  quality: string;
  bass_note?: string;
  confidence: number;
  beat: number;
  bar: number;
}

export interface BeatPoint {
  time_ms: number;
  beat_number: number;
  is_downbeat: boolean;
}

export interface TrackChordsData {
  track_id: number;
  file_hash: string;
  bpm: number;
  key: string;
  camelot: string;
  beat_grid: BeatPoint[];
  chords: ChordSegment[];
  analyzer_version: string;
}

export interface DetectedNote {
  onset_ms: number;
  duration_ms: number;
  midi_pitch: number;
  pitch_name: string;
  cents_offset: number;
  velocity: number;
  stem?: string;
}

export interface TrackTranscriptionData {
  track_id: number;
  file_hash: string;
  notes: DetectedNote[];
  bpm: number;
  analyzer_version: string;
}

export interface StemSeparationData {
  track_id: number;
  file_hash: string;
  model_name: string;
  stems_dir: string;
  vocals_path: string;
  drums_path: string;
  bass_path: string;
  other_path: string;
  piano_path?: string;
  guitar_path?: string;
}

export interface StemMixerState {
  enabled: boolean;
  vocals_volume: number;
  drums_volume: number;
  bass_volume: number;
  other_volume: number;
  piano_volume: number;
  guitar_volume: number;
  vocals_mute: boolean;
  drums_mute: boolean;
  bass_mute: boolean;
  other_mute: boolean;
  piano_mute: boolean;
  guitar_mute: boolean;
  solo_stem?: string;
  karaoke_mode: boolean;
}

export interface AiModelInfo {
  id: string;
  name: string;
  task_type: string;
  file_path: string;
  file_size: number;
  sha256: string;
  license: string;
  download_url?: string;
  is_installed: boolean;
  description: string;
}

export interface AnalysisCapabilities {
  hardware_acceleration: boolean;
  accelerator_device: string;
  stem_separation_available: boolean;
  chord_detection_available: boolean;
  note_transcription_available: boolean;
  installed_models: AiModelInfo[];
}

