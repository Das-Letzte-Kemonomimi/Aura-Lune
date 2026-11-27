import { useMemo } from 'react';
import { useShallowMemo } from '../../hooks/useShallowMemo';
import type { AppHeaderProps } from './AppHeader';
import type { useModalManager } from '../../hooks/useModalManager';
import type { useThemeManager } from '../../hooks/useThemeManager';
import type { Translations, Language } from '../../i18n';
import type { PlaybackQueue } from '../../types/queue';
import type { TrackRecord } from '../../types/library';
import type { MainTabType } from './AppNavbar';
import type { Playlist } from '../../types/playlist';
import type { AmbienceMode } from '../player/AnimeAmbienceFX';
import { soundscapeEngine } from '../../utils/soundscapeAudio';

export interface UseAppHeaderPropsOptions {
  appVersion: string;
  updateAvailable: boolean;
  updateTitle: string;
  onOpenUpdates: () => void;
  themeManager: ReturnType<typeof useThemeManager>;
  modalManager: ReturnType<typeof useModalManager>;
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  tracks: TrackRecord[];
  playlists: Playlist[];
  queue: PlaybackQueue;
  language: Language;
  setLanguage: (lang: Language) => void;
  loc: Translations;
  sleepTimerRemainingSec: number | null;
  sleepTimerTargetMode: 'time' | 'end_of_track' | null;
  setIsSleepTimerOpen: (open: boolean) => void;
  showLyrics: boolean;
  setShowLyrics: React.Dispatch<React.SetStateAction<boolean>>;
  showDesktopLyrics: boolean;
  toggleDesktopLyrics: () => void;
  ambienceMode: AmbienceMode;
  cycleAmbienceMode: () => void;
  setIsBigScreen: (big: boolean) => void;
  toggleMiniPlayer: () => void;
  isQueueOpen: boolean;
  setIsQueueOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppHeaderProps(options: UseAppHeaderPropsOptions): AppHeaderProps {
  const {
    appVersion,
    updateAvailable,
    updateTitle,
    onOpenUpdates,
    themeManager,
    modalManager,
    activeTab,
    setActiveTab,
    tracks,
    playlists,
    queue,
    language,
    setLanguage,
    loc,
    sleepTimerRemainingSec,
    sleepTimerTargetMode,
    setIsSleepTimerOpen,
    showLyrics,
    setShowLyrics,
    showDesktopLyrics,
    toggleDesktopLyrics,
    ambienceMode,
    cycleAmbienceMode,
    setIsBigScreen,
    toggleMiniPlayer,
    isQueueOpen,
    setIsQueueOpen,
  } = options;

  const {
    isSettingsOpen,
    setIsSettingsOpen,
    setIsRecapModalOpen,
    setIsKeyBpmModalOpen,
    setIsAnalysisModalOpen,
    setIsSoundscapeOpen,
    setIsHarmonicSuggesterOpen,
    setIsCommandPaletteOpen,
  } = modalManager;

  const props = useMemo<AppHeaderProps>(() => ({
    appVersion,
    updateAvailable,
    updateTitle,
    onOpenUpdates,
    appIconStyle: themeManager.appIconStyle,
    activeTab,
    onSelectTab: (tab) => setActiveTab(tab),
    trackCount: tracks.length,
    playlistCount: playlists.length,
    queueCount: queue.items.length,
    language,
    loc,
    onOpenRecap: () => setIsRecapModalOpen(true),
    onOpenKeyBpm: () => setIsKeyBpmModalOpen(true),
    onOpenAnalysis: () => setIsAnalysisModalOpen(true),
    onOpenSleepTimer: () => setIsSleepTimerOpen(true),
    sleepTimerRemainingSec,
    sleepTimerTargetMode,
    showLyrics,
    onToggleLyrics: () => setShowLyrics((prev) => !prev),
    showDesktopLyrics,
    onToggleDesktopLyrics: toggleDesktopLyrics,
    ambienceMode,
    onCycleAmbience: cycleAmbienceMode,
    isSoundscapeActive: soundscapeEngine.isSoundscapeActive(),
    onOpenSoundscape: () => setIsSoundscapeOpen(true),
    onOpenHarmonicSuggester: () => setIsHarmonicSuggesterOpen(true),
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    onOpenBigScreen: () => setIsBigScreen(true),
    uiScale: themeManager.uiScale,
    onIncreaseScale: themeManager.handleIncreaseScale,
    onDecreaseScale: themeManager.handleDecreaseScale,
    onToggleMiniPlayer: toggleMiniPlayer,
    isQueueOpen,
    onToggleQueue: () => setIsQueueOpen((prev) => !prev),
    isSettingsOpen,
    onOpenSettings: () => setIsSettingsOpen(true),
    onLanguageChange: setLanguage,
  }), [
    appVersion,
    updateAvailable,
    updateTitle,
    onOpenUpdates,
    themeManager.appIconStyle,
    themeManager.uiScale,
    themeManager.handleIncreaseScale,
    themeManager.handleDecreaseScale,
    activeTab,
    setActiveTab,
    tracks.length,
    playlists.length,
    queue.items.length,
    language,
    setLanguage,
    loc,
    isSettingsOpen,
    setIsSettingsOpen,
    setIsRecapModalOpen,
    setIsKeyBpmModalOpen,
    setIsAnalysisModalOpen,
    setIsSoundscapeOpen,
    setIsHarmonicSuggesterOpen,
    setIsCommandPaletteOpen,
    sleepTimerRemainingSec,
    sleepTimerTargetMode,
    setIsSleepTimerOpen,
    showLyrics,
    setShowLyrics,
    showDesktopLyrics,
    toggleDesktopLyrics,
    ambienceMode,
    cycleAmbienceMode,
    setIsBigScreen,
    toggleMiniPlayer,
    isQueueOpen,
    setIsQueueOpen,
  ]);

  return useShallowMemo(props);
}
