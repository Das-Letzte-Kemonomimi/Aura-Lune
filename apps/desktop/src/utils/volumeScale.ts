/**
 * Skala suwaka głośności.
 *
 * - `percent`: suwak jest liniowy względem amplitudy (pozycja = głośność, 0..1).
 * - `db`: suwak jest liniowy w decybelach — 100% = 0.0 dB (maksimum cyfrowe), a każdy 1% w dół
 *   obniża poziom o 0.3 dB (czyli 5% = 1.5 dB): 100% → 0.0 dB, 95% → -1.5 dB, 90% → -3.0 dB,
 *   89% → -3.3 dB. 0% to wyciszenie (-∞ dB).
 */

export type VolumeScaleUnit = 'percent' | 'db';

/** Spadek poziomu na każdy 1% suwaka w trybie dB. */
export const DB_PER_PERCENT = 0.3;
/** Krok klawiszy głośności (strzałki) — 5% pozycji suwaka. */
export const VOLUME_KEY_STEP_PERCENT = 5;

const SILENCE = 0.0001;

/** Poziom w dB dla amplitudy liniowej (0 → -∞). */
export function volumeToDb(volume: number): number {
  return volume <= SILENCE ? -Infinity : 20 * Math.log10(volume);
}

/** Etykieta poziomu, np. "-3.3 dB", "0.0 dB" albo "-∞ dB" (bez "-0.0"). */
export function formatDb(volume: number): string {
  const db = volumeToDb(volume);
  if (db === -Infinity) return '-∞ dB';
  const clamped = Math.min(0, db);
  return `${Math.abs(clamped) < 0.05 ? '0.0' : clamped.toFixed(1)} dB`;
}

/** Pozycja suwaka (0..1, krok 0.01) → amplituda liniowa wysyłana do silnika. */
export function sliderToVolume(position: number, unit: VolumeScaleUnit = 'percent'): number {
  const pos = Math.min(1, Math.max(0, position));
  if (unit !== 'db') return pos;
  const percent = Math.round(pos * 100);
  if (percent <= 0) return 0;
  if (percent >= 100) return 1;
  const db = -(100 - percent) * DB_PER_PERCENT;
  return Math.pow(10, db / 20);
}

/** Amplituda liniowa → pozycja suwaka (0..1); w trybie dB zaokrąglona do pełnego 1%. */
export function volumeToSlider(volume: number, unit: VolumeScaleUnit = 'percent'): number {
  const vol = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
  if (unit !== 'db') return vol;
  if (vol <= SILENCE) return 0;
  const percent = 100 + volumeToDb(vol) / DB_PER_PERCENT;
  return Math.min(100, Math.max(0, Math.round(percent))) / 100;
}

/** Nowa głośność po naciśnięciu klawisza głośności (±5% pozycji suwaka w aktywnej skali). */
export function stepVolume(volume: number, direction: 1 | -1, unit: VolumeScaleUnit = 'percent'): number {
  const current = Math.round(volumeToSlider(volume, unit) * 100);
  const next = Math.min(100, Math.max(0, current + direction * VOLUME_KEY_STEP_PERCENT));
  return sliderToVolume(next / 100, unit);
}
