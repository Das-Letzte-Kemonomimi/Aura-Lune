import { useCallback, useEffect, useRef } from 'react';
import { easeDisplayPosition, extrapolatePositionMs, type ClockAnchor } from '../utils/playbackClock';

export interface PlaybackClockOptions {
  /** Ostatnia pozycja z backendu (ms); każda zmiana ustawia nową kotwicę zegara. */
  positionMs: number;
  playing: boolean;
  /** Prędkość czasu źródła względem rzeczywistego (zob. `playbackSpeed`). */
  speed: number;
  durationMs?: number | null;
  loopB?: number | null;
}

/**
 * Zwraca funkcję `(dtSec) => pozycja (ms)` do wołania w każdej klatce rysowania: pozycja ekstrapolowana między
 * tickami backendu (~10 Hz) i wygładzona. Kotwica jest przestawiana, gdy zmieni się `positionMs`.
 */
export function usePlaybackClock(options: PlaybackClockOptions): (dtSec: number) => number {
  const optionsRef = useRef(options);
  const anchorRef = useRef<ClockAnchor>({ positionMs: options.positionMs, at: performance.now() });
  const displayRef = useRef<number | null>(null);
  const lastPlayingRef = useRef(options.playing);

  // Kotwica z czasem nadejścia pozycji; zmiana odtwarzania resetuje wygładzanie
  useEffect(() => {
    optionsRef.current = options;
    if (options.positionMs !== anchorRef.current.positionMs) {
      anchorRef.current = { positionMs: options.positionMs, at: performance.now() };
    }
    if (options.playing !== lastPlayingRef.current) {
      lastPlayingRef.current = options.playing;
      anchorRef.current = { positionMs: options.positionMs, at: performance.now() };
      displayRef.current = null;
    }
  });

  return useCallback((dtSec: number) => {
    const o = optionsRef.current;
    const target = extrapolatePositionMs(anchorRef.current, performance.now(), {
      speed: o.speed,
      playing: o.playing,
      durationMs: o.durationMs,
      loopB: o.loopB,
    });
    const next = easeDisplayPosition(displayRef.current, target, dtSec, o.playing);
    displayRef.current = next;
    return next;
  }, []);
}
