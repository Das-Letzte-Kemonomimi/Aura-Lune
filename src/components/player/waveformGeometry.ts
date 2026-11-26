/** Czyste funkcje geometrii fali (bez canvasu) — testowalne w jsdom. */

const FALLBACK_LENGTH = 120;
const FALLBACK_VALUE = 30;

/** Zwraca szczyty w zakresie 0..100; puste dane zastępuje płaską falą, NaN/∞ → 0. */
export function sanitizePeaks(peaks: readonly number[] | null | undefined): number[] {
  if (!peaks || peaks.length === 0) {
    return Array.from({ length: FALLBACK_LENGTH }, () => FALLBACK_VALUE);
  }
  return peaks.map((v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0));
}

/** Zmniejsza liczbę szczytów do `target` (max-pooling), by słupki mieściły się w szerokości. */
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
  /** Liczba rysowanych słupków. */
  count: number;
  barWidth: number;
  gap: number;
  /** Odległość między początkami kolejnych słupków. */
  step: number;
}

/**
 * Układ słupków wypełniający dokładnie `width` (pierwszy słupek przy 0, ostatni kończy się na `width`),
 * dzięki czemu pozycja słupka zgadza się z postępem odtwarzania. Gdy słupki o szerokości
 * `minBarWidth` nie mieszczą się, liczba słupków jest ograniczana (zamiast wychodzić poza płótno).
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
