import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a callback with a stable identity whose body always calls the latest `fn`.
 * Prefer over React's `useEffectEvent` when the handler must be passed as a prop.
 */
export function useStableCallback<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  return useCallback((...args: Args) => fnRef.current(...args), []);
}
