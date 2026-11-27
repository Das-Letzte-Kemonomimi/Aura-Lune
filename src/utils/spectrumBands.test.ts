// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { boostBand, circularBandIndex, foldBands, updateBands, type BandState } from './spectrumBands';

describe('foldBands', () => {
  it('averages L and R for 32 bands, reusing the output array', () => {
    const spectrum = [...Array(16).fill(0.2), ...Array(16).fill(0.6)];
    const out: number[] = [];
    expect(foldBands(spectrum, out)).toBe(16);
    expect(out).toHaveLength(16);
    expect(out.every((v) => Math.abs(v - 0.4) < 1e-12)).toBe(true);
    const same = out;
    foldBands(spectrum, out);
    expect(out).toBe(same);
  });

  it('passes through fewer than 32 bands and falls back to 16 zeros without data', () => {
    const out: number[] = [];
    expect(foldBands([0.1, 0.2, 0.3], out)).toBe(3);
    expect(out.slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(foldBands([], out)).toBe(16);
    expect(foldBands(undefined, out)).toBe(16);
    expect(out.slice(0, 16).every((v) => v === 0)).toBe(true);
  });
});

describe('boostBand', () => {
  it('lifts quiet bands, clamps to 1 and floors at 0', () => {
    expect(boostBand(0)).toBe(0);
    expect(boostBand(0.25)).toBeCloseTo(Math.pow(0.25, 0.72) * 1.35, 10);
    expect(boostBand(5)).toBe(1);
    expect(boostBand(-1)).toBe(0);
  });
});

describe('updateBands', () => {
  const fresh = (): BandState => ({ smoothed: [], peaks: [] });
  const target = Array(16).fill(0.8);

  it('converges the same at 60 Hz and 120 Hz', () => {
    const a = fresh();
    const b = fresh();
    for (let i = 0; i < 12; i++) updateBands(a, target, 16, true, 1 / 60); // 0.2 s
    for (let i = 0; i < 24; i++) updateBands(b, target, 16, true, 1 / 120);
    expect(b.smoothed[0]).toBeCloseTo(a.smoothed[0], 6);
  });

  it('holds peaks above the bar and lets them fall at a fixed per-second rate', () => {
    const s = fresh();
    updateBands(s, target, 16, true, 0.5);
    const peak = s.peaks[0];
    expect(peak).toBeCloseTo(s.smoothed[0], 10);
    updateBands(s, Array(16).fill(0), 16, true, 0.1);
    expect(s.peaks[0]).toBeLessThan(peak);
    expect(s.peaks[0]).toBeGreaterThan(s.smoothed[0]);
  });

  it('reports moving while active and settles to exact zero when paused', () => {
    const s = fresh();
    updateBands(s, target, 16, true, 0.5);
    let moving = true;
    for (let i = 0; i < 400 && moving; i++) moving = updateBands(s, target, 16, false, 1 / 60);
    expect(moving).toBe(false);
    expect(s.smoothed.slice(0, 16).every((v) => v === 0)).toBe(true);
    expect(s.peaks.slice(0, 16).every((v) => v === 0)).toBe(true);
  });
});

describe('circularBandIndex (locks the existing pattern)', () => {
  it('only ever yields bands 0..8 for 16 bands (bands 9-15 are not shown in this mode)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 48; i++) seen.add(circularBandIndex(i, 16));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(circularBandIndex(0, 16)).toBe(8);
    expect(circularBandIndex(8, 16)).toBe(0);
  });
});
