import type { AppTab } from './types/navigation';
import { isMainTab } from './types/navigation';
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
import { useState, useEffect, useRef } from 'react';
import { invoke } from './api/ipc';
import { setSetting } from './api/settings';
import {
  type TapeType,
  MiniPlayerWidget,
  AnimeAmbienceFX,
  VolumeOsd,
  type VolumeOsdPosition,
} from './components/player';
import { BigScreenView } from './views/player/BigScreenView';

import { useQueueVirtualScroll } from './hooks/useQueueVirtualScroll';
import { useAmbienceMode } from './hooks/useAmbienceMode';
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
import { fmt } from './utils/fmt';
import { parseBoolean, usePersistedState } from './hooks/usePersistedState';
import { useToasts } from './hooks/useToasts';

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

  // Procent głośności dla dynamicznego wypełnienia suwaka (postęp liczą komponenty z `useLiveStatus`)
  const volumeProgressPercent = Math.min(100, Math.max(0, (status.volume ?? 1) * 100));

  // Język interfejsu (domyślnie angielski: en, z opcją wyboru: pl, de, fi, la)
  const [language, setLanguage] = useState<Language>('en');
  const loc = getTranslations(language);
  const t = loc;

  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);

  // Kolejka komunikatów (useToasts): stabilny `showMessage` dla hooków, osobny licznik czasu
  // dla każdego komunikatu. Komunikaty informacyjne są celowo pomijane; widoczne są tylko błędy.
  const { toasts, showMessage, dismiss: dismissToast } = useToasts();

  const mainContentRef = useRef<HTMLElement | null>(null);

  // Zarządzanie biblioteką audio, filtrami, sortowaniem i skanerem (useLibraryManager)
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

  // Konfiguracja urządzeń audio, ReplayGain, Crossfeed i Silence Trimming (useAudioSettings)
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

  // Centralne zarządzanie wszystkimi oknami dialogowymi, modalnymi i szufladami (useModalManager)
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

  // Zarządzanie silnikami DSP, korektorem EQ, pogłosem i profilami klimatycznymi (useDspManager)
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

  // Stan trybu wizualnego w sekcji Now Playing: okładka, winyl hi-fi, szpulowiec/kaseta lub analogowy miernik VU
  const [nowPlayingVisualMode, setNowPlayingVisualMode] = useState<'cover' | 'turntable' | 'tape' | 'vumeter'>(() => {
    try {
      const saved = localStorage.getItem('auralune_nowplaying_visual_mode');
      if (saved === 'cover' || saved === 'turntable' || saved === 'tape' || saved === 'vumeter') return saved;
    } catch { }
    return 'cover';
  });

  const handleSelectNowPlayingVisualMode = (mode: 'cover' | 'turntable' | 'tape' | 'vumeter') => {
    setNowPlayingVisualMode(mode);
    try {
      localStorage.setItem('auralune_nowplaying_visual_mode', mode);
    } catch { }
  };

  // Stan parametrów wizualnych: RPM winylu, prędkość taśmy, typ taśmy
  const [vinylRpm, setVinylRpm] = useState<33 | 45>(() => {
    try {
      const saved = localStorage.getItem('auralune_vinyl_rpm');
      if (saved === '33' || saved === '45') return Number(saved) as 33 | 45;
    } catch { }
    return 33;
  });

  const handleSelectVinylRpm = (rpm: 33 | 45) => {
    setVinylRpm(rpm);
    try {
      localStorage.setItem('auralune_vinyl_rpm', String(rpm));
    } catch { }
  };

  const [tapeSpeed, setTapeSpeed] = useState<'7.5' | '3.75'>(() => {
    try {
      const saved = localStorage.getItem('auralune_tape_speed');
      if (saved === '7.5' || saved === '3.75') return saved;
    } catch { }
    return '7.5';
  });

  const handleSelectTapeSpeed = (speed: '7.5' | '3.75') => {
    setTapeSpeed(speed);
    try {
      localStorage.setItem('auralune_tape_speed', speed);
    } catch { }
  };

  const [tapeType, setTapeType] = useState<TapeType>(() => {
    try {
      const saved = localStorage.getItem('auralune_tape_type');
      if (saved === 'TYPE_I' || saved === 'TYPE_II' || saved === 'METAL') return saved;
    } catch { }
    return 'TYPE_II';
  });

  const handleSelectTapeType = (type: TapeType) => {
    setTapeType(type);
    try {
      localStorage.setItem('auralune_tape_type', type);
    } catch { }
  };
  const [activeTab, setActiveTab] = useState<AppTab>('player');
  const [closeToTray, setCloseToTray] = useState<boolean>(true);

  // Zachowanie odtwarzania albumów i playlist (Autoplay & Kolejka)
  const [albumPlaybackMode, setAlbumPlaybackMode] = useState<AlbumPlaybackBehavior>(() => {
    try {
      const saved = localStorage.getItem('auralune_album_playback_mode') as AlbumPlaybackBehavior;
      if (saved === 'replace' || saved === 'append' || saved === 'single') {
        return saved;
      }
    } catch { }
    return 'replace'; // Domyślnie: zastąp kolejkę i odtwarzaj cały album z autoplay & skip
  });

  // Płynny Crossfade & Zaawansowane efekty DSP / Mastering (useAudioMasteringEffects)
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

  // Pierwsze uruchomienie (Onboarding) & Recap & OSD & Klucz/BPM
  const [recapOptIn, setRecapOptIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_recap_opt_in') !== 'false';
    } catch {
      return true;
    }
  });
  const [volumeOsdPosition, setVolumeOsdPosition] = useState<VolumeOsdPosition>(() => {
    try {
      return (localStorage.getItem('auralune_volume_osd_position') as VolumeOsdPosition) || 'bottom-center';
    } catch {
      return 'bottom-center';
    }
  });
  const [instantVolume, setInstantVolume] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_instant_volume') !== 'false';
    } catch {
      return true;
    }
  });

  // Opcja podświetlenia kursorowego przycisków (Hover glow)
  const [buttonGlowEnabled, setButtonGlowEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_button_glow_enabled');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.body.classList.toggle('disable-button-glow', !buttonGlowEnabled);
    try {
      localStorage.setItem('auralune_button_glow_enabled', String(buttonGlowEnabled));
    } catch { }
  }, [buttonGlowEnabled]);


  const {
    volumeUnit,
    setVolumeUnit,
    handleSetVolumeUnit,
    handleToggleVolumeUnit,
    formatVolumeValue,
  } = useVolumeUnit({ loc: t, showMessage });

  // Stan ręcznego wpisywania wartości DSP (Pitch, Tempo, Speed)
  const initialStartupPositionRef = useRef<number | null>(null);

  const [trackDirectCover, setTrackDirectCover] = useState<string | null>(null);

  // ZARZĄDZANIE PLAYLISTAMI & RADIEM
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
  // Stacja zapamiętana w stanie UI jest aktywna tylko dopóki silnik gra strumień
  // (po przejściu na bibliotekę / projekt stemów nie może przesłaniać utworu).
  const currentRadioStation = resolveActiveRadioStation(storedRadioStation, status.current_track?.uri);

  // Kolejka odtwarzania, reorder, kolumny i przeciąganie (usePlaybackQueue)
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

  // Zarządzanie motywami & skalą (useThemeManager)
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

  // Kontroler transportu, pętli A-B, zakładek i odpytywania statusu odtwarzacza (usePlaybackController)
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

  // Dynamiczna wersja aplikacji (z package.json / Cargo.toml)
  const [appVersion, setAppVersion] = useState<string>(
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.3'
  );

  // Stan tekstów piosenek (Synchronized Lyrics LRC / LRCLIB)
  const [showLyrics, setShowLyrics] = useState(false);

  // Stan pływającego widżetu tekstu na pulpicie (Desktop Lyrics Overlay)
  // Zgodnie z wymaganiem: widżet nie uruchamia się samoczynnie przy starcie aplikacji,
  // użytkowniczka decyduje w UI kiedy go pokazać/schować.
  const [showDesktopLyrics, setShowDesktopLyrics] = useState<boolean>(false);

  const toggleDesktopLyrics = () => {
    setShowDesktopLyrics((prev) => !prev);
  };

  // Stan Mini-Player (Floating PiP Widget)
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);

  const toggleMiniPlayer = async () => {
    const next = !isMiniPlayer;
    try {
      await invoke('set_mini_player_mode', { mini: next });
      setIsMiniPlayer(next);
    } catch (e) {
      console.error('Błąd przełączania trybu mini-player:', e);
    }
  };

  // Stan efektów otoczenia Anime (Sakura Petals / Cyberpunk Rain / Meteors / Matrix / Momiji)
  const { ambienceMode, setAmbienceMode, cycleAmbienceMode } = useAmbienceMode({
    loc: t,
    showMessage,
  });

  // Stan trybu pełnoekranowego Kiosk / Big Screen Now Playing
  const [isBigScreen, setIsBigScreen] = useState(false);

  // Powiadomienia systemowe Linuksa (libnotify / D-Bus)
  // Wcześniej przełącznik zapisywał `auralune_notifications_enabled`, a start czytał inny klucz,
  // więc wyłączenie powiadomień nie przetrwało restartu — stary klucz jest migrowany.
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

  // Wykrywanie przewinięcia widoku poniżej górnego panelu odtwarzacza
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

  // Aktualnie odtwarzany utwór, okładka albumu, parametry DSP i wizualizacja przebiegu (useCurrentTrackInfo)
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

  // Akcje odtwarzania z biblioteki, operacje plikowe, zakładki i profile dźwiękowe (useLibraryPlaybackActions)
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

  // Automatyczne przekierowanie starych zakładek do okna Ustawień
  useEffect(() => {
    if (activeTab === 'themes' || activeTab === 'devices' || activeTab === 'transcode') {
      setSettingsTab(activeTab);
      setIsSettingsOpen(true);
      setActiveTab('player');
    }
  }, [activeTab, setIsSettingsOpen, setSettingsTab]);



  // Inicjalizacja usług, ustawień oraz zdarzeń drag & drop i okna (useAppBootstrap)
  const { isDraggingOver, setIsDraggingOver } = useAppBootstrap({
    refreshDevices,
    loadLibrary,
    loadThemes,
    refreshQueue,
    setAppVersion,
    setLanguage,
    setSeekFadeEnabled,
    setCloseToTray,
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

  // Sesja odtwarzania i autozapis (useSessionManager)
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






  // Obsługa wyszukiwania wydań w MusicBrainz i pobierania okładek (useMusicBrainzManager)
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

  // Inteligentny Auto-DJ / Infinity Queue (useInfinityQueue)
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







  // Wyłącznik czasowy (Sleep Timer)
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



  // ===================================
  const handleExportProfileBackup = async () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const dest = await invoke<string | null>('pick_save_destination', {
        defaultName: `auralune-profile-backup-${dateStr}.json`,
        extension: 'json',
      });
      if (!dest) return;

      const msg = await invoke<string>('export_profile_backup', {
        destinationPath: dest,
      });
      showMessage(msg);
    } catch (err: unknown) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleImportProfileBackup = async () => {
    try {
      const filePath = await invoke<string | null>('pick_custom_file', {
        title: loc.settings.importBackupBtn,
        filter: '*.json|Kopia zapasowa Auralune (*.json)',
      });
      if (!filePath) return;

      const msg = await invoke<string>('import_profile_backup', {
        filePathOrJson: filePath,
      });
      await refreshPlaylists();
      await loadLibrary();
      showMessage(msg);
    } catch (err: unknown) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

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
      console.warn('Błąd zapisu close_to_tray:', e);
    }
  };

  const handleTrackKeyBpmUpdated = (trackId: number, bpm: number, keyName: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, bpm, initial_key: keyName } : t))
    );
  };

  // ============================================
  // ============================================
  // OBSŁUGA GLOBALNYCH SKRÓTÓW KLAWISZOWYCH
  // ============================================
  // ============================================
  // ZARZĄDZANIE TRANSKODOWANIEM & EKSPORTEM AUDIO
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
    volumeProgressPercent,
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

  const appHeaderProps = useAppHeaderProps({
    appVersion,
    themeManager,
    modalManager,
    // Zakładki przekierowujące do Ustawień są natychmiast zamieniane na `player` (efekt powyżej).
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
    volumeProgressPercent,
    formatTime,
    mainContentRef,
    setActiveTab,
    handleOpenContainingFolder,
    playbackController,
    dspManager,
    toggleMiniPlayer,
  });

  // Widok miniaturowego pływającego odtwarzacza (Floating Mini-Player / PiP)
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
        onToggleVolumeUnit={handleToggleVolumeUnit}
        onRestore={toggleMiniPlayer}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        width: '100%',
        overflow: 'hidden',
        padding: uiScale >= 1.28 ? '12px 18px 8px' : uiScale >= 1.18 ? '14px 20px 10px' : '16px 24px 12px',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <BackgroundLayer
        themeBgImage={themeBgImage}
        themeBlur={themeBlur}
        themeOverlay={themeOverlay}
      />

      {/* Ekranowe OSD głośności z konfigurowalnym położeniem */}
      <VolumeOsd volume={status.volume} position={volumeOsdPosition} unit={volumeUnit} />

      {/* Efekt otoczenia Anime (Sakura Petals / Neon Rain) */}
      <AnimeAmbienceFX mode={isBigScreen ? 'off' : ambienceMode} />

      {/* Główny kontener interfejsu (ukrywany bez utraty stanu gdy aktywny jest tryb pełnoekranowy Kiosk) */}
      <div style={{ display: isBigScreen ? 'none' : 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>

        <DragDropOverlay
          isDraggingOver={isDraggingOver}
          onDismiss={() => setIsDraggingOver(false)}
          loc={loc}
        />
        {/* Pasek górny / Nagłówek */}
        <AppHeader {...appHeaderProps} />

        {/* Komunikat powiadomień */}
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.level === 'error' ? 'alert' : 'status'}
            onClick={() => dismissToast(toast.id)}
            style={{
              padding: '10px 16px',
              marginBottom: '8px',
              borderRadius: '10px',
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid var(--accent-purple)',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {toast.level === 'error' ? `⚠️ ${toast.text}` : toast.text}
          </div>
        ))}

        {/* Główna zawartość */}
        <MainContentRouter
          mainContentRef={mainContentRef}
          activeTab={activeTab}
          isPlayerScrolledDown={isPlayerScrolledDown}
          layoutMaxWidth={layoutMaxWidth}
          {...mainRouterProps}
        />

        {/* Pływający dolny dok odtwarzacza (Mini-Player) */}
        <BottomPlaybackDock {...bottomDockProps} />
        <QueueDrawer
          isOpen={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
          queue={queue}
          status={status}
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

      {/* Tryb immersyjny Kiosk / Pełny ekran Now Playing (F11) */}
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
          currentLang={language}
          onPlayPause={handlePlayPause}
          onPrev={handlePrevious}
          onNext={handleNext}
          onSeek={handleSeek}
          onSeekPreview={handleSeekPreview}
          onSeekCommit={handleSeekCommit}
          onVolumeChange={handleVolumeChange}
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
        language={language}
        devicesProps={settingsModalProps.devicesProps}
        transcodeProps={settingsModalProps.transcodeProps}
        themesProps={settingsModalProps.themesProps}
        aboutProps={settingsModalProps.aboutProps}
        backupProps={settingsModalProps.backupProps}
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
