import { smoothTo } from './smoothing';

export interface SpinState {
  /** Angle in degrees (0..360). */
  angle: number;
  /** Current angular speed (degrees/s). */
  speed: number;
}

export interface SpinStep extends SpinState {
  /** `true` when the rotation has fully stopped and nothing needs animating. */
  settled: boolean;
}

/** Below this speed (degrees/s) without playback the motor counts as stopped. */
export const SPIN_STOP_THRESHOLD = 0.1;
/** Below this speed the angle is no longer updated. */
const SPIN_MOVE_THRESHOLD = 0.01;

/**
 * One step of inertial rotation (turntable platter, tape reel).
 * The speed moves towards `targetDegPerSec` with `tauUp` (spin-up while `playing`) or `tauDown` (spin-down).
 * `direction` = 1 rotates clockwise, -1 counter-clockwise.
 */
export function stepSpin(
  state: SpinState,
  targetDegPerSec: number,
  playing: boolean,
  dtSec: number,
  tauUp: number,
  tauDown: number,
  direction: 1 | -1 = 1,
): SpinStep {
  let speed = smoothTo(state.speed, targetDegPerSec, dtSec, playing ? tauUp : tauDown);
  if (!playing && Math.abs(speed) < SPIN_STOP_THRESHOLD) speed = 0;

  let angle = state.angle;
  if (speed > SPIN_MOVE_THRESHOLD) {
    angle = (((angle + direction * speed * dtSec) % 360) + 360) % 360;
  }
  const settled = speed === 0 && (targetDegPerSec === 0 || !playing);
  return { angle, speed, settled };
}
