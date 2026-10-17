import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  ListPlus,
} from 'lucide-react';

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
  engine: 'SoundTouch' | 'RubberBand';
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
  engine: 'SoundTouch' | 'RubberBand';
  capabilities: DspCapabilities;
  loop_mode?: 'None' | 'Track' | 'Queue';
  shuffle?: boolean;
  current_track?: QueueItem | null;
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
    engine: 'SoundTouch',
    capabilities: {
      engine: 'SoundTouch',
      name: 'SoundTouch',
      min_pitch_semitones: -12.0,
      max_pitch_semitones: 12.0,
      min_tempo_ratio: 0.5,
      max_tempo_ratio: 2.0,
      supports_formants: false,
      description: 'Lekki silnik SoundTouch (niski narzut CPU, natywna integracja w GStreamer)',
    },
  });

  const [cards, setCards] = useState<AudioCard[]>([]);
  const [activeTab, setActiveTab] = useState<'player' | 'library' | 'playlists' | 'dsp' | 'devices' | 'transcode' | 'themes'>('player');

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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Stan motywów Anime (Etap 5)
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [themeOverlay, setThemeOverlay] = useState<number>(0.4);
  const [themeBlur, setThemeBlur] = useState<number>(8.0);
  const [themeBgImage, setThemeBgImage] = useState<string | null>(null);
  const [customBgPath, setCustomBgPath] = useState<string>('');
  const [jsonExportContent, setJsonExportContent] = useState<string>('');
  const [jsonImportContent, setJsonImportContent] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Stan biblioteki
  const [scanFolder, setScanFolder] = useState('tests/fixtures');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummaryDto | null>(null);
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);

  // Stan MusicBrainz i Cover Art Archive (Etap 6)
  const [librarySubView, setLibrarySubView] = useState<'tracks' | 'albums'>('tracks');
  const [selectedAlbumForMb, setSelectedAlbumForMb] = useState<AlbumRecord | null>(null);
  const [mbSearchTitle, setMbSearchTitle] = useState('');
  const [mbSearchArtist, setMbSearchArtist] = useState('');
  const [mbCandidates, setMbCandidates] = useState<ReleaseCandidateDto[]>([]);
  const [isSearchingMb, setIsSearchingMb] = useState(false);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // Stan presetów DSP (Etap 3)
  const [presets, setPresets] = useState<DspPresetRecord[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  // Odpytywanie statusu odtwarzacza
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await invoke<PlaybackStatus>('get_status');
        setStatus(res);
        if (res.current_track && res.current_track.track_id) {
          setActiveTrackId(res.current_track.track_id);
        }
      } catch (e) {
        // Ignoruj błędy gdy backend nie jest jeszcze zainicjalizowany
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 250);
    return () => clearInterval(interval);
  }, []);

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
    } catch (e: any) {
      console.warn('Błąd ładowania motywów:', e);
    }
  };

  const handleSelectTheme = async (themeId: string) => {
    try {
      const t = await invoke<Theme>('set_active_theme', { themeId });
      applyThemeToDom(t);
      showMessage(`Aktywowano motyw '${t.name}'`);
    } catch (e: any) {
      showMessage(`Błąd aktywacji motywu: ${e}`, true);
    }
  };

  const handleUploadBgImage = async () => {
    if (!customBgPath.trim()) {
      showMessage('Podaj ścieżkę do pliku graficznego PNG/JPG/WebP', true);
      return;
    }
    try {
      const dataUri = await invoke<string>('upload_background_image', { filePath: customBgPath.trim() });
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
        showMessage('Zaktualizowano tło anime z pliku!');
      }
    } catch (e: any) {
      showMessage(`Błąd wczytywania tła: ${e}`, true);
    }
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
      showMessage('Usunięto tło, przywrócono czysty gradient motywu');
    } catch (e: any) {
      showMessage(`Błąd usuwania tła: ${e}`, true);
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
      showMessage('Zapisano parametry tła (overlay i blur) w motywie');
    } catch (e: any) {
      showMessage(`Błąd zapisu parametrów tła: ${e}`, true);
    }
  };

  const handleExportTheme = async () => {
    if (!currentTheme) return;
    try {
      const json = await invoke<string>('export_theme_json', { themeId: currentTheme.id });
      setJsonExportContent(json);
      showMessage(`Wygenerowano JSON dla motywu '${currentTheme.name}'`);
    } catch (e: any) {
      showMessage(`Błąd eksportu motywu: ${e}`, true);
    }
  };

  const handleImportTheme = async () => {
    if (!jsonImportContent.trim()) {
      showMessage('Wklej treść JSON motywu do zaimportowania', true);
      return;
    }
    try {
      const imported = await invoke<Theme>('import_theme_json', { jsonContent: jsonImportContent.trim() });
      applyThemeToDom(imported);
      await loadThemes();
      setJsonImportContent('');
      showMessage(`Pomyślnie zaimportowano i aktywowano motyw '${imported.name}'`);
    } catch (e: any) {
      showMessage(`Błąd importu motywu: ${e}`, true);
    }
  };

  useEffect(() => {
    refreshDevices();
    loadLibrary();
    loadPresets();
    loadThemes();
    refreshQueue();
    refreshPlaylists();
  }, []);

  const showMessage = (msg: string, isError = false) => {
    setInfoMessage(isError ? `⚠️ ${msg}` : `✨ ${msg}`);
    setTimeout(() => setInfoMessage(null), 4000);
  };

  // Obsługa skanera biblioteki
  const handleScanLibrary = async () => {
    setIsScanning(true);
    try {
      const summary = await invoke<ScanSummaryDto>('scan_library', { folderPath: scanFolder });
      setScanResult(summary);
      await loadLibrary();
      showMessage(
        `Skanowanie ukończone: ${summary.new_or_updated_tracks} zindeksowano, ${summary.skipped_unchanged} pominięto (bez zmian).`
      );
    } catch (e: any) {
      showMessage(`Błąd skanowania biblioteki: ${e}`, true);
    } finally {
      setIsScanning(false);
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
      showMessage('Podaj tytuł albumu do wyszukania', true);
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
        showMessage('Nie znaleziono pasujących wydań w MusicBrainz', true);
      } else {
        showMessage(`Znaleziono ${candidates.length} wydań w MusicBrainz`);
      }
    } catch (e: any) {
      showMessage(`Błąd wyszukiwania w MusicBrainz: ${e}`, true);
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

      showMessage(`Pomyślnie pobrano okładkę z Cover Art Archive dla '${selectedAlbumForMb.title}'!`);
      setSelectedAlbumForMb(null);
      await loadLibrary();
    } catch (e: any) {
      showMessage(`Błąd pobierania okładki z Cover Art Archive: ${e}`, true);
    } finally {
      setIsFetchingCover(false);
    }
  };

  const handleAutoFetchCover = async (album: AlbumRecord) => {
    try {
      showMessage(`Wyszukiwanie okładki dla '${album.title}' w MusicBrainz & CAA...`);
      const coverDataUri = await invoke<string | null>('auto_fetch_album_cover', {
        albumId: album.id,
        albumTitle: album.title,
        artist: album.album_artist,
      });

      if (coverDataUri) {
        setAlbums((prev) =>
          prev.map((a) => (a.id === album.id ? { ...a, cover_path: coverDataUri } : a))
        );
        showMessage(`Pomyślnie dopasowano i pobrano okładkę dla '${album.title}'!`);
        await loadLibrary();
      } else {
        showMessage(`Brak pewnego dopasowania (score >= 85). Otwieram okno wyboru kandydatów.`, true);
        handleOpenMbModal(album);
      }
    } catch (e: any) {
      showMessage(`Błąd automatycznego dopasowania: ${e}`, true);
    }
  };

  // Odtwarzanie utworu z biblioteki z obsługą zakładek
  const handlePlayLibraryTrack = async (track: TrackRecord) => {
    try {
      setActiveTrackId(track.id);
      setFilePath(track.path);
      await invoke('load_file', { path: track.path });

      // Sprawdź czy jest zapisana zakładka (bookmark)
      const bookmark = await invoke<number | null>('get_bookmark', { trackId: track.id });
      if (bookmark && bookmark > 2000) {
        await invoke('seek', { positionMs: bookmark });
        showMessage(`Wznowiono utwór '${track.title}' od pozycji ${formatTime(bookmark)}`);
      } else {
        showMessage(`Rozpoczęto odtwarzanie: ${track.title} (${track.artist})`);
      }

      await invoke('play');

      // Publikacja metadanych do systemowego D-Bus MPRIS (KDE/GNOME/playerctl)
      await invoke('update_mpris_metadata', {
        title: track.title,
        artist: track.artist,
        album: 'Auralune Library',
        durationMs: track.duration_ms,
        artUrl: null,
      });
    } catch (e: any) {
      showMessage(`Błąd odtwarzania utworu: ${e}`, true);
    }
  };

  // Zapis zakładki dla aktywnego utworu
  const handleSaveBookmark = async () => {
    if (!activeTrackId) {
      showMessage('Najpierw wybierz utwór z biblioteki', true);
      return;
    }
    try {
      await invoke('save_bookmark', {
        trackId: activeTrackId,
        positionMs: status.position_ms,
      });
      showMessage(`Zapisano pozycję (${formatTime(status.position_ms)}) jako zakładkę.`);
    } catch (e: any) {
      showMessage(`Błąd zapisu zakładki: ${e}`, true);
    }
  };

  // Sterowanie odtwarzaczem
  const handleLoadFile = async (path: string) => {
    try {
      await invoke('load_file', { path });
      const filename = path.split('/').pop() || path;
      await invoke('update_mpris_metadata', {
        title: filename,
        artist: 'Plik lokalny',
        album: 'Auralune Player',
        durationMs: 0,
        artUrl: null,
      });
      showMessage(`Załadowano plik: ${path}`);
    } catch (e: any) {
      showMessage(`Błąd ładowania pliku: ${e}`, true);
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
      showMessage(`Błąd sterowania: ${e}`, true);
    }
  };

  const handleStop = async () => {
    try {
      await invoke('stop');
    } catch (e: any) {
      showMessage(`Błąd zatrzymania: ${e}`, true);
    }
  };

  const handleSeek = async (val: number) => {
    try {
      await invoke('seek', { positionMs: val });
    } catch (e: any) {
      showMessage(`Błąd seek: ${e}`, true);
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
        showMessage(`Następny utwór: ${nextItem.title}`);
      } else {
        showMessage('Koniec kolejki odtwarzania');
      }
    } catch (e: any) {
      showMessage(`Błąd przejścia do następnego utworu: ${e}`, true);
    }
  };

  const handlePrevious = async () => {
    try {
      const prevItem = await invoke<QueueItem | null>('play_previous');
      await refreshQueue();
      if (prevItem) {
        showMessage(`Poprzedni utwór: ${prevItem.title}`);
      }
    } catch (e: any) {
      showMessage(`Błąd cofania: ${e}`, true);
    }
  };

  const handleToggleShuffle = async () => {
    try {
      const newShuffle = await invoke<boolean>('toggle_shuffle');
      await refreshQueue();
      showMessage(newShuffle ? 'Włączono tryb losowy (Shuffle: WŁ)' : 'Wyłączono tryb losowy (Shuffle: WYŁ)');
    } catch (e: any) {
      showMessage(`Błąd zmiany trybu losowego: ${e}`, true);
    }
  };

  const handleCycleLoopMode = async () => {
    try {
      const modes: ('None' | 'Queue' | 'Track')[] = ['None', 'Queue', 'Track'];
      const currentIdx = modes.indexOf(queue.loop_mode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      await invoke('set_loop_mode', { mode: nextMode });
      await refreshQueue();
      const labels = { None: 'Wyłączona', Queue: 'Cała kolejka', Track: 'Pojedynczy utwór' };
      showMessage(`Tryb powtarzania (Loop): ${labels[nextMode]}`);
    } catch (e: any) {
      showMessage(`Błąd zmiany pętli: ${e}`, true);
    }
  };

  const handlePlayQueueIndex = async (index: number) => {
    try {
      const item = await invoke<QueueItem | null>('play_queue_index', { index });
      await refreshQueue();
      if (item) {
        showMessage(`Odtwarzanie: ${item.title}`);
      }
    } catch (e: any) {
      showMessage(`Błąd wyboru utworu z kolejki: ${e}`, true);
    }
  };

  const handleRemoveFromQueue = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke('remove_from_queue', { id });
      await refreshQueue();
      showMessage('Usunięto utwór z kolejki');
    } catch (err: any) {
      showMessage(`Błąd usuwania z kolejki: ${err}`, true);
    }
  };

  const handleMoveQueueItem = async (fromIdx: number, toIdx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (toIdx < 0 || toIdx >= queue.items.length) return;
    try {
      await invoke('reorder_queue', { fromIdx, toIdx });
      await refreshQueue();
    } catch (err: any) {
      showMessage(`Błąd przesuwania utworu: ${err}`, true);
    }
  };

  const handleClearQueue = async () => {
    try {
      await invoke('clear_queue');
      await refreshQueue();
      showMessage('Wyczyszczono kolejkę odtwarzania');
    } catch (e: any) {
      showMessage(`Błąd czyszczenia kolejki: ${e}`, true);
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
      showMessage(`Dodano '${track.title}' na koniec kolejki`);
    } catch (err: any) {
      showMessage(`Błąd dodawania do kolejki: ${err}`, true);
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
      showMessage(`Ustawiono '${track.title}' jako następny utwór`);
    } catch (err: any) {
      showMessage(`Błąd dodawania do kolejki: ${err}`, true);
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
      showMessage(`Załadowano ${items.length} utworów do kolejki odtwarzania`);
    } catch (err: any) {
      showMessage(`Błąd kolejkowania listy: ${err}`, true);
    }
  };

  // ===================================
  // OBSŁUGA PLAYLIST (ETAP 7)
  // ===================================

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      showMessage('Podaj nazwę nowej playlisty', true);
      return;
    }
    try {
      await invoke('create_playlist', { name: newPlaylistName.trim() });
      setNewPlaylistName('');
      await refreshPlaylists();
      showMessage(`Utworzono playlistę '${newPlaylistName.trim()}'`);
    } catch (err: any) {
      showMessage(`Błąd tworzenia playlisty: ${err}`, true);
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
      showMessage(`Usunięto playlistę '${name}'`);
    } catch (err: any) {
      showMessage(`Błąd usuwania playlisty: ${err}`, true);
    }
  };

  const handleOpenPlaylist = async (pl: Playlist) => {
    setSelectedPlaylist(pl);
    try {
      const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId: pl.id });
      setPlaylistTracks(tr);
    } catch (err: any) {
      showMessage(`Błąd otwierania playlisty: ${err}`, true);
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
      showMessage('Dodano utwór do playlisty');
    } catch (err: any) {
      showMessage(`Błąd dodawania do playlisty: ${err}`, true);
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: number, trackId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke('remove_track_from_playlist', { playlistId, trackId });
      const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId });
      setPlaylistTracks(tr);
      await refreshPlaylists();
      showMessage('Usunięto utwór z playlisty');
    } catch (err: any) {
      showMessage(`Błąd usuwania utworu z playlisty: ${err}`, true);
    }
  };

  const handlePitchChange = async (semitones: number) => {
    try {
      await invoke('set_pitch', { semitones });
    } catch (e: any) {
      showMessage(`Błąd pitch: ${e}`, true);
    }
  };

  const handleTempoChange = async (tempoRatio: number) => {
    try {
      await invoke('set_tempo', { tempoRatio });
    } catch (e: any) {
      showMessage(`Błąd tempo: ${e}`, true);
    }
  };

  const handleRateChange = async (rateRatio: number) => {
    try {
      await invoke('set_rate', { rateRatio });
      showMessage(`Ustawiono szybkość odtwarzania (rate) na: ${rateRatio.toFixed(2)}x`);
    } catch (e: any) {
      showMessage(`Błąd szybkości: ${e}`, true);
    }
  };

  const handleResetDsp = async () => {
    try {
      const res = await invoke<PlaybackStatus>('reset_dsp');
      setStatus(res);
      showMessage('Zresetowano parametry DSP do wartości fabrycznych (1.0x / 0.0 st)');
    } catch (e: any) {
      showMessage(`Błąd resetu DSP: ${e}`, true);
    }
  };

  const handleEngineChange = async (engine: 'SoundTouch' | 'RubberBand') => {
    try {
      const res = await invoke<PlaybackStatus>('set_dsp_engine', { engine });
      setStatus(res);
      showMessage(`Przełączono silnik DSP na: ${res.capabilities.name}`);
    } catch (e: any) {
      showMessage(`Błąd zmiany silnika DSP: ${e}`, true);
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
      showMessage('Podaj nazwę dla presetu DSP', true);
      return;
    }
    try {
      await invoke('save_dsp_preset', { name: newPresetName.trim() });
      showMessage(`Zapisano preset '${newPresetName.trim()}' w bazie danych SQLite`);
      setNewPresetName('');
      await loadPresets();
    } catch (e: any) {
      showMessage(`Błąd zapisu presetu: ${e}`, true);
    }
  };

  const handleLoadPreset = async (preset: DspPresetRecord) => {
    try {
      const res = await invoke<PlaybackStatus>('load_dsp_preset', { preset });
      setStatus(res);
      showMessage(`Załadowano preset: ${preset.name} (${preset.engine})`);
    } catch (e: any) {
      showMessage(`Błąd ładowania presetu: ${e}`, true);
    }
  };

  const handleVolumeChange = async (volume: number) => {
    try {
      await invoke('set_volume', { volume });
    } catch (e: any) {
      showMessage(`Błąd głośności: ${e}`, true);
    }
  };

  const handleEnableProAudio = async (cardName: string) => {
    try {
      await invoke('enable_pro_audio', { cardName });
      showMessage(`Włączono profil Pro Audio (Bit-Perfect) na karcie: ${cardName}`);
      refreshDevices();
    } catch (e: any) {
      showMessage(`Nie udało się włączyć Pro Audio: ${e}`, true);
    }
  };

  const handleSetBluetoothCodec = async (cardName: string, codec: string) => {
    try {
      await invoke('set_bluetooth_codec', { cardName, codec });
      showMessage(`Zmieniono kodek Bluetooth na: ${codec}`);
      refreshDevices();
    } catch (e: any) {
      showMessage(`Błąd zmiany kodeka Bluetooth: ${e}`, true);
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

      showMessage(`Pomyślnie przekonwertowano do ${transcodeOutput}! Oryginał pozostał nienaruszony.`);
      await loadLibrary();
    } catch (e: any) {
      showMessage(`Błąd transkodowania: ${e}`, true);
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', position: 'relative' }}>
      {/* Dynamiczne tło anime z kontrolowanym rozmyciem i nakładką */}
      <div
        className="anime-bg-layer"
        style={{
          backgroundImage: themeBgImage ? `url("${themeBgImage}")` : undefined,
          display: themeBgImage ? 'block' : 'none',
        }}
      />
      <div
        className="anime-overlay-layer"
        style={{
          display: themeBgImage ? 'block' : 'none',
        }}
      />

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
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Sparkles size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Auralune <span style={{ color: 'var(--accent-pink)', fontSize: '0.9rem' }}>狐 Kitsune</span>
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Linux High-Fidelity DSP & PipeWire Audio Engine
            </p>
          </div>
        </div>

        {/* Zakładki */}
        <nav style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px' }}>
          <button
            onClick={() => setActiveTab('player')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeTab === 'player' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Odtwarzacz
          </button>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeTab === 'library' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Biblioteka ({tracks.length})
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            style={{
              padding: '8px 14px',
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
            Playlisty ({playlists.length})
          </button>
          <button
            onClick={() => setActiveTab('dsp')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeTab === 'dsp' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Panel DSP
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeTab === 'devices' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Pro Audio & Bluetooth
          </button>
          <button
            onClick={() => setActiveTab('transcode')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeTab === 'transcode' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Eksport & Opus
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeTab === 'themes' ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Palette size={15} />
            Motywy
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
            Kolejka ({queue.items.length})
          </button>
        </nav>
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
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {/* ZAKŁADKA 1: ODTWARZACZ */}
        {activeTab === 'player' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileAudio size={20} color="var(--accent-cyan)" /> Wybór i ładowanie utworu
            </h2>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
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
                onClick={() => handleLoadFile(filePath)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                Załaduj
              </button>
            </div>

            {/* Szybkie presety testowe */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Próbki testowe:</span>
              <button
                onClick={() => {
                  setFilePath('tests/fixtures/test_sine_440hz.wav');
                  handleLoadFile('tests/fixtures/test_sine_440hz.wav');
                }}
                className="glass-card"
                style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
              >
                WAV 440 Hz Sinus
              </button>
              <button
                onClick={() => {
                  setFilePath('tests/fixtures/test_sine_440hz.opus');
                  handleLoadFile('tests/fixtures/test_sine_440hz.opus');
                }}
                className="glass-card"
                style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}
              >
                Opus 48 kHz
              </button>
            </div>

            {/* Wizualizacja odtwarzania */}
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '24px',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                  {status.current_track?.title || filePath.split('/').pop() || 'Auralune Player'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-pink)' }}>
                  {status.current_track?.artist || 'Brak wykonawcy'} {status.current_track?.album ? `• ${status.current_track.album}` : ''}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Status: <strong style={{ color: status.state === 'Playing' ? 'var(--accent-green)' : 'var(--text-muted)' }}>{status.state}</strong>
                </span>
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                  {formatTime(status.position_ms)} / {status.duration_ms ? formatTime(status.duration_ms) : '--:--'}
                </span>
              </div>

              {/* Pasek postępu */}
              <input
                type="range"
                min={0}
                max={status.duration_ms || 100}
                value={status.position_ms}
                onChange={(e) => handleSeek(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '20px' }}
              />

              {/* Przyciski sterowania */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={handleSaveBookmark}
                  title="Zapisz zakładkę odtwarzania"
                  className="glass-card"
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: activeTrackId ? 'var(--accent-amber)' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  <Bookmark size={15} /> Zakładka
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Shuffle Button */}
                  <button
                    onClick={handleToggleShuffle}
                    title={queue.shuffle ? 'Tryb losowy (WŁ)' : 'Tryb losowy (WYŁ)'}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: queue.shuffle ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.06)',
                      border: queue.shuffle ? '1px solid var(--accent-cyan)' : 'none',
                      color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Shuffle size={18} />
                  </button>

                  {/* Previous Button */}
                  <button
                    onClick={handlePrevious}
                    title="Poprzedni utwór"
                    style={{
                      width: '44px',
                      height: '44px',
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
                    <SkipBack size={20} />
                  </button>

                  {/* Stop Button */}
                  <button
                    onClick={handleStop}
                    title="Zatrzymaj"
                    style={{
                      width: '44px',
                      height: '44px',
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
                    <Square size={18} />
                  </button>

                  {/* Play / Pause Button */}
                  <button
                    onClick={handlePlayPause}
                    style={{
                      width: '64px',
                      height: '64px',
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
                    {status.state === 'Playing' ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '4px' }} />}
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={handleNext}
                    title="Następny utwór"
                    style={{
                      width: '44px',
                      height: '44px',
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
                    <SkipForward size={20} />
                  </button>

                  {/* Repeat Button */}
                  <button
                    onClick={handleCycleLoopMode}
                    title={`Tryb pętli: ${queue.loop_mode === 'Track' ? 'Utwór' : queue.loop_mode === 'Queue' ? 'Kolejka' : 'Wyłączony'}`}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: queue.loop_mode !== 'None' ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
                      border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : 'none',
                      color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    {queue.loop_mode === 'Track' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                    {queue.loop_mode === 'Queue' && (
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-pink)' }} />
                    )}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {status.volume === 0 ? <VolumeX size={18} color="var(--text-muted)" /> : <Volume2 size={18} color="var(--text-secondary)" />}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={status.volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    style={{ width: '80px' }}
                  />
                </div>
              </div>
            </div>

            {/* Aktywne wskaźniki DSP */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="glass-card" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pitch Shift:</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-pink)' }}>
                  {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} półtonów
                </p>
              </div>
              <div className="glass-card" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mnożnik tempa:</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  {status.tempo_ratio.toFixed(2)}x
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ZAKŁADKA 2: BIBLIOTEKA (ETAP 2) */}
        {activeTab === 'library' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '960px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Music size={20} color="var(--accent-purple)" /> Lokalna Biblioteka Muzyczna (SQLite)
              </h2>
              <button
                onClick={loadLibrary}
                className="glass-card"
                style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.8rem' }}
              >
                <RefreshCw size={14} /> Odśwież widok
              </button>
            </div>

            {/* Panel skanera przyrostowego */}
            <div
              style={{
                background: 'rgba(0,0,0,0.25)',
                padding: '18px',
                borderRadius: '14px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '24px',
              }}
            >
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Katalog muzyki do skanowania (FLAC, MP3, OGG, Opus, WAV):
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={scanFolder}
                  onChange={(e) => setScanFolder(e.target.value)}
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
                  onClick={handleScanLibrary}
                  disabled={isScanning}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    background: isScanning ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                    color: '#fff',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <FolderOpen size={16} /> {isScanning ? 'Skanowanie...' : 'Skanuj przyrostowo'}
                </button>
              </div>

              {scanResult && (
                <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--accent-green)' }}>
                  ✓ Przeskanowano: {scanResult.total_files_found} plików | Zindeksowano: {scanResult.new_or_updated_tracks} | Pominięto bez zmian: {scanResult.skipped_unchanged}
                </p>
              )}
            </div>

            {/* Statystyki biblioteki */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Music size={28} color="var(--accent-pink)" />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Utwory</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{tracks.length}</p>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Disc size={28} color="var(--accent-purple)" />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Albumy</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{albums.length}</p>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={28} color="var(--accent-cyan)" />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Łączny czas</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {formatTime(tracks.reduce((acc, t) => acc + t.duration_ms, 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Przełącznik widoku: Utwory / Albumy i Okładki (Etap 6) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <button
                onClick={() => setLibrarySubView('tracks')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: librarySubView === 'tracks' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Music size={15} /> Utwory ({tracks.length})
              </button>
              <button
                onClick={() => setLibrarySubView('albums')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: librarySubView === 'albums' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Disc size={15} /> Albumy & Okładki ({albums.length})
              </button>
            </div>

            {/* Widok 1: Tabela utworów */}
            {librarySubView === 'tracks' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Łącznie: {tracks.length} utworów</span>
                  {tracks.length > 0 && (
                    <button
                      onClick={() => handlePlayAllTracks(tracks, 0)}
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
                      <Play size={14} /> Graj wszystkie w kolejce
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>#</th>
                        <th style={{ padding: '10px 12px' }}>Tytuł</th>
                        <th style={{ padding: '10px 12px' }}>Wykonawca</th>
                        <th style={{ padding: '10px 12px' }}>Format</th>
                        <th style={{ padding: '10px 12px' }}>Jakość</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Długość</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Biblioteka jest pusta. Kliknij 'Skanuj przyrostowo' powyżej.
                          </td>
                        </tr>
                      ) : (
                        tracks.map((t, idx) => (
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
                              {t.track_no || idx + 1}
                            </td>
                            <td style={{ padding: '12px', fontWeight: 600, color: activeTrackId === t.id ? 'var(--accent-pink)' : '#fff' }}>
                              {t.title}
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{t.artist}</td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  background: 'rgba(255,255,255,0.08)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {t.format}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              {Math.round(t.sample_rate / 1000)} kHz {t.bit_depth ? `/ ${t.bit_depth}-bit` : ''}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {formatTime(t.duration_ms)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePlayAllTracks(tracks, idx); }}
                                  title="Graj od tego utworu w kolejce"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Play size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleAddTrackToQueue(t, e)}
                                  title="Dodaj na koniec kolejki"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Plus size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleAddTrackNextToQueue(t, e)}
                                  title="Graj jako następny w kolejce"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <ListPlus size={15} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setTrackToAddToPlaylist(t); setShowPlaylistModal(true); }}
                                  title="Dodaj do playlisty..."
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <FolderPlus size={15} />
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {albums.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px' }}>
                    Brak zaindeksowanych albumów w bibliotece.
                  </p>
                ) : (
                  albums.map((album) => (
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
                      {/* Podgląd okładki */}
                      <div
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
                        }}
                      >
                        {!album.cover_path && <Disc size={48} color="rgba(255,255,255,0.25)" />}
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
                          title="Odtwórz cały album w kolejce"
                        >
                          <Play size={13} /> Graj
                        </button>
                        <button
                          onClick={() => handleOpenMbModal(album)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'var(--accent-purple)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Search size={13} /> MusicBrainz
                        </button>
                        <button
                          onClick={() => handleAutoFetchCover(album)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            color: 'var(--accent-cyan)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                          title="Automatyczne pobranie okładki z CAA jeśli wynik score >= 85"
                        >
                          Auto CAA
                        </button>
                      </div>
                    </div>
                  ))
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
                    Wyszukaj oficjalne wydanie albumu i pobierz okładkę wysokiej jakości z Cover Art Archive.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '16px' }}>
                    <input
                      type="text"
                      value={mbSearchTitle}
                      onChange={(e) => setMbSearchTitle(e.target.value)}
                      placeholder="Tytuł albumu"
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
                      placeholder="Wykonawca"
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
                      {isSearchingMb ? 'Szukanie...' : 'Szukaj'}
                    </button>
                  </div>

                  {/* Lista kandydatów */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mbCandidates.length === 0 && !isSearchingMb && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px' }}>
                        Kliknij 'Szukaj', aby odpytać serwer MusicBrainz API o kandydatów wydań.
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
                              {cand.score}% zgodności
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Wykonawca: {cand.artist} {cand.date ? `| Data: ${cand.date}` : ''} {cand.country ? `(${cand.country})` : ''} {cand.track_count ? `| Utworów: ${cand.track_count}` : ''}
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
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <CheckCircle size={14} />
                          {isFetchingCover ? 'Pobieranie...' : 'Wybierz & Pobierz Okładkę'}
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
                  <Sliders size={20} color="var(--accent-purple)" /> Studio DSP & Wymienne Silniki
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Niezależna modyfikacja wysokości dźwięku, tempa i prędkości w czasie rzeczywistym
                </p>
              </div>
              <button
                onClick={handleResetDsp}
                className="glass-card"
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <RotateCcw size={14} /> Resetuj DSP (1.0x / 0 st)
              </button>
            </div>

            {/* Wybór silnika DSP: SoundTouch vs Rubber Band */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: 600 }}>
                Wybór rdzenia DSP (Architektura ADR 0004):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>SoundTouch</span>
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
                    Niski narzut obliczeniowy, natywna integracja w potoku GStreamer. Zakres pitch: ±12 st, tempo: 0.5x – 2.0x.
                  </p>
                  {status.engine === 'SoundTouch' && (
                    <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
                      ● Aktywny silnik odtwarzacza
                    </div>
                  )}
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
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Rubber Band R3</span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(236, 72, 153, 0.2)',
                        color: 'var(--accent-pink)',
                      }}
                    >
                      AUDIOFILE R3
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Precyzyjny silnik R3, zachowanie formantów, czystość transjentów perkusji. Zakres pitch: ±24 st, tempo: 0.25x – 4.0x.
                  </p>
                  {status.engine === 'RubberBand' && (
                    <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--accent-pink)', fontWeight: 600 }}>
                      ● Aktywny silnik odtwarzacza
                    </div>
                  )}
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
              <span>
                Silnik: <strong style={{ color: 'var(--accent-cyan)' }}>{status.capabilities.name}</strong>
              </span>
              <span>
                Zakres Pitch:{' '}
                <strong style={{ color: 'var(--accent-pink)' }}>
                  {status.capabilities.min_pitch_semitones} do +{status.capabilities.max_pitch_semitones} st
                </strong>
              </span>
              <span>
                Zakres Tempo:{' '}
                <strong style={{ color: 'var(--accent-cyan)' }}>
                  {status.capabilities.min_tempo_ratio}x – {status.capabilities.max_tempo_ratio}x
                </strong>
              </span>
              <span>
                Formanty:{' '}
                <strong style={{ color: status.capabilities.supports_formants ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  {status.capabilities.supports_formants ? 'Wspierane' : 'Brak'}
                </strong>
              </span>
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
                Presety DSP (Zapis w bazie SQLite):
              </label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Nazwa presetu (np. Nightcore +3st, Chillout 0.85x)..."
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
                  }}
                >
                  <Save size={14} /> Zapisz preset
                </button>
              </div>

              {/* Lista zapisanych presetów */}
              {presets.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleLoadPreset(p)}
                      className="glass-card"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#fff',
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

            {/* Suwak Pitch Shift */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Wysokość dźwięku (Pitch Shift):</label>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-pink)', fontWeight: 600 }}>
                  {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st (
                  {Math.round(status.pitch_semitones * 100)} cents) | Współczynnik:{' '}
                  {(2 ** (status.pitch_semitones / 12)).toFixed(3)}x
                </span>
              </div>
              <input
                type="range"
                min={status.capabilities.min_pitch_semitones}
                max={status.capabilities.max_pitch_semitones}
                step={0.5}
                value={status.pitch_semitones}
                onChange={(e) => handlePitchChange(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[-12, -7, -2, 0, 2, 7, 12].map((st) => (
                  <button
                    key={st}
                    onClick={() => handlePitchChange(st)}
                    className="glass-card"
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: st === 0 ? 'var(--accent-cyan)' : '#fff',
                    }}
                  >
                    {st === 0 ? '0 st' : st > 0 ? `+${st}` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Suwak Tempo (Time Stretch) */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Tempo (Time Stretch bez zmiany wysokości):</label>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {status.tempo_ratio.toFixed(2)}x ({Math.round(status.tempo_ratio * 100)}%)
                </span>
              </div>
              <input
                type="range"
                min={status.capabilities.min_tempo_ratio}
                max={status.capabilities.max_tempo_ratio}
                step={0.05}
                value={status.tempo_ratio}
                onChange={(e) => handleTempoChange(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0.75, 1.0, 1.25, 1.5, 1.75].map((tr) => (
                  <button
                    key={tr}
                    onClick={() => handleTempoChange(tr)}
                    className="glass-card"
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: tr === 1.0 ? 'var(--accent-cyan)' : '#fff',
                    }}
                  >
                    {tr === 1.0 ? '1.0x (Normal)' : `${tr}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Suwak Szybkości (Rate - zmiana tempa i wysokości jednocześnie) */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  Szybkość (Rate - analogowa modulacja taśmy / winylu):
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600 }}>
                  {status.rate_ratio.toFixed(2)}x ({Math.round(status.rate_ratio * 100)}%)
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={status.rate_ratio}
                onChange={(e) => handleRateChange(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0.8, 0.9, 1.0, 1.1, 1.2].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRateChange(r)}
                    className="glass-card"
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: r === 1.0 ? 'var(--accent-amber)' : '#fff',
                    }}
                  >
                    {r === 1.0 ? '1.0x' : `${r}x`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ZAKŁADKA 4: PRO AUDIO & BLUETOOTH */}
        {activeTab === 'devices' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={20} color="var(--accent-green)" /> Karty PipeWire, Pro Audio & Kodeki Bluetooth
              </h2>
              <button
                onClick={refreshDevices}
                className="glass-card"
                style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.8rem' }}
              >
                <RefreshCw size={14} /> Odśwież
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
                    ID: {card.name} | Aktywny profil: {card.active_profile || 'brak'}
                  </p>

                  {/* Akcje Pro Audio */}
                  {card.profiles.some((p) => p.is_pro_audio) && (
                    <div style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => handleEnableProAudio(card.name)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: card.active_profile === 'pro-audio' ? 'var(--accent-green)' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {card.active_profile === 'pro-audio' ? '✓ Tryb Pro Audio aktywny' : 'Włącz Pro Audio (Bit-Perfect Direct ALSA)'}
                      </button>
                    </div>
                  )}

                  {/* Kodeki Bluetooth */}
                  {card.is_bluetooth && (
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Wybór kodeka Bluetooth (A2DP):
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
        )}

        {/* ZAKŁADKA 5: EKSPORT & TRANSKODOWANIE */}
        {activeTab === 'transcode' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileAudio size={20} color="var(--accent-pink)" /> Nieniszczący konwerter formatów (Opus, FLAC, WAV)
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
                <strong style={{ color: 'var(--accent-green)', fontSize: '0.85rem' }}>Gwarancja nienaruszalności plików:</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Aplikacja nigdy nie modyfikuje ani nie usuwa oryginalnego pliku z dysku. Konwersja tworzy nowy plik docelowy.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Plik źródłowy:
                </label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Ścieżka pliku wyjściowego:
                </label>
                <input
                  type="text"
                  value={transcodeOutput}
                  onChange={(e) => setTranscodeOutput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Format docelowy:
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
                      {fmt === 'Opus' ? 'Ogg Opus' : fmt === 'Flac' ? 'FLAC (Bezstratny)' : 'WAV PCM'}
                    </button>
                  ))}
                </div>
              </div>

              {transcodeFormat === 'Opus' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Bitrate Opus: <strong style={{ color: 'var(--accent-cyan)' }}>{transcodeBitrate} kbps</strong>
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
                Rozpocznij konwersję (GStreamer)
              </button>
            </div>
          </div>
        )}

        {/* Zakładka: Motywy Anime & Custom Backgrounds (Etap 5) */}
        {activeTab === 'themes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Palette size={26} color="var(--accent-purple)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Anime Theme Studio & Personalizacja Wizualna
                </h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Głęboka personalizacja bez utraty czytelności: wybieraj dopracowane presety anime,
                ustawiaj własne tapety z dynamicznym rozmyciem i nakładką przyciemniającą oraz
                eksportuj/importuj motywy w bezpiecznym formacie JSON (bez ryzyka kodu obcego).
              </p>
            </div>

            {/* Siatka presetów Anime */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {themes.map((t) => {
                const isActive = currentTheme?.id === t.id;
                return (
                  <div
                    key={t.id}
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
                        {t.name}
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
                          Aktywny
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t.attribution || 'Motyw wbudowany Auralune'}
                    </p>

                    {/* Próbnik kolorów tokenów */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <div
                        title={`Tło: ${t.tokens.bg_deep}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: t.tokens.bg_deep,
                          border: '1px solid var(--border-subtle)',
                        }}
                      />
                      <div
                        title={`Karta: ${t.tokens.bg_card}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: t.tokens.bg_card,
                          border: '1px solid var(--border-subtle)',
                        }}
                      />
                      <div
                        title={`Akcent Róż: ${t.tokens.accent_pink}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: t.tokens.accent_pink,
                        }}
                      />
                      <div
                        title={`Akcent Fiolet: ${t.tokens.accent_purple}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: t.tokens.accent_purple,
                        }}
                      />
                      <div
                        title={`Akcent Cyjan: ${t.tokens.accent_cyan}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: t.tokens.accent_cyan,
                        }}
                      />
                    </div>

                    <button
                      onClick={() => handleSelectTheme(t.id)}
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
                      {isActive ? 'Bieżący motyw' : 'Aktywuj motyw'}
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
                  Własna Tapeta Anime & Sterowanie Czytelnością
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Ścieżka do lokalnego pliku obrazu (PNG, JPG, WebP):
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        value={customBgPath}
                        onChange={(e) => setCustomBgPath(e.target.value)}
                        placeholder="/home/user/Obrazy/anime_wallpaper.png"
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
                        onClick={handleUploadBgImage}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '10px',
                          background: 'var(--accent-purple)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Upload size={16} />
                        Wczytaj
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
                          Własne tło aktywne
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Bezpiecznie załadowane w pamięci aplikacji
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
                        Usuń tło
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
                    Zapisz ustawienia tła w motywie
                  </button>
                </div>

                {/* Suwaki Overlay i Blur */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Nakładka przyciemniająca (Overlay Opacity):
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
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Gwarancja kontrastu: przyciemnia jasne ilustracje w tle, chroniąc czytelność tekstu.
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Promień rozmycia tła (Blur Radius):
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
                      Rozmywa tło za oknem odtwarzacza, eksponując stylizację cyber-glassmorphismu.
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
                  Przenośność Motywów (Bezpieczny format JSON)
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Eksport */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Eksport aktywnego motywu:
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
                      Generuj JSON
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={jsonExportContent}
                    placeholder="Kliknij 'Generuj JSON', aby wyeksportować bieżący motyw..."
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
                      {copiedJson ? 'Skopiowano do schowka!' : 'Kopiuj treść JSON'}
                    </button>
                  )}
                </div>

                {/* Import */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Import motywu z pliku JSON:
                  </label>
                  <textarea
                    value={jsonImportContent}
                    onChange={(e) => setJsonImportContent(e.target.value)}
                    placeholder='Wklej tutaj definicję motywu JSON (musi zawierać schema_version: 1)...'
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
                    Zweryfikuj i zaimportuj motyw
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ZAKŁADKA: PLAYLISTY (ETAP 7) */}
        {activeTab === 'playlists' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '960px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <ListMusic size={20} color="var(--accent-pink)" /> Twoje Playlisty ({playlists.length})
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Zarządzaj swoimi kompilacjami i odtwarzaj w kolejce z SQLite.
                </p>
              </div>

              {/* Nowa playlista input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Nazwa nowej playlisty..."
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
                  <Plus size={16} /> Dodaj
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
                      ← Powrót do listy playlist
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{selectedPlaylist.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {playlistTracks.length} utworów • Utworzono: {new Date(selectedPlaylist.created_at * 1000).toLocaleDateString()}
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
                      <Play size={16} /> Odtwórz playlistę
                    </button>
                    <button
                      onClick={() => handleDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)}
                      className="glass-card"
                      style={{ padding: '8px 14px', color: '#ff6b81', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Trash2 size={16} /> Usuń playlistę
                    </button>
                  </div>
                </div>

                {/* Tabela utworów w wybranej playliście */}
                {playlistTracks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Playlista jest pusta. Dodaj utwory z Biblioteki klikając przycisk "+" przy utworze.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 12px' }}>#</th>
                          <th style={{ padding: '10px 12px' }}>Tytuł</th>
                          <th style={{ padding: '10px 12px' }}>Wykonawca</th>
                          <th style={{ padding: '10px 12px' }}>Format</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Długość</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playlistTracks.map((t, idx) => (
                          <tr
                            key={`${t.id}-${idx}`}
                            className="glass-card"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                          >
                            <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '12px', fontWeight: 600 }}>{t.title}</td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{t.artist}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                                {t.format}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatTime(t.duration_ms)}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => handlePlayAllTracks(playlistTracks, idx)}
                                  title="Graj od tego miejsca"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer' }}
                                >
                                  <Play size={16} />
                                </button>
                                <button
                                  onClick={(e) => handleAddTrackToQueue(t, e)}
                                  title="Dodaj na koniec kolejki"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={(e) => handleRemoveTrackFromPlaylist(selectedPlaylist.id, t.id, e)}
                                  title="Usuń z playlisty"
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
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>Brak utworzonych playlist.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.7 }}>Wpisz nazwę u góry i kliknij "Dodaj", aby utworzyć nową playlistę.</p>
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
                            {pl.track_count} {pl.track_count === 1 ? 'utwór' : 'utworów'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Utworzono: {new Date(pl.created_at * 1000).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Otwórz playlistę →</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id, pl.name); }}
                          title="Usuń playlistę"
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
            background: 'rgba(15, 12, 28, 0.95)',
            backdropFilter: 'blur(20px)',
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
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Kolejka odtwarzania</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {queue.items.length} {queue.items.length === 1 ? 'utwór' : 'utworów'} • {queue.loop_mode !== 'None' ? `Pętla: ${queue.loop_mode}` : 'Brak pętli'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {queue.items.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  title="Wyczyść całą kolejkę"
                  className="glass-card"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#ff6b81', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={14} /> Wyczyść
                </button>
              )}
              <button
                onClick={() => setIsQueueOpen(false)}
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
                <p style={{ fontSize: '0.9rem', margin: 0 }}>Kolejka jest pusta</p>
                <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.7 }}>
                  Dodaj utwory z biblioteki lub wybierz playlistę
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
                        title="Przesuń wyżej"
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
                        title="Przesuń niżej"
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
                        title="Usuń z kolejki"
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
                <FolderPlus size={18} color="var(--accent-purple)" /> Dodaj do playlisty
              </h3>
              <button
                onClick={() => { setShowPlaylistModal(false); setTrackToAddToPlaylist(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Wybierz playlistę dla utworu: <strong style={{ color: 'var(--accent-pink)' }}>{trackToAddToPlaylist.title}</strong>
            </p>

            {playlists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Brak utworzonych playlist. Najpierw utwórz playlistę w zakładce Playlisty.
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pl.track_count} utworów</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
