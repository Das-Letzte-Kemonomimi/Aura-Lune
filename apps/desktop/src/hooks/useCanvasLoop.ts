import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { clampDpr, computeBackingSize } from '../utils/canvasDraw';
import { useFrameLoop } from './useFrameLoop';

export interface CanvasSize {
  /** Rozmiar CSS (px). */
  width: number;
  height: number;
  dpr: number;
}

export interface CanvasFrame extends CanvasSize {
  /** Kontekst z ustawioną transformacją: współrzędne rysowania są w pikselach CSS. */
  ctx: CanvasRenderingContext2D;
  dt: number;
  now: number;
}

export interface CanvasLoopOptions {
  active?: boolean;
  maxFps?: number;
  /** `'device'` = `devicePixelRatio` (ostre na HiDPI, max 2×); liczba = stała skala (np. 1). Domyślnie `'device'`. */
  pixelRatio?: 'device' | number;
  /** Czyść canvas przed każdą klatką (domyślnie `true`). */
  clear?: boolean;
  /** Wywoływane po zmianie rozmiaru/DPR (np. do przebudowy warstw offscreen i cache gradientów). */
  onResize?: (size: CanvasSize) => void;
}

/**
 * Pętla rysowania na canvasie: rozmiar z ResizeObserver, bufor realokowany tylko przy realnej zmianie
 * (zaokrąglony — bez migotania przy ułamkowym DPR), transformacja ustawiana raz na zmianę rozmiaru.
 *
 * `draw` zwracające `false` usypia pętlę (np. paused + ustalony stan); `invalidate()` budzi ją i rysuje klatkę.
 * Pętla śpi też przy ukrytej karcie i niewidocznym elemencie (zob. `useFrameLoop`).
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
      // Brak kontekstu (np. jsdom) albo element bez rozmiaru → śpimy do kolejnego pomiaru/invalidate.
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
      // Przypisanie width/height czyści bufor i resetuje stan kontekstu — robimy to tylko przy zmianie.
      if (canvas.width !== backing.width) canvas.width = backing.width;
      if (canvas.height !== backing.height) canvas.height = backing.height;
      ctxRef.current?.setTransform(backing.width / width, 0, 0, backing.height / height, 0, 0);
    }
    onResizeRef.current?.(sizeRef.current);
    wake();
  }, [wake]);

  // Pomiar przed pierwszym malowaniem: bez klatki z domyślnym buforem 300×150 rozciągniętym na element.
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
    // `resize` okna łapie też zmianę devicePixelRatio (zoom, przeniesienie na inny monitor).
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return { canvasRef, invalidate: wake };
}
