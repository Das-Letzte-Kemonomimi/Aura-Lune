/**
 * Lets programmatic volume changes (the sleep-timer fade) skip the volume OSD.
 *
 * The OSD reacts to every change of the live volume, whatever caused it. A caller that moves the
 * volume on its own registers the gain it is about to set; the OSD then ignores a change that lands
 * on that gain within a short window. A user-driven change goes to a different gain, so it still shows.
 */

/** Covers the backend status event (100–250 ms) that reports the new volume, with margin. */
export const VOLUME_OSD_SILENCE_MS = 1500;

const GAIN_TOLERANCE = 0.01;

let silencedGain: number | null = null;
let silencedUntil = 0;

/** Marks `gain` as a programmatic volume target: the OSD stays hidden when the volume lands on it. */
export function silenceVolumeOsdFor(gain: number): void {
  silencedGain = gain;
  silencedUntil = Date.now() + VOLUME_OSD_SILENCE_MS;
}

/** True when a change to `gain` was announced as programmatic and the window is still open. */
export function isVolumeOsdSilenced(gain: number): boolean {
  if (silencedGain === null || Date.now() > silencedUntil) return false;
  return Math.abs(gain - silencedGain) <= GAIN_TOLERANCE;
}

/** Test helper: forget any registered target. */
export function resetVolumeOsdSilence(): void {
  silencedGain = null;
  silencedUntil = 0;
}
