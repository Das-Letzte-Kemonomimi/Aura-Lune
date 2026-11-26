import React from 'react';
import { Clock, Disc, LayoutGrid, List, Play, Plus, Search, Sparkles } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import type { AlbumRecord } from '../../../types/library';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Card, EmptyState, IconButton, SegmentedControl } from '../../../components/ui';
import { SortControls } from './SortControls';

export type LibraryAlbumGridProps = Pick<LibraryViewProps, 'sortedAlbums' | 'albums' | 'loc' | 'albumsWithCoverCount' | 'albumsWithoutCoverCount' | 'albumCoverFilter' | 'setAlbumCoverFilter' | 'albumSortField' | 'setAlbumSortField' | 'setAlbumSortOrder' | 'albumSortOrder' | 'albumViewMode' | 'albumGridSize' | 'setAlbumGridSize' | 'setAlbumViewMode' | 'librarySearch' | 'setLibrarySearch' | 'tracks' | 'handleOpenAlbumDetail' | 'handlePlayAlbum' | 'handleAddAlbumToQueue' | 'handleOpenCoverPicker' | 'handleOpenMbModal'> & {
  formatAlbumDuration: (ms: number) => string;
};

/** Column template and gap of the tile grid per tile size (auto-fill with a max width, no stretching). */
const GRID_LAYOUT = {
  compact: 'grid-cols-[repeat(auto-fill,minmax(--spacing(39),--spacing(47.5)))] gap-3',
  medium: 'grid-cols-[repeat(auto-fill,minmax(--spacing(47.5),--spacing(59)))] gap-3.5',
  large: 'grid-cols-[repeat(auto-fill,minmax(--spacing(60),--spacing(72.5)))] gap-4.5',
} as const;

const TILE_MAX_WIDTH = { compact: 'max-w-50', medium: 'max-w-61.5', large: 'max-w-75' } as const;

/** Album cover as a background, or a disc glyph on a tinted gradient when there is none. */
function AlbumCover({
  album,
  iconSize,
  className,
  title,
  children,
}: {
  album: AlbumRecord;
  iconSize: number;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center border border-line bg-linear-135 from-accent-purple/20 to-accent-cyan/15 bg-cover bg-center',
        className,
      )}
      style={album.cover_path ? { backgroundImage: `url("${album.cover_path}")` } : undefined}
      title={title}
    >
      {!album.cover_path && <Disc size={iconSize} className="text-fg-muted/50" />}
      {children}
    </div>
  );
}

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
}) => {
  const compact = albumGridSize === 'compact';
  const albumStats = (album: AlbumRecord) => {
    const albumTracks = tracks.filter((t) => t.album_id === album.id);
    const durText = formatAlbumDuration(albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0));
    return { albumTracks, durText };
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
          {sortedAlbums.map((album) => {
            const { albumTracks, durText } = albumStats(album);
            return (
              <Card
                key={album.id}
                interactive
                padding="none"
                className="flex cursor-pointer items-center gap-4 px-4 py-2.5"
                onClick={() => handleOpenAlbumDetail(album)}
              >
                <AlbumCover album={album} iconSize={24} className="size-13 shrink-0 rounded-lg" title={loc.covers.matchCoverTitle} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-md font-bold text-fg">{album.title}</span>
                    {album.year && <span className="text-xs font-semibold text-fg-muted">({album.year})</span>}
                    {album.release_mbid && <Badge tone="cyan" size="xs" mono>MBID</Badge>}
                  </div>
                  <p className="mt-1 truncate text-ui text-fg-secondary">{album.album_artist}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <Badge tone="cyan">
                    {albumTracks.length} {loc.library.tracks}
                  </Badge>
                  {durText && (
                    <span className="flex items-center gap-1 text-xs text-fg-muted">
                      <Clock size={11} /> {durText}
                    </span>
                  )}
                </div>

                {/* Actions; clicks here do not open the album */}
                <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => handlePlayAlbum(albumTracks)}>
                    <Play size={12} className="text-accent-pink" /> {loc.player.play}
                  </Button>
                  <IconButton variant="secondary" size="sm" label={loc.library.addToQueue} onClick={() => handleAddAlbumToQueue(albumTracks)} className="text-accent-cyan">
                    <Plus size={13} />
                  </IconButton>
                  <Button variant="primary" size="sm" onClick={() => handleOpenCoverPicker(album)} title={loc.covers.matchCoverTitle}>
                    <Sparkles size={11} /> {loc.covers.matchCover}
                  </Button>
                  <Button size="sm" onClick={() => handleOpenMbModal(album)} title={loc.covers.matchCoverTitle}>
                    <Search size={11} /> MBID
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className={cn('grid', GRID_LAYOUT[albumGridSize])}>
          {sortedAlbums.map((album) => {
            const { albumTracks, durText } = albumStats(album);
            return (
              <Card
                key={album.id}
                interactive
                padding="none"
                className={cn('flex cursor-pointer flex-col rounded-2xl', compact ? 'gap-2 p-2.5' : 'gap-2.5 p-3.5', TILE_MAX_WIDTH[albumGridSize])}
                onClick={() => handleOpenAlbumDetail(album)}
              >
                <AlbumCover
                  album={album}
                  iconSize={compact ? 36 : 46}
                  className="aspect-square w-full overflow-hidden rounded-xl"
                  title={loc.library.albumViewTracksTooltip}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCoverPicker(album);
                    }}
                    title={loc.covers.matchCoverTitle}
                    className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-2xs font-semibold text-accent-pink backdrop-blur-xs"
                  >
                    <Sparkles size={10} /> {loc.covers.matchCover}
                  </button>
                </AlbumCover>

                <div className="flex-1">
                  <h4 className={cn('line-clamp-2 leading-tight font-bold text-fg', compact ? 'text-ui' : 'text-sm')} title={album.title}>
                    {album.title}
                  </h4>
                  <p className="mt-1 truncate text-xs text-fg-secondary">
                    {album.album_artist} {album.year ? `(${album.year})` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="cyan">
                      {albumTracks.length} {loc.library.tracks}
                    </Badge>
                    {durText && <span className="text-xxs text-fg-muted">{durText}</span>}
                    {album.release_mbid && <Badge size="xs" mono>MBID</Badge>}
                  </div>
                </div>

                {/* Actions; clicks here do not open the album */}
                <div className="mt-auto flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => handlePlayAlbum(albumTracks)} className={compact ? 'px-2' : undefined}>
                    <Play size={11} className="text-accent-pink" /> {loc.player.play}
                  </Button>
                  <IconButton variant="secondary" size="sm" label={loc.library.addToQueue} onClick={() => handleAddAlbumToQueue(albumTracks)} className="text-accent-cyan">
                    <Plus size={12} />
                  </IconButton>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenCoverPicker(album)}
                    aria-label={loc.covers.matchCover}
                    title={loc.covers.matchCoverTitle}
                    className="min-w-0 flex-1 overflow-hidden px-1.5"
                  >
                    <Sparkles size={11} />
                    {!compact && <span className="truncate">{loc.covers.matchCover}</span>}
                  </Button>
                  <IconButton variant="secondary" size="sm" label="MusicBrainz" title={loc.covers.matchCoverTitle} onClick={() => handleOpenMbModal(album)}>
                    <Search size={11} />
                  </IconButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
