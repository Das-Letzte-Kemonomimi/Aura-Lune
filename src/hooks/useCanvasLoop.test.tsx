import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useCanvasLoop, type CanvasFrame } from './useCanvasLoop';
import { installCanvasMock, installFakeRaf, type CanvasMock, type FakeRaf } from '../test/canvasMock';

let raf: FakeRaf;
let canvas: CanvasMock;

afterEach(() => {
  cleanup();
  document.documentElement.style.zoom = '';
  canvas?.restore();
  raf?.restore();
});

function setup(draw: (f: CanvasFrame) => boolean | void, css = { width: 201, height: 101 }, dpr = 1.5) {
  raf = installFakeRaf();
  canvas = installCanvasMock(css);
  canvas.setDpr(dpr);
  const invalidateRef: { current: () => void } = { current: () => {} };
  const Probe: React.FC = () => {
    const { canvasRef, invalidate } = useCanvasLoop(draw);
    React.useEffect(() => {
      invalidateRef.current = invalidate;
    }, [invalidate]);
    return <canvas ref={canvasRef} />;
  };
  const view = render(<Probe />);
  return { view, invalidate: () => invalidateRef.current() };
}

describe('useCanvasLoop', () => {
  it('sizes the backing store once (rounded) and draws in CSS pixels', () => {
    const draw = vi.fn();
    setup(draw);
    raf.step();

    const frame = draw.mock.calls[0][0] as CanvasFrame;
    expect(frame.width).toBe(201);
    expect(frame.height).toBe(101);
    expect(frame.dpr).toBe(1.5);
    expect(canvas.widthAssignments()).toBe(1); // 201 * 1.5 = 301.5 -> 302 (differs from the default 300)
    // 101 * 1.5 = 151.5 -> 152 (differs from the default 150)
    expect(canvas.heightAssignments()).toBe(1);
    expect(canvas.calls).toContain('setTransform');
  });

  it('does not reallocate the buffer across many frames at a fractional DPR (regression: flicker every frame)', () => {
    const draw = vi.fn();
    setup(draw);
    for (let i = 0; i < 30; i++) raf.step();
    expect(draw.mock.calls.length).toBeGreaterThanOrEqual(30);
    expect(canvas.widthAssignments()).toBe(1);
    expect(canvas.heightAssignments()).toBe(1);

    // The same size reported by ResizeObserver does not reallocate the buffer
    act(() => canvas.triggerResize());
    expect(canvas.widthAssignments()).toBe(1);
  });

  it('reallocates when the element or the DPR really changes', () => {
    setup(vi.fn());
    raf.step();
    act(() => {
      canvas.setCssSize(400, 101);
      canvas.triggerResize();
    });
    expect(canvas.widthAssignments()).toBe(2);

    act(() => {
      canvas.setDpr(2);
      window.dispatchEvent(new Event('resize'));
    });
    expect(canvas.widthAssignments()).toBe(3);
  });

  it('sleeps when draw returns false and redraws on invalidate()', () => {
    const draw = vi.fn(() => false as const);
    const { invalidate } = setup(draw);
    raf.step();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(raf.pending()).toBe(0);

    act(() => invalidate());
    raf.step();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('does not draw (and does not spin) for an element without size', () => {
    const draw = vi.fn();
    setup(draw, { width: 0, height: 0 });
    raf.step();
    expect(draw).not.toHaveBeenCalled();
    expect(raf.pending()).toBe(0);
  });

  it('clears the canvas before each frame', () => {
    setup(vi.fn());
    raf.step();
    expect(canvas.calls).toContain('clearRect');
  });

  it('scales the backing store by CSS zoom on documentElement and reallocates when zoom changes', async () => {
    document.documentElement.style.zoom = '1.1';
    const draw = vi.fn();
    setup(draw, { width: 200, height: 100 }, 1);
    raf.step();

    const firstFrame = draw.mock.calls[0][0] as CanvasFrame;
    expect(firstFrame.dpr).toBeCloseTo(1.1, 4);
    expect(canvas.widthAssignments()).toBe(1);

    await act(async () => {
      document.documentElement.style.zoom = '1.2';
      await Promise.resolve();
    });
    raf.step();

    const lastFrame = draw.mock.calls[draw.mock.calls.length - 1][0] as CanvasFrame;
    expect(lastFrame.dpr).toBeCloseTo(1.2, 4);
    expect(canvas.widthAssignments()).toBe(2);
  });
});
