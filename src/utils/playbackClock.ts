/**
 * Playback clock for smoothly drawing the progress bar.
 *
 * The backend sends the position ~10×/s. Without interpolation the playhead "jumps" every 100 ms. Here the position is
 * extrapolated between ticks (`position + time_since_tick × speed`) and drift is smoothed when a new tick arrives.
 */
import { smoothTo } from './smoothing';

export interface ClockAnchor {
  /** The last known position (ms, source time). */
  positionMs: number;
  /** The moment (`performance.now()`) this position arrived. */
  at: number;
}

export interface ExtrapolateOptions {
  /** Speed of the source time relative to real time (1 in Bypass, tempo*rate with DSP). */
  speed: number;
  playing: boolean;
  durationMs?: number | null;
  /** End of the A-B loop (ms): during the loop we never go past it; the return to A is a jump from the backend. */
  loopB?: number | null;
  /** Maximum time (real ms) of extrapolation without a new tick: a guard against stalled statuses. */
  maxAheadMs?: number;
}

export const DEFAULT_MAX_AHEAD_MS = 400;
/** Drift (ms) above which the displayed position jumps to the target instead of smoothing (seek, A-B loop). */
export const SNAP_THRESHOLD_MS = 300;
/** Drift smoothing time constant (s). */
export const EASE_TAU_SEC = 0.08;

/** Extrapolated position at `now`. Without playback, returns the last known position. */
export function extrapolatePositionMs(anchor: ClockAnchor, now: number, options: ExtrapolateOptions): number {
  const { speed, playing, durationMs, loopB, maxAheadMs = DEFAULT_MAX_AHEAD_MS } = options;
  if (!playing) return anchor.positionMs;

  const elapsed = Math.min(maxAheadMs, Math.max(0, now - anchor.at));
  let pos = anchor.positionMs + elapsed * (Number.isFinite(speed) && speed > 0 ? speed : 1);

  // Never go past the end of the A-B loop (if playback is before its end) or the end of the track
  if (loopB != null && loopB > 0 && anchor.positionMs <= loopB) pos = Math.min(pos, loopB);
  if (durationMs != null && durationMs > 0) pos = Math.min(pos, durationMs);
  return pos;
}

/**
 * Displayed position: smooths small drift between the extrapolation and a new tick, never moves back
 * during playback, and accepts large changes (seek, loop) immediately.
 */
export function easeDisplayPosition(prev: number | null, target: number, dtSec: number, playing: boolean): number {
  if (prev === null) return target;
  const error = target - prev;
  if (Math.abs(error) > SNAP_THRESHOLD_MS) return target;
  // The extrapolation got ahead of the real tick: wait instead of moving the playhead back
  if (playing && error < 0) return prev;
  return smoothTo(prev, target, dtSec, EASE_TAU_SEC);
}
