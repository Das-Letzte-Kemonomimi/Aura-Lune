import { useCallback, useEffect, useRef } from 'react';

/**
 * Runs `onIntent` once the pointer (or keyboard focus) has rested on an element for `delayMs`.
 * Spread the returned handlers on the element. Leaving or blurring before the delay cancels it.
 */
export function useHoverIntent(onIntent: () => void, delayMs = 100) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onIntent);
  useEffect(() => {
    callback.current = onIntent;
  }, [onIntent]);

  const cancel = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      callback.current();
    }, delayMs);
  }, [delayMs]);

  useEffect(() => cancel, [cancel]);

  return { onPointerEnter: start, onFocus: start, onPointerLeave: cancel, onBlur: cancel };
}
