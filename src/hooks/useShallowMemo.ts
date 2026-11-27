import { useLayoutEffect, useRef } from 'react';

function shallowEqualObjects<T extends object>(prev: T, next: T): boolean {
  if (Object.is(prev, next)) return true;
  const prevKeys = Object.keys(prev) as Array<keyof T>;
  const nextKeys = Object.keys(next) as Array<keyof T>;
  if (prevKeys.length !== nextKeys.length) return false;
  for (let i = 0; i < prevKeys.length; i += 1) {
    const key = prevKeys[i];
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!Object.is(prev[key], next[key])) return false;
  }
  return true;
}

/**
 * Returns the previous object reference when every own enumerable property is `Object.is`-equal
 * and the key set matches, keeping prop-bundle references stable across unrelated parent renders.
 */
export function useShallowMemo<T extends object>(obj: T): T {
  const prevRef = useRef<T | null>(null);
  // Intentional manual shallow memoization comparing against the last committed snapshot.
  // oxlint-disable-next-line react/refs
  const stable = prevRef.current !== null && shallowEqualObjects(prevRef.current, obj) ? prevRef.current : obj;

  useLayoutEffect(() => {
    prevRef.current = stable;
  });

  return stable;
}
