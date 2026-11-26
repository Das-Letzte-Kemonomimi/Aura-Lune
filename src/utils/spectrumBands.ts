/** Przetwarzanie pasm widma dla wizualizacji: składanie L+R, wzmocnienie, wygładzanie niezależne od FPS, szczyty. */
import { fallPerSec, smoothTo, tauFromFrameLerp } from './smoothing';

/** Liczba pasm z backendu (przy 32 wartościach: 16 L + 16 R). */
export const BAND_COUNT = 16;

/** Wygładzanie słupków — dawne 0.45 na klatkę 60 Hz. */
export const BAND_SMOOTH_TAU = tauFromFrameLerp(0.45);
/** Opadanie kapturków szczytu — dawne 0.016 na klatkę 60 Hz. */
export const PEAK_FALL_PER_SEC = fallPerSec(0.016);
/** Poniżej tej wartości pasmo/szczyt uznajemy za wygaszone. */
const SETTLED_EPSILON = 0.001;

/**
 * Składa pasma do `out` (bez alokacji) i zwraca ich liczbę:
 * 32+ wartości → 16 pasm (średnia L i R), 1..31 → bez zmian, brak danych → 16 zer.
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

/** Nieliniowy boost, aby słupki żywo skakały na pełną wysokość. */
export function boostBand(raw: number): number {
  const clamped = Math.min(1.0, Math.max(0.0, raw));
  return Math.min(1.0, Math.pow(clamped, 0.72) * 1.35);
}

export interface BandState {
  smoothed: number[];
  peaks: number[];
}

/**
 * Aktualizuje wygładzone wartości i szczyty o `dt` sekund. Zwraca `true`, dopóki cokolwiek się zmienia
 * (można uśpić pętlę, gdy zwróci `false`).
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
 * Indeks pasma dla promienia `i` w trybie „circular”. Zachowuje dotychczasowy układ
 * (wartości 0..n/2, powtarzane) — pasma powyżej n/2 nie są w tym trybie pokazywane.
 */
export function circularBandIndex(i: number, bandCount: number): number {
  return Math.abs((i % bandCount) - Math.floor(bandCount / 2)) % bandCount;
}
