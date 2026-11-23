import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface FrameInfo {
  /** Czas od poprzedniej klatki w sekundach (0 przy pierwszej klatce po starcie/wybudzeniu, max 0.1). */
  dt: number;
  /** `requestAnimationFrame` timestamp w ms. */
  now: number;
}

export interface FrameLoopOptions {
  /** `false` zatrzymuje pętlę (domyślnie `true`). */
  active?: boolean;
  /** Górny limit klatek na sekundę (np. 30); domyślnie bez limitu (częstotliwość odświeżania ekranu). */
  maxFps?: number;
  /** Element, którego widoczność steruje pętlą: niewidoczny (np. `display:none`, poza ekranem) → pauza. */
  target?: RefObject<Element | null>;
}

const MAX_DT_SEC = 0.1;

/**
 * Pętla `requestAnimationFrame` z oszczędzaniem energii:
 * - `onFrame` jest trzymany w refie, więc zmiana funkcji/propsów NIE restartuje pętli,
 * - pętla śpi, gdy karta jest ukryta (`document.hidden`), gdy `target` jest niewidoczny
 *   (IntersectionObserver) albo gdy `active === false`,
 * - `onFrame` zwracające `false` usypia pętlę do czasu `wake()` (np. ustalony stan bez ruchu).
 */
export function useFrameLoop(
  onFrame: (frame: FrameInfo) => boolean | void,
  { active = true, maxFps, target }: FrameLoopOptions = {},
): { wake: () => void } {
  const onFrameRef = useRef(onFrame);
  const activeRef = useRef(active);
  const maxFpsRef = useRef(maxFps);
  const visibleRef = useRef(true);
  const controlRef = useRef<{ start: () => void; stop: () => void }>({ start: () => {}, stop: () => {} });

  // Najnowsze wartości dla pętli (bez restartu efektu).
  useEffect(() => {
    onFrameRef.current = onFrame;
    activeRef.current = active;
    maxFpsRef.current = maxFps;
  });

  useEffect(() => {
    let raf: number | null = null;
    let last: number | null = null;

    const shouldRun = () => activeRef.current && !document.hidden && visibleRef.current;

    const frame = (now: number) => {
      raf = null;
      if (!shouldRun()) {
        last = null;
        return;
      }
      const cap = maxFpsRef.current;
      if (cap && last !== null && now - last < 1000 / cap - 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = last === null ? 0 : Math.min(MAX_DT_SEC, (now - last) / 1000);
      last = now;
      const keepRunning = onFrameRef.current({ dt, now });
      if (keepRunning === false) {
        last = null;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf === null && shouldRun()) {
        last = null;
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      last = null;
    };
    controlRef.current = { start, stop };

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | undefined;
    const element = target?.current;
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        visibleRef.current = entry.isIntersecting;
        if (visibleRef.current) start();
        else stop();
      });
      observer.observe(element);
    }

    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      controlRef.current = { start: () => {}, stop: () => {} };
    };
  }, [target]);

  useEffect(() => {
    if (active) controlRef.current.start();
    else controlRef.current.stop();
  }, [active]);

  const wake = useCallback(() => controlRef.current.start(), []);
  return { wake };
}
