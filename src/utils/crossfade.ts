/** Crossfade duration limits and conversions shared by the UI, persistence and the engine (ms). */
export const CROSSFADE_MIN_MS = 0;
export const CROSSFADE_MAX_MS = 8000;
export const CROSSFADE_DEFAULT_MS = 1500;

/** Clamps a duration to the engine's accepted range and rounds to whole milliseconds. */
export function clampCrossfadeMs(ms: number): number {
  if (!Number.isFinite(ms)) return CROSSFADE_DEFAULT_MS;
  return Math.round(Math.max(CROSSFADE_MIN_MS, Math.min(CROSSFADE_MAX_MS, ms)));
}

/** Parses the persisted `crossfade_duration` setting; missing or malformed values fall back to the default. */
export function parseCrossfadeSetting(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return CROSSFADE_DEFAULT_MS;
  return clampCrossfadeMs(Number(raw));
}
