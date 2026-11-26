import type { TrackRecord } from '../../../types/library';
import { isHiRes } from './trackModel';

/** Marker for an album whose tracks are in more than one file format. */
export const MIXED_FORMAT = 'MIXED';

export interface AlbumStats {
  trackCount: number;
  durationMs: number;
  /** Upper-case format shared by every track, or `MIXED_FORMAT`. */
  format: string;
  hiRes: boolean;
  /** Sum of the play counts of all tracks. */
  playCount: number;
  /** Tracks played at least once. */
  heardCount: number;
}

/** Per-album totals in a single pass over the tracks. Tracks without an album are skipped. */
export function buildAlbumStats(tracks: readonly TrackRecord[]): Map<number, AlbumStats> {
  const stats = new Map<number, AlbumStats>();
  for (const track of tracks) {
    if (track.album_id == null) continue;
    const format = track.format.toUpperCase();
    const plays = track.play_count ?? 0;
    const entry = stats.get(track.album_id);
    if (!entry) {
      stats.set(track.album_id, {
        trackCount: 1,
        durationMs: track.duration_ms || 0,
        format,
        hiRes: isHiRes(track),
        playCount: plays,
        heardCount: plays > 0 ? 1 : 0,
      });
      continue;
    }
    entry.trackCount += 1;
    entry.durationMs += track.duration_ms || 0;
    if (entry.format !== format) entry.format = MIXED_FORMAT;
    entry.hiRes ||= isHiRes(track);
    entry.playCount += plays;
    if (plays > 0) entry.heardCount += 1;
  }
  return stats;
}
