/**
 * Perceptual volume curve: maps the slider POSITION (0..1, what the user drags) to the
 * linear GAIN (0..1) that the engine, IPC, MPRIS and the `playback_volume` setting carry.
 * Linear gain on a slider puts almost every audible change in its bottom third, so the UI
 * always goes through this module. The maximum is unity gain (0 dB): no boost here.
 */

export type VolumeCurve = 'cubic' | 'db-linear';

export const VOLUME_CURVES: readonly VolumeCurve[] = ['cubic', 'db-linear'];

/** dB at the bottom of the `db-linear` curve (just above position 0, which is mute). */
export const VOLUME_DB_FLOOR = -60;

/** Slider position restored by a double-click on the volume slider. */
export const DEFAULT_VOLUME_POSITION = 0.7;

export function isVolumeCurve(value: unknown): value is VolumeCurve {
  return value === 'cubic' || value === 'db-linear';
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Slider position → linear gain. */
export function positionToGain(position: number, curve: VolumeCurve): number {
  const p = clamp01(position);
  if (curve === 'cubic') return p * p * p;
  if (p <= 0) return 0;
  return clamp01(10 ** ((VOLUME_DB_FLOOR - VOLUME_DB_FLOOR * p) / 20));
}

/** Linear gain → slider position (inverse of `positionToGain`). */
export function gainToPosition(gain: number, curve: VolumeCurve): number {
  const g = clamp01(gain);
  if (curve === 'cubic') return Math.cbrt(g);
  if (g <= 0) return 0;
  return clamp01(1 + (20 * Math.log10(g)) / -VOLUME_DB_FLOOR);
}

/** Linear gain → dB (`-Infinity` for silence). */
export function gainToDb(gain: number): number {
  if (!(gain > 0)) return -Infinity;
  return 20 * Math.log10(gain);
}

export interface VolumeStepModifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
}

/** Position step for one key press or wheel notch: 2%, Shift 0.5% (fine), Ctrl 5% (coarse). */
export function volumeStepSize({ shiftKey, ctrlKey }: VolumeStepModifiers): number {
  if (ctrlKey) return 0.05;
  if (shiftKey) return 0.005;
  return 0.02;
}

/** Signed position step for a wheel event: scrolling up (negative `deltaY`) is louder. */
export function wheelVolumeStep(deltaY: number, mods: VolumeStepModifiers): number {
  if (!deltaY) return 0;
  return deltaY < 0 ? volumeStepSize(mods) : -volumeStepSize(mods);
}

/** Moves the slider position of `gain` by `delta` and returns the resulting gain. */
export function stepVolumeGain(gain: number, delta: number, curve: VolumeCurve): number {
  const position = gainToPosition(gain, curve) + delta;
  // Round to 0.1%, so repeated steps land on the same positions in both directions.
  return positionToGain(Math.round(clamp01(position) * 1000) / 1000, curve);
}

export type VolumeIconLevel = 'mute' | 'low' | 'mid' | 'high';

/** Speaker icon for a slider position: mute / no waves (<33%) / one wave (<66%) / two waves. */
export function volumeIconFor(position: number): VolumeIconLevel {
  if (position <= 0) return 'mute';
  if (position < 0.33) return 'low';
  if (position < 0.66) return 'mid';
  return 'high';
}

export interface FormatVolumeOptions {
  /** Short form for tight spots (mini player): `-18dB`, `-∞`. */
  compact?: boolean;
}

/**
 * Readout for a linear gain: `%` is the slider POSITION on `curve`, dB is the real gain.
 * The one volume formatter; views get it through `useVolumeUnit().formatVolumeValue`.
 */
export function formatVolume(
  gain: number,
  unit: 'percent' | 'db',
  curve: VolumeCurve,
  { compact = false }: FormatVolumeOptions = {},
): string {
  if (unit === 'percent') return `${Math.round(gainToPosition(gain, curve) * 100)}%`;
  const db = gainToDb(gain);
  if (db === -Infinity) return compact ? '-∞' : '-∞ dB';
  // Never print "-0.0" for unity gain.
  const text = db > -0.05 ? '0.0' : db.toFixed(1);
  return compact ? `${db > -0.5 ? '0' : db.toFixed(0)}dB` : `${text} dB`;
}
