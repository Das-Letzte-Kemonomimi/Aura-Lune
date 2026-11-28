/**
 * Pure helpers for the always-on preamp (DSP Studio) and other signed-dB controls.
 * The engine clamps too (`domain::equalizer::USER_PREAMP_*`); these keep the UI in step.
 */

export const PREAMP_MIN_DB = -15;
export const PREAMP_MAX_DB = 15;

export interface PreampStepModifiers {
  shiftKey?: boolean;
}

/** dB step for one key press or wheel notch: 0.1 dB, Shift 1 dB (coarse). */
export function preampStepSize({ shiftKey }: PreampStepModifiers): number {
  return shiftKey ? 1 : 0.1;
}

/**
 * Parses a typed preamp value ("3.5", "+3,5", "-6 dB") into a clamped dB value rounded to 0.1 dB,
 * or `null` when the text is not a number (so the caller can revert the field).
 */
export function parsePreampInput(text: string): number | null {
  const cleaned = text.trim().replace(/db$/i, '').trim().replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return clampPreampDb(Math.round(Number(cleaned) * 10) / 10);
}

/** Signed step for a wheel event: wheel up raises the gain. */
export function wheelPreampStep(deltaY: number, mods: PreampStepModifiers): number {
  if (!deltaY) return 0;
  return deltaY < 0 ? preampStepSize(mods) : -preampStepSize(mods);
}

/** Moves `db` by `delta`, clamped to ±15 dB and rounded to 0.1 dB (no float drift). */
export function stepPreampDb(db: number, delta: number): number {
  return clampPreampDb(Math.round((db + delta) * 10) / 10);
}

export function clampPreampDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(PREAMP_MAX_DB, Math.max(PREAMP_MIN_DB, db));
}

/** Always signed: `+3.5 dB`, `-6.0 dB`, `0.0 dB`. */
export function formatSignedDb(db: number): string {
  const rounded = Math.round(db * 10) / 10;
  // `-0` would print as "-0.0".
  const value = rounded === 0 ? 0 : rounded;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;
}

/**
 * Auto preamp for the graphic EQ: cut by the largest band boost so a boosted band cannot clip.
 * Mirrors `ParametricEqState::calculate_safe_preamp` (`crates/domain/src/parametric_eq.rs`).
 */
export function autoPreampDb(bands: readonly number[]): number {
  const maxBoost = bands.reduce((max, gain) => (Number.isFinite(gain) && gain > max ? gain : max), 0);
  return maxBoost > 0 ? -maxBoost : 0;
}

/** Parses a stored number, keeping a saved `0` (unlike `parseFloat(x) || fallback`). */
export function parseFiniteSetting(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
