import type { AlbumRecord, TrackRecord } from '../../types/player';
import type { QueueItem } from '../../types/queue';

/** Library data shown next to a queue item (cover, format, quality). */
export interface QueueTrackMeta {
  track: TrackRecord | undefined;
  album: AlbumRecord | null | undefined;
  cover: string | null;
  format: string;
  sampleRate: number | undefined;
  bitDepth: number | null | undefined;
}

/**
 * Matches a queue item to a library track and album: first by `track_id`
 * or path, the album by `album_id`, and failing that by the album title of the queue item.
 * Without a match the format is the file extension (or `AUDIO`).
 */
export function resolveQueueTrackMeta(
  item: QueueItem,
  tracks: TrackRecord[],
  albums: AlbumRecord[],
): QueueTrackMeta {
  const track = tracks.find(
    (t) => (item.track_id != null && t.id === item.track_id) || t.path === item.uri,
  );
  let album = track && track.album_id ? albums.find((a) => a.id === track.album_id) : null;
  if (!album && item.album) {
    const title = item.album.trim().toLowerCase();
    album = albums.find((a) => a.title.trim().toLowerCase() === title) || null;
  }
  const ext = item.uri.split('.').pop()?.toUpperCase() || 'AUDIO';
  return {
    track,
    album,
    cover: album?.cover_path || null,
    format: track?.format || ext,
    sampleRate: track?.sample_rate,
    bitDepth: track?.bit_depth,
  };
}
