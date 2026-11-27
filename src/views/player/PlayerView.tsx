import type { AppTab } from '../../types/navigation';
import React, { useCallback } from "react";
import { LyricsView } from '../../components/player/LyricsView';
import type { TapeType } from '../../components/player/TapeDeckWidget';
import { SpectrumVisualizer } from '../../components/player/SpectrumVisualizer';
import type { AlbumRecord, DspEngineType, TrackRecord, PlaybackStatus } from '../../types/player';
import type { SpectralBandTriple } from '../../types/analysis';
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
import { PlayerTrackHeader } from './sections/PlayerTrackHeader';
import { Card } from '../../components/ui';

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
  setFilePath: (p: string) => void;
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
  lastActiveDspEngineRef: React.MutableRefObject<'RubberBand' | 'SoundTouch'>;
  trackWaveformPeaks: number[] | null;
  trackWaveformBands?: SpectralBandTriple[] | null;
  isWaveformLoading?: boolean;
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
  handleEngineChange: (engine: DspEngineType) => void;
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
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    filePath,
    showLyrics,
    setShowLyrics,
    handleSeek,
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
              <Card variant="panel" padding="lg" className="flex flex-col gap-5">
                {/* Top toolbar: audio engine and a discreet open-file button */}
                <PlayerToolbar {...props} status={statusProp} />

                {/* Main player deck: 2-column layout (fixed visual stage width + controls & spectrogram) */}
                <div className="grid grid-cols-[--spacing(69)_minmax(0,1fr)] items-center gap-6.5">
                  {/* Left column: cover / vinyl / tape / VU meter */}
                  <PlayerVisualColumn {...props} status={status} />

                  {/* Right column: title, artist, spectrogram, seeker and buttons */}
                  <div className="flex min-w-0 flex-col gap-3.5">
                    <PlayerTrackHeader {...props} status={statusProp} />

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
              </Card>

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
