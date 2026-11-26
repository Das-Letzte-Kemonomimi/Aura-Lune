import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

export interface PersistedStateOptions<T> {
  /** Turns the saved text into a value; `undefined` = invalid value (use the default). */
  parse: (raw: string) => T | undefined;
  serialize?: (value: T) => string;
  /** Older keys the value is read from while the current key does not exist yet. */
  legacyKeys?: readonly string[];
}

// ---------------------------------------------------------------------------
// Shared per-key store: every hook instance on the same key sees the others' writes.
// ---------------------------------------------------------------------------

const listeners = new Map<string, Set<() => void>>();

/** Values whose `localStorage` write failed. They keep the UI (and every instance) consistent anyway. */
const unsavedWrites = new Map<string, string>();

function notify(key: string | null): void {
  // `StorageEvent.key === null` means `localStorage.clear()`: every key changed.
  const targets = key === null ? [...listeners.values()] : [listeners.get(key)];
  for (const set of targets) {
    if (set) for (const listener of [...set]) listener();
  }
}

/** Another window changed `localStorage` (the event never fires in the window that wrote). */
function handleStorageEvent(event: StorageEvent): void {
  notify(event.key);
}

function subscribeKey(key: string, listener: () => void): () => void {
  // One window-level listener serves every key; it exists only while something is subscribed.
  if (listeners.size === 0) window.addEventListener('storage', handleStorageEvent);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size > 0) return;
    listeners.delete(key);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorageEvent);
  };
}

function readRaw(key: string): string | null {
  const unsaved = unsavedWrites.get(key);
  if (unsaved !== undefined) return unsaved;
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage unavailable (e.g. private mode): the default value.
    return null;
  }
}

function writeRaw(key: string, raw: string): void {
  try {
    localStorage.setItem(key, raw);
    unsavedWrites.delete(key);
  } catch {
    // A missing persistent write must not block the change in the UI.
    unsavedWrites.set(key, raw);
  }
  notify(key);
}

// ---------------------------------------------------------------------------
// Snapshot: the parsed value, cached by the raw strings it was parsed from so
// `useSyncExternalStore` gets the same reference until the stored text changes.
// ---------------------------------------------------------------------------

interface Snapshot<T> {
  key: string;
  raws: (string | null)[];
  value: T;
}

function readSnapshot<T>(
  cache: { current: Snapshot<T> | null },
  key: string,
  fallback: T,
  options: PersistedStateOptions<T>,
): T {
  const keys = options.legacyKeys ? [key, ...options.legacyKeys] : [key];
  const raws = keys.map(readRaw);

  const previous = cache.current;
  if (previous && previous.key === key && previous.raws.length === raws.length) {
    if (previous.raws.every((raw, i) => raw === raws[i])) return previous.value;
  }

  let value = fallback;
  for (const raw of raws) {
    if (raw === null) continue;
    let parsed: T | undefined;
    try {
      parsed = options.parse(raw);
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) {
      value = parsed;
      break;
    }
  }
  cache.current = { key, raws, value };
  return value;
}

/**
 * React state saved in `localStorage` under a single key: reading and writing
 * use the same key, so a setting cannot "disappear" after a restart.
 *
 * Every mounted instance on the same key stays in sync: a write from one is seen by the
 * others at once (and a write from another window through the `storage` event).
 * `fallback` is read once, on the first render.
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
  options: PersistedStateOptions<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const fallbackRef = useRef(fallback);
  const optionsRef = useRef(options);
  const cacheRef = useRef<Snapshot<T> | null>(null);
  useEffect(() => {
    optionsRef.current = options;
  });

  const subscribe = useCallback((onChange: () => void) => subscribeKey(key, onChange), [key]);
  const value = useSyncExternalStore(subscribe, () => readSnapshot(cacheRef, key, fallbackRef.current, options));

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = optionsRef.current;
      // Read from the store, not from React state: two updates in one tick compose correctly.
      const prev = readSnapshot(cacheRef, key, fallbackRef.current, current);
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      writeRaw(key, (current.serialize ?? String)(resolved));
    },
    [key],
  );

  return [value, update];
}

/** Parser for on/off settings. */
export const parseBoolean = (raw: string): boolean | undefined =>
  raw === 'true' ? true : raw === 'false' ? false : undefined;

/** Parser for a setting that is one of a fixed list of strings. */
export const parseOneOf =
  <T extends string>(values: readonly T[]) =>
  (raw: string): T | undefined =>
    (values as readonly string[]).includes(raw) ? (raw as T) : undefined;
