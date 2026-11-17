import type { QueueItem } from './queue';

export type DspEngineType = 'Bypass' | 'RubberBand' | 'SoundTouch';
export type AlbumPlaybackBehavior = 'replace' | 'append' | 'single';

export interface AlbumRecord {
  id: number;
  title: string;
  album_artist: string;
  year: number | null;
  cover_path: string | null;
  release_mbid?: string | null;
}

export interface DspCapabilities {
  engine: DspEngineType;
  name: string;
  min_pitch_semitones: number;
  max_pitch_semitones: number;
  min_tempo_ratio: number;
  max_tempo_ratio: number;
  supports_formants: boolean;
  description: string;
}

export interface PlaybackStatus {
  state: 'Playing' | 'Paused' | 'Stopped';
  position_ms: number;
  duration_ms: number | null;
  volume: number;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
  engine: DspEngineType;
  capabilities: DspCapabilities;
  loop_mode?: 'None' | 'Track' | 'Queue';
  shuffle?: boolean;
  stop_after_current?: boolean;
  current_track?: QueueItem | null;
  equalizer_enabled?: boolean;
  equalizer_bands?: number[];
  parametric_eq_enabled?: boolean;
  compressor_enabled?: boolean;
  saturator_enabled?: boolean;
  limiter_enabled?: boolean;
  spectrum?: number[];
  replaygain_config?: {
    mode: 'Off' | 'Track' | 'Album';
    pre_amp_db: number;
  };
  replaygain_status?: [number, number, boolean];
  live_stream_title?: string | null;
  is_stems_active?: boolean;
  active_stem_project_id?: number | null;
}

export interface AudioCardProfile {
  name: string;
  description: string;
  available: boolean;
  is_pro_audio: boolean;
  bluetooth_codec: string | null;
}

export interface AudioCard {
  index: number;
  name: string;
  description: string;
  is_bluetooth?: boolean;
  is_default?: boolean;
  active_profile: string | null;
  profiles: AudioCardProfile[];
  available_profiles?: AudioCardProfile[];
}

export const DEFAULT_PLAYBACK_STATUS: PlaybackStatus = {
  state: 'Stopped',
  position_ms: 0,
  duration_ms: null,
  volume: 1.0,
  pitch_semitones: 0.0,
  tempo_ratio: 1.0,
  rate_ratio: 1.0,
  engine: 'Bypass',
  capabilities: {
    engine: 'Bypass',
    name: 'Direct Bypass (No DSP)',
    min_pitch_semitones: -24.0,
    max_pitch_semitones: 24.0,
    min_tempo_ratio: 0.15,
    max_tempo_ratio: 4.0,
    supports_formants: false,
    description: 'Bit-perfect direct stream without DSP (zero CPU overhead)',
  },
  equalizer_enabled: false,
  equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  parametric_eq_enabled: false,
  compressor_enabled: false,
  saturator_enabled: false,
  limiter_enabled: true,
  spectrum: Array(16).fill(0.05),
};

export interface TrackRecord {
  id: number;
  path: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album_id: number | null;
  disc_no: number | null;
  track_no: number | null;
  duration_ms: number;
  format: string;
  sample_rate: number;
  channels: number;
  bit_depth: number | null;
  file_size: number;
  modified_time: number;
  is_favorite?: boolean | null;
  play_count?: number | null;
  last_played_at?: number | null;
  total_play_time_ms?: number | null;
  replaygain_track_gain?: number | null;
  replaygain_track_peak?: number | null;
  rating?: number | null;
  bpm?: number | null;
  initial_key?: string | null;
}

export interface DspPresetRecord {
  id: number;
  name: string;
  engine: string;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
}

export interface ReleaseCandidateDto {
  mbid: string;
  title: string;
  artist: string;
  date: string | null;
  country: string | null;
  track_count: number | null;
  score: number;
}

export interface SampleTrackDto {
  path: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number;
}


