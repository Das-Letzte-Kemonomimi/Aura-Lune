/** Pure wave geometry functions (no canvas), testable in jsdom. */
import type { SpectralBandTriple } from '../../types/analysis';

const FALLBACK_LENGTH = 120;
const FALLBACK_VALUE = 30;

/** Returns peaks in the 0..100 range; empty data is replaced with a flat wave, NaN/∞ → 0. */
export function sanitizePeaks(peaks: readonly number[] | null | undefined): number[] {
  if (!peaks || peaks.length === 0) {
    return Array.from({ length: FALLBACK_LENGTH }, () => FALLBACK_VALUE);
  }
  return peaks.map((v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0));
}

/** Clamps spectral `[low, mid, high]` triples to `0..1`, returning `[]` when no bands exist. */
export function sanitizeBands(
  bands: readonly SpectralBandTriple[] | null | undefined,
): SpectralBandTriple[] {
  if (!bands || bands.length === 0) return [];
  return bands.map(([l, m, h]) => [
    Number.isFinite(l) ? Math.min(1, Math.max(0, l)) : 0,
    Number.isFinite(m) ? Math.min(1, Math.max(0, m)) : 0,
    Number.isFinite(h) ? Math.min(1, Math.max(0, h)) : 0,
  ]);
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

/** Reduces spectral `[low, mid, high]` triples to `target` buckets via max-blended pooling. */
export function resampleBands(
  bands: readonly SpectralBandTriple[],
  target: number,
): SpectralBandTriple[] {
  if (bands.length === 0) return [];
  const n = Math.floor(target);
  if (n < 1 || n >= bands.length) return bands.map(([l, m, h]) => [l, m, h]);
  const out: SpectralBandTriple[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * bands.length) / n);
    const end = Math.max(start + 1, Math.floor(((i + 1) * bands.length) / n));
    let maxL = 0;
    let maxM = 0;
    let maxH = 0;
    let sumL = 0;
    let sumM = 0;
    let sumH = 0;
    let count = 0;
    for (let j = start; j < end && j < bands.length; j++) {
      const [l, m, h] = bands[j];
      if (l > maxL) maxL = l;
      if (m > maxM) maxM = m;
      if (h > maxH) maxH = h;
      sumL += l;
      sumM += m;
      sumH += h;
      count++;
    }
    const inv = count > 0 ? 1 / count : 0;
    out.push([
      maxL * 0.65 + sumL * inv * 0.35,
      maxM * 0.65 + sumM * inv * 0.35,
      maxH * 0.65 + sumH * inv * 0.35,
    ]);
  }
  return out;
}

/**
 * Maps a `[low, mid, high]` FFT band triple into an Aura-Lune neon RGB(A) color:
 * - Low (Bass): Rose/Pink `#f43f5e` (244, 63, 94)
 * - Mid (Body/Vocals): Purple `#a855f7` (168, 85, 247)
 * - High (Presence/Air): Cyan `#06b6d4` (6, 182, 212)
 */
export function spectralColor(band: SpectralBandTriple, alpha = 1): string {
  const [l, m, h] = band;
  // Slightly sharpen dominant frequency band so bass drops, vocals, and hi-hats stand apart.
  const wl = Math.pow(Math.max(0, l), 1.35);
  const wm = Math.pow(Math.max(0, m), 1.35);
  const wh = Math.pow(Math.max(0, h), 1.35);
  const sum = wl + wm + wh;
  if (sum <= 1e-4) {
    return alpha >= 0.999 ? 'rgb(168, 85, 247)' : `rgba(168, 85, 247, ${alpha})`;
  }
  const r = Math.round((wl * 244 + wm * 168 + wh * 6) / sum);
  const g = Math.round((wl * 63 + wm * 85 + wh * 182) / sum);
  const b = Math.round((wl * 94 + wm * 247 + wh * 212) / sum);
  return alpha >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
