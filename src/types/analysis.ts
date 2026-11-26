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

export type StemQualityTier = 'high_quality' | 'experimental' | 'dsp_fallback' | 'unavailable';
export type StemProjectStatus = 'queued' | 'separating' | 'ready' | 'failed';

export interface StemChannel {
  id: string;
  name: string;
  parent_stem?: string;
  file_path: string;
  color_hex: string;
  quality_tier: StemQualityTier;
  volume: number; // 0.0 .. 1.0 (domyślnie 0.75 = 0 dB)
  pan: number;    // -1.0 .. +1.0
  mute: boolean;
  solo: boolean;
}

export interface ChannelMixSetting {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface StemProjectMix {
  id?: number;
  project_id: number;
  name: string;
  is_default: boolean;
  channels: Record<string, ChannelMixSetting>;
  master_volume: number;
  updated_at: string;
}

export interface StemProject {
  id: number;
  track_id: number;
  track_hash: string;
  title: string;
  artist: string;
  album: string;
  cover_uri?: string;
  status: StemProjectStatus;
  progress: number;
  model_name: string;
  disk_size_bytes: number;
  channels: StemChannel[];
  active_mix_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelPackInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  unlocked_stems: string[];
  model_files: string[];
  total_size_bytes: number;
  license: string;
  source_url: string;
  sha256: string;
  is_installed: boolean;
  gpu_recommended: boolean;
  speed_estimate_sec_per_min: number;
}

export function sliderToLinearGain(slider: number): number {
  const v = Math.max(0.0, Math.min(1.0, slider));
  if (v <= 0.0001) return 0.0;
  if (v <= 0.75) {
    const norm = v / 0.75;
    return Math.pow(norm, 2.0);
  } else {
    const boostNorm = (v - 0.75) / 0.25;
    return 1.0 + boostNorm * (2.0 - 1.0);
  }
}

export function linearGainToSlider(gain: number): number {
  const g = Math.max(0.0, gain);
  if (g <= 0.0001) return 0.0;
  if (g <= 1.0) {
    return Math.sqrt(g) * 0.75;
  } else {
    const boostNorm = Math.min(1.0, (g - 1.0) / (2.0 - 1.0));
    return 0.75 + boostNorm * 0.25;
  }
}

export function sliderToDb(slider: number): number {
  const gain = sliderToLinearGain(slider);
  if (gain <= 0.00001) return -100.0;
  return 20.0 * Math.log10(gain);
}

export interface StemProjectProgressPayload {
  project_id: number;
  progress: number;
  message: string;
  status: StemProjectStatus;
}


