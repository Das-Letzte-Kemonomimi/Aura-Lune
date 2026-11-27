import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disc, Search } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import type { AlbumRecord } from '../../../types/library';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Button, EmptyState } from '../../../components/ui';
import { AlphaJumpRail } from './AlphaJumpRail';
import { buildLetterIndex } from './alphaIndexModel';
import { useProgressiveCount } from '../../../hooks/useProgressiveCount';
import { buildAlbumStats, type AlbumStats } from './albumModel';
import { AlbumRow, AlbumTile, type AlbumActions } from './AlbumTiles';

export type LibraryAlbumGridProps = Pick<LibraryViewProps, 'sortedAlbums' | 'albums' | 'loc' | 'setAlbumCoverFilter' | 'albumSortField' | 'albumViewMode' | 'albumGridSize' | 'librarySearch' | 'setLibrarySearch' | 'tracks' | 'handleOpenAlbumDetail' | 'handlePlayAlbum' | 'handleAddAlbumToQueue' | 'handleOpenCoverPicker' | 'handleOpenMbModal' | 'currentPlayingTrack' | 'status'> & {
  formatAlbumDuration: (ms: number) => string;
};

/** Fluid grid tracks without right-edge max-width caps. */
const GRID_LAYOUT = {
  compact: 'grid-cols-[repeat(auto-fill,minmax(--spacing(38),1fr))] gap-3',
  medium: 'grid-cols-[repeat(auto-fill,minmax(--spacing(46),1fr))] gap-4',
  large: 'grid-cols-[repeat(auto-fill,minmax(--spacing(56),1fr))] gap-4.5',
} as const;

const EMPTY_STATS: AlbumStats = { trackCount: 0, durationMs: 0, format: '', hiRes: false, playCount: 0, heardCount: 0 };

/** Albums in grid or list layout. */
export const LibraryAlbumGrid: React.FC<LibraryAlbumGridProps> = ({
  albumGridSize,
  albumSortField,
  albumViewMode,
  albums,
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
  setLibrarySearch,
  sortedAlbums,
  status,
  tracks,
}) => {
  const statsByAlbum = useMemo(() => buildAlbumStats(tracks), [tracks]);
  const [jumpFloor, setJumpFloor] = useState(0);
  const [pendingJump, setPendingJump] = useState<number | null>(null);
  const itemsRef = useRef<HTMLDivElement | null>(null);
  const visibleCount = useProgressiveCount(sortedAlbums.length, `${albumViewMode}-${albumGridSize}`, 36, 36, jumpFloor);
  const visibleAlbums = useMemo(() => sortedAlbums.slice(0, visibleCount), [sortedAlbums, visibleCount]);
  const playingAlbumId = currentPlayingTrack?.album_id ?? null;
  const playingState = status.state === 'Playing' ? 'playing' : 'paused';

  // The rail applies only while albums are ordered alphabetically by title or artist.
  const letterIndex = useMemo(() => {
    if (albumSortField !== 'title' && albumSortField !== 'artist') return null;
    return buildLetterIndex(sortedAlbums, (a) => (albumSortField === 'title' ? a.title : a.album_artist));
  }, [albumSortField, sortedAlbums]);

  const jumpToAlbum = useCallback((index: number) => {
    setJumpFloor(index + 1);
    setPendingJump(index);
  }, []);

  // Once the target tile is mounted, scroll it into view.
  useEffect(() => {
    if (pendingJump === null || visibleCount <= pendingJump) return;
    itemsRef.current?.children[pendingJump]?.scrollIntoView({ block: 'start' });
    setPendingJump(null);
  }, [pendingJump, visibleCount]);

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
      {/* Content: empty state, list or tiles, with the A–Z rail beside it */}
      <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
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
        <div ref={itemsRef} className="flex flex-col gap-2">
          {visibleAlbums.map((album) => (
            <AlbumRow key={album.id} {...tileProps(album)} />
          ))}
        </div>
      ) : (
        <div ref={itemsRef} className={cn('grid', GRID_LAYOUT[albumGridSize])}>
          {visibleAlbums.map((album) => (
            <AlbumTile key={album.id} {...tileProps(album)} size={albumGridSize} />
          ))}
        </div>
      )}
      </div>
      {letterIndex && letterIndex.size > 0 && (
        <AlphaJumpRail letterIndex={letterIndex} onJump={jumpToAlbum} label={loc.library.alphaJumpLabel} otherLabel={loc.library.alphaJumpOther} />
      )}
      </div>
    </div>
  );
};
