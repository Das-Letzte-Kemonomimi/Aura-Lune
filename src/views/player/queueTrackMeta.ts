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

/** Indexed track and album lookup maps built once per tracks/albums change. */
export interface QueueTrackLookup {
  trackById: Map<number, TrackRecord>;
  trackByPath: Map<string, TrackRecord>;
  albumById: Map<number, AlbumRecord>;
  albumByLowerTitle: Map<string, AlbumRecord>;
}

/** Builds O(1) lookup maps for queue row metadata resolution. */
export function buildQueueTrackLookup(tracks: TrackRecord[], albums: AlbumRecord[]): QueueTrackLookup {
  const trackById = new Map<number, TrackRecord>();
  const trackByPath = new Map<string, TrackRecord>();
  for (const t of tracks) {
    trackById.set(t.id, t);
    trackByPath.set(t.path, t);
  }
  const albumById = new Map<number, AlbumRecord>();
  const albumByLowerTitle = new Map<string, AlbumRecord>();
  for (const a of albums) {
    albumById.set(a.id, a);
    const titleKey = a.title.trim().toLowerCase();
    if (!albumByLowerTitle.has(titleKey)) {
      albumByLowerTitle.set(titleKey, a);
    }
  }
  return { trackById, trackByPath, albumById, albumByLowerTitle };
}

/** Matches a queue item using pre-built O(1) track and album maps. */
export function resolveQueueTrackMetaFromLookup(
  item: QueueItem,
  lookup: QueueTrackLookup,
): QueueTrackMeta {
  const track =
    (item.track_id != null ? lookup.trackById.get(item.track_id) : undefined) ??
    lookup.trackByPath.get(item.uri);
  let album = track && track.album_id != null ? lookup.albumById.get(track.album_id) ?? null : null;
  if (!album && item.album) {
    album = lookup.albumByLowerTitle.get(item.album.trim().toLowerCase()) ?? null;
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
  return resolveQueueTrackMetaFromLookup(item, buildQueueTrackLookup(tracks, albums));
}
