/** Spectrum band processing for the visualisations: L+R folding, boost, FPS-independent smoothing, peaks. */
import { fallPerSec, smoothTo, tauFromFrameLerp } from './smoothing';

/** Number of bands from the backend (with 32 values: 16 L + 16 R). */
export const BAND_COUNT = 16;

/** Bar smoothing: formerly 0.45 per 60 Hz frame. */
export const BAND_SMOOTH_TAU = tauFromFrameLerp(0.45);
/** Peak cap decay: formerly 0.016 per 60 Hz frame. */
export const PEAK_FALL_PER_SEC = fallPerSec(0.016);
/** Below this value a band/peak counts as faded out. */
const SETTLED_EPSILON = 0.001;

/**
 * Folds the bands into `out` (without allocating) and returns their count:
 * 32+ values → 16 bands (average of L and R), 1..31 → unchanged, no data → 16 zeros.
 */
export function foldBands(spectrum: readonly number[] | undefined, out: number[]): number {
  if (spectrum && spectrum.length >= 32) {
    for (let i = 0; i < BAND_COUNT; i++) out[i] = (spectrum[i] + spectrum[i + BAND_COUNT]) * 0.5;
    return BAND_COUNT;
  }
  if (spectrum && spectrum.length > 0) {
    for (let i = 0; i < spectrum.length; i++) out[i] = spectrum[i];
    return spectrum.length;
  }
  for (let i = 0; i < BAND_COUNT; i++) out[i] = 0;
  return BAND_COUNT;
}

/** Non-linear boost so the bars jump lively to full height. */
export function boostBand(raw: number): number {
  const clamped = Math.min(1.0, Math.max(0.0, raw));
  return Math.min(1.0, Math.pow(clamped, 0.72) * 1.35);
}

export interface BandState {
  smoothed: number[];
  peaks: number[];
}

/**
 * Updates the smoothed values and peaks by `dt` seconds. Returns `true` while anything changes
 * (the loop can sleep when it returns `false`).
 */
export function updateBands(state: BandState, bands: readonly number[], count: number, isPlaying: boolean, dt: number): boolean {
  while (state.peaks.length < count) state.peaks.push(0);
  while (state.smoothed.length < count) state.smoothed.push(0);

  let moving = false;
  for (let i = 0; i < count; i++) {
    const target = isPlaying ? boostBand(bands[i]) : 0.0;
    const smoothed = smoothTo(state.smoothed[i], target, dt, BAND_SMOOTH_TAU);
    state.smoothed[i] = smoothed;

    if (smoothed > state.peaks[i]) {
      state.peaks[i] = smoothed;
    } else {
      state.peaks[i] = Math.max(0, state.peaks[i] - PEAK_FALL_PER_SEC * dt);
    }

    if (smoothed > SETTLED_EPSILON || state.peaks[i] > SETTLED_EPSILON) moving = true;
    else if (!isPlaying) {
      state.smoothed[i] = 0;
      state.peaks[i] = 0;
    }
  }
  return moving;
}

/**
 * Band index for ray `i` in "circular" mode. Keeps the existing layout
 * (values 0..n/2, repeated): bands above n/2 are not shown in this mode.
 */
export function circularBandIndex(i: number, bandCount: number): number {
  return Math.abs((i % bandCount) - Math.floor(bandCount / 2)) % bandCount;
}
