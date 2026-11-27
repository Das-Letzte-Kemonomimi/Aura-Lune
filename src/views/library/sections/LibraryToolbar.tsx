import React from 'react';
import { AlertTriangle, Copy, Disc, LayoutGrid, List, Mic2, Music, Search, X } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { Badge, Card, Chip, IconButton, SegmentedControl, TextField } from '../../../components/ui';
import { fmt } from '../../../utils/fmt';
import { SortControls } from './SortControls';

export type ArtistSortField = 'name' | 'tracks' | 'albums' | 'plays';

export type LibraryToolbarProps = Pick<
  LibraryViewProps,
  | 'setLibrarySubView'
  | 'librarySubView'
  | 'loc'
  | 'filteredTracks'
  | 'handleBackFromAlbumDetail'
  | 'filteredAlbums'
  | 'filteredArtists'
  | 'librarySearchInputRef'
  | 'librarySearch'
  | 'setLibrarySearch'
  | 'sortedTracks'
  | 'handlePlayLibraryTrack'
  | 'showMessage'
  | 'sortedAlbums'
  | 'tracks'
  | 'libraryFormatFilter'
  | 'setLibraryFormatFilter'
  | 'hideDuplicates'
  | 'setHideDuplicates'
  | 'sortField'
  | 'setSortField'
  | 'setSortOrder'
  | 'sortOrder'
  | 'albums'
  | 'albumCoverFilter'
  | 'setAlbumCoverFilter'
  | 'albumsWithCoverCount'
  | 'albumsWithoutCoverCount'
  | 'albumSortField'
  | 'setAlbumSortField'
  | 'albumSortOrder'
  | 'setAlbumSortOrder'
  | 'albumGridSize'
  | 'setAlbumGridSize'
  | 'albumViewMode'
  | 'setAlbumViewMode'
> & {
  artistSortField: ArtistSortField;
  setArtistSortField: (v: ArtistSortField) => void;
  artistSortOrder: 'asc' | 'desc';
  setArtistSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  onBackFromArtistDetail: () => void;
};

const FORMAT_FILTERS = ['all', 'flac', 'mp3', 'opus', 'wav', 'lossless'] as const;

/** Tracks / albums / artists switch, live search, and context-aware filters/sorting. */
export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  albumCoverFilter,
  albumGridSize,
  albumSortField,
  albumSortOrder,
  albumViewMode,
  albums,
  albumsWithCoverCount,
  albumsWithoutCoverCount,
  artistSortField,
  artistSortOrder,
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
  onBackFromArtistDetail,
  setAlbumCoverFilter,
  setAlbumGridSize,
  setAlbumSortField,
  setAlbumSortOrder,
  setAlbumViewMode,
  setArtistSortField,
  setArtistSortOrder,
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
  <Card variant="panel" padding="none" className="flex flex-col gap-3 px-4 py-3">
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        label={loc.library.subViewLabel}
        tone="purple"
        value={librarySubView}
        onChange={(view) => {
          setLibrarySubView(view);
          if (view === 'albums') handleBackFromAlbumDetail();
          if (view === 'artists') onBackFromArtistDetail();
        }}
        items={[
          { value: 'tracks', icon: <Music size={14} />, label: `${loc.library.tracks} (${filteredTracks.length})` },
          { value: 'albums', icon: <Disc size={14} />, label: `${loc.library.albums} (${filteredAlbums.length})` },
          { value: 'artists', icon: <Mic2 size={14} />, label: `${loc.library.artists} (${filteredArtists.length})` },
        ]}
      />

      {/* Live search: Enter plays the first result, Escape clears */}
      <div className="relative grow basis-50">
        <TextField
          ref={librarySearchInputRef}
          icon={<Search size={14} />}
          aria-label={loc.library.searchPlaceholder}
          placeholder={loc.library.searchPlaceholder}
          value={librarySearch}
          onChange={(e) => setLibrarySearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (librarySubView === 'tracks' && sortedTracks.length > 0) {
                handlePlayLibraryTrack(sortedTracks[0]);
                showMessage(`Playing ${sortedTracks[0].title}`);
              } else if (librarySubView === 'albums' && sortedAlbums.length > 0) {
                const albumTracks = tracks.filter((t) => t.album_id === sortedAlbums[0].id);
                if (albumTracks.length > 0) {
                  handlePlayLibraryTrack(albumTracks[0], albumTracks);
                  showMessage(`Playing the album ${sortedAlbums[0].title}`);
                }
              }
            } else if (e.key === 'Escape') {
              setLibrarySearch('');
            }
          }}
          className="[&>input]:pr-8"
        />
        {librarySearch && (
          <IconButton
            size="sm"
            label={loc.library.clearSearch}
            onClick={() => setLibrarySearch('')}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <X size={13} />
          </IconButton>
        )}
      </div>

      {librarySubView === 'albums' && (
        <div className="flex flex-wrap items-center gap-2">
          {albumViewMode === 'grid' && (
            <SegmentedControl
              size="sm"
              tone="cyan"
              label={loc.library.albumGridSize}
              value={albumGridSize}
              onChange={setAlbumGridSize}
              items={[
                { value: 'compact', label: 'S', ariaLabel: loc.library.albumTileSmall },
                { value: 'medium', label: 'M', ariaLabel: loc.library.albumTileMedium },
                { value: 'large', label: 'L', ariaLabel: loc.library.albumTileLarge },
              ]}
            />
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
      )}
    </div>

    {librarySubView === 'tracks' && (
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <SegmentedControl
          size="sm"
          tone="purple"
          label={loc.library.formatFilterLabel}
          value={libraryFormatFilter}
          onChange={setLibraryFormatFilter}
          items={FORMAT_FILTERS.map((format) => ({
            value: format,
            label: format === 'all' ? loc.library.all : format === 'lossless' ? loc.library.lossless : format.toUpperCase(),
          }))}
        />

        <Chip
          pressed={hideDuplicates}
          onClick={() => {
            const next = !hideDuplicates;
            setHideDuplicates(next);
            showMessage(next ? loc.library.hideDuplicatesFilterOn : loc.library.hideDuplicatesFilterOff);
          }}
          title={loc.library.hideDuplicatesTooltip}
        >
          <Copy size={12} />
          {hideDuplicates ? loc.library.duplicatesHidden : loc.library.duplicates}
        </Chip>

        <SortControls
          className="ml-auto flex items-center gap-1.5"
          caption={loc.library.sortBy}
          label={loc.library.sortBy}
          field={sortField}
          onFieldChange={setSortField}
          options={[
            { value: 'default', label: loc.library.sortDefault },
            { value: 'title', label: loc.library.sortTitle },
            { value: 'artist', label: loc.library.sortArtist },
            { value: 'duration', label: loc.library.sortDuration },
            { value: 'format', label: loc.library.sortFormat },
            { value: 'date', label: loc.library.sortDate },
            { value: 'added', label: loc.library.sortAdded },
            { value: 'year', label: loc.library.sortYear },
            { value: 'plays', label: loc.library.sortPlays },
          ]}
          order={sortOrder}
          onToggleOrder={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          ascLabel={loc.library.sortAscTooltip}
          descLabel={loc.library.sortDescTooltip}
        />
      </div>
    )}

    {librarySubView === 'albums' && (
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
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
            {
              value: 'missing-cover',
              tone: albumsWithoutCoverCount > 0 ? 'amber' : undefined,
              title: loc.library.albumFilterMissingCoverHint,
              icon: albumsWithoutCoverCount > 0 ? <AlertTriangle size={13} className="text-accent-amber" aria-hidden="true" /> : undefined,
              label: (
                <>
                  {loc.library.albumFilterMissingCover}
                  <Badge tone={albumsWithoutCoverCount > 0 ? 'amber' : 'neutral'} size="xs">
                    {albumsWithoutCoverCount}
                  </Badge>
                </>
              ),
            },
          ]}
        />
        <SortControls
          className="ml-auto flex items-center gap-1.5"
          caption={loc.library.sortBy}
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
      </div>
    )}

    {librarySubView === 'artists' && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-ui font-bold text-fg">
          {filteredArtists.length !== new Set(tracks.map((track) => track.artist || loc.stats.unknownArtist)).size
            ? fmt(loc.library.resultsArtists, String(filteredArtists.length))
            : fmt(loc.library.totalArtists, String(filteredArtists.length))}
        </span>
        <SortControls
          className="ml-auto flex items-center gap-1.5"
          caption={loc.library.sortBy}
          label={loc.library.sortBy}
          field={artistSortField}
          onFieldChange={setArtistSortField}
          options={[
            { value: 'name', label: loc.library.sortArtist },
            { value: 'tracks', label: loc.library.sortTrackCount },
            { value: 'albums', label: loc.library.albums },
            { value: 'plays', label: loc.library.sortPlays },
          ]}
          order={artistSortOrder}
          onToggleOrder={() => setArtistSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          ascLabel={loc.library.sortAscTooltip}
          descLabel={loc.library.sortDescTooltip}
        />
      </div>
    )}
  </Card>
);
