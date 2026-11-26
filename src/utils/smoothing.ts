/**
 * Frame-rate-independent smoothing.
 *
 * "Per frame" constants (e.g. `x += (target - x) * 0.45`) run 2.4× faster on a 144 Hz screen than on 60 Hz.
 * Here everything is expressed in time: a time constant `tau` (seconds) and `dt` (seconds).
 */

/** Exponential smoothing: moves `current` towards `target` with time constant `tau` (s) over `dt` (s). */
export function smoothTo(current: number, target: number, dt: number, tau: number): number {
  if (!(tau > 0) || !(dt > 0)) return dt > 0 ? target : current;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Time constant (s) matching the `factor` applied every frame at `hz` frames/s. */
export function tauFromFrameLerp(factor: number, hz = 60): number {
  const f = Math.min(0.999999, Math.max(1e-6, factor));
  return -1 / (hz * Math.log(1 - f));
}

/** Converts a "per frame" decay (at `hz` frames/s) to a decay per second. */
export function fallPerSec(perFrame: number, hz = 60): number {
  return perFrame * hz;
}
