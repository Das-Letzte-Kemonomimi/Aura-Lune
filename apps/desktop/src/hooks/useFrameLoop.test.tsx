import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFrameLoop } from './useFrameLoop';
import { installFakeRaf, type FakeRaf } from '../test/canvasMock';

let raf: FakeRaf;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  cleanup();
  raf?.restore();
  setHidden(false);
});

describe('useFrameLoop', () => {
  it('calls onFrame every animation frame with a clamped dt (0 on the first frame)', () => {
    raf = installFakeRaf();
    const onFrame = vi.fn();
    renderHook(() => useFrameLoop(onFrame));

    raf.step(16);
    raf.step(16);
    raf.step(500);
    const dts = onFrame.mock.calls.map(([f]) => f.dt);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016, 3);
    expect(dts[2]).toBe(0.1); // ograniczone do 100 ms po długiej przerwie
  });

  it('sleeps when onFrame returns false and resumes on wake()', () => {
    raf = installFakeRaf();
    const onFrame = vi.fn(() => false as const);
    const { result } = renderHook(() => useFrameLoop(onFrame));

    raf.step();
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(raf.pending()).toBe(0);

    act(() => result.current.wake());
    expect(raf.pending()).toBe(1);
    raf.step();
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('does not restart the loop when the callback identity changes, and uses the latest callback', () => {
    raf = installFakeRaf();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useFrameLoop(cb), { initialProps: { cb: first } });
    raf.step();
    expect(raf.pending()).toBe(1);

    rerender({ cb: second });
    expect(raf.pending()).toBe(1); // wciąż jedna zaplanowana klatka — brak restartu
    raf.step();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('pauses while the tab is hidden and resumes when visible again', () => {
    raf = installFakeRaf();
    const onFrame = vi.fn();
    renderHook(() => useFrameLoop(onFrame));
    raf.step();

    act(() => setHidden(true));
    expect(raf.pending()).toBe(0);
    act(() => setHidden(false));
    expect(raf.pending()).toBe(1);
  });

  it('stops while inactive and restarts when active again', () => {
    raf = installFakeRaf();
    const onFrame = vi.fn();
    const { rerender } = renderHook(({ active }) => useFrameLoop(onFrame, { active }), {
      initialProps: { active: true },
    });
    raf.step();
    rerender({ active: false });
    expect(raf.pending()).toBe(0);
    rerender({ active: true });
    expect(raf.pending()).toBe(1);
  });

  it('caps the frame rate with maxFps', () => {
    raf = installFakeRaf();
    const onFrame = vi.fn();
    renderHook(() => useFrameLoop(onFrame, { maxFps: 30 }));
    for (let i = 0; i < 10; i++) raf.step(16.7); // ~60 Hz
    // przy limicie 30 fps wywołań jest ok. połowa
    expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('pauses when the target element is reported invisible by IntersectionObserver', () => {
    raf = installFakeRaf();
    let trigger: (visible: boolean) => void = () => {};
    class FakeIO {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        trigger = (visible) => cb([{ isIntersecting: visible }]);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIO);
    const el = document.createElement('div');
    const target = { current: el };
    renderHook(() => useFrameLoop(() => {}, { target }));

    expect(raf.pending()).toBe(1);
    act(() => trigger(false));
    expect(raf.pending()).toBe(0);
    act(() => trigger(true));
    expect(raf.pending()).toBe(1);
  });
});
