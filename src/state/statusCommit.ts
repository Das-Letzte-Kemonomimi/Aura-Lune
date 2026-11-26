import type { PlaybackStatus } from '../types/playback';

/** Co ile ms pozycji odtwarzania warto odświeżyć stan Reacta `App` przy samym upływie czasu. */
export const COARSE_POSITION_STEP_MS = 1_000;

/** Pola zmieniające się w każdej klatce — trafiają do `livePlayback`, nie wymuszają commitu. */
const LIVE_FIELDS = new Set<keyof PlaybackStatus>(['position_ms', 'spectrum']);

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Czy nowa klatka statusu powinna zaktualizować stan Reacta.
 *
 * `true`, gdy zmieniło się cokolwiek poza polami „na żywo” (stan, utwór, głośność, DSP, EQ…),
 * gdy pozycja cofnęła się (seek, zapętlenie) albo przesunęła o co najmniej
 * [`COARSE_POSITION_STEP_MS`]. Dzięki temu `App` renderuje się ~1×/s zamiast ~10×/s.
 */
export function shouldCommitStatus(prev: PlaybackStatus, next: PlaybackStatus): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof PlaybackStatus>;
  for (const key of keys) {
    if (LIVE_FIELDS.has(key)) continue;
    if (!sameValue(prev[key], next[key])) return true;
  }
  const delta = next.position_ms - prev.position_ms;
  return delta < 0 || delta >= COARSE_POSITION_STEP_MS;
}
