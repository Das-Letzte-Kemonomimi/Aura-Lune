import React from 'react';
import { ArrowUpDown, Copy, Disc, Mic2, Music, Search, X } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';
import { cn } from '../../../utils/cn';

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
    <div className="mb-4.5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-black/20 px-4 py-3">
      {/* View toggle: tracks vs albums */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setLibrarySubView('tracks')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-ui font-semibold text-fg',
            librarySubView === 'tracks' ? 'bg-accent-purple' : 'bg-white/6',
          )}
        >
          <Music size={14} /> {loc.library.tracks} ({filteredTracks.length})
        </button>
        <button
          onClick={() => {
            setLibrarySubView('albums');
            handleBackFromAlbumDetail();
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-ui font-semibold text-fg',
            librarySubView === 'albums' ? 'bg-accent-purple' : 'bg-white/6',
          )}
        >
          <Disc size={14} /> {loc.library.albums} ({filteredAlbums.length})
        </button>
        <button
          onClick={() => setLibrarySubView('artists')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-ui font-semibold text-fg',
            librarySubView === 'artists' ? 'bg-accent-purple' : 'bg-white/6',
          )}
        >
          <Mic2 size={14} /> {loc.library.artists || 'Artists'} ({filteredArtists.length})
        </button>
      </div>

      {/* Live Search field */}
      <div className="relative grow basis-50">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
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
          className="w-full rounded-lg border border-line bg-black/30 pl-8 pr-7.5 py-2 text-ui text-fg"
        />
        {librarySearch && (
          <button
            onClick={() => setLibrarySearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent p-0 text-fg-muted"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Audio format filters */}
      <div className="flex items-center gap-1.5">
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
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150',
                isSelected ? 'bg-accent-purple' : 'bg-white/5',
                isSelected ? 'text-fg' : 'text-fg-secondary',
                isSelected ? 'border-accent-purple' : 'border-line',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Hide duplicates toggle */}
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
        className={cn(
          'flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150',
          hideDuplicates ? 'bg-pink-500/25' : 'bg-white/5',
          hideDuplicates ? 'border-accent-pink' : 'border-line',
          hideDuplicates ? 'text-fg' : 'text-fg-muted',
        )}
        title={loc.library.hideDuplicatesTooltip}
      >
        <Copy size={12} />
        {hideDuplicates ? loc.library.duplicatesHidden : loc.library.duplicates}
      </button>

      {/* Sort control */}
      <div className="ml-auto flex items-center gap-1.5">
        <ArrowUpDown size={13} className="text-fg-muted" />
        <span className="text-xs font-semibold text-fg-muted">{loc.library.sortBy}</span>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as any)}
          className="cursor-pointer rounded-md border border-line pl-2.5 pr-7 py-1.5 text-xs font-semibold text-fg shadow-md shadow-black/30"
        >
          <option value="default">{loc.library.sortDefault}</option>
          <option value="title">{loc.library.sortTitle}</option>
          <option value="artist">{loc.library.sortArtist}</option>
          <option value="duration">{loc.library.sortDuration}</option>
          <option value="format">{loc.library.sortFormat}</option>
          <option value="date">{loc.library.sortDate}</option>
          <option value="plays">{loc.library.sortPlays}</option>
        </select>
        <button
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="rounded-md border border-line bg-white/6 px-2 py-1 text-xs font-bold text-accent-cyan"
          title={sortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
        >
          {sortOrder === 'asc' ? '▲' : '▼'}
        </button>
      </div>
    </div>
);
