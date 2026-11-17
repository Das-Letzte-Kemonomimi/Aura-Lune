import type { QueueItem } from './queue';

export type DspEngineType = 'Bypass' | 'RubberBand' | 'SoundTouch';

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
  is_default: boolean;
  active_profile: string | null;
  available_profiles: AudioCardProfile[];
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
