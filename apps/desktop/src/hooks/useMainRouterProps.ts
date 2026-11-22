import type {
  PlayerViewProps,
  LibraryViewProps,
  DspStudioViewProps,
  PlaylistsViewProps,
  StatsDashboardViewProps,
} from '../views';
import type { StemProjectsRouterProps, RadioRouterProps } from '../components/layout/MainContentRouter';
import type { PlaybackStatus } from '../types/playback';
import type { AlbumRecord, TrackRecord } from '../types/library';
import type { Language, getTranslations } from '../i18n';

export interface UseMainRouterPropsParams {
  library?: any;
  libraryActions?: any;
  modals?: any;
  playback?: any;
  dsp?: any;
  queueManager?: any;
  playlistsManager?: any;
  musicbrainz?: any;
  mastering?: any;
  [key: string]: any;
  layoutMaxWidth?: string;
  language?: Language;
  loc?: ReturnType<typeof getTranslations>;
  status?: PlaybackStatus;
  activeTrackId?: number | null;
  currentPlayingTrack?: TrackRecord | null;
  tracks?: TrackRecord[];
  albums?: AlbumRecord[];
  currentAlbum?: AlbumRecord | null;
  currentCover?: string | null;
  cleanLiveTitle?: string | null;
  effectiveDisplayTitle?: string;
  effectiveDisplayArtist?: string;
  filePath?: string;
  setFilePath?: (p: any) => void;
  volumeProgressPercent?: number;
  volumeUnit?: 'percent' | 'db';
  formatVolumeValue?: (vol: number, unit?: 'percent' | 'db') => string;
  handleToggleVolumeUnit?: () => void;
  seekFadeEnabled?: boolean;
  handleToggleSeekFade?: () => void;
  infinityQueue?: boolean;
  handleToggleInfinityQueue?: () => void;
  sleepTimerRemainingSec?: number | null;
  sleepTimerTargetMode?: 'time' | 'end_of_track' | null;
  setIsSleepTimerOpen?: (v: boolean) => void;
  setIsAudioPathModalOpen?: (v: boolean) => void;
  setIsLoFiModalOpen?: (v: boolean) => void;
  setIsShortcutsModalOpen?: (v: boolean) => void;
  setIsLoopEditorOpen?: (v: boolean) => void;
  setIsBookmarksModalOpen?: (v: boolean) => void;
  setIsSaveQueueModalOpen?: (v: boolean) => void;
  setStatsModalTrack?: (t: any) => void;
  setActiveTab?: (tab: any) => void;
  showLyrics?: boolean;
  setShowLyrics?: (v: boolean | ((p: boolean) => boolean)) => void;
  nowPlayingVisualMode?: 'cover' | 'turntable' | 'tape' | 'vumeter';
  handleSelectNowPlayingVisualMode?: (m: any) => void;
  vinylRpm?: 33 | 45;
  handleSelectVinylRpm?: (rpm: 33 | 45) => void;
  tapeSpeed?: '7.5' | '3.75';
  handleSelectTapeSpeed?: (s: any) => void;
  tapeType?: any;
  handleSelectTapeType?: (t: any) => void;
  activeDspVibe?: any;
  handleApplyDspVibe?: (v: any) => void | Promise<void>;
  dspBadgeText?: string;
  dspBadgeTitle?: string;
  dspCombination?: any;
  lastActiveDspEngineRef?: any;
  trackWaveformPeaks?: number[] | null;
  loopPointA?: number | null;
  setLoopPointA?: (v: number | null) => void;
  loopPointB?: number | null;
  setLoopPointB?: (v: number | null) => void;
  currentBookmark?: number | null;
  currentTrackBookmarks?: any[];
  handleSaveBookmark?: () => void | Promise<void>;
  handleDeleteBookmark?: (e?: any) => void | Promise<void>;
  handleJumpToBookmark?: (pos: number) => void | Promise<void>;
  queue?: any;
  filteredQueueItems?: any[];
  queueSearchQuery?: string;
  setQueueSearchQuery?: (q: string) => void;
  queueColumns?: any;
  isColumnConfigOpen?: boolean;
  setIsColumnConfigOpen?: (v: any) => void;
  toggleQueueColumn?: (key: any) => void;
  resetQueueColumns?: () => void;
  isQuickLoadOpen?: boolean;
  setIsQuickLoadOpen?: (v: any) => void;
  draggedQueueIdx?: number | null;
  dragOverQueueIdx?: number | null;
  handleQueueDragStart?: (idx: number, e: any) => void;
  handleQueueDragOver?: (idx: number, e: any) => void;
  handleQueueDrop?: (idx: number, e: any) => void;
  handleMoveQueueItem?: any;
  handlePlayQueueIndex?: any;
  handleRemoveFromQueue?: any;
  handleClearQueue?: any;
  totalQueueDurationMs?: number;
  formatTotalDuration?: any;
  queueListRef?: any;
  queueStartIndex?: number;
  queueEndIndex?: number;
  queueTopSpacer?: number;
  queueBottomSpacer?: number;
  handleSeek?: any;
  handleSeekPreview?: any;
  handleSeekCommit?: any;
  handlePlayPause?: any;
  handleStop?: any;
  handlePrevious?: any;
  handleNext?: any;
  handleToggleShuffle?: any;
  handleCycleLoopMode?: any;
  handleToggleStopAfterCurrent?: any;
  handleToggleMute?: any;
  handleVolumeChange?: any;
  handlePitchChange?: any;
  handleTempoChange?: any;
  handleEngineChange?: any;
  handleToggleFavorite?: any;
  handleOpenContainingFolder?: any;
  handleOpenCoverPicker?: any;
  handleUploadCustomCoverDirect?: any;
  handleRestoreOriginalTrack?: any;
  handleLoadFile?: any;
  handlePickFiles?: any;
  formatTime?: any;
  formatTimeMs?: any;
  showMessage?: any;
  // library props:
  filteredTracks?: any[];
  sortedTracks?: any[];
  filteredAlbums?: any[];
  sortedAlbums?: any[];
  filteredArtists?: any[];
  librarySubView?: any;
  setLibrarySubView?: any;
  librarySearch?: string;
  setLibrarySearch?: any;
  librarySearchInputRef?: any;
  libraryFormatFilter?: any;
  setLibraryFormatFilter?: any;
  isFacetsFilterEnabled?: boolean;
  setIsFacetsFilterEnabled?: any;
  facetSelectedArtist?: any;
  setFacetSelectedArtist?: any;
  facetSelectedAlbumId?: any;
  setFacetSelectedAlbumId?: any;
  facetSelectedFormat?: any;
  setFacetSelectedFormat?: any;
  smartPlaylistFilter?: any;
  setSmartPlaylistFilter?: any;
  hideDuplicates?: boolean;
  setHideDuplicates?: any;
  sortField?: any;
  setSortField?: any;
  sortOrder?: any;
  setSortOrder?: any;
  handleSort?: any;
  albumSortField?: any;
  setAlbumSortField?: any;
  albumSortOrder?: any;
  setAlbumSortOrder?: any;
  albumGridSize?: any;
  setAlbumGridSize?: any;
  albumViewMode?: any;
  setAlbumViewMode?: any;
  albumCoverFilter?: any;
  setAlbumCoverFilter?: any;
  albumsWithCoverCount?: number;
  albumsWithoutCoverCount?: number;
  selectedAlbumDetail?: any;
  handleOpenAlbumDetail?: any;
  handleBackFromAlbumDetail?: any;
  selectedAlbumForMb?: any;
  setSelectedAlbumForMb?: any;
  handleOpenMbModal?: any;
  mbSearchTitle?: string;
  setMbSearchTitle?: any;
  mbSearchArtist?: string;
  setMbSearchArtist?: any;
  mbCandidates?: any[];
  isSearchingMb?: boolean;
  isFetchingCover?: boolean;
  handleSearchMusicBrainz?: any;
  handleSelectCandidateAndFetchCover?: any;
  handleAddTrackToQueue?: any;
  handleAddTrackNextToQueue?: any;
  handlePlayAlbum?: any;
  handleAddAlbumToQueue?: any;
  handleSetTrackRating?: any;
  handleScanTrackReplayGain?: any;
  handleShuffleAll?: any;
  setTagEditorTrack?: any;
  setTrackToAddToPlaylist?: any;
  setShowPlaylistModal?: any;
  setCreateStemProjectTrack?: any;
  setIsCreateStemProjectOpen?: any;
  setIsCueModalOpen?: any;
  setIsDuplicateFinderOpen?: any;
  setIsFileRenamerOpen?: any;
  setIsUrlImportModalOpen?: any;
  setShowDownloadHub?: any;
  isScanFolderOpen?: boolean;
  setIsScanFolderOpen?: any;
  scanFolder?: string;
  setScanFolder?: any;
  handlePickFolder?: any;
  handleScanLibrary?: any;
  isScanning?: boolean;
  scanResult?: any;
  refreshQueue?: any;
  loadLibrary?: any;
  libraryTableRef?: any;
  trackStartIndex?: number;
  trackEndIndex?: number;
  trackTopSpacer?: number;
  trackBottomSpacer?: number;
  // dsp props:
  uiScale?: number;
  activeTrackKeyBpm?: any;
  dspAutoStartup?: boolean;
  dspDefaultEngine?: any;
  dspBlockSize?: number;
  bassBoost?: number;
  lastBassBoostRef?: any;
  stereoWidenerActive?: boolean;
  stereoWidenerAmount?: number;
  limiterEnabled?: boolean;
  crossfeedEnabled?: boolean;
  crossfeedPreset?: any;
  crossfeedFcut?: number;
  crossfeedFeed?: number;
  reverbEnabled?: boolean;
  reverbRoomSize?: number;
  reverbDamping?: number;
  reverbWidth?: number;
  reverbLevel?: number;
  presets?: any[];
  eqAutoStartup?: boolean;
  selectedEqPreset?: any;
  eqPresets?: any[];
  newPresetName?: string;
  setNewPresetName?: any;
  handleToggleDspAutoStartup?: any;
  handleSaveDspStartupDefault?: any;
  handleResetDsp?: any;
  handleSetDspBlockSize?: any;
  handleRateChange?: any;
  handleBassBoostChange?: any;
  handleToggleStereoWidener?: any;
  handleStereoWidenerAmountChange?: any;
  handleToggleLimiter?: any;
  handleSetCrossfeed?: any;
  handleUpdateReverb?: any;
  handleLoadPreset?: any;
  handleSavePreset?: any;
  handleApplySignatureProfile?: any;
  handleToggleEqAutoStartup?: any;
  handleApplyEqPreset?: any;
  getEqPresetDisplayName?: any;
  handleResetEq?: any;
  handleEqToggle?: any;
  handleEqBandChange?: any;
  setIsParametricEqOpen?: any;
  setIsAutoEqOpen?: any;
  setIsDynamicsStudioOpen?: any;
  // playlists props:
  playlists?: any[];
  newPlaylistName?: string;
  setNewPlaylistName?: any;
  handleCreatePlaylist?: any;
  handleImportPlaylistM3u8?: any;
  selectedPlaylist?: any;
  setSelectedPlaylist?: any;
  playlistTracks?: any[];
  setPlaylistTracks?: any;
  handlePlayLibraryTrack?: any;
  handleExportPlaylistM3u8?: any;
  handleDeletePlaylist?: any;
  handleRemoveTrackFromPlaylist?: any;
  handleOpenPlaylist?: any;
  // stem projects:
  setActiveStemProjectId?: any;
  setIsStemStudioOpen?: any;
  // radio:
  currentRadioStation?: any;
  customRadioStations?: any[];
  handlePlayRadioStation?: any;
  setIsAddStationModalOpen?: any;
  handleDeleteCustomStation?: any;
}

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
    ...(params.queueManager ? {
      handlePlayQueueIndex: params.queueManager.playQueueIndex,
      handleRemoveFromQueue: params.queueManager.removeFromQueue,
      handleMoveQueueItem: params.queueManager.moveQueueItem,
      handleClearQueue: params.queueManager.clearQueue,
      toggleQueueColumn: params.queueManager.toggleColumn,
      confirmSaveQueueAsPlaylist: params.queueManager.confirmSaveQueueAsPlaylist,
    } : {}),
    ...(params.mastering ? {
      limiterActive: params.mastering.limiterEnabled,
    } : {}),
    ...params,
  };
  const playerProps: PlayerViewProps = {
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
    volumeProgressPercent: p.volumeProgressPercent,
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
    filteredQueueItems: p.filteredQueueItems,
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
    totalQueueDurationMs: p.totalQueueDurationMs,
    formatTotalDuration: p.formatTotalDuration,
    queueListRef: p.queueListRef,
    queueStartIndex: p.queueStartIndex,
    queueEndIndex: p.queueEndIndex,
    queueTopSpacer: p.queueTopSpacer,
    queueBottomSpacer: p.queueBottomSpacer,
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
  };

  const libraryProps: LibraryViewProps = {
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
    showMessage: p.showMessage,
    libraryTableRef: p.libraryTableRef,
    trackStartIndex: p.trackStartIndex,
    trackEndIndex: p.trackEndIndex,
    trackTopSpacer: p.trackTopSpacer,
    trackBottomSpacer: p.trackBottomSpacer,
    formatTime: p.formatTime,
  };

  const dspProps: DspStudioViewProps = {
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
    getEqPresetDisplayName: p.getEqPresetDisplayName,
    handleResetEq: p.handleResetEq,
    handleEqToggle: p.handleEqToggle,
    handleEqBandChange: p.handleEqBandChange,
    setIsParametricEqOpen: p.setIsParametricEqOpen,
    setIsAutoEqOpen: p.setIsAutoEqOpen,
    setIsDynamicsStudioOpen: p.setIsDynamicsStudioOpen,
    showMessage: p.showMessage,
  };

  const playlistsProps: PlaylistsViewProps = {
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
  };

  const stemProjectsProps: StemProjectsRouterProps = {
    onOpenProject: (pid: number) => {
      p.setActiveStemProjectId(pid);
      p.setIsStemStudioOpen(true);
    },
    onOpenCreateProject: () => {
      p.setCreateStemProjectTrack(p.currentPlayingTrack || null);
      p.setIsCreateStemProjectOpen(true);
    },
  };

  const radioProps: RadioRouterProps = {
    currentLang: p.language,
    currentStation: p.currentRadioStation,
    isPlaying: p.status?.state === 'Playing',
    liveStreamTitle: p.status?.live_stream_title,
    customStations: p.customRadioStations,
    onPlayStation: p.handlePlayRadioStation,
    onStop: p.handleStop,
    onOpenAddModal: () => p.setIsAddStationModalOpen(true),
    onDeleteCustomStation: p.handleDeleteCustomStation,
  };

  const statsProps: StatsDashboardViewProps = {
    tracks: p.tracks || [],
    albums: p.albums || [],
    currentLang: p.language,
    onPlayTrack: (track: any) => {
      if (p.handlePlayLibraryTrack) {
        p.handlePlayLibraryTrack(track);
      }
    },
    onOpenStatsModal: (track: any) => {
      if (p.setStatsModalTrack) {
        p.setStatsModalTrack(track);
      } else if (p.modals?.setStatsModalTrack) {
        p.modals.setStatsModalTrack(track);
      }
    },
    onOpenRecapModal: () => {
      if (p.setIsRecapModalOpen) {
        p.setIsRecapModalOpen(true);
      } else if (p.modals?.setIsRecapModalOpen) {
        p.modals.setIsRecapModalOpen(true);
      }
    },
  };

  return {
    playerProps,
    libraryProps,
    dspProps,
    playlistsProps,
    stemProjectsProps,
    radioProps,
    statsProps,
  };
}
