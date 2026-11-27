/**
 * Fast-changing playback status fields (position, spectrum) outside the `App` React state.
 *
 * The backend sends the status ~10×/s. If every frame went into `useState` in `App`, the whole
 * app would render 10×/s. Instead:
 * - `App` gets the status only on meaningful changes (state, track, volume, DSP…) and
 *   with the position refreshed at most once a second (enough for bookmarks, session saving etc.),
 * - components drawing progress / visualisations subscribe to this store through `useLiveStatus`,
 *   `useLivePositionMs` or `useLiveSpectrum`, and only they render.
 */
import { useSyncExternalStore } from 'react';
import type { PlaybackStatus } from '../types/playback';

export interface LivePlaybackSnapshot {
  /** `false` until the first status arrives; until then the hooks return the prop values. */
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

  /** Publishes a new position and/or spectrum. No change → no notifications. */
  publish(update: { positionMs?: number; spectrum?: number[] }) {
    const positionMs = update.positionMs ?? snapshot.positionMs;
    const incomingSpectrum = update.spectrum;
    let spectrum = snapshot.spectrum;
    if (incomingSpectrum !== undefined && incomingSpectrum !== snapshot.spectrum) {
      let unchanged = incomingSpectrum.length === snapshot.spectrum.length;
      if (unchanged) {
        for (let i = 0; i < incomingSpectrum.length; i++) {
          if (incomingSpectrum[i] !== snapshot.spectrum[i]) {
            unchanged = false;
            break;
          }
        }
      }
      if (!unchanged) {
        spectrum = incomingSpectrum;
      }
    }
    if (snapshot.ready && positionMs === snapshot.positionMs && spectrum === snapshot.spectrum) return;
    snapshot = { ready: true, positionMs, spectrum };
    emit();
  },

  /** Tests only: restores the initial state. */
  reset() {
    snapshot = { ready: false, positionMs: 0, spectrum: [] };
    emit();
  },
};

function useSnapshot(): LivePlaybackSnapshot {
  return useSyncExternalStore(livePlayback.subscribe, livePlayback.getSnapshot, livePlayback.getSnapshot);
}

/** Current playback position (ms); `fallback` before the first backend status. */
export function useLivePositionMs(fallback: number): number {
  const s = useSnapshot();
  return s.ready ? s.positionMs : fallback;
}

/** Current spectrum; `fallback` before the first backend status. */
export function useLiveSpectrum(fallback: number[]): number[] {
  const s = useSnapshot();
  return s.ready && s.spectrum.length > 0 ? s.spectrum : fallback;
}

/**
 * Returns `status` with the current `position_ms` and `spectrum`. The component calling this hook
 * renders on every status frame: use it only in components that draw progress.
 */
export function useLiveStatus<T extends Pick<PlaybackStatus, 'position_ms' | 'spectrum'>>(status: T): T {
  const s = useSnapshot();
  if (!s.ready) return status;
  const spectrum = s.spectrum.length > 0 ? s.spectrum : status.spectrum;
  if (status.position_ms === s.positionMs && status.spectrum === spectrum) return status;
  return { ...status, position_ms: s.positionMs, spectrum };
}

/**
 * A value derived from the store (e.g. the position rounded to a second). The component renders only
 * when the selector result changes: the selector MUST return a primitive (number/string/bool).
 */
export function useLiveSelector<T extends string | number | boolean | null | undefined>(
  selector: (snapshot: LivePlaybackSnapshot) => T,
): T {
  return useSyncExternalStore(
    livePlayback.subscribe,
    () => selector(livePlayback.getSnapshot()),
    () => selector(livePlayback.getSnapshot()),
  );
}

/** The exact position at call time (outside render, e.g. in a click handler). */
export function currentPositionMs(fallback: number): number {
  const s = livePlayback.getSnapshot();
  return s.ready ? s.positionMs : fallback;
}
