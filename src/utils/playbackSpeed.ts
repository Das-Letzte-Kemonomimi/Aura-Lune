/**
 * Playback speed relative to real time.
 *
 * `position_ms` from the backend is source time. In Bypass mode the sound flows bit-perfect at 1.0× speed;
 * in the other DSP engines the source time runs at `tempo * rate` speed.
 */
export interface PlaybackSpeedInput {
  engine?: string;
  tempo?: number;
  rate?: number;
  /** Explicit flag for whether DSP modulates the stream (overrides the inference from `engine`). */
  isDspActive?: boolean;
}

export function playbackSpeed({ engine, tempo, rate, isDspActive }: PlaybackSpeedInput): number {
  const dspActive = isDspActive !== undefined ? isDspActive : engine !== 'Bypass' && Boolean(engine);
  if (!dspActive) return 1;
  return Math.max(0.1, Math.min(4, (tempo || 1) * (rate || 1)));
}

export interface EffectivePitchInput {
  engine?: string;
  pitchSemitones?: number;
  rate?: number;
  /** Explicit flag for whether DSP modulates the stream (overrides the inference from `engine`). */
  isDspActive?: boolean;
}

/** Total pitch shift in semitones (explicit pitch + tape/vinyl rate shift) when DSP is active. */
export function effectivePitchSemitones({ engine, pitchSemitones, rate, isDspActive }: EffectivePitchInput): number {
  const dspActive = isDspActive !== undefined ? isDspActive : engine !== 'Bypass' && Boolean(engine);
  if (!dspActive) return 0;
  const rateSemitones = 12 * Math.log2(Math.max(0.01, rate || 1));
  return Math.round(((pitchSemitones ?? 0) + rateSemitones) * 100) / 100;
}
