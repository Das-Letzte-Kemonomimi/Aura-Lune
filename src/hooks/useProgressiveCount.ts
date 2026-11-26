import { useEffect, useState } from 'react';

/**
 * How many items of a long list to mount right now. Starts at `initial` and grows by `step` on a
 * timer until `total`, so the browser can paint and handle input between chunks instead of
 * freezing while it mounts the whole list at once. `resetKey` restarts the ramp (e.g. when the
 * layout changes); data changes alone do not, they only clamp the count.
 */
export function useProgressiveCount(total: number, resetKey: string, initial = 36, step = 36): number {
  const [state, setState] = useState({ key: resetKey, count: initial });
  const count = state.key === resetKey ? state.count : initial;

  useEffect(() => {
    if (count >= total) return;
    const id = window.setTimeout(() => {
      setState((prev) => ({ key: resetKey, count: (prev.key === resetKey ? prev.count : initial) + step }));
    }, 16);
    return () => window.clearTimeout(id);
  }, [count, total, resetKey, initial, step]);

  return Math.min(count, total);
}
