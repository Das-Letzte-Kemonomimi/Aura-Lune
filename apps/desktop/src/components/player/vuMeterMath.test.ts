import { describe, it, expect } from 'vitest';
import {
  VU_ATTACK_TAU,
  VU_DECAY_TAU,
  VU_PEAK_FALL_PER_SEC,
  calcDb,
  computeVuLevels,
  isVuSettled,
  meterGeometry,
  stepVuChannel,
  stereoLayout,
  type VuChannelState,
} from './vuMeterMath';

describe('calcDb (locks the dial scale)', () => {
  it('maps the printed scale marks to their dB values', () => {
    expect(calcDb(0.26)).toBe('-10.0 dB');
    expect(calcDb(0.44)).toBe('-7.0 dB');
    expect(calcDb(0.6)).toBe('-5.0 dB');
    expect(calcDb(0.72)).toBe('-3.0 dB');
    expect(calcDb(0.8)).toBe('0.0 dB');
    expect(calcDb(0.9)).toBe('+1.0 dB');
    expect(calcDb(1.0)).toBe('+3.0 dB');
  });

  it('interpolates between marks and handles the extremes', () => {
    expect(calcDb(0.35)).toBe('-8.5 dB'); // połowa między -10 a -7
    expect(calcDb(0.0)).toBe('-∞ dB');
    expect(calcDb(1.05)).toBe('+3.8 dB');
    expect(calcDb(2)).toBe('+3.8 dB');
  });
});

describe('computeVuLevels', () => {
  it('is silent when paused or without data', () => {
    expect(computeVuLevels([0.5, 0.5], 1, false)).toEqual({ left: 0, right: 0 });
    expect(computeVuLevels([], 1, true)).toEqual({ left: 0, right: 0 });
  });

  it('uses 32 bands as true stereo (0..15 = L, 16..31 = R)', () => {
    const spectrum = [...Array(16).fill(0.8), ...Array(16).fill(0.2)];
    const { left, right } = computeVuLevels(spectrum, 1, true);
    expect(left).toBeGreaterThan(right);
    expect(left).toBeCloseTo(0.8 * 1.45, 6);
    expect(right).toBeCloseTo(0.2 * 1.45, 6);
  });

  it('falls back to mono (same level on both channels) for fewer than 32 bands and scales with volume', () => {
    const { left, right } = computeVuLevels(Array(16).fill(0.5), 0.5, true);
    expect(left).toBe(right);
    expect(left).toBeCloseTo(0.5 * 0.5 * 1.45, 6);
  });
});

describe('stepVuChannel ballistics', () => {
  const run = (start: VuChannelState, raw: number, seconds: number, dt: number) => {
    let s = start;
    for (let t = 0; t < seconds - 1e-9; t += dt) s = stepVuChannel(s, raw, dt);
    return s;
  };

  it('attacks faster than it decays (analog VU feel)', () => {
    expect(VU_ATTACK_TAU).toBeLessThan(VU_DECAY_TAU);
    const up = run({ level: 0, peak: 0 }, 1, 0.1, 1 / 60);
    const down = run({ level: 1, peak: 1 }, 0, 0.1, 1 / 60);
    expect(up.level).toBeGreaterThan(1 - down.level);
  });

  it('is frame-rate independent', () => {
    const a = run({ level: 0, peak: 0 }, 0.9, 0.3, 1 / 60);
    const b = run({ level: 0, peak: 0 }, 0.9, 0.3, 1 / 120);
    expect(b.level).toBeCloseTo(a.level, 6);
  });

  it('holds the peak and lets it fall at the configured rate', () => {
    let s: VuChannelState = { level: 0, peak: 0 };
    s = stepVuChannel(s, 1, 0.5); // wysoki poziom => szczyt = poziom
    expect(s.peak).toBe(s.level);
    const peak0 = s.peak;
    s = stepVuChannel({ level: 0, peak: peak0 }, 0, 0.1);
    expect(s.peak).toBeCloseTo(peak0 - VU_PEAK_FALL_PER_SEC * 0.1, 6);
  });

  it('reports settled only when stopped and both level and peak are ~0', () => {
    expect(isVuSettled({ level: 0, peak: 0 }, false)).toBe(true);
    expect(isVuSettled({ level: 0, peak: 0 }, true)).toBe(false);
    expect(isVuSettled({ level: 0.2, peak: 0.2 }, false)).toBe(false);
  });
});

describe('meter geometry', () => {
  it('keeps the dial arc inside the face for typical sizes', () => {
    for (const [w, h] of [[110, 120], [236, 130], [60, 60]] as const) {
      const g = meterGeometry(w, h);
      expect(g.radius).toBeGreaterThanOrEqual(20);
      expect(g.pivotX).toBeCloseTo(w / 2, 6);
      expect(g.totalSweep).toBeGreaterThan(0);
      expect(g.redZoneAngle).toBeGreaterThan(g.startAngle);
      expect(g.redZoneAngle).toBeLessThan(g.endAngle);
    }
  });

  it('lays two meters side by side with a gap', () => {
    const l = stereoLayout(240, 130);
    expect(l.meterWidth * 2 + l.gap + l.pad * 2).toBeCloseTo(240, 6);
    expect(l.meterHeight).toBe(122);
  });
});
