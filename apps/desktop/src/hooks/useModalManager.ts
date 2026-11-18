import { useState, useCallback } from 'react';
import type { TrackRecord } from '../types/player';
import type { TrackStatsData } from '../components/TrackStatsModal';

export type SettingsTab = 'themes' | 'devices' | 'transcode' | 'about' | 'changelog' | 'backup';
export type AnalysisTab = 'chords' | 'pianoroll' | 'stems' | 'projects' | 'models';

export interface CoverPickerState {
  isOpen: boolean;
  albumId: number;
  title: string;
  artist: string;
}

export function useModalManager() {
  // Modal visibility states
  const [isSaveQueueModalOpen, setIsSaveQueueModalOpen] = useState(false);
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('themes');
  const [showDownloadHub, setShowDownloadHub] = useState<boolean>(false);
  const [isQuickLoadOpen, setIsQuickLoadOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_onboarding_completed') !== 'true';
    } catch {
      return false;
    }
  });
  const [isRecapModalOpen, setIsRecapModalOpen] = useState<boolean>(false);
  const [isKeyBpmModalOpen, setIsKeyBpmModalOpen] = useState<boolean>(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
  const [analysisInitialTab, setAnalysisInitialTab] = useState<AnalysisTab>('chords');
  const [isStemStudioOpen, setIsStemStudioOpen] = useState<boolean>(false);
  const [activeStemProjectId, setActiveStemProjectId] = useState<number | null>(null);
  const [isCreateStemProjectOpen, setIsCreateStemProjectOpen] = useState<boolean>(false);
  const [createStemProjectTrack, setCreateStemProjectTrack] = useState<TrackRecord | null>(null);
  const [isAudioPathModalOpen, setIsAudioPathModalOpen] = useState(false);
  const [isLoFiModalOpen, setIsLoFiModalOpen] = useState(false);
  const [isHealthCheckModalOpen, setIsHealthCheckModalOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isDuplicateFinderOpen, setIsDuplicateFinderOpen] = useState(false);
  const [isFileRenamerOpen, setIsFileRenamerOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isSoundscapeOpen, setIsSoundscapeOpen] = useState(false);
  const [isHarmonicSuggesterOpen, setIsHarmonicSuggesterOpen] = useState(false);
  const [isAutoEqOpen, setIsAutoEqOpen] = useState(false);
  const [isParametricEqOpen, setIsParametricEqOpen] = useState(false);
  const [isDynamicsStudioOpen, setIsDynamicsStudioOpen] = useState(false);
  const [tagEditorTrack, setTagEditorTrack] = useState<TrackRecord | null>(null);
  const [statsModalTrack, setStatsModalTrack] = useState<TrackStatsData | null>(null);
  const [isLoopEditorOpen, setIsLoopEditorOpen] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<TrackRecord | null>(null);
  const [coverPickerState, setCoverPickerState] = useState<CoverPickerState | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isUrlImportModalOpen, setIsUrlImportModalOpen] = useState(false);
  const [isCueModalOpen, setIsCueModalOpen] = useState(false);

  // Helper action callbacks
  const openTagEditor = useCallback((track: TrackRecord) => {
    setTagEditorTrack(track);
  }, []);

  const closeTagEditor = useCallback(() => {
    setTagEditorTrack(null);
  }, []);

  const openTrackStats = useCallback((track: TrackStatsData) => {
    setStatsModalTrack(track);
  }, []);

  const closeTrackStats = useCallback(() => {
    setStatsModalTrack(null);
  }, []);

  const openAddToPlaylist = useCallback((track: TrackRecord) => {
    setTrackToAddToPlaylist(track);
    setShowPlaylistModal(true);
  }, []);

  const closeAddToPlaylist = useCallback(() => {
    setTrackToAddToPlaylist(null);
    setShowPlaylistModal(false);
  }, []);

  const openCoverPicker = useCallback((albumId: number, title: string, artist: string) => {
    setCoverPickerState({ isOpen: true, albumId, title, artist });
  }, []);

  const closeCoverPicker = useCallback(() => {
    setCoverPickerState(null);
  }, []);

  const openAnalysis = useCallback((initialTab: AnalysisTab = 'chords') => {
    setAnalysisInitialTab(initialTab);
    setIsAnalysisModalOpen(true);
  }, []);

  const openCreateStemProject = useCallback((track: TrackRecord) => {
    setCreateStemProjectTrack(track);
    setIsCreateStemProjectOpen(true);
  }, []);

  const openSettings = useCallback((tab?: SettingsTab) => {
    if (tab) {
      setSettingsTab(tab);
    }
    setIsSettingsOpen(true);
  }, []);

  const closeAllModals = useCallback(() => {
    setIsSaveQueueModalOpen(false);
    setIsAddStationModalOpen(false);
    setIsSettingsOpen(false);
    setShowDownloadHub(false);
    setIsQuickLoadOpen(false);
    setIsOnboardingOpen(false);
    setIsRecapModalOpen(false);
    setIsKeyBpmModalOpen(false);
    setIsAnalysisModalOpen(false);
    setIsStemStudioOpen(false);
    setIsCreateStemProjectOpen(false);
    setCreateStemProjectTrack(null);
    setIsAudioPathModalOpen(false);
    setIsLoFiModalOpen(false);
    setIsHealthCheckModalOpen(false);
    setIsColumnConfigOpen(false);
    setIsDuplicateFinderOpen(false);
    setIsFileRenamerOpen(false);
    setIsShortcutsModalOpen(false);
    setIsSoundscapeOpen(false);
    setIsHarmonicSuggesterOpen(false);
    setIsAutoEqOpen(false);
    setIsParametricEqOpen(false);
    setIsDynamicsStudioOpen(false);
    setTagEditorTrack(null);
    setStatsModalTrack(null);
    setIsLoopEditorOpen(false);
    setShowPlaylistModal(false);
    setTrackToAddToPlaylist(null);
    setCoverPickerState(null);
    setIsCommandPaletteOpen(false);
    setIsUrlImportModalOpen(false);
    setIsCueModalOpen(false);
  }, []);

  return {
    // Visibility states & setters
    isSaveQueueModalOpen,
    setIsSaveQueueModalOpen,
    isAddStationModalOpen,
    setIsAddStationModalOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    showDownloadHub,
    setShowDownloadHub,
    isQuickLoadOpen,
    setIsQuickLoadOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isRecapModalOpen,
    setIsRecapModalOpen,
    isKeyBpmModalOpen,
    setIsKeyBpmModalOpen,
    isAnalysisModalOpen,
    setIsAnalysisModalOpen,
    analysisInitialTab,
    setAnalysisInitialTab,
    isStemStudioOpen,
    setIsStemStudioOpen,
    activeStemProjectId,
    setActiveStemProjectId,
    isCreateStemProjectOpen,
    setIsCreateStemProjectOpen,
    createStemProjectTrack,
    setCreateStemProjectTrack,
    isAudioPathModalOpen,
    setIsAudioPathModalOpen,
    isLoFiModalOpen,
    setIsLoFiModalOpen,
    isHealthCheckModalOpen,
    setIsHealthCheckModalOpen,
    isQueueOpen,
    setIsQueueOpen,
    isColumnConfigOpen,
    setIsColumnConfigOpen,
    isDuplicateFinderOpen,
    setIsDuplicateFinderOpen,
    isFileRenamerOpen,
    setIsFileRenamerOpen,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    isSoundscapeOpen,
    setIsSoundscapeOpen,
    isHarmonicSuggesterOpen,
    setIsHarmonicSuggesterOpen,
    isAutoEqOpen,
    setIsAutoEqOpen,
    isParametricEqOpen,
    setIsParametricEqOpen,
    isDynamicsStudioOpen,
    setIsDynamicsStudioOpen,
    tagEditorTrack,
    setTagEditorTrack,
    statsModalTrack,
    setStatsModalTrack,
    isLoopEditorOpen,
    setIsLoopEditorOpen,
    showPlaylistModal,
    setShowPlaylistModal,
    trackToAddToPlaylist,
    setTrackToAddToPlaylist,
    coverPickerState,
    setCoverPickerState,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isUrlImportModalOpen,
    setIsUrlImportModalOpen,
    isCueModalOpen,
    setIsCueModalOpen,

    // Action helpers
    openTagEditor,
    closeTagEditor,
    openTrackStats,
    closeTrackStats,
    openAddToPlaylist,
    closeAddToPlaylist,
    openCoverPicker,
    closeCoverPicker,
    openAnalysis,
    openCreateStemProject,
    openSettings,
    closeAllModals,
  };
}
