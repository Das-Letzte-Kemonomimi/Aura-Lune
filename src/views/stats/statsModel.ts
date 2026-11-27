import type { AlbumRecord, TrackRecord } from '../../types/library';
import { isHiRes } from '../library/sections/trackModel';

export interface ArtistPlays {
  artist: string;
  plays: number;
  tracks: number;
}

export interface FormatShare {
  format: string;
  count: number;
  percent: number;
}

export interface LibraryStats {
  totalTracks: number;
  totalAlbums: number;
  totalArtists: number;
  totalPlays: number;
  totalListenedMs: number;
  topTracks: TrackRecord[];
  topArtists: ArtistPlays[];
  formatBreakdown: FormatShare[];
  hiResCount: number;
  recentTracks: TrackRecord[];
}

const TOP_N = 5;

/** Library-wide totals, top 5 lists, format shares and the recently played tracks. */
export function computeLibraryStats(tracks: TrackRecord[], albums: AlbumRecord[], unknownArtist: string): LibraryStats {
  const totalTracks = tracks.length;
  const plays = (t: TrackRecord) => t.play_count || 0;

  const topTracks = tracks
    .filter((t) => plays(t) > 0)
    .sort((a, b) => plays(b) - plays(a))
    .slice(0, TOP_N);

  const artistMap = new Map<string, ArtistPlays>();
  const formatMap = new Map<string, number>();
  for (const t of tracks) {
    const artist = t.artist || unknownArtist;
    const entry = artistMap.get(artist) ?? { artist, plays: 0, tracks: 0 };
    entry.plays += plays(t);
    entry.tracks += 1;
    artistMap.set(artist, entry);

    const format = (t.format || 'OTHER').toUpperCase();
    formatMap.set(format, (formatMap.get(format) ?? 0) + 1);
  }

  const topArtists = Array.from(artistMap.values())
    .filter((a) => a.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, TOP_N);

  const formatBreakdown = Array.from(formatMap, ([format, count]) => ({
    format,
    count,
    percent: totalTracks > 0 ? Math.round((count / totalTracks) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  const recentTracks = tracks
    .filter((t) => t.last_played_at)
    .sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0))
    .slice(0, TOP_N);

  return {
    totalTracks,
    totalAlbums: albums.length,
    totalArtists: new Set(tracks.map((t) => t.artist).filter(Boolean)).size,
    totalPlays: tracks.reduce((acc, t) => acc + plays(t), 0),
    totalListenedMs: tracks.reduce((acc, t) => acc + plays(t) * (t.duration_ms || 0), 0),
    topTracks,
    topArtists,
    formatBreakdown,
    hiResCount: tracks.filter(isHiRes).length,
    recentTracks,
  };
}

/**
 * Which of the three count forms (`…Single`, `…Few`, `…Many`) a number takes, by the Polish rule
 * the locale files are written for: 1 → one; 2–4, 22–24, 32–34 … (but not 12–14) → few; else many.
 * Languages with two forms simply repeat the plural text in `…Few` and `…Many`.
 */
export function countForm(count: number): 'one' | 'few' | 'many' {
  if (count === 1) return 'one';
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'few';
  return 'many';
}
