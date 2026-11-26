import React from 'react';
import { ArrowUpDown, Clock, Disc, LayoutGrid, List, Play, Plus, Search, Sparkles } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

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
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/3 px-3.5 py-2.5"
        >
          {/* Lewa strona: Licznik albumów + szybki filtr okładek */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-ui font-bold text-fg">
              {sortedAlbums.length !== albums.length
                ? fmt(loc.library.resultsAlbums, String(sortedAlbums.length), String(albums.length))
                : fmt(loc.library.totalAlbums, String(albums.length))}
            </span>

            {/* Filtr okładek */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-white/4 p-1">
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
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xxs transition-all duration-150',
                      isActive ? 'font-bold' : 'font-medium',
                      isActive ? 'bg-pink-500/20' : 'bg-transparent',
                      isActive ? 'border-accent-pink' : 'border-transparent',
                      isActive ? 'text-accent-pink' : 'text-fg-secondary',
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prawa strona: Sortowanie + Rozmiar kafelków + Wybór Kafelki / Lista */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sortowanie */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={13} className="text-fg-muted" />
              <select
                value={albumSortField}
                onChange={(e) => setAlbumSortField(e.target.value as any)}
                className="cursor-pointer rounded-md border border-line pl-2.5 pr-7 py-1.5 text-xs font-semibold text-fg shadow-md shadow-black/30"
              >
                <option value="title">{loc.library.albumSortTitle}</option>
                <option value="artist">{loc.library.albumSortArtist}</option>
                <option value="year">{loc.library.albumSortYear}</option>
                <option value="tracks">{loc.library.sortTrackCount}</option>
                <option value="duration">{loc.library.sortTotalDuration}</option>
              </select>
              <button
                onClick={() => setAlbumSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="rounded-md border border-line bg-white/6 px-2 py-1 text-xs font-bold text-accent-cyan"
                title={albumSortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
              >
                {albumSortOrder === 'asc' ? '▲' : '▼'}
              </button>
            </div>

            <div className="mx-1 my-0 h-4.5 w-px bg-white/10" />

            {/* Rozmiar kafelków (widoczny w trybie kafelków) */}
            {albumViewMode === 'grid' && (
              <div className="flex items-center gap-1 rounded-lg border border-line bg-white/4 px-1 py-0.5">
                <span className="mr-0.5 pl-1 text-xxs text-fg-muted">
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
                      className={cn(
                        'rounded-md border px-2 py-1 text-xxs',
                        isCur ? 'font-bold' : 'font-medium',
                        isCur ? 'bg-sky-400/20' : 'bg-transparent',
                        isCur ? 'border-accent-cyan' : 'border-transparent',
                        isCur ? 'text-accent-cyan' : 'text-fg-secondary',
                      )}
                      title={s.title}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Przełącznik widoku: Kafelki vs Lista */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-white/5 p-0.5">
              <button
                onClick={() => {
                  setAlbumViewMode('grid');
                  localStorage.setItem('auralune_album_view_mode', 'grid');
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs',
                  albumViewMode === 'grid' ? 'font-bold' : 'font-medium',
                  albumViewMode === 'grid' ? 'bg-pink-500/25' : 'bg-transparent',
                  albumViewMode === 'grid' ? 'border-accent-pink' : 'border-transparent',
                  albumViewMode === 'grid' ? 'text-accent-pink' : 'text-fg-secondary',
                )}
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
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs',
                  albumViewMode === 'list' ? 'font-bold' : 'font-medium',
                  albumViewMode === 'list' ? 'bg-pink-500/25' : 'bg-transparent',
                  albumViewMode === 'list' ? 'border-accent-pink' : 'border-transparent',
                  albumViewMode === 'list' ? 'text-accent-pink' : 'text-fg-secondary',
                )}
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
          <div className="p-12 text-center text-fg-muted">
            {albums.length === 0 ? (
              <span>{loc.library.emptyAlbums}</span>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <span>{fmt(loc.library.emptySearchAlbums, librarySearch)}</span>
                <button
                  onClick={() => {
                    setLibrarySearch('');
                    setAlbumCoverFilter('all');
                  }}
                  className="rounded-md border border-line bg-white/8 px-3 py-1.5 text-ui text-accent-cyan"
                >
                  {loc.library.clearSearch}
                </button>
              </div>
            )}
          </div>
        ) : albumViewMode === 'list' ? (
          /* WIDOK LISTY ALBUMÓW */
          <div className="flex flex-col gap-2">
            {sortedAlbums.map((album) => {
              const albumTracks = tracks.filter((t) => t.album_id === album.id);
              const totalDurMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
              const durText = formatAlbumDuration(totalDurMs);

              return (
                <div
                  key={album.id}
                  className="glass-card flex cursor-pointer items-center gap-4 rounded-xl border border-white/5 px-4 py-2.5 transition-all duration-200"
                  onClick={() => handleOpenAlbumDetail(album)}
                >
                  {/* Miniaturka okładki */}
                  <div
                    className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-lg border border-line"
                    style={{
                      background: album.cover_path
                        ? `url("${album.cover_path}") center/cover no-repeat`
                        : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                    }}
                    title={loc.covers.matchCoverTitle}
                  >
                    {!album.cover_path && <Disc size={24} className="text-white/25" />}
                  </div>

                  {/* Informacje o albumie */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-md font-bold text-fg">
                        {album.title}
                      </span>
                      {album.year && (
                        <span className="text-xs font-semibold text-fg-muted">
                          ({album.year})
                        </span>
                      )}
                      {album.release_mbid && (
                        <span className="rounded-sm bg-accent-cyan/10 px-1.5 py-px font-mono text-2xs text-accent-cyan">
                          MBID
                        </span>
                      )}
                    </div>
                    <p className="mx-0 mt-1 mb-0 truncate text-ui text-fg-secondary">
                      {album.album_artist}
                    </p>
                  </div>

                  {/* Liczba utworów i czas */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="rounded-md bg-accent-cyan/10 px-2 py-1 text-xs font-semibold text-accent-cyan">
                      {albumTracks.length} {loc.library.tracks}
                    </span>
                    {durText && (
                      <span className="flex items-center gap-1 text-xs text-fg-muted">
                        <Clock size={11} /> {durText}
                      </span>
                    )}
                  </div>

                  {/* Przyciski akcji */}
                  <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlePlayAlbum(albumTracks)}
                      className="flex items-center gap-1.5 rounded-md bg-white/8 px-3 py-1.5 text-xs font-semibold text-accent-pink"
                      title={loc.player.play}
                    >
                      <Play size={12} /> {loc.player.play}
                    </button>
                    <button
                      onClick={() => handleAddAlbumToQueue(albumTracks)}
                      className="rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-accent-cyan"
                      title={loc.library.addToQueue}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => handleOpenCoverPicker(album)}
                      className="flex items-center gap-1 rounded-md border-0 bg-accent-gradient px-2.5 py-1.5 text-xs font-semibold text-on-accent"
                      title={loc.covers.matchCoverTitle}
                    >
                      <Sparkles size={11} /> {loc.covers.matchCover}
                    </button>
                    <button
                      onClick={() => handleOpenMbModal(album)}
                      className="flex items-center gap-1 rounded-md bg-white/6 px-2.5 py-1.5 text-xs font-semibold text-fg-secondary"
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
            className={cn(
              'grid',
              albumGridSize === 'compact' ? 'grid-cols-[repeat(auto-fill,minmax(--spacing(39),--spacing(47.5)))]' : albumGridSize === 'large' ? 'grid-cols-[repeat(auto-fill,minmax(--spacing(60),--spacing(72.5)))]' : 'grid-cols-[repeat(auto-fill,minmax(--spacing(47.5),--spacing(59)))]',
              albumGridSize === 'compact' ? 'gap-3' : albumGridSize === 'large' ? 'gap-4.5' : 'gap-3.5',
            )}
          >
            {sortedAlbums.map((album) => {
              const albumTracks = tracks.filter((t) => t.album_id === album.id);
              const totalDurMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
              const durText = formatAlbumDuration(totalDurMs);

              return (
                <div
                  key={album.id}
                  className={cn(
                    'glass-card flex cursor-pointer flex-col rounded-2xl border border-white/6 transition-[transform,border-color] duration-200',
                    albumGridSize === 'compact' ? 'p-2.5' : 'p-3.5',
                    albumGridSize === 'compact' ? 'gap-2' : 'gap-2.5',
                    albumGridSize === 'compact' ? 'max-w-50' : albumGridSize === 'large' ? 'max-w-75' : 'max-w-61.5',
                  )}
                  onClick={() => handleOpenAlbumDetail(album)}
                >
                  {/* Podgląd okładki (z przyciskiem dopasowania w rogu) */}
                  <div
                    className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-line"
                    style={{
                      background: album.cover_path
                        ? `url("${album.cover_path}") center/cover no-repeat`
                        : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                    }}
                    title={loc.library.albumViewTracksTooltip}
                  >
                    {!album.cover_path && <Disc size={albumGridSize === 'compact' ? 36 : 46} className="text-white/25" />}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCoverPicker(album);
                      }}
                      className="absolute bottom-1.5 right-1.5 flex cursor-pointer items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-2xs font-semibold text-accent-pink backdrop-blur-xs"
                      title={loc.covers.matchCoverTitle}
                    >
                      <Sparkles size={10} /> {loc.covers.matchCover}
                    </div>
                  </div>

                  {/* Tytuł i wykonawca */}
                  <div className="flex-1">
                    <h4
                      className={cn(
                        'm-0 leading-tight font-bold text-fg line-clamp-2',
                        albumGridSize === 'compact' ? 'text-ui' : 'text-sm',
                      )}
                      title={album.title}
                    >
                      {album.title}
                    </h4>
                    <p className="mx-0 mt-1 mb-0 truncate text-xs text-fg-secondary">
                      {album.album_artist} {album.year ? `(${album.year})` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-sm bg-accent-cyan/10 px-1.5 py-px text-xxs font-semibold text-accent-cyan"
                      >
                        {albumTracks.length} {loc.library.tracks}
                      </span>
                      {durText && (
                        <span className="text-xxs text-fg-muted">
                          {durText}
                        </span>
                      )}
                      {album.release_mbid && (
                        <span className="rounded-sm bg-white/6 px-1 py-px font-mono text-2xs text-fg-muted">
                          MBID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Przyciski akcji na kafelku */}
                  <div className="mt-auto flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlePlayAlbum(albumTracks)}
                      className={cn(
                        'flex items-center gap-1 rounded-md bg-white/8 text-xs font-semibold text-accent-pink',
                        albumGridSize === 'compact' ? 'px-2 py-1.5' : 'px-2.5 py-2',
                      )}
                      title={loc.player.play}
                    >
                      <Play size={11} /> {loc.player.play}
                    </button>
                    <button
                      onClick={() => handleAddAlbumToQueue(albumTracks)}
                      className={cn(
                        'rounded-md bg-white/5 text-xs text-accent-cyan',
                        albumGridSize === 'compact' ? 'px-2 py-1.5' : 'p-2',
                      )}
                      title={loc.library.addToQueue}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => handleOpenCoverPicker(album)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 overflow-hidden rounded-md border-0 bg-accent-gradient text-xxs font-bold whitespace-nowrap text-on-accent',
                        albumGridSize === 'compact' ? 'p-1.5' : 'p-2',
                      )}
                      title={loc.covers.matchCoverTitle}
                    >
                      <Sparkles size={11} />
                      {albumGridSize !== 'compact' && <span>{loc.covers.matchCover}</span>}
                    </button>
                    <button
                      onClick={() => handleOpenMbModal(album)}
                      className={cn(
                        'flex items-center justify-center gap-0.5 rounded-md bg-white/7 text-xxs font-semibold text-fg-secondary',
                        albumGridSize === 'compact' ? 'px-2 py-1.5' : 'p-2',
                      )}
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
