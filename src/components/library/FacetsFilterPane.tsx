import React, { useState, useMemo } from 'react';
import { Layers, Search, X } from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';

export interface FacetTrack {
  id: number;
  title: string;
  artist: string;
  album_artist?: string | null;
  album_id?: number | null;
  format: string;
  duration_ms: number;
}

export interface FacetAlbum {
  id: number;
  title: string;
  album_artist: string;
  year?: number | null;
}

interface FacetsFilterPaneProps {
  tracks: FacetTrack[];
  albums: FacetAlbum[];
  selectedFormat: string | null;
  selectedArtist: string | null;
  selectedAlbumId: number | null;
  onSelectFormat: (format: string | null) => void;
  onSelectArtist: (artist: string | null) => void;
  onSelectAlbumId: (albumId: number | null) => void;
  onResetAll: () => void;
  currentLang?: Language;
}

export const FacetsFilterPane: React.FC<FacetsFilterPaneProps> = ({
  tracks,
  albums,
  selectedFormat,
  selectedArtist,
  selectedAlbumId,
  onSelectFormat,
  onSelectArtist,
  onSelectAlbumId,
  onResetAll,
  currentLang = 'pl',
}) => {
  const loc = getTranslations(currentLang);
  const [formatSearch, setFormatSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [albumSearch, setAlbumSearch] = useState('');

  // 1. Count and filter the formats
  const formatCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tracks) {
      const fmt = t.format.toUpperCase();
      map.set(fmt, (map.get(fmt) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count);
  }, [tracks]);

  const filteredFormats = useMemo(() => {
    if (!formatSearch.trim()) return formatCounts;
    const q = formatSearch.toLowerCase();
    return formatCounts.filter((f) => f.format.toLowerCase().includes(q));
  }, [formatCounts, formatSearch]);

  // 2. Tracks narrowed to the selected format (for the artist column)
  const tracksInFormat = useMemo(() => {
    if (!selectedFormat) return tracks;
    return tracks.filter((t) => t.format.toUpperCase() === selectedFormat);
  }, [tracks, selectedFormat]);

  const artistCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tracksInFormat) {
      const a = t.artist.trim() || loc.facetsFilter.unknownArtist;
      map.set(a, (map.get(a) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => a.artist.localeCompare(b.artist));
  }, [tracksInFormat, loc.facetsFilter.unknownArtist]);

  const filteredArtists = useMemo(() => {
    if (!artistSearch.trim()) return artistCounts;
    const q = artistSearch.toLowerCase();
    return artistCounts.filter((a) => a.artist.toLowerCase().includes(q));
  }, [artistCounts, artistSearch]);

  // 3. Tracks narrowed to the format and artist (for the album column)
  const tracksInArtist = useMemo(() => {
    if (!selectedArtist) return tracksInFormat;
    return tracksInFormat.filter((t) => t.artist.trim() === selectedArtist);
  }, [tracksInFormat, selectedArtist]);

  const albumMap = useMemo(() => {
    const m = new Map<number, FacetAlbum>();
    for (const a of albums) {
      m.set(a.id, a);
    }
    return m;
  }, [albums]);

  const albumCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of tracksInArtist) {
      if (t.album_id) {
        map.set(t.album_id, (map.get(t.album_id) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([albumId, count]) => {
        const alb = albumMap.get(albumId);
        return {
          albumId,
          title: alb ? alb.title : `Album #${albumId}`,
          year: alb ? alb.year : null,
          count,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tracksInArtist, albumMap]);

  const filteredAlbums = useMemo(() => {
    if (!albumSearch.trim()) return albumCounts;
    const q = albumSearch.toLowerCase();
    return albumCounts.filter((a) => a.title.toLowerCase().includes(q));
  }, [albumCounts, albumSearch]);

  const hasActiveFilter = selectedFormat !== null || selectedArtist !== null || selectedAlbumId !== null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-black/25 p-3">
      {/* Faceted filter toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-accent-pink" />
          <span className="text-ui font-bold text-fg">
            {loc.facetsFilter.title}
          </span>
          {hasActiveFilter && (
            <span className="rounded-md bg-accent-cyan/15 px-2 py-0.5 font-mono text-xs text-accent-cyan">
              {fmt(loc.facetsFilter.activeFilter, String(tracksInArtist.length))}
            </span>
          )}
        </div>

        {hasActiveFilter && (
          <button
            onClick={onResetAll}
            className="flex items-center gap-1 rounded-md border border-accent-red/30 bg-accent-red/15 px-2 py-1 text-xs text-red-400"
          >
            <X size={12} />
            {loc.facetsFilter.clearFilters}
          </button>
        )}
      </div>

      {/* 3 column panels */}
      <div className="grid h-52.5 grid-cols-[minmax(--spacing(35),--spacing(45))_1fr_1fr] gap-2.5">
        {/* Column 1: format */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-white/3">
          <div className="flex items-center justify-between border-b border-white/6 bg-black/20 px-2.5 py-1.5">
            <span className="text-xs font-bold text-fg-secondary">
              FORMAT ({formatCounts.length})
            </span>
          </div>
          <div className="border-b border-white/4 px-1.5 py-1">
            <div className="flex items-center rounded-sm bg-black/30 px-1.5 py-0.5">
              <Search size={12} className="text-fg-muted" />
              <input
                type="text"
                placeholder={loc.facetsFilter.search}
                value={formatSearch}
                onChange={(e) => setFormatSearch(e.target.value)}
                className="ml-1 w-full border-0 bg-transparent text-xs text-fg outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <div
              onClick={() => onSelectFormat(null)}
              className={cn(
                'flex cursor-pointer justify-between rounded-sm px-2 py-1 text-xs',
                selectedFormat === null ? 'bg-accent-pink' : 'bg-transparent',
                selectedFormat === null ? 'text-fg' : 'text-fg-secondary',
                selectedFormat === null ? 'font-bold' : 'font-normal',
              )}
            >
              <span>{loc.facetsFilter.all}</span>
              <span className="font-mono opacity-70">{tracks.length}</span>
            </div>
            {filteredFormats.map((f) => (
              <div
                key={f.format}
                onClick={() => onSelectFormat(f.format === selectedFormat ? null : f.format)}
                className={cn(
                  'flex cursor-pointer justify-between rounded-sm px-2 py-1 text-xs text-fg',
                  selectedFormat === f.format ? 'bg-accent-pink' : 'bg-transparent',
                  selectedFormat === f.format && '',
                  selectedFormat === f.format ? 'font-bold' : 'font-normal',
                )}
              >
                <span>{f.format}</span>
                <span className="font-mono opacity-70">{f.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: artist */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-white/3">
          <div className="flex items-center justify-between border-b border-white/6 bg-black/20 px-2.5 py-1.5">
            <span className="text-xs font-bold text-fg-secondary">
              {loc.facetsFilter.artistHeader} ({artistCounts.length})
            </span>
          </div>
          <div className="border-b border-white/4 px-1.5 py-1">
            <div className="flex items-center rounded-sm bg-black/30 px-1.5 py-0.5">
              <Search size={12} className="text-fg-muted" />
              <input
                type="text"
                placeholder={loc.facetsFilter.searchArtist}
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                className="ml-1 w-full border-0 bg-transparent text-xs text-fg outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <div
              onClick={() => onSelectArtist(null)}
              className={cn(
                'flex cursor-pointer justify-between rounded-sm px-2 py-1 text-xs',
                selectedArtist === null ? 'bg-accent-pink' : 'bg-transparent',
                selectedArtist === null ? 'text-fg' : 'text-fg-secondary',
                selectedArtist === null ? 'font-bold' : 'font-normal',
              )}
            >
              <span>{loc.facetsFilter.allArtists}</span>
              <span className="font-mono opacity-70">{tracksInFormat.length}</span>
            </div>
            {filteredArtists.map((a) => (
              <div
                key={a.artist}
                onClick={() => onSelectArtist(a.artist === selectedArtist ? null : a.artist)}
                className={cn(
                  'flex cursor-pointer justify-between rounded-sm px-2 py-1 text-xs text-fg',
                  selectedArtist === a.artist ? 'bg-accent-pink' : 'bg-transparent',
                  selectedArtist === a.artist && '',
                  selectedArtist === a.artist ? 'font-bold' : 'font-normal',
                )}
              >
                <span className="mr-1.5 truncate">
                  {a.artist}
                </span>
                <span className="font-mono opacity-70">{a.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: album */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-white/3">
          <div className="flex items-center justify-between border-b border-white/6 bg-black/20 px-2.5 py-1.5">
            <span className="text-xs font-bold text-fg-secondary">
              ALBUM ({albumCounts.length})
            </span>
          </div>
          <div className="border-b border-white/4 px-1.5 py-1">
            <div className="flex items-center rounded-sm bg-black/30 px-1.5 py-0.5">
              <Search size={12} className="text-fg-muted" />
              <input
                type="text"
                placeholder={loc.facetsFilter.searchAlbum}
                value={albumSearch}
                onChange={(e) => setAlbumSearch(e.target.value)}
                className="ml-1 w-full border-0 bg-transparent text-xs text-fg outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <div
              onClick={() => onSelectAlbumId(null)}
              className={cn(
                'flex cursor-pointer justify-between rounded-sm px-2 py-1 text-xs',
                selectedAlbumId === null ? 'bg-accent-pink' : 'bg-transparent',
                selectedAlbumId === null ? 'text-fg' : 'text-fg-secondary',
                selectedAlbumId === null ? 'font-bold' : 'font-normal',
              )}
            >
              <span>{loc.facetsFilter.all}</span>
              <span className="font-mono opacity-70">{tracksInArtist.length}</span>
            </div>
            {filteredAlbums.map((alb) => (
              <div
                key={alb.albumId}
                onClick={() => onSelectAlbumId(alb.albumId === selectedAlbumId ? null : alb.albumId)}
                className={cn(
                  'flex cursor-pointer justify-between rounded-sm px-2 py-1 text-xs text-fg',
                  selectedAlbumId === alb.albumId ? 'bg-accent-pink' : 'bg-transparent',
                  selectedAlbumId === alb.albumId && '',
                  selectedAlbumId === alb.albumId ? 'font-bold' : 'font-normal',
                )}
              >
                <span className="mr-1.5 truncate">
                  {alb.title} {alb.year ? `(${alb.year})` : ''}
                </span>
                <span className="font-mono opacity-70">{alb.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
