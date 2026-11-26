import React from 'react';
import { Copy, Disc, Mic2, Music, Search, X } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { Card, Chip, IconButton, SegmentedControl, TextField } from '../../../components/ui';
import { SortControls } from './SortControls';

export type LibraryToolbarProps = Pick<LibraryViewProps, 'setLibrarySubView' | 'librarySubView' | 'loc' | 'filteredTracks' | 'handleBackFromAlbumDetail' | 'filteredAlbums' | 'filteredArtists' | 'librarySearchInputRef' | 'librarySearch' | 'setLibrarySearch' | 'sortedTracks' | 'handlePlayLibraryTrack' | 'showMessage' | 'sortedAlbums' | 'tracks' | 'libraryFormatFilter' | 'setLibraryFormatFilter' | 'hideDuplicates' | 'setHideDuplicates' | 'sortField' | 'setSortField' | 'setSortOrder' | 'sortOrder'>;

const FORMAT_FILTERS = ['all', 'flac', 'mp3', 'opus', 'wav', 'lossless'] as const;

/** Tracks / albums / artists switch, live search, format and duplicate filters, and sorting. */
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
  <Card padding="none" className="mb-4.5 flex flex-col gap-3 px-4 py-3">
    <div className="flex flex-wrap items-center gap-3">
    <SegmentedControl
      label={loc.library.subViewLabel}
      tone="purple"
      value={librarySubView}
      onChange={(view) => {
        setLibrarySubView(view);
        if (view === 'albums') handleBackFromAlbumDetail();
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
    </div>

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
  </Card>
);
