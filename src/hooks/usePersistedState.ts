import { useCallback, useState } from 'react';

export interface PersistedStateOptions<T> {
  /** Zamiana zapisanego tekstu na wartość; `undefined` = wartość nieprawidłowa (użyj domyślnej). */
  parse: (raw: string) => T | undefined;
  serialize?: (value: T) => string;
  /** Starsze klucze, z których odczytujemy wartość, gdy bieżącego klucza jeszcze nie ma. */
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
    // localStorage niedostępny (np. tryb prywatny) — wartość domyślna.
  }
  return fallback;
}

/**
 * Stan Reacta zapisywany w `localStorage` pod jednym kluczem — odczyt i zapis
 * używają tego samego klucza, więc ustawienie nie może „zniknąć” po restarcie.
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
          // Brak trwałego zapisu nie może blokować zmiany w interfejsie.
        }
        return resolved;
      });
    },
    [key, serialize],
  );

  return [value, update];
}

/** Parser dla ustawień typu „wł./wył.”. */
export const parseBoolean = (raw: string): boolean | undefined =>
  raw === 'true' ? true : raw === 'false' ? false : undefined;
