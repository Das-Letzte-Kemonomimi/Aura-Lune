import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  livePlayback,
  useLivePositionMs,
  useLiveSpectrum,
  useLiveStatus,
  useLiveSelector,
  currentPositionMs,
} from './livePlayback';

describe('livePlayback store', () => {
  it('returns fallbacks until the first status arrives', () => {
    const { result } = renderHook(() => ({
      pos: useLivePositionMs(1234),
      spec: useLiveSpectrum([0.5]),
    }));
    expect(result.current).toEqual({ pos: 1234, spec: [0.5] });
    expect(currentPositionMs(99)).toBe(99);
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
