import type { useAudioSettings } from './useAudioSettings';
import { useShallowMemo } from './useShallowMemo';
import { useStableCallback } from './useStableCallback';
import type { TrackRecord } from '../types/library';
import type { useLibraryManager } from './useLibraryManager';
import type { useLibraryPlaybackActions } from './useLibraryPlaybackActions';
import type { useModalManager } from './useModalManager';
import type { usePlaybackController } from './usePlaybackController';
import type { useDspManager } from './useDspManager';
import type { usePlaybackQueue } from './usePlaybackQueue';
import type { usePlaylistManager } from './usePlaylistManager';
import type { useMusicBrainzManager } from './useMusicBrainzManager';
import type { useAudioMasteringEffects } from './useAudioMasteringEffects';
import type {
  PlayerViewProps,
  LibraryViewProps,
  DspStudioViewProps,
  PlaylistsViewProps,
  StatsDashboardViewProps,
} from '../views';
import type { StemProjectsRouterProps, RadioRouterProps } from '../components/layout/MainContentRouter';

/** All values the main view props are built from. */
export type MainViewInputs = PlayerViewProps &
  LibraryViewProps &
  DspStudioViewProps &
  PlaylistsViewProps &
  StatsDashboardViewProps &
  StemProjectsRouterProps &
  RadioRouterProps;

/**
 * Parameters: managers (domain hooks) and single values from `App`.
 * Every field is typed with the prop type of the view it goes to, so a wrong type passed
 * from `App` is a compile error. Completeness (whether every field was provided by a
 * manager or `App`) is not checked; that is the job of the target React contexts.
 */
/** Results of the domain hooks merged into one shared pool of values. */
type ManagerOutputs = ReturnType<typeof useLibraryManager> &
  ReturnType<typeof useLibraryPlaybackActions> &
  ReturnType<typeof useModalManager> &
  ReturnType<typeof usePlaybackController> &
  ReturnType<typeof useDspManager> &
  ReturnType<typeof usePlaybackQueue> &
  ReturnType<typeof usePlaylistManager> &
  ReturnType<typeof useMusicBrainzManager> &
  ReturnType<typeof useAudioMasteringEffects> &
  ReturnType<typeof useAudioSettings>;

export type UseMainRouterPropsParams = Partial<MainViewInputs> & {
  library?: ReturnType<typeof useLibraryManager>;
  libraryActions?: ReturnType<typeof useLibraryPlaybackActions>;
  modals?: ReturnType<typeof useModalManager>;
  playback?: ReturnType<typeof usePlaybackController>;
  dsp?: ReturnType<typeof useDspManager>;
  queueManager?: ReturnType<typeof usePlaybackQueue>;
  playlistsManager?: ReturnType<typeof usePlaylistManager>;
  musicbrainz?: ReturnType<typeof useMusicBrainzManager>;
  mastering?: ReturnType<typeof useAudioMasteringEffects>;
  audioSettings?: ReturnType<typeof useAudioSettings>;
};

export function useMainRouterProps(params: UseMainRouterPropsParams) {
  const p = {
    ...(params.library || {}),
    ...(params.libraryActions || {}),
    ...(params.modals || {}),
    ...(params.playback || {}),
    ...(params.dsp || {}),
    ...(params.queueManager || {}),
    ...(params.playlistsManager || {}),
    ...(params.musicbrainz || {}),
    ...(params.mastering || {}),
    // Crossfeed and the single-track ReplayGain scan (previously not passed, so the buttons did nothing).
    ...(params.audioSettings || {}),
    ...(params.queueManager ? {
      handlePlayQueueIndex: params.queueManager.playQueueIndex,
      handleRemoveFromQueue: params.queueManager.removeFromQueue,
      handleMoveQueueItem: params.queueManager.moveQueueItem,
      handleClearQueue: params.queueManager.clearQueue,
      toggleQueueColumn: params.queueManager.toggleColumn,
      confirmSaveQueueAsPlaylist: params.queueManager.confirmSaveQueueAsPlaylist,
      handleAddTrackToQueue: params.queueManager.addTrackToQueue,
      handleAddTrackNextToQueue: params.queueManager.addTrackNextToQueue,
    } : {}),
    ...(params.mastering ? {
      limiterActive: params.mastering.limiterEnabled,
    } : {}),
    ...params,
  } as MainViewInputs & ManagerOutputs & Pick<UseMainRouterPropsParams, 'modals'>;
  const handleOpenStemProject = useStableCallback((pid: number) => {
    p.setActiveStemProjectId(pid);
    p.setIsStemStudioOpen(true);
  });
  const handleOpenCreateStemProject = useStableCallback(() => {
    p.setCreateStemProjectTrack(p.currentPlayingTrack || null);
    p.setIsCreateStemProjectOpen(true);
  });
  const handleOpenAddRadioStation = useStableCallback(() => {
    p.setIsAddStationModalOpen(true);
  });
  const handleStatsPlayTrack = useStableCallback((track: TrackRecord) => {
    if (p.handlePlayLibraryTrack) {
      p.handlePlayLibraryTrack(track);
    }
  });
  const handleStatsOpenModal = useStableCallback((track: TrackRecord) => {
    if (p.setStatsModalTrack) {
      p.setStatsModalTrack(track);
    } else if (p.modals?.setStatsModalTrack) {
      p.modals.setStatsModalTrack(track);
    }
  });
  const handleStatsOpenRecap = useStableCallback(() => {
    if (p.setIsRecapModalOpen) {
      p.setIsRecapModalOpen(true);
    } else if (p.modals?.setIsRecapModalOpen) {
      p.modals.setIsRecapModalOpen(true);
    }
  });

  const playerProps = useShallowMemo<PlayerViewProps>({
    layoutMaxWidth: p.layoutMaxWidth,
    language: p.language,
    loc: p.loc,
    status: p.status,
    activeTrackId: p.activeTrackId,
    currentPlayingTrack: p.currentPlayingTrack,
    tracks: p.tracks,
    albums: p.albums,
    currentAlbum: p.currentAlbum,
    currentCover: p.currentCover,
    cleanLiveTitle: p.cleanLiveTitle,
    effectiveDisplayTitle: p.effectiveDisplayTitle,
    effectiveDisplayArtist: p.effectiveDisplayArtist,
    filePath: p.filePath,
    setFilePath: p.setFilePath,
    volumeUnit: p.volumeUnit,
    formatVolumeValue: p.formatVolumeValue,
    handleToggleVolumeUnit: p.handleToggleVolumeUnit,
    seekFadeEnabled: p.seekFadeEnabled,
    handleToggleSeekFade: p.handleToggleSeekFade,
    infinityQueue: p.infinityQueue,
    handleToggleInfinityQueue: p.handleToggleInfinityQueue,
    sleepTimerRemainingSec: p.sleepTimerRemainingSec,
    sleepTimerTargetMode: p.sleepTimerTargetMode,
    setIsSleepTimerOpen: p.setIsSleepTimerOpen,
    setIsAudioPathModalOpen: p.setIsAudioPathModalOpen,
    setIsLoFiModalOpen: p.setIsLoFiModalOpen,
    setIsShortcutsModalOpen: p.setIsShortcutsModalOpen,
    setIsLoopEditorOpen: p.setIsLoopEditorOpen,
    setIsBookmarksModalOpen: p.setIsBookmarksModalOpen,
    setIsSaveQueueModalOpen: p.setIsSaveQueueModalOpen,
    setStatsModalTrack: p.setStatsModalTrack,
    setActiveTab: p.setActiveTab,
    showLyrics: p.showLyrics,
    setShowLyrics: p.setShowLyrics,
    nowPlayingVisualMode: p.nowPlayingVisualMode,
    handleSelectNowPlayingVisualMode: p.handleSelectNowPlayingVisualMode,
    vinylRpm: p.vinylRpm,
    handleSelectVinylRpm: p.handleSelectVinylRpm,
    tapeSpeed: p.tapeSpeed,
    handleSelectTapeSpeed: p.handleSelectTapeSpeed,
    tapeType: p.tapeType,
    handleSelectTapeType: p.handleSelectTapeType,
    activeDspVibe: p.activeDspVibe,
    handleApplyDspVibe: p.handleApplyDspVibe,
    dspBadgeText: p.dspBadgeText,
    dspBadgeTitle: p.dspBadgeTitle,
    dspCombination: p.dspCombination,
    lastActiveDspEngineRef: p.lastActiveDspEngineRef,
    trackWaveformPeaks: p.trackWaveformPeaks,
    trackWaveformBands: p.trackWaveformBands,
    isWaveformLoading: p.isWaveformLoading,
    loopPointA: p.loopPointA,
    setLoopPointA: p.setLoopPointA,
    loopPointB: p.loopPointB,
    setLoopPointB: p.setLoopPointB,
    currentBookmark: p.currentBookmark,
    currentTrackBookmarks: p.currentTrackBookmarks,
    handleSaveBookmark: p.handleSaveBookmark,
    handleDeleteBookmark: p.handleDeleteBookmark,
    handleJumpToBookmark: p.handleJumpToBookmark,
    queue: p.queue,
    queueSearchQuery: p.queueSearchQuery,
    setQueueSearchQuery: p.setQueueSearchQuery,
    queueColumns: p.queueColumns,
    isColumnConfigOpen: p.isColumnConfigOpen,
    setIsColumnConfigOpen: p.setIsColumnConfigOpen,
    toggleQueueColumn: p.toggleQueueColumn,
    resetQueueColumns: p.resetQueueColumns,
    isQuickLoadOpen: p.isQuickLoadOpen,
    setIsQuickLoadOpen: p.setIsQuickLoadOpen,
    draggedQueueIdx: p.draggedQueueIdx,
    dragOverQueueIdx: p.dragOverQueueIdx,
    handleQueueDragStart: p.handleQueueDragStart,
    handleQueueDragOver: p.handleQueueDragOver,
    handleQueueDrop: p.handleQueueDrop,
    handleMoveQueueItem: p.handleMoveQueueItem,
    handlePlayQueueIndex: p.handlePlayQueueIndex,
    handleRemoveFromQueue: p.handleRemoveFromQueue,
    handleClearQueue: p.handleClearQueue,
    mainContentRef: p.mainContentRef,
    handleSeek: p.handleSeek,
    handleSeekPreview: p.handleSeekPreview,
    handleSeekCommit: p.handleSeekCommit,
    handlePlayPause: p.handlePlayPause,
    handleStop: p.handleStop,
    handlePrevious: p.handlePrevious,
    handleNext: p.handleNext,
    handleToggleShuffle: p.handleToggleShuffle,
    handleCycleLoopMode: p.handleCycleLoopMode,
    handleToggleStopAfterCurrent: p.handleToggleStopAfterCurrent,
    handleToggleMute: p.handleToggleMute,
    handleVolumeChange: p.handleVolumeChange,
    handlePitchChange: p.handlePitchChange,
    handleTempoChange: p.handleTempoChange,
    handleEngineChange: p.handleEngineChange,
    handleToggleFavorite: p.handleToggleFavorite,
    handleOpenContainingFolder: p.handleOpenContainingFolder,
    handleOpenCoverPicker: p.handleOpenCoverPicker,
    handleUploadCustomCoverDirect: p.handleUploadCustomCoverDirect,
    handleRestoreOriginalTrack: p.handleRestoreOriginalTrack,
    handleLoadFile: p.handleLoadFile,
    handlePickFiles: p.handlePickFiles,
    formatTime: p.formatTime,
    formatTimeMs: p.formatTimeMs,
    showMessage: p.showMessage,
  });

  const libraryProps = useShallowMemo<LibraryViewProps>({
    layoutMaxWidth: p.layoutMaxWidth,
    currentLang: p.language,
    language: p.language,
    loc: p.loc,
    tracks: p.tracks,
    albums: p.albums,
    filteredTracks: p.filteredTracks,
    sortedTracks: p.sortedTracks,
    filteredAlbums: p.filteredAlbums,
    sortedAlbums: p.sortedAlbums,
    filteredArtists: p.filteredArtists,
    activeTrackId: p.activeTrackId,
    currentPlayingTrack: p.currentPlayingTrack,
    status: p.status,
    librarySubView: p.librarySubView,
    setLibrarySubView: p.setLibrarySubView,
    librarySearch: p.librarySearch,
    setLibrarySearch: p.setLibrarySearch,
    librarySearchInputRef: p.librarySearchInputRef,
    libraryFormatFilter: p.libraryFormatFilter,
    setLibraryFormatFilter: p.setLibraryFormatFilter,
    isFacetsFilterEnabled: p.isFacetsFilterEnabled,
    setIsFacetsFilterEnabled: p.setIsFacetsFilterEnabled,
    facetSelectedArtist: p.facetSelectedArtist,
    setFacetSelectedArtist: p.setFacetSelectedArtist,
    facetSelectedAlbumId: p.facetSelectedAlbumId,
    setFacetSelectedAlbumId: p.setFacetSelectedAlbumId,
    facetSelectedFormat: p.facetSelectedFormat,
    setFacetSelectedFormat: p.setFacetSelectedFormat,
    smartPlaylistFilter: p.smartPlaylistFilter,
    setSmartPlaylistFilter: p.setSmartPlaylistFilter,
    hideDuplicates: p.hideDuplicates,
    setHideDuplicates: p.setHideDuplicates,
    sortField: p.sortField,
    setSortField: p.setSortField,
    sortOrder: p.sortOrder,
    setSortOrder: p.setSortOrder,
    handleSort: p.handleSort,
    albumSortField: p.albumSortField,
    setAlbumSortField: p.setAlbumSortField,
    albumSortOrder: p.albumSortOrder,
    setAlbumSortOrder: p.setAlbumSortOrder,
    albumGridSize: p.albumGridSize,
    setAlbumGridSize: p.setAlbumGridSize,
    albumViewMode: p.albumViewMode,
    setAlbumViewMode: p.setAlbumViewMode,
    albumCoverFilter: p.albumCoverFilter,
    setAlbumCoverFilter: p.setAlbumCoverFilter,
    albumsWithCoverCount: p.albumsWithCoverCount,
    albumsWithoutCoverCount: p.albumsWithoutCoverCount,
    selectedAlbumDetail: p.selectedAlbumDetail,
    handleOpenAlbumDetail: p.handleOpenAlbumDetail,
    handleBackFromAlbumDetail: p.handleBackFromAlbumDetail,
    selectedAlbumForMb: p.selectedAlbumForMb,
    setSelectedAlbumForMb: p.setSelectedAlbumForMb,
    handleOpenMbModal: p.handleOpenMbModal,
    mbSearchTitle: p.mbSearchTitle,
    setMbSearchTitle: p.setMbSearchTitle,
    mbSearchArtist: p.mbSearchArtist,
    setMbSearchArtist: p.setMbSearchArtist,
    mbCandidates: p.mbCandidates,
    isSearchingMb: p.isSearchingMb,
    isFetchingCover: p.isFetchingCover,
    handleSearchMusicBrainz: p.handleSearchMusicBrainz,
    handleSelectCandidateAndFetchCover: p.handleSelectCandidateAndFetchCover,
    handleOpenCoverPicker: p.handleOpenCoverPicker,
    handlePlayLibraryTrack: p.handlePlayLibraryTrack,
    handleAddTrackToQueue: p.handleAddTrackToQueue,
    handleAddTrackNextToQueue: p.handleAddTrackNextToQueue,
    handlePlayAlbum: p.handlePlayAlbum,
    handleAddAlbumToQueue: p.handleAddAlbumToQueue,
    handleToggleFavorite: p.handleToggleFavorite,
    handleSetTrackRating: p.handleSetTrackRating,
    handleScanTrackReplayGain: p.handleScanTrackReplayGain,
    handleOpenContainingFolder: p.handleOpenContainingFolder,
    handleShuffleAll: p.handleShuffleAll,
    setTagEditorTrack: p.setTagEditorTrack,
    setStatsModalTrack: p.setStatsModalTrack,
    setTrackToAddToPlaylist: p.setTrackToAddToPlaylist,
    setShowPlaylistModal: p.setShowPlaylistModal,
    setCreateStemProjectTrack: p.setCreateStemProjectTrack,
    setIsCreateStemProjectOpen: p.setIsCreateStemProjectOpen,
    setIsCueModalOpen: p.setIsCueModalOpen,
    setIsDuplicateFinderOpen: p.setIsDuplicateFinderOpen,
    setIsFileRenamerOpen: p.setIsFileRenamerOpen,
    setIsUrlImportModalOpen: p.setIsUrlImportModalOpen,
    setShowDownloadHub: p.setShowDownloadHub,
    isScanFolderOpen: p.isScanFolderOpen,
    setIsScanFolderOpen: p.setIsScanFolderOpen,
    scanFolder: p.scanFolder,
    setScanFolder: p.setScanFolder,
    handlePickFolder: p.handlePickFolder,
    handlePickFiles: p.handlePickFiles,
    handleScanLibrary: p.handleScanLibrary,
    isScanning: p.isScanning,
    scanResult: p.scanResult,
    refreshQueue: p.refreshQueue,
    loadLibrary: p.loadLibrary,
    handleTriggerBackgroundCoverFetch: p.handleTriggerBackgroundCoverFetch,
    coverSyncProgress: p.coverSyncProgress,
    showMessage: p.showMessage,
    formatTime: p.formatTime,
  });

  const dspProps = useShallowMemo<DspStudioViewProps>({
    uiScale: p.uiScale,
    loc: p.loc,
    language: p.language,
    currentLang: p.language,
    status: p.status,
    activeTrackKeyBpm: p.activeTrackKeyBpm,
    dspAutoStartup: p.dspAutoStartup,
    dspDefaultEngine: p.dspDefaultEngine,
    dspBlockSize: p.dspBlockSize,
    dspCombination: p.dspCombination,
    bassBoost: p.bassBoost,
    lastBassBoostRef: p.lastBassBoostRef,
    stereoWidenerActive: p.stereoWidenerActive,
    stereoWidenerAmount: p.stereoWidenerAmount,
    limiterEnabled: p.limiterEnabled,
    crossfeedEnabled: p.crossfeedEnabled,
    crossfeedPreset: p.crossfeedPreset,
    crossfeedFcut: p.crossfeedFcut,
    crossfeedFeed: p.crossfeedFeed,
    reverbEnabled: p.reverbEnabled,
    reverbRoomSize: p.reverbRoomSize,
    reverbDamping: p.reverbDamping,
    reverbWidth: p.reverbWidth,
    reverbLevel: p.reverbLevel,
    presets: p.presets,
    eqAutoStartup: p.eqAutoStartup,
    selectedEqPreset: p.selectedEqPreset,
    eqPresets: p.eqPresets,
    newPresetName: p.newPresetName,
    setNewPresetName: p.setNewPresetName,
    handleToggleDspAutoStartup: p.handleToggleDspAutoStartup,
    handleSaveDspStartupDefault: p.handleSaveDspStartupDefault,
    handleResetDsp: p.handleResetDsp,
    handleEngineChange: p.handleEngineChange,
    handleSetDspBlockSize: p.handleSetDspBlockSize,
    handlePitchChange: p.handlePitchChange,
    handleTempoChange: p.handleTempoChange,
    handleRateChange: p.handleRateChange,
    handleBassBoostChange: p.handleBassBoostChange,
    handleToggleStereoWidener: p.handleToggleStereoWidener,
    handleStereoWidenerAmountChange: p.handleStereoWidenerAmountChange,
    handleToggleLimiter: p.handleToggleLimiter,
    handleSetCrossfeed: p.handleSetCrossfeed,
    handleUpdateReverb: p.handleUpdateReverb,
    handleLoadPreset: p.handleLoadPreset,
    handleSavePreset: p.handleSavePreset,
    handleApplySignatureProfile: p.handleApplySignatureProfile,
    handleToggleEqAutoStartup: p.handleToggleEqAutoStartup,
    handleApplyEqPreset: p.handleApplyEqPreset,
    handleResetEq: p.handleResetEq,
    handleEqToggle: p.handleEqToggle,
    handleEqBandChange: p.handleEqBandChange,
    preampDb: p.preampDb,
    preampAuto: p.preampAuto,
    autoPreampValue: p.autoPreampValue,
    handlePreampChange: p.handlePreampChange,
    handleTogglePreampAuto: p.handleTogglePreampAuto,
    handleResetClipIndicator: p.handleResetClipIndicator,
    setIsParametricEqOpen: p.setIsParametricEqOpen,
    setIsAutoEqOpen: p.setIsAutoEqOpen,
    setIsDynamicsStudioOpen: p.setIsDynamicsStudioOpen,
    showMessage: p.showMessage,
  });

  const playlistsProps = useShallowMemo<PlaylistsViewProps>({
    layoutMaxWidth: p.layoutMaxWidth,
    loc: p.loc,
    playlists: p.playlists,
    newPlaylistName: p.newPlaylistName,
    onNewPlaylistNameChange: p.setNewPlaylistName,
    onCreatePlaylist: p.handleCreatePlaylist,
    onImportPlaylistM3u8: p.handleImportPlaylistM3u8,
    selectedPlaylist: p.selectedPlaylist,
    onSelectPlaylist: p.setSelectedPlaylist,
    playlistTracks: p.playlistTracks,
    onSetPlaylistTracks: p.setPlaylistTracks,
    onPlayLibraryTrack: p.handlePlayLibraryTrack,
    refreshQueue: p.refreshQueue,
    showMessage: p.showMessage,
    onExportPlaylistM3u8: p.handleExportPlaylistM3u8,
    onDeletePlaylist: p.handleDeletePlaylist,
    formatTime: p.formatTime,
    onAddTrackToQueue: p.handleAddTrackToQueue,
    onOpenContainingFolder: p.handleOpenContainingFolder,
    onRemoveTrackFromPlaylist: p.handleRemoveTrackFromPlaylist,
    onOpenPlaylist: p.handleOpenPlaylist,
  });

  const stemProjectsProps = useShallowMemo<StemProjectsRouterProps>({
    currentLang: p.language,
    onOpenProject: handleOpenStemProject,
    onOpenCreateProject: handleOpenCreateStemProject,
  });

  const radioProps = useShallowMemo<RadioRouterProps>({
    currentLang: p.language,
    currentStation: p.currentRadioStation,
    isPlaying: p.status?.state === 'Playing',
    liveStreamTitle: p.status?.live_stream_title,
    customStations: p.customRadioStations,
    onPlayStation: p.handlePlayRadioStation,
    onStop: p.handleStop,
    onOpenAddModal: handleOpenAddRadioStation,
    onDeleteCustomStation: p.handleDeleteCustomStation,
  });

  const statsProps = useShallowMemo<StatsDashboardViewProps>({
    tracks: p.tracks || [],
    albums: p.albums || [],
    currentLang: p.language,
    onPlayTrack: handleStatsPlayTrack,
    onOpenStatsModal: handleStatsOpenModal,
    onOpenRecapModal: handleStatsOpenRecap,
  });

  return useShallowMemo({
    playerProps,
    libraryProps,
    dspProps,
    playlistsProps,
    stemProjectsProps,
    radioProps,
    statsProps,
  });
}
