import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface FrameInfo {
  /** Time since the previous frame in seconds (0 on the first frame after start/wake, max 0.1). */
  dt: number;
  /** `requestAnimationFrame` timestamp in ms. */
  now: number;
}

export interface FrameLoopOptions {
  /** `false` stops the loop (default `true`). */
  active?: boolean;
  /** Upper limit of frames per second (e.g. 30); unlimited by default (the screen refresh rate). */
  maxFps?: number;
  /** Element whose visibility drives the loop: not visible (e.g. `display:none`, off screen) → pause. */
  target?: RefObject<Element | null>;
}

const MAX_DT_SEC = 0.1;

/**
 * A `requestAnimationFrame` loop that saves energy:
 * - `onFrame` is kept in a ref, so changing the function/props does NOT restart the loop,
 * - the loop sleeps while the tab is hidden (`document.hidden`), while `target` is not visible
 *   (IntersectionObserver) or while `active === false`,
 * - an `onFrame` that returns `false` puts the loop to sleep until `wake()` (e.g. a settled state without motion).
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

  // The latest values for the loop (without restarting the effect).
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
