import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Sliders,
  Radio,
  FileAudio,
  ShieldCheck,
  Headphones,
  Sparkles,
  RefreshCw,
  Zap,
  FolderOpen,
  Music,
  Disc,
  Clock,
  Bookmark,
  RotateCcw,
  Save,
  Palette,
  Image as ImageIcon,
  Upload,
  Download,
  Copy,
  Check,
  Trash2,
  Search,
  Globe,
  CheckCircle,
  X,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Plus,
  ChevronUp,
  ChevronDown,
  FolderPlus,
  FilePlus,
  Loader2,
  UploadCloud,
  ListPlus,
  Activity,
  Settings,
  Info,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Mic2,
  Heart,
  Flame,
  ArrowUpDown,
  Keyboard,
  Moon,
  History,
  BarChart3,
} from 'lucide-react';
import { ChangelogView } from './components/ChangelogView';
import { SpectrumVisualizer } from './components/SpectrumVisualizer';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { LyricsView } from './components/LyricsView';
import { MiniPlayerWidget } from './components/MiniPlayerWidget';
import { AnimeAmbienceFX, type AmbienceMode } from './components/AnimeAmbienceFX';
import { BigScreenView } from './components/BigScreenView';
import { WaveformCanvas } from './components/WaveformCanvas';
import { CoverArtPickerModal } from './components/CoverArtPickerModal';
import { LanguageSelector } from './components/LanguageSelector';
import { TrackStatsModal, type TrackStatsData } from './components/TrackStatsModal';
import { SleepTimerModal } from './components/SleepTimerModal';
import { StatsDashboardView } from './components/StatsDashboardView';
import { LoopEditorModal, formatTimeMs } from './components/LoopEditorModal';
import { OnboardingModal } from './components/OnboardingModal';
import { VolumeOsd, type VolumeOsdPosition } from './components/VolumeOsd';
import { KeyBpmModal } from './components/KeyBpmModal';
import { AuraluneRecapModal } from './components/AuraluneRecapModal';
import { type Language, getTranslations } from './i18n';

interface EqualizerPreset {
  name: string;
  bands: number[];
}

const EQUALIZER_BANDS = [
  { freq: '31 Hz', label: 'Sub-bass' },
  { freq: '62 Hz', label: 'Bass' },
  { freq: '125 Hz', label: 'Mid-bass' },
  { freq: '250 Hz', label: 'Low Mids' },
  { freq: '500 Hz', label: 'Mids' },
  { freq: '1 kHz', label: 'Upper Mids' },
  { freq: '2 kHz', label: 'Presence' },
  { freq: '4 kHz', label: 'Treble' },
  { freq: '8 kHz', label: 'High Treble' },
  { freq: '16 kHz', label: 'Air' },
];

interface QueueItem {
  id: string;
  track_id: number | null;
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number;
}

interface PlaybackQueue {
  items: QueueItem[];
  current_index: number | null;
  loop_mode: 'None' | 'Track' | 'Queue';
  shuffle: boolean;
  shuffle_order: number[];
  shuffle_cursor: number;
}

interface QueueColumnConfig {
  showIndex: boolean;
  showCover: boolean;
  showArtist: boolean;
  showAlbum: boolean;
  showFormatBadge: boolean;
  showDuration: boolean;
  showPath: boolean;
  compactMode: boolean;
}

const DEFAULT_QUEUE_COLUMNS: QueueColumnConfig = {
  showIndex: true,
  showCover: true,
  showArtist: true,
  showAlbum: true,
  showFormatBadge: true,
  showDuration: true,
  showPath: false,
  compactMode: false,
};

interface Playlist {
  id: number;
  name: string;
  created_at: number;
  track_count: number;
}

interface ReleaseCandidateDto {
  mbid: string;
  title: string;
  artist: string;
  date: string | null;
  country: string | null;
  track_count: number | null;
  score: number;
}

interface ThemeTokens {
  bg_deep: string;
  bg_surface: string;
  bg_surface_hover: string;
  bg_card: string;
  border_subtle: string;
  border_accent: string;
  accent_pink: string;
  accent_purple: string;
  accent_cyan: string;
  accent_green: string;
  accent_amber: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  shadow_glow: string;
  shadow_card: string;
}

interface Theme {
  id: string;
  name: string;
  schema_version: number;
  tokens: ThemeTokens;
  background_ref: string | null;
  overlay_opacity: number;
  blur_radius: number;
  attribution: string | null;
}

interface DspCapabilities {
  engine: 'Bypass' | 'RubberBand' | 'SoundTouch';
  name: string;
  min_pitch_semitones: number;
  max_pitch_semitones: number;
  min_tempo_ratio: number;
  max_tempo_ratio: number;
  supports_formants: boolean;
  description: string;
}

interface DspPresetRecord {
  id: number;
  name: string;
  engine: string;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
}

interface PlaybackStatus {
  state: 'Playing' | 'Paused' | 'Stopped';
  position_ms: number;
  duration_ms: number | null;
  volume: number;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
  engine: 'Bypass' | 'RubberBand' | 'SoundTouch';
  capabilities: DspCapabilities;
  loop_mode?: 'None' | 'Track' | 'Queue';
  shuffle?: boolean;
  current_track?: QueueItem | null;
  equalizer_enabled?: boolean;
  equalizer_bands?: number[];
  spectrum?: number[];
}

interface AudioCardProfile {
  name: string;
  description: string;
  available: boolean;
  is_pro_audio: boolean;
  bluetooth_codec: string | null;
}

interface AudioCard {
  index: number;
  name: string;
  description: string;
  is_bluetooth: boolean;
  active_profile: string | null;
  profiles: AudioCardProfile[];
}

interface TrackRecord {
  id: number;
  path: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album_id: number | null;
  disc_no: number | null;
  track_no: number | null;
  duration_ms: number;
  format: string;
  sample_rate: number;
  channels: number;
  bit_depth: number | null;
  file_size: number;
  modified_time: number;
  is_favorite?: boolean | null;
  play_count?: number | null;
  last_played_at?: number | null;
  total_play_time_ms?: number | null;
}

interface AlbumRecord {
  id: number;
  title: string;
  album_artist: string;
  year: number | null;
  cover_path: string | null;
  release_mbid?: string | null;
}

interface ScanSummaryDto {
  total_files_found: number;
  new_or_updated_tracks: number;
  skipped_unchanged: number;
  errors: number;
}

export default function App() {
  const [filePath, setFilePath] = useState('tests/fixtures/test_sine_440hz.wav');
  const [status, setStatus] = useState<PlaybackStatus>({
    state: 'Stopped',
    position_ms: 0,
    duration_ms: null,
    volume: 1.0,
    pitch_semitones: 0.0,
    tempo_ratio: 1.0,
    rate_ratio: 1.0,
    engine: 'RubberBand',
    capabilities: {
      engine: 'RubberBand',
      name: 'Rubber Band (R3 Fine)',
      min_pitch_semitones: -24.0,
      max_pitch_semitones: 24.0,
      min_tempo_ratio: 0.15,
      max_tempo_ratio: 4.0,
      supports_formants: false,
      description: 'Precision R3 engine (studio quality)',
    },
    equalizer_enabled: false,
    equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spectrum: Array(16).fill(0.05),
  });

  // Procent postępu odtwarzania oraz głośności dla dynamicznego wypełnienia suwaków (anime aesthetic)
  const seekProgressPercent = status.duration_ms && status.duration_ms > 0
    ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
    : 0;
  const volumeProgressPercent = Math.min(100, Math.max(0, (status.volume ?? 1) * 100));

  // Język interfejsu (domyślnie angielski: en, z opcją wyboru: pl, de, fi, la)
  const [language, setLanguage] = useState<Language>('en');
  const loc = getTranslations(language);
  const t = loc;
  const currentLang = language;

  // Stan okna dialogowego Cover Art Picker
  const [coverPickerState, setCoverPickerState] = useState<{
    isOpen: boolean;
    albumId: number;
    title: string;
    artist: string;
  } | null>(null);

  const handleLanguageChange = async (newLang: Language) => {
    setLanguage(newLang);
    try {
      await invoke('set_app_setting', { key: 'app_language', value: newLang });
      showMessage(`${t.notifications.langChanged}: ${newLang.toUpperCase()}`);
    } catch (e) {
      console.warn('Błąd zapisu app_language:', e);
    }
  };

  const handleOpenCoverPicker = (album: AlbumRecord) => {
    setCoverPickerState({
      isOpen: true,
      albumId: album.id,
      title: album.title,
      artist: album.album_artist,
    });
  };

  const handleUploadCustomCoverDirect = async (album?: AlbumRecord | null) => {
    try {
      const selectedPath = await invoke<string | null>('pick_image_file');
      if (selectedPath) {
        const targetAlbumId = album?.id || currentAlbum?.id || 0;
        const targetTitle = album?.title || currentAlbum?.title || status.current_track?.album || status.current_track?.title || 'Unknown Album';
        const targetArtist = album?.album_artist || currentAlbum?.album_artist || status.current_track?.artist || 'Unknown Artist';

        const coverDataUri = await invoke<string>('apply_custom_cover_file', {
          albumId: targetAlbumId,
          filePath: selectedPath,
          albumTitle: targetTitle,
          artist: targetArtist,
          trackId: currentPlayingTrack?.id || null,
        });

        if (targetAlbumId > 0) {
          setAlbums((prev) =>
            prev.map((a) => (a.id === targetAlbumId ? { ...a, cover_path: coverDataUri } : a))
          );
        }
        showMessage(loc.covers.customCoverSaved.replace('{0}', targetTitle));
        await loadLibrary();
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Stan korektora graficznego EQ & Spectrum
  const [eqPresets, setEqPresets] = useState<EqualizerPreset[]>([]);
  const [selectedEqPreset, setSelectedEqPreset] = useState<string>('Płaski (Flat)');
  const [eqAutoStartup, setEqAutoStartup] = useState<boolean>(false);
  const [seekFadeEnabled, setSeekFadeEnabled] = useState<boolean>(true);

  // Stan zapamiętywania ustawień DSP po uruchomieniu aplikacji
  const [dspAutoStartup, setDspAutoStartup] = useState<boolean>(false);
  const dspAutoStartupRef = useRef<boolean>(false);
  const lastActiveDspEngineRef = useRef<'RubberBand' | 'SoundTouch'>('RubberBand');
  const dspSaveTimeoutRef = useRef<any>(null);

  const [cards, setCards] = useState<AudioCard[]>([]);
  const [activeTab, setActiveTab] = useState<'player' | 'library' | 'playlists' | 'dsp' | 'stats' | 'devices' | 'transcode' | 'themes'>('player');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'themes' | 'devices' | 'transcode' | 'about' | 'changelog'>('themes');
  const [isQuickLoadOpen, setIsQuickLoadOpen] = useState(false);

  // Pierwsze uruchomienie (Onboarding) & Recap & OSD & Klucz/BPM
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_onboarding_completed') !== 'true';
    } catch {
      return false;
    }
  });
  const [recapOptIn, setRecapOptIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_recap_opt_in') !== 'false';
    } catch {
      return true;
    }
  });
  const [isRecapModalOpen, setIsRecapModalOpen] = useState<boolean>(false);
  const [isKeyBpmModalOpen, setIsKeyBpmModalOpen] = useState<boolean>(false);
  const [volumeOsdPosition, setVolumeOsdPosition] = useState<VolumeOsdPosition>(() => {
    try {
      return (localStorage.getItem('auralune_volume_osd_position') as VolumeOsdPosition) || 'bottom-center';
    } catch {
      return 'bottom-center';
    }
  });
  const [instantVolume, setInstantVolume] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_instant_volume') === 'true';
    } catch {
      return false;
    }
  });

  // Reverb DSP State
  const [reverbEnabled, setReverbEnabled] = useState<boolean>(false);
  const [reverbRoomSize, setReverbRoomSize] = useState<number>(0.65);
  const [reverbDamping, setReverbDamping] = useState<number>(0.25);
  const [reverbWidth, setReverbWidth] = useState<number>(1.0);
  const [reverbLevel, setReverbLevel] = useState<number>(0.35);

  // Stan ręcznego wpisywania wartości DSP (Pitch, Tempo, Speed)
  const [editingPitch, setEditingPitch] = useState<string | null>(null);
  const [editingTempo, setEditingTempo] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);

  // Stan Wyłącznika Czasowego (Sleep Timer)
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);
  const [sleepTimerTargetMode, setSleepTimerTargetMode] = useState<'time' | 'end_of_track' | null>(null);
  const [sleepTimerFadeOut, setSleepTimerFadeOut] = useState(true);
  const preFadeVolumeRef = useRef<number | null>(null);
  const lastTrackUriRef = useRef<string | null>(null);

  // Stan kolejki odtwarzania (Etap 7)
  const [queue, setQueue] = useState<PlaybackQueue>({
    items: [],
    current_index: null,
    loop_mode: 'None',
    shuffle: false,
    shuffle_order: [],
    shuffle_cursor: 0,
  });
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Stan playlist (Etap 7)
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackRecord[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<TrackRecord | null>(null);
  const [transcodeOutput, setTranscodeOutput] = useState('tests/fixtures/converted_sample.opus');
  const [transcodeFormat, setTranscodeFormat] = useState<'Opus' | 'Flac' | 'Wav'>('Opus');
  const [transcodeBitrate, setTranscodeBitrate] = useState(192);
  const [isPickingSource, setIsPickingSource] = useState(false);
  const [isPickingDestination, setIsPickingDestination] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Stan motywów Anime (Etap 5)
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [themeOverlay, setThemeOverlay] = useState<number>(0.4);
  const [themeBlur, setThemeBlur] = useState<number>(8.0);
  const [themeBgImage, setThemeBgImage] = useState<string | null>(null);
  const [customBgPath, setCustomBgPath] = useState<string>('');
  const [isDraggingWallpaper, setIsDraggingWallpaper] = useState<boolean>(false);
  const [jsonExportContent, setJsonExportContent] = useState<string>('');
  const [jsonImportContent, setJsonImportContent] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Styl ikony aplikacji (Neon Lineout vs Classic Anime)
  const [appIconStyle, setAppIconStyle] = useState<'lineout' | 'classic'>('lineout');

  // Stan biblioteki
  const [scanFolder, setScanFolder] = useState('tests/fixtures');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummaryDto | null>(null);
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);
  const [statsModalTrack, setStatsModalTrack] = useState<TrackStatsData | null>(null);
  const isPlayingLibraryTrackRef = useRef<boolean>(false);

  // Pomocnik normalizujący tekst do bezpiecznego, niewrażliwego na akcenty i wielkość liter wyszukiwania
  const normalizeStr = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Stan przeciągania plików (Drag & Drop)
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Stan konfiguracji kolumn kolejki odtwarzania
  const [queueColumns, setQueueColumns] = useState<QueueColumnConfig>(() => {
    try {
      const saved = localStorage.getItem('auralune_queue_columns');
      if (saved) {
        return { ...DEFAULT_QUEUE_COLUMNS, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_QUEUE_COLUMNS;
  });

  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [draggedQueueIdx, setDraggedQueueIdx] = useState<number | null>(null);
  const [dragOverQueueIdx, setDragOverQueueIdx] = useState<number | null>(null);

  // Stan pętli A-B (A-B Repeat)
  const [loopPointA, setLoopPointA] = useState<number | null>(null);
  const [loopPointB, setLoopPointB] = useState<number | null>(null);
  const [isLoopEditorOpen, setIsLoopEditorOpen] = useState(false);

  // Stan bieżącej zakładki utworu
  const [currentBookmark, setCurrentBookmark] = useState<number | null>(null);


  // Stan okna skrótów klawiszowych
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Stan wyszukiwarki w kolejce
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const lastNonZeroVolRef = useRef<number>(1.0);

  // Stan tekstów piosenek (Synchronized Lyrics LRC / LRCLIB)
  const [showLyrics, setShowLyrics] = useState(false);

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

  // Stan efektów otoczenia Anime (Sakura Petals / Cyberpunk Rain)
  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() => {
    try {
      const saved = localStorage.getItem('auralune_ambience_mode');
      if (saved === 'sakura' || saved === 'neon_rain' || saved === 'off') {
        return saved as AmbienceMode;
      }
    } catch (_) {}
    return 'off';
  });

  const cycleAmbienceMode = () => {
    setAmbienceMode((prev) => {
      const next: AmbienceMode = prev === 'off' ? 'sakura' : prev === 'sakura' ? 'neon_rain' : 'off';
      try {
        localStorage.setItem('auralune_ambience_mode', next);
      } catch (_) {}
      showMessage(
        next === 'sakura'
          ? t.notifications.ambienceSakura
          : next === 'neon_rain'
          ? t.notifications.ambienceNeon
          : t.notifications.ambienceOff
      );
      return next;
    });
  };

  // Stan trybu pełnoekranowego Kiosk / Big Screen Now Playing
  const [isBigScreen, setIsBigScreen] = useState(false);

  // Filtr inteligentnych playlist w Bibliotece (Ulubione, Historia, Top, Hi-Res)
  const [smartPlaylistFilter, setSmartPlaylistFilter] = useState<'all' | 'favorites' | 'history' | 'top_played' | 'hires'>('all');

  // Funkcja przełączania ulubionego (Favorites ❤️)
  const handleToggleFavorite = async (trackId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const isFav = await invoke<boolean>('toggle_favorite', { trackId });
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, is_favorite: isFav } : t))
      );
      showMessage(isFav ? t.notifications.addedFavorite : t.notifications.removedFavorite);
    } catch (err) {
      console.error('Błąd przełączania ulubionego:', err);
    }
  };

  const toggleQueueColumn = (key: keyof QueueColumnConfig) => {
    setQueueColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('auralune_queue_columns', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const resetQueueColumns = () => {
    setQueueColumns(DEFAULT_QUEUE_COLUMNS);
    try {
      localStorage.setItem('auralune_queue_columns', JSON.stringify(DEFAULT_QUEUE_COLUMNS));
    } catch (_) {}
  };

  const totalQueueDurationMs = useMemo(() => {
    return queue.items.reduce((acc, it) => acc + (it.duration_ms || 0), 0);
  }, [queue.items]);

  const formatTotalDuration = (ms: number) => {
    if (!ms || ms <= 0) return '0 min';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours} godz. ${minutes} min`;
    }
    return `${minutes} min ${seconds} s`;
  };

  const filteredQueueItems = useMemo(() => {
    if (!queueSearchQuery.trim()) {
      return queue.items.map((it, idx) => ({ it, originalIdx: idx }));
    }
    const q = queueSearchQuery.toLowerCase();
    return queue.items
      .map((it, idx) => ({ it, originalIdx: idx }))
      .filter(
        ({ it }) =>
          it.title.toLowerCase().includes(q) ||
          it.artist.toLowerCase().includes(q) ||
          (it.album ? it.album.toLowerCase().includes(q) : false) ||
          it.uri.toLowerCase().includes(q)
      );
  }, [queue.items, queueSearchQuery]);

  const getQueueTrackMeta = (item: QueueItem) => {
    const tr = tracks.find((t) => (item.track_id != null && t.id === item.track_id) || t.path === item.uri);
    let al = tr && tr.album_id ? albums.find((a) => a.id === tr.album_id) : null;
    if (!al && tr) {
      al =
        albums.find(
          (a) =>
            (tr.album_artist && a.title.toLowerCase() === tr.album_artist.toLowerCase()) ||
            (tr.artist && a.album_artist.toLowerCase() === tr.artist.toLowerCase())
        ) || null;
    }
    const ext = item.uri.split('.').pop()?.toUpperCase() || 'AUDIO';
    return {
      track: tr,
      album: al,
      cover: al?.cover_path || null,
      format: tr?.format || ext,
      sampleRate: tr?.sample_rate,
      bitDepth: tr?.bit_depth,
    };
  };

  const getQueueGridTemplate = (cfg: QueueColumnConfig) => {
    const parts: string[] = [];
    if (cfg.showIndex) parts.push('28px');
    if (cfg.showCover) parts.push(cfg.compactMode ? '34px' : '44px');
    parts.push('minmax(180px, 2fr)');
    if (cfg.showAlbum) parts.push('minmax(120px, 1.2fr)');
    if (cfg.showFormatBadge) parts.push('110px');
    if (cfg.showPath) parts.push('minmax(120px, 1.5fr)');
    if (cfg.showDuration) parts.push('60px');
    parts.push('96px');
    return parts.join(' ');
  };

  // Stan wyszukiwania i filtrów biblioteki
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFormatFilter, setLibraryFormatFilter] = useState<'all' | 'flac' | 'mp3' | 'opus' | 'wav' | 'lossless'>('all');
  const [isScanFolderOpen, setIsScanFolderOpen] = useState(false);

  // Filtrowane listy dla widoku biblioteki z obsługą bezpiecznych pól, akcentów i dodatkowych metadanych
  const filteredTracks = useMemo(() => {
    const rawQ = librarySearch.trim();
    const q = normalizeStr(rawQ);
    return tracks.filter((t) => {
      const formatLower = (t.format || '').toLowerCase();

      // Filtr formatów
      if (libraryFormatFilter !== 'all') {
        if (libraryFormatFilter === 'lossless') {
          const isLossless =
            formatLower.includes('flac') ||
            formatLower.includes('wav') ||
            formatLower.includes('alac') ||
            (t.bit_depth != null && t.bit_depth >= 16);
          if (!isLossless) return false;
        } else if (!formatLower.includes(libraryFormatFilter)) {
          return false;
        }
      }

      // Filtr inteligentnych playlist (Smart Playlists)
      if (smartPlaylistFilter === 'favorites') {
        if (!t.is_favorite) return false;
      } else if (smartPlaylistFilter === 'history') {
        if (!t.last_played_at) return false;
      } else if (smartPlaylistFilter === 'top_played') {
        if (!t.play_count || t.play_count <= 0) return false;
      } else if (smartPlaylistFilter === 'hires') {
        const isHires = (t.bit_depth != null && t.bit_depth >= 24) || (t.sample_rate != null && t.sample_rate > 48000);
        if (!isHires) return false;
      }

      // Jeśli brak zapytania tekstowego, dopasowujemy
      if (!q) return true;

      const album = t.album_id != null ? albums.find((a) => a.id === t.album_id) : null;
      const albumTitle = normalizeStr(album?.title);
      const title = normalizeStr(t.title);
      const artist = normalizeStr(t.artist);
      const albumArtist = normalizeStr(t.album_artist || album?.album_artist);
      const path = normalizeStr(t.path);

      return (
        title.includes(q) ||
        artist.includes(q) ||
        albumArtist.includes(q) ||
        albumTitle.includes(q) ||
        path.includes(q) ||
        formatLower.includes(q)
      );
    });
  }, [tracks, albums, librarySearch, libraryFormatFilter, smartPlaylistFilter]);

  const filteredAlbums = useMemo(() => {
    const q = normalizeStr(librarySearch.trim());
    if (!q) return albums;
    return albums.filter((a) => {
      const title = normalizeStr(a.title);
      const artist = normalizeStr(a.album_artist);
      return title.includes(q) || artist.includes(q);
    });
  }, [albums, librarySearch]);

  // Stan sortowania biblioteki (Etap: Sortowanie utworów i albumów)
  const [sortField, setSortField] = useState<'default' | 'title' | 'artist' | 'duration' | 'format' | 'date' | 'plays'>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'default' | 'title' | 'artist' | 'duration' | 'format' | 'date' | 'plays') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'plays' ? 'desc' : 'asc');
    }
  };

  const sortedTracks = useMemo(() => {
    if (sortField === 'default') {
      if (smartPlaylistFilter === 'history') {
        return [...filteredTracks].sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0));
      }
      if (smartPlaylistFilter === 'top_played') {
        return [...filteredTracks].sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
      }
      return filteredTracks;
    }
    const list = [...filteredTracks];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'artist':
          cmp = a.artist.localeCompare(b.artist);
          break;
        case 'duration':
          cmp = a.duration_ms - b.duration_ms;
          break;
        case 'format':
          cmp = a.format.localeCompare(b.format);
          break;
        case 'date':
          cmp = (a.modified_time || 0) - (b.modified_time || 0);
          break;
        case 'plays':
          cmp = (a.play_count || 0) - (b.play_count || 0);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredTracks, sortField, sortOrder, smartPlaylistFilter]);

  const [albumSortField, setAlbumSortField] = useState<'title' | 'artist' | 'year'>('title');
  const [albumSortOrder, setAlbumSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedAlbums = useMemo(() => {
    const list = [...filteredAlbums];
    list.sort((a, b) => {
      let cmp = 0;
      if (albumSortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (albumSortField === 'artist') {
        cmp = a.album_artist.localeCompare(b.album_artist);
      } else if (albumSortField === 'year') {
        cmp = (a.year || 0) - (b.year || 0);
      }
      return albumSortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredAlbums, albumSortField, albumSortOrder]);

  const librarySearchInputRef = useRef<HTMLInputElement>(null);

  // Aktualnie odtwarzany utwór i powiązana okładka albumu
  const currentPlayingTrack = useMemo(() => {
    // 1. Zgodność z track_id z aktywnego stanu odtwarzacza/kolejki
    if (status.current_track?.track_id) {
      const match = tracks.find((t) => t.id === status.current_track!.track_id);
      if (match) return match;
    }
    // 2. Zgodność po ścieżce pliku z aktywnego utworu w silniku
    if (status.current_track?.uri) {
      const uri = status.current_track.uri;
      const match = tracks.find((t) => t.path === uri || uri.endsWith(t.path) || t.path.endsWith(uri));
      if (match) return match;
    }
    // 3. Zgodność z filePath
    if (filePath) {
      const match = tracks.find((t) => t.path === filePath || filePath.endsWith(t.path) || t.path.endsWith(filePath));
      if (match) return match;
    }
    // 4. Aktywny wybór z biblioteki
    if (activeTrackId) {
      const match = tracks.find((t) => t.id === activeTrackId);
      if (match) return match;
    }
    return null;
  }, [tracks, status.current_track?.track_id, status.current_track?.uri, filePath, activeTrackId]);
  const currentAlbum = useMemo(() => {
    if (!currentPlayingTrack) return null;
    if (currentPlayingTrack.album_id) {
      const found = albums.find((a) => a.id === currentPlayingTrack.album_id);
      if (found) return found;
    }
    const albTitle = (currentPlayingTrack.album_artist || status.current_track?.album || '').toLowerCase();
    if (albTitle) {
      const found = albums.find((a) => a.title.toLowerCase() === albTitle);
      if (found) return found;
    }
    return null;
  }, [albums, currentPlayingTrack, status.current_track?.album]);

  const [trackDirectCover, setTrackDirectCover] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const activePath = currentPlayingTrack?.path || filePath || status.current_track?.uri;
    if (activePath && !currentAlbum?.cover_path) {
      invoke<string | null>('get_track_cover', { trackPath: activePath })
        .then((cov) => {
          if (!isCancelled && cov) {
            setTrackDirectCover(cov);
          }
        })
        .catch(() => {});
    } else {
      setTrackDirectCover(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [currentPlayingTrack?.path, filePath, status.current_track?.uri, currentAlbum?.cover_path]);

  const currentCover = currentAlbum?.cover_path || trackDirectCover || null;

  // Wizualizacja przebiegu utworu (Waveform) - deterministyczny profil fali dla bieżącego utworu
  const trackWaveformPeaks = useMemo(() => {
    const title = currentPlayingTrack?.title || status.current_track?.title || filePath.split('/').pop() || 'Auralune';
    const artist = currentPlayingTrack?.artist || status.current_track?.artist || 'Unknown';
    const duration = currentPlayingTrack?.duration_ms || status.duration_ms || 0;
    const seedStr = `${title}-${artist}-${duration}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const peaks: number[] = [];
    const count = 72;
    for (let i = 0; i < count; i++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      const rnd = ((h >>> 0) % 1000) / 1000;
      const envelope = Math.sin((i / count) * Math.PI) * 0.45 + 0.55;
      const heightPct = Math.round((0.2 + rnd * 0.75 * envelope) * 100);
      peaks.push(Math.max(16, Math.min(100, heightPct)));
    }
    return peaks;
  }, [currentPlayingTrack?.title, currentPlayingTrack?.artist, currentPlayingTrack?.duration_ms, status.current_track?.title, status.current_track?.artist, status.duration_ms, filePath]);

  // Automatyczne przekierowanie starych zakładek do okna Ustawień
  useEffect(() => {
    if (activeTab === 'themes' || activeTab === 'devices' || activeTab === 'transcode') {
      setSettingsTab(activeTab);
      setIsSettingsOpen(true);
      setActiveTab('player');
    }
  }, [activeTab]);

  // Stan MusicBrainz i Cover Art Archive (Etap 6)
  const [librarySubView, setLibrarySubView] = useState<'tracks' | 'albums' | 'artists'>('tracks');

  // Zgrupowani wykonawcy z metrykami utworów, albumów i odtworzeń
  const filteredArtists = useMemo(() => {
    const map = new Map<string, {
      name: string;
      tracks: TrackRecord[];
      albumIds: Set<number>;
      totalDurationMs: number;
      totalPlays: number;
      sampleCover: string | null;
    }>();

    tracks.forEach((t) => {
      const name = t.artist || 'Nieznany wykonawca';
      const existing = map.get(name) || {
        name,
        tracks: [],
        albumIds: new Set<number>(),
        totalDurationMs: 0,
        totalPlays: 0,
        sampleCover: null,
      };
      existing.tracks.push(t);
      if (t.album_id) existing.albumIds.add(t.album_id);
      existing.totalDurationMs += t.duration_ms || 0;
      existing.totalPlays += t.play_count || 0;
      if (!existing.sampleCover && t.album_id) {
        const alb = albums.find((a) => a.id === t.album_id);
        if (alb?.cover_path) existing.sampleCover = alb.cover_path;
      }
      map.set(name, existing);
    });

    let list = Array.from(map.values());
    if (librarySearch.trim()) {
      const q = normalizeStr(librarySearch);
      list = list.filter((a) => normalizeStr(a.name).includes(q));
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [tracks, albums, librarySearch]);

  const [selectedAlbumForMb, setSelectedAlbumForMb] = useState<AlbumRecord | null>(null);
  const [mbSearchTitle, setMbSearchTitle] = useState('');
  const [mbSearchArtist, setMbSearchArtist] = useState('');
  const [mbCandidates, setMbCandidates] = useState<ReleaseCandidateDto[]>([]);
  const [isSearchingMb, setIsSearchingMb] = useState(false);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // Stan presetów DSP (Etap 3)
  const [presets, setPresets] = useState<DspPresetRecord[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [activeDspVibe, setActiveDspVibe] = useState<'nightcore' | 'slowed' | 'vocal' | 'bass' | 'flat' | null>(null);

  // Śledzenie odtworzenia dla inteligentnych playlist (Historia i Top Played)
  const lastRecordedTrackRef = useRef<{ id: number; recorded: boolean }>({ id: -1, recorded: false });
  const lastListeningTickRef = useRef<number>(Date.now());
  const statusRef = useRef(status);
  statusRef.current = status;

  // Odpytywanie statusu odtwarzacza & widma FFT z dynamicznym czasem odświeżania (40ms podczas odtwarzania)
  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await invoke<PlaybackStatus>('get_status');
        setStatus((prev) => {
          if (
            prev.state === res.state &&
            res.state !== 'Playing' &&
            prev.current_track?.track_id === res.current_track?.track_id &&
            prev.position_ms === res.position_ms &&
            prev.volume === res.volume &&
            prev.tempo_ratio === res.tempo_ratio &&
            prev.pitch_semitones === res.pitch_semitones
          ) {
            return prev;
          }
          return res;
        });
        if (res.current_track) {
          if (res.current_track.uri) {
            const trackUri = res.current_track.uri;
            setFilePath((prev) => (prev !== trackUri ? trackUri : prev));
          }
          if (res.current_track.track_id) {
            const trackId = res.current_track.track_id;
            setActiveTrackId((prev) => (prev !== trackId ? trackId : prev));

            // Zliczanie rzeczywistego czasu słuchania (Auralune Recap & Stats)
            if (res.state === 'Playing') {
              const now = Date.now();
              const elapsed = now - lastListeningTickRef.current;
              if (elapsed >= 5000 && elapsed < 30000) {
                lastListeningTickRef.current = now;
                invoke('record_track_listening', { trackId, durationMs: elapsed }).catch(() => {});
                setTracks((prev) =>
                  prev.map((t) =>
                    t.id === trackId
                      ? {
                          ...t,
                          total_play_time_ms: (t.total_play_time_ms || 0) + elapsed,
                        }
                      : t
                  )
                );
              } else if (elapsed >= 30000) {
                lastListeningTickRef.current = now;
              }
            } else {
              lastListeningTickRef.current = Date.now();
            }

            if (lastRecordedTrackRef.current.id !== trackId) {
              lastRecordedTrackRef.current = { id: trackId, recorded: false };
            } else if (
              !lastRecordedTrackRef.current.recorded &&
              res.state === 'Playing' &&
              res.position_ms >= 15000
            ) {
              lastRecordedTrackRef.current.recorded = true;
              invoke('record_track_play', { trackId }).catch((e) => console.warn('Błąd zapisu odtworzenia:', e));
              setTracks((prev) =>
                prev.map((t) =>
                  t.id === trackId
                    ? {
                        ...t,
                        play_count: (t.play_count || 0) + 1,
                        last_played_at: Math.floor(Date.now() / 1000),
                      }
                    : t
                )
              );
            }
          }
        }
      } catch (e) {
        // Ignoruj błędy gdy backend nie jest jeszcze zainicjalizowany
      } finally {
        if (isMounted) {
          // 40ms (~25 FPS) podczas odtwarzania dla płynnego widma FFT, 250ms w spoczynku
          const delay = statusRef.current?.state === 'Playing' ? 40 : 250;
          timeoutId = setTimeout(fetchStatus, delay);
        }
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Wczytanie fabrycznych presetów korektora EQ
  useEffect(() => {
    invoke<EqualizerPreset[]>('get_equalizer_presets')
      .then((presets) => setEqPresets(presets))
      .catch((err) => console.warn('Błąd pobierania presetów EQ:', err));

    invoke<string | null>('get_app_setting', { key: 'eq_enabled_on_startup' })
      .then((val) => {
        setEqAutoStartup(val === 'true');
      })
      .catch((e) => console.warn('Błąd odczytu eq_enabled_on_startup:', e));

    invoke<string | null>('get_app_setting', { key: 'app_language' })
      .then((val) => {
        if (val && (val === 'en' || val === 'pl' || val === 'de' || val === 'fi' || val === 'la')) {
          setLanguage(val as Language);
        }
      })
      .catch((e) => console.warn('Błąd odczytu app_language:', e));

    invoke<string | null>('get_app_setting', { key: 'seek_fade_enabled' })
      .then((val) => {
        if (val !== null) {
          setSeekFadeEnabled(val === 'true');
        }
      })
      .catch((e) => console.warn('Błąd odczytu seek_fade_enabled:', e));

    invoke<string | null>('get_app_setting', { key: 'dsp_restore_on_startup' })
      .then((val) => {
        const enabled = val === 'true';
        setDspAutoStartup(enabled);
        dspAutoStartupRef.current = enabled;
      })
      .catch((e) => console.warn('Błąd odczytu dsp_restore_on_startup:', e));
  }, []);

  const handleToggleSeekFade = async () => {
    const newVal = !seekFadeEnabled;
    setSeekFadeEnabled(newVal);
    try {
      await invoke('set_app_setting', {
        key: 'seek_fade_enabled',
        value: newVal ? 'true' : 'false',
      });
      showMessage(
        newVal
          ? t.notifications.seekFadeEnabled
          : t.notifications.seekFadeDisabled
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleToggleEqAutoStartup = async () => {
    const newVal = !eqAutoStartup;
    setEqAutoStartup(newVal);
    try {
      await invoke('set_app_setting', {
        key: 'eq_enabled_on_startup',
        value: newVal ? 'true' : 'false',
      });
      showMessage(
        newVal
          ? t.notifications.eqAutostartOn
          : t.notifications.eqAutostartOff
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const refreshQueue = async () => {
    try {
      const q = await invoke<PlaybackQueue>('get_queue');
      setQueue(q);
    } catch (e: any) {
      console.warn('Błąd pobierania kolejki:', e);
    }
  };

  const refreshPlaylists = async () => {
    try {
      const list = await invoke<Playlist[]>('list_playlists');
      setPlaylists(list);
    } catch (e: any) {
      console.warn('Błąd pobierania playlist:', e);
    }
  };

  // Pobieranie listy urządzeń audio i biblioteki
  const refreshDevices = async () => {
    try {
      const res = await invoke<AudioCard[]>('list_devices');
      setCards(res);
    } catch (e: any) {
      console.warn('Błąd odpytywania kart:', e);
    }
  };

  const loadLibrary = async () => {
    try {
      const t = await invoke<TrackRecord[]>('get_library_tracks');
      setTracks(t);
      const a = await invoke<AlbumRecord[]>('get_library_albums');
      setAlbums(a);
    } catch (e: any) {
      console.warn('Błąd ładowania biblioteki:', e);
    }
  };

  const applyThemeToDom = (theme: Theme) => {
    const root = document.documentElement;
    const t = theme.tokens;
    root.style.setProperty('--bg-deep', t.bg_deep);
    root.style.setProperty('--bg-surface', t.bg_surface);
    root.style.setProperty('--bg-surface-hover', t.bg_surface_hover);
    root.style.setProperty('--bg-card', t.bg_card);
    root.style.setProperty('--border-subtle', t.border_subtle);
    root.style.setProperty('--border-accent', t.border_accent);
    root.style.setProperty('--accent-pink', t.accent_pink);
    root.style.setProperty('--accent-purple', t.accent_purple);
    root.style.setProperty('--accent-cyan', t.accent_cyan);
    root.style.setProperty('--accent-green', t.accent_green);
    root.style.setProperty('--accent-amber', t.accent_amber);
    root.style.setProperty('--text-primary', t.text_primary);
    root.style.setProperty('--text-secondary', t.text_secondary);
    root.style.setProperty('--text-muted', t.text_muted);
    root.style.setProperty('--shadow-glow', t.shadow_glow);
    root.style.setProperty('--shadow-card', t.shadow_card);

    root.style.setProperty('--bg-overlay', `${theme.overlay_opacity}`);
    root.style.setProperty('--bg-blur', `${theme.blur_radius}px`);

    setThemeOverlay(theme.overlay_opacity);
    setThemeBlur(theme.blur_radius);
    setThemeBgImage(theme.background_ref);
    setCurrentTheme(theme);
  };

  const loadThemes = async () => {
    try {
      const active = await invoke<Theme>('get_active_theme');
      applyThemeToDom(active);
      const all = await invoke<Theme[]>('list_themes');
      setThemes(all);
      invoke<string>('get_app_icon_style')
        .then((st) => setAppIconStyle(st === 'classic' ? 'classic' : 'lineout'))
        .catch((err) => console.warn('Błąd odczytu app_icon_style:', err));
    } catch (e: any) {
      console.warn('Błąd ładowania motywów:', e);
    }
  };

  const handleSelectTheme = async (themeId: string) => {
    try {
      const th = await invoke<Theme>('set_active_theme', { themeId });
      applyThemeToDom(th);
      showMessage(loc.notifications.themeActivated.replace('{0}', th.name));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSelectIconStyle = async (style: 'lineout' | 'classic') => {
    try {
      const applied = await invoke<string>('set_app_icon_style', { style });
      const clean = applied === 'classic' ? 'classic' : 'lineout';
      setAppIconStyle(clean);
      showMessage(
        loc.notifications.iconStyleChanged.replace(
          '{0}',
          clean === 'classic' ? loc.settings.iconStyleClassic : loc.settings.iconStyleLineout
        )
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const applyWallpaperFromPath = async (filePath: string) => {
    try {
      setCustomBgPath(filePath);
      const dataUri = await invoke<string>('upload_background_image', { filePath: filePath.trim() });
      setThemeBgImage(dataUri);
      if (currentTheme) {
        const updated = await invoke<Theme>('update_theme_background', {
          themeId: currentTheme.id,
          backgroundRef: dataUri,
          overlayOpacity: themeOverlay,
          blurRadius: themeBlur,
        });
        applyThemeToDom(updated);
        await loadThemes();
        showMessage(t.notifications.themeBgUpdated);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handlePickWallpaperFromDisk = async () => {
    try {
      const selected = await invoke<string | null>('pick_image_file');
      if (selected) {
        await applyWallpaperFromPath(selected);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleWallpaperDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWallpaper(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const pathVal = (file as any).path;
      if (pathVal && typeof pathVal === 'string') {
        await applyWallpaperFromPath(pathVal);
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        setThemeBgImage(dataUri);
        if (currentTheme) {
          const updated = await invoke<Theme>('update_theme_background', {
            themeId: currentTheme.id,
            backgroundRef: dataUri,
            overlayOpacity: themeOverlay,
            blurRadius: themeBlur,
          });
          applyThemeToDom(updated);
          await loadThemes();
          showMessage(t.notifications.themeBgUpdated);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadBgImage = async () => {
    if (!customBgPath.trim()) {
      showMessage(t.notifications.themeSelectImage, true);
      return;
    }
    await applyWallpaperFromPath(customBgPath);
  };

  const handleRemoveBgImage = async () => {
    if (!currentTheme) return;
    try {
      setThemeBgImage(null);
      const updated = await invoke<Theme>('update_theme_background', {
        themeId: currentTheme.id,
        backgroundRef: null,
        overlayOpacity: themeOverlay,
        blurRadius: themeBlur,
      });
      applyThemeToDom(updated);
      await loadThemes();
      showMessage(t.notifications.themeBgRemoved);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSaveBackgroundSettings = async () => {
    if (!currentTheme) return;
    try {
      const updated = await invoke<Theme>('update_theme_background', {
        themeId: currentTheme.id,
        backgroundRef: themeBgImage,
        overlayOpacity: themeOverlay,
        blurRadius: themeBlur,
      });
      applyThemeToDom(updated);
      await loadThemes();
      showMessage(t.notifications.themeBgSaved);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleExportTheme = async () => {
    if (!currentTheme) return;
    try {
      const json = await invoke<string>('export_theme_json', { themeId: currentTheme.id });
      setJsonExportContent(json);
      showMessage(t.notifications.themeJsonExported.replace('{0}', currentTheme.name));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleImportTheme = async () => {
    if (!jsonImportContent.trim()) {
      showMessage(t.notifications.themeJsonPaste, true);
      return;
    }
    try {
      const imported = await invoke<Theme>('import_theme_json', { jsonContent: jsonImportContent.trim() });
      applyThemeToDom(imported);
      await loadThemes();
      setJsonImportContent('');
      showMessage(t.notifications.themeImported.replace('{0}', imported.name));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  useEffect(() => {
    refreshDevices();
    loadLibrary();
    loadPresets();
    loadThemes();
    refreshQueue();
    refreshPlaylists();

    // Rejestracja natywnych zdarzeń Drag & Drop z webview Tauri 2 (bez konfliktujących listenerów DOM)
    let unlistenDragDrop: (() => void) | null = null;
    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDraggingOver(true);
          } else if (event.payload.type === 'drop') {
            setIsDraggingOver(false);
            if (event.payload.paths && event.payload.paths.length > 0) {
              handleDropPaths(event.payload.paths);
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          unlistenDragDrop = unlisten;
        })
        .catch((err) => {
          console.warn('onDragDropEvent niedostępne w tym środowisku:', err);
        });
    } catch (err) {
      console.warn('getCurrentWebview error:', err);
    }

    return () => {
      if (unlistenDragDrop) unlistenDragDrop();
    };
  }, []);

  const showMessage = (msg: string, isError = false) => {
    // Wyświetlaj komunikat tylko przy rzeczywistych błędach (brak natrętnych powiadomień na górze przy każdej akcji)
    if (!isError) return;
    setInfoMessage(`⚠️ ${msg}`);
    setTimeout(() => setInfoMessage(null), 4000);
  };

  // Obsługa skanera biblioteki (katalog pojedynczy z ręcznej ścieżki)
  const handleScanLibrary = async () => {
    setIsScanning(true);
    try {
      const summary = await invoke<ScanSummaryDto>('scan_library', { folderPath: scanFolder });
      setScanResult(summary);
      await loadLibrary();
      showMessage(
        t.notifications.scanFinished
          .replace('{0}', String(summary.new_or_updated_tracks))
          .replace('{1}', String(summary.skipped_unchanged))
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsScanning(false);
    }
  };

  // Obsługa skanera wielu ścieżek / plików / folderów
  const handleScanPaths = async (paths: string[]) => {
    if (!paths || paths.length === 0) return;
    setIsScanning(true);
    try {
      const summary = await invoke<ScanSummaryDto>('scan_paths', { paths });
      setScanResult(summary);
      const updatedTracks = await invoke<TrackRecord[]>('get_library_tracks');
      const updatedAlbums = await invoke<AlbumRecord[]>('get_library_albums');
      setTracks(updatedTracks);
      setAlbums(updatedAlbums);

      showMessage(
        `Dodano do biblioteki: ${summary.new_or_updated_tracks} zindeksowano (znaleziono: ${summary.total_files_found}).`
      );

      // Jeśli kolejka jest pusta, załaduj nowo dodane utwory do odtwarzania
      if (queue.items.length === 0 && updatedTracks.length > 0) {
        const newlyAdded = updatedTracks.slice(-Math.max(1, summary.new_or_updated_tracks));
        if (newlyAdded.length > 0) {
          await handlePlayAllTracks(newlyAdded, 0);
        }
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsScanning(false);
    }
  };

  // Systemowy wybór folderu (zenity / kdialog)
  const handlePickFolder = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        setScanFolder(selected);
        await handleScanPaths([selected]);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Systemowy wybór plików audio (kdialog Dolphin / zenity)
  const handlePickFiles = async () => {
    try {
      const selected = await invoke<string[]>('pick_files');
      if (selected && selected.length > 0) {
        showMessage(t.notifications.filesSelectedDolphin.replace('{0}', String(selected.length)));
        for (const p of selected) {
          try {
            await invoke('add_to_queue', { uri: p });
          } catch (e) {
            console.warn('Błąd dodawania do kolejki:', e);
          }
        }
        await handleScanPaths(selected);
        const q = await invoke<PlaybackQueue>('get_queue');
        setQueue(q);
        if (status.state === 'Stopped') {
          await handlePlayQueueIndex(0);
        }
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Obsługa upuszczenia plików lub folderów (Drag & Drop)
  const handleDropPaths = async (paths: string[]) => {
    if (!paths || paths.length === 0) return;
    try {
      const currentQueue = await invoke<PlaybackQueue>('get_queue');
      const startIdx = currentQueue.items.length;

      // Dodaj WSZYSTKIE upuszczone pliki do kolejki w jednym wywołaniu backendu
      // (poprzednia wersja wywoływała add_to_queue w pętli, co powodowało freeze)
      await invoke<number>('add_uris_to_queue', { uris: paths });

      // Odśwież widok kolejki
      const updatedQueue = await invoke<PlaybackQueue>('get_queue');
      setQueue(updatedQueue);

      // Jeśli dodano utwór, natychmiast rozpocznij odtwarzanie od pierwszego dodanego
      if (updatedQueue.items.length > startIdx) {
        await handlePlayQueueIndex(startIdx);
        setActiveTab('player');
      }

      // W tle zindeksuj metadane i zaktualizuj bibliotekę (nie blokuje UI ani audio)
      handleScanPaths(paths).catch((e) => console.warn('Błąd indeksowania w tle:', e));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };


  // Obsługa wyszukiwania wydań w MusicBrainz i pobierania okładek (Etap 6)
  const handleOpenMbModal = (album: AlbumRecord) => {
    setSelectedAlbumForMb(album);
    setMbSearchTitle(album.title);
    setMbSearchArtist(album.album_artist);
    setMbCandidates([]);
  };

  const handleSearchMusicBrainz = async () => {
    if (!mbSearchTitle.trim()) {
      showMessage(t.notifications.mbSearchPrompt, true);
      return;
    }
    setIsSearchingMb(true);
    try {
      const candidates = await invoke<ReleaseCandidateDto[]>('search_musicbrainz_releases', {
        album: mbSearchTitle.trim(),
        artist: mbSearchArtist.trim(),
      });
      setMbCandidates(candidates);
      if (candidates.length === 0) {
        showMessage(t.notifications.mbNoMatches, true);
      } else {
        showMessage(t.notifications.mbFoundReleases.replace('{0}', String(candidates.length)));
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsSearchingMb(false);
    }
  };

  const handleSelectCandidateAndFetchCover = async (candidate: ReleaseCandidateDto) => {
    if (!selectedAlbumForMb) return;
    setIsFetchingCover(true);
    try {
      const coverDataUri = await invoke<string>('fetch_and_apply_cover', {
        albumId: selectedAlbumForMb.id,
        mbid: candidate.mbid,
      });

      setAlbums((prev) =>
        prev.map((a) =>
          a.id === selectedAlbumForMb.id
            ? { ...a, cover_path: coverDataUri, release_mbid: candidate.mbid }
            : a
        )
      );

      showMessage(t.notifications.caaCoverDownloaded.replace('{0}', selectedAlbumForMb.title));
      setSelectedAlbumForMb(null);
      await loadLibrary();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsFetchingCover(false);
    }
  };

  const handleAutoFetchCover = async (album: AlbumRecord) => {
    try {
      showMessage(t.notifications.mbSearchingCover.replace('{0}', album.title));
      const coverDataUri = await invoke<string | null>('auto_fetch_album_cover', {
        albumId: album.id,
        albumTitle: album.title,
        artist: album.album_artist,
      });

      if (coverDataUri) {
        setAlbums((prev) =>
          prev.map((a) => (a.id === album.id ? { ...a, cover_path: coverDataUri } : a))
        );
        showMessage(t.notifications.mbCoverMatched.replace('{0}', album.title));
        await loadLibrary();
      } else {
        showMessage(t.notifications.mbCoverLowScore, true);
        handleOpenMbModal(album);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Synchronizacja zakładki dla bieżącego utworu
  useEffect(() => {
    if (!activeTrackId) {
      setCurrentBookmark(null);
      return;
    }
    invoke<number | null>('get_bookmark', { trackId: activeTrackId })
      .then((b) => setCurrentBookmark(b ?? null))
      .catch(() => setCurrentBookmark(null));
  }, [activeTrackId]);

  // Odtwarzanie utworu z biblioteki z obsługą zakładek i ochroną przed wyścigami
  const handlePlayLibraryTrack = async (track: TrackRecord) => {
    if (isPlayingLibraryTrackRef.current) return;
    isPlayingLibraryTrackRef.current = true;
    const safetyTimeout = setTimeout(() => {
      isPlayingLibraryTrackRef.current = false;
    }, 4000);
    try {
      setActiveTrackId(track.id);
      setFilePath(track.path);
      await invoke('load_file', { path: track.path });

      // Sprawdź czy jest zapisana zakładka (bookmark)
      const bookmark = await invoke<number | null>('get_bookmark', { trackId: track.id });
      setCurrentBookmark(bookmark ?? null);

      // Najpierw start odtwarzania, aby GStreamer wszedł w stan Playing/Prerolled
      await invoke('play');

      if (bookmark && bookmark > 2000) {
        try {
          await invoke('seek', { positionMs: bookmark });
          showMessage(t.notifications.resumedTrack.replace('{0}', track.title).replace('{1}', formatTime(bookmark)));
        } catch {
          showMessage(t.notifications.startedPlayback.replace('{0}', track.title).replace('{1}', track.artist));
        }
      } else {
        showMessage(t.notifications.startedPlayback.replace('{0}', track.title).replace('{1}', track.artist));
      }

      // Publikacja metadanych do systemowego D-Bus MPRIS (KDE/GNOME/playerctl)
      await invoke('update_mpris_metadata', {
        title: track.title,
        artist: track.artist,
        album: track.album_artist || 'Auralune Library',
        durationMs: track.duration_ms,
        artUrl: null,
      });
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      clearTimeout(safetyTimeout);
      isPlayingLibraryTrackRef.current = false;
    }
  };

  // Zapis zakładki dla aktywnego utworu
  const handleSaveBookmark = async () => {
    if (!activeTrackId) {
      showMessage(t.notifications.firstSelectTrack, true);
      return;
    }
    try {
      await invoke('save_bookmark', {
        trackId: activeTrackId,
        positionMs: status.position_ms,
      });
      setCurrentBookmark(status.position_ms);
      showMessage(t.notifications.bookmarkSaved.replace('{0}', formatTimeMs(status.position_ms)));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Usunięcie zakładki dla aktywnego utworu
  const handleDeleteBookmark = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeTrackId) return;
    try {
      await invoke('delete_bookmark', { trackId: activeTrackId });
      setCurrentBookmark(null);
      showMessage(loc.player.bookmarkDeleted || 'Usunięto zakładkę dla tego utworu');
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Skok do zapisanej zakładki
  const handleJumpToBookmark = async (pos: number) => {
    await handleSeek(pos);
    showMessage((loc.player.bookmarkJump || 'Skocz do zakładki ({0})').replace('{0}', formatTime(pos)));
  };

  // Sterowanie odtwarzaczem
  const handleLoadFile = async (path: string) => {
    try {
      setFilePath(path);
      const matchingTrack = tracks.find((t) => t.path === path || path.endsWith(t.path));
      if (matchingTrack) {
        setActiveTrackId(matchingTrack.id);
      }
      await invoke('load_file', { path });
      const filename = path.split('/').pop() || path;
      await invoke('update_mpris_metadata', {
        title: matchingTrack?.title || filename,
        artist: matchingTrack?.artist || 'Plik lokalny',
        album: matchingTrack?.album_artist || 'Auralune Player',
        durationMs: matchingTrack?.duration_ms || 0,
        artUrl: null,
      });
      showMessage(t.notifications.fileLoaded.replace('{0}', path));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleResetTrackPlays = async (trackId: number) => {
    try {
      await invoke('reset_track_plays', { trackId });
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, play_count: 0, last_played_at: null }
            : t
        )
      );
      if (statsModalTrack && statsModalTrack.id === trackId) {
        setStatsModalTrack((prev) => (prev ? { ...prev, play_count: 0, last_played_at: null } : null));
      }
      showMessage(t.notifications.trackStatsReset);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Szybkie profile klimatyczne DSP (Nightcore, Slowed Lo-Fi, Anime Vocal, Bass Impact, Flat)
  const handleApplyDspVibe = async (vibe: 'nightcore' | 'slowed' | 'vocal' | 'bass' | 'flat') => {
    try {
      setActiveDspVibe(vibe);
      let targetTempo = 1.0;
      let targetPitch = 0.0;
      let targetRate = 1.0;
      let bands: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      let msg = '';

      if (vibe === 'nightcore') {
        // Autentyczny Nightcore: przyspieszenie przez szybkość odtwarzania (playback speed)
        targetTempo = 1.0;
        targetPitch = 0.0;
        targetRate = 1.25;
        bands = [0, 0, 0, 0, 1.0, 1.5, 2.5, 3.0, 2.5, 2.0];
        msg = 'Aktywowano klimat Nightcore: +25% szybkości odtwarzania (Playback Speed)!';
      } else if (vibe === 'slowed') {
        targetTempo = 0.85;
        targetPitch = -2.0;
        targetRate = 1.0;
        bands = [4.5, 4.0, 3.0, 1.0, 0, 0, -1.0, -1.5, -2.5, -3.0];
        msg = 'Aktywowano klimat Slowed & Lo-Fi: -15% tempo, -2.0st pitch!';
      } else if (vibe === 'vocal') {
        targetTempo = 1.0;
        targetPitch = 0.0;
        targetRate = 1.0;
        bands = [-2.0, -1.5, -1.0, 0, 1.5, 3.5, 4.0, 3.0, 1.5, 0.5];
        msg = 'Aktywowano Anime Vocal Boost: uwypuklone pasmo wokalne!';
      } else if (vibe === 'bass') {
        targetTempo = 1.0;
        targetPitch = 0.0;
        targetRate = 1.0;
        bands = [6.0, 5.5, 3.5, 1.0, 0, 0, 0, 0.5, 1.0, 1.0];
        msg = 'Aktywowano Bass Impact: podbicie sub-basu +6dB!';
      } else if (vibe === 'flat') {
        targetTempo = 1.0;
        targetPitch = 0.0;
        targetRate = 1.0;
        bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        msg = t.notifications.dspPresetFlat;
      }

      // Jeśli silnik był w trybie Bypass, przełączamy na RubberBand dla aktywnych profili modyfikujących dźwięk
      if (vibe !== 'flat' && status.engine === 'Bypass') {
        await invoke('set_dsp_engine', { engine: 'RubberBand' });
      }

      await invoke('set_tempo', { tempoRatio: targetTempo });
      await invoke('set_pitch', { semitones: targetPitch });
      await invoke('set_rate', { rateRatio: targetRate });
      await invoke('set_equalizer_bands', { bands });
      await invoke('set_equalizer_enabled', { enabled: true });

      // Natychmiastowa aktualizacja stanu lokalnego, aby interfejs zareagował bez opóźnień
      setStatus((prev) => ({
        ...prev,
        tempo_ratio: targetTempo,
        pitch_semitones: targetPitch,
        rate_ratio: targetRate,
        equalizer_bands: bands,
        equalizer_enabled: true,
        engine: (vibe !== 'flat' && prev.engine === 'Bypass') ? 'RubberBand' : prev.engine,
      }));

      showMessage(msg);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Wyłącznik czasowy (Sleep Timer)
  const handleSetSleepTimer = (minutes: number | 'end_of_track', fadeOut: boolean) => {
    setSleepTimerFadeOut(fadeOut);
    if (minutes === 'end_of_track') {
      setSleepTimerTargetMode('end_of_track');
      setSleepTimerRemainingSec(null);
      lastTrackUriRef.current = status.current_track?.uri || filePath;
      showMessage(t.notifications.sleepTimerEndOfTrack);
    } else {
      setSleepTimerTargetMode('time');
      setSleepTimerRemainingSec(minutes * 60);
      showMessage(t.notifications.sleepTimerSet.replace('{0}', String(minutes)));
    }
  };

  const handleCancelSleepTimer = () => {
    if (preFadeVolumeRef.current !== null) {
      invoke('set_volume', { volume: preFadeVolumeRef.current }).catch(() => {});
      preFadeVolumeRef.current = null;
    }
    setSleepTimerRemainingSec(null);
    setSleepTimerTargetMode(null);
    showMessage(t.notifications.sleepTimerCancelled);
  };

  // Efekt licznika Sleep Timer (stabilne odliczanie co 1s bez restartowania co 100ms)
  useEffect(() => {
    if (sleepTimerRemainingSec === null && sleepTimerTargetMode !== 'end_of_track') return;

    const interval = setInterval(async () => {
      const currentStatus = statusRef.current;

      if (sleepTimerTargetMode === 'end_of_track') {
        const currentUri = currentStatus.current_track?.uri || filePath;
        if (
          (lastTrackUriRef.current && currentUri && lastTrackUriRef.current !== currentUri) ||
          (currentStatus.duration_ms && currentStatus.duration_ms > 0 && currentStatus.position_ms >= currentStatus.duration_ms - 800)
        ) {
          await invoke('pause').catch(() => {});
          setSleepTimerTargetMode(null);
          showMessage(t.notifications.sleepTimerTrackEnded);
        }
        return;
      }

      setSleepTimerRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          invoke('pause').catch(() => {});
          if (preFadeVolumeRef.current !== null) {
            invoke('set_volume', { volume: preFadeVolumeRef.current }).catch(() => {});
            preFadeVolumeRef.current = null;
          }
          setSleepTimerTargetMode(null);
          showMessage(t.notifications.sleepTimerPaused);
          return null;
        }

        const nextSec = prev - 1;
        if (sleepTimerFadeOut && nextSec <= 30) {
          if (preFadeVolumeRef.current === null) {
            preFadeVolumeRef.current = currentStatus.volume;
          }
          const factor = Math.max(0.02, nextSec / 30);
          const fadeVol = (preFadeVolumeRef.current || 1.0) * factor;
          invoke('set_volume', { volume: fadeVol }).catch(() => {});
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemainingSec !== null, sleepTimerTargetMode, sleepTimerFadeOut]);

  // Sterowanie procesorem Reverb (Freeverb)
  const handleUpdateReverb = async (
    enabled: boolean,
    roomSize = reverbRoomSize,
    damping = reverbDamping,
    width = reverbWidth,
    level = reverbLevel
  ) => {
    setReverbEnabled(enabled);
    setReverbRoomSize(roomSize);
    setReverbDamping(damping);
    setReverbWidth(width);
    setReverbLevel(level);
    try {
      await invoke('set_reverb_params', {
        enabled,
        roomSize,
        damping,
        width,
        level,
      });
    } catch (e: any) {
      console.warn('Błąd aktualizacji parametrów pogłosu:', e);
    }
  };

  const handlePlayPause = async () => {
    try {
      if (status.state === 'Playing') {
        await invoke('pause');
      } else {
        await invoke('play');
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleStop = async () => {
    try {
      await invoke('stop');
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSeek = async (val: number) => {
    try {
      // Optymistyczna aktualizacja lokalnego suwaka, aby zapobiec cofaniu do zera podczas prerollu
      setStatus((prev) => ({ ...prev, position_ms: val }));
      await invoke('seek', { positionMs: val, fade: seekFadeEnabled });
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // ===================================
  // OBSŁUGA KOLEJKI ODTWARZANIA (ETAP 7)
  // ===================================

  const handleNext = async () => {
    try {
      const nextItem = await invoke<QueueItem | null>('play_next');
      await refreshQueue();
      if (nextItem) {
        showMessage(t.notifications.nextTrackMsg.replace('{0}', nextItem.title));
        if (nextItem.uri) setFilePath(nextItem.uri);
        if (nextItem.track_id) setActiveTrackId(nextItem.track_id);
      } else {
        showMessage(t.notifications.queueEndMsg);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handlePrevious = async () => {
    try {
      const prevItem = await invoke<QueueItem | null>('play_previous');
      await refreshQueue();
      if (prevItem) {
        showMessage(t.notifications.prevTrackMsg.replace('{0}', prevItem.title));
        if (prevItem.uri) setFilePath(prevItem.uri);
        if (prevItem.track_id) setActiveTrackId(prevItem.track_id);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleToggleShuffle = async () => {
    try {
      const newShuffle = await invoke<boolean>('toggle_shuffle');
      await refreshQueue();
      showMessage(newShuffle ? t.notifications.shuffleOnMsg : t.notifications.shuffleOffMsg);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleCycleLoopMode = async () => {
    try {
      const modes: ('None' | 'Queue' | 'Track')[] = ['None', 'Queue', 'Track'];
      const currentIdx = modes.indexOf(queue.loop_mode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      await invoke('set_loop_mode', { mode: nextMode });
      await refreshQueue();
      const loopLabel = nextMode === 'None' ? loc.queue.loopNone : nextMode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue;
      showMessage(loc.notifications.loopModeMsg.replace('{0}', loopLabel));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handlePlayQueueIndex = async (index: number) => {
    try {
      const item = await invoke<QueueItem | null>('play_queue_index', { index });
      await refreshQueue();
      if (item) {
        showMessage(t.notifications.playingMsg.replace('{0}', item.title));
        if (item.uri) setFilePath(item.uri);
        if (item.track_id) setActiveTrackId(item.track_id);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleRemoveFromQueue = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke('remove_from_queue', { id });
      await refreshQueue();
      showMessage(t.notifications.removedFromQueueMsg);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleMoveQueueItem = async (fromIdx: number, toIdx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (toIdx < 0 || toIdx >= queue.items.length) return;
    try {
      await invoke('reorder_queue', { fromIdx, toIdx });
      await refreshQueue();
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleQueueDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedQueueIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${idx}`);
  };

  const handleQueueDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverQueueIdx !== idx) {
      setDragOverQueueIdx(idx);
    }
  };

  const handleQueueDrop = async (toIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = draggedQueueIdx;
    setDraggedQueueIdx(null);
    setDragOverQueueIdx(null);
    if (fromIdx !== null && fromIdx !== toIdx) {
      await handleMoveQueueItem(fromIdx, toIdx);
    }
  };

  const handleClearQueue = async () => {
    try {
      await invoke('clear_queue');
      await refreshQueue();
      showMessage(t.notifications.queueClearedMsg);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleAddTrackToQueue = async (track: TrackRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      track_id: track.id,
      uri: track.path,
      title: track.title,
      artist: track.artist,
      album: track.album_artist || null,
      duration_ms: track.duration_ms,
    };
    try {
      await invoke('add_to_queue', { item });
      await refreshQueue();
      showMessage(t.notifications.addedToQueueEndMsg.replace('{0}', track.title));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleAddTrackNextToQueue = async (track: TrackRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      track_id: track.id,
      uri: track.path,
      title: track.title,
      artist: track.artist,
      album: track.album_artist || null,
      duration_ms: track.duration_ms,
    };
    try {
      await invoke('add_next_to_queue', { item });
      await refreshQueue();
      showMessage(t.notifications.setAsNextMsg.replace('{0}', track.title));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleOpenContainingFolder = async (rawPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!rawPath) return;
    try {
      const folder = await invoke<string>('open_containing_folder', { filePath: rawPath });
      showMessage(loc.notifications.openedFolder.replace('{0}', folder));
    } catch (err: any) {
      console.error('Failed to open containing folder:', err);
      showMessage(loc.notifications.openFolderError.replace('{0}', String(err)), true);
    }
  };

  const handlePlayAllTracks = async (trackList: TrackRecord[], startIndex = 0) => {
    if (trackList.length === 0) return;
    const items: QueueItem[] = trackList.map((t, idx) => ({
      id: `q-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      track_id: t.id,
      uri: t.path,
      title: t.title,
      artist: t.artist,
      album: t.album_artist || null,
      duration_ms: t.duration_ms,
    }));
    try {
      await invoke('set_queue', { items, startIndex });
      await refreshQueue();
      showMessage(t.notifications.loadedTracksToQueueMsg.replace('{0}', String(items.length)));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  // ===================================
  // OBSŁUGA PLAYLIST (ETAP 7)
  // ===================================

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      showMessage(t.notifications.playlistNamePrompt, true);
      return;
    }
    try {
      await invoke('create_playlist', { name: newPlaylistName.trim() });
      setNewPlaylistName('');
      await refreshPlaylists();
      showMessage(t.notifications.playlistCreatedMsg.replace('{0}', newPlaylistName.trim()));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleDeletePlaylist = async (playlistId: number, name: string) => {
    try {
      await invoke('delete_playlist', { playlistId });
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
        setPlaylistTracks([]);
      }
      await refreshPlaylists();
      showMessage(t.notifications.playlistDeletedMsg.replace('{0}', name));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleOpenPlaylist = async (pl: Playlist) => {
    setSelectedPlaylist(pl);
    try {
      const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId: pl.id });
      setPlaylistTracks(tr);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleAddTrackToPlaylist = async (playlistId: number, trackId: number) => {
    try {
      await invoke('add_track_to_playlist', { playlistId, trackId });
      setShowPlaylistModal(false);
      setTrackToAddToPlaylist(null);
      await refreshPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId });
        setPlaylistTracks(tr);
      }
      showMessage(t.notifications.addedToPlaylistMsg);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: number, trackId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke('remove_track_from_playlist', { playlistId, trackId });
      const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId });
      setPlaylistTracks(tr);
      await refreshPlaylists();
      showMessage(t.notifications.removedFromPlaylistMsg);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const persistDspSettings = useCallback((engine: string, pitch: number, tempo: number, rate: number) => {
    if (!dspAutoStartupRef.current) return;
    if (dspSaveTimeoutRef.current) {
      clearTimeout(dspSaveTimeoutRef.current);
    }
    dspSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await invoke('set_app_setting', {
          key: 'dsp_saved_settings',
          value: JSON.stringify({
            engine,
            pitch_semitones: pitch,
            tempo_ratio: tempo,
            rate_ratio: rate,
          }),
        });
      } catch (err) {
        console.warn('Błąd zapisu ustawień startowych DSP:', err);
      }
    }, 250);
  }, []);

  const handleToggleDspAutoStartup = async () => {
    const newVal = !dspAutoStartup;
    setDspAutoStartup(newVal);
    dspAutoStartupRef.current = newVal;
    try {
      await invoke('set_app_setting', {
        key: 'dsp_restore_on_startup',
        value: newVal ? 'true' : 'false',
      });
      if (newVal) {
        await invoke('set_app_setting', {
          key: 'dsp_saved_settings',
          value: JSON.stringify({
            engine: status.engine,
            pitch_semitones: status.pitch_semitones ?? 0.0,
            tempo_ratio: status.tempo_ratio ?? 1.0,
            rate_ratio: status.rate_ratio ?? 1.0,
          }),
        });
        showMessage(t.notifications.dspAutostartOn);
      } else {
        showMessage(t.notifications.dspAutostartOff);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSaveDspStartupDefault = async () => {
    try {
      await invoke('set_app_setting', {
        key: 'dsp_restore_on_startup',
        value: 'true',
      });
      await invoke('set_app_setting', {
        key: 'dsp_saved_settings',
        value: JSON.stringify({
          engine: status.engine,
          pitch_semitones: status.pitch_semitones ?? 0.0,
          tempo_ratio: status.tempo_ratio ?? 1.0,
          rate_ratio: status.rate_ratio ?? 1.0,
        }),
      });
      setDspAutoStartup(true);
      dspAutoStartupRef.current = true;
      showMessage(t.notifications.dspSavedAsStartup);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const pitchThrottleRef = useRef<{ timer: number | null; lastVal: number | null }>({ timer: null, lastVal: null });
  const tempoThrottleRef = useRef<{ timer: number | null; lastVal: number | null }>({ timer: null, lastVal: null });
  const rateThrottleRef = useRef<{ timer: number | null; lastVal: number | null }>({ timer: null, lastVal: null });

  const handlePitchChange = (semitones: number) => {
    setActiveDspVibe(null);
    setStatus((prev) => ({ ...prev, pitch_semitones: semitones }));
    persistDspSettings(status.engine, semitones, status.tempo_ratio ?? 1.0, status.rate_ratio ?? 1.0);

    pitchThrottleRef.current.lastVal = semitones;
    if (pitchThrottleRef.current.timer === null) {
      invoke('set_pitch', { semitones }).catch((e: any) => {
        showMessage(`${t.common.errorPrefix} ${e}`, true);
      });

      pitchThrottleRef.current.timer = window.setTimeout(() => {
        pitchThrottleRef.current.timer = null;
        const finalVal = pitchThrottleRef.current.lastVal;
        if (finalVal !== null && finalVal !== semitones) {
          invoke('set_pitch', { semitones: finalVal }).catch((e: any) => {
            showMessage(`${t.common.errorPrefix} ${e}`, true);
          });
        }
      }, 35);
    }
  };

  const handleTempoChange = (tempoRatio: number) => {
    setActiveDspVibe(null);
    setStatus((prev) => ({ ...prev, tempo_ratio: tempoRatio }));
    persistDspSettings(status.engine, status.pitch_semitones ?? 0.0, tempoRatio, status.rate_ratio ?? 1.0);

    tempoThrottleRef.current.lastVal = tempoRatio;
    if (tempoThrottleRef.current.timer === null) {
      invoke('set_tempo', { tempoRatio }).catch((e: any) => {
        showMessage(`${t.common.errorPrefix} ${e}`, true);
      });

      tempoThrottleRef.current.timer = window.setTimeout(() => {
        tempoThrottleRef.current.timer = null;
        const finalVal = tempoThrottleRef.current.lastVal;
        if (finalVal !== null && finalVal !== tempoRatio) {
          invoke('set_tempo', { tempoRatio: finalVal }).catch((e: any) => {
            showMessage(`${t.common.errorPrefix} ${e}`, true);
          });
        }
      }, 35);
    }
  };

  const handleRateChange = (rateRatio: number) => {
    setActiveDspVibe(null);
    setStatus((prev) => ({ ...prev, rate_ratio: rateRatio }));
    persistDspSettings(status.engine, status.pitch_semitones ?? 0.0, status.tempo_ratio ?? 1.0, rateRatio);

    rateThrottleRef.current.lastVal = rateRatio;
    if (rateThrottleRef.current.timer === null) {
      invoke('set_rate', { rateRatio }).catch((e: any) => {
        showMessage(`${t.common.errorPrefix} ${e}`, true);
      });

      rateThrottleRef.current.timer = window.setTimeout(() => {
        rateThrottleRef.current.timer = null;
        const finalVal = rateThrottleRef.current.lastVal;
        if (finalVal !== null && finalVal !== rateRatio) {
          invoke('set_rate', { rateRatio: finalVal }).catch((e: any) => {
            showMessage(`${t.common.errorPrefix} ${e}`, true);
          });
        }
      }, 35);
    }
  };

  const handleResetDsp = async () => {
    try {
      setActiveDspVibe('flat');
      const res = await invoke<PlaybackStatus>('reset_dsp');
      setStatus(res);
      persistDspSettings(res.engine, res.pitch_semitones, res.tempo_ratio, res.rate_ratio);
      showMessage(t.notifications.dspResetDefaultsMsg);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleEngineChange = async (engine: 'Bypass' | 'RubberBand' | 'SoundTouch') => {
    if (engine !== 'Bypass') {
      lastActiveDspEngineRef.current = engine;
    }
    try {
      const res = await invoke<PlaybackStatus>('set_dsp_engine', { engine });
      setStatus(res);
      persistDspSettings(engine, res.pitch_semitones, res.tempo_ratio, res.rate_ratio);
      showMessage(t.notifications.dspEngineSwitchedMsg.replace('{0}', res.capabilities.name));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const loadPresets = async () => {
    try {
      const list = await invoke<DspPresetRecord[]>('list_dsp_presets');
      setPresets(list);
    } catch (e: any) {
      console.warn('Błąd ładowania presetów:', e);
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      showMessage(t.notifications.dspPresetNamePrompt, true);
      return;
    }
    try {
      await invoke('save_dsp_preset', { name: newPresetName.trim() });
      showMessage(`Zapisano preset '${newPresetName.trim()}' w bazie danych SQLite`);
      setNewPresetName('');
      await loadPresets();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleLoadPreset = async (preset: DspPresetRecord) => {
    try {
      const res = await invoke<PlaybackStatus>('load_dsp_preset', { preset });
      setStatus(res);
      showMessage(t.notifications.dspPresetLoadedMsg.replace('{0}', preset.name).replace('{1}', preset.engine));
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleEqBandChange = async (bandIndex: number, gainDb: number) => {
    try {
      await invoke('set_equalizer_band', { band: bandIndex, gainDb });
      setStatus((prev) => {
        const newBands = [...(prev.equalizer_bands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])];
        newBands[bandIndex] = gainDb;
        return { ...prev, equalizer_bands: newBands };
      });
    } catch (e: any) {
      console.error('Błąd zmiany pasma EQ:', e);
    }
  };

  const handleEqToggle = async () => {
    const newEnabled = status.equalizer_enabled === false ? true : false;
    try {
      await invoke('set_equalizer_enabled', { enabled: newEnabled });
      setStatus((prev) => ({ ...prev, equalizer_enabled: newEnabled }));
      showMessage(newEnabled ? t.notifications.eqEnabledMsg : t.notifications.eqDisabledMsg);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleApplyEqPreset = async (presetName: string) => {
    setSelectedEqPreset(presetName);
    const preset = eqPresets.find((p) => p.name === presetName);
    if (!preset) return;
    try {
      await invoke('set_equalizer_bands', { bands: preset.bands });
      setStatus((prev) => ({ ...prev, equalizer_bands: preset.bands }));
      showMessage(`Zastosowano profil korektora: ${preset.name}`);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleResetEq = async () => {
    const flatBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    try {
      await invoke('set_equalizer_bands', { bands: flatBands });
      setSelectedEqPreset('Płaski (Flat)');
      setStatus((prev) => ({ ...prev, equalizer_bands: flatBands }));
      showMessage(t.notifications.dspPresetFlat);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleVolumeChange = (volume: number) => {
    const clamped = Math.max(0, Math.min(1.0, volume));
    setStatus((prev) => ({ ...prev, volume: clamped }));
    invoke('set_volume', { volume: clamped }).catch((e: any) => {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    });
  };

  const handleToggleMute = () => {
    if (status.volume > 0) {
      lastNonZeroVolRef.current = status.volume;
      handleVolumeChange(0);
    } else {
      handleVolumeChange(lastNonZeroVolRef.current || 1.0);
    }
  };

  // 1. Obsługa pętli A-B Repeat (automatyczny seek po osiągnięciu punktu B)
  useEffect(() => {
    if (
      loopPointA !== null &&
      loopPointB !== null &&
      loopPointB > loopPointA &&
      status.state === 'Playing' &&
      status.position_ms >= loopPointB
    ) {
      handleSeek(loopPointA);
    }
  }, [status.position_ms, status.state, loopPointA, loopPointB]);


  const formatSleepTimer = (sec: number | null) => {
    if (sec === null) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 3. Globalne skróty klawiszowe odtwarzacza
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, status.position_ms - 5000));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const maxPos = status.duration_ms || status.position_ms + 5000;
        handleSeek(Math.min(maxPos, status.position_ms + 5000));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(Math.min(1.0, Math.round((status.volume + 0.05) * 100) / 100));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(Math.max(0.0, Math.round((status.volume - 0.05) * 100) / 100));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === '[') {
        e.preventDefault();
        handlePitchChange(Math.max(-12, (status.pitch_semitones ?? 0) - 1.0));
      } else if (e.key === ']') {
        e.preventDefault();
        handlePitchChange(Math.min(12, (status.pitch_semitones ?? 0) + 1.0));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleTempoChange(Math.max(0.25, Math.round(((status.tempo_ratio ?? 1.0) - 0.05) * 100) / 100));
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1.0) + 0.05) * 100) / 100));
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetDsp();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleShuffle();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleCycleLoopMode();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setLoopPointA(status.position_ms);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setLoopPointB(status.position_ms);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setLoopPointA(null);
        setLoopPointB(null);
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, queue, loopPointA, loopPointB]);

  const handleEnableProAudio = async (cardName: string) => {
    try {
      await invoke('enable_pro_audio', { cardName });
      showMessage(t.notifications.proAudioEnabledMsg.replace('{0}', cardName));
      refreshDevices();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleDisableProAudio = async (cardName: string) => {
    try {
      const fallback = await invoke<string>('disable_pro_audio', { cardName });
      showMessage(t.notifications.proAudioDisabledMsg.replace('{0}', fallback));
      refreshDevices();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSetCardProfile = async (cardName: string, profile: string) => {
    try {
      await invoke('set_card_profile', { cardName, profile });
      showMessage(`Aktywowano profil karty '${cardName}': ${profile}`);
      refreshDevices();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleFetchCurrentTrackCover = async () => {
    const curTrack = status.current_track;
    if (!curTrack) {
      showMessage(t.notifications.noCurrentTrackForCover, true);
      return;
    }
    const albumTitle = curTrack.album || curTrack.title;
    const artist = curTrack.artist || 'Unknown';

    // Znajdź powiązany album w bibliotece
    const foundAlbum = albums.find(
      (a) => a.title.toLowerCase() === albumTitle.toLowerCase() || (curTrack.album && a.title.toLowerCase() === curTrack.album.toLowerCase())
    );

    if (foundAlbum) {
      await handleAutoFetchCover(foundAlbum);
    } else {
      const tempAlbum: AlbumRecord = {
        id: 0,
        title: albumTitle,
        album_artist: artist,
        year: null,
        cover_path: null,
        release_mbid: null,
      };
      handleOpenMbModal(tempAlbum);
    }
  };

  const handleSetBluetoothCodec = async (cardName: string, codec: string) => {
    try {
      await invoke('set_bluetooth_codec', { cardName, codec });
      showMessage(`Zmieniono kodek Bluetooth na: ${codec}`);
      refreshDevices();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handlePickTranscodeSource = async () => {
    try {
      setIsPickingSource(true);
      const selected = await invoke<string | null>('pick_single_audio_file');
      if (selected) {
        setFilePath(selected);
        const lastDot = selected.lastIndexOf('.');
        const base = lastDot > 0 ? selected.substring(0, lastDot) : selected;
        setTranscodeOutput(`${base}.${transcodeFormat.toLowerCase()}`);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsPickingSource(false);
    }
  };

  const handlePickTranscodeDestination = async () => {
    try {
      setIsPickingDestination(true);
      const ext = transcodeFormat.toLowerCase();
      let defaultName = `converted_sample.${ext}`;
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath;
        const lastDot = fileName.lastIndexOf('.');
        const base = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
        defaultName = `${base}.${ext}`;
      }
      const selected = await invoke<string | null>('pick_save_destination', {
        defaultName,
        extension: ext,
      });
      if (selected) {
        setTranscodeOutput(selected);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsPickingDestination(false);
    }
  };

  const handleUseCurrentTrackAsSource = () => {
    const curPath = currentPlayingTrack?.path || status.current_track?.uri;
    if (curPath) {
      setFilePath(curPath);
      const lastDot = curPath.lastIndexOf('.');
      const base = lastDot > 0 ? curPath.substring(0, lastDot) : curPath;
      setTranscodeOutput(`${base}.${transcodeFormat.toLowerCase()}`);
      showMessage(loc.settings.useCurrentTrack);
    } else {
      showMessage(loc.queue.emptyQueueNotice, true);
    }
  };

  const handleTranscode = async () => {
    try {
      let formatObj: any = { Wav: null };
      if (transcodeFormat === 'Opus') {
        formatObj = { Opus: { bitrate_kbps: transcodeBitrate } };
      } else if (transcodeFormat === 'Flac') {
        formatObj = { Flac: { compression_level: 5 } };
      }

      await invoke('transcode_file', {
        inputPath: filePath,
        outputPath: transcodeOutput,
        format: formatObj,
      });

      showMessage(t.notifications.transcodeSuccessMsg.replace('{0}', transcodeOutput));
      await loadLibrary();
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ============================================
  // OBSŁUGA GLOBALNYCH SKRÓTÓW KLAWISZOWYCH
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea';

      // Klawisz Escape zamyka okna modalne, szufladę kolejki, tryb pełnoekranowy lub usuwa focus z pól tekstowych
      if (e.key === 'Escape') {
        setIsBigScreen(false);
        if (isInputActive) {
          (document.activeElement as HTMLElement).blur();
        }
        setIsSettingsOpen(false);
        setIsQueueOpen(false);
        setIsQuickLoadOpen(false);
        setShowPlaylistModal(false);
        setIsScanFolderOpen(false);
        return;
      }

      // Jeśli użytkownik wprowadza tekst, nie przechwytujemy skrótów odtwarzacza
      if (isInputActive) {
        return;
      }

      // Spacja: Odtwarzaj / Wstrzymaj (Play / Pause)
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      // Strzałka w prawo: przewijanie do przodu o 5s (lub Następny przy Ctrl)
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleNext();
        } else {
          const currentPos = statusRef.current.position_ms;
          const duration = statusRef.current.duration_ms || 3600000;
          const newPos = Math.min(duration, currentPos + 5000);
          handleSeek(newPos);
          showMessage(`Seek: +5s (${formatTime(newPos)})`);
        }
        return;
      }

      // Strzałka w lewo: przewijanie w tył o 5s (lub Poprzedni przy Ctrl)
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handlePrevious();
        } else {
          const currentPos = statusRef.current.position_ms;
          const newPos = Math.max(0, currentPos - 5000);
          handleSeek(newPos);
          showMessage(`Seek: -5s (${formatTime(newPos)})`);
        }
        return;
      }

      // Strzałka w górę: Głośność +5%
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        const newVol = Math.min(1.0, Math.round((statusRef.current.volume + 0.05) * 100) / 100);
        handleVolumeChange(newVol);
        showMessage(t.notifications.volumeMsg.replace('{0}', String(Math.round(newVol * 100))));
        return;
      }

      // Strzałka w dół: Głośność -5%
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        const newVol = Math.max(0, Math.round((statusRef.current.volume - 0.05) * 100) / 100);
        handleVolumeChange(newVol);
        showMessage(t.notifications.volumeMsg.replace('{0}', String(Math.round(newVol * 100))));
        return;
      }

      // Klawisz F2 lub Shift + M: Przełącznik Mini-Player
      if (e.code === 'F2' || (e.code === 'KeyM' && e.shiftKey)) {
        e.preventDefault();
        toggleMiniPlayer();
        return;
      }

      // Klawisz F11: Pełny ekran Kiosk / Big Screen
      if (e.code === 'F11') {
        e.preventDefault();
        setIsBigScreen((prev) => !prev);
        return;
      }

      // Klawisz M: Mute / Unmute
      if (e.code === 'KeyM') {
        e.preventDefault();
        const currentVol = statusRef.current.volume;
        const newVol = currentVol === 0 ? 1.0 : 0;
        handleVolumeChange(newVol);
        showMessage(newVol === 0 ? t.notifications.mutedMsg : t.notifications.unmutedMsg);
        return;
      }

      // Klawisz T: Przełącznik tekstów piosenek (Lyrics)
      if (e.code === 'KeyT') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
        return;
      }

      // Klawisz N: Następny utwór
      if (e.code === 'KeyN') {
        e.preventDefault();
        handleNext();
        return;
      }

      // Klawisz P: Poprzedni utwór
      if (e.code === 'KeyP') {
        e.preventDefault();
        handlePrevious();
        return;
      }

      // Klawisz Q: Przełącznik szuflady kolejki
      if (e.code === 'KeyQ') {
        e.preventDefault();
        setIsQueueOpen((prev) => !prev);
        return;
      }

      // Klawisz F lub Ctrl+F: Skocz do wyszukiwarki w Bibliotece
      if ((e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.code === 'KeyF')) {
        e.preventDefault();
        setActiveTab('library');
        setTimeout(() => {
          librarySearchInputRef.current?.focus();
        }, 50);
        return;
      }

      // Cyfry 1-4: Szybkie przełączanie widoków aplikacji
      if (e.key === '1') {
        setActiveTab('player');
      } else if (e.key === '2') {
        setActiveTab('library');
      } else if (e.key === '3') {
        setActiveTab('playlists');
      } else if (e.key === '4') {
        setActiveTab('dsp');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

const renderDevicesSection = () => (
<div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={20} color="var(--accent-green)" /> {loc.settings.audioDevices}
              </h2>
              <button
                onClick={refreshDevices}
                className="glass-card"
                style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.8rem' }}
              >
                <RefreshCw size={14} /> {loc.library.refresh}
              </button>
            </div>

            {/* Opcja płynnego wyciszenia paska postępu (Seek Fade) */}
            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                borderRadius: '12px',
                border: seekFadeEnabled ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
                  {loc.player.seekFadeTitle}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {loc.player.seekFadeDesc}
                </div>
              </div>
              <button
                onClick={handleToggleSeekFade}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: seekFadeEnabled ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border: seekFadeEnabled ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                  color: seekFadeEnabled ? 'var(--accent-pink)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
              </button>
            </div>

            {/* Opcja zapamiętywania ustawień DSP przy uruchomieniu aplikacji */}
            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                borderRadius: '12px',
                border: dspAutoStartup ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
                  {loc.dsp.dspAutostart}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {loc.dsp.bypassActiveNotice}
                </div>
              </div>
              <button
                onClick={handleToggleDspAutoStartup}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: dspAutoStartup ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border: dspAutoStartup ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  color: dspAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {dspAutoStartup ? loc.dsp.dspAutostartOn : loc.dsp.dspAutostartOff}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {cards.map((card) => (
                <div key={card.name} className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {card.is_bluetooth ? <Headphones size={18} color="var(--accent-cyan)" /> : <Zap size={18} color="var(--accent-amber)" />}
                      <span style={{ fontWeight: 600 }}>{card.description}</span>
                    </div>

                    {card.profiles.some((p) => p.is_pro_audio) && (
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: 'var(--accent-green)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        PRO AUDIO READY
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
                    ID: {card.name} | {loc.settings.active}: {card.active_profile || 'default'}
                  </p>

                  {/* Akcje Pro Audio */}
                  {card.profiles.some((p) => p.is_pro_audio) && (
                    <div style={{ marginBottom: '10px' }}>
                      {card.active_profile === 'pro-audio' ? (
                        <button
                          onClick={() => handleDisableProAudio(card.name)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'rgba(244, 63, 94, 0.25)',
                            color: 'var(--accent-pink)',
                            border: '1px solid rgba(244, 63, 94, 0.5)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          ✕ Pro Audio OFF (Stereo)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnableProAudio(card.name)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid var(--border-subtle)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Pro Audio ON (Bit-Perfect Direct ALSA)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Lista wszystkich dostępnych profili sprzętowych karty */}
                  {card.profiles && card.profiles.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {loc.settings.hardwareProfiles}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {card.profiles
                          .filter((p) => p.available && !p.bluetooth_codec)
                          .map((p) => {
                            const isCurrent = card.active_profile === p.name;
                            return (
                              <button
                                key={p.name}
                                onClick={() => handleSetCardProfile(card.name, p.name)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: isCurrent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                  border: `1px solid ${isCurrent ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.08)'}`,
                                  color: isCurrent ? 'var(--accent-green)' : 'var(--text-muted)',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                }}
                                title={p.description || p.name}
                              >
                                {isCurrent ? '✓ ' : ''}{p.description || p.name}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Kodeki Bluetooth */}
                  {card.is_bluetooth && (
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        {loc.settings.bluetoothCodecSelect}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {card.profiles
                          .filter((p) => p.bluetooth_codec)
                          .map((p) => (
                            <button
                              key={p.name}
                              onClick={() => handleSetBluetoothCodec(card.name, p.bluetooth_codec!)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: card.active_profile === p.name ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.06)',
                                color: '#fff',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                              }}
                            >
                              {p.bluetooth_codec === 'Ldac'
                                ? 'Sony LDAC (High-Res 990 kbps)'
                                : p.bluetooth_codec === 'AptxHd'
                                ? 'aptX HD'
                                : p.bluetooth_codec === 'SbcXq'
                                ? 'SBC-XQ (High Quality)'
                                : p.bluetooth_codec}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
  );

  const renderTranscodeSection = () => (
<div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileAudio size={20} color="var(--accent-pink)" /> {loc.settings.exportOpus}
            </h2>

            {/* Baner bezpieczeństwa */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                marginBottom: '24px',
              }}
            >
              <ShieldCheck size={24} color="var(--accent-green)" />
              <div>
                <strong style={{ color: 'var(--accent-green)', fontSize: '0.85rem' }}>{loc.settings.transcodeIntegrity}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {loc.settings.transcodeIntegrityDesc}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {loc.settings.sourceFile}
                  </label>
                  {(currentPlayingTrack?.path || status.current_track?.uri) && (
                    <button
                      type="button"
                      onClick={handleUseCurrentTrackAsSource}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(236, 72, 153, 0.15)',
                        border: '1px solid rgba(236, 72, 153, 0.35)',
                        color: 'var(--accent-pink)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Music size={12} />
                      {loc.settings.useCurrentTrack}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="button"
                    disabled={isPickingSource}
                    onClick={handlePickTranscodeSource}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(168, 85, 247, 0.25))',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isPickingSource ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: isPickingSource ? 0.7 : 1,
                    }}
                    title={loc.settings.chooseSource}
                  >
                    {isPickingSource ? (
                      <Loader2 size={16} className="spin" color="var(--accent-cyan)" />
                    ) : (
                      <FolderOpen size={16} color="var(--accent-cyan)" />
                    )}
                    {loc.settings.chooseFile}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {loc.settings.outputFile}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={transcodeOutput}
                    onChange={(e) => setTranscodeOutput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="button"
                    disabled={isPickingDestination}
                    onClick={handlePickTranscodeDestination}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isPickingDestination ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: isPickingDestination ? 0.7 : 1,
                    }}
                    title={loc.settings.chooseDestination}
                  >
                    {isPickingDestination ? (
                      <Loader2 size={16} className="spin" color="var(--accent-pink)" />
                    ) : (
                      <Save size={16} color="var(--accent-pink)" />
                    )}
                    {loc.settings.chooseDestination}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  {loc.settings.targetFormat}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['Opus', 'Flac', 'Wav'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        setTranscodeFormat(fmt);
                        const base = filePath.substring(0, filePath.lastIndexOf('.')) || filePath;
                        setTranscodeOutput(`${base}.${fmt.toLowerCase()}`);
                      }}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        background: transcodeFormat === fmt ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                      }}
                    >
                      {fmt === 'Opus' ? 'Ogg Opus' : fmt === 'Flac' ? loc.settings.losslessFlac : loc.settings.wavPcm}
                    </button>
                  ))}
                </div>
              </div>

              {transcodeFormat === 'Opus' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    {loc.settings.opusBitrate} <strong style={{ color: 'var(--accent-cyan)' }}>{transcodeBitrate} kbps</strong>
                  </label>
                  <input
                    type="range"
                    min={64}
                    max={320}
                    step={32}
                    value={transcodeBitrate}
                    onChange={(e) => setTranscodeBitrate(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <button
                onClick={handleTranscode}
                style={{
                  marginTop: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  boxShadow: 'var(--shadow-glow)',
                }}
              >
                {loc.settings.exportOpus}
              </button>
            </div>
          </div>
  );

  const renderThemesSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Wybór języka interfejsu w ustawieniach */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} color="var(--accent-cyan)" /> {loc.settings.language}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            English • Polski • Deutsch • Suomi • Latina
          </p>
        </div>
        <LanguageSelector currentLang={language} onLanguageChange={handleLanguageChange} />
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Palette size={26} color="var(--accent-purple)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {loc.settings.themes}
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          {loc.settings.themesSubtitle}
        </p>
      </div>

      {/* Siatka presetów Anime */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {themes.map((th) => {
          const isActive = currentTheme?.id === th.id;
          return (
            <div
              key={th.id}
              className="glass-card"
              style={{
                padding: '20px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: isActive ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                background: isActive ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {th.name}
                </h3>
                {isActive && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '20px',
                      background: 'var(--accent-purple)',
                      color: '#fff',
                    }}
                  >
                    {loc.settings.active}
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {th.attribution || 'Auralune Theme'}
              </p>

              {/* Próbnik kolorów tokenów */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <div
                  title={`${loc.settings.tokenBg}: ${th.tokens.bg_deep}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.bg_deep,
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <div
                  title={`${loc.settings.tokenCard}: ${th.tokens.bg_card}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.bg_card,
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <div
                  title={`${loc.settings.tokenPink}: ${th.tokens.accent_pink}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.accent_pink,
                  }}
                />
                <div
                  title={`${loc.settings.tokenPurple}: ${th.tokens.accent_purple}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.accent_purple,
                  }}
                />
                <div
                  title={`${loc.settings.tokenCyan}: ${th.tokens.accent_cyan}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.accent_cyan,
                  }}
                />
              </div>

              <button
                onClick={() => handleSelectTheme(th.id)}
                disabled={isActive}
                style={{
                  marginTop: '8px',
                  padding: '10px',
                  borderRadius: '10px',
                  background: isActive
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: isActive ? 'var(--text-muted)' : '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {isActive ? loc.settings.active : loc.common.confirm}
              </button>
            </div>
          );
        })}
      </div>

      {/* Menedżer własnego tła anime */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ImageIcon size={22} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {loc.settings.appearance}
          </h3>
        </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Strefa Drag & Drop dla tapety */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingWallpaper(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingWallpaper(false);
                    }}
                    onDrop={handleWallpaperDrop}
                    onClick={handlePickWallpaperFromDisk}
                    style={{
                      padding: '24px 20px',
                      borderRadius: '14px',
                      border: isDraggingWallpaper
                        ? '2px dashed var(--accent-pink)'
                        : '2px dashed rgba(255, 255, 255, 0.2)',
                      background: isDraggingWallpaper
                        ? 'rgba(236, 72, 153, 0.15)'
                        : 'rgba(0, 0, 0, 0.22)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      boxShadow: isDraggingWallpaper ? '0 0 20px rgba(236, 72, 153, 0.35)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: isDraggingWallpaper
                          ? 'rgba(236, 72, 153, 0.25)'
                          : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDraggingWallpaper ? 'var(--accent-pink)' : 'var(--accent-cyan)',
                      }}
                    >
                      <UploadCloud size={24} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                        {loc.settings.dragDropWallpaper}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        PNG, JPG, WebP • Kliknij lub przeciągnij plik tutaj
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      {loc.settings.customBgLabel}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={customBgPath}
                        onChange={(e) => setCustomBgPath(e.target.value)}
                        placeholder={loc.settings.customBgPlaceholder}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--border-subtle)',
                          color: '#fff',
                          fontSize: '0.85rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handlePickWallpaperFromDisk}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(168, 85, 247, 0.25))',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title={loc.settings.chooseWallpaper}
                      >
                        <FolderOpen size={16} color="var(--accent-cyan)" />
                        {loc.settings.chooseFile}
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadBgImage}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          background: 'var(--accent-purple)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Upload size={16} />
                        {loc.player.load}
                      </button>
                    </div>
                  </div>

                  {themeBgImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '12px' }}>
                      <div
                        style={{
                          width: '60px',
                          height: '42px',
                          borderRadius: '8px',
                          backgroundImage: `url("${themeBgImage}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          border: '1px solid var(--border-subtle)',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {loc.settings.active}
                        </p>
                      </div>
                      <button
                        onClick={handleRemoveBgImage}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(244, 63, 94, 0.2)',
                          color: 'var(--accent-pink)',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Trash2 size={14} />
                        {loc.common.remove}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleSaveBackgroundSettings}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: 'var(--shadow-glow)',
                    }}
                  >
                    <Save size={16} />
                    {loc.common.save}
                  </button>
                </div>

                {/* Suwaki Overlay i Blur */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {loc.settings.themeOpacity}:
                      </label>
                      <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
                        {Math.round(themeOverlay * 100)}%
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={0.9}
                      step={0.05}
                      value={themeOverlay}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setThemeOverlay(val);
                        document.documentElement.style.setProperty('--bg-overlay', `${val}`);
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {loc.settings.themeBlur}:
                      </label>
                      <strong style={{ color: 'var(--accent-purple)', fontSize: '0.9rem' }}>
                        {themeBlur} px
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={themeBlur}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setThemeBlur(val);
                        document.documentElement.style.setProperty('--bg-blur', `${val}px`);
                      }}
                      style={{ width: '100%' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {loc.settings.blurHelp}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Wybór stylu ikony aplikacji (Neon Lineout vs Classic Anime) */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Sparkles size={22} color="var(--accent-pink)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  {loc.settings.appIconTitle}
                </h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
                {loc.settings.appIconDesc}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Opcja 1: Neon Lineout */}
                <div
                  onClick={() => handleSelectIconStyle('lineout')}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: appIconStyle === 'lineout' ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                    boxShadow: appIconStyle === 'lineout' ? '0 0 18px rgba(236, 72, 153, 0.35)' : 'none',
                    background: appIconStyle === 'lineout' ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '14px',
                      background: 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    <img
                      src="/icon_lineout.png"
                      alt="Neon Lineout"
                      style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {loc.settings.iconStyleLineout}
                      </h4>
                      {appIconStyle === 'lineout' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: 'var(--accent-pink)',
                            color: '#fff',
                          }}
                        >
                          {loc.settings.active}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                      {loc.settings.iconStyleLineoutDesc}
                    </p>
                  </div>
                </div>

                {/* Opcja 2: Classic Anime */}
                <div
                  onClick={() => handleSelectIconStyle('classic')}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: appIconStyle === 'classic' ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                    boxShadow: appIconStyle === 'classic' ? '0 0 18px rgba(168, 85, 247, 0.35)' : 'none',
                    background: appIconStyle === 'classic' ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '14px',
                      background: 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    <img
                      src="/icon_classic.png"
                      alt="Classic Anime"
                      style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '10px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {loc.settings.iconStyleClassic}
                      </h4>
                      {appIconStyle === 'classic' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: 'var(--accent-purple)',
                            color: '#fff',
                          }}
                        >
                          {loc.settings.active}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                      {loc.settings.iconStyleClassicDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bezpieczny Import i Eksport JSON */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Download size={22} color="var(--accent-pink)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  {loc.settings.themePortability}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Eksport */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {loc.settings.exportTheme}:
                    </label>
                    <button
                      onClick={handleExportTheme}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'var(--accent-purple)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {loc.settings.generateJson}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={jsonExportContent}
                    placeholder={loc.settings.generateJsonPlaceholder}
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--accent-cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      resize: 'none',
                    }}
                  />
                  {jsonExportContent && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(jsonExportContent);
                        setCopiedJson(true);
                        setTimeout(() => setCopiedJson(false), 2000);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      {copiedJson ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiedJson ? loc.settings.copiedJson : loc.settings.copyJson}
                    </button>
                  )}
                </div>

                {/* Import */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {loc.settings.importTheme}:
                  </label>
                  <textarea
                    value={jsonImportContent}
                    onChange={(e) => setJsonImportContent(e.target.value)}
                    placeholder={loc.settings.importPlaceholder}
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      resize: 'none',
                    }}
                  />
                  <button
                    onClick={handleImportTheme}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Upload size={16} />
                    {loc.settings.verifyImport}
                  </button>
                </div>
              </div>
            </div>
          </div>
  );

  const renderAboutSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '750px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <img
          src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
          alt="Auralune Logo"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            objectFit: 'contain',
            background: 'rgba(0, 0, 0, 0.3)',
            boxShadow: appIconStyle === 'classic' ? '0 0 24px rgba(168, 85, 247, 0.55)' : '0 0 24px rgba(236, 72, 153, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: appIconStyle === 'classic' ? '0' : '4px',
          }}
        />
        <div>
          <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Auralune Kitsune Player</h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--accent-pink)', fontSize: '0.88rem', fontWeight: 700 }}>
            {loc.settings.version} 0.2.0 „Kitsune” • {loc.settings.author}: Das Letzte Kemonomimi
          </p>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
            Auralune: Audio DSP Player for Linux. High quality, extensible foobar2000-like flexibility, and anime aesthetics.
          </p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', fontWeight: 600 }}>
              SemVer: Major (1.0) • Minor (0.X) • Patch (0.1.X)
            </span>
            <button
              onClick={() => setSettingsTab('changelog')}
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <History size={13} />
              {loc.settings.changelog}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutAudioEngine}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            GStreamer + PipeWire Pro Audio
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutAudioEngineDesc}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutDsp}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
            SoundTouch & Rubber Band
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutDspDesc}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutLibrary}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-purple)' }}>
            SQLite (sqlx) + Cover Art Archive
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutLibraryDesc}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutLicense}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-green)' }}>
            GPL-3.0-or-later
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutLicenseDesc}
          </p>
        </div>
      </div>

      {/* Karta Skrótów Klawiszowych */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
          <Keyboard size={18} color="var(--accent-pink)" /> {loc.shortcuts.title}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
          {[
            { key: 'Space', desc: loc.shortcuts.playPause },
            { key: '← / →', desc: loc.shortcuts.seekFwdBack },
            { key: 'Ctrl + ← / →', desc: `${loc.shortcuts.prevTrack} / ${loc.shortcuts.nextTrack}` },
            { key: '↑ / ↓', desc: loc.shortcuts.volUpDown },
            { key: 'M', desc: loc.shortcuts.muteUnmute },
            { key: 'N / P', desc: `${loc.shortcuts.nextTrack} / ${loc.shortcuts.prevTrack}` },
            { key: 'Q', desc: loc.nav.queue },
            { key: 'F / Ctrl+F', desc: loc.library.searchPlaceholder },
            { key: '1, 2, 3, 4', desc: `${loc.nav.nowPlaying}, ${loc.nav.library}, ${loc.nav.playlists}, ${loc.nav.dsp}` },
            { key: 'Esc', desc: loc.common.close },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
              <kbd
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  color: 'var(--accent-pink)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Karta Zastrzeżenia / Brak Gwarancji */}
      <div
        style={{
          padding: '18px 22px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(234,88,12,0.06) 100%)',
          border: '1px solid rgba(245,158,11,0.30)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.08)',
        }}
      >
        <h4 style={{
          margin: '0 0 10px 0',
          fontSize: '0.95rem',
          fontWeight: 800,
          color: '#fbbf24',
          letterSpacing: '0.01em',
        }}>
          {loc.settings.disclaimerTitle}
        </h4>
        <p style={{
          margin: 0,
          fontSize: '0.78rem',
          color: 'rgba(251,191,36,0.85)',
          lineHeight: 1.7,
        }}>
          {loc.settings.disclaimerBody}
        </p>
      </div>

      {/* Karta Konfiguracji Głośności, OSD i Statystyk Recap */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={18} color="var(--accent-cyan)" /> {currentLang === 'pl' ? 'Regulacja Głośności, OSD i Statystyki' : 'Volume, OSD & Recap Settings'}
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
          {/* Tryb głośności: Natychmiastowy vs Płynny */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {currentLang === 'pl' ? 'Szybkość reakcji suwaka głośności:' : 'Volume Slider Response:'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {instantVolume
                  ? (currentLang === 'pl' ? 'Natychmiastowa (Direct Zero-Latency) - brak opóźnienia' : 'Instant (Zero-Latency) - immediate change')
                  : (currentLang === 'pl' ? 'Płynna (Smooth Fade) - łagodne przejście' : 'Smooth Fade - subtle fade ramp')}
              </div>
            </div>
            <button
              onClick={() => {
                const next = !instantVolume;
                setInstantVolume(next);
                try {
                  localStorage.setItem('auralune_instant_volume', String(next));
                } catch {}
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                background: instantVolume ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${instantVolume ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                color: instantVolume ? 'var(--accent-cyan)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {instantVolume ? (currentLang === 'pl' ? '⚡ Natychmiast' : '⚡ Instant') : (currentLang === 'pl' ? '🌊 Płynnie (Fade)' : '🌊 Smooth Fade')}
            </button>
          </div>

          {/* Pozycja OSD głośności */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {currentLang === 'pl' ? 'Pozycja wskaźnika głośności (OSD):' : 'Volume OSD Position:'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {currentLang === 'pl' ? 'Pływające przezroczyste powiadomienie przy zmianie głośności' : 'Translucent floating HUD when volume changes'}
              </div>
            </div>
            <select
              value={volumeOsdPosition}
              onChange={(e) => {
                const pos = e.target.value as VolumeOsdPosition;
                setVolumeOsdPosition(pos);
                try {
                  localStorage.setItem('auralune_volume_osd_position', pos);
                } catch {}
              }}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#fff',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <option value="bottom-center" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Dół (Środek)' : 'Bottom (Center)'}</option>
              <option value="center" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Środek ekranu' : 'Screen Center'}</option>
              <option value="top-right" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Góra (Prawo)' : 'Top (Right)'}</option>
              <option value="top-left" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Góra (Lewo)' : 'Top (Left)'}</option>
              <option value="bottom-right" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Dół (Prawo)' : 'Bottom (Right)'}</option>
              <option value="bottom-left" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Dół (Lewo)' : 'Bottom (Left)'}</option>
              <option value="off" style={{ background: '#121420' }}>{currentLang === 'pl' ? 'Wyłączone (Off)' : 'Disabled (Off)'}</option>
            </select>
          </div>

          {/* Zgoda na Auralune Recap (Opt-In) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {currentLang === 'pl' ? 'Auralune Recap (Podsumowania Tydzień / Miesiąc / Rok):' : 'Auralune Recap (Rewind & Statistics):'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {currentLang === 'pl' ? 'Lokalne zliczanie czasu słuchania i rankingów w bazie SQLite' : 'Track listening hours and top artists locally in SQLite'}
              </div>
            </div>
            <button
              onClick={() => {
                const next = !recapOptIn;
                setRecapOptIn(next);
                try {
                  localStorage.setItem('auralune_recap_opt_in', String(next));
                } catch {}
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                background: recapOptIn ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${recapOptIn ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                color: recapOptIn ? 'var(--accent-pink)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {recapOptIn ? (currentLang === 'pl' ? '✓ Włączone' : '✓ Enabled') : (currentLang === 'pl' ? '○ Wyłączone' : '○ Disabled')}
            </button>
          </div>

          {/* Przycisk Ponownego uruchomienia kreatora powitalnego */}
          <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsOnboardingOpen(true)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
              }}
            >
              {currentLang === 'pl' ? '🚀 Uruchom ponownie kreator powitalny (Onboarding)' : '🚀 Relaunch Welcome Onboarding Wizard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );


  const renderChangelogSection = () => (
    <ChangelogView currentLang={language} />
  );

  // Widok miniaturowego pływającego odtwarzacza (Floating Mini-Player / PiP)
  if (isMiniPlayer) {
    const activeTrack = currentPlayingTrack || (status.current_track ? {
      title: status.current_track.title,
      artist: status.current_track.artist,
      duration_ms: status.current_track.duration_ms,
    } : null);

    return (
      <MiniPlayerWidget
        title={activeTrack?.title || (filePath ? filePath.split('/').pop() || 'Auralune' : 'Auralune')}
        artist={activeTrack?.artist || loc.player.noTrack}
        coverUrl={currentCover}
        isPlaying={status.state === 'Playing'}
        positionMs={status.position_ms}
        durationMs={status.duration_ms}
        volume={status.volume}
        pitchSemitones={status.pitch_semitones}
        tempoRatio={status.tempo_ratio}
        currentLang={language}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onRestore={toggleMiniPlayer}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', position: 'relative' }}>
      {/* Dynamiczne tło anime z kontrolowanym rozmyciem i nakładką (obsługa statycznych grafik oraz wideo MP4/WebM) */}
      {themeBgImage && (themeBgImage.toLowerCase().endsWith('.mp4') || themeBgImage.toLowerCase().endsWith('.webm') || themeBgImage.startsWith('data:video/')) ? (
        <video
          className="anime-bg-layer"
          src={themeBgImage}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: -2,
            filter: `blur(${themeBlur || 0}px)`,
            transform: 'scale(1.05)',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          className="anime-bg-layer"
          style={{
            backgroundImage: themeBgImage ? `url("${themeBgImage}")` : undefined,
            display: themeBgImage ? 'block' : 'none',
            filter: `blur(${themeBlur || 0}px)`,
          }}
        />
      )}
      <div
        className="anime-overlay-layer"
        style={{
          display: themeBgImage ? 'block' : 'none',
          opacity: themeOverlay,
        }}
      />

      {/* Ekranowe OSD głośności z konfigurowalnym położeniem */}
      <VolumeOsd volume={status.volume} position={volumeOsdPosition} />

      {/* Efekt otoczenia Anime (Sakura Petals / Neon Rain) */}
      <AnimeAmbienceFX mode={isBigScreen ? 'off' : ambienceMode} />

      {/* Główny kontener interfejsu (ukrywany bez utraty stanu gdy aktywny jest tryb pełnoekranowy Kiosk) */}
      <div style={{ display: isBigScreen ? 'none' : 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Globalny ekran nakładki przeciągania plików (Drag & Drop Overlay) */}
      {isDraggingOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(9, 10, 18, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            border: '3px dashed var(--accent-pink)',
            borderRadius: '24px',
            margin: '16px',
            pointerEvents: 'none',
            animation: 'pulse-drop 2s infinite ease-in-out',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 35px rgba(244, 63, 94, 0.6)',
              animation: 'bounce-drop 1.5s infinite ease-in-out',
            }}
          >
            <UploadCloud size={52} color="#fff" />
          </div>
          <div style={{ textAlign: 'center', maxWidth: '600px', padding: '0 20px' }}>
            <h2
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: '#fff',
                margin: '0 0 10px 0',
                letterSpacing: '-0.02em',
                textShadow: '0 4px 20px rgba(0,0,0,0.6)',
              }}
            >
              {loc.dragDrop.title}
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--accent-cyan)', margin: '0 0 12px 0', fontWeight: 600 }}>
              {loc.dragDrop.subtitle}
            </p>
            <div
              style={{
                display: 'inline-flex',
                gap: '8px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '8px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {['FLAC', 'MP3', 'OGG', 'OPUS', 'WAV', 'M4A', 'AAC', 'ALAC'].map((fmt) => (
                <span
                  key={fmt}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pasek górny / Nagłówek */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
            alt="Auralune Logo"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              objectFit: 'contain',
              background: 'rgba(0, 0, 0, 0.25)',
              boxShadow: appIconStyle === 'classic' ? '0 0 16px rgba(168, 85, 247, 0.45)' : '0 0 16px rgba(236, 72, 153, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: appIconStyle === 'classic' ? '0' : '2px',
            }}
          />
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Auralune <span style={{ color: 'var(--accent-pink)', fontSize: '0.9rem' }}>狐 Kitsune</span></span>
              <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '5px', background: 'rgba(168, 85, 247, 0.25)', color: 'var(--accent-purple)', fontWeight: 700, border: '1px solid rgba(168, 85, 247, 0.4)' }}>v0.2.0</span>
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Linux High-Fidelity DSP & PipeWire Audio Engine
            </p>
          </div>
        </div>

        {/* Zakładki główne aplikacji */}
        <nav style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('player')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeTab === 'player' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {loc.nav.nowPlaying}
          </button>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeTab === 'library' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {loc.nav.library} ({tracks.length})
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeTab === 'playlists' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ListPlus size={15} />
            {loc.nav.playlists} ({playlists.length})
          </button>
          <button
            onClick={() => setActiveTab('dsp')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeTab === 'dsp' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <SlidersHorizontal size={15} />
            {loc.nav.dsp}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeTab === 'stats' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BarChart3 size={15} />
            {loc.nav.stats}
          </button>
        </nav>

        {/* Narzędzia i Ustawienia po prawej */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Przycisk Podsumowania Muzycznego (Auralune Recap / Spotify Wrapped) */}
          <button
            onClick={() => setIsRecapModalOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(168, 85, 247, 0.25))',
              border: '1px solid rgba(244, 63, 94, 0.45)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(244, 63, 94, 0.2)',
              transition: 'all 0.2s ease',
            }}
            title={currentLang === 'pl' ? 'Auralune Recap (Tydzień, Miesiąc, Rok)' : 'Auralune Recap (Weekly, Monthly, Yearly)'}
          >
            <Flame size={15} color="var(--accent-pink)" />
            <span>Recap</span>
          </button>

          {/* Przycisk Klucza i Tempa utworu */}
          <button
            onClick={() => setIsKeyBpmModalOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: 'var(--accent-cyan)',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={currentLang === 'pl' ? 'Klucz i Tempo utworu (BPM & Key)' : 'Musical Key & Tempo (BPM & Key)'}
          >
            <Activity size={15} color="var(--accent-cyan)" />
            <span>Key & BPM</span>
          </button>

          {/* Wyłącznik Czasowy (Sleep Timer) z wyrazistym, neonowym podświetleniem */}
          <button
            onClick={() => setIsSleepTimerOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background:
                sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                  ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.4), rgba(6, 182, 212, 0.4))'
                  : 'rgba(255, 255, 255, 0.06)',
              border:
                sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                  ? '1px solid var(--accent-cyan)'
                  : '1px solid var(--border-subtle)',
              color:
                sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                  ? '#ffffff'
                  : 'var(--text-secondary)',
              boxShadow:
                sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                  ? '0 0 14px rgba(6, 182, 212, 0.5)'
                  : 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={loc.player.sleepTimer}
          >
            <Moon size={15} color={sleepTimerRemainingSec !== null ? 'var(--accent-cyan)' : 'currentColor'} />
            {sleepTimerRemainingSec !== null
              ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
              : sleepTimerTargetMode === 'end_of_track'
              ? (currentLang === 'pl' ? 'Koniec utworu' : 'End of Track')
              : 'Timer'}
          </button>
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: showLyrics ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: showLyrics ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              color: showLyrics ? 'var(--accent-cyan)' : '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title={loc.shortcuts.lyrics}
          >
            <Mic2 size={15} />
            {loc.nav.lyrics}
          </button>

          <button
            onClick={cycleAmbienceMode}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: ambienceMode !== 'off' ? 'rgba(255, 105, 180, 0.22)' : 'rgba(255, 255, 255, 0.06)',
              border: ambienceMode !== 'off' ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
              color: ambienceMode !== 'off' ? 'var(--accent-pink)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={`Ambience: ${ambienceMode === 'sakura' ? 'Sakura 🌸' : ambienceMode === 'neon_rain' ? 'Neon Rain 🌧️' : 'Off'}`}
          >
            <Sparkles size={15} />
            {ambienceMode === 'sakura' ? 'Sakura 🌸' : ambienceMode === 'neon_rain' ? 'Neon 🌧️' : loc.nav.effects}
          </button>

          <button
            onClick={() => setIsBigScreen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title={loc.shortcuts.fullscreen}
          >
            <Maximize2 size={15} />
            {loc.nav.fullscreen}
          </button>

          <button
            onClick={toggleMiniPlayer}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title={loc.shortcuts.miniPlayer}
          >
            <Minimize2 size={15} />
            {loc.nav.miniPlayer}
          </button>

          <button
            onClick={() => setIsQueueOpen(!isQueueOpen)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: isQueueOpen ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isQueueOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
              color: isQueueOpen ? 'var(--accent-pink)' : '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <ListMusic size={15} />
            {loc.nav.queue} ({queue.items.length})
          </button>

          <button
            onClick={() => {
              setSettingsTab('themes');
              setIsSettingsOpen(true);
            }}
            className="glass-card"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              color: isSettingsOpen ? 'var(--accent-purple)' : '#fff',
              border: isSettingsOpen ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
              background: isSettingsOpen ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title={loc.settings.subtitle}
          >
            <Settings size={15} />
            {loc.settings.title}
          </button>

          {/* Wybór języka interfejsu (Language Selector) */}
          <LanguageSelector
            currentLang={language}
            onLanguageChange={handleLanguageChange}
          />
        </div>
      </header>

      {/* Komunikat powiadomień */}
      {infoMessage && (
        <div
          style={{
            padding: '10px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'rgba(168, 85, 247, 0.2)',
            border: '1px solid var(--accent-purple)',
            color: '#fff',
            fontSize: '0.85rem',
          }}
        >
          {infoMessage}
        </div>
      )}

      {/* Główna zawartość */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: activeTab !== 'player' ? '88px' : '0' }}>
        {/* ZAKŁADKA 1: ODTWARZACZ (NOWOCZESNY WIDOK HI-FI DESKTOP) */}
        {activeTab === 'player' && (
          <div style={{ maxWidth: 'min(1500px, 95vw)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
            <div className="glass-panel" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Górny pasek narzędziowy: silnik audio i dyskretny przycisk otwarcia pliku */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: 'rgba(6, 182, 212, 0.12)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <Radio size={13} /> PipeWire Hi-Fi • {status.engine}
                </span>

                {status.equalizer_enabled && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      borderRadius: '20px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.35)',
                      color: 'var(--accent-purple)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    10-Band EQ
                  </span>
                )}
              </div>

              {/* Dyskretne otwieranie pliku zamiast wielkiego pola tekstowego */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsQuickLoadOpen(!isQuickLoadOpen)}
                  className="glass-card"
                  style={{
                    padding: '7px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: isQuickLoadOpen ? 'var(--accent-pink)' : 'var(--text-secondary)',
                    border: isQuickLoadOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  title={loc.player.quickLoadHint}
                >
                  <FolderOpen size={15} />
                  <span>{loc.player.openFile}</span>
                </button>

                {/* Zwijany elegancki dropdown szybkiego ładowania */}
                {isQuickLoadOpen && (
                  <div
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '8px',
                      width: '380px',
                      padding: '16px',
                      zIndex: 50,
                      boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: '14px',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{loc.player.quickLoadTitle}</span>
                      <button
                        onClick={() => setIsQuickLoadOpen(false)}
                        style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        value={filePath}
                        onChange={(e) => setFilePath(e.target.value)}
                        placeholder="tests/fixtures/test_sine_440hz.wav"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(0,0,0,0.4)',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                        }}
                      />
                      <button
                        onClick={() => {
                          handleLoadFile(filePath);
                          setIsQuickLoadOpen(false);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                          color: '#fff',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {loc.player.load}
                      </button>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        {loc.player.testSamples}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setFilePath('tests/fixtures/test_sine_440hz.wav');
                            handleLoadFile('tests/fixtures/test_sine_440hz.wav');
                            setIsQuickLoadOpen(false);
                          }}
                          className="glass-card"
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}
                        >
                          WAV 440 Hz
                        </button>
                        <button
                          onClick={() => {
                            setFilePath('tests/fixtures/test_sine_440hz.opus');
                            handleLoadFile('tests/fixtures/test_sine_440hz.opus');
                            setIsQuickLoadOpen(false);
                          }}
                          className="glass-card"
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-cyan)', textAlign: 'center' }}
                        >
                          Opus 48 kHz
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Główny pulpit odtwarzacza: układ 2-kolumnowy (Okładka/Winyl + Kontrolki & Spektrogram) */}
            <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: '28px', alignItems: 'center' }}>
              {/* Kolumna lewa: Okładka / Winyl */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '220px',
                    height: '220px',
                    borderRadius: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: currentCover
                      ? `url("${currentCover}") center/cover no-repeat`
                      : 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
                    boxShadow: status.state === 'Playing'
                      ? '0 0 28px rgba(244, 63, 94, 0.45), 0 0 50px rgba(168, 85, 247, 0.3)'
                      : 'var(--shadow-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'box-shadow 0.3s ease',
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                  }}
                >
                  {!currentCover && (
                    <div
                      style={{
                        width: '188px',
                        height: '188px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #0b0f19 35%, #182032 50%, #0f172a 75%, #050811 100%)',
                        border: '2px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5)',
                        animation: status.state === 'Playing' ? 'spin 12s linear infinite' : 'none',
                      }}
                    >
                      {/* Centrum winylu z logo Kitsune */}
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '3px solid rgba(0,0,0,0.6)',
                          boxShadow: '0 0 10px rgba(244, 63, 94, 0.5)',
                        }}
                      >
                        <Disc size={28} color="#fff" />
                      </div>
                    </div>
                  )}

                  {/* Badge formatu na okładce */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(0, 0, 0, 0.88)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--accent-cyan)',
                      border: '1px solid rgba(6, 182, 212, 0.35)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {status.current_track?.duration_ms ? 'HI-RES AUDIO' : 'PIPEWIRE'}
                  </div>
                </div>

                {/* Przyciski okładki: Dopasuj online oraz Wgraj własną z dysku */}
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', width: '100%', maxWidth: '240px' }}>
                  <button
                    onClick={() => {
                      if (currentAlbum) {
                        handleOpenCoverPicker(currentAlbum);
                      } else {
                        handleFetchCurrentTrackCover();
                      }
                    }}
                    title={loc.covers.matchCoverTitle}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(168, 85, 247, 0.2))',
                      border: '1px solid rgba(244, 63, 94, 0.35)',
                      color: '#fff',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Sparkles size={12} color="var(--accent-pink)" /> {loc.covers.matchCover}
                  </button>
                  <button
                    onClick={() => handleUploadCustomCoverDirect(currentAlbum)}
                    title={loc.covers.uploadCustomCover}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      background: 'rgba(6, 182, 212, 0.15)',
                      border: '1px solid rgba(6, 182, 212, 0.35)',
                      color: '#fff',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Upload size={12} color="var(--accent-cyan)" /> {loc.covers.uploadCustomCover}
                  </button>
                </div>
              </div>

              {/* Kolumna prawa: Tytuł, Wykonawca, Spektrogram, Seeker i Przyciski */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background:
                          status.state === 'Playing'
                            ? 'var(--accent-green)'
                            : status.state === 'Paused'
                            ? 'var(--accent-amber)'
                            : 'var(--text-muted)',
                        boxShadow: status.state === 'Playing' ? '0 0 8px var(--accent-green)' : 'none',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {status.state === 'Playing' ? loc.player.statePlaying : status.state === 'Paused' ? loc.player.statePaused : loc.player.stateStopped}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.35rem',
                          fontWeight: 800,
                          color: '#fff',
                          letterSpacing: '-0.02em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {currentPlayingTrack?.title || status.current_track?.title || (filePath ? filePath.split('/').pop() : '') || 'Auralune Audio Player'}
                      </h3>
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: '0.88rem',
                          color: 'var(--accent-pink)',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {currentPlayingTrack?.artist || status.current_track?.artist || loc.player.unknownArtist} {currentAlbum?.title || currentPlayingTrack?.album_artist || status.current_track?.album ? `• ${currentAlbum?.title || currentPlayingTrack?.album_artist || status.current_track?.album}` : ''}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          if (currentPlayingTrack) {
                            setStatsModalTrack(currentPlayingTrack);
                          } else if (status.current_track) {
                            setStatsModalTrack({
                              id: status.current_track.track_id || 0,
                              title: status.current_track.title || (filePath ? filePath.split('/').pop() || 'Auralune Audio Player' : 'Auralune Audio Player'),
                              artist: status.current_track.artist || loc.player.unknownArtist,
                              album: status.current_track.album || undefined,
                              path: status.current_track.uri || filePath,
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
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          borderRadius: '8px',
                          color: 'var(--accent-amber)',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <BarChart3 size={16} />
                        <span>{currentPlayingTrack?.play_count || 0} {loc.player.plays}</span>
                      </button>

                      {currentPlayingTrack && (
                        <button
                          onClick={(e) => handleToggleFavorite(currentPlayingTrack.id, e)}
                          title={currentPlayingTrack.is_favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
                          style={{
                            background: currentPlayingTrack.is_favorite ? 'rgba(255, 77, 148, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                            border: currentPlayingTrack.is_favorite ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: currentPlayingTrack.is_favorite ? 'var(--accent-pink)' : 'var(--text-muted)',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Heart size={16} fill={currentPlayingTrack.is_favorite ? 'var(--accent-pink)' : 'none'} />
                          {currentPlayingTrack.is_favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
                        </button>
                      )}

                      {(currentPlayingTrack?.path || status.current_track?.uri || filePath) && (
                        <button
                          onClick={(e) =>
                            handleOpenContainingFolder(
                              currentPlayingTrack?.path || status.current_track?.uri || filePath,
                              e
                            )
                          }
                          title={loc.queue.openContainingFolder}
                          style={{
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.35)',
                            borderRadius: '8px',
                            color: 'var(--accent-cyan)',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <FolderOpen size={15} />
                          <span>Dolphin</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Żywy animowany Canvas Spectrum Visualizer */}
                <SpectrumVisualizer
                  spectrum={status.spectrum}
                  isPlaying={status.state === 'Playing'}
                />

                {/* Szybkie Profile Klimatyczne DSP (Quick DSP Vibes) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '2px 0 0 0' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {t.quickVibes.label}
                  </span>
                  {[
                    { id: 'nightcore', label: t.quickVibes.nightcore, desc: t.quickVibes.nightcoreDesc },
                    { id: 'slowed', label: t.quickVibes.slowed, desc: t.quickVibes.slowedDesc },
                    { id: 'vocal', label: t.quickVibes.vocal, desc: t.quickVibes.vocalDesc },
                    { id: 'bass', label: t.quickVibes.bass, desc: t.quickVibes.bassDesc },
                    { id: 'flat', label: t.quickVibes.flat, desc: t.quickVibes.flatDesc },
                  ].map((v) => {
                    const isSelected = activeDspVibe === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleApplyDspVibe(v.id as any)}
                        title={v.desc}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '16px',
                          fontSize: '0.74rem',
                          fontWeight: isSelected ? 700 : 600,
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.35), rgba(168, 85, 247, 0.35))'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: isSelected
                            ? '1px solid var(--accent-pink)'
                            : '1px solid var(--border-subtle)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isSelected ? '0 0 14px rgba(244, 63, 94, 0.45)' : 'none',
                        }}
                      >
                        {isSelected && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--accent-pink)',
                              boxShadow: '0 0 6px var(--accent-pink)',
                            }}
                          />
                        )}
                        {v.label}
                      </button>
                    );
                  })}
                </div>

                {/* Pasek postępu z pętlą A-B i wizualizacją przebiegu utworu (Waveform) */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatTime(status.position_ms)}
                      </span>
                      {/* Wskaźnik prędkości DSP jeśli tempo lub szybkość jest modyfikowane */}
                      {((status.tempo_ratio ?? 1.0) !== 1.0 || (status.rate_ratio ?? 1.0) !== 1.0) && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(168, 85, 247, 0.25)',
                            color: 'var(--accent-purple)',
                            border: '1px solid rgba(168, 85, 247, 0.45)',
                          }}
                          title={loc.dsp.dspSpeedTitle
                            .replace('{0}', (status.tempo_ratio ?? 1.0).toFixed(2))
                            .replace('{1}', formatTime(
                              Math.round((status.duration_ms ?? 0) / Math.max(0.01, (status.tempo_ratio ?? 1.0) * (status.rate_ratio ?? 1.0)))
                            ))}
                        >
                          DSP {((status.tempo_ratio ?? 1.0) * (status.rate_ratio ?? 1.0)).toFixed(2)}x
                        </span>
                      )}
                      {loopPointA !== null && loopPointB !== null && (
                        <span
                          onClick={() => setIsLoopEditorOpen(true)}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(6, 182, 212, 0.2)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            cursor: 'pointer',
                          }}
                          title={`${loc.player.editLoop || 'Edytuj pętlę A-B'} (Kliknij, aby edytować milisekundy)`}
                        >
                          {loc.player.loopAB}: {formatTimeMs(loopPointA)} → {formatTimeMs(loopPointB)}
                        </span>
                      )}

                      {/* Przełącznik płynnego wyciszenia paska postępu (Fade Seek) */}
                      <button
                        onClick={handleToggleSeekFade}
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 8px',
                          borderRadius: '4px',
                          background: seekFadeEnabled ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                          color: seekFadeEnabled ? 'var(--accent-pink)' : 'var(--text-muted)',
                          border: seekFadeEnabled ? '1px solid rgba(236, 72, 153, 0.45)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title={loc.player.seekFadeDesc}
                      >
                        {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
                      </button>
                    </div>
                    <span>{status.duration_ms ? formatTime(status.duration_ms) : '--:--'}</span>
                  </div>

                  {/* Wizualizacja przebiegu utworu (Waveform) - interaktywne słupki zsynchronizowane z DSP */}
                  <WaveformCanvas
                    peaks={trackWaveformPeaks}
                    progress={status.duration_ms && status.duration_ms > 0 ? (status.position_ms / status.duration_ms) * 100 : 0}
                    height={52}
                    colorPlayedStart="#f43f5e"
                    colorPlayedEnd="#a855f7"
                    onSeek={(pct) => {
                      if (status.duration_ms && status.duration_ms > 0) {
                        handleSeek(Math.floor(pct * status.duration_ms));
                      }
                    }}
                    title={`${loc.waveform.title} (${loc.waveform.hint})`}
                    style={{ marginBottom: '8px', background: 'rgba(0, 0, 0, 0.25)' }}
                  />

                  {/* Kontener suwaka z podświetleniem pętli A-B oraz znacznikiem zakładki */}
                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                    {loopPointA !== null && loopPointB !== null && status.duration_ms && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          left: `${(loopPointA / status.duration_ms) * 100}%`,
                          width: `${Math.max(2, ((loopPointB - loopPointA) / status.duration_ms) * 100)}%`,
                          height: '8px',
                          borderRadius: '4px',
                          background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.65), rgba(244, 63, 94, 0.65))',
                          boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />
                    )}
                    {loopPointA !== null && status.duration_ms && (
                      <div
                        onClick={() => setIsLoopEditorOpen(true)}
                        style={{
                          position: 'absolute',
                          top: '-16px',
                          left: `${(loopPointA / status.duration_ms) * 100}%`,
                          transform: 'translateX(-50%)',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          color: 'var(--accent-cyan)',
                          background: '#090d16',
                          border: '1px solid var(--accent-cyan)',
                          borderRadius: '3px',
                          padding: '0 4px',
                          cursor: 'pointer',
                          zIndex: 2,
                        }}
                        title={`Punkt A: ${formatTimeMs(loopPointA)} (${loopPointA} ms) - kliknij, aby edytować`}
                      >
                        A
                      </div>
                    )}
                    {loopPointB !== null && status.duration_ms && (
                      <div
                        onClick={() => setIsLoopEditorOpen(true)}
                        style={{
                          position: 'absolute',
                          top: '-16px',
                          left: `${(loopPointB / status.duration_ms) * 100}%`,
                          transform: 'translateX(-50%)',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          color: 'var(--accent-pink)',
                          background: '#090d16',
                          border: '1px solid var(--accent-pink)',
                          borderRadius: '3px',
                          padding: '0 4px',
                          cursor: 'pointer',
                          zIndex: 2,
                        }}
                        title={`Punkt B: ${formatTimeMs(loopPointB)} (${loopPointB} ms) - kliknij, aby edytować`}
                      >
                        B
                      </div>
                    )}
                    {/* Wskaźnik zapisanej zakładki na osi czasu */}
                    {currentBookmark !== null && status.duration_ms && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSeek(currentBookmark);
                        }}
                        style={{
                          position: 'absolute',
                          top: '-18px',
                          left: `${(currentBookmark / status.duration_ms) * 100}%`,
                          transform: 'translateX(-50%)',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          color: '#fbbf24',
                          background: '#090d16',
                          border: '1px solid #fbbf24',
                          borderRadius: '3px',
                          padding: '0 4px',
                          cursor: 'pointer',
                          zIndex: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          boxShadow: '0 0 8px rgba(251, 191, 36, 0.4)',
                        }}
                        title={`${(loc.player.bookmarkJump || 'Skocz do zakładki ({0})').replace('{0}', formatTime(currentBookmark))} (Kliknij, aby skoczyć)`}
                      >
                        <Bookmark size={9} fill="#fbbf24" /> {formatTime(currentBookmark)}
                      </div>
                    )}
                    <input
                      type="range"
                      min={0}
                      max={status.duration_ms || 100}
                      value={status.position_ms}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      style={{
                        width: '100%',
                        position: 'relative',
                        zIndex: 3,
                        background: `linear-gradient(to right, var(--accent-pink) 0%, var(--accent-purple) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
                      }}
                    />
                  </div>
                </div>

                {/* Przyciski sterowania odtwarzaniem */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Narzędzia lewe: Zakładka, Pętla A-B, Sleep Timer, Skróty */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Przycisk Zakładki (Bookmark) */}
                    {currentBookmark === null ? (
                      <button
                        onClick={handleSaveBookmark}
                        title={loc.player.bookmarkDesc || 'Zapisz zakładkę odtwarzania'}
                        className="glass-card"
                        style={{
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: activeTrackId ? 'var(--accent-amber)' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <Bookmark size={14} /> {loc.player.bookmark}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <button
                          onClick={handleSaveBookmark}
                          title={loc.player.bookmarkDesc || 'Zapisz nową zakładkę na bieżącej pozycji'}
                          className="glass-card"
                          style={{
                            padding: '6px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#fbbf24',
                            background: 'rgba(251, 191, 36, 0.12)',
                            border: '1px solid rgba(251, 191, 36, 0.45)',
                            fontSize: '0.75rem',
                            borderRadius: '8px 0 0 8px',
                            cursor: 'pointer',
                          }}
                        >
                          <Bookmark size={14} fill="#fbbf24" /> {loc.player.bookmark}
                        </button>
                        <button
                          onClick={() => handleJumpToBookmark(currentBookmark)}
                          className="glass-card"
                          title={(loc.player.bookmarkJump || 'Skocz do zakładki ({0})').replace('{0}', formatTime(currentBookmark))}
                          style={{
                            padding: '6px 6px',
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#fbbf24',
                            background: 'rgba(251, 191, 36, 0.12)',
                            borderTop: '1px solid rgba(251, 191, 36, 0.45)',
                            borderBottom: '1px solid rgba(251, 191, 36, 0.45)',
                            borderLeft: 'none',
                            borderRight: '1px solid rgba(251, 191, 36, 0.3)',
                            cursor: 'pointer',
                          }}
                        >
                          {formatTime(currentBookmark)}
                        </button>
                        <button
                          onClick={handleDeleteBookmark}
                          className="glass-card"
                          title={loc.player.bookmarkDelete || 'Usuń zakładkę'}
                          style={{
                            padding: '6px 6px',
                            color: '#ff6b81',
                            background: 'rgba(251, 191, 36, 0.12)',
                            border: '1px solid rgba(251, 191, 36, 0.45)',
                            borderLeft: 'none',
                            borderRadius: '0 8px 8px 0',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {/* Przyciski Pętli A-B */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <button
                        onClick={() => setLoopPointA(status.position_ms)}
                        className="glass-card"
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          fontFamily: loopPointA !== null ? 'monospace' : 'inherit',
                          borderRadius: '6px',
                          color: loopPointA !== null ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          border: loopPointA !== null ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                        }}
                        title={`${loc.shortcuts.loopA} (Kliknij, aby ustawić punkt A na bieżącej pozycji)`}
                      >
                        {loopPointA !== null ? `A: ${formatTimeMs(loopPointA)}` : 'A'}
                      </button>
                      <button
                        onClick={() => setLoopPointB(status.position_ms)}
                        className="glass-card"
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          fontFamily: loopPointB !== null ? 'monospace' : 'inherit',
                          borderRadius: '6px',
                          color: loopPointB !== null ? 'var(--accent-pink)' : 'var(--text-muted)',
                          border: loopPointB !== null ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                        }}
                        title={`${loc.shortcuts.loopB} (Kliknij, aby ustawić punkt B na bieżącej pozycji)`}
                      >
                        {loopPointB !== null ? `B: ${formatTimeMs(loopPointB)}` : 'B'}
                      </button>
                      <button
                        onClick={() => setIsLoopEditorOpen(true)}
                        className="glass-card"
                        style={{
                          padding: '5px 7px',
                          fontSize: '0.72rem',
                          borderRadius: '6px',
                          color: (loopPointA !== null || loopPointB !== null) ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title={loc.player.editLoop || 'Edytuj zakres pętli w milisekundach (np. 860ms)'}
                      >
                        <Sliders size={12} />
                      </button>
                      {(loopPointA !== null || loopPointB !== null) && (
                        <button
                          onClick={() => {
                            setLoopPointA(null);
                            setLoopPointB(null);
                          }}
                          className="glass-card"
                          style={{
                            padding: '5px 6px',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            color: '#ff6b81',
                            border: '1px solid rgba(255, 107, 129, 0.3)',
                            cursor: 'pointer',
                          }}
                          title={loc.shortcuts.loopClear}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Przycisk Wyłącznika czasowego (Sleep Timer) */}
                    <button
                      onClick={() => setIsSleepTimerOpen(true)}
                      className="glass-card"
                      style={{
                        padding: '6px 9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        color:
                          sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                            ? 'var(--accent-purple)'
                            : 'var(--text-muted)',
                        border:
                          sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                            ? '1px solid var(--accent-purple)'
                            : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                      title={loc.player.sleepTimer}
                    >
                      <Moon size={14} />
                      {(sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track') && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {sleepTimerRemainingSec !== null
                            ? formatSleepTimer(sleepTimerRemainingSec)
                            : 'Koniec'}
                        </span>
                      )}
                    </button>

                    {/* Przycisk Skrótów klawiszowych */}
                    <button
                      onClick={() => setIsShortcutsModalOpen(true)}
                      className="glass-card"
                      style={{
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                      title={loc.shortcuts.title}
                    >
                      <Keyboard size={14} />
                    </button>

                    {/* Przycisk Tekstów piosenki (Lyrics) */}
                    <button
                      onClick={() => setShowLyrics(!showLyrics)}
                      className="glass-card"
                      style={{
                        padding: '6px 9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        color: showLyrics ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        border: showLyrics ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        background: showLyrics ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      title={loc.shortcuts.lyrics}
                    >
                      <Mic2 size={13} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{loc.player.lyrics}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Shuffle Button */}
                    <button
                      onClick={handleToggleShuffle}
                      title={queue.shuffle ? loc.player.shuffleOn : loc.player.shuffleOff}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: queue.shuffle ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.06)',
                        border: queue.shuffle ? '1px solid var(--accent-cyan)' : 'none',
                        color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Shuffle size={16} />
                    </button>

                    {/* Previous Button */}
                    <button
                      onClick={handlePrevious}
                      title={loc.player.previous}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <SkipBack size={18} />
                    </button>

                    {/* Stop Button */}
                    <button
                      onClick={handleStop}
                      title={loc.player.stop}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Square size={16} />
                    </button>

                    {/* Play / Pause Button */}
                    <button
                      onClick={handlePlayPause}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow)',
                        cursor: 'pointer',
                      }}
                    >
                      {status.state === 'Playing' ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
                    </button>

                    {/* Next Button */}
                    <button
                      onClick={handleNext}
                      title={loc.player.next}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <SkipForward size={18} />
                    </button>

                    {/* Repeat Button */}
                    <button
                      onClick={handleCycleLoopMode}
                      title={queue.loop_mode === 'Track' ? loc.player.loopTrack : queue.loop_mode === 'Queue' ? loc.player.loopQueue : loc.player.loopOff}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: queue.loop_mode !== 'None' ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
                        border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : 'none',
                        color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                      {queue.loop_mode === 'Queue' && (
                        <span style={{ position: 'absolute', bottom: '3px', right: '3px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-pink)' }} />
                      )}
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {status.volume === 0 ? <VolumeX size={16} color="var(--text-muted)" /> : <Volume2 size={16} color="var(--text-secondary)" />}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={status.volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      style={{
                        width: '130px',
                        cursor: 'pointer',
                        background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
                      }}
                      title={`${loc.player.volume}: ${Math.round(status.volume * 100)}%`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ZINTEGROWANY MINI-PASEK DSP (Zastępuje dawne puste wielkie karty z Image 2) */}
            <div
              className="glass-card"
              style={{
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.28)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  DSP:
                </span>

                {/* Szybki przełącznik Bypass / DSP */}
                <button
                  onClick={() => handleEngineChange(status.engine === 'Bypass' ? (lastActiveDspEngineRef.current || 'RubberBand') : 'Bypass')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: status.engine === 'Bypass' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                    color: status.engine === 'Bypass' ? 'var(--accent-green)' : 'var(--accent-pink)',
                    border: status.engine === 'Bypass' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={status.engine === 'Bypass' ? loc.dsp.enableDspTooltip : loc.dsp.disableDspTooltip}
                >
                  {status.engine === 'Bypass' ? '● BYPASS' : `● ${status.engine === 'RubberBand' ? 'Rubber Band' : 'SoundTouch'}`}
                </button>

                {/* Pitch Chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pitch:</span>
                  <span style={{ color: 'var(--accent-pink)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st
                  </span>
                  {status.pitch_semitones !== 0 && (
                    <button
                      onClick={() => handlePitchChange(0)}
                      title={loc.dsp.resetPitchTooltip}
                      style={{ background: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>

                {/* Tempo Chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tempo:</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {status.tempo_ratio.toFixed(2)}x
                  </span>
                  {status.tempo_ratio !== 1 && (
                    <button
                      onClick={() => handleTempoChange(1.0)}
                      title={loc.dsp.resetTempoTooltip}
                      style={{ background: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Szybkie przejście do pełnego korektora DSP */}
              <button
                onClick={() => setActiveTab('dsp')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  color: 'var(--accent-purple)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <Sliders size={13} />
                <span>{loc.nav.dsp} &rarr;</span>
              </button>
            </div>
          </div>

          {/* SEKCJA ZSYNCHRONIZOWANYCH TEKSTÓW PIOSENEK (LRC & LRCLIB) */}
          {showLyrics && (
            <div style={{ height: '420px', width: '100%', marginBottom: '4px' }}>
              <LyricsView
                trackTitle={currentPlayingTrack?.title || status.current_track?.title || (filePath ? filePath.split('/').pop() || 'Auralune' : 'Auralune')}
                trackArtist={currentPlayingTrack?.artist || status.current_track?.artist || t.stats.unknownArtist}
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

          {/* SEKCJA KOLEJKI ODTWARZANIA Z KONFIGURACJĄ KOLUMN */}
          <div
            className="glass-panel"
            style={{
              padding: '22px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
            }}
          >
            {/* Pasek nagłówkowy kolejki */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
                    border: '1px solid rgba(236, 72, 153, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(236, 72, 153, 0.2)',
                  }}
                >
                  <ListMusic size={20} color="var(--accent-pink)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                      {loc.queue.title}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(236, 72, 153, 0.15)',
                        color: 'var(--accent-pink)',
                        border: '1px solid rgba(236, 72, 153, 0.3)',
                      }}
                    >
                      {queue.items.length}{' '}
                      {queue.items.length === 1
                        ? loc.queue.itemSingle
                        : queue.items.length >= 2 && queue.items.length <= 4
                        ? loc.queue.itemFew
                        : loc.queue.itemMany}
                    </span>
                    {queue.items.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        • {formatTotalDuration(totalQueueDurationMs)}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {loc.queue.dragHint}
                  </p>
                </div>
              </div>

              {/* Przyciski kontroli i dostosowywania */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                {/* Tryb Pętli Badge Button */}
                <button
                  onClick={handleCycleLoopMode}
                  title={`${loc.shortcuts.loop}: ${queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}`}
                  className="glass-card"
                  style={{
                    padding: '6px 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
                    border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {queue.loop_mode === 'Track' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                  <span>{queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}</span>
                </button>

                {/* Shuffle Badge Button */}
                <button
                  onClick={handleToggleShuffle}
                  title={`${loc.shortcuts.shuffle}: ${queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}`}
                  className="glass-card"
                  style={{
                    padding: '6px 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: queue.shuffle ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Shuffle size={14} />
                  <span>{queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}</span>
                </button>

                {/* Pole wyszukiwania w kolejce */}
                {queue.items.length > 0 && (
                  <div style={{ position: 'relative', width: '180px' }}>
                    <Search
                      size={13}
                      style={{
                        position: 'absolute',
                        left: '9px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder={loc.queue.search}
                      value={queueSearchQuery}
                      onChange={(e) => setQueueSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px 6px 28px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        outline: 'none',
                      }}
                    />
                    {queueSearchQuery && (
                      <button
                        onClick={() => setQueueSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '7px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 0,
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* Przycisk Konfiguracji Kolumn */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
                    className="glass-card"
                    style={{
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isColumnConfigOpen ? 'var(--accent-purple)' : 'var(--text-secondary)',
                      border: isColumnConfigOpen ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    title={loc.queue.customizeView}
                  >
                    <SlidersHorizontal size={14} />
                    <span>{loc.queue.customizeView}</span>
                  </button>

                  {/* Popover Konfiguracji Kolumn */}
                  {isColumnConfigOpen && (
                    <div
                      className="glass-panel"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '8px',
                        width: '320px',
                        padding: '16px',
                        zIndex: 70,
                        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '14px',
                        background: 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Settings size={15} color="var(--accent-purple)" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{t.queue.customizeTitle}</span>
                        </div>
                        <button
                          onClick={() => setIsColumnConfigOpen(false)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {t.queue.customizeDesc}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                          { key: 'showIndex', label: t.queue.colIndex },
                          { key: 'showCover', label: t.queue.colCover },
                          { key: 'showArtist', label: t.queue.colArtist },
                          { key: 'showAlbum', label: t.queue.colAlbum },
                          { key: 'showFormatBadge', label: t.queue.colFormat },
                          { key: 'showDuration', label: t.queue.colDuration },
                          { key: 'showPath', label: t.queue.colPath },
                          { key: 'compactMode', label: t.queue.compactMode },
                        ].map((col) => {
                          const active = queueColumns[col.key as keyof QueueColumnConfig];
                          return (
                            <div
                              key={col.key}
                              onClick={() => toggleQueueColumn(col.key as keyof QueueColumnConfig)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: active ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255,255,255,0.02)',
                                border: active ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                              }}
                            >
                              <span style={{ fontSize: '0.78rem', color: active ? '#fff' : 'var(--text-muted)' }}>{col.label}</span>
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  border: active ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                                  background: active ? 'var(--accent-purple)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {active && <Check size={12} color="#fff" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          onClick={resetQueueColumns}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RotateCcw size={12} /> {t.queue.resetDefaults}
                        </button>
                        <button
                          onClick={() => setIsColumnConfigOpen(false)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            background: 'var(--accent-purple)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {t.queue.done}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Przycisk Wybierz i dodaj utwory przez systemowy dialog (Dolphin / zenity) */}
                <button
                  onClick={handlePickFiles}
                  className="glass-card"
                  style={{
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--accent-cyan)',
                    border: '1px solid rgba(6, 182, 212, 0.4)',
                    background: 'rgba(6, 182, 212, 0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  title={t.queue.addTracksTooltip}
                >
                  <Plus size={14} />
                  <span>{t.queue.addTracks}</span>
                </button>

                {/* Przycisk Wyczyść kolejkę */}
                {queue.items.length > 0 && (
                  <button
                    onClick={handleClearQueue}
                    className="glass-card"
                    style={{
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#ff6b81',
                      border: '1px solid rgba(255, 107, 129, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    title={t.queue.clearTooltip}
                  >
                    <Trash2 size={14} />
                    <span>{t.queue.clear}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Zawartość Kolejki: Tabela utworów lub Pusty stan */}
            {queue.items.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  border: '2px dashed rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.15)',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(236, 72, 153, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ListMusic size={28} color="var(--accent-pink)" style={{ opacity: 0.8 }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                    {t.queue.empty}
                  </p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    {t.queue.emptyHint}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    onClick={() => setActiveTab('library')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Music size={15} />
                    <span>{t.queue.browseLibrary}</span>
                  </button>
                  <button
                    onClick={handlePickFiles}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <FolderOpen size={15} />
                    <span>{t.queue.pickFromDisk}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Pasek nagłówków kolumn */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: getQueueGridTemplate(queueColumns),
                    padding: '8px 14px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {queueColumns.showIndex && <span style={{ width: '28px', textAlign: 'center' }}>{t.queue.headerIndex}</span>}
                  {queueColumns.showCover && (
                    <span
                      style={{
                        width: queueColumns.compactMode ? '34px' : '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={t.queue.headerCover}
                    >
                      <ImageIcon size={14} style={{ opacity: 0.7 }} />
                    </span>
                  )}
                  <span>{t.queue.headerTitleArtist}</span>
                  {queueColumns.showAlbum && <span>{t.queue.headerAlbum}</span>}
                  {queueColumns.showFormatBadge && <span>{t.queue.headerQuality}</span>}
                  {queueColumns.showPath && <span>{t.queue.headerPath}</span>}
                  {queueColumns.showDuration && <span style={{ textAlign: 'right' }}>{t.queue.headerTime}</span>}
                  <span style={{ width: '96px', textAlign: 'right' }}>{t.queue.headerActions}</span>
                </div>

                {/* Lista wierszy utworów */}
                {filteredQueueItems.length === 0 && queueSearchQuery ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t.queue.noMatch.replace('{q}', queueSearchQuery)}
                  </div>
                ) : (
                  filteredQueueItems.map(({ it: item, originalIdx: idx }) => {
                  const isCurrent = idx === queue.current_index;
                  const isPlaying = isCurrent && status.state === 'Playing';
                  const meta = getQueueTrackMeta(item);
                  const isDragOver = dragOverQueueIdx === idx;

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleQueueDragStart(idx, e)}
                      onDragOver={(e) => handleQueueDragOver(idx, e)}
                      onDrop={(e) => handleQueueDrop(idx, e)}
                      onDoubleClick={() => handlePlayQueueIndex(idx)}
                      className="glass-card"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: getQueueGridTemplate(queueColumns),
                        alignItems: 'center',
                        padding: queueColumns.compactMode ? '6px 12px' : '10px 14px',
                        gap: '12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isCurrent
                          ? 'linear-gradient(90deg, rgba(236, 72, 153, 0.18), rgba(168, 85, 247, 0.1))'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isCurrent
                          ? '1px solid var(--accent-pink)'
                          : isDragOver
                          ? '2px solid var(--accent-purple)'
                          : '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: isCurrent ? '0 0 20px rgba(236, 72, 153, 0.25)' : 'none',
                        transition: 'all 0.15s ease',
                        opacity: draggedQueueIdx === idx ? 0.35 : 1,
                      }}
                    >
                      {/* Numer pozycji / Wskaźnik odtwarzania */}
                      {queueColumns.showIndex && (
                        <div
                          style={{
                            width: '28px',
                            textAlign: 'center',
                            color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                            fontSize: '0.8rem',
                            fontWeight: isCurrent ? 700 : 400,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {isPlaying ? (
                            <Zap size={16} color="var(--accent-pink)" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                      )}

                      {/* Miniaturka okładki (kliknij aby otworzyć wybór okładki) */}
                      {queueColumns.showCover && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (meta.album) {
                              handleOpenCoverPicker(meta.album);
                            } else {
                              handleUploadCustomCoverDirect(null);
                            }
                          }}
                          style={{
                            width: queueColumns.compactMode ? '34px' : '44px',
                            height: queueColumns.compactMode ? '34px' : '44px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: meta.cover
                              ? `url("${meta.cover}") center/cover no-repeat`
                              : 'linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.3))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.1)',
                            flexShrink: 0,
                            cursor: 'pointer',
                          }}
                          title={loc.covers.matchCoverTitle}
                        >
                          {!meta.cover && (
                            <Disc size={queueColumns.compactMode ? 16 : 20} color="rgba(255,255,255,0.4)" />
                          )}
                        </div>
                      )}

                      {/* Tytuł i Wykonawca */}
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: queueColumns.compactMode ? '0.82rem' : '0.88rem',
                            fontWeight: isCurrent ? 700 : 600,
                            color: isCurrent ? '#fff' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.title}
                        </p>
                        {queueColumns.showArtist && (
                          <p
                            style={{
                              margin: '2px 0 0 0',
                              fontSize: '0.74rem',
                              color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.artist || 'Nieznany wykonawca'}
                          </p>
                        )}
                      </div>

                      {/* Album */}
                      {queueColumns.showAlbum && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {meta.album?.title || item.album || '—'}
                        </span>
                      )}

                      {/* Format & Jakość */}
                      {queueColumns.showFormatBadge && (
                        <div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              background:
                                meta.format.includes('FLAC') || meta.format.includes('WAV')
                                  ? 'rgba(6, 182, 212, 0.15)'
                                  : 'rgba(168, 85, 247, 0.15)',
                              color:
                                meta.format.includes('FLAC') || meta.format.includes('WAV')
                                  ? 'var(--accent-cyan)'
                                  : 'var(--accent-purple)',
                              border:
                                meta.format.includes('FLAC') || meta.format.includes('WAV')
                                  ? '1px solid rgba(6, 182, 212, 0.3)'
                                  : '1px solid rgba(168, 85, 247, 0.3)',
                            }}
                          >
                            {meta.format} {meta.bitDepth ? `${meta.bitDepth}b` : ''}
                          </span>
                        </div>
                      )}

                      {/* Ścieżka pliku */}
                      {queueColumns.showPath && (
                        <span
                          title={`${item.uri.replace(/^file:\/\//, '')} • ${loc.queue.openContainingFolder}`}
                          onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                          style={{
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            textDecoration: 'underline dotted rgba(255, 255, 255, 0.25)',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          {item.uri.replace(/^file:\/\//, '')}
                        </span>
                      )}

                      {/* Czas trwania */}
                      {queueColumns.showDuration && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                            fontWeight: isCurrent ? 700 : 400,
                            textAlign: 'right',
                          }}
                        >
                          {formatTime(item.duration_ms)}
                        </span>
                      )}

                      {/* Akcje */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        {!isCurrent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayQueueIndex(idx);
                            }}
                            title={loc.queue.playThis}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '5px',
                              borderRadius: '6px',
                              display: 'flex',
                            }}
                          >
                            <Play size={14} />
                          </button>
                        )}
                        <button
                          disabled={idx === 0}
                          onClick={(e) => handleMoveQueueItem(idx, idx - 1, e)}
                          title={loc.queue.moveUp}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                            cursor: idx === 0 ? 'default' : 'pointer',
                            padding: '5px',
                            borderRadius: '6px',
                            display: 'flex',
                          }}
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          disabled={idx === queue.items.length - 1}
                          onClick={(e) => handleMoveQueueItem(idx, idx + 1, e)}
                          title={loc.queue.moveDown}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: idx === queue.items.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                            cursor: idx === queue.items.length - 1 ? 'default' : 'pointer',
                            padding: '5px',
                            borderRadius: '6px',
                            display: 'flex',
                          }}
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                          title={loc.queue.openContainingFolder}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '5px',
                            borderRadius: '6px',
                            display: 'flex',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <FolderOpen size={14} />
                        </button>
                        <button
                          onClick={(e) => handleRemoveFromQueue(item.id, e)}
                          title={loc.queue.remove}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255, 107, 129, 0.7)',
                            cursor: 'pointer',
                            padding: '5px',
                            borderRadius: '6px',
                            display: 'flex',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                }))}
              </div>
            )}
          </div>
        </div>
      )}

        {/* ZAKŁADKA 2: BIBLIOTEKA (ETAP 2) */}
        {activeTab === 'library' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: 'min(1500px, 95vw)', margin: '0 auto' }}>
            {/* Nagłówek biblioteki: tytuł, statystyka i przyciski akcji */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontWeight: 700 }}>
                  <Music size={22} color="var(--accent-purple)" /> {loc.library.title}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(168, 85, 247, 0.2)',
                      color: 'var(--accent-purple)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                    }}
                  >
                    {filteredTracks.length !== tracks.length ? `${filteredTracks.length} / ${tracks.length}` : `${tracks.length} ${loc.library.tracks}`}
                  </span>
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {loc.library.subtitle}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePickFolder}
                  className="glass-card"
                  style={{
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(244, 63, 94, 0.25))',
                    border: '1px solid var(--accent-purple)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
                  }}
                  title={loc.library.addFolder}
                >
                  <FolderPlus size={15} color="var(--accent-pink)" /> {loc.library.addFolder}
                </button>
                <button
                  onClick={handlePickFiles}
                  className="glass-card"
                  style={{
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: '8px',
                  }}
                  title={loc.library.addFiles}
                >
                  <FilePlus size={15} color="var(--accent-cyan)" /> {loc.library.addFiles}
                </button>
                <button
                  onClick={() => setIsScanFolderOpen(!isScanFolderOpen)}
                  className="glass-card"
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: isScanFolderOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    border: isScanFolderOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    background: isScanFolderOpen ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderRadius: '8px',
                  }}
                  title={loc.library.manualPath}
                >
                  <FolderOpen size={14} /> {loc.library.manualPath}
                </button>
                <button
                  onClick={loadLibrary}
                  className="glass-card"
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.04)',
                  }}
                  title={loc.library.refresh}
                >
                  <RefreshCw size={14} /> {loc.library.refresh}
                </button>
              </div>
            </div>

            {/* Rozwijany panel skanera katalogu (niewidoczny domyślnie, nie marnuje miejsca) */}
            {isScanFolderOpen && (
              <div
                className="glass-card"
                style={{
                  padding: '16px 18px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-accent)',
                  marginBottom: '20px',
                  background: 'rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {loc.library.scanPathLabel}
                  </label>
                  <button
                    onClick={() => setIsScanFolderOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={scanFolder}
                    onChange={(e) => setScanFolder(e.target.value)}
                    placeholder={loc.library.scanPathPlaceholder}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    onClick={handlePickFolder}
                    className="glass-card"
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--accent-cyan)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                    title={loc.library.browseDolphinTooltip}
                  >
                    <FolderOpen size={15} /> {loc.library.browseDolphin}
                  </button>
                  <button
                    onClick={handleScanLibrary}
                    disabled={isScanning}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: isScanning ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                      color: '#fff',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isScanning ? 'default' : 'pointer',
                      border: 'none',
                    }}
                  >
                    <RefreshCw size={15} className={isScanning ? 'spin' : ''} /> {isScanning ? loc.library.scanning : loc.library.runScan}
                  </button>
                </div>
                {scanResult && (
                  <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-green)' }}>
                    ✓ {loc.library.scanSummary
                      .replace('{0}', String(scanResult.total_files_found))
                      .replace('{1}', String(scanResult.new_or_updated_tracks))
                      .replace('{2}', String(scanResult.skipped_unchanged))}
                  </p>
                )}
              </div>
            )}

            {/* Kompaktowe statystyki biblioteki */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
              <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Music size={22} color="var(--accent-pink)" />
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.library.tracks}</span>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{tracks.length}</p>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Disc size={22} color="var(--accent-purple)" />
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.library.albums}</span>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{albums.length}</p>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={22} color="var(--accent-cyan)" />
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.library.totalDuration}</span>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                    {formatTime(tracks.reduce((acc, t) => acc + t.duration_ms, 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Pasek narzędziowy: widoki Utwory/Albumy, Live Search i filtry formatów */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: '18px',
                background: 'rgba(0,0,0,0.2)',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Przełącznik widoku: Utwory vs Albumy */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setLibrarySubView('tracks')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: librarySubView === 'tracks' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Music size={14} /> {loc.library.tracks} ({filteredTracks.length})
                </button>
                <button
                  onClick={() => setLibrarySubView('albums')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: librarySubView === 'albums' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Disc size={14} /> {loc.library.albums} ({filteredAlbums.length})
                </button>
                <button
                  onClick={() => setLibrarySubView('artists')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: librarySubView === 'artists' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Mic2 size={14} /> {loc.library.artists || 'Wykonawcy'} ({filteredArtists.length})
                </button>
              </div>

              {/* Pole wyszukiwania Live Search */}
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  ref={librarySearchInputRef}
                  type="text"
                  placeholder={loc.library.searchPlaceholder}
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (librarySubView === 'tracks' && sortedTracks.length > 0) {
                        handlePlayAllTracks(sortedTracks, 0);
                        showMessage(`Odtwarzanie ${sortedTracks[0].title} (dopasowano: ${sortedTracks.length})`);
                      } else if (librarySubView === 'albums' && sortedAlbums.length > 0) {
                        const albumTracks = tracks.filter((t) => t.album_id === sortedAlbums[0].id);
                        if (albumTracks.length > 0) {
                          handlePlayAllTracks(albumTracks, 0);
                          showMessage(`Odtwarzanie albumu ${sortedAlbums[0].title}`);
                        }
                      }
                    } else if (e.key === 'Escape') {
                      setLibrarySearch('');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 30px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '0.8rem',
                  }}
                />
                {librarySearch && (
                  <button
                    onClick={() => setLibrarySearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filtry formatów audio */}
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                {(['all', 'flac', 'mp3', 'opus', 'wav', 'lossless'] as const).map((fmt) => {
                  const label =
                    fmt === 'all'
                      ? loc.library.all
                      : fmt === 'lossless'
                      ? loc.library.lossless
                      : fmt.toUpperCase();
                  const isSelected = libraryFormatFilter === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => setLibraryFormatFilter(fmt)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: isSelected ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: isSelected ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Kontrola sortowania */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                <ArrowUpDown size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.library.sortBy}</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  <option value="default">{loc.library.sortDefault}</option>
                  <option value="title">{loc.library.sortTitle}</option>
                  <option value="artist">{loc.library.sortArtist}</option>
                  <option value="duration">{loc.library.sortDuration}</option>
                  <option value="format">{loc.library.sortFormat}</option>
                  <option value="date">{loc.library.sortDate}</option>
                  <option value="plays">{loc.library.sortPlays}</option>
                </select>
                {sortField !== 'default' && (
                  <button
                    onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title={sortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
                  >
                    {sortOrder === 'asc' ? '▲' : '▼'}
                  </button>
                )}
              </div>
            </div>

            {/* Widok 1: Tabela utworów */}
            {librarySubView === 'tracks' && (
              <div>
                {/* Inteligentne Playlisty (Smart Playlists) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>{loc.library.collection}</span>
                  {[
                    { id: 'all', label: loc.library.smartAll, icon: Music, color: 'var(--accent-purple)' },
                    { id: 'favorites', label: loc.library.smartFavorites, icon: Heart, color: 'var(--accent-pink)' },
                    { id: 'history', label: loc.library.smartHistory, icon: Clock, color: 'var(--accent-cyan)' },
                    { id: 'top_played', label: loc.library.smartTopPlayed, icon: Flame, color: 'var(--accent-amber)' },
                    { id: 'hires', label: loc.library.smartHiRes, icon: Sparkles, color: 'var(--accent-purple)' },
                  ].map((item) => {
                    const isSelected = smartPlaylistFilter === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSmartPlaylistFilter(item.id as any)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          border: isSelected ? `1px solid ${item.color}` : '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? `0 0 10px ${item.color}40` : 'none',
                        }}
                      >
                        <Icon size={13} color={isSelected ? item.color : 'var(--text-muted)'} fill={item.id === 'favorites' && isSelected ? item.color : 'none'} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {sortedTracks.length !== tracks.length
                      ? loc.library.resultsCount.replace('{0}', String(sortedTracks.length)).replace('{1}', String(tracks.length))
                      : loc.library.totalTracksCount.replace('{0}', String(tracks.length))}
                    {sortField !== 'default' && ` • ${loc.library.sortedBy.replace('{0}', sortField).replace('{1}', sortOrder === 'asc' ? loc.library.sortedAsc : loc.library.sortedDesc)}`}
                    {smartPlaylistFilter === 'history' && ` • ${loc.library.sortedNewest}`}
                    {smartPlaylistFilter === 'top_played' && ` • ${loc.library.sortedPlays}`}
                  </span>
                  {sortedTracks.length > 0 && (
                    <button
                      onClick={() => handlePlayAllTracks(sortedTracks, 0)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      <Play size={14} /> {loc.library.playSorted}
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th
                          onClick={() => handleSort('default')}
                          style={{ padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                          title={loc.library.sortDefaultTooltip}
                        >
                          # {sortField === 'default' && '•'}
                        </th>
                        <th
                          onClick={() => handleSort('title')}
                          style={{ padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                          title={loc.library.sortTitleTooltip}
                        >
                          {loc.library.sortTitle} {sortField === 'title' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th
                          onClick={() => handleSort('artist')}
                          style={{ padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                          title={loc.library.sortArtistTooltip}
                        >
                          {loc.library.sortArtist} {sortField === 'artist' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th
                          onClick={() => handleSort('format')}
                          style={{ padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                          title={loc.library.sortFormatTooltip}
                        >
                          {loc.library.sortFormat} {sortField === 'format' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '10px 12px' }}>{loc.library.quality}</th>
                        <th
                          onClick={() => handleSort('duration')}
                          style={{ padding: '10px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                          title={loc.library.sortDurationTooltip}
                        >
                          {loc.queue.duration} {sortField === 'duration' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th
                          onClick={() => handleSort('plays')}
                          style={{ padding: '10px 12px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                          title={loc.library.sortPlaysTooltip}
                        >
                          {loc.library.playsCol} {sortField === 'plays' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>{loc.library.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTracks.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {tracks.length === 0 ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '14px',
                                  padding: '24px 12px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: 'rgba(168, 85, 247, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--accent-purple)',
                                  }}
                                >
                                  <FolderPlus size={28} color="var(--accent-purple)" />
                                </div>
                                <div>
                                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
                                    {loc.library.empty}
                                  </h4>
                                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    {loc.library.emptyHint}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <button
                                    onClick={handlePickFolder}
                                    style={{
                                      padding: '8px 16px',
                                      borderRadius: '8px',
                                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                                      color: '#fff',
                                      fontWeight: 600,
                                      fontSize: '0.8rem',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <FolderPlus size={14} /> {loc.library.addFolder}...
                                  </button>
                                  <button
                                    onClick={handlePickFiles}
                                    style={{
                                      padding: '8px 16px',
                                      borderRadius: '8px',
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      border: '1px solid var(--border-accent)',
                                      color: '#fff',
                                      fontWeight: 600,
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <FilePlus size={14} color="var(--accent-cyan)" /> {loc.library.addFiles}...
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                <span>{loc.library.emptySearchTracks.replace("{0}", librarySearch)}</span>
                                <button
                                  onClick={() => setLibrarySearch('')}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--accent-cyan)',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {loc.library.clearSearch}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        sortedTracks.map((t, idx) => (
                          <tr
                            key={t.id}
                            onClick={() => handlePlayLibraryTrack(t)}
                            className="glass-card"
                            style={{
                              cursor: 'pointer',
                              background: activeTrackId === t.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                            }}
                          >
                            <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              {activeTrackId === t.id && status.state === 'Playing' ? (
                                <Zap size={14} color="var(--accent-pink)" />
                              ) : (
                                t.track_no || idx + 1
                              )}
                            </td>
                            <td style={{ padding: '12px', fontWeight: 600, color: activeTrackId === t.id ? 'var(--accent-pink)' : '#fff' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {t.is_favorite && <Heart size={13} fill="var(--accent-pink)" color="var(--accent-pink)" style={{ flexShrink: 0 }} />}
                                <span>{t.title}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{t.artist}</td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  background:
                                    (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200
                                      ? 'rgba(6, 182, 212, 0.2)'
                                      : 'rgba(255,255,255,0.08)',
                                  color:
                                    (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200
                                      ? 'var(--accent-cyan)'
                                      : 'inherit',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontSize: '0.7rem',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 600,
                                  border:
                                    (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200
                                      ? '1px solid rgba(6, 182, 212, 0.35)'
                                      : 'none',
                                }}
                              >
                                {t.format}
                                {(t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? ' Hi-Res' : ''}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              {Math.round(t.sample_rate / 1000)} kHz {t.bit_depth ? `/ ${t.bit_depth}-bit` : ''}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {formatTime(t.duration_ms)}
                            </td>
                            <td
                              style={{ padding: '12px', textAlign: 'center' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatsModalTrack(t);
                              }}
                              title={loc.player.trackStats}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 9px',
                                  borderRadius: '12px',
                                  background: t.play_count ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                  color: t.play_count ? 'var(--accent-amber)' : 'var(--text-muted)',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  border: t.play_count ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Flame size={12} color={t.play_count ? 'var(--accent-amber)' : 'var(--text-muted)'} />
                                {t.play_count || 0}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  onClick={(e) => handleToggleFavorite(t.id, e)}
                                  title={t.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: t.is_favorite ? 'var(--accent-pink)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                  }}
                                >
                                  <Heart size={15} fill={t.is_favorite ? 'var(--accent-pink)' : 'none'} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePlayAllTracks(sortedTracks, idx); }}
                                  title={loc.library.playFromHere}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Play size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleAddTrackToQueue(t, e)}
                                  title={loc.library.addToQueue}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Plus size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleAddTrackNextToQueue(t, e)}
                                  title={loc.library.playNext}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <ListPlus size={15} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setTrackToAddToPlaylist(t); setShowPlaylistModal(true); }}
                                  title={loc.library.addToPlaylist}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <FolderPlus size={15} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setStatsModalTrack(t); }}
                                  title={loc.player.trackStats}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <BarChart3 size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleOpenContainingFolder(t.path, e)}
                                  title={loc.library.openContainingFolder}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <FolderOpen size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Widok 2: Siatka albumów i okładek (Etap 6) */}
            {librarySubView === 'albums' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {sortedAlbums.length !== albums.length
                      ? loc.library.resultsAlbums.replace('{0}', String(sortedAlbums.length)).replace('{1}', String(albums.length))
                      : loc.library.totalAlbums.replace('{0}', String(albums.length))}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowUpDown size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.library.albumsSortLabel}</span>
                    <select
                      value={albumSortField}
                      onChange={(e) => setAlbumSortField(e.target.value as any)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="title">{loc.library.albumSortTitle}</option>
                      <option value="artist">{loc.library.albumSortArtist}</option>
                      <option value="year">{loc.library.albumSortYear}</option>
                    </select>
                    <button
                      onClick={() => setAlbumSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      title={albumSortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
                    >
                      {albumSortOrder === 'asc' ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {sortedAlbums.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      {albums.length === 0 ? (
                        <span>{loc.library.emptyAlbums}</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <span>{loc.library.emptySearchAlbums.replace("{0}", librarySearch)}</span>
                          <button
                            onClick={() => setLibrarySearch('')}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-cyan)',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            {loc.library.clearSearch}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    sortedAlbums.map((album) => (
                    <div
                      key={album.id}
                      className="glass-card"
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {/* Podgląd okładki (kliknij aby otworzyć dopasowywanie okładki online) */}
                      <div
                        onClick={() => handleOpenCoverPicker(album)}
                        style={{
                          width: '100%',
                          aspectRatio: '1/1',
                          borderRadius: '12px',
                          background: album.cover_path
                            ? `url("${album.cover_path}") center/cover no-repeat`
                            : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'transform 0.2s ease',
                        }}
                        title={loc.covers.matchCoverTitle}
                      >
                        {!album.cover_path && <Disc size={48} color="rgba(255,255,255,0.25)" />}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            right: '6px',
                            background: 'rgba(0,0,0,0.65)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            color: 'var(--accent-pink)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Sparkles size={10} /> {loc.covers.matchCover}
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {album.title}
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {album.album_artist} {album.year ? `(${album.year})` : ''}
                        </p>
                        {album.release_mbid && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '4px',
                              fontSize: '0.7rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--accent-cyan)',
                              background: 'rgba(6,182,212,0.12)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            MBID: {album.release_mbid.slice(0, 8)}...
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                        <button
                          onClick={() => {
                            const albumTracks = tracks.filter((t) => t.album_id === album.id);
                            handlePlayAllTracks(albumTracks);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            color: 'var(--accent-pink)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                          title={loc.playlists.playAll}
                        >
                          <Play size={13} /> {loc.player.play}
                        </button>
                        <button
                          onClick={() => handleOpenCoverPicker(album)}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
                          }}
                          title={loc.covers.matchCoverTitle}
                        >
                          <Sparkles size={13} /> {loc.covers.matchCover}
                        </button>
                        <button
                          onClick={() => handleOpenMbModal(album)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                          title={loc.covers.matchCoverTitle}
                        >
                          <Search size={13} /> MBID
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Widok 3: Wykonawcy / Artyści */}
          {librarySubView === 'artists' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {filteredArtists.length !== new Set(tracks.map((t) => t.artist || loc.stats.unknownArtist)).size
                    ? loc.library.resultsArtists.replace('{0}', String(filteredArtists.length))
                    : loc.library.totalArtists.replace('{0}', String(filteredArtists.length))}
                </span>
              </div>

              {filteredArtists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <span>{loc.library.emptySearchArtists.replace("{0}", librarySearch)}</span>
                  {librarySearch && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={() => setLibrarySearch('')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {loc.library.clearSearch}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.name}
                      className="glass-card"
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: artist.sampleCover
                              ? `url("${artist.sampleCover}") center/cover no-repeat`
                              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
                            border: '2px solid rgba(236, 72, 153, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.2)',
                          }}
                        >
                          {!artist.sampleCover && <Mic2 size={26} color="var(--accent-pink)" />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: '#fff',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={artist.name}
                          >
                            {artist.name}
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {loc.library.artistTracksCount.replace('{0}', String(artist.tracks.length))}
                            </span>
                            {artist.albumIds.size > 0 && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  background: 'rgba(168, 85, 247, 0.12)',
                                  color: 'var(--accent-purple)',
                                }}
                              >
                                {loc.library.artistAlbumsCount.replace('{0}', String(artist.albumIds.size))}
                              </span>
                            )}
                            {artist.totalPlays > 0 && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  background: 'rgba(236, 72, 153, 0.15)',
                                  color: 'var(--accent-pink)',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <Flame size={10} /> {artist.totalPlays}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                        <button
                          onClick={() => handlePlayAllTracks(artist.tracks, 0)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                            color: '#fff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                          }}
                        >
                          <Play size={13} fill="#fff" /> {loc.playlists.playAll}
                        </button>
                        <button
                          onClick={() => {
                            setLibrarySearch(artist.name);
                            setLibrarySubView('tracks');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent-cyan)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                          }}
                          title={currentLang === 'pl' ? 'Filtruj utwory tego wykonawcy' : 'Filter tracks by this artist'}
                        >
                          <ListMusic size={13} /> Utwory
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal dopasowywania wydań MusicBrainz (Etap 6) */}
          {selectedAlbumForMb && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                  padding: '20px',
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '24px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-accent)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Globe size={22} color="var(--accent-cyan)" />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                        Dopasowanie wydania w MusicBrainz
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedAlbumForMb(null)}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    {loc.covers.mbSubtitle}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '16px' }}>
                    <input
                      type="text"
                      value={mbSearchTitle}
                      onChange={(e) => setMbSearchTitle(e.target.value)}
                      placeholder={loc.covers.searchAlbumPlaceholder}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.85rem',
                      }}
                    />
                    <input
                      type="text"
                      value={mbSearchArtist}
                      onChange={(e) => setMbSearchArtist(e.target.value)}
                      placeholder={loc.covers.searchArtistPlaceholder}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.85rem',
                      }}
                    />
                    <button
                      onClick={handleSearchMusicBrainz}
                      disabled={isSearchingMb}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Search size={15} />
                      {isSearchingMb ? loc.covers.searching : loc.covers.searchBtn}
                    </button>
                  </div>

                  {/* Lista kandydatów */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mbCandidates.length === 0 && !isSearchingMb && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px' }}>
                        {loc.covers.mbSearchHint}
                      </p>
                    )}

                    {mbCandidates.map((cand) => (
                      <div
                        key={cand.mbid}
                        className="glass-card"
                        style={{
                          padding: '14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {cand.title}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: cand.score >= 90 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: cand.score >= 90 ? 'var(--accent-green)' : 'var(--accent-amber)',
                              }}
                            >
                              {cand.score}% {loc.covers.mbMatchScore}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {loc.player.artist}: {cand.artist} {cand.date ? `| ${cand.date}` : ''} {cand.country ? `(${cand.country})` : ''} {cand.track_count ? `| ${loc.library.tracks}: ${cand.track_count}` : ''}
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            MBID: {cand.mbid}
                          </p>
                        </div>

                        <button
                          onClick={() => handleSelectCandidateAndFetchCover(cand)}
                          disabled={isFetchingCover}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'var(--accent-cyan)',
                            color: '#000',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            cursor: isFetchingCover ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <CheckCircle size={14} />
                          {isFetchingCover ? loc.covers.downloading : loc.covers.applyCover}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ZAKŁADKA 3: DSP STUDIO (ETAP 3) */}
        {activeTab === 'dsp' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '880px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={20} color="var(--accent-purple)" /> {loc.dsp.title}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {loc.dsp.subtitle}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Przełącznik zapamiętywania parametrów DSP przy starcie programu */}
                <button
                  onClick={handleToggleDspAutoStartup}
                  title={loc.dsp.dspAutostart}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: dspAutoStartup ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${dspAutoStartup ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                    color: dspAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {dspAutoStartup ? `✓ ${loc.dsp.dspAutostartOn}` : `○ ${loc.dsp.dspAutostartOff}`}
                </button>

                {/* Zapisz bieżące ustawienia jako domyślne startowe */}
                <button
                  onClick={handleSaveDspStartupDefault}
                  title={loc.dsp.dspSaveStartupBtn}
                  className="glass-card"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--accent-amber)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Save size={13} /> {loc.dsp.dspSaveStartupBtn}
                </button>

                {/* Reset do wartości domyślnych */}
                <button
                  onClick={handleResetDsp}
                  className="glass-card"
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={13} /> {loc.dsp.reset}
                </button>
              </div>
            </div>

            {/* Wybór silnika DSP: SoundTouch vs Rubber Band */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: 600 }}>
                {loc.dsp.engine}:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* Karta Bypass (Bez DSP / Czysty dźwięk) */}
                <div
                  onClick={() => handleEngineChange('Bypass')}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: status.engine === 'Bypass' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                    background: status.engine === 'Bypass' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.bypass}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: 'var(--accent-green)',
                      }}
                    >
                      DIRECT
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {loc.dsp.bypassDesc}
                  </p>
                </div>

                {/* Karta Rubber Band */}
                <div
                  onClick={() => handleEngineChange('RubberBand')}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: status.engine === 'RubberBand' ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                    background: status.engine === 'RubberBand' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.rubberband}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(244, 63, 94, 0.2)',
                        color: 'var(--accent-pink)',
                      }}
                    >
                      HI-FI (MSC)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {loc.dsp.rubberbandDesc}
                  </p>
                </div>

                {/* Karta SoundTouch */}
                <div
                  onClick={() => handleEngineChange('SoundTouch')}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderRadius: '14px',
                    border: status.engine === 'SoundTouch' ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                    background: status.engine === 'SoundTouch' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.soundtouch}</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: 'var(--accent-cyan)',
                      }}
                    >
                      LOW CPU
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {loc.dsp.soundtouchDesc}
                  </p>
                </div>
              </div>
            </div>

            {/* Pasek telemetrii silnika */}
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                fontSize: '0.8rem',
              }}
            >
              <span>{loc.dsp.engine}: {status.capabilities?.name || 'SoundTouch'}</span>
            </div>

            {/* Informacja o aktywnym trybie Direct Bypass */}
            {status.engine === 'Bypass' && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '22px',
                  fontSize: '0.8rem',
                  color: '#a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  lineHeight: 1.4,
                }}
              >
                <Info size={18} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                <span>{loc.dsp.bypassActiveNotice}</span>
              </div>
            )}

            {/* Suwak Pitch Shift z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.dsp.pitch}:</label>
                  <button
                    onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.1) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="-0.1 semitone"
                  >
                    -0.1
                  </button>
                  <button
                    onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.01) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="-0.01 semitone"
                  >
                    -0.01
                  </button>
                  <button
                    onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.01) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="+0.01 semitone"
                  >
                    +0.01
                  </button>
                  <button
                    onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.1) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="+0.1 semitone"
                  >
                    +0.1
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={
                      editingPitch !== null
                        ? editingPitch
                        : (status.pitch_semitones ?? 0) > 0
                        ? `+${(status.pitch_semitones ?? 0).toFixed(2)}`
                        : (status.pitch_semitones ?? 0).toFixed(2)
                    }
                    onFocus={(e) => {
                      setEditingPitch(
                        (status.pitch_semitones ?? 0) > 0
                          ? `+${(status.pitch_semitones ?? 0).toFixed(2)}`
                          : (status.pitch_semitones ?? 0).toFixed(2)
                      );
                      e.target.select();
                    }}
                    onChange={(e) => setEditingPitch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const step = e.shiftKey ? 0.01 : 0.1;
                        const clean = (editingPitch ?? `${status.pitch_semitones ?? 0}`).replace(',', '.').trim();
                        const current = parseFloat(clean);
                        if (!isNaN(current)) {
                          const next = Math.min(24, Math.round((current + step) * 100) / 100);
                          setEditingPitch(next > 0 ? `+${next.toFixed(2)}` : next.toFixed(2));
                          handlePitchChange(next);
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const step = e.shiftKey ? 0.01 : 0.1;
                        const clean = (editingPitch ?? `${status.pitch_semitones ?? 0}`).replace(',', '.').trim();
                        const current = parseFloat(clean);
                        if (!isNaN(current)) {
                          const next = Math.max(-24, Math.round((current - step) * 100) / 100);
                          setEditingPitch(next > 0 ? `+${next.toFixed(2)}` : next.toFixed(2));
                          handlePitchChange(next);
                        }
                      } else if (e.key === 'Enter') {
                        const clean = (editingPitch ?? '').replace(',', '.').trim();
                        const val = parseFloat(clean);
                        if (!isNaN(val)) {
                          const min = status.capabilities?.min_pitch_semitones ?? -24;
                          const max = status.capabilities?.max_pitch_semitones ?? 24;
                          const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                          handlePitchChange(clamped);
                        }
                        setEditingPitch(null);
                        e.currentTarget.blur();
                      } else if (e.key === 'Escape') {
                        setEditingPitch(null);
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={() => {
                      if (editingPitch !== null) {
                        const clean = editingPitch.replace(',', '.').trim();
                        const val = parseFloat(clean);
                        if (!isNaN(val)) {
                          const min = status.capabilities?.min_pitch_semitones ?? -24;
                          const max = status.capabilities?.max_pitch_semitones ?? 24;
                          const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                          handlePitchChange(clamped);
                        }
                        setEditingPitch(null);
                      }
                    }}
                    placeholder="0.00"
                    title="Wpisz wartość i naciśnij Enter (lub użyj strzałek góra/dół)"
                    style={{
                      width: '60px',
                      padding: '2px 6px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--accent-pink)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.4)',
                      borderRadius: '6px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-pink)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {loc.dsp.semitones} ({Math.round((status.pitch_semitones ?? 0) * 100)} {loc.dsp.cents}) | {(2 ** ((status.pitch_semitones ?? 0) / 12)).toFixed(3)}x
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={status.capabilities?.min_pitch_semitones ?? -12}
                max={status.capabilities?.max_pitch_semitones ?? 12}
                step={0.01}
                value={status.pitch_semitones ?? 0}
                onChange={(e) => handlePitchChange(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[-12, -7, -2, 0, 2, 7, 12].map((st) => (
                  <button
                    key={st}
                    onClick={() => handlePitchChange(st)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      background: st === 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: st === 0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      color: st === 0 ? 'var(--accent-cyan)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {st === 0 ? `0 ${loc.dsp.semitones}` : st > 0 ? `+${st}` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Suwak Tempo (Time Stretch) z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.dsp.tempo}:</label>
                  <button
                    onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.1) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="-0.1x"
                  >
                    -0.1x
                  </button>
                  <button
                    onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.01) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="-0.01x"
                  >
                    -0.01x
                  </button>
                  <button
                    onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.01) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="+0.01x"
                  >
                    +0.01x
                  </button>
                  <button
                    onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.1) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="+0.1x"
                  >
                    +0.1x
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={
                      editingTempo !== null
                        ? editingTempo
                        : (status.tempo_ratio ?? 1).toFixed(2)
                    }
                    onFocus={(e) => {
                      setEditingTempo((status.tempo_ratio ?? 1).toFixed(2));
                      e.target.select();
                    }}
                    onChange={(e) => setEditingTempo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const step = e.shiftKey ? 0.01 : 0.1;
                        const clean = (editingTempo ?? `${status.tempo_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                        const current = parseFloat(clean);
                        if (!isNaN(current)) {
                          const next = Math.min(3.0, Math.round((current + step) * 100) / 100);
                          setEditingTempo(next.toFixed(2));
                          handleTempoChange(next);
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const step = e.shiftKey ? 0.01 : 0.1;
                        const clean = (editingTempo ?? `${status.tempo_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                        const current = parseFloat(clean);
                        if (!isNaN(current)) {
                          const next = Math.max(0.1, Math.round((current - step) * 100) / 100);
                          setEditingTempo(next.toFixed(2));
                          handleTempoChange(next);
                        }
                      } else if (e.key === 'Enter') {
                        const clean = (editingTempo ?? '').replace('x', '').replace('X', '').replace(',', '.').trim();
                        const val = parseFloat(clean);
                        if (!isNaN(val)) {
                          const min = status.capabilities?.min_tempo_ratio ?? 0.1;
                          const max = status.capabilities?.max_tempo_ratio ?? 3.0;
                          const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                          handleTempoChange(clamped);
                        }
                        setEditingTempo(null);
                        e.currentTarget.blur();
                      } else if (e.key === 'Escape') {
                        setEditingTempo(null);
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={() => {
                      if (editingTempo !== null) {
                        const clean = editingTempo.replace('x', '').replace('X', '').replace(',', '.').trim();
                        const val = parseFloat(clean);
                        if (!isNaN(val)) {
                          const min = status.capabilities?.min_tempo_ratio ?? 0.1;
                          const max = status.capabilities?.max_tempo_ratio ?? 3.0;
                          const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                          handleTempoChange(clamped);
                        }
                        setEditingTempo(null);
                      }
                    }}
                    placeholder="1.00"
                    title="Wpisz tempo (np. 1.25 lub 1,25) i naciśnij Enter (lub użyj strzałek góra/dół)"
                    style={{
                      width: '60px',
                      padding: '2px 6px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--accent-cyan)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(6, 182, 212, 0.4)',
                      borderRadius: '6px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.85rem' }}>
                    x ({Math.round((status.tempo_ratio ?? 1) * 100)}%)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={status.capabilities?.min_tempo_ratio ?? 0.5}
                max={status.capabilities?.max_tempo_ratio ?? 2.0}
                step={0.01}
                value={status.tempo_ratio ?? 1}
                onChange={(e) => handleTempoChange(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0.75, 1.0, 1.25, 1.5, 1.75].map((tr) => (
                  <button
                    key={tr}
                    onClick={() => handleTempoChange(tr)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      background: tr === 1.0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: tr === 1.0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      color: tr === 1.0 ? 'var(--accent-cyan)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {tr === 1.0 ? '1.0x' : `${tr}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Suwak Szybkości (Rate) z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {loc.dsp.speed}:
                  </label>
                  <button
                    onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.1) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="-0.1x"
                  >
                    -0.1x
                  </button>
                  <button
                    onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.01) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="-0.01x"
                  >
                    -0.01x
                  </button>
                  <button
                    onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.01) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="+0.01x"
                  >
                    +0.01x
                  </button>
                  <button
                    onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.1) * 100) / 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="+0.1x"
                  >
                    +0.1x
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={
                      editingRate !== null
                        ? editingRate
                        : (status.rate_ratio ?? 1).toFixed(2)
                    }
                    onFocus={(e) => {
                      setEditingRate((status.rate_ratio ?? 1).toFixed(2));
                      e.target.select();
                    }}
                    onChange={(e) => setEditingRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const step = e.shiftKey ? 0.01 : 0.1;
                        const clean = (editingRate ?? `${status.rate_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                        const current = parseFloat(clean);
                        if (!isNaN(current)) {
                          const next = Math.min(3.0, Math.round((current + step) * 100) / 100);
                          setEditingRate(next.toFixed(2));
                          handleRateChange(next);
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const step = e.shiftKey ? 0.01 : 0.1;
                        const clean = (editingRate ?? `${status.rate_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                        const current = parseFloat(clean);
                        if (!isNaN(current)) {
                          const next = Math.max(0.1, Math.round((current - step) * 100) / 100);
                          setEditingRate(next.toFixed(2));
                          handleRateChange(next);
                        }
                      } else if (e.key === 'Enter') {
                        const clean = (editingRate ?? '').replace('x', '').replace('X', '').replace(',', '.').trim();
                        const val = parseFloat(clean);
                        if (!isNaN(val)) {
                          const clamped = Math.max(0.1, Math.min(3.0, Math.round(val * 100) / 100));
                          handleRateChange(clamped);
                        }
                        setEditingRate(null);
                        e.currentTarget.blur();
                      } else if (e.key === 'Escape') {
                        setEditingRate(null);
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={() => {
                      if (editingRate !== null) {
                        const clean = editingRate.replace('x', '').replace('X', '').replace(',', '.').trim();
                        const val = parseFloat(clean);
                        if (!isNaN(val)) {
                          const clamped = Math.max(0.1, Math.min(3.0, Math.round(val * 100) / 100));
                          handleRateChange(clamped);
                        }
                        setEditingRate(null);
                      }
                    }}
                    placeholder="1.00"
                    title="Wpisz prędkość (np. 1.15 lub 1,15) i naciśnij Enter (lub użyj strzałek góra/dół)"
                    style={{
                      width: '60px',
                      padding: '2px 6px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--accent-amber)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: '6px',
                      outline: 'none',
                      cursor: 'text',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.85rem' }}>
                    x ({Math.round((status.rate_ratio ?? 1) * 100)}%)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.01}
                value={status.rate_ratio ?? 1}
                onChange={(e) => handleRateChange(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0.8, 0.9, 1.0, 1.1, 1.25].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRateChange(r)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      background: r === 1.0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: r === 1.0 ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                      color: r === 1.0 ? 'var(--accent-amber)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {r === 1.0 ? '1.0x' : `${r}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel Efektu Pogłosu Reverb (GStreamer Freeverb) */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.28)',
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${reverbEnabled ? 'rgba(168, 85, 247, 0.4)' : 'var(--border-subtle)'}`,
                marginBottom: '28px',
                boxShadow: reverbEnabled ? '0 4px 20px rgba(168, 85, 247, 0.15)' : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} color={reverbEnabled ? 'var(--accent-purple)' : 'var(--text-muted)'} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                      {currentLang === 'pl' ? 'Przestrzenny Pogłos (Reverb Freeverb)' : 'Spatial Reverb (Freeverb DSP)'}
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {currentLang === 'pl' ? 'Wierne symulowanie akustyki pomieszczeń i hal' : 'Studio acoustic hall and room simulation'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleUpdateReverb(!reverbEnabled)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    background: reverbEnabled ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                    border: `1px solid ${reverbEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                    color: reverbEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {reverbEnabled ? '● REVERB ON' : '○ REVERB BYPASS'}
                </button>
              </div>

              {/* Suwaki parametrów Reverb */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', opacity: reverbEnabled ? 1 : 0.45 }}>
                {/* Rozmiar pomieszczenia (Room Size) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Room Size (Rozmiar):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbRoomSize * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!reverbEnabled}
                    value={reverbRoomSize}
                    onChange={(e) => handleUpdateReverb(true, Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Tłumienie (Damping) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Damping (Tłumienie):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbDamping * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!reverbEnabled}
                    value={reverbDamping}
                    onChange={(e) => handleUpdateReverb(true, undefined, Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Szerokość stereo (Width) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stereo Width (Szerokość):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbWidth * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!reverbEnabled}
                    value={reverbWidth}
                    onChange={(e) => handleUpdateReverb(true, undefined, undefined, Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Poziom pogłosu (Wet Level) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Wet Level (Nasycenie):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbLevel * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!reverbEnabled}
                    value={reverbLevel}
                    onChange={(e) => handleUpdateReverb(true, undefined, undefined, undefined, Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Szybkie presety pogłosu */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  Presety:
                </span>
                <button
                  onClick={() => handleUpdateReverb(true, 0.40, 0.50, 0.70, 0.25)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Small Room
                </button>
                <button
                  onClick={() => handleUpdateReverb(true, 0.70, 0.30, 0.90, 0.35)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Ambient Hall
                </button>
                <button
                  onClick={() => handleUpdateReverb(true, 0.85, 0.15, 1.0, 0.45)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cathedral
                </button>
                {/* Wymarzony profil użytkowniczki: Slowed + Reverb */}
                <button
                  onClick={() => {
                    handleTempoChange(0.82);
                    handlePitchChange(-2.0);
                    handleUpdateReverb(true, 0.75, 0.35, 1.0, 0.40);
                    showMessage('Aktywowano profil: Slowed + Reverb 🌌');
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(168, 85, 247, 0.3))',
                    border: '1px solid var(--accent-pink)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  🌌 Slowed + Reverb
                </button>
              </div>
            </div>

            {/* Menedżer presetów DSP (SQLite) */}
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '28px',
              }}
            >
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                {loc.dsp.eqPresets}:
              </label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: presets.length > 0 ? '12px' : '0' }}>
                <input
                  type="text"
                  placeholder={loc.dsp.presetNamePlaceholder}
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  onClick={handleSavePreset}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                    color: '#fff',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <Save size={14} /> {loc.dsp.savePreset}
                </button>
              </div>

              {presets.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleLoadPreset(p)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#fff',
                        background: 'rgba(25, 28, 48, 0.7)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Sparkles size={12} color="var(--accent-pink)" />
                      <span>{p.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        ({p.pitch_semitones > 0 ? `+${p.pitch_semitones}` : p.pitch_semitones}st, {p.tempo_ratio}x)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SEKCJA 3: 10-PASMOWY KOREKTOR GRAFICZNY (EQUALIZER) */}
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={18} color="var(--accent-pink)" /> {loc.dsp.equalizer}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {loc.dsp.eqDesc}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Wybór presetu EQ */}
                  <select
                    value={selectedEqPreset}
                    onChange={(e) => handleApplyEqPreset(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {eqPresets.map((preset) => (
                      <option key={preset.name} value={preset.name} style={{ background: '#181824', color: '#fff' }}>
                        {preset.name}
                      </option>
                    ))}
                  </select>

                  {/* Przycisk Reset EQ */}
                  <button
                    onClick={handleResetEq}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {loc.dsp.reset} (0 dB)
                  </button>

                  {/* Przełącznik Włącz / Wyłącz EQ (Bypass) */}
                  <button
                    onClick={handleEqToggle}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: status.equalizer_enabled !== false ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
                      border: status.equalizer_enabled !== false ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                      color: status.equalizer_enabled !== false ? 'var(--accent-pink)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {status.equalizer_enabled !== false ? `● ${loc.dsp.eqEnabled}` : `○ ${loc.dsp.eqBypass}`}
                  </button>

                  {/* Przełącznik autostartu EQ */}
                  <button
                    onClick={handleToggleEqAutoStartup}
                    title={loc.dsp.eqAutostart}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: eqAutoStartup ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${eqAutoStartup ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                      color: eqAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {eqAutoStartup ? `✓ ${loc.dsp.eqAutostartOn}` : `○ ${loc.dsp.eqAutostartOff}`}
                  </button>
                </div>
              </div>

              {/* 10 pasm w ergonomicznym układzie 2-kolumnowym */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {EQUALIZER_BANDS.map((band, idx) => {
                  const gain = (status.equalizer_bands && status.equalizer_bands[idx]) ?? 0;
                  return (
                    <div
                      key={band.freq}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        background: 'rgba(25, 28, 48, 0.6)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginRight: '6px' }}>
                            {band.freq}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            ({band.label})
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: gain > 0 ? 'rgba(255, 77, 148, 0.2)' : gain < 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)',
                            color: gain > 0 ? 'var(--accent-pink)' : gain < 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          }}
                        >
                          {gain > 0 ? `+${gain.toFixed(1)} dB` : `${gain.toFixed(1)} dB`}
                        </span>
                      </div>

                      <input
                        type="range"
                        min={-24}
                        max={12}
                        step={0.5}
                        value={gain}
                        disabled={status.equalizer_enabled === false}
                        onChange={(e) => handleEqBandChange(idx, Number(e.target.value))}
                        style={{
                          width: '100%',
                          cursor: status.equalizer_enabled === false ? 'not-allowed' : 'pointer',
                          opacity: status.equalizer_enabled === false ? 0.4 : 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEKCJA 4: NEONOWY ANALIZATOR WIDMA FFT (SPECTRUM VISUALIZER) */}
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="var(--accent-cyan)" /> {loc.dsp.spectrumTitle}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  16 FFT Bands | GStreamer FFT Analyzer (60 FPS)
                </span>
              </div>

              <SpectrumVisualizer
                spectrum={status.spectrum}
                isPlaying={status.state === 'Playing'}
                style={{ height: '110px', width: '100%' }}
              />
            </div>
          </div>
        )}

        {/* ZAKŁADKA: CENTRUM STATYSTYK & PODSUMOWANIE (AURALUNE RECAP) */}
        {activeTab === 'stats' && (
          <StatsDashboardView
            tracks={tracks}
            albums={albums}
            currentLang={language}
            onPlayTrack={handlePlayLibraryTrack}
            onOpenStatsModal={(t) => setStatsModalTrack(t)}
          />
        )}

        {/* ZAKŁADKA: PLAYLISTY (ETAP 7) */}
        {activeTab === 'playlists' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: 'min(1500px, 95vw)', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <ListMusic size={20} color="var(--accent-pink)" /> {loc.playlists.title} ({playlists.length})
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {loc.playlists.subtitle}
                </p>
              </div>

              {/* Nowa playlista input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder={loc.playlists.namePlaceholder}
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  onClick={handleCreatePlaylist}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  <Plus size={16} /> {loc.playlists.create}
                </button>
              </div>
            </div>

            {/* Siatka playlist lub szczegóły wybranej playlisty */}
            {selectedPlaylist ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <button
                      onClick={() => { setSelectedPlaylist(null); setPlaylistTracks([]); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.8rem', padding: 0, marginBottom: '6px' }}
                    >
                      {loc.playlists.backToList}
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{selectedPlaylist.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {playlistTracks.length} {loc.library.tracks} • {new Date(selectedPlaylist.created_at * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handlePlayAllTracks(playlistTracks)}
                      disabled={playlistTracks.length === 0}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: playlistTracks.length === 0 ? 'default' : 'pointer',
                        opacity: playlistTracks.length === 0 ? 0.5 : 1,
                        border: 'none',
                      }}
                    >
                      <Play size={16} /> {loc.playlists.playAll}
                    </button>
                    <button
                      onClick={() => handleDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)}
                      className="glass-card"
                      style={{ padding: '8px 14px', color: '#ff6b81', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Trash2 size={16} /> {loc.playlists.delete}
                    </button>
                  </div>
                </div>

                {/* Tabela utworów w wybranej playliście */}
                {playlistTracks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {loc.playlists.emptyHint}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 12px' }}>#</th>
                          <th style={{ padding: '10px 12px' }}>{loc.player.track}</th>
                          <th style={{ padding: '10px 12px' }}>{loc.player.artist}</th>
                          <th style={{ padding: '10px 12px' }}>Format</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>{loc.queue.duration}</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>{loc.common.edit}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playlistTracks.map((item, idx) => (
                          <tr
                            key={`${item.id}-${idx}`}
                            className="glass-card"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                          >
                            <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '12px', fontWeight: 600 }}>{item.title}</td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.artist}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                                {item.format}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatTime(item.duration_ms)}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => handlePlayAllTracks(playlistTracks, idx)}
                                  title={loc.playlists.playFromHere}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer' }}
                                >
                                  <Play size={16} />
                                </button>
                                <button
                                  onClick={(e) => handleAddTrackToQueue(item, e)}
                                  title={loc.playlists.addToQueue}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={(e) => handleOpenContainingFolder(item.path, e)}
                                  title={loc.library.openContainingFolder}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}
                                >
                                  <FolderOpen size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleRemoveTrackFromPlaylist(selectedPlaylist.id, item.id, e)}
                                  title={loc.playlists.delete}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {playlists.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                    <ListMusic size={44} style={{ opacity: 0.3, marginBottom: '14px' }} />
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>{loc.playlists.empty}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.7 }}>{loc.playlists.emptyHint}</p>
                  </div>
                ) : (
                  playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="glass-card"
                      style={{
                        padding: '20px',
                        borderRadius: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={() => handleOpenPlaylist(pl)}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{pl.name}</h4>
                          <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)' }}>
                            {pl.track_count} {loc.library.tracks}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(pl.created_at * 1000).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{loc.playlists.playAll} →</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id, pl.name); }}
                          title={loc.playlists.delete}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pływający dolny dok odtwarzacza (Mini-Player) — widoczny w zakładkach innych niż Odtwarzacz */}
      {activeTab !== 'player' && (status.state === 'Playing' || status.state === 'Paused' || currentPlayingTrack || status.current_track || filePath) && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: '76px',
            background: 'rgba(15, 12, 28, 0.96)',
            borderTop: '1px solid var(--border-accent)',
            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.65)',
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            gap: '16px',
          }}
        >
          {/* Lewa strona: Mini okładka, Tytuł, Wykonawca i format — kliknięcie przełącza do pełnego Odtwarzacza */}
          <div
            onClick={() => setActiveTab('player')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              minWidth: '220px',
              maxWidth: '30%',
              cursor: 'pointer',
            }}
            title={loc.bottomDock.openFullPlayer}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                background: currentCover
                  ? `url("${currentCover}") center/cover no-repeat`
                  : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {!currentCover && (
                <Disc
                  size={24}
                  color="#fff"
                  style={{
                    animation: status.state === 'Playing' ? 'spin 4s linear infinite' : 'none',
                  }}
                />
              )}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentPlayingTrack?.title || status.current_track?.title || (filePath ? filePath.split('/').pop() : '') || loc.player.noTrack}
              </p>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '0.76rem',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentPlayingTrack?.artist || status.current_track?.artist || loc.player.unknownArtist}
                {currentPlayingTrack?.format && (
                  <span
                    style={{
                      marginLeft: '6px',
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: 'var(--accent-cyan)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {currentPlayingTrack.format}
                  </span>
                )}
                {(currentPlayingTrack?.path || filePath || status.current_track?.uri) && (
                  <button
                    onClick={(e) =>
                      handleOpenContainingFolder(
                        currentPlayingTrack?.path || filePath || status.current_track?.uri || '',
                        e
                      )
                    }
                    title={loc.queue.openContainingFolder}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      marginLeft: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    <FolderOpen size={13} />
                  </button>
                )}
              </p>
            </div>
          </div>

          {/* Środek: Sterowanie odtwarzaniem i pasek pozycji */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              flex: 1,
              maxWidth: '560px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={handlePrevious}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={t.bottomDock.prevTooltip}
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={handlePlayPause}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(255, 77, 148, 0.45)',
                }}
                title={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
              >
                {status.state === 'Playing' ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" style={{ marginLeft: '2px' }} />}
              </button>
              <button
                onClick={handleNext}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={t.bottomDock.nextTooltip}
              >
                <SkipForward size={18} />
              </button>
            </div>

            {/* Suwak pozycji */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '36px', textAlign: 'right' }}>
                {formatTime(status.position_ms)}
              </span>
              <input
                type="range"
                min={0}
                max={status.duration_ms || 100}
                value={status.position_ms}
                onChange={(e) => handleSeek(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: '4px',
                  accentColor: 'var(--accent-pink)',
                  cursor: 'pointer',
                  background: `linear-gradient(to right, var(--accent-pink) 0%, var(--accent-purple) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
                }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '36px' }}>
                {formatTime(status.duration_ms || 0)}
              </span>
            </div>
          </div>

          {/* Prawa strona: Wskaźniki DSP, Głośność i Maksymalizacja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px', justifyContent: 'flex-end' }}>
            {/* Wskaźniki pitch/tempo */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {status.pitch_semitones !== 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: 'rgba(255, 77, 148, 0.15)',
                    color: 'var(--accent-pink)',
                    fontWeight: 600,
                  }}
                  title={t.bottomDock.pitchTooltip}
                >
                  {status.pitch_semitones > 0 ? `+${status.pitch_semitones}` : status.pitch_semitones} st
                </span>
              )}
              {status.tempo_ratio !== 1.0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: 'var(--accent-cyan)',
                    fontWeight: 600,
                  }}
                  title={t.bottomDock.tempoTooltip}
                >
                  {status.tempo_ratio.toFixed(2)}x
                </span>
              )}
            </div>

            {/* Suwak głośności */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleToggleMute}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                title={status.volume === 0 ? t.bottomDock.mutedTooltip : t.bottomDock.volumeTooltip}
              >
                {status.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={status.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                title={`${loc.player.volume}: ${Math.round(status.volume * 100)}%`}
                style={{
                  width: '95px',
                  height: '4px',
                  cursor: 'pointer',
                  background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
                }}
              />
            </div>

            {/* Przycisk przejścia do pełnego ekranu Odtwarzacza */}
            <button
              onClick={() => setActiveTab('player')}
              className="glass-card"
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
              }}
              title={t.bottomDock.openFullPlayer}
            >
              <Maximize2 size={14} />
            </button>

            {/* Przycisk przejścia do mini-player */}
            <button
              onClick={toggleMiniPlayer}
              className="glass-card"
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
              }}
              title={t.bottomDock.maximizeTooltip}
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Szuflada kolejki odtwarzania (Drawer) */}
      {isQueueOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '420px',
            maxWidth: '90vw',
            background: 'rgba(15, 12, 28, 0.98)',
            borderLeft: '1px solid var(--border-accent)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Nagłówek szuflady */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ListMusic size={22} color="var(--accent-pink)" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{loc.queue.title}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {queue.items.length} {loc.library.tracks} • {queue.loop_mode !== 'None' ? `${loc.shortcuts.loop}: ${queue.loop_mode}` : loc.player.loopOff}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {queue.items.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  title={loc.queue.clear}
                  className="glass-card"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#ff6b81', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={14} /> {loc.queue.clear}
                </button>
              )}
              <button
                onClick={() => setIsQueueOpen(false)}
                title={loc.common.close}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lista pozycji w kolejce */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Music size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.9rem', margin: 0 }}>{loc.queue.empty}</p>
                <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.7 }}>
                  {loc.queue.emptyHint}
                </p>
              </div>
            ) : (
              queue.items.map((item, idx) => {
                const isCurrent = idx === queue.current_index;
                return (
                  <div
                    key={item.id}
                    onClick={() => handlePlayQueueIndex(idx)}
                    className="glass-card"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      background: isCurrent ? 'rgba(255, 77, 148, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isCurrent ? '1px solid var(--accent-pink)' : '1px solid rgba(255, 255, 255, 0.06)',
                      boxShadow: isCurrent ? '0 0 16px rgba(255, 77, 148, 0.25)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ width: '24px', textAlign: 'center', color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: isCurrent ? 700 : 400 }}>
                      {isCurrent && status.state === 'Playing' ? (
                        <Zap size={16} color="var(--accent-pink)" />
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: isCurrent ? '#fff' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.artist} {item.album ? `• ${item.album}` : ''}
                      </p>
                    </div>

                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {formatTime(item.duration_ms)}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        disabled={idx === 0}
                        onClick={(e) => handleMoveQueueItem(idx, idx - 1, e)}
                        title={loc.queue.moveUp}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                          cursor: idx === 0 ? 'default' : 'pointer',
                          padding: '4px',
                        }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        disabled={idx === queue.items.length - 1}
                        onClick={(e) => handleMoveQueueItem(idx, idx + 1, e)}
                        title={loc.queue.moveDown}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: idx === queue.items.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                          cursor: idx === queue.items.length - 1 ? 'default' : 'pointer',
                          padding: '4px',
                        }}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveFromQueue(item.id, e)}
                        title={loc.queue.remove}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

            {/* OKNO MODALNE USTAWIEŃ I PERSONALIZACJI */}
      {isSettingsOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '940px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
              border: '1px solid var(--border-accent)',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              background: 'var(--bg-deep)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nagłówek okna ustawień */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
                  }}
                >
                  <Settings size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>{loc.settings.title}</h2>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                    {loc.settings.subtitle}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="glass-card"
                style={{ padding: '6px 10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                title={loc.settings.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Pasek zakładek ustawień */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 24px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderBottom: '1px solid var(--border-subtle)',
                overflowX: 'auto',
              }}
            >
              <button
                onClick={() => setSettingsTab('themes')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: settingsTab === 'themes' ? 'var(--accent-purple)' : 'transparent',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <Palette size={15} />
                {loc.settings.themes}
              </button>
              <button
                onClick={() => setSettingsTab('devices')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: settingsTab === 'devices' ? 'var(--accent-purple)' : 'transparent',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <Radio size={15} />
                {loc.settings.audioDevices}
              </button>
              <button
                onClick={() => setSettingsTab('transcode')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: settingsTab === 'transcode' ? 'var(--accent-purple)' : 'transparent',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <FileAudio size={15} />
                {loc.settings.exportOpus}
              </button>
              <button
                onClick={() => setSettingsTab('about')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: settingsTab === 'about' ? 'var(--accent-purple)' : 'transparent',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <Info size={15} />
                {loc.settings.about}
              </button>
              <button
                onClick={() => setSettingsTab('changelog')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: settingsTab === 'changelog' ? 'var(--accent-purple)' : 'transparent',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <History size={15} />
                {loc.settings.changelog}
              </button>
            </div>

            {/* Treść wybranej pod-zakładki ustawień */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {settingsTab === 'themes' && renderThemesSection()}
              {settingsTab === 'devices' && renderDevicesSection()}
              {settingsTab === 'transcode' && renderTranscodeSection()}
              {settingsTab === 'about' && renderAboutSection()}
              {settingsTab === 'changelog' && renderChangelogSection()}
            </div>
          </div>
        </div>
      )}

      {/* Modal dodawania utworu do playlisty */}
      {showPlaylistModal && trackToAddToPlaylist && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '28px',
              width: '450px',
              maxWidth: '90vw',
              borderRadius: '16px',
              border: '1px solid var(--border-accent)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={18} color="var(--accent-purple)" /> {loc.playlists.title}
              </h3>
              <button
                onClick={() => { setShowPlaylistModal(false); setTrackToAddToPlaylist(null); }}
                title={loc.common.close}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {loc.playlists.title}: <strong style={{ color: 'var(--accent-pink)' }}>{trackToAddToPlaylist.title}</strong>
            </p>

            {playlists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {loc.playlists.empty}. {loc.playlists.emptyHint}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddTrackToPlaylist(pl.id, trackToAddToPlaylist.id)}
                    className="glass-card"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: '#fff',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{pl.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pl.track_count} {loc.library.tracks}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Skrótów Klawiszowych */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        currentLang={language}
      />

      {/* Online Cover Art Picker Modal */}
      {coverPickerState && (
        <CoverArtPickerModal
          isOpen={coverPickerState.isOpen}
          onClose={() => setCoverPickerState(null)}
          albumId={coverPickerState.albumId}
          initialAlbum={coverPickerState.title}
          initialArtist={coverPickerState.artist}
          trackId={currentPlayingTrack?.id || null}
          currentLang={language}
          onCoverApplied={async (coverDataUri) => {
            setTrackDirectCover(coverDataUri);
            setAlbums((prev) =>
              prev.map((a) =>
                a.id === coverPickerState.albumId ? { ...a, cover_path: coverDataUri } : a
              )
            );
            showMessage(loc.notifications.mbCoverMatched.replace('{0}', coverPickerState.title));
            await loadLibrary();
          }}
        />
      )}
      </div>

      {/* Tryb immersyjny Kiosk / Pełny ekran Now Playing (F11) */}
      {isBigScreen && (
        <BigScreenView
          title={currentPlayingTrack?.title || status.current_track?.title || (filePath ? filePath.split('/').pop() : '') || 'Auralune Audio Player'}
          artist={currentPlayingTrack?.artist || status.current_track?.artist || loc.player.unknownArtist}
          album={currentAlbum?.title || currentPlayingTrack?.album_artist || status.current_track?.album || null}
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
          onVolumeChange={handleVolumeChange}
          onClose={() => setIsBigScreen(false)}
          onFetchCover={handleFetchCurrentTrackCover}
          onUploadCover={() => handleUploadCustomCoverDirect(currentAlbum)}
        />
      )}

      {/* Modal Wyłącznika Czasowego (Sleep Timer z łagodnym Fade-Out) */}
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        currentLang={language}
        remainingSec={sleepTimerRemainingSec}
        targetMode={sleepTimerTargetMode}
        fadeOut={sleepTimerFadeOut}
        onSetTimer={handleSetSleepTimer}
        onCancelTimer={handleCancelSleepTimer}
      />

      {/* Modal Szczegółowych Statystyk Utworu */}
      {statsModalTrack && (
        <TrackStatsModal
          track={statsModalTrack}
          currentLang={language}
          onClose={() => setStatsModalTrack(null)}
          onResetPlays={handleResetTrackPlays}
        />
      )}

      {/* Modal Precyzyjnej Edycji Pętli A-B (co do milisekundy) */}
      <LoopEditorModal
        isOpen={isLoopEditorOpen}
        onClose={() => setIsLoopEditorOpen(false)}
        loopPointA={loopPointA}
        loopPointB={loopPointB}
        currentPositionMs={status.position_ms}
        durationMs={status.duration_ms}
        onApplyLoop={(a, b) => {
          setLoopPointA(a);
          setLoopPointB(b);
          if (a !== null && b !== null) {
            showMessage(`Ustawiono pętlę A-B: ${formatTimeMs(a)} → ${formatTimeMs(b)} (${b - a} ms)`);
          } else {
            showMessage(loc.shortcuts.loopClear || 'Wyczyszczono pętlę A-B');
          }
        }}
        onSeek={handleSeek}
        loc={loc}
      />

      {/* Kreator pierwszego uruchomienia i wprowadzenie (Onboarding & Disclaimer) */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        currentLang={language}
        onLanguageChange={setLanguage}
        recapOptIn={recapOptIn}
        onRecapOptInChange={(opt) => {
          setRecapOptIn(opt);
          try {
            localStorage.setItem('auralune_recap_opt_in', String(opt));
          } catch {}
        }}
        instantVolume={instantVolume}
        onInstantVolumeChange={(inst) => {
          setInstantVolume(inst);
          try {
            localStorage.setItem('auralune_instant_volume', String(inst));
          } catch {}
        }}
        volumeOsdPosition={volumeOsdPosition}
        onVolumeOsdPositionChange={(pos) => {
          setVolumeOsdPosition(pos as VolumeOsdPosition);
          try {
            localStorage.setItem('auralune_volume_osd_position', pos);
          } catch {}
        }}
      />

      {/* Menu / Modal Tonacji i Tempa (Key & BPM A/B DSP) */}
      <KeyBpmModal
        isOpen={isKeyBpmModalOpen}
        onClose={() => setIsKeyBpmModalOpen(false)}
        currentTrackTitle={currentPlayingTrack?.title || status.current_track?.title || undefined}
        currentTrackId={activeTrackId || status.current_track?.track_id || undefined}
        currentTrackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || undefined}
        pitchSemitones={status.pitch_semitones ?? 0}
        tempoRatio={status.tempo_ratio ?? 1}
        rateRatio={status.rate_ratio ?? 1}
        onPitchChange={handlePitchChange}
        onTempoChange={handleTempoChange}
        currentLang={language}
      />

      {/* Podsumowanie Tygodnia, Miesiąca i Roku (Auralune Recap / Wrapped) */}
      <AuraluneRecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        currentLang={language}
        onPlayTrackId={(id) => {
          const tr = tracks.find((t) => t.id === id);
          if (tr) handlePlayAllTracks([tr], 0);
        }}
      />
    </div>
  );
}
