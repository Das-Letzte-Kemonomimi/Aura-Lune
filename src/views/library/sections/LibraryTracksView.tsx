import React from 'react';
import { Activity, BarChart3, Clock, FileCode, FilePlus, Flame, FolderOpen, FolderPlus, Heart, ListPlus, Moon, Music, Play, Plus, Sliders, Sparkles, Star, Tag as TagIcon, Zap } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

export type LibraryTracksViewProps = Pick<LibraryViewProps, 'loc' | 'smartPlaylistFilter' | 'setSmartPlaylistFilter' | 'setIsCueModalOpen' | 'sortedTracks' | 'tracks' | 'sortField' | 'sortOrder' | 'librarySearch' | 'handlePlayLibraryTrack' | 'refreshQueue' | 'showMessage' | 'libraryTableRef' | 'handleSort' | 'handlePickFolder' | 'handlePickFiles' | 'setLibrarySearch' | 'trackTopSpacer' | 'trackStartIndex' | 'trackEndIndex' | 'activeTrackId' | 'currentPlayingTrack' | 'status' | 'formatTime' | 'setStatsModalTrack' | 'handleSetTrackRating' | 'handleToggleFavorite' | 'handleAddTrackToQueue' | 'setTagEditorTrack' | 'handleScanTrackReplayGain' | 'setCreateStemProjectTrack' | 'setIsCreateStemProjectOpen' | 'handleAddTrackNextToQueue' | 'setTrackToAddToPlaylist' | 'setShowPlaylistModal' | 'handleOpenContainingFolder' | 'trackBottomSpacer'> & {
  t: LibraryViewProps['loc'];
};

type SmartTone = 'purple' | 'pink' | 'amber' | 'cyan';

/** Selected smart-collection chip: accent border and a soft glow in the chip's colour. */
const SMART_TONES: Record<SmartTone, string> = {
  purple: 'aria-pressed:border-accent-purple aria-pressed:shadow-accent-purple/25',
  pink: 'aria-pressed:border-accent-pink aria-pressed:shadow-accent-pink/25',
  amber: 'aria-pressed:border-accent-amber aria-pressed:shadow-accent-amber/25',
  cyan: 'aria-pressed:border-accent-cyan aria-pressed:shadow-accent-cyan/25',
};

const SMART_ICON_TONES: Record<SmartTone, string> = {
  purple: 'group-aria-pressed:text-accent-purple',
  pink: 'group-aria-pressed:text-accent-pink',
  amber: 'group-aria-pressed:text-accent-amber',
  cyan: 'group-aria-pressed:text-accent-cyan',
};

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
}) => (
    <div>
      {/* Smart Playlists */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-fg-muted">{loc.library.collection}</span>
        {[
          { id: 'all', label: loc.library.smartAll, icon: Music, tone: 'purple' },
          { id: 'favorites', label: loc.library.smartFavorites, icon: Heart, tone: 'pink' },
          { id: 'top_rated', label: loc.library.quickVibeTopRated, icon: Star, tone: 'amber' },
          { id: 'history', label: loc.library.smartHistory, icon: Clock, tone: 'cyan' },
          { id: 'top_played', label: loc.library.smartTopPlayed, icon: Flame, tone: 'amber' },
          { id: 'hires', label: loc.library.smartHiRes, icon: Sparkles, tone: 'purple' },
          { id: 'high_bpm', label: loc.library.quickVibeFastBpm, icon: Zap, tone: 'pink' },
          { id: 'forgotten', label: loc.library.quickVibeForgotten, icon: Moon, tone: 'cyan' },
        ].map((item) => {
          const isSelected = smartPlaylistFilter === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSmartPlaylistFilter(item.id as any)}
              aria-pressed={isSelected}
              className={cn(
                'group flex items-center gap-1.5 rounded-3xl border border-line bg-white/4 px-3 py-1.5 text-xs font-semibold text-fg-secondary transition-all duration-150 aria-pressed:bg-white/10 aria-pressed:text-fg aria-pressed:shadow-halo-sm',
                SMART_TONES[item.tone as SmartTone],
              )}
            >
              <Icon size={13} className={cn('text-fg-muted', SMART_ICON_TONES[item.tone as SmartTone])} fill={item.id === 'favorites' && isSelected ? 'currentColor' : 'none'} />
              {item.label}
            </button>
          );
        })}

        <button
          onClick={() => setIsCueModalOpen(true)}
          className="ml-auto flex items-center gap-1.5 rounded-3xl border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs font-semibold text-accent-purple"
          title={loc.library.cueSheetOpenTooltip}
        >
          <FileCode size={13} />
          {loc.library.cueSheetBtn}
        </button>
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
        {sortedTracks.length > 0 && (sortField !== 'default' || sortOrder !== 'asc' || librarySearch.trim() !== '' || smartPlaylistFilter !== 'all') && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (sortedTracks.length > 0) {
                  handlePlayLibraryTrack(sortedTracks[0], sortedTracks);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-3.5 py-1.5 text-ui font-semibold text-on-accent"
            >
              <Play size={14} /> {loc.library.playSorted}
            </button>
            <button
              onClick={async () => {
                if (sortedTracks.length > 0) {
                  await invoke('add_uris_to_queue', { uris: sortedTracks.map((t) => t.path) });
                  await refreshQueue();
                  showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(sortedTracks.length)));
                }
              }}
              className="flex items-center gap-1 rounded-lg border-0 bg-white/8 px-2.5 py-1.5 text-ui font-semibold text-accent-cyan"
              title={loc.library.addToQueue}
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table ref={libraryTableRef} className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ink/95 backdrop-blur-md">
            <tr className="h-10.5 border-b border-line text-fg-muted">
              <th
                onClick={() => handleSort('default')}
                className="w-11.5 cursor-pointer select-none px-1.5 py-2.5 text-center"
                title={loc.library.sortDefaultTooltip}
              >
                # {sortField === 'default' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('title')}
                className="w-[28%] cursor-pointer select-none p-2.5"
                title={loc.library.sortTitleTooltip}
              >
                {loc.library.sortTitle} {sortField === 'title' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('artist')}
                className="w-1/5 cursor-pointer select-none p-2.5"
                title={loc.library.sortArtistTooltip}
              >
                {loc.library.sortArtist} {sortField === 'artist' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('format')}
                className="w-27.5 cursor-pointer select-none px-2 py-2.5"
                title={loc.library.sortFormatTooltip}
              >
                {loc.library.sortFormat} {sortField === 'format' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="w-29 px-2 py-2.5">{loc.library.quality}</th>
              <th
                onClick={() => handleSort('duration')}
                className="w-19 cursor-pointer select-none px-2 py-2.5 text-right"
                title={loc.library.sortDurationTooltip}
              >
                {loc.queue.duration} {sortField === 'duration' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('plays')}
                className="w-19 cursor-pointer select-none px-1.5 py-2.5 text-center"
                title={loc.library.sortPlaysTooltip}
              >
                {loc.library.playsCol} {sortField === 'plays' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="w-24 px-1.5 py-2.5 text-center">
                {loc.library.rating}
              </th>
              <th className="w-34 px-1.5 py-2.5 text-center">{loc.library.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedTracks.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-9 text-center text-fg-muted">
                  {tracks.length === 0 ? (
                    <div className="flex flex-col items-center gap-3.5 px-3 py-6">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-full border border-accent-purple bg-accent-purple/15"
                      >
                        <FolderPlus size={28} className="text-accent-purple" />
                      </div>
                      <div>
                        <h4 className="mx-0 mt-0 mb-1.5 text-base font-bold text-fg">
                          {loc.library.empty}
                        </h4>
                        <p className="m-0 text-ui text-fg-secondary">
                          {loc.library.emptyHint}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2.5">
                        <button
                          onClick={handlePickFolder}
                          className="flex items-center gap-1.5 rounded-lg border-0 bg-linear-135 from-accent-purple to-accent-pink px-4 py-2 text-ui font-semibold text-on-accent"
                        >
                          <FolderPlus size={14} /> {loc.library.addFolder}...
                        </button>
                        <button
                          onClick={handlePickFiles}
                          className="flex items-center gap-1.5 rounded-lg border border-line-accent bg-white/8 px-4 py-2 text-ui font-semibold text-fg"
                        >
                          <FilePlus size={14} className="text-accent-cyan" /> {loc.library.addFiles}...
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <span>{fmt(loc.library.emptySearchTracks, librarySearch)}</span>
                      <button
                        onClick={() => setLibrarySearch('')}
                        className="rounded-md border border-line bg-white/8 px-3 py-1.5 text-ui text-accent-cyan"
                      >
                        {loc.library.clearSearch}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              <>
                {trackTopSpacer > 0 && (
                  <tr className="pointer-events-none" style={{ height: `${trackTopSpacer}px` }}>
                    <td colSpan={9} className="border-0 p-0"
                    style={{ height: `${trackTopSpacer}px` }} />
                  </tr>
                )}
                {sortedTracks.slice(trackStartIndex, trackEndIndex).map((t, localIdx) => {
                  const idx = trackStartIndex + localIdx;
                  const isCurrent = (activeTrackId != null && activeTrackId === t.id) || (currentPlayingTrack != null && currentPlayingTrack.id === t.id);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => handlePlayLibraryTrack(t)}
                      className={cn(
                        'glass-card h-12 max-h-12 cursor-pointer border-b border-white/3',
                        isCurrent ? 'bg-accent-purple/20' : 'bg-transparent',
                      )}
                    >
                      <td
                        className="h-12 max-h-12 truncate px-2 py-0 text-center align-middle font-mono text-fg-muted"
                        title={t.track_no ? `#${idx + 1} (Track ${t.track_no})` : `#${idx + 1}`}
                      >
                        {isCurrent ? (
                          status.state === 'Playing' ? (
                            <Zap size={14} className="text-accent-pink" />
                          ) : (
                            <Play size={13} className="text-accent-pink fill-accent-pink" />
                          )
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className={cn(
                        'h-12 max-h-12 truncate px-2.5 py-0 align-middle font-semibold',
                        isCurrent ? 'text-accent-pink' : 'text-fg',
                      )}>
                        <div className="flex items-center gap-1.5 truncate">
                          {t.is_favorite && <Heart size={13} className="shrink-0 text-accent-pink fill-accent-pink" />}
                          <span className="truncate" title={t.title}>{t.title}</span>
                        </div>
                      </td>
                      <td className="h-12 max-h-12 truncate px-2.5 py-0 align-middle text-fg-secondary" title={t.artist}>
                        {t.artist}
                      </td>
                      <td className="h-12 max-h-12 truncate px-2 py-0 align-middle">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 font-mono text-xxs font-semibold',
                            (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'bg-accent-cyan/20' : 'bg-white/8',
                            (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'text-accent-cyan' : 'text-inherit',
                            (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'border border-accent-cyan/35' : 'border-0',
                          )}
                        >
                          {t.format}
                          {(t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? ' Hi-Res' : ''}
                        </span>
                        {t.replaygain_track_gain !== null && t.replaygain_track_gain !== undefined && (
                          <span
                            className="ml-1.5 rounded-sm border border-accent-purple/40 bg-accent-purple/20 px-1.5 py-0.5 font-mono text-xxs font-bold text-accent-purple"
                            title={`ReplayGain: ${t.replaygain_track_gain >= 0 ? '+' : ''}${t.replaygain_track_gain.toFixed(1)} dB (Peak: ${t.replaygain_track_peak ? t.replaygain_track_peak.toFixed(3) : '1.0'})`}
                          >
                            RG {t.replaygain_track_gain >= 0 ? `+${t.replaygain_track_gain.toFixed(1)}` : t.replaygain_track_gain.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="h-12 max-h-12 truncate px-2 py-0 align-middle font-mono text-xs text-fg-muted">
                        {Math.round(t.sample_rate / 1000)} kHz {t.bit_depth ? `/ ${t.bit_depth}-bit` : ''}
                      </td>
                      <td className="h-12 max-h-12 truncate px-2 py-0 text-right align-middle font-mono">
                        {formatTime(t.duration_ms)}
                      </td>
                      <td
                        className="h-12 max-h-12 truncate px-1.5 py-0 text-center align-middle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatsModalTrack(t);
                        }}
                        title={loc.player.trackStats}
                      >
                        <span
                          className={cn(
                            'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2 py-1 font-mono text-xs font-bold transition-all duration-150',
                            t.play_count ? 'bg-accent-amber/15' : 'bg-white/4',
                            t.play_count ? 'text-accent-amber' : 'text-fg-muted',
                            t.play_count ? 'border-accent-amber/35' : 'border-transparent',
                          )}
                        >
                          <Flame className={cn(t.play_count ? 'text-accent-amber' : 'text-fg-muted')} size={12} />
                          {t.play_count || 0}
                        </span>
                      </td>
                      <td
                        className="h-12 max-h-12 truncate px-1 py-0 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const active = (t.rating || 0) >= star;
                            return (
                              <button
                                key={star}
                                onClick={() => handleSetTrackRating(t.id, t.rating === star ? 0 : star)}
                                className={cn(
                                  'flex items-center border-0 bg-transparent p-px transition-transform duration-100',
                                  active ? 'text-accent-amber' : 'text-white/15',
                                )}
                                title={fmt(loc.library.ratingTooltip, String(star))}
                              >
                                <Star size={12} fill={active ? '#f59e0b' : 'none'} />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="h-12 max-h-12 truncate px-1.5 py-0 text-center align-middle">
                        <div className="grid grid-cols-[repeat(5,1.25rem)] content-center justify-center gap-0.5 *:flex *:items-center *:justify-center *:p-0.5 auto-rows-[1.25rem]">
                          <button
                            onClick={(e) => handleToggleFavorite(t.id, e)}
                            title={t.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                            className={cn(
                              'border-0 bg-transparent',
                              t.is_favorite ? 'text-accent-pink' : 'text-fg-muted',
                            )}
                          >
                            <Heart className={cn(t.is_favorite && 'fill-accent-pink')} size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePlayLibraryTrack(t); }}
                            title={loc.player.play}
                            className="border-0 bg-transparent text-accent-pink"
                          >
                            <Play size={15} />
                          </button>
                          <button
                            onClick={(e) => handleAddTrackToQueue(t, e)}
                            title={loc.library.addToQueue}
                            className="border-0 bg-transparent text-accent-cyan"
                          >
                            <Plus size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTagEditorTrack(t); }}
                            title={loc.library.tagEditorTooltip}
                            className="border-0 bg-transparent text-accent-cyan"
                          >
                            <TagIcon size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleScanTrackReplayGain(t); }}
                            title={loc.settings.scanReplayGainTrack}
                            className="border-0 bg-transparent text-accent-purple"
                          >
                            <Activity size={15} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateStemProjectTrack(t);
                              setIsCreateStemProjectOpen(true);
                            }}
                            title={loc.library.createStemProjectTooltip}
                            className="border-0 bg-transparent text-accent-pink"
                          >
                            <Sliders size={15} />
                          </button>
                          <button
                            onClick={(e) => handleAddTrackNextToQueue(t, e)}
                            title={loc.library.playNext}
                            className="border-0 bg-transparent text-accent-purple"
                          >
                            <ListPlus size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTrackToAddToPlaylist(t); setShowPlaylistModal(true); }}
                            title={loc.library.addToPlaylist}
                            className="border-0 bg-transparent text-accent-amber"
                          >
                            <FolderPlus size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setStatsModalTrack(t); }}
                            title={loc.player.trackStats}
                            className="border-0 bg-transparent text-accent-amber"
                          >
                            <BarChart3 size={15} />
                          </button>
                          <button
                            onClick={(e) => handleOpenContainingFolder(t.path, e)}
                            title={loc.library.openContainingFolder}
                            className="border-0 bg-transparent text-accent-cyan"
                          >
                            <FolderOpen size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {trackBottomSpacer > 0 && (
                  <tr className="pointer-events-none" style={{ height: `${trackBottomSpacer}px` }}>
                    <td colSpan={9} className="border-0 p-0"
                    style={{ height: `${trackBottomSpacer}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
);
