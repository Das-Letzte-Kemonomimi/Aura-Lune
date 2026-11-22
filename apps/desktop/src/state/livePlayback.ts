/**
 * Szybkozmienne pola statusu odtwarzania (pozycja, spektrum) poza stanem Reacta `App`.
 *
 * Backend wysyła status ~10×/s. Gdyby każda klatka trafiała do `useState` w `App`, cała
 * aplikacja renderowałaby się 10×/s. Zamiast tego:
 * - `App` dostaje status tylko przy zmianach istotnych (stan, utwór, głośność, DSP…) oraz
 *   z pozycją odświeżaną najwyżej raz na sekundę (wystarcza dla zakładek, zapisu sesji itd.),
 * - komponenty rysujące postęp / wizualizacje subskrybują ten store przez `useLiveStatus`,
 *   `useLivePositionMs` lub `useLiveSpectrum` i renderują się tylko one.
 */
import { useSyncExternalStore } from 'react';
import type { PlaybackStatus } from '../types/playback';

export interface LivePlaybackSnapshot {
  /** `false`, dopóki nie dotarł pierwszy status — wtedy hooki zwracają wartości z propsów. */
  ready: boolean;
  positionMs: number;
  spectrum: number[];
}

type Listener = () => void;

let snapshot: LivePlaybackSnapshot = { ready: false, positionMs: 0, spectrum: [] };
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const livePlayback = {
  getSnapshot(): LivePlaybackSnapshot {
    return snapshot;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Publikuje nową pozycję i/lub spektrum. Brak zmian → brak powiadomień. */
  publish(update: { positionMs?: number; spectrum?: number[] }) {
    const positionMs = update.positionMs ?? snapshot.positionMs;
    const spectrum = update.spectrum ?? snapshot.spectrum;
    if (snapshot.ready && positionMs === snapshot.positionMs && spectrum === snapshot.spectrum) return;
    snapshot = { ready: true, positionMs, spectrum };
    emit();
  },

  /** Tylko dla testów: przywraca stan początkowy. */
  reset() {
    snapshot = { ready: false, positionMs: 0, spectrum: [] };
    emit();
  },
};

function useSnapshot(): LivePlaybackSnapshot {
  return useSyncExternalStore(livePlayback.subscribe, livePlayback.getSnapshot, livePlayback.getSnapshot);
}

/** Bieżąca pozycja odtwarzania (ms); `fallback` przed pierwszym statusem z backendu. */
export function useLivePositionMs(fallback: number): number {
  const s = useSnapshot();
  return s.ready ? s.positionMs : fallback;
}

/** Bieżące spektrum; `fallback` przed pierwszym statusem z backendu. */
export function useLiveSpectrum(fallback: number[]): number[] {
  const s = useSnapshot();
  return s.ready && s.spectrum.length > 0 ? s.spectrum : fallback;
}

/**
 * Zwraca `status` z aktualnymi `position_ms` i `spectrum`. Komponent wywołujący ten hook
 * renderuje się przy każdej klatce statusu — używaj go tylko w komponentach rysujących postęp.
 */
export function useLiveStatus<T extends Pick<PlaybackStatus, 'position_ms' | 'spectrum'>>(status: T): T {
  const s = useSnapshot();
  if (!s.ready) return status;
  const spectrum = s.spectrum.length > 0 ? s.spectrum : status.spectrum;
  if (status.position_ms === s.positionMs && status.spectrum === spectrum) return status;
  return { ...status, position_ms: s.positionMs, spectrum };
}

/** Dokładna pozycja w chwili wywołania (poza renderem, np. w handlerze kliknięcia). */
export function currentPositionMs(fallback: number): number {
  const s = livePlayback.getSnapshot();
  return s.ready ? s.positionMs : fallback;
}
