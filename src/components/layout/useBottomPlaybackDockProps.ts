import type { AppTab } from '../../types/navigation';
import { useMemo } from 'react';
import type { BottomPlaybackDockProps } from './BottomPlaybackDock';
import type { usePlaybackController } from '../../hooks/usePlaybackController';
import type { useDspManager } from '../../hooks/useDspManager';
import type { PlaybackStatus, TrackRecord } from '../../types/player';
import type { PlaybackQueue } from '../../types/queue';
import type { Language, Translations } from '../../i18n';

export interface UseBottomPlaybackDockPropsOptions {
  activeTab: AppTab;
  isPlayerScrolledDown: boolean;
  status: PlaybackStatus;
  currentPlayingTrack: TrackRecord | null;
  filePath: string;
  language: Language;
  loc: Translations;
  effectiveDisplayTitle: string;
  effectiveDisplayArtist: string;
  currentCover: string | null;
  queue: PlaybackQueue;
  volumeProgressPercent: number;
  formatTime: (ms: number) => string;
  mainContentRef: React.RefObject<HTMLElement | null>;
  setActiveTab: (tab: AppTab) => void;
  handleOpenContainingFolder: (path: string, e: React.MouseEvent) => void;
  playbackController: ReturnType<typeof usePlaybackController>;
  dspManager: ReturnType<typeof useDspManager>;
  toggleMiniPlayer: () => void;
}

export function useBottomPlaybackDockProps(
  options: UseBottomPlaybackDockPropsOptions
): BottomPlaybackDockProps {
  const {
    activeTab,
    isPlayerScrolledDown,
    status,
    currentPlayingTrack,
    filePath,
    language,
    loc,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    currentCover,
    queue,
    volumeProgressPercent,
    formatTime,
    mainContentRef,
    setActiveTab,
    handleOpenContainingFolder,
    playbackController,
    dspManager,
    toggleMiniPlayer,
  } = options;

  const isVisible =
    (activeTab !== 'player' || isPlayerScrolledDown) &&
    Boolean(
      status.state === 'Playing' ||
      status.state === 'Paused' ||
      currentPlayingTrack ||
      status.current_track ||
      filePath
    );

  return useMemo<BottomPlaybackDockProps>(
    () => ({
      isVisible,
      activeTab,
      language,
      loc,
      status,
      currentPlayingTrack,
      effectiveDisplayTitle,
      effectiveDisplayArtist,
      currentCover,
      filePath,
      queue,
      volumeProgressPercent,
      formatTime,
      onScrollToTopOrSwitchTab: () => {
        if (activeTab === 'player') {
          mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setActiveTab('player');
        }
      },
      onOpenContainingFolder: handleOpenContainingFolder,
      onToggleShuffle: playbackController.handleToggleShuffle,
      onPrevious: playbackController.handlePrevious,
      onPlayPause: playbackController.handlePlayPause,
      onNext: playbackController.handleNext,
      onCycleLoopMode: playbackController.handleCycleLoopMode,
      onToggleStopAfterCurrent: playbackController.handleToggleStopAfterCurrent,
      onSeek: playbackController.handleSeek,
      onSeekPreview: playbackController.handleSeekPreview,
      onSeekCommit: playbackController.handleSeekCommit,
      onCycleDspEngine: dspManager.handleCycleDspEngine,
      onSelectDspEngine: dspManager.handleEngineChange,
      onToggleMute: playbackController.handleToggleMute,
      onVolumeChange: playbackController.handleVolumeChange,
      onToggleMiniPlayer: toggleMiniPlayer,
    }),
    [
      isVisible,
      activeTab,
      language,
      loc,
      status,
      currentPlayingTrack,
      effectiveDisplayTitle,
      effectiveDisplayArtist,
      currentCover,
      filePath,
      queue,
      volumeProgressPercent,
      formatTime,
      mainContentRef,
      setActiveTab,
      handleOpenContainingFolder,
      playbackController.handleToggleShuffle,
      playbackController.handlePrevious,
      playbackController.handlePlayPause,
      playbackController.handleNext,
      playbackController.handleCycleLoopMode,
      playbackController.handleToggleStopAfterCurrent,
      playbackController.handleSeek,
      playbackController.handleSeekPreview,
      playbackController.handleSeekCommit,
      playbackController.handleToggleMute,
      playbackController.handleVolumeChange,
      dspManager.handleCycleDspEngine,
      dspManager.handleEngineChange,
      toggleMiniPlayer,
    ]
  );
}
