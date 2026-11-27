import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, Clock, FileCode, FilePlus, Flame, FolderOpen, FolderPlus, Heart, ListPlus, Moon, Music, Play, Plus, Search, Sliders, SortAscending, SortDescending, Sparkles, Star, Tag as TagIcon, Zap } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import type { SmartPlaylistFilter } from '../../../hooks/useLibraryManager';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Chip, EmptyState, IconButton, type Tone } from '../../../components/ui';
import { NowPlayingMark, StarRating, TrackAction, TrackCover, TrackFormatBadge, TrackRowMenu, type TrackMenuEntry } from './trackRowParts';
import { formatAddedDate, isHiRes } from './trackModel';
import { AlphaJumpRail } from './AlphaJumpRail';
import { buildLetterIndex } from './alphaIndexModel';
import { LibraryPagination } from './LibraryPagination';
import { DEFAULT_PAGE_SIZE, clampPage, pageOfIndex, pageRange, parsePageSize } from './paginationModel';

export type LibraryTracksViewProps = Pick<LibraryViewProps, 'loc' | 'albums' | 'smartPlaylistFilter' | 'setSmartPlaylistFilter' | 'setIsCueModalOpen' | 'sortedTracks' | 'tracks' | 'sortField' | 'sortOrder' | 'librarySearch' | 'handlePlayLibraryTrack' | 'refreshQueue' | 'showMessage' | 'handleSort' | 'handlePickFolder' | 'handlePickFiles' | 'setLibrarySearch' | 'activeTrackId' | 'currentPlayingTrack' | 'status' | 'formatTime' | 'setStatsModalTrack' | 'handleSetTrackRating' | 'handleToggleFavorite' | 'handleAddTrackToQueue' | 'setTagEditorTrack' | 'handleScanTrackReplayGain' | 'setCreateStemProjectTrack' | 'setIsCreateStemProjectOpen' | 'handleAddTrackNextToQueue' | 'setTrackToAddToPlaylist' | 'setShowPlaylistModal' | 'handleOpenContainingFolder'> & {
  t: LibraryViewProps['loc'];
};

type SortField = LibraryViewProps['sortField'];
type Loc = LibraryViewProps['loc'];

const SMART_COLLECTIONS = (loc: Loc): { id: SmartPlaylistFilter; label: string; icon: typeof Music; tone: Tone }[] => [
  { id: 'all', label: loc.library.smartAll, icon: Music, tone: 'purple' },
  { id: 'favorites', label: loc.library.smartFavorites, icon: Heart, tone: 'pink' },
  { id: 'top_rated', label: loc.library.quickVibeTopRated, icon: Star, tone: 'amber' },
  { id: 'history', label: loc.library.smartHistory, icon: Clock, tone: 'cyan' },
  { id: 'top_played', label: loc.library.smartTopPlayed, icon: Flame, tone: 'amber' },
  { id: 'hires', label: loc.library.smartHiRes, icon: Sparkles, tone: 'purple' },
  { id: 'high_bpm', label: loc.library.quickVibeFastBpm, icon: Zap, tone: 'pink' },
  { id: 'forgotten', label: loc.library.quickVibeForgotten, icon: Moon, tone: 'cyan' },
];

/** Readable name of a sort field for the "Sorting: …" summary. */
function sortFieldLabel(loc: Loc, field: SortField): string {
  switch (field) {
    case 'default': return '#';
    case 'title': return loc.library.sortTitle;
    case 'artist': return loc.library.sortArtist;
    case 'duration': return loc.library.sortDuration;
    case 'format': return loc.library.sortFormat;
    case 'date': return loc.library.sortDate;
    case 'added': return loc.library.sortAdded;
    case 'year': return loc.library.sortYear;
    case 'plays': return loc.library.sortPlays;
  }
}

/** Column header that sorts the table: a button inside the cell, with `aria-sort` on the cell. */
function SortableTh({
  field,
  sortField,
  sortOrder,
  onSort,
  title,
  className,
  children,
}: {
  field: SortField;
  sortField: SortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sortField === field;
  return (
    <th aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('font-semibold', className)}>
      <Button variant="ghost" onClick={() => onSort(field)} title={title} className={cn('gap-1 p-0 text-xs tracking-wide uppercase', active && 'text-accent-pink')}>
        {children}
        {active && (sortOrder === 'asc' ? <SortAscending size={13} /> : <SortDescending size={13} />)}
      </Button>
    </th>
  );
}

/**
 * The track table: smart collections, sortable columns (cover, album, year, date added, quality),
 * rating and per-track actions. Rows are paginated (page size persisted), so the table never mounts more
 * than one page of rows.
 */
export const LibraryTracksView: React.FC<LibraryTracksViewProps> = ({
  activeTrackId,
  albums,
  currentPlayingTrack,
  formatTime,
  handleAddTrackNextToQueue,
  handleAddTrackToQueue,
  handleOpenContainingFolder,
  handlePickFiles,
  handlePickFolder,
  handlePlayLibraryTrack,
  handleScanTrackReplayGain,
  handleSetTrackRating,
  handleSort,
  handleToggleFavorite,
  librarySearch,
  loc,
  refreshQueue,
  setCreateStemProjectTrack,
  setIsCreateStemProjectOpen,
  setIsCueModalOpen,
  setLibrarySearch,
  setShowPlaylistModal,
  setSmartPlaylistFilter,
  setStatsModalTrack,
  setTagEditorTrack,
  setTrackToAddToPlaylist,
  showMessage,
  smartPlaylistFilter,
  sortField,
  sortOrder,
  sortedTracks,
  status,
  t,
  tracks,
}) => {
  const sortProps = { sortField, sortOrder, onSort: handleSort };
  const isFiltered = sortField !== 'default' || sortOrder !== 'asc' || librarySearch.trim() !== '' || smartPlaylistFilter !== 'all';
  const total = sortedTracks.length;

  // Pagination: back to page 1 whenever the list is re-sorted, searched or filtered.
  const [pageSize, setPageSize] = usePersistedState('auralune_library_page_size', DEFAULT_PAGE_SIZE, { parse: parsePageSize });
  const listKey = `${sortField}|${sortOrder}|${smartPlaylistFilter}|${librarySearch}|${total}|${pageSize}`;
  const [pageState, setPageState] = useState({ key: listKey, page: 1 });
  const page = clampPage(pageState.key === listKey ? pageState.page : 1, total, pageSize);
  const { start, end } = pageRange(page, total, pageSize);
  const pageTracks = useMemo(() => sortedTracks.slice(start, end), [sortedTracks, start, end]);

  const topRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  const goToPage = useCallback((next: number) => {
    setPageState({ key: listKey, page: next });
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [listKey]);

  // Cover, album title and year come from the album (tracks carry none of them).
  const albumById = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums]);

  // A–Z rail: only while the list is ordered alphabetically by title or artist.
  const reordersBySmartFilter =
    smartPlaylistFilter === 'history' ||
    smartPlaylistFilter === 'top_played' ||
    smartPlaylistFilter === 'top_rated' ||
    smartPlaylistFilter === 'high_bpm' ||
    smartPlaylistFilter === 'forgotten';
  const railField: 'title' | 'artist' | null =
    sortField === 'title' ? 'title' : sortField === 'artist' || (sortField === 'default' && !reordersBySmartFilter) ? 'artist' : null;
  const letterIndex = useMemo(
    () => (railField ? buildLetterIndex(sortedTracks, (track) => track[railField]) : null),
    [railField, sortedTracks],
  );

  // A letter can sit on another page: switch to it first, then scroll its row into view.
  const [pendingJump, setPendingJump] = useState<number | null>(null);
  const jumpToTrack = useCallback((index: number) => {
    setPageState({ key: listKey, page: pageOfIndex(index, pageSize) });
    setPendingJump(index);
  }, [listKey, pageSize]);
  useEffect(() => {
    if (pendingJump === null || page !== pageOfIndex(pendingJump, pageSize)) return;
    rowsRef.current?.children[pendingJump - start]?.scrollIntoView({ block: 'start' });
    setPendingJump(null);
  }, [pendingJump, page, pageSize, start]);

  const sortedSummary =
    sortField !== 'default' || sortOrder !== 'asc'
      ? ` • ${fmt(loc.library.sortedBy, sortFieldLabel(loc, sortField), sortOrder === 'asc' ? loc.library.sortedAsc : loc.library.sortedDesc)}`
      : '';

  const menuEntries = (track: (typeof tracks)[number]): TrackMenuEntry[] => [
    { label: loc.library.playNext, icon: <ListPlus size={15} className="text-accent-purple" />, onSelect: (e) => handleAddTrackNextToQueue(track, e) },
    { label: loc.library.addToPlaylist, icon: <FolderPlus size={15} className="text-accent-amber" />, onSelect: () => { setTrackToAddToPlaylist(track); setShowPlaylistModal(true); } },
    { label: loc.library.tagEditorTooltip, icon: <TagIcon size={15} className="text-accent-cyan" />, onSelect: () => setTagEditorTrack(track) },
    { label: loc.settings.scanReplayGainTrack, icon: <Activity size={15} className="text-accent-purple" />, onSelect: () => handleScanTrackReplayGain(track) },
    { label: loc.library.createStemProjectTooltip, icon: <Sliders size={15} className="text-accent-pink" />, onSelect: () => { setCreateStemProjectTrack(track); setIsCreateStemProjectOpen(true); } },
    { label: loc.player.trackStats, icon: <BarChart3 size={15} className="text-accent-amber" />, onSelect: () => setStatsModalTrack(track) },
    { label: loc.library.openContainingFolder, icon: <FolderOpen size={15} className="text-accent-cyan" />, onSelect: (e) => handleOpenContainingFolder(track.path, e) },
  ];

  const colCount = 10;
  const wide = 'hidden xl:table-cell';

  return (
    <div ref={topRef} className="scroll-mt-2">
      {/* Smart collections */}
      <div role="group" aria-label={loc.library.collection} className="mb-3.5 flex flex-wrap items-center gap-2">
        {SMART_COLLECTIONS(loc).map(({ id, label, icon: Icon, tone }) => {
          const selected = smartPlaylistFilter === id;
          return (
            <Chip key={id} tone={tone} pressed={selected} onClick={() => setSmartPlaylistFilter(id)}>
              <Icon size={13} fill={id === 'favorites' && selected ? 'currentColor' : 'none'} />
              {label}
            </Chip>
          );
        })}
        <Button variant="tinted" tone="purple" size="sm" onClick={() => setIsCueModalOpen(true)} title={loc.library.cueSheetOpenTooltip} className="ml-auto">
          <FileCode size={13} />
          {loc.library.cueSheetBtn}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-ui text-fg-muted">
          {total !== tracks.length
            ? fmt(loc.library.resultsCount, String(total), String(tracks.length))
            : fmt(loc.library.totalTracksCount, String(tracks.length))}
          {sortedSummary}
          {smartPlaylistFilter === 'history' && ` • ${loc.library.sortedNewest}`}
          {smartPlaylistFilter === 'top_played' && ` • ${loc.library.sortedPlays}`}
        </span>
        {total > 0 && isFiltered && (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => handlePlayLibraryTrack(sortedTracks[0], sortedTracks)}>
              <Play size={14} /> {loc.library.playSorted}
            </Button>
            <IconButton
              variant="secondary"
              label={loc.library.addToQueue}
              className="text-accent-cyan"
              onClick={async () => {
                await invoke('add_uris_to_queue', { uris: sortedTracks.map((track) => track.path) });
                await refreshQueue();
                showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(total)));
              }}
            >
              <Plus size={14} />
            </IconButton>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mb-2">
          <LibraryPagination page={page} pageSize={pageSize} total={total} onPageChange={goToPage} onPageSizeChange={setPageSize} loc={loc} />
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="overflow-clip rounded-xl border border-line">
            <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-ink/95">
              <tr className="h-10.5 border-b border-line text-fg-muted">
                <SortableTh field="default" {...sortProps} title={loc.library.sortDefaultTooltip} className="w-11 px-1.5 text-center">#</SortableTh>
                <SortableTh field="title" {...sortProps} title={loc.library.sortTitleTooltip} className="px-2.5">{loc.library.sortTitle}</SortableTh>
                <SortableTh field="artist" {...sortProps} title={loc.library.sortArtistTooltip} className="hidden w-[18%] px-2.5 md:table-cell">{loc.library.sortArtist}</SortableTh>
                <SortableTh field="year" {...sortProps} title={loc.library.sortYearTooltip} className={cn(wide, 'w-16 px-2')}>{loc.library.sortYear}</SortableTh>
                <SortableTh field="added" {...sortProps} title={loc.library.sortAddedTooltip} className={cn(wide, 'w-26 px-2')}>{loc.library.colAdded}</SortableTh>
                <SortableTh field="format" {...sortProps} title={loc.library.sortFormatTooltip} className="hidden w-32 px-2 lg:table-cell">{loc.library.quality}</SortableTh>
                <SortableTh field="duration" {...sortProps} title={loc.library.sortDurationTooltip} className="w-17 px-2 text-right">{loc.queue.duration}</SortableTh>
                <SortableTh field="plays" {...sortProps} title={loc.library.sortPlaysTooltip} className="hidden w-16 px-1.5 text-center lg:table-cell">{loc.library.playsCol}</SortableTh>
                <th className="hidden w-26 px-1.5 text-center text-xs font-semibold tracking-wide uppercase lg:table-cell">{loc.library.rating}</th>
                <th className="w-26 px-1.5 text-center text-xs font-semibold tracking-wide uppercase">{loc.library.actions}</th>
              </tr>
            </thead>
            <tbody ref={rowsRef}>
              {total === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    {tracks.length === 0 ? (
                      <EmptyState
                        icon={<FolderPlus size={28} className="text-accent-purple" />}
                        title={loc.library.empty}
                        description={loc.library.emptyHint}
                        action={
                          <div className="flex flex-wrap justify-center gap-2.5">
                            <Button variant="primary" onClick={handlePickFolder}>
                              <FolderPlus size={14} /> {loc.library.addFolder}...
                            </Button>
                            <Button onClick={handlePickFiles}>
                              <FilePlus size={14} className="text-accent-cyan" /> {loc.library.addFiles}...
                            </Button>
                          </div>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={<Search size={28} />}
                        title={fmt(loc.library.emptySearchTracks, librarySearch)}
                        action={<Button onClick={() => setLibrarySearch('')}>{loc.library.clearSearch}</Button>}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                pageTracks.map((track, localIdx) => {
                  const idx = start + localIdx;
                  const isCurrent = (activeTrackId != null && activeTrackId === track.id) || (currentPlayingTrack != null && currentPlayingTrack.id === track.id);
                  const gain = track.replaygain_track_gain;
                  const album = track.album_id != null ? albumById.get(track.album_id) : undefined;
                  const cell = 'h-14 truncate py-0 align-middle';
                  return (
                    <tr
                      key={track.id}
                      onClick={() => handlePlayLibraryTrack(track)}
                      className={cn(
                        'glass-card h-14 scroll-mt-11 cursor-pointer border-b border-white/3 last:border-b-0',
                        isCurrent && 'bg-linear-to-r from-accent-pink/25 via-accent-purple/10 to-transparent',
                      )}
                    >
                      <td className={cn(cell, 'px-1.5 text-center font-mono text-fg-muted')} title={track.track_no ? `#${idx + 1} (Track ${track.track_no})` : `#${idx + 1}`}>
                        {isCurrent ? <NowPlayingMark playing={status.state === 'Playing'} /> : idx + 1}
                      </td>
                      <td className={cn(cell, 'px-2.5')}>
                        <div className="flex items-center gap-2.5">
                          <TrackCover src={album?.cover_path} />
                          <div className="min-w-0">
                            <div className={cn('flex items-center gap-1.5 font-semibold', isCurrent ? 'text-accent-pink' : 'text-fg')}>
                              {track.is_favorite && <Heart size={12} fill="currentColor" className="shrink-0 text-accent-pink" />}
                              <span className="truncate" title={track.title}>{track.title}</span>
                            </div>
                            <div className="truncate text-xs text-fg-muted" title={album?.title}>
                              <span className="md:hidden">{track.artist} • </span>
                              {album?.title ?? loc.library.unknownAlbum}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={cn(cell, 'hidden px-2.5 text-fg-secondary md:table-cell')} title={track.artist}>{track.artist}</td>
                      <td className={cn(cell, wide, 'px-2 font-mono text-xs text-fg-muted')}>{album?.year ?? '—'}</td>
                      <td className={cn(cell, wide, 'px-2 text-xs text-fg-muted')}>{formatAddedDate(track.added_at) || '—'}</td>
                      <td className={cn(cell, 'hidden px-2 lg:table-cell')}>
                        <div className="flex items-center gap-1.5">
                          <TrackFormatBadge track={track} suffix={isHiRes(track) ? ' Hi-Res' : undefined} />
                          {gain !== null && gain !== undefined && (
                            <Badge
                              tone="purple"
                              mono
                              title={`ReplayGain: ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB (Peak: ${track.replaygain_track_peak ? track.replaygain_track_peak.toFixed(3) : '1.0'})`}
                            >
                              RG
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-xxs text-fg-muted">
                          {Math.round(track.sample_rate / 1000)} kHz{track.bit_depth ? ` / ${track.bit_depth}-bit` : ''}
                        </div>
                      </td>
                      <td className={cn(cell, 'px-2 text-right font-mono tabular-nums')}>{formatTime(track.duration_ms)}</td>
                      <td className={cn(cell, 'hidden px-1.5 text-center lg:table-cell')}>
                        <Button
                          variant={track.play_count ? 'tinted' : 'ghost'}
                          tone="amber"
                          size="sm"
                          title={loc.player.trackStats}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatsModalTrack(track);
                          }}
                          className="rounded-xl px-2 font-mono font-bold"
                        >
                          <Flame size={12} />
                          {track.play_count || 0}
                        </Button>
                      </td>
                      <td className={cn(cell, 'hidden px-1 text-center lg:table-cell')}>
                        <StarRating rating={track.rating} onRate={(stars) => handleSetTrackRating(track.id, stars)} loc={loc} />
                      </td>
                      <td className="h-14 px-1.5 text-center align-middle">
                        <div className="inline-flex items-center justify-center gap-0.5">
                          <TrackAction
                            label={track.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                            tone={track.is_favorite ? 'pink' : 'neutral'}
                            onClick={(e) => handleToggleFavorite(track.id, e)}
                          >
                            <Heart size={15} fill={track.is_favorite ? 'currentColor' : 'none'} />
                          </TrackAction>
                          <TrackAction label={loc.player.play} tone="pink" onClick={() => handlePlayLibraryTrack(track)}>
                            <Play size={15} />
                          </TrackAction>
                          <TrackAction label={loc.library.addToQueue} tone="cyan" onClick={(e) => handleAddTrackToQueue(track, e)}>
                            <Plus size={15} />
                          </TrackAction>
                          <TrackRowMenu label={loc.library.moreActions} entries={menuEntries(track)} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="mt-3">
              <LibraryPagination page={page} pageSize={pageSize} total={total} onPageChange={goToPage} onPageSizeChange={setPageSize} loc={loc} />
            </div>
          )}
        </div>

        {letterIndex && letterIndex.size > 0 && (
          <AlphaJumpRail letterIndex={letterIndex} onJump={jumpToTrack} label={loc.library.alphaJumpLabel} otherLabel={loc.library.alphaJumpOther} />
        )}
      </div>
    </div>
  );
};
