import { useMemo } from 'react';
import type { AppHeaderProps } from './AppHeader';
import type { useModalManager } from '../../hooks/useModalManager';
import type { useThemeManager } from '../../hooks/useThemeManager';
import type { Translations, Language } from '../../i18n';
import type { PlaybackQueue } from '../../types/queue';
import type { TrackRecord } from '../../types/library';
import type { MainTabType } from './AppNavbar';
import { soundscapeEngine } from '../../utils/soundscapeAudio';

export interface UseAppHeaderPropsOptions {
  appVersion: string;
  themeManager: ReturnType<typeof useThemeManager>;
  modalManager: ReturnType<typeof useModalManager>;
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  tracks: TrackRecord[];
  playlists: any[];
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
  ambienceMode: any;
  cycleAmbienceMode: () => void;
  setIsBigScreen: (big: boolean) => void;
  toggleMiniPlayer: () => void;
  isQueueOpen: boolean;
  setIsQueueOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppHeaderProps(options: UseAppHeaderPropsOptions): AppHeaderProps {
  const {
    appVersion,
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

  return useMemo<AppHeaderProps>(() => ({
    appVersion,
    appIconStyle: themeManager.appIconStyle,
    activeTab,
    onSelectTab: (tab) => setActiveTab(tab),
    trackCount: tracks.length,
    playlistCount: playlists.length,
    queueCount: queue.items.length,
    language,
    loc,
    onOpenRecap: () => modalManager.setIsRecapModalOpen(true),
    onOpenKeyBpm: () => modalManager.setIsKeyBpmModalOpen(true),
    onOpenAnalysis: () => modalManager.setIsAnalysisModalOpen(true),
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
    onOpenSoundscape: () => modalManager.setIsSoundscapeOpen(true),
    onOpenHarmonicSuggester: () => modalManager.setIsHarmonicSuggesterOpen(true),
    onOpenCommandPalette: () => modalManager.setIsCommandPaletteOpen(true),
    onOpenBigScreen: () => setIsBigScreen(true),
    uiScale: themeManager.uiScale,
    onIncreaseScale: themeManager.handleIncreaseScale,
    onDecreaseScale: themeManager.handleDecreaseScale,
    onToggleMiniPlayer: toggleMiniPlayer,
    isQueueOpen,
    onToggleQueue: () => setIsQueueOpen((prev) => !prev),
    isSettingsOpen: modalManager.isSettingsOpen,
    onOpenSettings: () => modalManager.setIsSettingsOpen(true),
    onLanguageChange: setLanguage,
  }), [
    appVersion,
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
    modalManager,
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
}
