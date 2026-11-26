import React from 'react';
import { ArrowUpDown, Clock, Disc, LayoutGrid, List, Play, Plus, Search, Sparkles } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';

export type LibraryAlbumGridProps = Pick<LibraryViewProps, 'sortedAlbums' | 'albums' | 'loc' | 'albumsWithCoverCount' | 'albumsWithoutCoverCount' | 'albumCoverFilter' | 'setAlbumCoverFilter' | 'albumSortField' | 'setAlbumSortField' | 'setAlbumSortOrder' | 'albumSortOrder' | 'albumViewMode' | 'albumGridSize' | 'setAlbumGridSize' | 'setAlbumViewMode' | 'librarySearch' | 'setLibrarySearch' | 'tracks' | 'handleOpenAlbumDetail' | 'handlePlayAlbum' | 'handleAddAlbumToQueue' | 'handleOpenCoverPicker' | 'handleOpenMbModal'> & {
  formatAlbumDuration: (ms: number) => string;
};

export const LibraryAlbumGrid: React.FC<LibraryAlbumGridProps> = ({
  albumCoverFilter,
  albumGridSize,
  albumSortField,
  albumSortOrder,
  albumViewMode,
  albums,
  albumsWithCoverCount,
  albumsWithoutCoverCount,
  formatAlbumDuration,
  handleAddAlbumToQueue,
  handleOpenAlbumDetail,
  handleOpenCoverPicker,
  handleOpenMbModal,
  handlePlayAlbum,
  librarySearch,
  loc,
  setAlbumCoverFilter,
  setAlbumGridSize,
  setAlbumSortField,
  setAlbumSortOrder,
  setAlbumViewMode,
  setLibrarySearch,
  sortedAlbums,
  tracks,
}) => (
    <div>
      <div>
        {/* Pasek narzędziowy widoku albumów: Filtry, Sortowanie, Rozmiar kafelków, Przełącznik Kafelki/Lista */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.025)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Lewa strona: Licznik albumów + szybki filtr okładek */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 700 }}>
              {sortedAlbums.length !== albums.length
                ? fmt(loc.library.resultsAlbums, String(sortedAlbums.length), String(albums.length))
                : fmt(loc.library.totalAlbums, String(albums.length))}
            </span>

            {/* Filtr okładek */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {[
                { id: 'all', label: fmt(loc.library.albumFilterAll, String(albums.length)) },
                { id: 'with-cover', label: fmt(loc.library.albumFilterWithCover, String(albumsWithCoverCount)) },
                { id: 'missing-cover', label: fmt(loc.library.albumFilterMissingCover, String(albumsWithoutCoverCount)) },
              ].map((f) => {
                const isActive = albumCoverFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setAlbumCoverFilter(f.id as any)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '0.70rem',
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? 'rgba(236, 72, 153, 0.22)' : 'transparent',
                      border: isActive ? '1px solid var(--accent-pink)' : '1px solid transparent',
                      color: isActive ? 'var(--accent-pink)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prawa strona: Sortowanie + Rozmiar kafelków + Wybór Kafelki / Lista */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Sortowanie */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpDown size={13} color="var(--text-muted)" />
              <select
                value={albumSortField}
                onChange={(e) => setAlbumSortField(e.target.value as any)}
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
                <option value="title" style={{ background: '#121424', color: '#fff' }}>{loc.library.albumSortTitle}</option>
                <option value="artist" style={{ background: '#121424', color: '#fff' }}>{loc.library.albumSortArtist}</option>
                <option value="year" style={{ background: '#121424', color: '#fff' }}>{loc.library.albumSortYear}</option>
                <option value="tracks" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortTrackCount}</option>
                <option value="duration" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortTotalDuration}</option>
              </select>
              <button
                onClick={() => setAlbumSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
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
                title={albumSortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
              >
                {albumSortOrder === 'asc' ? '▲' : '▼'}
              </button>
            </div>

            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

            {/* Rozmiar kafelków (widoczny w trybie kafelków) */}
            {albumViewMode === 'grid' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '2px 4px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '2px', paddingLeft: '4px' }}>
                  {loc.library.albumGridSize}
                </span>
                {[
                  { id: 'compact', label: 'S (160px)', title: loc.library.albumTileSmall },
                  { id: 'medium', label: 'M (210px)', title: loc.library.albumTileMedium },
                  { id: 'large', label: 'L (270px)', title: loc.library.albumTileLarge },
                ].map((s) => {
                  const isCur = albumGridSize === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setAlbumGridSize(s.id as any);
                        localStorage.setItem('auralune_album_grid_size', s.id);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        fontSize: '0.70rem',
                        fontWeight: isCur ? 700 : 500,
                        background: isCur ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                        border: isCur ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                        color: isCur ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                      title={s.title}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Przełącznik widoku: Kafelki vs Lista */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => {
                  setAlbumViewMode('grid');
                  localStorage.setItem('auralune_album_view_mode', 'grid');
                }}
                style={{
                  padding: '5px 9px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.72rem',
                  fontWeight: albumViewMode === 'grid' ? 700 : 500,
                  background: albumViewMode === 'grid' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                  border: albumViewMode === 'grid' ? '1px solid var(--accent-pink)' : '1px solid transparent',
                  color: albumViewMode === 'grid' ? 'var(--accent-pink)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
                title={loc.library.viewGridView}
              >
                <LayoutGrid size={13} />
                <span>{loc.library.viewGrid}</span>
              </button>

              <button
                onClick={() => {
                  setAlbumViewMode('list');
                  localStorage.setItem('auralune_album_view_mode', 'list');
                }}
                style={{
                  padding: '5px 9px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.72rem',
                  fontWeight: albumViewMode === 'list' ? 700 : 500,
                  background: albumViewMode === 'list' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                  border: albumViewMode === 'list' ? '1px solid var(--accent-pink)' : '1px solid transparent',
                  color: albumViewMode === 'list' ? 'var(--accent-pink)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
                title={loc.library.viewListView}
              >
                <List size={13} />
                <span>{loc.library.viewList}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zawartość: Pusta lista lub Kafelki lub Lista */}
        {sortedAlbums.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            {albums.length === 0 ? (
              <span>{loc.library.emptyAlbums}</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span>{fmt(loc.library.emptySearchAlbums, librarySearch)}</span>
                <button
                  onClick={() => {
                    setLibrarySearch('');
                    setAlbumCoverFilter('all');
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  {loc.library.clearSearch}
                </button>
              </div>
            )}
          </div>
        ) : albumViewMode === 'list' ? (
          /* WIDOK LISTY ALBUMÓW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedAlbums.map((album) => {
              const albumTracks = tracks.filter((t) => t.album_id === album.id);
              const totalDurMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
              const durText = formatAlbumDuration(totalDurMs);

              return (
                <div
                  key={album.id}
                  className="glass-card"
                  onClick={() => handleOpenAlbumDetail(album)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    cursor: 'pointer',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {/* Miniaturka okładki */}
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '8px',
                      background: album.cover_path
                        ? `url("${album.cover_path}") center/cover no-repeat`
                        : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                    title={loc.covers.matchCoverTitle}
                  >
                    {!album.cover_path && <Disc size={24} color="rgba(255,255,255,0.25)" />}
                  </div>

                  {/* Informacje o albumie */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {album.title}
                      </span>
                      {album.year && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          ({album.year})
                        </span>
                      )}
                      {album.release_mbid && (
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-cyan)',
                            background: 'rgba(6,182,212,0.12)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          MBID
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {album.album_artist}
                    </p>
                  </div>

                  {/* Liczba utworów i czas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--accent-cyan)',
                        background: 'rgba(6,182,212,0.12)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 600,
                      }}
                    >
                      {albumTracks.length} {loc.library.tracks}
                    </span>
                    {durText && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {durText}
                      </span>
                    )}
                  </div>

                  {/* Przyciski akcji */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlePlayAlbum(albumTracks)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'var(--accent-pink)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                      }}
                      title={loc.player.play}
                    >
                      <Play size={12} /> {loc.player.play}
                    </button>
                    <button
                      onClick={() => handleAddAlbumToQueue(albumTracks)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                      title={loc.library.addToQueue}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => handleOpenCoverPicker(album)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        color: '#fff',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title={loc.covers.matchCoverTitle}
                    >
                      <Sparkles size={11} /> {loc.covers.matchCover}
                    </button>
                    <button
                      onClick={() => handleOpenMbModal(album)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        cursor: 'pointer',
                      }}
                      title={loc.covers.matchCoverTitle}
                    >
                      <Search size={11} /> MBID
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* WIDOK KAFELKÓW (Zabezpieczony przed rozciąganiem - auto-fill z limitem max-width) */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                albumGridSize === 'compact'
                  ? 'repeat(auto-fill, minmax(155px, 190px))'
                  : albumGridSize === 'large'
                    ? 'repeat(auto-fill, minmax(240px, 290px))'
                    : 'repeat(auto-fill, minmax(190px, 235px))',
              gap: albumGridSize === 'compact' ? '12px' : albumGridSize === 'large' ? '18px' : '14px',
            }}
          >
            {sortedAlbums.map((album) => {
              const albumTracks = tracks.filter((t) => t.album_id === album.id);
              const totalDurMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
              const durText = formatAlbumDuration(totalDurMs);

              return (
                <div
                  key={album.id}
                  className="glass-card"
                  onClick={() => handleOpenAlbumDetail(album)}
                  style={{
                    padding: albumGridSize === 'compact' ? '10px' : '14px',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: albumGridSize === 'compact' ? '8px' : '10px',
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, border-color 0.18s ease',
                    border: '1px solid rgba(255,255,255,0.06)',
                    maxWidth: albumGridSize === 'compact' ? '200px' : albumGridSize === 'large' ? '300px' : '245px',
                  }}
                >
                  {/* Podgląd okładki (z przyciskiem dopasowania w rogu) */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1/1',
                      borderRadius: '10px',
                      background: album.cover_path
                        ? `url("${album.cover_path}") center/cover no-repeat`
                        : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    title={loc.library.albumViewTracksTooltip}
                  >
                    {!album.cover_path && <Disc size={albumGridSize === 'compact' ? 36 : 46} color="rgba(255,255,255,0.25)" />}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCoverPicker(album);
                      }}
                      style={{
                        position: 'absolute',
                        bottom: '5px',
                        right: '5px',
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(4px)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.64rem',
                        color: 'var(--accent-pink)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      title={loc.covers.matchCoverTitle}
                    >
                      <Sparkles size={10} /> {loc.covers.matchCover}
                    </div>
                  </div>

                  {/* Tytuł i wykonawca */}
                  <div style={{ flex: 1 }}>
                    <h4
                      style={{
                        fontSize: albumGridSize === 'compact' ? '0.84rem' : '0.90rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: 0,
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      title={album.title}
                    >
                      {album.title}
                    </h4>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        margin: '3px 0 0 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {album.album_artist} {album.year ? `(${album.year})` : ''}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          color: 'var(--accent-cyan)',
                          background: 'rgba(6,182,212,0.12)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {albumTracks.length} {loc.library.tracks}
                      </span>
                      {durText && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          {durText}
                        </span>
                      )}
                      {album.release_mbid && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '1px 4px',
                            borderRadius: '4px',
                          }}
                        >
                          MBID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Przyciski akcji na kafelku */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlePlayAlbum(albumTracks)}
                      style={{
                        padding: albumGridSize === 'compact' ? '6px 8px' : '7px 9px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'var(--accent-pink)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                      title={loc.player.play}
                    >
                      <Play size={11} /> {loc.player.play}
                    </button>
                    <button
                      onClick={() => handleAddAlbumToQueue(albumTracks)}
                      style={{
                        padding: albumGridSize === 'compact' ? '6px 7px' : '7px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                      }}
                      title={loc.library.addToQueue}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => handleOpenCoverPicker(album)}
                      style={{
                        flex: 1,
                        padding: albumGridSize === 'compact' ? '6px 6px' : '7px 8px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        color: '#fff',
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                      title={loc.covers.matchCoverTitle}
                    >
                      <Sparkles size={11} />
                      {albumGridSize !== 'compact' && <span>{loc.covers.matchCover}</span>}
                    </button>
                    <button
                      onClick={() => handleOpenMbModal(album)}
                      style={{
                        padding: albumGridSize === 'compact' ? '6px 7px' : '7px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.07)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                      }}
                      title={loc.covers.matchCoverTitle}
                    >
                      <Search size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
);
