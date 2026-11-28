/**
 * Clamp a seek target to an active A-B loop.
 *
 * A loop is active only when both markers are set and B > A. Any target outside
 * the half-open range [A, B) (before A, or at/after B) snaps to A, so playback
 * always stays inside the loop and restarts from A. Without an active loop the
 * target is returned unchanged.
 */
export function clampSeekToLoop(targetMs: number, a: number | null, b: number | null): number {
  if (a === null || b === null || b <= a) return targetMs;
  if (targetMs < a || targetMs >= b) return a;
  return targetMs;
}
