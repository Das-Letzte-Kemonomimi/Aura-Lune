import { describe, it, expect } from 'vitest';
import { fallPerSec, smoothTo, tauFromFrameLerp } from './smoothing';

/** Symuluje `seconds` sekund przy danym kroku czasu. */
function simulate(start: number, target: number, tau: number, dt: number, seconds: number): number {
  let v = start;
  for (let t = 0; t < seconds - 1e-9; t += dt) v = smoothTo(v, target, dt, tau);
  return v;
}

describe('smoothTo', () => {
  it('converges identically at 60 Hz and 120 Hz (frame-rate independent)', () => {
    // 0.3 s to całkowita liczba kroków dla obu częstotliwości (18 i 36)
    const at60 = simulate(0, 1, 0.1, 1 / 60, 0.3);
    const at120 = simulate(0, 1, 0.1, 1 / 120, 0.3);
    expect(at120).toBeCloseTo(at60, 6);
    expect(at60).toBeCloseTo(1 - Math.exp(-3), 3);
  });

  it('reaches the target for a non-positive tau and ignores dt <= 0', () => {
    expect(smoothTo(0, 5, 0.016, 0)).toBe(5);
    expect(smoothTo(2, 5, 0, 0.1)).toBe(2);
  });

  it('moves toward the target without overshoot', () => {
    expect(smoothTo(10, 0, 1, 0.2)).toBeGreaterThanOrEqual(0);
    expect(smoothTo(0, 10, 1, 0.2)).toBeLessThanOrEqual(10);
  });
});

describe('tauFromFrameLerp / fallPerSec', () => {
  it('maps the old per-frame factors to time constants', () => {
    // Winyl: 0.08 / klatkę przy 60 Hz => ~0.2 s, 0.04 => ~0.41 s
    expect(tauFromFrameLerp(0.08)).toBeCloseTo(0.2, 2);
    expect(tauFromFrameLerp(0.04)).toBeCloseTo(0.408, 2);
    // równoważność: jedna klatka 60 Hz z tym tau daje dokładnie dawny współczynnik
    expect(smoothTo(0, 1, 1 / 60, tauFromFrameLerp(0.45))).toBeCloseTo(0.45, 6);
  });

  it('converts a per-frame fall into per-second', () => {
    expect(fallPerSec(0.016)).toBeCloseTo(0.96, 6);
  });
});
