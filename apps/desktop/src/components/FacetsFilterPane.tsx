import React, { useState, useMemo } from 'react';
import { Layers, Search, X } from 'lucide-react';

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
}) => {
  const [formatSearch, setFormatSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [albumSearch, setAlbumSearch] = useState('');

  // 1. Zliczanie i filtrowanie formatów
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

  // 2. Utwory zawężone do wybranego formatu (dla kolumny wykonawców)
  const tracksInFormat = useMemo(() => {
    if (!selectedFormat) return tracks;
    return tracks.filter((t) => t.format.toUpperCase() === selectedFormat);
  }, [tracks, selectedFormat]);

  const artistCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tracksInFormat) {
      const a = t.artist.trim() || 'Nieznany wykonawca';
      map.set(a, (map.get(a) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => a.artist.localeCompare(b.artist));
  }, [tracksInFormat]);

  const filteredArtists = useMemo(() => {
    if (!artistSearch.trim()) return artistCounts;
    const q = artistSearch.toLowerCase();
    return artistCounts.filter((a) => a.artist.toLowerCase().includes(q));
  }, [artistCounts, artistSearch]);

  // 3. Utwory zawężone do formatu i wykonawcy (dla kolumny albumów)
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: '12px',
        padding: '12px',
      }}
    >
      {/* Pasek narzędziowy filtrów fasetowych */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} style={{ color: 'var(--accent-pink, #ec4899)' }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>
            Filtry fasetowe (foobar2000 Facets)
          </span>
          {hasActiveFilter && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--accent-cyan, #06b6d4)',
                background: 'rgba(6, 182, 212, 0.15)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Aktywny filtr: {tracksInArtist.length} utworów
            </span>
          )}
        </div>

        {hasActiveFilter && (
          <button
            onClick={onResetAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            <X size={12} />
            Wyczyść filtry
          </button>
        )}
      </div>

      {/* 3 Panele kolumnowe */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px, 180px) 1fr 1fr',
          gap: '10px',
          height: '210px',
        }}
      >
        {/* Kolumna 1: Format */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              FORMAT ({formatCounts.length})
            </span>
          </div>
          <div style={{ padding: '4px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '2px 6px' }}>
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Szukaj..."
                value={formatSearch}
                onChange={(e) => setFormatSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '0.72rem',
                  marginLeft: '4px',
                  width: '100%',
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
            <div
              onClick={() => onSelectFormat(null)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                background: selectedFormat === null ? 'var(--accent-pink, #ec4899)' : 'transparent',
                color: selectedFormat === null ? '#fff' : 'var(--text-secondary)',
                fontWeight: selectedFormat === null ? 700 : 400,
              }}
            >
              <span>(Wszystkie)</span>
              <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{tracks.length}</span>
            </div>
            {filteredFormats.map((f) => (
              <div
                key={f.format}
                onClick={() => onSelectFormat(f.format === selectedFormat ? null : f.format)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  background: selectedFormat === f.format ? 'var(--accent-pink, #ec4899)' : 'transparent',
                  color: selectedFormat === f.format ? '#fff' : 'var(--text-primary)',
                  fontWeight: selectedFormat === f.format ? 700 : 400,
                }}
              >
                <span>{f.format}</span>
                <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{f.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kolumna 2: Wykonawca */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              WYKONAWCA ({artistCounts.length})
            </span>
          </div>
          <div style={{ padding: '4px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '2px 6px' }}>
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Szukaj wykonawcy..."
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '0.72rem',
                  marginLeft: '4px',
                  width: '100%',
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
            <div
              onClick={() => onSelectArtist(null)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                background: selectedArtist === null ? 'var(--accent-pink, #ec4899)' : 'transparent',
                color: selectedArtist === null ? '#fff' : 'var(--text-secondary)',
                fontWeight: selectedArtist === null ? 700 : 400,
              }}
            >
              <span>(Wszyscy)</span>
              <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{tracksInFormat.length}</span>
            </div>
            {filteredArtists.map((a) => (
              <div
                key={a.artist}
                onClick={() => onSelectArtist(a.artist === selectedArtist ? null : a.artist)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  background: selectedArtist === a.artist ? 'var(--accent-pink, #ec4899)' : 'transparent',
                  color: selectedArtist === a.artist ? '#fff' : 'var(--text-primary)',
                  fontWeight: selectedArtist === a.artist ? 700 : 400,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
                  {a.artist}
                </span>
                <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{a.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kolumna 3: Album */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              ALBUM ({albumCounts.length})
            </span>
          </div>
          <div style={{ padding: '4px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '2px 6px' }}>
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Szukaj albumu..."
                value={albumSearch}
                onChange={(e) => setAlbumSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '0.72rem',
                  marginLeft: '4px',
                  width: '100%',
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
            <div
              onClick={() => onSelectAlbumId(null)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                background: selectedAlbumId === null ? 'var(--accent-pink, #ec4899)' : 'transparent',
                color: selectedAlbumId === null ? '#fff' : 'var(--text-secondary)',
                fontWeight: selectedAlbumId === null ? 700 : 400,
              }}
            >
              <span>(Wszystkie)</span>
              <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{tracksInArtist.length}</span>
            </div>
            {filteredAlbums.map((alb) => (
              <div
                key={alb.albumId}
                onClick={() => onSelectAlbumId(alb.albumId === selectedAlbumId ? null : alb.albumId)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  background: selectedAlbumId === alb.albumId ? 'var(--accent-pink, #ec4899)' : 'transparent',
                  color: selectedAlbumId === alb.albumId ? '#fff' : 'var(--text-primary)',
                  fontWeight: selectedAlbumId === alb.albumId ? 700 : 400,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
                  {alb.title} {alb.year ? `(${alb.year})` : ''}
                </span>
                <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{alb.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
