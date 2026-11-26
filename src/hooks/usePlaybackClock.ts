import { useCallback, useEffect, useRef } from 'react';
import { easeDisplayPosition, extrapolatePositionMs, type ClockAnchor } from '../utils/playbackClock';

export interface PlaybackClockOptions {
  /** The last position from the backend (ms); every change sets a new clock anchor. */
  positionMs: number;
  playing: boolean;
  /** Speed of the source time relative to real time (see `playbackSpeed`). */
  speed: number;
  durationMs?: number | null;
  loopB?: number | null;
}

/**
 * Returns a `(dtSec) => position (ms)` function to call on every drawing frame: the position is extrapolated between
 * backend ticks (~10 Hz) and smoothed. The anchor moves when `positionMs` changes.
 */
export function usePlaybackClock(options: PlaybackClockOptions): (dtSec: number) => number {
  const optionsRef = useRef(options);
  const anchorRef = useRef<ClockAnchor>({ positionMs: options.positionMs, at: performance.now() });
  const displayRef = useRef<number | null>(null);
  const lastPlayingRef = useRef(options.playing);

  // Anchor with the position's arrival time; a playback change resets the smoothing
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
