import type { AppTab, NowPlayingVisualMode } from './types/navigation';
import { isMainTab, isNowPlayingVisualMode } from './types/navigation';
import { usePlaylistManager } from './hooks/usePlaylistManager';
import { useTranscodeManager } from './hooks/useTranscodeManager';
import { useHotkeysManager } from './hooks/useHotkeysManager';
import { useThemeManager } from './hooks/useThemeManager';
import { useMusicBrainzManager } from './hooks/useMusicBrainzManager';
import { useInfinityQueue } from './hooks/useInfinityQueue';
import { useScrobblerManager } from './hooks/useScrobblerManager';
import { useSessionManager } from './hooks/useSessionManager';
import { useAudioSettings } from './hooks/useAudioSettings';
import { useLibraryManager } from './hooks/useLibraryManager';
import { usePlaybackController } from './hooks/usePlaybackController';
import { useDspManager } from './hooks/useDspManager';
import { useModalManager } from './hooks/useModalManager';
import { usePlaybackQueue } from './hooks/usePlaybackQueue';
import { useCurrentTrackInfo } from './hooks/useCurrentTrackInfo';
import { resolveActiveRadioStation } from './utils/radioStation';
import { useLibraryPlaybackActions } from './hooks/useLibraryPlaybackActions';
import { useAudioMasteringEffects } from './hooks/useAudioMasteringEffects';
import { useVolumeUnit } from './hooks/useVolumeUnit';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useMainRouterProps } from './hooks/useMainRouterProps';
import { AppSettingsModal } from './views/settings/AppSettingsModal';
import { useAppSettingsModalProps } from './views/settings/useAppSettingsModalProps';
import { AppModalsContainer } from './components/modals/AppModalsContainer';
import { useAppModalsProps } from './components/modals/useAppModalsProps';
import { MainContentRouter } from './components/layout/MainContentRouter';
import { AppHeader } from './components/layout/AppHeader';
import { useAppHeaderProps } from './components/layout/useAppHeaderProps';
import { BottomPlaybackDock } from './components/layout/BottomPlaybackDock';
import { useBottomPlaybackDockProps } from './components/layout/useBottomPlaybackDockProps';
import { BackgroundLayer } from './components/layout/BackgroundLayer';
import { DragDropOverlay } from './components/layout/DragDropOverlay';
import { QueueDrawer } from './components/layout/QueueDrawer';
import { StartupSplash } from './components/layout/StartupSplash';
import { useState, useEffect, useRef, useCallback } from 'react';
import { errorMessage, invoke } from './api/ipc';
import { setSetting } from './api/settings';
import { useTauriEvent } from './hooks/useTauriEvent';
import type { CoverSyncDispatchResult, CoverSyncProgress } from './types/library';
import {
  type TapeType,
  MiniPlayerWidget,
  AnimeAmbienceFX,
  VolumeOsd,
  DEFAULT_VOLUME_OSD_POSITION,
  type VolumeOsdPosition,
} from './components/player';
import { BigScreenView } from './views/player/BigScreenView';

import { useQueueVirtualScroll } from './hooks/useQueueVirtualScroll';
import { useAmbienceMode, useAmbienceOpacity } from './hooks/useAmbienceMode';
import { type Language, getTranslations } from './i18n';
import type {
  PlaybackStatus,
  AlbumPlaybackBehavior,
} from './types/playback';
import type {
  AlbumRecord,
} from './types/library';
import { formatTime, formatTimeMs } from './utils/timeFormat';
import { BackgroundExportBadge } from './components/layout/BackgroundExportBadge';
import { useSleepTimer } from './hooks/useSleepTimer';
import { useProfileBackup } from './hooks/useProfileBackup';
import { useMiniPlayer } from './hooks/useMiniPlayer';
import { cn } from './utils/cn';
import { fmt } from './utils/fmt';
import { parseBoolean, parseOneOf, usePersistedState } from './hooks/usePersistedState';
import { useToasts } from './hooks/useToasts';
import { useUpdateManager } from './hooks/useUpdateManager';
import { usePlaybackErrorToasts } from './hooks/usePlaybackErrorToasts';
import { AlertTriangle } from './components/ui/icons';

export type { AlbumPlaybackBehavior };

export default function App() {
  const [filePath, setFilePath] = useState('');
  const [status, setStatus] = useState<PlaybackStatus>({
    state: 'Stopped',
    position_ms: 0,
    duration_ms: null,
    volume: 1.0,
    pitch_semitones: 0.0,
    tempo_ratio: 1.0,
    rate_ratio: 1.0,
    engine: 'Bypass',
    capabilities: {
      engine: 'Bypass',
      name: 'Direct Bypass (No DSP)',
      min_pitch_semitones: -24.0,
      max_pitch_semitones: 24.0,
      min_tempo_ratio: 0.15,
      max_tempo_ratio: 4.0,
      supports_formants: false,
      description: 'Bit-perfect direct stream without DSP (zero CPU overhead)',
    },
    equalizer_enabled: false,
    equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    parametric_eq_enabled: false,
    compressor_enabled: false,
    saturator_enabled: false,
    limiter_enabled: true,
    spectrum: Array(16).fill(0.05),
  });

  // Volume percentage for the slider fill (progress is computed by components through `useLiveStatus`)

  // UI language (English by default; pl, de, fi and la can be chosen)
  const [language, setLanguage] = useState<Language>('en');
  const loc = getTranslations(language);
  const t = loc;

  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);

  // Message queue (useToasts): a stable `showMessage` for hooks and a separate timer
  // for each message. Info messages are deliberately dropped; only errors are shown.
  const { toasts, showMessage, dismiss: dismissToast } = useToasts();
  const updateManager = useUpdateManager();
  usePlaybackErrorToasts(showMessage);

  const mainContentRef = useRef<HTMLElement | null>(null);

  // Audio library, filters, sorting and scanner (useLibraryManager)
  const libraryManager = useLibraryManager({
    mainContentRef,
    status,
    setStatus,
    setFilePath,
    setActiveTrackId,
    showMessage,
    loc,
  });
  const {
    tracks,
    setTracks,
    albums,
    setAlbums,
    librarySearchInputRef,
    filteredTracks,
    setIsScanFolderOpen,
    loadLibrary,
    handleScanPaths,
  } = libraryManager;

  // Audio devices, ReplayGain, Crossfeed and Silence Trimming (useAudioSettings)
  const audioSettings = useAudioSettings({
    showMessage,
    loc,
    loadLibrary,
    setTracks,
  });
  const {
    refreshDevices,
    replaygainMode,
    setReplaygainStatus,
    seekFadeEnabled,
    setSeekFadeEnabled,
    handleToggleSeekFade,
    eqAutoStartup,
    setEqAutoStartup,
    handleToggleEqAutoStartup,
  } = audioSettings;

  // All dialogs, modals and drawers in one place (useModalManager)
  const modalManager = useModalManager();
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    setIsQuickLoadOpen,
    setIsShortcutsModalOpen,
    setCoverPickerState,
    setIsCommandPaletteOpen,
    setStatsModalTrack,
    setCreateStemProjectTrack,
    setIsCreateStemProjectOpen,
  } = modalManager;


  const handleOpenCoverPicker = (album: AlbumRecord) => {
    setCoverPickerState({
      isOpen: true,
      albumId: album.id,
      title: album.title,
      artist: album.album_artist,
    });
  };

  // DSP engines, EQ, reverb and vibe profiles (useDspManager)
  const dspManager = useDspManager({
    status,
    setStatus,
    showMessage,
    loc,
  });
  const {
    reverbEnabled,
    reverbLevel,
    handlePitchChange,
    handleTempoChange,
    handleResetDsp,
  } = dspManager;

  // Now Playing visual mode: cover, hi-fi vinyl, reel-to-reel/cassette or analog VU meter
  const [nowPlayingVisualMode, handleSelectNowPlayingVisualMode] = usePersistedState<NowPlayingVisualMode>(
    'auralune_nowplaying_visual_mode',
    'cover',
    { parse: (raw) => (isNowPlayingVisualMode(raw) ? raw : undefined) },
  );
  // Session restore sets the mode through the same persisted setter
  const setNowPlayingVisualMode = handleSelectNowPlayingVisualMode;

  // Visual parameters: vinyl RPM, tape speed, tape type
  const [vinylRpm, handleSelectVinylRpm] = usePersistedState<33 | 45>('auralune_vinyl_rpm', 33, {
    parse: (raw) => (raw === '33' ? 33 : raw === '45' ? 45 : undefined),
  });
  const [tapeSpeed, handleSelectTapeSpeed] = usePersistedState<'7.5' | '3.75'>('auralune_tape_speed', '7.5', {
    parse: parseOneOf(['7.5', '3.75'] as const),
  });
  const [tapeType, handleSelectTapeType] = usePersistedState<TapeType>('auralune_tape_type', 'TYPE_II', {
    parse: parseOneOf(['TYPE_I', 'TYPE_II', 'METAL'] as const),
  });

  const [activeTab, setActiveTab] = useState<AppTab>('player');
  const [closeToTray, setCloseToTray] = useState<boolean>(true);
  const [autoFetchCoversBg, setAutoFetchCoversBg] = useState<boolean>(true);
  const [coverSyncProgress, setCoverSyncProgress] = useState<CoverSyncProgress>({
    running: false,
    processed: 0,
    total: 0,
  });
  const isTriggeringCoverSyncRef = useRef(false);

  useTauriEvent<CoverSyncProgress>('auralune://cover-sync-progress', (progress) => {
    setCoverSyncProgress(progress);
  });

  useEffect(() => {
    let active = true;
    invoke<CoverSyncProgress>('get_cover_sync_progress')
      .then((progress) => {
        if (active) setCoverSyncProgress(progress);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Album and playlist playback behaviour (autoplay and queue)
  const [albumPlaybackMode, setAlbumPlaybackMode] = usePersistedState<AlbumPlaybackBehavior>(
    'auralune_album_playback_mode',
    'replace',
    { parse: parseOneOf(['replace', 'append', 'single']) },
  );

  // Smooth crossfade and advanced DSP / mastering effects (useAudioMasteringEffects)
  const masteringEffects = useAudioMasteringEffects({
    status,
    setStatus,
    showMessage,
    loc,
  });
  const {
    crossfadeDuration,
    setCrossfadeDuration,
    setBassBoost,
    stereoWidenerActive,
    setStereoWidenerActive,
    stereoWidenerAmount,
    setStereoWidenerAmount,
    setLimiterEnabled,
    handleCrossfadeDurationChange,
  } = masteringEffects;

  // First run (onboarding) & Recap & OSD & key/BPM
  const [recapOptIn, setRecapOptIn] = usePersistedState('auralune_recap_opt_in', true, {
    parse: parseBoolean,
  });
  const [volumeOsdPosition, setVolumeOsdPosition] = usePersistedState<VolumeOsdPosition>(
    'auralune_volume_osd_position',
    DEFAULT_VOLUME_OSD_POSITION,
    { parse: parseOneOf(['center', 'top-right', 'top-left', 'bottom-center', 'bottom-right', 'bottom-left', 'off']) },
  );
  const [instantVolume, setInstantVolume] = usePersistedState('auralune_instant_volume', true, {
    parse: parseBoolean,
  });

  // Button hover glow option
  const [buttonGlowEnabled, setButtonGlowEnabled] = usePersistedState('auralune_button_glow_enabled', true, {
    parse: parseBoolean,
  });

  useEffect(() => {
    document.body.classList.toggle('disable-button-glow', !buttonGlowEnabled);
  }, [buttonGlowEnabled]);


  const {
    volumeUnit,
    setVolumeUnit,
    handleSetVolumeUnit,
    handleToggleVolumeUnit,
    volumeCurve,
    handleSetVolumeCurve,
    formatVolumeValue,
  } = useVolumeUnit({ loc: t, showMessage });

  // Manually typed DSP values (pitch, tempo, speed)
  const initialStartupPositionRef = useRef<number | null>(null);

  const [trackDirectCover, setTrackDirectCover] = useState<string | null>(null);

  // PLAYLISTS & RADIO
  // ============================================
  const playlistManager = usePlaylistManager({
    language,
    loc,
    t: loc,
    showMessage,
    initialStartupPositionRef,
    setTrackDirectCover,
    setActiveTrackId,
  });
  const {
    playlists,
    currentRadioStation: storedRadioStation,
    refreshPlaylists,
    setShowPlaylistModal,
    setTrackToAddToPlaylist,
  } = playlistManager;
  // The station kept in UI state is active only while the engine plays a stream
  // (after switching to the library / a stem project it must not mask the track).
  const currentRadioStation = resolveActiveRadioStation(storedRadioStation, status.current_track?.uri);

  // Playback queue, reorder, columns and drag and drop (usePlaybackQueue)
  const playbackQueue = usePlaybackQueue({
    onNotify: showMessage,
    onTrackSelected: ({ uri, trackId, title }) => {
      initialStartupPositionRef.current = null;
      if (uri) setFilePath(uri);
      if (trackId) setActiveTrackId(trackId);
      setStatus((prev) => ({ ...prev, state: 'Playing' }));
      showMessage(fmt(t.notifications.playingMsg, title));
    },
    albums,
    loc,
    onPlaylistSaved: refreshPlaylists,
  });
  const {
    queue,
    isQueueOpen,
    setIsQueueOpen,
    queueSearchQuery,
    queueColumns,
    refreshQueue,
    playQueueIndex: handlePlayQueueIndex,
    removeFromQueue: handleRemoveFromQueue,
    moveQueueItem: handleMoveQueueItem,
    clearQueue: handleClearQueue,
    addTrackToQueue: handleAddTrackToQueue,
  } = playbackQueue;

  // Themes and scale (useThemeManager)
  const themeManager = useThemeManager({
    showMessage,
    loc,
  });
  const {
    uiScale,
    layoutMaxWidth,
    handleIncreaseScale,
    handleDecreaseScale,
    handleResetScale,
    themeOverlay,
    themeBlur,
    themeBgImage,
    customBgPath,
    setCustomBgPath,
    loadThemes,
    handleSelectIconStyle,
    handlePickWallpaperFromDisk,
    handleWallpaperDrop,
    handleUploadBgImage,
    handleRemoveBgImage,
    handleSaveBackgroundSettings,
    handleExportTheme,
    handleImportTheme,
  } = themeManager;

  // Scrobbler Manager (Discord RPC, Last.fm, ListenBrainz)
  // Scrobbler Manager (Discord RPC, Last.fm, ListenBrainz)
  const scrobblerManager = useScrobblerManager({
    isSettingsOpen,
    showMessage,
    loc,
  });
  const {
    discordRpcEnabled,
    discordRpcConnected,
    discordClientId,
    handleToggleDiscordRpc,
    handleSaveDiscordClientId,
    listenbrainzToken,
    listenbrainzEnabled,
    scrobbledTrackId,
    setScrobbledTrackId,
    lastfmSessionKey,
    lastfmEnabled,
    lastfmCustomKey,
    lastfmCustomSecret,
    lastfmScrobbledTrackId,
    setLastfmScrobbledTrackId,
  } = scrobblerManager;

  // Transport, A-B loop, bookmarks and player status polling (usePlaybackController)
  const playbackController = usePlaybackController({
    status,
    setStatus,
    filePath,
    setFilePath,
    activeTrackId,
    setActiveTrackId,
    queue,
    refreshQueue,
    seekFadeEnabled,
    instantVolume,
    initialStartupPositionRef,
    tracks,
    setTracks,
    albums,
    setReplaygainStatus,
    listenbrainzEnabled,
    listenbrainzToken,
    scrobbledTrackId,
    setScrobbledTrackId,
    lastfmEnabled,
    lastfmSessionKey,
    lastfmCustomKey,
    lastfmCustomSecret,
    lastfmScrobbledTrackId,
    setLastfmScrobbledTrackId,
    showMessage,
    loc,
  });
  const {
    handlePlayPause,
    handleSeek,
    handleSeekPreview,
    handleSeekCommit,
    handleVolumeChange,
    handleToggleMute,
    handleNext,
    handlePrevious,
    handleCycleLoopMode,
    handleToggleShuffle,
    loopPointA,
    setLoopPointA,
    loopPointB,
    setLoopPointB,
    setCurrentBookmark,
    currentTrackBookmarks,
    refreshTrackBookmarks,
    statusRef,
  } = playbackController;

  // Dynamic app version (from package.json / Cargo.toml)
  const [appVersion, setAppVersion] = useState<string>(
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.3'
  );

  // Song lyrics state (synchronized LRC / LRCLIB)
  const [showLyrics, setShowLyrics] = useState(false);

  // Floating desktop lyrics widget (Desktop Lyrics Overlay)
  // By design the widget does not start on its own when the app starts;
  // the user decides in the UI when to show or hide it.
  const [showDesktopLyrics, setShowDesktopLyrics] = useState<boolean>(false);

  const toggleDesktopLyrics = () => {
    setShowDesktopLyrics((prev) => !prev);
  };

  // Mini-player state (Floating PiP Widget)
  const { isMiniPlayer, toggleMiniPlayer } = useMiniPlayer();

  // Anime ambient effects (Sakura Petals / Cyberpunk Rain / Meteors / Matrix / Momiji)
  const [ambienceOpacity] = useAmbienceOpacity();
  const { ambienceMode, setAmbienceMode, cycleAmbienceMode } = useAmbienceMode({
    loc: t,
    showMessage,
  });

  // Kiosk / Big Screen Now Playing full-screen mode
  const [isBigScreen, setIsBigScreen] = useState(false);

  // Linux system notifications (libnotify / D-Bus)
  // The toggle used to write `auralune_notifications_enabled` while start-up read another key,
  // so disabling notifications did not survive a restart; the old key is migrated.
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = usePersistedState(
    'auralune_desktop_notifications',
    true,
    { parse: parseBoolean, legacyKeys: ['auralune_notifications_enabled'] },
  );


  const {
    queueListRef,
    totalQueueDurationMs,
    formatTotalDuration,
    filteredQueueItems,
    queueStartIndex,
    queueEndIndex,
    queueTopSpacer,
    queueBottomSpacer,
  } = useQueueVirtualScroll({
    items: queue.items,
    searchQuery: queueSearchQuery,
    compactMode: queueColumns.compactMode,
    containerRef: mainContentRef,
    loc: t,
  });

  // Detects scrolling below the top player panel
  const [isPlayerScrolledDown, setIsPlayerScrolledDown] = useState(false);

  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;
    const checkScroll = () => {
      const scrolled = el.scrollTop > 300;
      setIsPlayerScrolledDown((prev) => (prev !== scrolled ? scrolled : prev));
    };
    el.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, [activeTab, setIsSettingsOpen, setSettingsTab]);

  // Current track, album cover, DSP parameters and waveform (useCurrentTrackInfo)
  const {
    currentPlayingTrack,
    currentAlbum,
    activeTrackKeyBpm,
    dspCombination,
    dspBadgeText,
    dspBadgeTitle,
    currentCover,
    cleanLiveTitle,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    trackWaveformPeaks,
    trackWaveformBands,
    isWaveformLoading,
  } = useCurrentTrackInfo({
    tracks,
    albums,
    status,
    filePath,
    activeTrackId,
    trackDirectCover,
    setTrackDirectCover,
    currentRadioStation,
    loc,
  });

  // Library playback actions, file operations, bookmarks and sound profiles (useLibraryPlaybackActions)
  const libraryActions = useLibraryPlaybackActions({
    tracks,
    setTracks,
    albums,
    queue,
    refreshQueue,
    albumPlaybackMode,
    activeTrackId,
    setActiveTrackId,
    setFilePath,
    status,
    setStatus,
    trackDirectCover,
    desktopNotificationsEnabled,
    replaygainMode,
    listenbrainzEnabled,
    listenbrainzToken,
    setScrobbledTrackId,
    lastfmEnabled,
    lastfmSessionKey,
    lastfmCustomKey,
    lastfmCustomSecret,
    setLastfmScrobbledTrackId,
    setCurrentBookmark,
    handleSeek,
    handleScanPaths,
    filteredTracks,
    statsModalTrack: modalManager.statsModalTrack,
    setStatsModalTrack,
    initialStartupPositionRef,
    showMessage,
    loc,
  });
  const {
    handlePickFiles,
    handleDropPaths,
    handlePlayLibraryTrack,
    handleApplySignatureProfile,
    handleOpenContainingFolder,
  } = libraryActions;

  // Automatically redirect old tabs to the Settings window
  useEffect(() => {
    if (activeTab === 'themes' || activeTab === 'devices' || activeTab === 'transcode') {
      setSettingsTab(activeTab);
      setIsSettingsOpen(true);
      setActiveTab('player');
    }
  }, [activeTab, setIsSettingsOpen, setSettingsTab]);



  // Services, settings, drag & drop and window events (useAppBootstrap)
  const { isDraggingOver, setIsDraggingOver, bootState } = useAppBootstrap({
    refreshDevices,
    loadLibrary,
    loadThemes,
    refreshQueue,
    setAppVersion,
    setLanguage,
    setSeekFadeEnabled,
    setCloseToTray,
    setAutoFetchCoversBg,
    setCrossfadeDuration,
    setBassBoost,
    setStereoWidenerActive,
    setStereoWidenerAmount,
    setLimiterEnabled,
    setEqAutoStartup,
    handleDropPaths,
    stereoWidenerActive,
    stereoWidenerAmount,
  });

  // Playback session and autosave (useSessionManager)
  const sessionManager = useSessionManager({
    status,
    setStatus,
    filePath,
    setFilePath,
    currentPlayingTrack,
    activeTrackId,
    setActiveTrackId,
    volumeUnit,
    setVolumeUnit,
    nowPlayingVisualMode,
    setNowPlayingVisualMode,
    currentAlbum,
    initialStartupPositionRef,
    showMessage,
    loc,
  });






  // MusicBrainz release search and cover downloads (useMusicBrainzManager)
  const musicBrainzManager = useMusicBrainzManager({
    setAlbums,
    loadLibrary,
    showMessage,
    loc,
    status,
    albums,
    currentAlbum,
    currentPlayingTrack,
    setTrackDirectCover,
  });
  const { handleFetchCurrentTrackCover, handleUploadCustomCoverDirect } = musicBrainzManager;

  // Smart Auto-DJ / Infinity Queue (useInfinityQueue)
  const {
    infinityQueue,
    handleToggleInfinityQueue,
  } = useInfinityQueue({
    status,
    queue,
    currentPlayingTrack,
    tracks,
    albums,
    refreshQueue,
    showMessage,
    loc,
  });







  // Sleep Timer
  const {
    sleepTimerRemainingSec,
    sleepTimerTargetMode,
    sleepTimerFadeOut,
    isSleepTimerOpen,
    setIsSleepTimerOpen,
    handleSetSleepTimer,
    handleCancelSleepTimer,
  } = useSleepTimer({
    statusRef,
    filePath,
    showMessage,
    loc,
  });



  const { handleExportProfileBackup, handleImportProfileBackup } = useProfileBackup({
    importTitle: loc.settings.importBackupBtn,
    errorPrefix: t.common.errorPrefix,
    refreshPlaylists,
    loadLibrary,
    showMessage,
  });

  const handleToggleCloseToTray = async (enabled: boolean) => {
    setCloseToTray(enabled);
    try {
      await setSetting('close_to_tray', String(enabled));
      showMessage(
        enabled
          ? t.notifications.minimizeTrayOn
          : t.notifications.minimizeTrayOff
      );
    } catch (e: unknown) {
      console.warn('Failed to save close_to_tray:', e);
    }
  };

  const handleToggleAutoFetchCoversBg = async (enabled: boolean) => {
    setAutoFetchCoversBg(enabled);
    try {
      await setSetting('auto_fetch_covers_bg', String(enabled));
    } catch (e: unknown) {
      console.warn('Failed to save auto_fetch_covers_bg:', e);
    }
  };

  const handleTriggerBackgroundCoverFetch = async () => {
    if (isTriggeringCoverSyncRef.current || coverSyncProgress.running) return;
    isTriggeringCoverSyncRef.current = true;
    setCoverSyncProgress((prev) => (prev.running ? prev : { running: true, processed: 0, total: 0 }));
    try {
      const res = await invoke<CoverSyncDispatchResult>('trigger_background_cover_fetch');
      setCoverSyncProgress(res.progress);
      if (res.started) {
        showMessage(loc.settings.autoFetchCoversStarted);
      } else if (!res.already_running) {
        showMessage(loc.library.syncMissingCoversUpToDate);
      }
    } catch (e: unknown) {
      setCoverSyncProgress({ running: false, processed: 0, total: 0 });
      showMessage(`${t.common.errorPrefix} ${errorMessage(e)}`, true);
    } finally {
      isTriggeringCoverSyncRef.current = false;
    }
  };

  const handleTrackKeyBpmUpdated = (trackId: number, bpm: number, keyName: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, bpm, initial_key: keyName } : t))
    );
  };

  // ============================================
  // ============================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ============================================
  // ============================================
  // TRANSCODING & AUDIO EXPORT
  // ============================================
  const transcodeManager = useTranscodeManager({
    filePath,
    setFilePath,
    currentPlayingTrack,
    status,
    loopPointA,
    loopPointB,
    currentTrackBookmarks,
    activeTrackId,
    reverbEnabled,
    reverbLevel,
    language,
    loc,
    t: loc,
    showMessage,
    setSettingsTab,
    isSettingsOpen,
    settingsTab,
    setIsSettingsOpen,
    refreshTrackBookmarks,
    handleAddTrackToQueue,
    loadLibrary,
    setTracks,
    setAlbums,
  });
  const {
    transcodeOutput,
    isTranscoding,
    transcodeProgress,
    transcodeElapsedSeconds,
    lastExportedTrack,
    setLastExportedTrack,
    handleUseCurrentTrackAsSource,
    handleExportLoopFromModal,
    handleSaveLoopAsBookmarks,
  } = transcodeManager;

  useHotkeysManager({
    statusRef,
    handlePlayPause,
    handleNext,
    handlePrevious,
    handleSeek,
    handleVolumeChange,
    handleToggleMute,
    volumeCurve,
    handleToggleShuffle,
    handleCycleLoopMode,
    handlePitchChange,
    handleTempoChange,
    handleResetDsp,
    toggleMiniPlayer,
    setIsBigScreen,
    setIsSettingsOpen,
    setIsQueueOpen,
    setIsQuickLoadOpen,
    setShowPlaylistModal,
    setIsScanFolderOpen,
    setIsShortcutsModalOpen,
    setIsCommandPaletteOpen,
    setShowLyrics,
    setLoopPointA,
    setLoopPointB,
    setActiveTab,
    handleIncreaseScale,
    handleDecreaseScale,
    handleResetScale,
    formatTime,
    formatVolumeValue,
    showMessage,
    t: loc,
    librarySearchInputRef,
  });



  const settingsModalProps = useAppSettingsModalProps({
    language,
    loc,
    appVersion,
    updateManager,
    audioSettings,
    transcodeManager,
    themeManager,
    modalManager,
    sessionManager,
    scrobblerManager,
    dspManager,
    playbackController,
    masteringEffects,
    audioDevices: {
      instantVolume,
      setInstantVolume,
      volumeUnit,
      handleSetVolumeUnit,
      volumeCurve,
      handleSetVolumeCurve,
      volumeOsdPosition,
      setVolumeOsdPosition,
      recapOptIn,
      setRecapOptIn,
      desktopNotificationsEnabled,
      setDesktopNotificationsEnabled,
      albumPlaybackMode,
      setAlbumPlaybackMode,
    },
    transcode: {
      currentPlayingTrack,
      status,
      filePath,
      setFilePath,
      reverbEnabled,
      reverbLevel,
      loopPointA,
      loopPointB,
      currentTrackBookmarks,
      lastExportedTrack,
      setLastExportedTrack,
      handlePlayLibraryTrack,
      handleAddTrackToQueue,
      setTrackToAddToPlaylist,
      setShowPlaylistModal,
      handleOpenContainingFolder,
      showMessage,
      handleUseCurrentTrackAsSource,
    },
    themes: {
      setLanguage,
      buttonGlowEnabled,
      setButtonGlowEnabled,
      customBgPath,
      setCustomBgPath,
      themeBgImage,
      handlePickWallpaperFromDisk,
      handleWallpaperDrop,
      handleUploadBgImage,
      handleRemoveBgImage,
      handleSaveBackgroundSettings,
      handleSelectIconStyle,
      handleExportTheme,
      handleImportTheme,
    },
    backup: {
      handleExportProfileBackup,
      handleImportProfileBackup,
      closeToTray,
      handleToggleCloseToTray,
      autoFetchCoversBg,
      handleToggleAutoFetchCoversBg,
      handleTriggerBackgroundCoverFetch,
      coverSyncProgress,
      discordRpcEnabled,
      discordRpcConnected,
      discordClientId,
      handleToggleDiscordRpc,
      handleSaveDiscordClientId,
      crossfadeDuration,
      handleCrossfadeDurationChange,
    },
  });

  const mainRouterProps = useMainRouterProps({
    audioSettings,
    layoutMaxWidth,
    language,
    loc,
    status,
    activeTrackId,
    currentPlayingTrack,
    tracks,
    albums,
    currentAlbum,
    currentCover,
    cleanLiveTitle,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    filePath,
    setFilePath,
    volumeUnit,
    formatVolumeValue,
    handleToggleVolumeUnit,
    seekFadeEnabled,
    handleToggleSeekFade,
    infinityQueue,
    handleToggleInfinityQueue,
    sleepTimerRemainingSec,
    sleepTimerTargetMode,
    setIsSleepTimerOpen,
    setActiveTab,
    showLyrics,
    setShowLyrics,
    nowPlayingVisualMode,
    handleSelectNowPlayingVisualMode,
    vinylRpm,
    handleSelectVinylRpm,
    tapeSpeed,
    handleSelectTapeSpeed,
    tapeType,
    handleSelectTapeType,
    dspBadgeText,
    dspBadgeTitle,
    dspCombination,
    trackWaveformPeaks,
    trackWaveformBands,
    isWaveformLoading,
    filteredQueueItems,
    totalQueueDurationMs,
    formatTotalDuration,
    queueListRef,
    queueStartIndex,
    queueEndIndex,
    queueTopSpacer,
    queueBottomSpacer,
    handleOpenCoverPicker,
    handleUploadCustomCoverDirect,
    handlePickFiles,
    handleTriggerBackgroundCoverFetch,
    coverSyncProgress,
    formatTime,
    formatTimeMs,
    showMessage,
    uiScale,
    activeTrackKeyBpm,
    eqAutoStartup,
    handleToggleEqAutoStartup,
    handleApplySignatureProfile,
    // Bundles:
    library: libraryManager,
    libraryActions,
    modals: modalManager,
    playback: playbackController,
    dsp: dspManager,
    queueManager: playbackQueue,
    playlistsManager: playlistManager,
    musicbrainz: musicBrainzManager,
    mastering: masteringEffects,
  });

  const appModalsProps = useAppModalsProps({
    modals: modalManager,
    library: libraryManager,
    libraryActions,
    playback: playbackController,
    dsp: dspManager,
    queueManager: playbackQueue,
    playlistsManager: playlistManager,
    handleTrackKeyBpmUpdated,
    language,
    loc,
    status,
    currentPlayingTrack,
    currentAlbum,
    currentCover,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    filePath,
    activeTrackId,
    loopPointA,
    loopPointB,
    setLoopPointA,
    setLoopPointB,
    crossfadeDuration,
    setTrackDirectCover,
    showDesktopLyrics,
    setShowDesktopLyrics,
    isSleepTimerOpen,
    setIsSleepTimerOpen,
    sleepTimerRemainingSec,
    sleepTimerTargetMode,
    sleepTimerFadeOut,
    handleSetSleepTimer,
    handleCancelSleepTimer,
    handleCrossfadeDurationChange,
    setStatus,
    handleExportLoopFromModal,
    handleSaveLoopAsBookmarks,
    setLanguage,
    recapOptIn,
    setRecapOptIn,
    instantVolume,
    setInstantVolume,
    volumeOsdPosition,
    setVolumeOsdPosition,
    setAmbienceMode,
    setIsBigScreen,
    setActiveTab,
    showMessage,
  });

  const openUpdatesSettings = useCallback(() => {
    setSettingsTab('updates');
    setIsSettingsOpen(true);
  }, [setSettingsTab, setIsSettingsOpen]);

  const appHeaderProps = useAppHeaderProps({
    appVersion,
    updateAvailable: updateManager.hasUpdate,
    updateTitle: updateManager.installed
      ? loc.updates.badgeInstalledTitle
      : fmt(loc.updates.badgeTitle, updateManager.info?.latest_version ?? ''),
    onOpenUpdates: openUpdatesSettings,
    themeManager,
    modalManager,
    // Tabs that redirect to Settings are replaced with `player` right away (effect above).
    activeTab: isMainTab(activeTab) ? activeTab : 'player',
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
  });

  const bottomDockProps = useBottomPlaybackDockProps({
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
    formatTime,
    formatVolumeValue,
    mainContentRef,
    setActiveTab,
    handleOpenContainingFolder,
    playbackController,
    dspManager,
    toggleMiniPlayer,
  });

  // Floating mini-player view (PiP)
  if (isMiniPlayer) {
    return (
      <MiniPlayerWidget
        title={effectiveDisplayTitle}
        artist={effectiveDisplayArtist}
        coverUrl={currentCover}
        isPlaying={status.state === 'Playing'}
        positionMs={status.position_ms}
        durationMs={status.duration_ms}
        volume={status.volume}
        pitchSemitones={status.pitch_semitones}
        tempoRatio={status.tempo_ratio}
        currentLang={language}
        volumeUnit={volumeUnit}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleVolumeUnit={handleToggleVolumeUnit}
        onRestore={toggleMiniPlayer}
      />
    );
  }

  return (
    <div
      className={cn(
        'relative flex size-full max-h-full flex-col overflow-hidden',
        uiScale >= 1.28 ? 'px-4.5 pt-3 pb-2' : uiScale >= 1.18 ? 'px-5 pt-3.5 pb-2.5' : 'px-6 pt-4 pb-3',
      )}
    >
      <BackgroundLayer
        themeBgImage={themeBgImage}
        themeBlur={themeBlur}
        themeOverlay={themeOverlay}
      />

      {!bootState.isReady && (
        <StartupSplash bootState={bootState} appVersion={appVersion} loc={loc} />
      )}

      {/* On-screen volume OSD with a configurable position */}
      <VolumeOsd volume={status.volume} position={volumeOsdPosition} unit={volumeUnit} />

      {/* Anime ambient effect (Sakura Petals / Neon Rain) */}
      <AnimeAmbienceFX mode={isBigScreen ? 'off' : ambienceMode} opacity={ambienceOpacity} />

      {/* Main UI container (hidden without losing state while the Kiosk full-screen mode is active) */}
      <div
        inert={!bootState.isReady ? true : undefined}
        className={cn('relative z-1 h-full min-h-0 flex-1 flex-col overflow-hidden', isBigScreen ? 'hidden' : 'flex')}
      >

        <DragDropOverlay
          isDraggingOver={isDraggingOver}
          onDismiss={() => setIsDraggingOver(false)}
          loc={loc}
        />
        {/* Top bar / header */}
        <AppHeader {...appHeaderProps} />

        {/* Notification message */}
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.level === 'error' ? 'alert' : 'status'}
            onClick={() => dismissToast(toast.id)}
            className="mb-2 cursor-pointer rounded-xl border border-accent-purple bg-accent-purple/20 px-4 py-2.5 text-sm text-fg"
          >
            {toast.level === 'error' && <AlertTriangle size={14} className="icon-inline mr-1.5" />}
            {toast.text}
          </div>
        ))}

        {/* Main content */}
        <MainContentRouter
          mainContentRef={mainContentRef}
          activeTab={activeTab}
          isPlayerScrolledDown={isPlayerScrolledDown}
          layoutMaxWidth={layoutMaxWidth}
          {...mainRouterProps}
        />

        {/* Floating bottom player dock (mini-player) */}
        <BottomPlaybackDock {...bottomDockProps} />
        <QueueDrawer
          isOpen={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
          queue={queue}
          status={status}
          tracks={tracks}
          albums={albums}
          infinityQueue={infinityQueue}
          onToggleInfinityQueue={handleToggleInfinityQueue}
          onClearQueue={handleClearQueue}
          onPlayQueueIndex={handlePlayQueueIndex}
          onMoveQueueItem={handleMoveQueueItem}
          onRemoveFromQueue={handleRemoveFromQueue}
          formatTime={formatTime}
          loc={loc}
        />

      </div>

      {/* Immersive Kiosk / full-screen Now Playing mode (F11) */}
      {isBigScreen && (
        <BigScreenView
          title={effectiveDisplayTitle}
          artist={effectiveDisplayArtist}
          album={currentAlbum?.title || status.current_track?.album || null}
          format={currentPlayingTrack?.format || 'FLAC'}
          coverUrl={currentCover}
          trackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || null}
          isPlaying={status.state === 'Playing'}
          positionMs={status.position_ms}
          durationMs={status.duration_ms}
          volume={status.volume}
          pitchSemitones={status.pitch_semitones}
          tempoRatio={status.tempo_ratio}
          spectrum={status.spectrum}
          waveformPeaks={trackWaveformPeaks}
          waveformBands={trackWaveformBands}
          isWaveformLoading={isWaveformLoading}
          currentLang={language}
          onPlayPause={handlePlayPause}
          onPrev={handlePrevious}
          onNext={handleNext}
          onSeek={handleSeek}
          onSeekPreview={handleSeekPreview}
          onSeekCommit={handleSeekCommit}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          formatVolumeValue={formatVolumeValue}
          volumeUnit={volumeUnit}
          onToggleVolumeUnit={handleToggleVolumeUnit}
          onClose={() => setIsBigScreen(false)}
          onFetchCover={handleFetchCurrentTrackCover}
          onUploadCover={() => handleUploadCustomCoverDirect(currentAlbum)}
          onCreateStemProject={() => {
            setCreateStemProjectTrack(currentPlayingTrack || null);
            setIsCreateStemProjectOpen(true);
          }}
        />
      )}

      <AppSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTab={settingsTab}
        onSelectTab={setSettingsTab}
        loc={loc}
        devicesProps={settingsModalProps.devicesProps}
        transcodeProps={settingsModalProps.transcodeProps}
        themesProps={settingsModalProps.themesProps}
        updatesProps={settingsModalProps.updatesProps}
        aboutProps={settingsModalProps.aboutProps}
        backupProps={settingsModalProps.backupProps}
        updateAvailable={updateManager.hasUpdate}
      />

      <AppModalsContainer {...appModalsProps} />
      {/* Floating Background Export Badge */}
      <BackgroundExportBadge
        isTranscoding={isTranscoding}
        activeTab={activeTab}
        isPlayerScrolledDown={isPlayerScrolledDown}
        transcodeProgress={transcodeProgress}
        transcodeElapsedSeconds={transcodeElapsedSeconds}
        transcodeOutput={transcodeOutput}
        onOpenTranscodeSettings={() => {
          setSettingsTab('transcode');
          setIsSettingsOpen(true);
        }}
        loc={loc}
      />
    </div>
  );
}
