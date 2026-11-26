import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlaybackClock } from './usePlaybackClock';

afterEach(() => vi.restoreAllMocks());

function setNow(ms: number) {
  vi.spyOn(performance, 'now').mockReturnValue(ms);
}

describe('usePlaybackClock', () => {
  it('extrapolates between backend ticks and keeps time moving smoothly', () => {
    setNow(1_000);
    const { result } = renderHook((p) => usePlaybackClock(p), {
      initialProps: { positionMs: 10_000, playing: true, speed: 1 },
    });
    const first = result.current(0);
    expect(first).toBeCloseTo(10_000, 0);

    setNow(1_050);
    const mid = result.current(0.05);
    expect(mid).toBeGreaterThan(first);
    expect(mid).toBeLessThanOrEqual(10_050 + 1);
  });

  it('re-anchors when a new position arrives and snaps after a seek', () => {
    setNow(1_000);
    const { result, rerender } = renderHook((p) => usePlaybackClock(p), {
      initialProps: { positionMs: 10_000, playing: true, speed: 1 },
    });
    result.current(0);

    setNow(1_100);
    rerender({ positionMs: 10_100, playing: true, speed: 1 });
    // a small drift is smoothed (no jump), but approaches the new anchor
    const eased = result.current(0.1);
    expect(eased).toBeGreaterThan(10_000);
    expect(eased).toBeLessThanOrEqual(10_100);

    setNow(1_150);
    rerender({ positionMs: 60_000, playing: true, speed: 1 });
    expect(result.current(0.05)).toBe(60_000); // seek: a large jump → no smoothing
  });

  it('holds still while paused and applies the playback speed', () => {
    setNow(0);
    const { result, rerender } = renderHook((p) => usePlaybackClock(p), {
      initialProps: { positionMs: 5_000, playing: false, speed: 1 },
    });
    setNow(5_000);
    expect(result.current(0.016)).toBe(5_000);

    setNow(6_000);
    rerender({ positionMs: 5_000, playing: true, speed: 2 });
    result.current(0);
    setNow(6_100);
    expect(result.current(0.1)).toBeGreaterThan(5_000);
    expect(result.current(0.1)).toBeLessThanOrEqual(5_200 + 1);
  });
});
