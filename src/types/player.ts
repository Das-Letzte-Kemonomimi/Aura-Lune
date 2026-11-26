import type { PlaybackStatus } from './playback';
// Typy współdzielone są zdefiniowane w modułach domenowych (library / playback / audioDevices)
// i tutaj jedynie re-eksportowane — jedno źródło prawdy dla kontraktów z backendem.
export type { TrackRecord, AlbumRecord, ReleaseCandidateDto, SampleTrackDto } from './library';
export type { PlaybackStatus, DspCapabilities, DspPresetRecord, AlbumPlaybackBehavior } from './playback';
export type { AudioCard, AudioCardProfile } from './audioDevices';

export type DspEngineType = 'Bypass' | 'RubberBand' | 'SoundTouch';
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

export interface TrackBookmarkDto {
  id: number;
  track_id: number;
  name: string;
  position_ms: number;
  created_at: number;
}

