import type { AlbumRecord, TrackRecord } from '../../types/player';
import type { QueueItem } from '../../types/queue';

/** Dane biblioteki wyświetlane przy elemencie kolejki (okładka, format, jakość). */
export interface QueueTrackMeta {
  track: TrackRecord | undefined;
  album: AlbumRecord | null | undefined;
  cover: string | null;
  format: string;
  sampleRate: number | undefined;
  bitDepth: number | null | undefined;
}

/**
 * Dopasowuje element kolejki do utworu i albumu z biblioteki: najpierw po `track_id`
 * lub ścieżce, album po `album_id`, a w razie braku — po tytule albumu z elementu kolejki.
 * Format bez dopasowania to rozszerzenie pliku (lub `AUDIO`).
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
