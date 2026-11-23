/**
 * Skala suwaka głośności.
 *
 * - `percent`: suwak jest liniowy względem amplitudy (pozycja = głośność, 0..1).
 * - `db`: suwak jest liniowy w decybelach — 100% = 0.0 dB (maksimum cyfrowe), a każde 5% w dół
 *   obniża poziom o `dbStep` dB (do wyboru 1.5 lub 1.2 dB). Dla 1.5 dB: 100% → 0.0 dB,
 *   95% → -1.5 dB, 90% → -3.0 dB, 89% → -3.3 dB (0.3 dB na 1%). Dla 1.2 dB: 95% → -1.2 dB,
 *   90% → -2.4 dB (0.24 dB na 1%). 0% to wyciszenie (-∞ dB).
 */

export type VolumeScaleUnit = 'percent' | 'db';

/** Dozwolone wartości kroku w dB na każde 5% pozycji suwaka (tryb dB). */
export const DB_STEP_OPTIONS = [1.5, 1.2] as const;
export type VolumeDbStep = (typeof DB_STEP_OPTIONS)[number];
export const DEFAULT_DB_STEP: VolumeDbStep = 1.5;

/** Spadek poziomu na 1% suwaka dla domyślnego kroku (1.5 dB / 5%). */
export const DB_PER_PERCENT = DEFAULT_DB_STEP / 5;

/** Zamienia dowolną wartość (np. z localStorage) na dozwolony krok, domyślnie 1.5 dB. */
export function normalizeDbStep(value: unknown): VolumeDbStep {
  const n = typeof value === 'string' ? Number(value) : value;
  return DB_STEP_OPTIONS.find((opt) => opt === n) ?? DEFAULT_DB_STEP;
}

const dbPerPercent = (dbStep: number): number => dbStep / 5;
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
export function sliderToVolume(
  position: number,
  unit: VolumeScaleUnit = 'percent',
  dbStep: number = DEFAULT_DB_STEP,
): number {
  const pos = Math.min(1, Math.max(0, position));
  if (unit !== 'db') return pos;
  const percent = Math.round(pos * 100);
  if (percent <= 0) return 0;
  if (percent >= 100) return 1;
  const db = -(100 - percent) * dbPerPercent(dbStep);
  return Math.pow(10, db / 20);
}

/** Amplituda liniowa → pozycja suwaka (0..1); w trybie dB zaokrąglona do pełnego 1%. */
export function volumeToSlider(
  volume: number,
  unit: VolumeScaleUnit = 'percent',
  dbStep: number = DEFAULT_DB_STEP,
): number {
  const vol = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
  if (unit !== 'db') return vol;
  if (vol <= SILENCE) return 0;
  const percent = 100 + volumeToDb(vol) / dbPerPercent(dbStep);
  return Math.min(100, Math.max(0, Math.round(percent))) / 100;
}

/** Nowa głośność po naciśnięciu klawisza głośności (±5% pozycji suwaka = jeden krok `dbStep` w trybie dB). */
export function stepVolume(
  volume: number,
  direction: 1 | -1,
  unit: VolumeScaleUnit = 'percent',
  dbStep: number = DEFAULT_DB_STEP,
): number {
  const current = Math.round(volumeToSlider(volume, unit, dbStep) * 100);
  const next = Math.min(100, Math.max(0, current + direction * VOLUME_KEY_STEP_PERCENT));
  return sliderToVolume(next / 100, unit, dbStep);
}
