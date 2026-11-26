import { describe, it, expect, vi } from 'vitest';
import { clampDpr, computeBackingSize, GradientCache, roundRectPath } from './canvasDraw';

describe('clampDpr', () => {
  it('limits to the max and rejects invalid values', () => {
    expect(clampDpr(3)).toBe(2);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(0.5)).toBe(1);
    expect(clampDpr(NaN)).toBe(1);
  });
});

describe('computeBackingSize', () => {
  it('rounds instead of truncating so a fractional DPR is stable (regression: realloc every frame)', () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2]) {
      const a = computeBackingSize(333, 87, dpr);
      const b = computeBackingSize(333, 87, dpr);
      expect(b).toEqual(a);
      expect(Number.isInteger(a.width) && Number.isInteger(a.height)).toBe(true);
    }
    // 333 * 1.25 = 416.25 -> 416 (truncation gave the same, but 333 * 1.5 = 499.5 -> 500, not 499)
    expect(computeBackingSize(333, 87, 1.5)).toEqual({ width: 500, height: 131 });
  });

  it('never returns a zero-sized buffer', () => {
    expect(computeBackingSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});

describe('GradientCache', () => {
  it('reuses a gradient for the same key and clears on demand', () => {
    const cache = new GradientCache();
    const create = vi.fn(() => ({}) as CanvasGradient);
    const a = cache.get('k', create);
    const b = cache.get('k', create);
    expect(a).toBe(b);
    expect(create).toHaveBeenCalledTimes(1);
    cache.clear();
    cache.get('k', create);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('is bounded', () => {
    const cache = new GradientCache(3);
    for (let i = 0; i < 10; i++) cache.get(`k${i}`, () => ({}) as CanvasGradient);
    expect(cache.size).toBeLessThanOrEqual(3);
  });
});

describe('roundRectPath', () => {
  it('uses ctx.roundRect when available', () => {
    const roundRect = vi.fn();
    roundRectPath({ roundRect } as unknown as CanvasRenderingContext2D, 1, 2, 30, 10, [4, 4, 0, 0]);
    expect(roundRect).toHaveBeenCalledWith(1, 2, 30, 10, [4, 4, 0, 0]);
  });

  it('falls back to a manual path instead of throwing on engines without roundRect', () => {
    const calls: string[] = [];
    const ctx = {
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      arcTo: () => calls.push('arcTo'),
      closePath: () => calls.push('closePath'),
    } as unknown as CanvasRenderingContext2D;
    expect(() => roundRectPath(ctx, 0, 0, 20, 10, 3)).not.toThrow();
    expect(calls.filter((c) => c === 'arcTo')).toHaveLength(4);
    expect(calls[calls.length - 1]).toBe('closePath');
  });
});
