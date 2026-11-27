import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  livePlayback,
  useLivePositionMs,
  useLiveSpectrum,
  useLiveStatus,
  useLiveSelector,
  useLiveVolume,
  currentPositionMs,
  currentVolume,
} from './livePlayback';

describe('livePlayback store', () => {
  it('returns fallbacks until the first status arrives', () => {
    const { result } = renderHook(() => ({
      pos: useLivePositionMs(1234),
      spec: useLiveSpectrum([0.5]),
      vol: useLiveVolume(0.42),
    }));
    expect(result.current).toEqual({ pos: 1234, spec: [0.5], vol: 0.42 });
    expect(currentPositionMs(99)).toBe(99);
    expect(currentVolume(0.42)).toBe(0.42);
  });

  it('tracks live volume independently from position and spectrum', () => {
    let posRenders = 0;
    const { result } = renderHook(() => {
      posRenders++;
      return {
        pos: useLivePositionMs(100),
        vol: useLiveVolume(0.5),
      };
    });
    expect(result.current).toEqual({ pos: 100, vol: 0.5 });

    act(() => livePlayback.publish({ volume: 0.75 }));
    expect(result.current).toEqual({ pos: 100, vol: 0.75 });
    expect(currentVolume(0.5)).toBe(0.75);
    expect(currentPositionMs(100)).toBe(100);
    expect(posRenders).toBe(2);

    const beforeRepeat = posRenders;
    act(() => livePlayback.publish({ volume: 0.75 }));
    expect(posRenders).toBe(beforeRepeat);
  });

  it('pushes new frames to subscribers', () => {
    const { result } = renderHook(() => useLivePositionMs(0));
    act(() => livePlayback.publish({ positionMs: 42_000, spectrum: [0.1, 0.2] }));
    expect(result.current).toBe(42_000);
    expect(currentPositionMs(0)).toBe(42_000);
  });

  it('useLiveStatus overlays live fields and keeps the same object when nothing changed', () => {
    const status = { position_ms: 1_000, spectrum: [0.3], volume: 0.7 };
    const { result, rerender } = renderHook(({ s }) => useLiveStatus(s), { initialProps: { s: status } });
    expect(result.current).toBe(status);

    act(() => livePlayback.publish({ positionMs: 2_500, spectrum: [0.9] }));
    expect(result.current).toEqual({ position_ms: 2_500, spectrum: [0.9], volume: 0.7 });

    const live = livePlayback.getSnapshot();
    const synced = { position_ms: live.positionMs, spectrum: live.spectrum, volume: 0.7 };
    rerender({ s: synced });
    expect(result.current).toBe(synced);
  });

  it('does not notify subscribers when a frame repeats the same values', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useLivePositionMs(0);
    });
    const spectrum = [0.1];
    act(() => livePlayback.publish({ positionMs: 500, spectrum }));
    const after = renders;
    act(() => livePlayback.publish({ positionMs: 500, spectrum }));
    expect(renders).toBe(after);
  });

  it('does not notify subscribers when a new spectrum array has identical elements', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useLiveSpectrum([0]);
    });
    act(() => livePlayback.publish({ positionMs: 500, spectrum: [0.1, 0.2, 0.0] }));
    const after = renders;
    act(() => livePlayback.publish({ positionMs: 500, spectrum: [0.1, 0.2, 0.0] }));
    expect(renders).toBe(after);
  });

  it('useLiveSelector re-renders only when the derived value changes', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLiveSelector((s) => Math.floor(s.positionMs / 1000));
    });
    act(() => livePlayback.publish({ positionMs: 1_100, spectrum: [0.1] }));
    expect(result.current).toBe(1);
    const afterFirst = renders;

    act(() => livePlayback.publish({ positionMs: 1_400, spectrum: [0.2] })); // the same second
    expect(renders).toBe(afterFirst);

    act(() => livePlayback.publish({ positionMs: 2_050, spectrum: [0.2] }));
    expect(result.current).toBe(2);
    expect(renders).toBe(afterFirst + 1);
  });
});
