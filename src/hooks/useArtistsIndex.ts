import { useDeferredValue, useMemo } from 'react';
import type { AlbumRecord, TrackRecord } from '../types/library';
import type { ArtistLibraryItem } from '../views/library/LibraryView';
import { normalizeStr } from '../utils/textNormalize';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export interface UseArtistsIndexOptions {
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  search: string;
  unknownArtist: string;
  enabled: boolean;
}

/**
 * Lazily groups library tracks by artist and filters by the search query using a single
 * `albumById` lookup map. Skips all work when the Artists sub-view is not active.
 */
export function useArtistsIndex({
  tracks,
  albums,
  search,
  unknownArtist,
  enabled,
}: UseArtistsIndexOptions): ArtistLibraryItem[] {
  const deferredSearch = useDeferredValue(search);

  const albumById = useMemo(() => {
    if (!enabled) return new Map<number, AlbumRecord>();
    return new Map(albums.map((a) => [a.id, a]));
  }, [albums, enabled]);

  const artistGroups = useMemo(() => {
    if (!enabled) return [];
    const map = new Map<string, ArtistLibraryItem>();
    for (const t of tracks) {
      const name = t.artist || unknownArtist;
      let existing = map.get(name);
      if (!existing) {
        existing = {
          name,
          tracks: [],
          albumIds: new Set<number>(),
          totalDurationMs: 0,
          totalPlays: 0,
          sampleCover: null,
        };
        map.set(name, existing);
      }
      existing.tracks.push(t);
      if (t.album_id != null) {
        existing.albumIds.add(t.album_id);
        if (!existing.sampleCover) {
          const alb = albumById.get(t.album_id);
          if (alb?.cover_path) existing.sampleCover = alb.cover_path;
        }
      }
      existing.totalDurationMs += t.duration_ms || 0;
      existing.totalPlays += t.play_count || 0;
    }
    const list = Array.from(map.values());
    list.sort((a, b) => collator.compare(a.name, b.name));
    return list;
  }, [albumById, enabled, tracks, unknownArtist]);

  return useMemo(() => {
    if (!enabled) return [];
    const raw = deferredSearch.trim();
    if (!raw) return artistGroups;
    const q = normalizeStr(raw);
    return artistGroups.filter((a) => normalizeStr(a.name).includes(q));
  }, [artistGroups, deferredSearch, enabled]);
}
