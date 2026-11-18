import type { QueueItem } from './queue';

export type AlbumPlaybackBehavior = 'replace' | 'append' | 'single';

export interface DspCapabilities {
  engine: 'Bypass' | 'RubberBand' | 'SoundTouch';
  name: string;
  min_pitch_semitones: number;
  max_pitch_semitones: number;
  min_tempo_ratio: number;
  max_tempo_ratio: number;
  supports_formants: boolean;
  description: string;
}

export interface DspPresetRecord {
  id: number;
  name: string;
  engine: string;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
}

export interface PlaybackStatus {
  state: 'Playing' | 'Paused' | 'Stopped';
  position_ms: number;
  duration_ms: number | null;
  volume: number;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
  engine: 'Bypass' | 'RubberBand' | 'SoundTouch';
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
