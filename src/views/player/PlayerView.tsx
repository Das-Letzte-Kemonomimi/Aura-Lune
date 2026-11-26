import type { AppTab } from '../../types/navigation';
import React, { useCallback } from "react";
import { BarChart3,     FolderOpen,  Heart,                  } from "../../components/ui/icons";
import { LyricsView } from '../../components/player/LyricsView';
import {  type TapeType } from '../../components/player/TapeDeckWidget';
import { SpectrumVisualizer } from '../../components/player/SpectrumVisualizer';
import type { AlbumRecord, TrackRecord, PlaybackStatus } from '../../types/player';
import { type QueueItem, type PlaybackQueue, type QueueColumnConfig } from '../../types/queue';
import type { TrackBookmarkDto } from '../../types/player';
import type { DspCombinationInfo } from '../dsp/DspStudioView';
import { type Language, getTranslations } from '../../i18n';
import { useLiveStatus } from '../../state/livePlayback';
import { PlayerQueuePanel } from './sections/PlayerQueuePanel';
import { resolveQueueTrackMeta } from './queueTrackMeta';
import { PlayerDspMiniBar } from './sections/PlayerDspMiniBar';
import { PlayerTransportControls } from './sections/PlayerTransportControls';
import { PlayerProgressSection } from './sections/PlayerProgressSection';
import { PlayerQuickDspVibes } from './sections/PlayerQuickDspVibes';
import { PlayerVisualColumn } from './sections/PlayerVisualColumn';
import { PlayerToolbar } from './sections/PlayerToolbar';
import { cn } from '../../utils/cn';

export interface PlayerViewProps {
  layoutMaxWidth: string;
  language: Language;
  loc: ReturnType<typeof getTranslations>;
  status: PlaybackStatus;
  activeTrackId?: number | null;
  currentPlayingTrack?: TrackRecord | null;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  currentAlbum?: AlbumRecord | null;
  currentCover?: string | null;
  cleanLiveTitle?: string | null;
  effectiveDisplayTitle: string;
  effectiveDisplayArtist: string;
  filePath: string | null;
  setFilePath: (p: any) => void;
  volumeProgressPercent: number;
  volumeUnit: "percent" | "db";
  formatVolumeValue: (vol: number, unit?: "percent" | "db") => string;
  handleToggleVolumeUnit: () => void;
  seekFadeEnabled: boolean;
  handleToggleSeekFade: () => void;
  infinityQueue: boolean;
  handleToggleInfinityQueue: () => void;
  sleepTimerRemainingSec: number | null;
  sleepTimerTargetMode: "time" | "end_of_track" | null;
  setIsSleepTimerOpen: (v: boolean) => void;
  setIsAudioPathModalOpen: (v: boolean) => void;
  setIsLoFiModalOpen: (v: boolean) => void;
  setIsShortcutsModalOpen: (v: boolean) => void;
  setIsLoopEditorOpen: (v: boolean) => void;
  setIsBookmarksModalOpen: (v: boolean) => void;
  setIsSaveQueueModalOpen: (v: boolean) => void;
  setStatsModalTrack: (t: TrackRecord | null) => void;
  setActiveTab: (tab: AppTab) => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean | ((p: boolean) => boolean)) => void;
  nowPlayingVisualMode: "cover" | "turntable" | "tape" | "vumeter";
  handleSelectNowPlayingVisualMode: (m: "cover" | "turntable" | "tape" | "vumeter") => void;
  vinylRpm: 33 | 45;
  handleSelectVinylRpm: (rpm: 33 | 45) => void;
  tapeSpeed: "7.5" | "3.75";
  handleSelectTapeSpeed: (s: "7.5" | "3.75") => void;
  tapeType: TapeType;
  handleSelectTapeType: (t: TapeType) => void;
  activeDspVibe: "nightcore" | "slowed" | "vocal" | "bass" | "flat" | null;
  handleApplyDspVibe: (v: "nightcore" | "slowed" | "vocal" | "bass" | "flat") => void | Promise<void>;
  dspBadgeText: string;
  dspBadgeTitle: string;
  dspCombination: DspCombinationInfo;
  lastActiveDspEngineRef: React.MutableRefObject<string>;
  trackWaveformPeaks: number[] | null;
  loopPointA: number | null;
  setLoopPointA: (v: number | null) => void;
  loopPointB: number | null;
  setLoopPointB: (v: number | null) => void;
  currentBookmark: number | null;
  currentTrackBookmarks: TrackBookmarkDto[];
  handleSaveBookmark: () => void | Promise<void>;
  handleDeleteBookmark: (e?: React.MouseEvent) => void | Promise<void>;
  handleJumpToBookmark: (pos: number) => void | Promise<void>;
  queue: PlaybackQueue;
  filteredQueueItems: { it: QueueItem; originalIdx: number }[];
  queueSearchQuery: string;
  setQueueSearchQuery: (q: string) => void;
  queueColumns: QueueColumnConfig;
  isColumnConfigOpen: boolean;
  setIsColumnConfigOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  toggleQueueColumn: (key: keyof QueueColumnConfig) => void;
  resetQueueColumns: () => void;
  isQuickLoadOpen: boolean;
  setIsQuickLoadOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  draggedQueueIdx: number | null;
  dragOverQueueIdx: number | null;
  handleQueueDragStart: (idx: number, e: React.DragEvent) => void;
  handleQueueDragOver: (idx: number, e: React.DragEvent) => void;
  handleQueueDrop: (idx: number, e: React.DragEvent) => void;
  handleMoveQueueItem: (from: number, to: number, e?: React.MouseEvent) => void | Promise<void>;
  handlePlayQueueIndex: (idx: number, item?: QueueItem) => void;
  handleRemoveFromQueue: (id: string, e?: React.MouseEvent) => void | Promise<void>;
  handleClearQueue: () => void;
  totalQueueDurationMs: number;
  formatTotalDuration: (ms: number) => string;
  queueListRef: React.RefObject<HTMLDivElement | null>;
  queueStartIndex: number;
  queueEndIndex: number;
  queueTopSpacer: number;
  queueBottomSpacer: number;
  handleSeek: (ms: number) => void;
  handleSeekPreview?: (ms: number) => void;
  handleSeekCommit?: (ms: number) => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  handlePrevious: () => void;
  handleNext: () => void;
  handleToggleShuffle: () => void;
  handleCycleLoopMode: () => void;
  handleToggleStopAfterCurrent: () => void;
  handleToggleMute: () => void;
  handleVolumeChange: (vol: number) => void;
  handlePitchChange: (st: number) => void;
  handleTempoChange: (t: number) => void;
  handleEngineChange: (engine: any) => void;
  handleToggleFavorite: (trackId: number, e?: React.MouseEvent) => void;
  handleOpenContainingFolder: (path: string, e?: React.MouseEvent) => void;
  handleOpenCoverPicker: (album: AlbumRecord) => void;
  handleUploadCustomCoverDirect: (album?: AlbumRecord | null) => void;
  handleRestoreOriginalTrack: () => void;
  handleLoadFile: (path: string) => void | Promise<void>;
  handlePickFiles: () => void;
  formatTime: (ms: number) => string;
  formatTimeMs: (ms: number) => string;
  showMessage: (msg: string, isError?: boolean) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = React.memo((props) => {
  const {
    layoutMaxWidth,
    language,
    loc,
    status: statusProp,
    currentPlayingTrack,
    tracks,
    albums,
    currentAlbum,
    cleanLiveTitle,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    filePath,
    setStatsModalTrack,
    showLyrics,
    setShowLyrics,
    nowPlayingVisualMode,
    handleSeek,
    handleToggleFavorite,
    handleOpenContainingFolder,
  } = props;
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const status = useLiveStatus(statusProp);
  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;
  const t = loc;

  const getQueueTrackMeta = useCallback(
    (item: QueueItem) => resolveQueueTrackMeta(item, tracks, albums),
    [tracks, albums]
  );

  return (
            <div className="mx-auto my-0 flex flex-col gap-5 pb-8" style={{ maxWidth: layoutMaxWidth }}>
              <div className="glass-panel flex flex-col gap-5 px-7 py-6">
                {/* Top toolbar: audio engine and a discreet open-file button */}
                <PlayerToolbar {...props} status={statusProp} />

                {/* Main player deck: 2-column layout (cover/vinyl + controls & spectrogram) */}
                <div
                  className={cn(
                    'grid items-center gap-6.5 transition-[grid-template-columns] duration-200',
                    nowPlayingVisualMode === 'cover' ? 'grid-cols-[--spacing(60)_1fr]' : 'grid-cols-[--spacing(69)_1fr]',
                  )}
                >
                  {/* Left column: cover / vinyl / tape / VU meter */}
                  <PlayerVisualColumn {...props} status={status} />

                  {/* Right column: title, artist, spectrogram, seeker and buttons */}
                  <div className="flex min-w-0 flex-col gap-3.5">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            status.state === 'Playing' ? 'shadow-halo-sm shadow-accent-green' : 'shadow-none',
                            status.state === 'Playing' ? 'bg-accent-green' : status.state === 'Paused' ? 'bg-accent-amber' : 'bg-fg-muted',
                          )}
                        />
                        <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
                          {status.state === 'Playing' ? loc.player.statePlaying : status.state === 'Paused' ? loc.player.statePaused : loc.player.stateStopped}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="m-0 truncate text-2xl font-extrabold tracking-tight text-fg">
                            {effectiveDisplayTitle}
                          </h3>
                          <p className="mx-0 mt-1 mb-0 truncate text-sm font-semibold text-accent-pink">
                            {effectiveDisplayArtist} {currentAlbum?.title || status.current_track?.album ? `• ${currentAlbum?.title || status.current_track?.album}` : ''}
                          </p>
                          {cleanLiveTitle && (
                            <div
                              className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border border-pink-500/35 bg-pink-500/15 px-2.5 py-1 text-ui font-semibold text-accent-pink"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-halo-sm shadow-red-500" />
                              <span>LIVE: {cleanLiveTitle}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => {
                              if (currentPlayingTrack) {
                                setStatsModalTrack(currentPlayingTrack);
                              } else if (status.current_track) {
                                setStatsModalTrack({
                                  id: status.current_track.track_id || 0,
                                  title: status.current_track.title || (filePath ? filePath.split('/').pop() || 'Auralune Audio Player' : 'Auralune Audio Player'),
                                  artist: status.current_track.artist || loc.player.unknownArtist,
                                  album_artist: status.current_track.artist || null, album_id: null, disc_no: null, track_no: null, bit_depth: null, file_size: 0, modified_time: 0,
                                  path: status.current_track.uri || filePath || '',
                                  duration_ms: status.duration_ms || 0,
                                  format: 'AUDIO',
                                  sample_rate: 44100,
                                  channels: 2,
                                  play_count: 0,
                                  last_played_at: null,
                                });
                              }
                            }}
                            title={loc.player.trackStats}
                            className="flex items-center gap-1.5 rounded-lg border border-accent-amber/35 bg-accent-amber/15 px-3 py-1.5 text-ui font-semibold text-accent-amber transition-all duration-200"
                          >
                            <BarChart3 size={16} />
                            <span>{currentPlayingTrack?.play_count || 0} {loc.player.plays}</span>
                          </button>

                          {currentPlayingTrack && (
                            <button
                              onClick={(e) => handleToggleFavorite(currentPlayingTrack.id, e)}
                              title={currentPlayingTrack.is_favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
                              className={cn(
                                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-ui font-semibold transition-all duration-200',
                                currentPlayingTrack.is_favorite ? 'border-accent-pink bg-accent-pink/20 text-accent-pink' : 'border-line bg-white/6 text-fg-muted',
                              )}
                            >
                              <Heart className={cn(currentPlayingTrack.is_favorite && 'fill-accent-pink')} size={16} />
                              {currentPlayingTrack.is_favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
                            </button>
                          )}

                          {(currentPlayingTrack?.path || status.current_track?.uri || filePath) && (
                            <button
                              onClick={(e) =>
                                handleOpenContainingFolder(
                                  currentPlayingTrack?.path || status.current_track?.uri || filePath || '',
                                  e
                                )
                              }
                              title={loc.queue.openContainingFolder}
                              className="flex items-center gap-1.5 rounded-lg border border-accent-cyan/35 bg-accent-cyan/15 px-3 py-1.5 text-ui font-semibold text-accent-cyan transition-all duration-200"
                            >
                              <FolderOpen size={15} />
                              <span>Dolphin</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live animated canvas spectrum visualizer */}
                    <SpectrumVisualizer
                      spectrum={status.spectrum}
                      isPlaying={status.state === 'Playing'}
                    />

                    {/* Quick DSP vibe profiles (Quick DSP Vibes) */}
                    <PlayerQuickDspVibes {...props} t={t} />

                    {/* Progress bar with the A-B loop and the track waveform */}
                    <PlayerProgressSection {...props} status={status} seekProgressPercent={seekProgressPercent} />

                    {/* Playback control buttons */}
                    <PlayerTransportControls {...props} status={statusProp} />
                  </div>
                </div>

                {/* Integrated DSP mini bar */}
                <PlayerDspMiniBar {...props} status={statusProp} />
              </div>

              {/* Synced lyrics section (LRC & LRCLIB) */}
              {showLyrics && (
                <div className="mb-1 h-105 w-full">
                  <LyricsView
                    trackTitle={effectiveDisplayTitle}
                    trackArtist={effectiveDisplayArtist}
                    trackAlbum={currentAlbum?.title || status.current_track?.album || null}
                    trackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || null}
                    durationSec={status.duration_ms ? status.duration_ms / 1000 : null}
                    currentPositionMs={status.position_ms}
                    currentLang={language}
                    onSeek={handleSeek}
                    onClose={() => setShowLyrics(false)}
                  />
                </div>
              )}

              {/* Playback queue section with column configuration */}
              <PlayerQueuePanel {...props} status={statusProp} t={t} getQueueTrackMeta={getQueueTrackMeta} />
            </div>
  );
});
