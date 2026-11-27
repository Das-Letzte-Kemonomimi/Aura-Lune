import type { PlaybackStatus } from '../types/playback';

/** Fields that change every frame: they go to `livePlayback` and never force a commit. */
const LIVE_FIELDS = new Set<keyof PlaybackStatus>(['position_ms', 'spectrum']);

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Whether a new status frame should update the React state.
 *
 * `true` only when something other than the "live" fields (`position_ms`, `spectrum`)
 * changed (state, track, DSP, volume, EQ…). While playing uninterrupted, `App` stays idle.
 */
export function shouldCommitStatus(prev: PlaybackStatus, next: PlaybackStatus): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof PlaybackStatus>;
  for (const key of keys) {
    if (LIVE_FIELDS.has(key)) continue;
    if (!sameValue(prev[key], next[key])) return true;
  }
  return false;
}
