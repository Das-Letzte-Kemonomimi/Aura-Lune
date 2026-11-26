import { describe, it, expect } from 'vitest';
import { computeBarLayout, resamplePeaks, sanitizePeaks } from './waveformGeometry';

describe('sanitizePeaks', () => {
  it('replaces empty data with a flat fallback wave', () => {
    expect(sanitizePeaks([])).toHaveLength(120);
    expect(sanitizePeaks(null).every((v) => v === 30)).toBe(true);
  });

  it('clamps to 0..100 and zeroes non-finite values', () => {
    expect(sanitizePeaks([-5, 50, 150, NaN, Infinity])).toEqual([0, 50, 100, 0, 0]);
  });
});

describe('resamplePeaks', () => {
  it('keeps the peak (max) of each bucket', () => {
    expect(resamplePeaks([10, 90, 20, 30, 70, 5], 3)).toEqual([90, 30, 70]);
  });

  it('returns a copy unchanged when no reduction is needed', () => {
    expect(resamplePeaks([1, 2, 3], 10)).toEqual([1, 2, 3]);
    expect(resamplePeaks([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });
});

describe('computeBarLayout', () => {
  it('fills the full width exactly when the bars fit', () => {
    const l = computeBarLayout(800, 160, 3, 2.5);
    expect(l.count).toBeLessThanOrEqual(160);
    expect(l.barWidth).toBeGreaterThanOrEqual(2.5);
    expect(l.count * l.barWidth + (l.count - 1) * l.gap).toBeCloseTo(800, 6);
  });

  it('never overflows a narrow canvas (regression: bars were clipped past the right edge)', () => {
    for (const width of [120, 300, 480, 640]) {
      const l = computeBarLayout(width, 160, 3, 2.5);
      const total = l.count * l.barWidth + (l.count - 1) * l.gap;
      expect(total).toBeCloseTo(width, 6);
      expect(l.barWidth).toBeGreaterThanOrEqual(2.5 - 1e-9);
    }
  });

  it('handles a single bar and tiny widths', () => {
    expect(computeBarLayout(100, 1, 3, 2).barWidth).toBe(100);
    const tiny = computeBarLayout(1, 160, 3, 2);
    expect(tiny.count).toBe(1);
    expect(tiny.barWidth).toBe(1);
  });
});
