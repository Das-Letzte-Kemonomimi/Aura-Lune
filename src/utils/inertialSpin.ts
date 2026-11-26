import { smoothTo } from './smoothing';

export interface SpinState {
  /** Kąt w stopniach (0..360). */
  angle: number;
  /** Aktualna prędkość kątowa (stopnie/s). */
  speed: number;
}

export interface SpinStep extends SpinState {
  /** `true`, gdy obrót całkowicie się zatrzymał i nic nie trzeba już animować. */
  settled: boolean;
}

/** Poniżej tej prędkości (stopnie/s) bez odtwarzania silnik uznajemy za zatrzymany. */
export const SPIN_STOP_THRESHOLD = 0.1;
/** Poniżej tej prędkości kąt nie jest już aktualizowany. */
const SPIN_MOVE_THRESHOLD = 0.01;

/**
 * Jeden krok bezwładnego obrotu (talerz gramofonu, szpula magnetofonu).
 * Prędkość dąży do `targetDegPerSec` z `tauUp` (rozpędzanie, gdy `playing`) lub `tauDown` (wytracanie).
 * `direction` = 1 obrót zgodnie z ruchem wskazówek zegara, -1 przeciwnie.
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
