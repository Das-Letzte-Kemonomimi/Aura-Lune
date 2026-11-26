import type { PlaybackStatus } from '../types/playback';

/** How many ms of playback position justify refreshing the `App` React state when only time passes. */
export const COARSE_POSITION_STEP_MS = 1_000;

/** Fields that change every frame: they go to `livePlayback` and do not force a commit. */
const LIVE_FIELDS = new Set<keyof PlaybackStatus>(['position_ms', 'spectrum']);

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Whether a new status frame should update the React state.
 *
 * `true` when anything other than the "live" fields changed (state, track, volume, DSP, EQ…),
 * when the position went back (seek, loop) or moved by at least
 * [`COARSE_POSITION_STEP_MS`]. This way `App` renders ~1×/s instead of ~10×/s.
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
