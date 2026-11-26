import { useCallback, useState } from 'react';

export interface PersistedStateOptions<T> {
  /** Turns the saved text into a value; `undefined` = invalid value (use the default). */
  parse: (raw: string) => T | undefined;
  serialize?: (value: T) => string;
  /** Older keys the value is read from while the current key does not exist yet. */
  legacyKeys?: readonly string[];
}

function readStored<T>(key: string, fallback: T, options: PersistedStateOptions<T>): T {
  try {
    for (const k of [key, ...(options.legacyKeys ?? [])]) {
      const raw = localStorage.getItem(k);
      if (raw === null) continue;
      const parsed = options.parse(raw);
      if (parsed !== undefined) return parsed;
    }
  } catch {
    // localStorage unavailable (e.g. private mode): the default value.
  }
  return fallback;
}

/**
 * React state saved in `localStorage` under a single key: reading and writing
 * use the same key, so a setting cannot "disappear" after a restart.
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
  options: PersistedStateOptions<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, fallback, options));
  const serialize = options.serialize ?? String;

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, serialize(resolved));
        } catch {
          // A missing persistent write must not block the change in the UI.
        }
        return resolved;
      });
    },
    [key, serialize],
  );

  return [value, update];
}

/** Parser for on/off settings. */
export const parseBoolean = (raw: string): boolean | undefined =>
  raw === 'true' ? true : raw === 'false' ? false : undefined;
