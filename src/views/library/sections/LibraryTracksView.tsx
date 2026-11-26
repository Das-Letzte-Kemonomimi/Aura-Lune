import React from 'react';
import { Activity, BarChart3, Clock, FileCode, FilePlus, Flame, FolderOpen, FolderPlus, Heart, ListPlus, Moon, Music, Play, Plus, Search, Sliders, SortAscending, SortDescending, Sparkles, Star, Tag as TagIcon, Zap } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import type { SmartPlaylistFilter } from '../../../hooks/useLibraryManager';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Chip, EmptyState, IconButton, type Tone } from '../../../components/ui';
import { NowPlayingMark, StarRating, TrackAction, TrackFormatBadge } from './trackRowParts';
import { isHiRes } from './trackModel';

export type LibraryTracksViewProps = Pick<LibraryViewProps, 'loc' | 'smartPlaylistFilter' | 'setSmartPlaylistFilter' | 'setIsCueModalOpen' | 'sortedTracks' | 'tracks' | 'sortField' | 'sortOrder' | 'librarySearch' | 'handlePlayLibraryTrack' | 'refreshQueue' | 'showMessage' | 'libraryTableRef' | 'handleSort' | 'handlePickFolder' | 'handlePickFiles' | 'setLibrarySearch' | 'trackTopSpacer' | 'trackStartIndex' | 'trackEndIndex' | 'activeTrackId' | 'currentPlayingTrack' | 'status' | 'formatTime' | 'setStatsModalTrack' | 'handleSetTrackRating' | 'handleToggleFavorite' | 'handleAddTrackToQueue' | 'setTagEditorTrack' | 'handleScanTrackReplayGain' | 'setCreateStemProjectTrack' | 'setIsCreateStemProjectOpen' | 'handleAddTrackNextToQueue' | 'setTrackToAddToPlaylist' | 'setShowPlaylistModal' | 'handleOpenContainingFolder' | 'trackBottomSpacer'> & {
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
    <th aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <Button variant="ghost" onClick={() => onSort(field)} title={title} className="gap-1 p-0 text-sm text-inherit">
        {children}
        {active && (sortOrder === 'asc' ? <SortAscending size={13} /> : <SortDescending size={13} />)}
      </Button>
    </th>
  );
}

/** The track table with smart collections, sortable columns, rating and per-track actions (virtualised rows). */
export const LibraryTracksView: React.FC<LibraryTracksViewProps> = ({
  activeTrackId,
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
  libraryTableRef,
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
  trackBottomSpacer,
  trackEndIndex,
  trackStartIndex,
  trackTopSpacer,
  tracks,
}) => {
  const sortProps = { sortField, sortOrder, onSort: handleSort };
  const isFiltered = sortField !== 'default' || sortOrder !== 'asc' || librarySearch.trim() !== '' || smartPlaylistFilter !== 'all';
  const cell = 'h-12 max-h-12 truncate py-0 align-middle';
  return (
    <div>
      {/* Smart collections */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-fg-muted">{loc.library.collection}</span>
        {SMART_COLLECTIONS(loc).map(({ id, label, icon: Icon, tone }) => {
          const selected = smartPlaylistFilter === id;
          return (
            <Chip key={id} tone={tone} pressed={selected} onClick={() => setSmartPlaylistFilter(id)} className="py-1.5">
              <Icon size={13} fill={id === 'favorites' && selected ? 'currentColor' : 'none'} />
              {label}
            </Chip>
          );
        })}
        <Button variant="tinted" tone="purple" size="sm" onClick={() => setIsCueModalOpen(true)} title={loc.library.cueSheetOpenTooltip} className="ml-auto py-1.5">
          <FileCode size={13} />
          {loc.library.cueSheetBtn}
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-ui text-fg-muted">
          {sortedTracks.length !== tracks.length
            ? fmt(loc.library.resultsCount, String(sortedTracks.length), String(tracks.length))
            : fmt(loc.library.totalTracksCount, String(tracks.length))}
          {(sortField !== 'default' || sortOrder !== 'asc') && ` • ${fmt(loc.library.sortedBy, sortField === 'default' ? '#' : sortField, sortOrder === 'asc' ? loc.library.sortedAsc : loc.library.sortedDesc)}`}
          {smartPlaylistFilter === 'history' && ` • ${loc.library.sortedNewest}`}
          {smartPlaylistFilter === 'top_played' && ` • ${loc.library.sortedPlays}`}
        </span>
        {sortedTracks.length > 0 && isFiltered && (
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
                showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(sortedTracks.length)));
              }}
            >
              <Plus size={14} />
            </IconButton>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table ref={libraryTableRef} className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ink/95 backdrop-blur-md">
            <tr className="h-10.5 border-b border-line text-fg-muted">
              <SortableTh field="default" {...sortProps} title={loc.library.sortDefaultTooltip} className="w-11.5 px-1.5 py-2.5 text-center">#</SortableTh>
              <SortableTh field="title" {...sortProps} title={loc.library.sortTitleTooltip} className="w-[28%] p-2.5">{loc.library.sortTitle}</SortableTh>
              <SortableTh field="artist" {...sortProps} title={loc.library.sortArtistTooltip} className="w-1/5 p-2.5">{loc.library.sortArtist}</SortableTh>
              <SortableTh field="format" {...sortProps} title={loc.library.sortFormatTooltip} className="w-27.5 px-2 py-2.5">{loc.library.sortFormat}</SortableTh>
              <th className="w-29 px-2 py-2.5">{loc.library.quality}</th>
              <SortableTh field="duration" {...sortProps} title={loc.library.sortDurationTooltip} className="w-19 px-2 py-2.5 text-right">{loc.queue.duration}</SortableTh>
              <SortableTh field="plays" {...sortProps} title={loc.library.sortPlaysTooltip} className="w-19 px-1.5 py-2.5 text-center">{loc.library.playsCol}</SortableTh>
              <th className="w-24 px-1.5 py-2.5 text-center">{loc.library.rating}</th>
              <th className="w-34 px-1.5 py-2.5 text-center">{loc.library.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedTracks.length === 0 ? (
              <tr>
                <td colSpan={9}>
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
              <>
                {trackTopSpacer > 0 && (
                  <tr className="pointer-events-none" style={{ height: `${trackTopSpacer}px` }}>
                    <td colSpan={9} className="border-0 p-0" style={{ height: `${trackTopSpacer}px` }} />
                  </tr>
                )}
                {sortedTracks.slice(trackStartIndex, trackEndIndex).map((track, localIdx) => {
                  const idx = trackStartIndex + localIdx;
                  const isCurrent = (activeTrackId != null && activeTrackId === track.id) || (currentPlayingTrack != null && currentPlayingTrack.id === track.id);
                  const gain = track.replaygain_track_gain;
                  return (
                    <tr
                      key={track.id}
                      onClick={() => handlePlayLibraryTrack(track)}
                      className={cn('glass-card h-12 max-h-12 cursor-pointer border-b border-white/3', isCurrent && 'bg-accent-purple/20')}
                    >
                      <td
                        className={cn(cell, 'px-2 text-center font-mono text-fg-muted')}
                        title={track.track_no ? `#${idx + 1} (Track ${track.track_no})` : `#${idx + 1}`}
                      >
                        {isCurrent ? <NowPlayingMark playing={status.state === 'Playing'} /> : idx + 1}
                      </td>
                      <td className={cn(cell, 'px-2.5 font-semibold', isCurrent ? 'text-accent-pink' : 'text-fg')}>
                        <div className="flex items-center gap-1.5 truncate">
                          {track.is_favorite && <Heart size={13} fill="currentColor" className="shrink-0 text-accent-pink" />}
                          <span className="truncate" title={track.title}>{track.title}</span>
                        </div>
                      </td>
                      <td className={cn(cell, 'px-2.5 text-fg-secondary')} title={track.artist}>
                        {track.artist}
                      </td>
                      <td className={cn(cell, 'px-2')}>
                        <TrackFormatBadge track={track} suffix={isHiRes(track) ? ' Hi-Res' : undefined} />
                        {gain !== null && gain !== undefined && (
                          <Badge
                            tone="purple"
                            mono
                            className="ml-1.5"
                            title={`ReplayGain: ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB (Peak: ${track.replaygain_track_peak ? track.replaygain_track_peak.toFixed(3) : '1.0'})`}
                          >
                            RG {gain >= 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                          </Badge>
                        )}
                      </td>
                      <td className={cn(cell, 'px-2 font-mono text-xs text-fg-muted')}>
                        {Math.round(track.sample_rate / 1000)} kHz {track.bit_depth ? `/ ${track.bit_depth}-bit` : ''}
                      </td>
                      <td className={cn(cell, 'px-2 text-right font-mono')}>{formatTime(track.duration_ms)}</td>
                      <td className={cn(cell, 'px-1.5 text-center')}>
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
                      <td className={cn(cell, 'px-1 text-center')}>
                        <StarRating rating={track.rating} onRate={(stars) => handleSetTrackRating(track.id, stars)} loc={loc} />
                      </td>
                      <td className={cn(cell, 'px-1.5 text-center')}>
                        <div className="grid auto-rows-[1.25rem] grid-cols-[repeat(5,1.25rem)] content-center justify-center gap-0.5">
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
                          <TrackAction label={loc.library.tagEditorTooltip} tone="cyan" onClick={() => setTagEditorTrack(track)}>
                            <TagIcon size={15} />
                          </TrackAction>
                          <TrackAction label={loc.settings.scanReplayGainTrack} tone="purple" onClick={() => handleScanTrackReplayGain(track)}>
                            <Activity size={15} />
                          </TrackAction>
                          <TrackAction
                            label={loc.library.createStemProjectTooltip}
                            tone="pink"
                            onClick={() => {
                              setCreateStemProjectTrack(track);
                              setIsCreateStemProjectOpen(true);
                            }}
                          >
                            <Sliders size={15} />
                          </TrackAction>
                          <TrackAction label={loc.library.playNext} tone="purple" onClick={(e) => handleAddTrackNextToQueue(track, e)}>
                            <ListPlus size={15} />
                          </TrackAction>
                          <TrackAction
                            label={loc.library.addToPlaylist}
                            tone="amber"
                            onClick={() => {
                              setTrackToAddToPlaylist(track);
                              setShowPlaylistModal(true);
                            }}
                          >
                            <FolderPlus size={15} />
                          </TrackAction>
                          <TrackAction label={loc.player.trackStats} tone="amber" onClick={() => setStatsModalTrack(track)}>
                            <BarChart3 size={15} />
                          </TrackAction>
                          <TrackAction label={loc.library.openContainingFolder} tone="cyan" onClick={(e) => handleOpenContainingFolder(track.path, e)}>
                            <FolderOpen size={15} />
                          </TrackAction>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {trackBottomSpacer > 0 && (
                  <tr className="pointer-events-none" style={{ height: `${trackBottomSpacer}px` }}>
                    <td colSpan={9} className="border-0 p-0" style={{ height: `${trackBottomSpacer}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
