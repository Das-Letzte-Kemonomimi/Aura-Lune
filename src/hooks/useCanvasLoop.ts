import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { clampDpr, computeBackingSize } from '../utils/canvasDraw';
import { useFrameLoop } from './useFrameLoop';

export interface CanvasSize {
  /** CSS size (px). */
  width: number;
  height: number;
  dpr: number;
}

export interface CanvasFrame extends CanvasSize {
  /** Context with the transform set: drawing coordinates are in CSS pixels. */
  ctx: CanvasRenderingContext2D;
  dt: number;
  now: number;
}

export interface CanvasLoopOptions {
  active?: boolean;
  maxFps?: number;
  /** `'device'` = `devicePixelRatio` (sharp on HiDPI, max 2×); a number = a fixed scale (e.g. 1). Default `'device'`. */
  pixelRatio?: 'device' | number;
  /** Clear the canvas before each frame (default `true`). */
  clear?: boolean;
  /** Called after a size/DPR change (e.g. to rebuild offscreen layers and gradient caches). */
  onResize?: (size: CanvasSize) => void;
}

/**
 * Canvas drawing loop: size from ResizeObserver, buffer reallocated only on a real change
 * (rounded, so no flicker with a fractional DPR), transform set once per size change.
 *
 * A `draw` that returns `false` puts the loop to sleep (e.g. paused + settled state); `invalidate()` wakes it and draws a frame.
 * The loop also sleeps while the tab is hidden and the element is not visible (see `useFrameLoop`).
 */
export function useCanvasLoop(
  draw: (frame: CanvasFrame) => boolean | void,
  { active = true, maxFps, pixelRatio = 'device', clear = true, onResize }: CanvasLoopOptions = {},
): { canvasRef: RefObject<HTMLCanvasElement | null>; invalidate: () => void } {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, dpr: 1 });
  const drawRef = useRef(draw);
  const onResizeRef = useRef(onResize);
  const pixelRatioRef = useRef(pixelRatio);
  const clearRef = useRef(clear);

  useEffect(() => {
    drawRef.current = draw;
    onResizeRef.current = onResize;
    pixelRatioRef.current = pixelRatio;
    clearRef.current = clear;
  });

  const { wake } = useFrameLoop(
    ({ dt, now }) => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
      const ctx = ctxRef.current;
      const { width, height, dpr } = sizeRef.current;
      // No context (e.g. jsdom) or an element without a size → sleep until the next measurement/invalidate.
      if (!ctx || width <= 0 || height <= 0) return false;
      if (clearRef.current) ctx.clearRect(0, 0, width, height);
      return drawRef.current({ ctx, width, height, dpr, dt, now });
    },
    { active, maxFps, target: canvasRef },
  );

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const requested = pixelRatioRef.current;
    const dpr = requested === 'device' ? clampDpr(window.devicePixelRatio || 1) : requested;
    const prev = sizeRef.current;
    if (width === prev.width && height === prev.height && dpr === prev.dpr) return;

    sizeRef.current = { width, height, dpr };
    if (width > 0 && height > 0) {
      if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
      const backing = computeBackingSize(width, height, dpr);
      // Assigning width/height clears the buffer and resets the context state, so it happens only on a change.
      if (canvas.width !== backing.width) canvas.width = backing.width;
      if (canvas.height !== backing.height) canvas.height = backing.height;
      ctxRef.current?.setTransform(backing.width / width, 0, 0, backing.height / height, 0, 0);
    }
    onResizeRef.current?.(sizeRef.current);
    wake();
  }, [wake]);

  // Measure before the first paint: no frame with the default 300×150 buffer stretched over the element.
  useLayoutEffect(() => {
    measure();
  }, [measure, pixelRatio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      observer.observe(canvas);
    }
    // The window `resize` also catches devicePixelRatio changes (zoom, moving to another monitor).
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return { canvasRef, invalidate: wake };
}
