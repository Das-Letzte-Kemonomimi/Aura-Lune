/** Pure wave geometry functions (no canvas), testable in jsdom. */

const FALLBACK_LENGTH = 120;
const FALLBACK_VALUE = 30;

/** Returns peaks in the 0..100 range; empty data is replaced with a flat wave, NaN/∞ → 0. */
export function sanitizePeaks(peaks: readonly number[] | null | undefined): number[] {
  if (!peaks || peaks.length === 0) {
    return Array.from({ length: FALLBACK_LENGTH }, () => FALLBACK_VALUE);
  }
  return peaks.map((v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0));
}

/** Reduces the number of peaks to `target` (max pooling) so the bars fit in the width. */
export function resamplePeaks(peaks: readonly number[], target: number): number[] {
  const n = Math.floor(target);
  if (n < 1 || n >= peaks.length) return [...peaks];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * peaks.length) / n);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / n));
    let max = 0;
    for (let j = start; j < end && j < peaks.length; j++) max = Math.max(max, peaks[j]);
    out.push(max);
  }
  return out;
}

export interface BarLayout {
  /** Number of bars drawn. */
  count: number;
  barWidth: number;
  gap: number;
  /** Distance between the starts of consecutive bars. */
  step: number;
}

/**
 * Bar layout that fills exactly `width` (the first bar at 0, the last one ending at `width`),
 * so a bar's position matches the playback progress. When bars of width
 * `minBarWidth` do not fit, the number of bars is limited (instead of overflowing the canvas).
 */
export function computeBarLayout(
  width: number,
  availableBars: number,
  gap: number,
  minBarWidth: number,
): BarLayout {
  const safeWidth = Math.max(1, width);
  const maxCount = Math.max(1, Math.floor((safeWidth + gap) / (minBarWidth + gap)));
  const count = Math.max(1, Math.min(Math.floor(availableBars), maxCount));
  const barWidth = count === 1 ? safeWidth : (safeWidth - (count - 1) * gap) / count;
  return { count, barWidth, gap, step: barWidth + gap };
}
