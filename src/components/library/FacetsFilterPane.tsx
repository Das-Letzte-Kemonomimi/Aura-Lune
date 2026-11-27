import React, { useState, useMemo } from 'react';
import { Layers, Search, X } from '../ui/icons';
import type { Translations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, TextField } from '../ui';

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
  loc: Translations;
}

interface FacetEntry<K> {
  key: K;
  label: string;
  count: number;
}

interface FacetColumnProps<K> {
  heading: string;
  /** Number of distinct values before the search narrows them. */
  total: number;
  searchPlaceholder: string;
  search: string;
  onSearch: (q: string) => void;
  allLabel: string;
  allCount: number;
  entries: FacetEntry<K>[];
  selected: K | null;
  onSelect: (key: K | null) => void;
}

const facetRow = 'flex w-full justify-between gap-1.5 rounded-sm px-2 py-1 text-left text-xs font-normal text-fg-secondary hover:bg-white/5 hover:text-fg aria-pressed:bg-accent-pink aria-pressed:font-bold aria-pressed:text-fg';

/** One facet column: heading with the value count, a search field and the selectable values. */
function FacetColumn<K extends string | number>({
  heading,
  total,
  searchPlaceholder,
  search,
  onSearch,
  allLabel,
  allCount,
  entries,
  selected,
  onSelect,
}: FacetColumnProps<K>) {
  return (
    <Card padding="none" className="flex flex-col overflow-hidden rounded-lg">
      <div className="border-b border-line bg-black/20 px-2.5 py-1.5 text-xs font-bold text-fg-secondary">
        {heading} ({total})
      </div>
      <div className="border-b border-line p-1.5">
        <TextField
          size="sm"
          icon={<Search size={12} />}
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div role="group" aria-label={heading} className="flex-1 overflow-y-auto p-1">
        <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className={facetRow}>
          <span>{allLabel}</span>
          <span className="font-mono opacity-70">{allCount}</span>
        </button>
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-pressed={selected === entry.key}
            onClick={() => onSelect(entry.key === selected ? null : entry.key)}
            className={cn(facetRow, 'text-fg')}
          >
            <span className="truncate">{entry.label}</span>
            <span className="font-mono opacity-70">{entry.count}</span>
          </button>
        ))}
      </div>
    </Card>
  );
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
  loc,
}) => {
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
    <Card variant="inset" padding="none" className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-accent-pink" />
          <span className="text-ui font-bold text-fg">{loc.facetsFilter.title}</span>
          {hasActiveFilter && (
            <Badge tone="cyan" mono>
              {fmt(loc.facetsFilter.activeFilter, String(tracksInArtist.length))}
            </Badge>
          )}
        </div>
        {hasActiveFilter && (
          <Button variant="danger" size="sm" onClick={onResetAll}>
            <X size={12} />
            {loc.facetsFilter.clearFilters}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:h-52.5 md:grid-cols-[minmax(--spacing(34),--spacing(44))_1fr_1fr]">
        <FacetColumn
          heading={loc.facetsFilter.formatHeader}
          total={formatCounts.length}
          searchPlaceholder={loc.facetsFilter.search}
          search={formatSearch}
          onSearch={setFormatSearch}
          allLabel={loc.facetsFilter.all}
          allCount={tracks.length}
          entries={filteredFormats.map((f) => ({ key: f.format, label: f.format, count: f.count }))}
          selected={selectedFormat}
          onSelect={onSelectFormat}
        />
        <FacetColumn
          heading={loc.facetsFilter.artistHeader}
          total={artistCounts.length}
          searchPlaceholder={loc.facetsFilter.searchArtist}
          search={artistSearch}
          onSearch={setArtistSearch}
          allLabel={loc.facetsFilter.allArtists}
          allCount={tracksInFormat.length}
          entries={filteredArtists.map((a) => ({ key: a.artist, label: a.artist, count: a.count }))}
          selected={selectedArtist}
          onSelect={onSelectArtist}
        />
        <FacetColumn
          heading={loc.facetsFilter.albumHeader}
          total={albumCounts.length}
          searchPlaceholder={loc.facetsFilter.searchAlbum}
          search={albumSearch}
          onSearch={setAlbumSearch}
          allLabel={loc.facetsFilter.all}
          allCount={tracksInArtist.length}
          entries={filteredAlbums.map((a) => ({ key: a.albumId, label: a.year ? `${a.title} (${a.year})` : a.title, count: a.count }))}
          selected={selectedAlbumId}
          onSelect={onSelectAlbumId}
        />
      </div>
    </Card>
  );
};
