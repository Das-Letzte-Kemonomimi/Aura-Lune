import React, { useEffect, useMemo, useRef } from 'react';
import { Disc, LayoutGrid, List, Search } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import type { AlbumRecord } from '../../../types/library';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Button, Card, EmptyState, SegmentedControl } from '../../../components/ui';
import { SortControls } from './SortControls';
import { useProgressiveCount } from '../../../hooks/useProgressiveCount';
import { buildAlbumStats, type AlbumStats } from './albumModel';
import { AlbumRow, AlbumTile, type AlbumActions } from './AlbumTiles';

export type LibraryAlbumGridProps = Pick<LibraryViewProps, 'sortedAlbums' | 'albums' | 'loc' | 'albumsWithCoverCount' | 'albumsWithoutCoverCount' | 'albumCoverFilter' | 'setAlbumCoverFilter' | 'albumSortField' | 'setAlbumSortField' | 'setAlbumSortOrder' | 'albumSortOrder' | 'albumViewMode' | 'albumGridSize' | 'setAlbumGridSize' | 'setAlbumViewMode' | 'librarySearch' | 'setLibrarySearch' | 'tracks' | 'handleOpenAlbumDetail' | 'handlePlayAlbum' | 'handleAddAlbumToQueue' | 'handleOpenCoverPicker' | 'handleOpenMbModal' | 'currentPlayingTrack' | 'status'> & {
  formatAlbumDuration: (ms: number) => string;
};

/** Column template and gap of the tile grid per tile size (auto-fill with a max width, no stretching). */
const GRID_LAYOUT = {
  compact: 'grid-cols-[repeat(auto-fill,minmax(--spacing(39),--spacing(47.5)))] gap-3',
  medium: 'grid-cols-[repeat(auto-fill,minmax(--spacing(47.5),--spacing(59)))] gap-3.5',
  large: 'grid-cols-[repeat(auto-fill,minmax(--spacing(60),--spacing(72.5)))] gap-4.5',
} as const;

const EMPTY_STATS: AlbumStats = { trackCount: 0, durationMs: 0, format: '', hiRes: false, playCount: 0, heardCount: 0 };

/** Album toolbar (cover filter, sorting, tile size, grid or list) and the albums in the chosen layout. */
export const LibraryAlbumGrid: React.FC<LibraryAlbumGridProps> = ({
  albumCoverFilter,
  albumGridSize,
  albumSortField,
  albumSortOrder,
  albumViewMode,
  albums,
  albumsWithCoverCount,
  albumsWithoutCoverCount,
  currentPlayingTrack,
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
  status,
  tracks,
}) => {
  const statsByAlbum = useMemo(() => buildAlbumStats(tracks), [tracks]);
  const visibleCount = useProgressiveCount(sortedAlbums.length, `${albumViewMode}-${albumGridSize}`);
  const visibleAlbums = useMemo(() => sortedAlbums.slice(0, visibleCount), [sortedAlbums, visibleCount]);
  const playingAlbumId = currentPlayingTrack?.album_id ?? null;
  const playingState = status.state === 'Playing' ? 'playing' : 'paused';

  // Tiles are memoized: the actions keep one identity and read the latest handlers from a ref.
  const handlersRef = useRef({ handleAddAlbumToQueue, handleOpenAlbumDetail, handleOpenCoverPicker, handleOpenMbModal, handlePlayAlbum, tracks });
  useEffect(() => {
    handlersRef.current = { handleAddAlbumToQueue, handleOpenAlbumDetail, handleOpenCoverPicker, handleOpenMbModal, handlePlayAlbum, tracks };
  });
  const actions = useMemo<AlbumActions>(() => {
    const tracksOf = (album: AlbumRecord) => handlersRef.current.tracks.filter((t) => t.album_id === album.id);
    return {
      open: (album) => handlersRef.current.handleOpenAlbumDetail(album),
      play: (album) => handlersRef.current.handlePlayAlbum(tracksOf(album)),
      queue: (album) => handlersRef.current.handleAddAlbumToQueue(tracksOf(album)),
      coverPicker: (album) => handlersRef.current.handleOpenCoverPicker(album),
      musicBrainz: (album) => handlersRef.current.handleOpenMbModal(album),
    };
  }, []);
  const tileProps = (album: AlbumRecord) => {
    const stats = statsByAlbum.get(album.id) ?? EMPTY_STATS;
    return {
      album,
      stats,
      durText: formatAlbumDuration(stats.durationMs),
      playback: playingAlbumId === album.id ? playingState : null,
      loc,
      actions,
    } as const;
  };

  return (
    <div>
      {/* Album toolbar */}
      <Card padding="none" className="mb-4 flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-ui font-bold text-fg">
            {sortedAlbums.length !== albums.length
              ? fmt(loc.library.resultsAlbums, String(sortedAlbums.length), String(albums.length))
              : fmt(loc.library.totalAlbums, String(albums.length))}
          </span>
          <SegmentedControl
            size="sm"
            label={loc.library.coverFilterLabel}
            value={albumCoverFilter}
            onChange={setAlbumCoverFilter}
            items={[
              { value: 'all', label: fmt(loc.library.albumFilterAll, String(albums.length)) },
              { value: 'with-cover', label: fmt(loc.library.albumFilterWithCover, String(albumsWithCoverCount)) },
              { value: 'missing-cover', label: fmt(loc.library.albumFilterMissingCover, String(albumsWithoutCoverCount)) },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SortControls
            label={loc.library.albumsSortLabel}
            field={albumSortField}
            onFieldChange={setAlbumSortField}
            options={[
              { value: 'title', label: loc.library.albumSortTitle },
              { value: 'artist', label: loc.library.albumSortArtist },
              { value: 'year', label: loc.library.albumSortYear },
              { value: 'tracks', label: loc.library.sortTrackCount },
              { value: 'duration', label: loc.library.sortTotalDuration },
            ]}
            order={albumSortOrder}
            onToggleOrder={() => setAlbumSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            ascLabel={loc.library.sortAscTooltip}
            descLabel={loc.library.sortDescTooltip}
          />

          <div aria-hidden="true" className="mx-1 h-4.5 w-px bg-white/10" />

          {albumViewMode === 'grid' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xxs text-fg-muted">{loc.library.albumGridSize}</span>
              <SegmentedControl
                size="sm"
                tone="cyan"
                label={loc.library.albumGridSize}
                value={albumGridSize}
                onChange={setAlbumGridSize}
                items={[
                  { value: 'compact', label: 'S (160px)', ariaLabel: loc.library.albumTileSmall },
                  { value: 'medium', label: 'M (210px)', ariaLabel: loc.library.albumTileMedium },
                  { value: 'large', label: 'L (270px)', ariaLabel: loc.library.albumTileLarge },
                ]}
              />
            </div>
          )}

          <SegmentedControl
            size="sm"
            label={loc.library.viewModeLabel}
            value={albumViewMode}
            onChange={setAlbumViewMode}
            items={[
              { value: 'grid', icon: <LayoutGrid size={13} />, label: loc.library.viewGrid, ariaLabel: loc.library.viewGridView },
              { value: 'list', icon: <List size={13} />, label: loc.library.viewList, ariaLabel: loc.library.viewListView },
            ]}
          />
        </div>
      </Card>

      {/* Content: empty state, list or tiles */}
      {sortedAlbums.length === 0 ? (
        albums.length === 0 ? (
          <EmptyState icon={<Disc size={28} />} title={loc.library.emptyAlbums} />
        ) : (
          <EmptyState
            icon={<Search size={28} />}
            title={fmt(loc.library.emptySearchAlbums, librarySearch)}
            action={
              <Button
                onClick={() => {
                  setLibrarySearch('');
                  setAlbumCoverFilter('all');
                }}
              >
                {loc.library.clearSearch}
              </Button>
            }
          />
        )
      ) : albumViewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {visibleAlbums.map((album) => (
            <AlbumRow key={album.id} {...tileProps(album)} />
          ))}
        </div>
      ) : (
        <div className={cn('grid', GRID_LAYOUT[albumGridSize])}>
          {visibleAlbums.map((album) => (
            <AlbumTile key={album.id} {...tileProps(album)} size={albumGridSize} />
          ))}
        </div>
      )}
    </div>
  );
};
