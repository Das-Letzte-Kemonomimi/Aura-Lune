import React from 'react';
import { ArrowUpDown, Copy, Disc, Mic2, Music, Search, X } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';

export type LibraryToolbarProps = Pick<LibraryViewProps, 'setLibrarySubView' | 'librarySubView' | 'loc' | 'filteredTracks' | 'handleBackFromAlbumDetail' | 'filteredAlbums' | 'filteredArtists' | 'librarySearchInputRef' | 'librarySearch' | 'setLibrarySearch' | 'sortedTracks' | 'handlePlayLibraryTrack' | 'showMessage' | 'sortedAlbums' | 'tracks' | 'libraryFormatFilter' | 'setLibraryFormatFilter' | 'hideDuplicates' | 'setHideDuplicates' | 'sortField' | 'setSortField' | 'setSortOrder' | 'sortOrder'>;

export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  filteredAlbums,
  filteredArtists,
  filteredTracks,
  handleBackFromAlbumDetail,
  handlePlayLibraryTrack,
  hideDuplicates,
  libraryFormatFilter,
  librarySearch,
  librarySearchInputRef,
  librarySubView,
  loc,
  setHideDuplicates,
  setLibraryFormatFilter,
  setLibrarySearch,
  setLibrarySubView,
  setSortField,
  setSortOrder,
  showMessage,
  sortField,
  sortOrder,
  sortedAlbums,
  sortedTracks,
  tracks,
}) => (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '18px',
        background: 'rgba(0,0,0,0.2)',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Przełącznik widoku: Utwory vs Albumy */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setLibrarySubView('tracks')}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            background: librarySubView === 'tracks' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Music size={14} /> {loc.library.tracks} ({filteredTracks.length})
        </button>
        <button
          onClick={() => {
            setLibrarySubView('albums');
            handleBackFromAlbumDetail();
          }}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            background: librarySubView === 'albums' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Disc size={14} /> {loc.library.albums} ({filteredAlbums.length})
        </button>
        <button
          onClick={() => setLibrarySubView('artists')}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            background: librarySubView === 'artists' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Mic2 size={14} /> {loc.library.artists || 'Wykonawcy'} ({filteredArtists.length})
        </button>
      </div>

      {/* Pole wyszukiwania Live Search */}
      <div style={{ position: 'relative', flex: '1 1 200px' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          ref={librarySearchInputRef}
          type="text"
          placeholder={loc.library.searchPlaceholder}
          value={librarySearch}
          onChange={(e) => setLibrarySearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (librarySubView === 'tracks' && sortedTracks.length > 0) {
                handlePlayLibraryTrack(sortedTracks[0]);
                showMessage(`Odtwarzanie ${sortedTracks[0].title}`);
              } else if (librarySubView === 'albums' && sortedAlbums.length > 0) {
                const albumTracks = tracks.filter((t) => t.album_id === sortedAlbums[0].id);
                if (albumTracks.length > 0) {
                  handlePlayLibraryTrack(albumTracks[0], albumTracks);
                  showMessage(`Odtwarzanie albumu ${sortedAlbums[0].title}`);
                }
              }
            } else if (e.key === 'Escape') {
              setLibrarySearch('');
            }
          }}
          style={{
            width: '100%',
            padding: '7px 30px 7px 32px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.3)',
            color: '#fff',
            fontSize: '0.8rem',
          }}
        />
        {librarySearch && (
          <button
            onClick={() => setLibrarySearch('')}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filtry formatów audio */}
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {(['all', 'flac', 'mp3', 'opus', 'wav', 'lossless'] as const).map((fmt) => {
          const label =
            fmt === 'all'
              ? loc.library.all
              : fmt === 'lossless'
                ? loc.library.lossless
                : fmt.toUpperCase();
          const isSelected = libraryFormatFilter === fmt;
          return (
            <button
              key={fmt}
              onClick={() => setLibraryFormatFilter(fmt)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: isSelected ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.05)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                border: isSelected ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Przełącznik ukrywania duplikatów */}
      <button
        type="button"
        onClick={() => {
          const next = !hideDuplicates;
          setHideDuplicates(next);
          try {
            localStorage.setItem('auralune_hide_duplicates', String(next));
          } catch { }
          showMessage(
            next ? loc.library.hideDuplicatesFilterOn : loc.library.hideDuplicatesFilterOff
          );
        }}
        style={{
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 600,
          background: hideDuplicates ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.05)',
          border: hideDuplicates ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
          color: hideDuplicates ? '#fff' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title={loc.library.hideDuplicatesTooltip}
      >
        <Copy size={12} />
        {hideDuplicates ? loc.library.duplicatesHidden : loc.library.duplicates}
      </button>

      {/* Kontrola sortowania */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
        <ArrowUpDown size={13} color="var(--text-muted)" />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.library.sortBy}</span>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as any)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            padding: '5px 28px 5px 10px',
            borderRadius: '6px',
            background: 'rgba(20, 24, 44, 0.95)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.74rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <option value="default" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortDefault}</option>
          <option value="title" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortTitle}</option>
          <option value="artist" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortArtist}</option>
          <option value="duration" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortDuration}</option>
          <option value="format" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortFormat}</option>
          <option value="date" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortDate}</option>
          <option value="plays" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortPlays}</option>
        </select>
        <button
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '4px 8px',
            color: 'var(--accent-cyan)',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title={sortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
        >
          {sortOrder === 'asc' ? '▲' : '▼'}
        </button>
      </div>
    </div>
);
