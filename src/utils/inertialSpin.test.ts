import { describe, it, expect } from 'vitest';
import { stepSpin, type SpinState } from './inertialSpin';

function run(state: SpinState, target: number, playing: boolean, seconds: number, dt = 1 / 60, dir: 1 | -1 = 1) {
  let s = state;
  let settled = false;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const step = stepSpin(s, target, playing, dt, 0.2, 0.41, dir);
    s = { angle: step.angle, speed: step.speed };
    settled = step.settled;
  }
  return { ...s, settled };
}

describe('stepSpin', () => {
  it('accelerates toward the target while playing and keeps the angle in 0..360', () => {
    const r = run({ angle: 0, speed: 0 }, 190, true, 2);
    expect(r.speed).toBeGreaterThan(180);
    expect(r.angle).toBeGreaterThanOrEqual(0);
    expect(r.angle).toBeLessThan(360);
    expect(r.settled).toBe(false);
  });

  it('coasts to a complete stop after playback ends and reports settled', () => {
    const spinning = run({ angle: 10, speed: 0 }, 190, true, 2);
    const stopped = run(spinning, 0, false, 6);
    expect(stopped.speed).toBe(0);
    expect(stopped.settled).toBe(true);
  });

  it('is frame-rate independent (60 Hz vs 120 Hz reach the same speed)', () => {
    const a = run({ angle: 0, speed: 0 }, 285, true, 0.5, 1 / 60);
    const b = run({ angle: 0, speed: 0 }, 285, true, 0.5, 1 / 120);
    expect(b.speed).toBeCloseTo(a.speed, 3);
  });

  it('rotates the other way with direction -1 (tape reels)', () => {
    const cw = run({ angle: 0, speed: 100 }, 100, true, 0.1, 1 / 60, 1);
    const ccw = run({ angle: 0, speed: 100 }, 100, true, 0.1, 1 / 60, -1);
    expect(cw.angle).toBeGreaterThan(0);
    expect(ccw.angle).toBeGreaterThan(180); // wrapped below zero
  });

  it('is settled immediately when idle', () => {
    expect(stepSpin({ angle: 0, speed: 0 }, 0, false, 1 / 60, 0.2, 0.41).settled).toBe(true);
  });
});
