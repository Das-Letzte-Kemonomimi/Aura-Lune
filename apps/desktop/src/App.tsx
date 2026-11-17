import { usePlaylistManager } from './hooks/usePlaylistManager';
import { useTranscodeManager } from './hooks/useTranscodeManager';
import { useHotkeysManager } from './hooks/useHotkeysManager';
import { AppSettingsModal } from './views/settings/AppSettingsModal';
import { AppModalsContainer } from './components/modals/AppModalsContainer';
import { PlaylistsView } from './views/PlaylistsView';
import { DspStudioView } from './views/DspStudioView';
import { LibraryView } from './views/LibraryView';
import { PlayerView } from './views/PlayerView';
import { AppHeader } from './components/layout/AppHeader';
import { BottomPlaybackDock } from './components/layout/BottomPlaybackDock';
import { BackgroundLayer } from './components/layout/BackgroundLayer';
import { DragDropOverlay } from './components/layout/DragDropOverlay';
import { QueueDrawer } from './components/layout/QueueDrawer';
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { Loader2 } from 'lucide-react';
import { type TapeType } from './components/TapeDeckWidget';
import { evaluateHarmonicMatch, getTransposedKey } from './utils/harmonicMixing';
import { MiniPlayerWidget } from './components/MiniPlayerWidget';
import { AnimeAmbienceFX, type AmbienceMode } from './components/AnimeAmbienceFX';
import { BigScreenView } from './components/BigScreenView';
import { type TrackStatsData } from './components/TrackStatsModal';
import { formatTimeMs } from './components/LoopEditorModal';
import { VolumeOsd, type VolumeOsdPosition } from './components/VolumeOsd';
import { StemProjectsLibraryView } from './components/StemProjectsLibraryView';
import { type TrackBookmarkDto } from './components/TrackBookmarksModal';
import { RadioView } from './components/RadioView';
import { soundscapeEngine } from './utils/soundscapeAudio';
import { vinylSimulator } from './utils/vinylSimulator';
import { useVirtualScroll } from './hooks/useVirtualScroll';
import { type Language, type Translations, getTranslations } from './i18n';
import { type EqualizerPreset } from './types/equalizer';
import {
  type QueueItem,
  type PlaybackQueue,
  type QueueColumnConfig,
  DEFAULT_QUEUE_COLUMNS,
} from './types/queue';



interface ReleaseCandidateDto {
  mbid: string;
  title: string;
  artist: string;
  date: string | null;
  country: string | null;
  track_count: number | null;
  score: number;
}

import { type Theme } from './types/theme';


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

export type AlbumPlaybackBehavior = 'replace' | 'append' | 'single';


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
  stop_after_current?: boolean;
  current_track?: QueueItem | null;
  equalizer_enabled?: boolean;
  equalizer_bands?: number[];
  parametric_eq_enabled?: boolean;
  compressor_enabled?: boolean;
  saturator_enabled?: boolean;
  limiter_enabled?: boolean;
  spectrum?: number[];
  replaygain_config?: {
    mode: 'Off' | 'Track' | 'Album';
    pre_amp_db: number;
  };
  replaygain_status?: [number, number, boolean];
  live_stream_title?: string | null;
  is_stems_active?: boolean;
  active_stem_project_id?: number | null;
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
  replaygain_track_gain?: number | null;
  replaygain_track_peak?: number | null;
  rating?: number | null;
  bpm?: number | null;
  initial_key?: string | null;
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

interface SampleTrackDto {
  path: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number;
  genre: string | null;
}

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

  // Procent postępu odtwarzania oraz głośności dla dynamicznego wypełnienia suwaków (anime aesthetic)
  const seekProgressPercent = status.duration_ms && status.duration_ms > 0
    ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
    : 0;
  const volumeProgressPercent = Math.min(100, Math.max(0, (status.volume ?? 1) * 100));

  // Język interfejsu (domyślnie angielski: en, z opcją wyboru: pl, de, fi, la)
  const [language, setLanguage] = useState<Language>('en');
  const loc = getTranslations(language);
  const t = loc;

  // Stan okna dialogowego Cover Art Picker
  const [coverPickerState, setCoverPickerState] = useState<{
    isOpen: boolean;
    albumId: number;
    title: string;
    artist: string;
  } | null>(null);


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
        setTrackDirectCover(coverDataUri);
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
  const [isEqPresetMenuOpen, setIsEqPresetMenuOpen] = useState<boolean>(false);
  const getEqPresetDisplayName = (name: string, locOrIsPl?: Translations | boolean) => {
    const l = (locOrIsPl && typeof locOrIsPl === 'object' && 'dsp' in locOrIsPl)
      ? (locOrIsPl as Translations)
      : loc;
    switch (name) {
      case 'Flat':
      case 'Płaski (Flat)':
        return l.dsp.presetFlat;
      case 'Bass Boost':
      case 'Mocny Bass (Bass Boost)':
        return l.dsp.presetBassBoost;
      case 'Electronic / Dance':
      case 'Elektroniczna / Dance':
        return l.dsp.presetElectronic;
      case 'Classical / Acoustic':
      case 'Klasyczna / Akustyczna':
        return l.dsp.presetAcoustic;
      case 'Custom':
      case 'Własny (Custom)':
        return l.dsp.presetCustom;
      default:
        return name;
    }
  };
  const [eqAutoStartup, setEqAutoStartup] = useState<boolean>(false);
  const [seekFadeEnabled, setSeekFadeEnabled] = useState<boolean>(true);

  // Stan normalizacji głośności ReplayGain 2.0 / EBU R128 (z trybem Auto i True-Peak Limiterem)
  const [replaygainMode, setReplaygainMode] = useState<'Off' | 'Track' | 'Album' | 'Auto'>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_mode');
      if (saved === 'Off' || saved === 'Track' || saved === 'Album' || saved === 'Auto') return saved;
    } catch (_) { }
    return 'Off';
  });
  const [replaygainPreAmp, setReplaygainPreAmp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_preamp');
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val)) return val;
      }
    } catch (_) { }
    return 0.0;
  });
  const [replaygainFallbackGain, setReplaygainFallbackGain] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_fallback');
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val)) return val;
      }
    } catch (_) { }
    return -6.0;
  });
  const [replaygainPreventClipping, setReplaygainPreventClipping] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_prevent_clipping');
      if (saved !== null) return saved === 'true';
    } catch (_) { }
    return true;
  });
  const [replaygainStatus, setReplaygainStatus] = useState<[number, number, boolean]>([0.0, 0.0, true]);

  const handleSetReplayGain = async (
    mode: 'Off' | 'Track' | 'Album' | 'Auto',
    preAmp: number,
    fallbackGain = replaygainFallbackGain,
    preventClipping = replaygainPreventClipping
  ) => {
    try {
      await invoke('set_replaygain_config', {
        config: {
          mode,
          pre_amp_db: preAmp,
          fallback_gain_db: fallbackGain,
          prevent_clipping: preventClipping,
        },
      });
      setReplaygainMode(mode);
      setReplaygainPreAmp(preAmp);
      setReplaygainFallbackGain(fallbackGain);
      setReplaygainPreventClipping(preventClipping);
      try {
        localStorage.setItem('auralune_replaygain_mode', mode);
        localStorage.setItem('auralune_replaygain_preamp', preAmp.toString());
        localStorage.setItem('auralune_replaygain_fallback', fallbackGain.toString());
        localStorage.setItem('auralune_replaygain_prevent_clipping', preventClipping.toString());
      } catch (_) { }
    } catch (e: any) {
      console.error('Błąd aktualizacji ReplayGain:', e);
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Stan filtra Bauer stereophonic-to-binaural (Crossfeed bs2b)
  const [crossfeedEnabled, setCrossfeedEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_crossfeed_enabled') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [crossfeedPreset, setCrossfeedPreset] = useState<'Default' | 'ChuMoy' | 'JanMeier' | 'Custom'>(() => {
    try {
      const saved = localStorage.getItem('auralune_crossfeed_preset');
      if (saved === 'Default' || saved === 'ChuMoy' || saved === 'JanMeier' || saved === 'Custom') return saved;
    } catch (_) { }
    return 'Default';
  });
  const [crossfeedFcut, setCrossfeedFcut] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_crossfeed_fcut');
      if (saved) return parseInt(saved, 10) || 700;
    } catch (_) { }
    return 700;
  });
  const [crossfeedFeed, setCrossfeedFeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_crossfeed_feed');
      if (saved) return parseInt(saved, 10) || 45;
    } catch (_) { }
    return 45;
  });

  const handleSetCrossfeed = async (
    enabled: boolean,
    preset: 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom',
    fcut = crossfeedFcut,
    feed = crossfeedFeed
  ) => {
    let targetFcut = fcut;
    let targetFeed = feed;
    if (preset === 'Default') {
      targetFcut = 700;
      targetFeed = 45;
    } else if (preset === 'ChuMoy') {
      targetFcut = 700;
      targetFeed = 60;
    } else if (preset === 'JanMeier') {
      targetFcut = 650;
      targetFeed = 90;
    }
    try {
      await invoke('set_crossfeed_config', {
        config: {
          enabled,
          preset,
          fcut_hz: targetFcut,
          feed_tenth_db: targetFeed,
        },
      });
      setCrossfeedEnabled(enabled);
      setCrossfeedPreset(preset);
      setCrossfeedFcut(targetFcut);
      setCrossfeedFeed(targetFeed);
      try {
        localStorage.setItem('auralune_crossfeed_enabled', enabled.toString());
        localStorage.setItem('auralune_crossfeed_preset', preset);
        localStorage.setItem('auralune_crossfeed_fcut', targetFcut.toString());
        localStorage.setItem('auralune_crossfeed_feed', targetFeed.toString());
      } catch (_) { }
      showMessage(
        enabled
          ? t.notifications.crossfeedOn.replace('{0}', `${preset} (${targetFcut}Hz / ${(targetFeed / 10).toFixed(1)}dB)`)
          : t.notifications.crossfeedOff
      );
    } catch (e: any) {
      console.error('Błąd aktualizacji Crossfeed:', e);
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Stan automatycznego pomijania ciszy (Silence Trimming)
  const [silenceTrimmingEnabled, setSilenceTrimmingEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_silence_trimming_enabled') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [silenceTrimmingThreshold, setSilenceTrimmingThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_silence_trimming_threshold');
      if (saved) return parseFloat(saved) || -50.0;
    } catch (_) { }
    return -50.0;
  });

  const handleSetSilenceTrimming = async (enabled: boolean, threshold: number) => {
    try {
      await invoke('set_silence_trimming_config', {
        config: {
          enabled,
          threshold_db: threshold,
        },
      });
      setSilenceTrimmingEnabled(enabled);
      setSilenceTrimmingThreshold(threshold);
      try {
        localStorage.setItem('auralune_silence_trimming_enabled', enabled.toString());
        localStorage.setItem('auralune_silence_trimming_threshold', threshold.toString());
      } catch (_) { }
    } catch (e: any) {
      console.error('Błąd aktualizacji Silence Trimming:', e);
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Stan skanera głośności EBU R128 / ReplayGain
  const [isReplaygainScanning, setIsReplaygainScanning] = useState(false);
  const [replaygainScanWriteTags, setReplaygainScanWriteTags] = useState(false);

  const handleScanLibraryReplayGain = async () => {
    if (isReplaygainScanning) return;
    setIsReplaygainScanning(true);
    showMessage(loc.settings.scanReplayGainScanning);
    try {
      const summary = await invoke<{ total_tracks: number; scanned: number; errors: number }>(
        'scan_library_replaygain',
        { writeTags: replaygainScanWriteTags }
      );
      showMessage(
        `${loc.settings.scanReplayGainComplete} (${summary.scanned}/${summary.total_tracks})`
      );
      loadLibrary();
    } catch (e: any) {
      console.error('Błąd skanowania ReplayGain:', e);
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    } finally {
      setIsReplaygainScanning(false);
    }
  };

  const handleScanTrackReplayGain = async (track: TrackRecord) => {
    try {
      showMessage(`${loc.settings.scanReplayGainScanning} (${track.title})`);
      const res = await invoke<{
        track_gain_db: number;
        track_peak: number;
        reference_level_db: number;
      }>('scan_track_replaygain', {
        trackId: track.id,
        writeTags: replaygainScanWriteTags,
      });
      showMessage(
        `${track.title}: Gain ${res.track_gain_db >= 0 ? '+' : ''}${res.track_gain_db.toFixed(1)} dB, Peak ${res.track_peak.toFixed(3)}`
      );
      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id
            ? {
              ...t,
              replaygain_track_gain: res.track_gain_db,
              replaygain_track_peak: res.track_peak,
            }
            : t
        )
      );
    } catch (e: any) {
      console.error('Błąd analizy ReplayGain dla utworu:', e);
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Stan zapamiętywania ustawień DSP po uruchomieniu aplikacji
  const [dspAutoStartup, setDspAutoStartup] = useState<boolean>(false);
  const [dspDefaultEngine, setDspDefaultEngine] = useState<'Bypass' | 'RubberBand' | 'SoundTouch'>('Bypass');
  const [audioBufferMs, setAudioBufferMs] = useState<number>(600);
  const [dspBlockSize, setDspBlockSize] = useState<number>(2048);
  const [isDspQuickMenuOpen, setIsDspQuickMenuOpen] = useState<boolean>(false);
  const dspAutoStartupRef = useRef<boolean>(false);
  const lastActiveDspEngineRef = useRef<'RubberBand' | 'SoundTouch'>('RubberBand');
  const dspSaveTimeoutRef = useRef<any>(null);

  const [cards, setCards] = useState<AudioCard[]>([]);

  // Stan trybu wizualnego w sekcji Now Playing: okładka, winyl hi-fi, szpulowiec/kaseta lub analogowy miernik VU
  const [nowPlayingVisualMode, setNowPlayingVisualMode] = useState<'cover' | 'turntable' | 'tape' | 'vumeter'>(() => {
    try {
      const saved = localStorage.getItem('auralune_nowplaying_visual_mode');
      if (saved === 'cover' || saved === 'turntable' || saved === 'tape' || saved === 'vumeter') return saved;
    } catch (_) { }
    return 'cover';
  });

  const handleSelectNowPlayingVisualMode = (mode: 'cover' | 'turntable' | 'tape' | 'vumeter') => {
    setNowPlayingVisualMode(mode);
    try {
      localStorage.setItem('auralune_nowplaying_visual_mode', mode);
    } catch (_) { }
  };

  // Stan parametrów wizualnych: RPM winylu, prędkość taśmy, typ taśmy
  const [vinylRpm, setVinylRpm] = useState<33 | 45>(() => {
    try {
      const saved = localStorage.getItem('auralune_vinyl_rpm');
      if (saved === '33' || saved === '45') return Number(saved) as 33 | 45;
    } catch (_) { }
    return 33;
  });

  const handleSelectVinylRpm = (rpm: 33 | 45) => {
    setVinylRpm(rpm);
    try {
      localStorage.setItem('auralune_vinyl_rpm', String(rpm));
    } catch (_) { }
  };

  const [tapeSpeed, setTapeSpeed] = useState<'7.5' | '3.75'>(() => {
    try {
      const saved = localStorage.getItem('auralune_tape_speed');
      if (saved === '7.5' || saved === '3.75') return saved;
    } catch (_) { }
    return '7.5';
  });

  const handleSelectTapeSpeed = (speed: '7.5' | '3.75') => {
    setTapeSpeed(speed);
    try {
      localStorage.setItem('auralune_tape_speed', speed);
    } catch (_) { }
  };

  const [tapeType, setTapeType] = useState<TapeType>(() => {
    try {
      const saved = localStorage.getItem('auralune_tape_type');
      if (saved === 'TYPE_I' || saved === 'TYPE_II' || saved === 'METAL') return saved;
    } catch (_) { }
    return 'TYPE_II';
  });

  const handleSelectTapeType = (type: TapeType) => {
    setTapeType(type);
    try {
      localStorage.setItem('auralune_tape_type', type);
    } catch (_) { }
  };

  // Stan inteligentnego Auto-DJ / Infinity Queue
  const [infinityQueue, setInfinityQueue] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_infinity_queue') === 'true';
    } catch (_) {
      return false;
    }
  });
  const autoDjBusyRef = useRef<boolean>(false);
  const lastAutoDjTrackIdRef = useRef<number | null>(null);

  const handleToggleInfinityQueue = () => {
    const next = !infinityQueue;
    setInfinityQueue(next);
    try {
      localStorage.setItem('auralune_infinity_queue', next ? 'true' : 'false');
    } catch (_) { }
    showMessage(
      next
        ? t.notifications.infinityQueueActive
        : t.notifications.infinityQueueDisabled
    );
  };
  const [activeTab, setActiveTab] = useState<'player' | 'library' | 'playlists' | 'stem-projects' | 'radio' | 'dsp' | 'stats' | 'devices' | 'transcode' | 'themes'>('player');
  const [isSaveQueueModalOpen, setIsSaveQueueModalOpen] = useState(false);

  // Radio state
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'themes' | 'devices' | 'transcode' | 'about' | 'changelog' | 'backup'>('themes');
  const [closeToTray, setCloseToTray] = useState<boolean>(true);
  const [showDownloadHub, setShowDownloadHub] = useState<boolean>(false);

  // Skala interfejsu użytkownika i szerokość robocza układu (UI Scale & Layout Width)
  const [uiScale, setUiScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_ui_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.45) {
          return parsed;
        }
      }
    } catch { }
    return 1.0;
  });

  useEffect(() => {
    try {
      document.documentElement.style.zoom = String(uiScale);
      document.documentElement.style.setProperty('--ui-scale', String(uiScale));
      localStorage.setItem('auralune_ui_scale', String(uiScale));
    } catch (e) {
      console.warn('Błąd aplikacji skali interfejsu:', e);
    }
  }, [uiScale]);

  const layoutMaxWidth = useMemo(() => {
    if (uiScale >= 1.28) return 'min(2350px, 98.5vw)';
    if (uiScale >= 1.18) return 'min(2050px, 98vw)';
    if (uiScale >= 1.08) return 'min(1780px, 96.5vw)';
    return 'min(1500px, 95vw)';
  }, [uiScale]);

  const handleSelectScale = (scale: number) => {
    setUiScale(scale);
    const label =
      scale >= 1.28
        ? t.notifications.scale130
        : scale >= 1.18
          ? t.notifications.scale120
          : scale >= 1.08
            ? t.notifications.scale110
            : t.notifications.scale100;
    showMessage(t.notifications.scaleLabel.replace('{0}', label));
  };

  const handleIncreaseScale = () => {
    setUiScale((prev) => {
      let next = 1.0;
      if (prev < 1.08) next = 1.10;
      else if (prev < 1.18) next = 1.20;
      else if (prev < 1.28) next = 1.30;
      else next = 1.0;
      const label =
        next >= 1.28
          ? t.notifications.scale130
          : next >= 1.18
            ? t.notifications.scale120
            : t.notifications.scale110;
      showMessage(t.notifications.scaleLabel.replace('{0}', label));
      return next;
    });
  };

  const handleDecreaseScale = () => {
    setUiScale((prev) => {
      let next = 1.0;
      if (prev > 1.25) next = 1.20;
      else if (prev > 1.15) next = 1.10;
      else next = 1.0;
      const label =
        next >= 1.18
          ? t.notifications.scale120
          : next >= 1.08
            ? t.notifications.scale110
            : t.notifications.scale100;
      showMessage(t.notifications.scaleLabel.replace('{0}', label));
      return next;
    });
  };

  const handleResetScale = () => {
    handleSelectScale(1.0);
  };

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


  // Discord Rich Presence (RPC)
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState<boolean>(true);
  const [discordRpcConnected, setDiscordRpcConnected] = useState<boolean>(false);
  const [discordClientId, setDiscordClientId] = useState<string>('1563876157387186226');
  const [isEditingDiscordClientId, setIsEditingDiscordClientId] = useState<boolean>(false);


  // ListenBrainz Scrobbler
  const [listenbrainzToken, setListenbrainzToken] = useState<string>('');
  const [listenbrainzEnabled, setListenbrainzEnabled] = useState<boolean>(false);
  const [listenbrainzUser, setListenbrainzUser] = useState<string | null>(null);
  const [listenbrainzTesting, setListenbrainzTesting] = useState<boolean>(false);
  const [listenbrainzStatusMsg, setListenbrainzStatusMsg] = useState<string | null>(null);
  const [scrobbledTrackId, setScrobbledTrackId] = useState<number | null>(null);

  // Last.fm Scrobbler (Official 2.0 API)
  const [lastfmSessionKey, setLastfmSessionKey] = useState<string>('');
  const [lastfmUsername, setLastfmUsername] = useState<string | null>(null);
  const [lastfmEnabled, setLastfmEnabled] = useState<boolean>(false);
  const [lastfmTesting, setLastfmTesting] = useState<boolean>(false);
  const [lastfmStatusMsg, setLastfmStatusMsg] = useState<string | null>(null);
  const [lastfmPendingToken, setLastfmPendingToken] = useState<string | null>(null);
  const [lastfmCustomKey, setLastfmCustomKey] = useState<string>('');
  const [lastfmCustomSecret, setLastfmCustomSecret] = useState<string>('');
  const [lastfmScrobbledTrackId, setLastfmScrobbledTrackId] = useState<number | null>(null);

  // Płynny Crossfade & Zaawansowane efekty DSP (Poweramp)
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(1500);
  const [bassBoost, setBassBoost] = useState<number>(0);
  const lastBassBoostRef = useRef<number>(6.0);
  const [stereoWidenerActive, setStereoWidenerActive] = useState<boolean>(false);
  const [stereoWidenerAmount, setStereoWidenerAmount] = useState<number>(0.15);
  const [limiterEnabled, setLimiterEnabled] = useState<boolean>(true);

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
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
  const [analysisInitialTab, _setAnalysisInitialTab] = useState<'chords' | 'pianoroll' | 'stems' | 'projects' | 'models'>('chords');
  const [activeStemProjectId, setActiveStemProjectId] = useState<number | null>(null);
  const [isStemStudioOpen, setIsStemStudioOpen] = useState<boolean>(false);
  const [isCreateStemProjectOpen, setIsCreateStemProjectOpen] = useState<boolean>(false);
  const [createStemProjectTrack, setCreateStemProjectTrack] = useState<TrackRecord | null>(null);
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

  // Opcja ukrywania duplikatów utworów w bibliotece
  const [hideDuplicates, setHideDuplicates] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_hide_duplicates') === 'true';
    } catch {
      return false;
    }
  });
  // Format wyświetlania głośności: 'percent' (0% - 100%) vs 'db' (-inf do 0.0 dB)
  const [volumeUnit, setVolumeUnit] = useState<'percent' | 'db'>(() => {
    try {
      const saved = localStorage.getItem('auralune_volume_unit');
      return saved === 'db' ? 'db' : 'percent';
    } catch {
      return 'percent';
    }
  });

  const handleSetVolumeUnit = (unit: 'percent' | 'db') => {
    setVolumeUnit(unit);
    try {
      localStorage.setItem('auralune_volume_unit', unit);
    } catch { }
    showMessage(
      t.notifications.volumeUnitChanged.replace('{0}', unit === 'db' ? t.notifications.volumeUnitDb : t.notifications.volumeUnitPercent)
    );
  };

  const handleToggleVolumeUnit = () => {
    handleSetVolumeUnit(volumeUnit === 'percent' ? 'db' : 'percent');
  };

  // Opcja zapamiętywania sesji odtwarzania przy ponownym uruchomieniu (utwór, pozycja, głośność dB, DSP, kolejka)
  const [restoreSessionOnStartup, setRestoreSessionOnStartup] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_restore_session_on_startup');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleRestoreSessionOnStartup = async () => {
    const next = !restoreSessionOnStartup;
    setRestoreSessionOnStartup(next);
    try {
      localStorage.setItem('auralune_restore_session_on_startup', String(next));
    } catch { }
    try {
      await invoke('set_app_setting', {
        key: 'restore_session_on_startup',
        value: next ? 'true' : 'false',
      });
      showMessage(
        next
          ? t.notifications.restoreSessionMsgOn
          : t.notifications.restoreSessionMsgOff
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const formatVolumeValue = (vol: number, unit: 'percent' | 'db' = volumeUnit): string => {
    if (unit === 'db') {
      if (vol <= 0.0001) return '-∞ dB';
      const db = 20 * Math.log10(vol);
      return `${db >= 0 ? '0.0' : db.toFixed(1)} dB`;
    }
    return `${Math.round(vol * 100)}%`;
  };

  // Reverb DSP State
  const [reverbEnabled, setReverbEnabled] = useState<boolean>(false);
  const [reverbRoomSize, setReverbRoomSize] = useState<number>(0.65);
  const [reverbDamping, setReverbDamping] = useState<number>(0.25);
  const [reverbWidth, setReverbWidth] = useState<number>(1.0);
  const [reverbLevel, setReverbLevel] = useState<number>(0.35);

  // Stan ręcznego wpisywania wartości DSP (Pitch, Tempo, Speed)

  // Stan Wyłącznika Czasowego (Sleep Timer)
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isAudioPathModalOpen, setIsAudioPathModalOpen] = useState(false);
  const [isLoFiModalOpen, setIsLoFiModalOpen] = useState(false);
  const [isHealthCheckModalOpen, setIsHealthCheckModalOpen] = useState(false);
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);
  const [sleepTimerTargetMode, setSleepTimerTargetMode] = useState<'time' | 'end_of_track' | null>(null);
  const [sleepTimerFadeOut, setSleepTimerFadeOut] = useState(true);
  const preFadeVolumeRef = useRef<number | null>(null);
  const lastTrackUriRef = useRef<string | null>(null);
  const initialStartupPositionRef = useRef<number | null>(null);

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

  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [trackDirectCover, setTrackDirectCover] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);

  const showMessage = (msg: string, isError = false) => {
    // Wyświetlaj komunikat tylko przy rzeczywistych błędach (brak natrętnych powiadomień na górze przy każdej akcji)
    if (!isError) return;
    setInfoMessage(`⚠️ ${msg}`);
    setTimeout(() => setInfoMessage(null), 4000);
  };

  // ZARZĄDZANIE PLAYLISTAMI & RADIEM
  // ============================================
  const {
    playlists,
    selectedPlaylist,
    setSelectedPlaylist,
    playlistTracks,
    setPlaylistTracks,
    newPlaylistName,
    setNewPlaylistName,
    showPlaylistModal,
    setShowPlaylistModal,
    trackToAddToPlaylist,
    setTrackToAddToPlaylist,
    customRadioStations,
    currentRadioStation,
    refreshPlaylists,
    handlePlayRadioStation,
    handleSaveCustomStation,
    handleDeleteCustomStation,
    handleCreatePlaylist,
    handleDeletePlaylist,
    handleOpenPlaylist,
    handleAddTrackToPlaylist,
    handleRemoveTrackFromPlaylist,
    handleExportPlaylistM3u8,
    handleImportPlaylistM3u8,
  } = usePlaylistManager({
    language,
    loc,
    t: loc,
    showMessage,
    initialStartupPositionRef,
    setTrackDirectCover,
    setActiveTrackId,
  });

  // Stan motywów Anime (Etap 5)
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [themeOverlay, setThemeOverlay] = useState<number>(0.4);
  const [themeBlur, setThemeBlur] = useState<number>(8.0);
  const [themeBgImage, setThemeBgImage] = useState<string | null>(null);
  const [customBgPath, setCustomBgPath] = useState<string>('');
  const [jsonExportContent, setJsonExportContent] = useState<string>('');
  const [jsonImportContent, setJsonImportContent] = useState<string>('');

  // Styl ikony aplikacji (Neon Lineout vs Classic Anime)
  const [appIconStyle, setAppIconStyle] = useState<'lineout' | 'classic'>('lineout');

  // Stan biblioteki
  const [scanFolder, setScanFolder] = useState('tests/fixtures');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummaryDto | null>(null);
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
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
    } catch (_) { }
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
  const [currentTrackBookmarks, setCurrentTrackBookmarks] = useState<TrackBookmarkDto[]>([]);
  const [isBookmarksModalOpen, setIsBookmarksModalOpen] = useState(false);

  // foobar2000 Power Tools (Duplikaty, Masowy renamer, Filtry fasetowe)
  const [isDuplicateFinderOpen, setIsDuplicateFinderOpen] = useState(false);
  const [isFileRenamerOpen, setIsFileRenamerOpen] = useState(false);
  const [isFacetsFilterEnabled, setIsFacetsFilterEnabled] = useState(false);
  const [facetSelectedFormat, setFacetSelectedFormat] = useState<string | null>(null);
  const [facetSelectedArtist, setFacetSelectedArtist] = useState<string | null>(null);
  const [facetSelectedAlbumId, setFacetSelectedAlbumId] = useState<number | null>(null);

  // Dynamiczna wersja aplikacji (z package.json / Cargo.toml)
  const [appVersion, setAppVersion] = useState<string>(
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.3'
  );


  // Stan okna skrótów klawiszowych
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Stan wyszukiwarki w kolejce
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const lastNonZeroVolRef = useRef<number>(1.0);

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
  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() => {
    try {
      const saved = localStorage.getItem('auralune_ambience_mode');
      if (
        saved === 'sakura' ||
        saved === 'neon_rain' ||
        saved === 'fireflies' ||
        saved === 'snow' ||
        saved === 'meteor_shower' ||
        saved === 'matrix_rain' ||
        saved === 'momiji' ||
        saved === 'embers' ||
        saved === 'off'
      ) {
        return saved as AmbienceMode;
      }
    } catch (_) { }
    return 'off';
  });

  const cycleAmbienceMode = () => {
    setAmbienceMode((prev) => {
      const next: AmbienceMode =
        prev === 'off'
          ? 'sakura'
          : prev === 'sakura'
            ? 'neon_rain'
            : prev === 'neon_rain'
              ? 'fireflies'
              : prev === 'fireflies'
                ? 'snow'
                : prev === 'snow'
                  ? 'meteor_shower'
                  : prev === 'meteor_shower'
                    ? 'matrix_rain'
                    : prev === 'matrix_rain'
                      ? 'momiji'
                      : prev === 'momiji'
                        ? 'embers'
                        : 'off';
      try {
        localStorage.setItem('auralune_ambience_mode', next);
      } catch (_) { }
      showMessage(
        next === 'sakura'
          ? t.notifications.ambienceSakura
          : next === 'neon_rain'
            ? t.notifications.ambienceNeon
            : next === 'fireflies'
              ? t.notifications.ambienceFireflies
              : next === 'snow'
                ? t.notifications.ambienceSnow
                : next === 'meteor_shower'
                  ? t.notifications.ambienceMeteor
                  : next === 'matrix_rain'
                    ? t.notifications.ambienceMatrix
                    : next === 'momiji'
                      ? t.notifications.ambienceMomiji
                      : next === 'embers'
                        ? t.notifications.ambienceGothicEmbers
                        : t.notifications.ambienceOff
      );
      try {
        soundscapeEngine.syncWithVisualAmbience(next);
      } catch (_) { }
      return next;
    });
  };

  // Stan modala Generatora Dźwięków Tła (Soundscape / Lofi Ambience)
  const [isSoundscapeOpen, setIsSoundscapeOpen] = useState(false);

  // Stan modala Miksowania Harmonicznego & DJ Crossfade
  const [isHarmonicSuggesterOpen, setIsHarmonicSuggesterOpen] = useState(false);

  // Stan modala Bazy Profili Słuchawkowych AutoEQ
  const [isAutoEqOpen, setIsAutoEqOpen] = useState(false);

  // Stan modala Wielopasmowego Korektora Parametrycznego (PEQ Studio)
  const [isParametricEqOpen, setIsParametricEqOpen] = useState(false);

  // Stan modala Studia Dynamiki & Nasycenia Analogowego (Kompresor, Lampa, Taśma, Limiter)
  const [isDynamicsStudioOpen, setIsDynamicsStudioOpen] = useState(false);

  // Stan trybu pełnoekranowego Kiosk / Big Screen Now Playing
  const [isBigScreen, setIsBigScreen] = useState(false);

  // Filtr inteligentnych playlist w Bibliotece (Ulubione, Historia, Top, Hi-Res, Zapomniane, High BPM, Ocenione)
  const [smartPlaylistFilter, setSmartPlaylistFilter] = useState<
    'all' | 'favorites' | 'history' | 'top_played' | 'hires' | 'forgotten' | 'high_bpm' | 'top_rated'
  >('all');

  // Modal edytora tagów (foobar2000 style Properties)
  const [tagEditorTrack, setTagEditorTrack] = useState<TrackRecord | null>(null);

  // Modal palety komend (Ctrl+K omnibar)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Modal importera audio z URL (yt-dlp)
  const [isUrlImportModalOpen, setIsUrlImportModalOpen] = useState(false);

  // Modal arkusza CUE (.cue sheet)
  const [isCueModalOpen, setIsCueModalOpen] = useState(false);

  // Powiadomienia systemowe Linuksa (libnotify / D-Bus)
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_desktop_notifications');
      return saved !== 'false';
    } catch (_) {
      return true;
    }
  });

  // Ustawienie oceny gwiazdkowej (0-5)
  const handleSetTrackRating = async (trackId: number, rating: number) => {
    try {
      await invoke('set_track_rating', { trackId, rating });
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, rating } : t))
      );
    } catch (err: any) {
      console.error('Błąd zapisu oceny utworu:', err);
    }
  };

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
      } catch (_) { }
      return updated;
    });
  };

  const resetQueueColumns = () => {
    setQueueColumns(DEFAULT_QUEUE_COLUMNS);
    try {
      localStorage.setItem('auralune_queue_columns', JSON.stringify(DEFAULT_QUEUE_COLUMNS));
    } catch (_) { }
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


  // Stan wyszukiwania i filtrów biblioteki
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFormatFilter, setLibraryFormatFilter] = useState<'all' | 'flac' | 'mp3' | 'opus' | 'wav' | 'lossless'>('all');
  const [isScanFolderOpen, setIsScanFolderOpen] = useState(false);

  // Filtrowane listy dla widoku biblioteki z obsługą bezpiecznych pól, akcentów i dodatkowych metadanych
  const filteredTracks = useMemo(() => {
    const rawQ = librarySearch.trim();
    const q = normalizeStr(rawQ);
    const seenTrackKeys = new Set<string>();

    return tracks.filter((t) => {
      // Filtr powtarzających się duplikatów utworów
      if (hideDuplicates) {
        const normTitle = (t.title || '').trim().toLowerCase();
        const normArtist = (t.artist || '').trim().toLowerCase();
        const durSec = Math.round((t.duration_ms || 0) / 1000);
        const dupKey = t.path ? `path:${t.path}` : `meta:${normTitle}:${normArtist}:${durSec}`;
        if (seenTrackKeys.has(dupKey)) return false;
        seenTrackKeys.add(dupKey);
      }

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
      } else if (smartPlaylistFilter === 'forgotten') {
        if (t.play_count != null && t.play_count > 0) return false;
      } else if (smartPlaylistFilter === 'high_bpm') {
        if (!t.bpm || t.bpm < 130) return false;
      } else if (smartPlaylistFilter === 'top_rated') {
        if (!t.rating || t.rating < 4) return false;
      }

      // Jeśli brak zapytania tekstowego, dopasowujemy
      if (!q) return true;

      const album = t.album_id != null ? albums.find((a) => a.id === t.album_id) : null;
      const albumTitle = normalizeStr(album?.title);
      const title = normalizeStr(t.title);
      const artist = normalizeStr(t.artist);
      const albumArtist = normalizeStr(t.album_artist || album?.album_artist);
      const path = normalizeStr(t.path);

      // foobar2000 zaawansowane filtrowanie po prefiksach tagów (artist:, album:, title:, format:, path:)
      if (rawQ.includes(':')) {
        const tokens = rawQ.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          if (token.startsWith('artist:')) {
            const val = normalizeStr(token.slice(7));
            if (!artist.includes(val) && !albumArtist.includes(val)) return false;
          } else if (token.startsWith('album:')) {
            const val = normalizeStr(token.slice(6));
            if (!albumTitle.includes(val)) return false;
          } else if (token.startsWith('title:')) {
            const val = normalizeStr(token.slice(6));
            if (!title.includes(val)) return false;
          } else if (token.startsWith('format:')) {
            const val = normalizeStr(token.slice(7));
            if (!formatLower.includes(val)) return false;
          } else if (token.startsWith('path:')) {
            const val = normalizeStr(token.slice(5));
            if (!path.includes(val)) return false;
          } else {
            const val = normalizeStr(token);
            if (
              !title.includes(val) &&
              !artist.includes(val) &&
              !albumArtist.includes(val) &&
              !albumTitle.includes(val) &&
              !path.includes(val) &&
              !formatLower.includes(val)
            ) {
              return false;
            }
          }
        }
        return true;
      }

      // Filtr fasetowy foobar2000 Facets
      if (isFacetsFilterEnabled) {
        if (facetSelectedFormat && t.format.toUpperCase() !== facetSelectedFormat) {
          return false;
        }
        if (facetSelectedArtist && t.artist.trim() !== facetSelectedArtist) {
          return false;
        }
        if (facetSelectedAlbumId !== null && t.album_id !== facetSelectedAlbumId) {
          return false;
        }
      }

      return (
        title.includes(q) ||
        artist.includes(q) ||
        albumArtist.includes(q) ||
        albumTitle.includes(q) ||
        path.includes(q) ||
        formatLower.includes(q)
      );
    });
  }, [
    tracks,
    albums,
    librarySearch,
    libraryFormatFilter,
    smartPlaylistFilter,
    isFacetsFilterEnabled,
    facetSelectedFormat,
    facetSelectedArtist,
    facetSelectedAlbumId,
    hideDuplicates,
  ]);

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
      if (smartPlaylistFilter === 'top_rated') {
        return [...filteredTracks].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }
      if (smartPlaylistFilter === 'high_bpm') {
        return [...filteredTracks].sort((a, b) => (b.bpm || 0) - (a.bpm || 0));
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

  const [albumSortField, setAlbumSortField] = useState<'title' | 'artist' | 'year' | 'tracks' | 'duration'>('title');
  const [albumSortOrder, setAlbumSortOrder] = useState<'asc' | 'desc'>('asc');
  const [albumViewMode, setAlbumViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('auralune_album_view_mode');
      return saved === 'list' || saved === 'grid' ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [albumGridSize, setAlbumGridSize] = useState<'compact' | 'medium' | 'large'>(() => {
    try {
      const saved = localStorage.getItem('auralune_album_grid_size');
      return saved === 'compact' || saved === 'medium' || saved === 'large' ? saved : 'medium';
    } catch {
      return 'medium';
    }
  });
  const [albumCoverFilter, setAlbumCoverFilter] = useState<'all' | 'with-cover' | 'missing-cover'>('all');

  const albumsWithCoverCount = useMemo(() => albums.filter((a) => !!a.cover_path).length, [albums]);
  const albumsWithoutCoverCount = useMemo(() => albums.length - albumsWithCoverCount, [albums, albumsWithCoverCount]);


  const sortedAlbums = useMemo(() => {
    let list = albums.filter((a) => {
      if (albumCoverFilter === 'with-cover' && !a.cover_path) return false;
      if (albumCoverFilter === 'missing-cover' && a.cover_path) return false;
      const q = normalizeStr(librarySearch.trim());
      if (!q) return true;
      const title = normalizeStr(a.title);
      const artist = normalizeStr(a.album_artist);
      return title.includes(q) || artist.includes(q);
    });

    const albumMetaMap = new Map<number, { count: number; duration: number }>();
    if (albumSortField === 'tracks' || albumSortField === 'duration') {
      for (const t of tracks) {
        if (t.album_id != null) {
          const cur = albumMetaMap.get(t.album_id) || { count: 0, duration: 0 };
          cur.count += 1;
          cur.duration += t.duration_ms || 0;
          albumMetaMap.set(t.album_id, cur);
        }
      }
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (albumSortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (albumSortField === 'artist') {
        cmp = a.album_artist.localeCompare(b.album_artist);
      } else if (albumSortField === 'year') {
        cmp = (a.year || 0) - (b.year || 0);
      } else if (albumSortField === 'tracks') {
        const aCount = albumMetaMap.get(a.id)?.count || 0;
        const bCount = albumMetaMap.get(b.id)?.count || 0;
        cmp = aCount - bCount;
      } else if (albumSortField === 'duration') {
        const aDur = albumMetaMap.get(a.id)?.duration || 0;
        const bDur = albumMetaMap.get(b.id)?.duration || 0;
        cmp = aDur - bDur;
      }
      return albumSortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [albums, tracks, librarySearch, albumCoverFilter, albumSortField, albumSortOrder]);

  const librarySearchInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const libraryTableRef = useRef<HTMLTableElement | null>(null);
  const queueListRef = useRef<HTMLDivElement | null>(null);

  // Wirtualizacja tabeli utworów w bibliotece (płynne 60-144 FPS nawet przy 10k utworów)
  const {
    startIndex: trackStartIndex,
    endIndex: trackEndIndex,
    topSpacerHeight: trackTopSpacer,
    bottomSpacerHeight: trackBottomSpacer,
  } = useVirtualScroll({
    itemCount: sortedTracks.length,
    itemHeight: 48,
    containerRef: mainContentRef,
    tableRef: libraryTableRef,
    overscan: 20,
  });

  // Wirtualizacja listy w kolejce odtwarzania (precyzyjna wysokość wiersza 72px / 54px compact)
  const {
    startIndex: queueStartIndex,
    endIndex: queueEndIndex,
    topSpacerHeight: queueTopSpacer,
    bottomSpacerHeight: queueBottomSpacer,
  } = useVirtualScroll({
    itemCount: filteredQueueItems.length,
    itemHeight: queueColumns.compactMode ? 54 : 72,
    containerRef: mainContentRef,
    tableRef: queueListRef,
    overscan: 20,
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
  }, [activeTab]);

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
    if (currentPlayingTrack?.album_id) {
      const found = albums.find((a) => a.id === currentPlayingTrack.album_id);
      if (found) return found;
    }
    const albTitle = (status.current_track?.album || '').trim().toLowerCase();
    const albArtist = (currentPlayingTrack?.artist || currentPlayingTrack?.album_artist || status.current_track?.artist || '').trim().toLowerCase();
    if (albTitle) {
      if (albArtist) {
        const foundExact = albums.find(
          (a) => a.title.trim().toLowerCase() === albTitle && a.album_artist.trim().toLowerCase() === albArtist
        );
        if (foundExact) return foundExact;
      }
      const found = albums.find((a) => a.title.trim().toLowerCase() === albTitle);
      if (found) return found;
    }
    return null;
  }, [albums, currentPlayingTrack, status.current_track?.album, status.current_track?.artist]);

  // Dynamiczna tonacja bazowa i BPM dla odtwarzanego utworu (z pamięcią podręczną)
  const activeTrackKeyBpm = useMemo(() => {
    let key = currentPlayingTrack?.initial_key || tracks.find((t) => t.path === status.current_track?.uri)?.initial_key || null;
    let bpm = currentPlayingTrack?.bpm || tracks.find((t) => t.path === status.current_track?.uri)?.bpm || null;

    if (!key || !bpm) {
      const cacheId = currentPlayingTrack?.id ? `auralune_track_key_bpm_${currentPlayingTrack.id}` : null;
      const cacheUri = currentPlayingTrack?.path ? `auralune_track_key_bpm_${currentPlayingTrack.path}` : (status.current_track?.uri ? `auralune_track_key_bpm_${status.current_track.uri}` : null);
      const stored = (cacheId && localStorage.getItem(cacheId)) || (cacheUri && localStorage.getItem(cacheUri));
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (!key && typeof parsed.baseKeyIndex === 'number') {
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const note = notes[parsed.baseKeyIndex] || 'C';
            key = parsed.isMinor ? `${note}m` : `${note} Maj`;
          }
          if (!bpm && typeof parsed.baseBpm === 'number') {
            bpm = parsed.baseBpm;
          }
        } catch {}
      }
    }
    return { key, bpm };
  }, [currentPlayingTrack, tracks, status.current_track?.uri]);

  // Obliczenie łącznego wpływu parametrów DSP (RubberBand / SoundTouch + Playback Rate)
  const dspCombination = useMemo(() => {
    const pitchSt = status.pitch_semitones ?? 0.0;
    const tempoRatio = status.tempo_ratio ?? 1.0;
    const rateRatio = status.rate_ratio ?? 1.0;
    const engine = status.engine || 'RubberBand';

    // Przeliczenie wpływu Playback Rate na tonację w półtonach: 12 * log2(rate)
    const rateSemitones = 12 * Math.log2(Math.max(0.01, rateRatio));
    // Łączna transpozycja w półtonach (Pitch Shift silnika + zmiana wynikająca z prędkości odtwarzania)
    const totalPitchSemitones = Math.round((pitchSt + rateSemitones) * 100) / 100;
    // Łączna prędkość (Tempo Time-Stretch * Prędkość Playback Rate)
    const totalSpeedRatio = Math.round(tempoRatio * rateRatio * 1000) / 1000;

    // Wyznaczenie łącznej tonacji na kole Camelota (z uwzględnieniem pitch i rate)
    const totalKey = activeTrackKeyBpm.key
      ? getTransposedKey(activeTrackKeyBpm.key, totalPitchSemitones)
      : null;

    // Wyznaczenie łącznego tempa w BPM (z uwzględnieniem tempo i rate)
    const totalBpm = activeTrackKeyBpm.bpm
      ? Math.round(activeTrackKeyBpm.bpm * totalSpeedRatio * 10) / 10
      : null;

    const hasPitch = Math.abs(pitchSt) > 0.005;
    const hasTempo = Math.abs(tempoRatio - 1.0) > 0.005;
    const hasRate = Math.abs(rateRatio - 1.0) > 0.005;
    const isCombined = (hasPitch ? 1 : 0) + (hasTempo ? 1 : 0) + (hasRate ? 1 : 0) > 1;

    return {
      pitchSt,
      tempoRatio,
      rateRatio,
      rateSemitones,
      totalPitchSemitones,
      totalSpeedRatio,
      totalKey,
      totalBpm,
      hasPitch,
      hasTempo,
      hasRate,
      isCombined,
      engine,
    };
  }, [status.pitch_semitones, status.tempo_ratio, status.rate_ratio, status.engine, activeTrackKeyBpm]);

  // Tekst plakietki statusowej dla gramofonu (Vinyl Turntable) i magnetofonu (Tape Deck)
  const dspBadgeText = useMemo(() => {
    if (status.engine === 'Bypass') return 'Bypass';
    const { engine, hasPitch, hasTempo, hasRate, totalSpeedRatio, totalPitchSemitones, tempoRatio, pitchSt, rateRatio, rateSemitones } = dspCombination;

    if (!hasPitch && !hasTempo && !hasRate) {
      return `${engine} 1.00x`;
    }
    // Tylko tempo jest zmienione
    if (hasTempo && !hasPitch && !hasRate) {
      return `${engine} ${tempoRatio.toFixed(2)}x`;
    }
    // Tylko pitch jest zmieniony
    if (hasPitch && !hasTempo && !hasRate) {
      return `${engine} ${pitchSt > 0 ? `+${pitchSt.toFixed(2)}` : pitchSt.toFixed(2)}st`;
    }
    // Tylko prędkość taśmy/płyty (rate) jest zmieniona
    if (hasRate && !hasTempo && !hasPitch) {
      return `Rate ${rateRatio.toFixed(2)}x (${rateSemitones > 0 ? `+${rateSemitones.toFixed(2)}` : rateSemitones.toFixed(2)}st)`;
    }
    // Kombinacja (np. tempo + pitch, tempo + rate, pitch + rate, lub wszystkie trzy):
    const pitchStr = Math.abs(totalPitchSemitones) > 0.005 ? `${totalPitchSemitones > 0 ? `+${totalPitchSemitones.toFixed(2)}` : totalPitchSemitones.toFixed(2)}st` : '';
    const speedStr = `${totalSpeedRatio.toFixed(2)}x`;
    if (pitchStr) {
      return `${engine} Σ ${speedStr}, ${pitchStr}`;
    }
    return `${engine} Σ ${speedStr}`;
  }, [status.engine, dspCombination]);

  const dspBadgeTitle = useMemo(() => {
    if (status.engine === 'Bypass') return 'DSP Bypass';
    const { engine, tempoRatio, pitchSt, rateRatio, rateSemitones, totalSpeedRatio, totalPitchSemitones, totalKey, totalBpm } = dspCombination;
    let text = `${engine} [T: ${tempoRatio.toFixed(2)}x, P: ${pitchSt >= 0 ? `+${pitchSt.toFixed(2)}` : pitchSt.toFixed(2)}st, R: ${rateRatio.toFixed(2)}x (${rateSemitones >= 0 ? `+${rateSemitones.toFixed(2)}` : rateSemitones.toFixed(2)}st)] → Σ Prędkość: ${totalSpeedRatio.toFixed(2)}x, Σ Wysokość: ${totalPitchSemitones >= 0 ? `+${totalPitchSemitones.toFixed(2)}` : totalPitchSemitones.toFixed(2)}st`;
    if (totalKey) {
      text += ` • Tonacja: ${totalKey.camelot} (${totalKey.keyName})`;
    }
    if (totalBpm) {
      text += ` • Tempo: ${totalBpm} BPM`;
    }
    return text;
  }, [status.engine, dspCombination]);


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
        .catch(() => { });
    } else {
      setTrackDirectCover(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [currentPlayingTrack?.path, filePath, status.current_track?.uri, currentAlbum?.cover_path]);

  // Wyznaczenie czytelnego tytułu i wykonawcy z uwzględnieniem radia internetowego (Anime Radio)
  const isPlayingRadio = Boolean(
    currentRadioStation ||
    (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) ||
    (status.current_track?.uri && (status.current_track.uri.startsWith('http://') || status.current_track.uri.startsWith('https://')))
  );

  // W trybie radia internetowego czyścimy okładkę poprzedniego utworu lokalnego
  const currentCover = isPlayingRadio ? null : (currentAlbum?.cover_path || trackDirectCover || null);

  const lastMprisSyncRef = useRef<string>('');

  // Automatyczna synchronizacja metadanych i okładki z MPRIS / Discord RPC przy każdej zmianie utworu lub okładki
  useEffect(() => {
    const title = currentPlayingTrack?.title || status.current_track?.title;
    if (!title) return;
    const artist = currentPlayingTrack?.artist || status.current_track?.artist || 'Unknown Artist';
    const album = currentAlbum?.title || status.current_track?.album || 'Auralune Player';
    const durationMs = currentPlayingTrack?.duration_ms || status.current_track?.duration_ms || status.duration_ms || 0;
    const artUrl = currentAlbum?.release_mbid
      ? `https://coverartarchive.org/release/${currentAlbum.release_mbid}/front-500`
      : currentCover;

    const syncKey = `${title}|${artist}|${album}|${durationMs}|${artUrl || ''}`;
    if (lastMprisSyncRef.current === syncKey) return;
    lastMprisSyncRef.current = syncKey;

    invoke('update_mpris_metadata', {
      title,
      artist,
      album,
      durationMs,
      artUrl: artUrl || null,
    }).catch(() => { });
  }, [
    currentPlayingTrack?.title,
    currentPlayingTrack?.artist,
    currentPlayingTrack?.duration_ms,
    status.current_track?.title,
    status.current_track?.artist,
    status.current_track?.album,
    status.current_track?.duration_ms,
    status.duration_ms,
    currentAlbum?.title,
    currentAlbum?.release_mbid,
    currentCover,
  ]);

  const cleanLiveTitle = status.live_stream_title && status.live_stream_title.trim() !== '-' && status.live_stream_title.trim() !== ''
    ? status.live_stream_title.trim()
    : null;

  const effectiveDisplayTitle = useMemo(() => {
    if (cleanLiveTitle) {
      return cleanLiveTitle;
    }
    if (currentRadioStation?.name) {
      return currentRadioStation.name;
    }
    if (currentPlayingTrack?.title) {
      return currentPlayingTrack.title;
    }
    if (status.current_track?.title && !status.current_track.title.startsWith('http://') && !status.current_track.title.startsWith('https://')) {
      return status.current_track.title;
    }
    if (filePath) {
      const candidate = filePath.split('/').pop() || '';
      if (!candidate.startsWith('http')) return candidate;
    }
    if (tracks.length === 0) {
      return 'Skrzydła Białe';
    }
    return loc.player.noTrack;
  }, [cleanLiveTitle, currentRadioStation?.name, currentPlayingTrack?.title, status.current_track?.title, filePath, tracks.length, loc.player.noTrack]);

  const effectiveDisplayArtist = useMemo(() => {
    if (currentRadioStation?.name) {
      if (cleanLiveTitle) {
        return currentRadioStation.name;
      }
      return currentRadioStation.genre || 'Anime & Internet Radio';
    }
    if (currentPlayingTrack?.artist) {
      return currentPlayingTrack.artist;
    }
    if (status.current_track?.artist && status.current_track.artist !== 'Unknown Artist') {
      return status.current_track.artist;
    }
    if (tracks.length === 0 && (!status.current_track?.title || status.current_track.title === 'Skrzydła Białe')) {
      return 'Das Letzte Kemonomimi';
    }
    return isPlayingRadio ? 'Anime Radio' : loc.player.unknownArtist;
  }, [currentRadioStation, cleanLiveTitle, currentPlayingTrack?.artist, status.current_track?.artist, status.current_track?.title, tracks.length, isPlayingRadio, loc.player.unknownArtist]);

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
    const count = 160;
    for (let i = 0; i < count; i++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      const rnd = ((h >>> 0) % 1000) / 1000;
      const envelope = Math.sin((i / count) * Math.PI) * 0.4 + 0.6;
      const harmonic = Math.sin((i / count) * Math.PI * 4) * 0.15;
      const heightPct = Math.round((0.15 + (rnd * 0.7 + harmonic) * envelope) * 100);
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
  const [selectedAlbumDetail, setSelectedAlbumDetail] = useState<AlbumRecord | null>(null);
  const albumListScrollPosRef = useRef<number>(0);
  const isRestoringAlbumScrollRef = useRef<boolean>(false);

  const handleOpenAlbumDetail = useCallback((album: AlbumRecord) => {
    if (mainContentRef.current) {
      albumListScrollPosRef.current = mainContentRef.current.scrollTop;
    }
    setSelectedAlbumDetail(album);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, []);

  const handleBackFromAlbumDetail = useCallback(() => {
    isRestoringAlbumScrollRef.current = true;
    setSelectedAlbumDetail(null);
  }, []);

  useLayoutEffect(() => {
    if (!selectedAlbumDetail && isRestoringAlbumScrollRef.current) {
      isRestoringAlbumScrollRef.current = false;
      const targetScroll = albumListScrollPosRef.current;
      if (mainContentRef.current) {
        mainContentRef.current.scrollTop = targetScroll;
      }
      const frameId = requestAnimationFrame(() => {
        if (mainContentRef.current && Math.abs(mainContentRef.current.scrollTop - targetScroll) > 1) {
          mainContentRef.current.scrollTop = targetScroll;
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [selectedAlbumDetail]);

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
  const lastTrackPositionMsRef = useRef<number>(0);
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
          // Jeśli backend jest w stanie Stopped i posiadamy zapamiętaną pozycję ze startu, zachowujemy ją w UI
          if (res.state === 'Stopped' && initialStartupPositionRef.current !== null && prev.current_track) {
            return {
              ...res,
              position_ms: initialStartupPositionRef.current,
              duration_ms: prev.duration_ms || res.duration_ms,
              current_track: prev.current_track,
            };
          }
          if (
            prev.state === res.state &&
            res.state !== 'Playing' &&
            prev.current_track?.track_id === res.current_track?.track_id &&
            prev.position_ms === res.position_ms &&
            prev.volume === res.volume &&
            prev.tempo_ratio === res.tempo_ratio &&
            prev.pitch_semitones === res.pitch_semitones &&
            prev.equalizer_enabled === res.equalizer_enabled &&
            JSON.stringify(prev.equalizer_bands) === JSON.stringify(res.equalizer_bands)
          ) {
            return prev;
          }
          return res;
        });
        if (res.replaygain_status) {
          setReplaygainStatus(res.replaygain_status);
        }
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
                invoke('record_track_listening', { trackId, durationMs: elapsed }).catch(() => { });
              } else if (elapsed >= 30000) {
                lastListeningTickRef.current = now;
              }
            } else {
              lastListeningTickRef.current = Date.now();
            }

            // Wykrycie zapętlenia/powtórzenia (Repeat Track / Loop):
            // Jeśli bieżąca pozycja cofnęła się w okolicę początku (<3000ms),
            // a poprzednio odtworzono ponad 5000ms, to utwór rozpoczął kolejny obieg!
            if (res.position_ms < 3000 && lastTrackPositionMsRef.current > 5000) {
              lastRecordedTrackRef.current.recorded = false;
              setScrobbledTrackId(null);
              setLastfmScrobbledTrackId(null);
              invoke('notify_track_looped', { positionMs: res.position_ms }).catch(() => { });
            }
            lastTrackPositionMsRef.current = res.position_ms;

            const playThresholdMs = Math.min(15000, (res.duration_ms && res.duration_ms > 0 ? res.duration_ms * 0.5 : 15000));

            if (lastRecordedTrackRef.current.id !== trackId) {
              lastRecordedTrackRef.current = { id: trackId, recorded: false };
            } else if (
              !lastRecordedTrackRef.current.recorded &&
              res.state === 'Playing' &&
              res.position_ms >= playThresholdMs
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

            // ListenBrainz Scrobbler: scrobble po przekroczeniu 50% czasu utworu (lub 240 sek.)
            if (
              res.state === 'Playing' &&
              listenbrainzEnabled &&
              listenbrainzToken &&
              scrobbledTrackId !== trackId &&
              res.duration_ms &&
              res.duration_ms >= 30000 &&
              res.position_ms >= Math.min(res.duration_ms * 0.5, 240000)
            ) {
              setScrobbledTrackId(trackId);
              const currentTrackObj = tracks.find((t) => t.id === trackId);
              if (currentTrackObj) {
                const trackAlb = currentTrackObj.album_id ? albums.find((a) => a.id === currentTrackObj.album_id)?.title : null;
                invoke('submit_listenbrainz_listen', {
                  token: listenbrainzToken,
                  artist: currentTrackObj.artist,
                  title: currentTrackObj.title,
                  album: trackAlb || null,
                  durationMs: currentTrackObj.duration_ms || null,
                  listenedAt: Math.floor(Date.now() / 1000),
                })
                  .then(() => {
                    showMessage(t.notifications.scrobbledListenbrainz.replace('{0}', currentTrackObj.title));
                  })
                  .catch((e) => console.warn('Błąd wysyłania scrobble:', e));
              }
            }

            // Last.fm Scrobbler: scrobble po przekroczeniu 50% czasu utworu (lub 240 sek.)
            if (
              res.state === 'Playing' &&
              lastfmEnabled &&
              lastfmSessionKey &&
              lastfmScrobbledTrackId !== trackId &&
              res.duration_ms &&
              res.duration_ms >= 30000 &&
              res.position_ms >= Math.min(res.duration_ms * 0.5, 240000)
            ) {
              setLastfmScrobbledTrackId(trackId);
              const currentTrackObj = tracks.find((t) => t.id === trackId);
              if (currentTrackObj) {
                const trackAlb = currentTrackObj.album_id ? albums.find((a) => a.id === currentTrackObj.album_id)?.title : null;
                invoke('lastfm_scrobble', {
                  request: {
                    session_key: lastfmSessionKey,
                    artist: currentTrackObj.artist,
                    track: currentTrackObj.title,
                    album: trackAlb || null,
                    timestamp: Math.floor(Date.now() / 1000),
                    duration_sec: currentTrackObj.duration_ms ? Math.round(currentTrackObj.duration_ms / 1000) : null,
                    api_key: lastfmCustomKey.trim() || null,
                    api_secret: lastfmCustomSecret.trim() || null,
                  },
                })
                  .then(() => {
                    showMessage(t.notifications.scrobbledLastfm.replace('{0}', currentTrackObj.title));
                  })
                  .catch((e) => console.warn('Błąd wysyłania Last.fm scrobble:', e));
              }
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

    invoke<string | null>('get_app_setting', { key: 'dsp_default_engine' })
      .then((val) => {
        if (val === 'RubberBand' || val === 'SoundTouch' || val === 'Bypass') {
          setDspDefaultEngine(val);
        }
      })
      .catch((e) => console.warn('Błąd odczytu dsp_default_engine:', e));

    invoke<number>('get_audio_buffer_duration_ms')
      .then((val) => {
        if (typeof val === 'number' && val > 0) {
          setAudioBufferMs(val);
        }
      })
      .catch((e) => console.warn('Błąd odczytu get_audio_buffer_duration_ms:', e));

    invoke<number>('get_dsp_block_size')
      .then((val) => {
        if (typeof val === 'number' && val > 0) {
          setDspBlockSize(val);
        }
      })
      .catch((e) => console.warn('Błąd odczytu get_dsp_block_size:', e));

    invoke<string | null>('get_app_setting', { key: 'close_to_tray' })
      .then((val) => {
        setCloseToTray(val !== 'false');
      })
      .catch((e) => console.warn('Błąd odczytu close_to_tray:', e));

    invoke<{ enabled: boolean; connected: boolean; client_id: string }>('get_discord_rpc_status')
      .then((st) => {
        if (st) {
          setDiscordRpcEnabled(st.enabled);
          setDiscordRpcConnected(st.connected);
          const cid = st.client_id || '1563876157387186226';
          setDiscordClientId(cid);
          setDiscordClientId(cid);
        }
      })
      .catch((e) => console.warn('Błąd odczytu get_discord_rpc_status:', e));


    invoke<string | null>('get_app_setting', { key: 'listenbrainz_token' })
      .then((val) => {
        if (val) setListenbrainzToken(val);
      })
      .catch((e) => console.warn('Błąd odczytu listenbrainz_token:', e));

    invoke<string | null>('get_app_setting', { key: 'listenbrainz_enabled' })
      .then((val) => {
        setListenbrainzEnabled(val === 'true');
      })
      .catch((e) => console.warn('Błąd odczytu listenbrainz_enabled:', e));

    invoke<string | null>('get_app_setting', { key: 'lastfm_session_key' })
      .then((val) => {
        if (val) setLastfmSessionKey(val);
      })
      .catch(() => { });

    invoke<string | null>('get_app_setting', { key: 'lastfm_username' })
      .then((val) => {
        if (val) setLastfmUsername(val);
      })
      .catch(() => { });

    invoke<string | null>('get_app_setting', { key: 'lastfm_enabled' })
      .then((val) => {
        setLastfmEnabled(val === 'true');
      })
      .catch(() => { });

    invoke<string | null>('get_app_setting', { key: 'lastfm_custom_key' })
      .then((val) => {
        if (val) setLastfmCustomKey(val);
      })
      .catch(() => { });

    invoke<string | null>('get_app_setting', { key: 'lastfm_custom_secret' })
      .then((val) => {
        if (val) setLastfmCustomSecret(val);
      })
      .catch(() => { });

    invoke<string | null>('get_app_setting', { key: 'crossfade_duration' })
      .then((val) => {
        const ms = val ? parseInt(val, 10) : 1500;
        if (!isNaN(ms)) {
          setCrossfadeDuration(ms);
          invoke('set_crossfade_duration', { durationMs: ms }).catch(() => { });
        }
      })
      .catch((e) => console.warn('Błąd odczytu crossfade_duration:', e));

    invoke<string | null>('get_app_setting', { key: 'bass_boost' })
      .then((val) => {
        if (val) {
          const num = parseFloat(val);
          if (!isNaN(num)) setBassBoost(num);
        }
      })
      .catch((e) => console.warn('Błąd odczytu bass_boost:', e));

    invoke<string | null>('get_app_setting', { key: 'stereo_widener_active' })
      .then((val) => {
        const active = val === 'true';
        setStereoWidenerActive(active);
        invoke('set_stereo_widener', { active, amount: stereoWidenerAmount }).catch(() => { });
      })
      .catch((e) => console.warn('Błąd odczytu stereo_widener_active:', e));

    invoke<string | null>('get_app_setting', { key: 'stereo_widener_amount' })
      .then((val) => {
        if (val) {
          const amt = parseFloat(val);
          if (!isNaN(amt)) {
            setStereoWidenerAmount(amt);
            invoke('set_stereo_widener', { active: stereoWidenerActive, amount: amt }).catch(() => { });
          }
        }
      })
      .catch((e) => console.warn('Błąd odczytu stereo_widener_amount:', e));

    invoke<string | null>('get_app_setting', { key: 'limiter_enabled' })
      .then((val) => {
        const enabled = val !== 'false';
        setLimiterEnabled(enabled);
        invoke('set_limiter_enabled', { enabled }).catch(() => { });
      })
      .catch((e) => console.warn('Błąd odczytu limiter_enabled:', e));

    // Inicjalizacja konfiguracji ReplayGain 2.0 / EBU R128
    const savedRgMode = (localStorage.getItem('auralune_replaygain_mode') as 'Off' | 'Track' | 'Album' | 'Auto') || 'Off';
    const savedRgPreAmp = parseFloat(localStorage.getItem('auralune_replaygain_preamp') || '0.0') || 0.0;
    const savedRgFallback = parseFloat(localStorage.getItem('auralune_replaygain_fallback') || '-6.0') || -6.0;
    const savedRgClipping = localStorage.getItem('auralune_replaygain_prevent_clipping') !== 'false';
    invoke('set_replaygain_config', {
      config: {
        mode: savedRgMode,
        pre_amp_db: savedRgPreAmp,
        fallback_gain_db: savedRgFallback,
        prevent_clipping: savedRgClipping,
      },
    }).catch((e) => console.warn('Błąd inicjalizacji ReplayGain:', e));

    // Inicjalizacja filtra Crossfeed (bs2b)
    const savedCfEnabled = localStorage.getItem('auralune_crossfeed_enabled') === 'true';
    const savedCfPreset = (localStorage.getItem('auralune_crossfeed_preset') as 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom') || 'Default';
    const savedCfFcut = parseInt(localStorage.getItem('auralune_crossfeed_fcut') || '700', 10) || 700;
    const savedCfFeed = parseInt(localStorage.getItem('auralune_crossfeed_feed') || '45', 10) || 45;
    invoke('set_crossfeed_config', {
      config: {
        enabled: savedCfEnabled,
        preset: savedCfPreset,
        fcut_hz: savedCfFcut,
        feed_tenth_db: savedCfFeed,
      },
    }).catch((e) => console.warn('Błąd inicjalizacji Crossfeed:', e));

    // Inicjalizacja Silence Trimming
    const savedStEnabled = localStorage.getItem('auralune_silence_trimming_enabled') === 'true';
    const savedStThreshold = parseFloat(localStorage.getItem('auralune_silence_trimming_threshold') || '-50.0') || -50.0;
    invoke('set_silence_trimming_config', {
      config: {
        enabled: savedStEnabled,
        threshold_db: savedStThreshold,
      },
    }).catch((e) => console.warn('Błąd inicjalizacji Silence Trimming:', e));

    // Inicjalizacja i przywrócenie sesji odtwarzania (utwór, pozycja, głośność dB, DSP)
    invoke<string | null>('get_app_setting', { key: 'restore_session_on_startup' })
      .then((val) => {
        if (val !== null) {
          setRestoreSessionOnStartup(val !== 'false');
        }
      })
      .catch((e) => console.warn('Błąd odczytu restore_session_on_startup:', e));

    const shouldRestore = localStorage.getItem('auralune_restore_session_on_startup') !== 'false';
    if (shouldRestore) {
      const savedLocal = localStorage.getItem('auralune_playback_session');
      if (savedLocal) {
        try {
          const session = JSON.parse(savedLocal);
          if (session) {
            // 1. Głośność, jednostka i tryb wizualny
            if (typeof session.volume === 'number') {
              const vol = Math.max(0, Math.min(1.0, session.volume));
              setStatus((prev) => ({ ...prev, volume: vol }));
              invoke('set_volume', { volume: vol }).catch(() => { });
            }
            if (session.volume_unit === 'percent' || session.volume_unit === 'db') {
              setVolumeUnit(session.volume_unit);
            }
            if (session.nowplaying_visual_mode) {
              setNowPlayingVisualMode(session.nowplaying_visual_mode);
            }

            // 2. Przywrócenie parametrów DSP i korektora graficznego
            if (session.engine && session.engine !== 'Bypass') {
              invoke('set_dsp_params', {
                engine: session.engine,
                pitchSemitones: session.pitch_semitones ?? 0.0,
                tempoRatio: session.tempo_ratio ?? 1.0,
                rateRatio: session.rate_ratio ?? 1.0,
              }).catch(() => { });
            }
            if (session.equalizer_enabled && session.equalizer_bands) {
              invoke('set_equalizer_params', {
                enabled: true,
                bands: session.equalizer_bands,
              }).catch(() => { });
            }

            // 3. Przywrócenie ostatnio granego utworu do UI i silnika audio
            const trackUri = session.uri || '';
            const trackId = session.track_id ?? null;

            if (trackId) {
              setActiveTrackId(trackId);
            }
            if (trackUri) {
              setFilePath(trackUri);
            }

            if (trackUri || trackId) {
              const savedPos = session.position_ms || 0;
              if (savedPos > 1000) {
                initialStartupPositionRef.current = savedPos;
              }
              setStatus((prev) => ({
                ...prev,
                position_ms: savedPos,
                duration_ms: session.duration_ms || prev.duration_ms,
                engine: session.engine || prev.engine,
                pitch_semitones: session.pitch_semitones ?? prev.pitch_semitones,
                tempo_ratio: session.tempo_ratio ?? prev.tempo_ratio,
                rate_ratio: session.rate_ratio ?? prev.rate_ratio,
                current_track: {
                  id: trackId ? `restored-track-${trackId}` : `restored-uri-${Date.now()}`,
                  uri: trackUri,
                  track_id: trackId,
                  title: session.title || '',
                  artist: session.artist || '',
                  album: session.album || null,
                  duration_ms: session.duration_ms || 0,
                },
              }));
            }
          }
        } catch { }
      }
    }
  }, []);

  // Automatyczne, asynchroniczne zapisywanie stanu sesji odtwarzania (utwór, pozycja, głośność dB, DSP, widok)
  const lastSavedSessionRef = useRef<string>('');
  useEffect(() => {
    if (!restoreSessionOnStartup) return;

    const currentTrack = currentPlayingTrack;
    const currentUri = status.current_track?.uri || filePath || currentTrack?.path || '';
    const currentPos = status.position_ms;
    const currentVol = status.volume ?? 1.0;

    const sessionPayload = {
      volume: currentVol,
      volume_unit: volumeUnit,
      track_id: status.current_track?.track_id || activeTrackId || currentTrack?.id || null,
      uri: currentUri,
      title: status.current_track?.title || currentTrack?.title || null,
      artist: status.current_track?.artist || currentTrack?.artist || null,
      album: status.current_track?.album || currentAlbum?.title || null,
      position_ms: currentPos,
      duration_ms: status.duration_ms || currentTrack?.duration_ms || null,
      pitch_semitones: status.pitch_semitones,
      tempo_ratio: status.tempo_ratio,
      rate_ratio: status.rate_ratio,
      engine: status.engine,
      equalizer_enabled: status.equalizer_enabled,
      equalizer_bands: status.equalizer_bands,
      nowplaying_visual_mode: nowPlayingVisualMode,
    };

    const serialized = JSON.stringify(sessionPayload);
    try {
      localStorage.setItem('auralune_playback_session', serialized);
    } catch { }

    const timer = setTimeout(() => {
      if (serialized !== lastSavedSessionRef.current) {
        lastSavedSessionRef.current = serialized;
        invoke('set_app_setting', {
          key: 'playback_session_state',
          value: serialized,
        }).catch(() => { });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    restoreSessionOnStartup,
    status.current_track,
    filePath,
    status.position_ms,
    status.volume,
    volumeUnit,
    activeTrackId,
    status.duration_ms,
    status.pitch_semitones,
    status.tempo_ratio,
    status.rate_ratio,
    status.engine,
    status.equalizer_enabled,
    status.equalizer_bands,
    nowPlayingVisualMode,
  ]);

  // Zapisanie sesji w chwili zamykania okna lub przeładowania
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!restoreSessionOnStartup) return;
      const currentTrack = currentPlayingTrack;
      const currentUri = status.current_track?.uri || filePath || currentTrack?.path || '';
      const sessionPayload = {
        volume: status.volume ?? 1.0,
        volume_unit: volumeUnit,
        track_id: status.current_track?.track_id || activeTrackId || currentTrack?.id || null,
        uri: currentUri,
        title: status.current_track?.title || currentTrack?.title || null,
        artist: status.current_track?.artist || currentTrack?.artist || null,
        album: status.current_track?.album || currentAlbum?.title || null,
        position_ms: status.position_ms,
        duration_ms: status.duration_ms || currentTrack?.duration_ms || null,
        pitch_semitones: status.pitch_semitones,
        tempo_ratio: status.tempo_ratio,
        rate_ratio: status.rate_ratio,
        engine: status.engine,
        equalizer_enabled: status.equalizer_enabled,
        equalizer_bands: status.equalizer_bands,
        nowplaying_visual_mode: nowPlayingVisualMode,
      };
      try {
        localStorage.setItem('auralune_playback_session', JSON.stringify(sessionPayload));
      } catch { }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    restoreSessionOnStartup,
    status.current_track,
    filePath,
    status.position_ms,
    status.volume,
    volumeUnit,
    activeTrackId,
    status.duration_ms,
    status.pitch_semitones,
    status.tempo_ratio,
    status.rate_ratio,
    status.engine,
    status.equalizer_enabled,
    status.equalizer_bands,
    nowPlayingVisualMode,
  ]);

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

      if (t.length === 0) {
        // Jeśli biblioteka jest pusta, załaduj domyślny utwór testowy "Skrzydła Białe" (bez dodawania go do bazy biblioteki)
        try {
          const sample = await invoke<SampleTrackDto | null>('get_sample_track');
          if (sample) {
            setStatus((prev) => {
              if (prev.current_track?.title && prev.current_track.title !== 'Skrzydła Białe') {
                return prev;
              }
              if (prev.state === 'Playing') return prev;
              return {
                ...prev,
                duration_ms: sample.duration_ms,
                current_track: {
                  id: 'default-sample-track-skrzydla-biale',
                  uri: sample.path,
                  track_id: null,
                  title: sample.title,
                  artist: sample.artist,
                  album: sample.album,
                  duration_ms: sample.duration_ms,
                },
              };
            });
            setFilePath((prev) => prev || sample.path);
          }
        } catch (sampleErr) {
          console.warn('Nie udało się pobrać domyślnego utworu testowego:', sampleErr);
        }
      } else {
        // Użytkownik posiada utwory w bibliotece.
        // Jeśli aktualny utwór to utwór domyślny demo ("Skrzydła Białe") i nie jest aktywnie odtwarzany,
        // przełącz widok z demo na pierwszy utwór użytkownika.
        setStatus((prev) => {
          const isSampleTrack = !prev.current_track?.track_id && (
            prev.current_track?.id === 'default-sample-track-skrzydla-biale' ||
            prev.current_track?.title === 'Skrzydła Białe'
          );
          if (isSampleTrack && prev.state !== 'Playing') {
            const first = t[0];
            setActiveTrackId(first.id);
            setFilePath(first.path);
            invoke('set_active_track', { trackId: first.id }).catch(() => { });
            return {
              ...prev,
              position_ms: 0,
              duration_ms: first.duration_ms,
              current_track: {
                id: `track-${first.id}`,
                uri: first.path,
                track_id: first.id,
                title: first.title,
                artist: first.artist,
                album: null,
                duration_ms: first.duration_ms,
              },
            };
          }
          return prev;
        });
      }
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

    invoke<string>('get_app_version')
      .then((ver) => {
        if (ver) setAppVersion(ver);
      })
      .catch(() => { });

    // Niezbędne dla Linux/WebKitGTK: zapobieganie domyślnej akcji przeglądarki (przeładowanie strony/odrzucenie dropu z menedżera plików)
    let isInternalDragging = false;
    const handleDragStart = () => {
      isInternalDragging = true;
    };
    const handleDragEnd = () => {
      isInternalDragging = false;
      setIsDraggingOver(false);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInternalDragging) return;
      const types = e.dataTransfer?.types;
      if (types && (types.includes('Files') || Array.from(types).includes('Files'))) {
        setIsDraggingOver(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDraggingOver(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isInternalDragging = false;
      setIsDraggingOver(false);

      const paths: string[] = [];
      // 1. Sprawdź files z menedżera plików (WebKitGTK udostępnia path na obiekcie File)
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i] as any;
          if (file.path) {
            paths.push(file.path);
          }
        }
      }

      // 2. Sprawdź text/uri-list (standard w Linux / X11 / Wayland przy przeciąganiu z Nautilus, Dolphin, Thunar)
      const uriList = e.dataTransfer?.getData('text/uri-list');
      if (uriList) {
        const lines = uriList.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            if (trimmed.startsWith('file://')) {
              try {
                const decoded = decodeURIComponent(new URL(trimmed).pathname);
                if (decoded && !paths.includes(decoded)) {
                  paths.push(decoded);
                }
              } catch {
                const plain = decodeURIComponent(trimmed.replace('file://', ''));
                if (plain && !paths.includes(plain)) {
                  paths.push(plain);
                }
              }
            } else if (trimmed.startsWith('/')) {
              if (!paths.includes(trimmed)) {
                paths.push(trimmed);
              }
            }
          }
        }
      }

      if (paths.length > 0) {
        handleDropPaths(paths);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDraggingOver(false);
      }
    };

    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('keydown', handleKeyDown);

    // Rejestracja zdarzeń drag & drop z Tauri 2 (webview + window + global event)
    let unlistenWebview: (() => void) | null = null;
    let unlistenWindow: (() => void) | null = null;
    let unlistenTauriEvent: (() => void) | null = null;
    let unlistenQueueEvent: (() => void) | null = null;


    listen('queue_changed', () => {
      refreshQueue();
    }).then((unlisten) => {
      unlistenQueueEvent = unlisten;
    }).catch(() => { });

    // Synchronizuj tryb odtwarzania albumów z backendem SQLite
    const savedAlbumMode = localStorage.getItem('auralune_album_playback_mode');
    if (savedAlbumMode) {
      invoke('set_app_setting', { key: 'album_playback_mode', value: savedAlbumMode }).catch(() => { });
    }

    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            if (!isInternalDragging) {
              setIsDraggingOver(true);
            }
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
          unlistenWebview = unlisten;
        })
        .catch((err) => {
          console.warn('getCurrentWebview.onDragDropEvent niedostępne:', err);
        });
    } catch (err) {
      console.warn('getCurrentWebview error:', err);
    }

    try {
      getCurrentWindow()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            if (!isInternalDragging) {
              setIsDraggingOver(true);
            }
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
          unlistenWindow = unlisten;
        })
        .catch((err) => {
          console.warn('getCurrentWindow.onDragDropEvent niedostępne:', err);
        });
    } catch (err) {
      console.warn('getCurrentWindow error:', err);
    }

    listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      setIsDraggingOver(false);
      if (event.payload?.paths && event.payload.paths.length > 0) {
        handleDropPaths(event.payload.paths);
      }
    }).then((unlisten) => {
      unlistenTauriEvent = unlisten;
    }).catch(() => { });

    return () => {
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('keydown', handleKeyDown);
      if (unlistenWebview) unlistenWebview();
      if (unlistenWindow) unlistenWindow();
      if (unlistenTauriEvent) unlistenTauriEvent();
      if (unlistenQueueEvent) unlistenQueueEvent();
    };
  }, []);


  // Smart Auto-DJ / Infinity Queue: automatyczne dobieranie kolejnych utworów harmonicznych Camelot
  useEffect(() => {
    if (!infinityQueue) return;
    if (status.state !== 'Playing') return;
    if (autoDjBusyRef.current) return;
    if (!tracks || tracks.length === 0) return;

    const remainingItems = queue.items.length - (queue.current_index ?? 0);
    if (remainingItems <= 1) {
      const activeIdx = queue.current_index ?? 0;
      const currentQItem = queue.items[activeIdx];
      const currentTrack = currentPlayingTrack || (currentQItem ? tracks.find((t) => t.id === currentQItem.track_id) : null);
      if (!currentTrack) return;
      if (lastAutoDjTrackIdRef.current === currentTrack.id) return;

      autoDjBusyRef.current = true;
      lastAutoDjTrackIdRef.current = currentTrack.id;

      // Wybierz utwory, które nie są jeszcze w bieżącej kolejce
      const queuedIds = new Set(queue.items.map((i) => i.track_id).filter(Boolean));
      queuedIds.add(currentTrack.id);

      const candidates = tracks.filter((t) => !queuedIds.has(t.id));
      const pool = candidates.length > 0 ? candidates : tracks.filter((t) => t.id !== currentTrack.id);

      if (pool.length === 0) {
        autoDjBusyRef.current = false;
        return;
      }

      let bestTrack = pool[0];
      let bestScore = -1;
      let bestBadge = '';

      if (currentTrack.initial_key) {
        for (const cand of pool) {
          if (cand.initial_key) {
            const match = evaluateHarmonicMatch(
              currentTrack.initial_key,
              currentTrack.bpm,
              cand.initial_key,
              cand.bpm
            );
            if (match.score > bestScore) {
              bestScore = match.score;
              bestTrack = cand;
              bestBadge = `${match.badgeLabel} (${match.score}%)`;
            }
          }
        }
      }

      // Fallback jeśli nie ma dopasowań harmonicznych
      if (bestScore < 60) {
        const randIdx = Math.floor(Math.random() * pool.length);
        bestTrack = pool[randIdx];
        bestBadge = 'Smart Shuffle';
      }

      const payload = {
        id: `infinity-${bestTrack.id}-${Date.now()}`,
        track_id: bestTrack.id,
        uri: bestTrack.path,
        title: bestTrack.title,
        artist: bestTrack.artist,
        album: bestTrack.album_id ? (albums.find((a) => a.id === bestTrack.album_id)?.title || null) : null,
        duration_ms: bestTrack.duration_ms,
      };

      invoke('add_to_queue', { item: payload })
        .then(async () => {
          await refreshQueue();
          showMessage(
            t.notifications.infinityQueuePicked
              .replace('{0}', bestTrack.title)
              .replace('{1}', bestBadge)
          );
        })
        .catch((err) => {
          console.error('Auto-DJ add_to_queue error:', err);
        })
        .finally(() => {
          setTimeout(() => {
            autoDjBusyRef.current = false;
          }, 3500);
        });
    }
  }, [
    infinityQueue,
    status.state,
    queue.items.length,
    queue.current_index,
    currentPlayingTrack?.id,
    tracks,
  ]);


  // ============================================

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

      if (updatedTracks.length > 0) {
        setStatus((prev) => {
          const isSampleTrack = !prev.current_track?.track_id && (
            prev.current_track?.id === 'default-sample-track-skrzydla-biale' ||
            prev.current_track?.title === 'Skrzydła Białe'
          );
          if (isSampleTrack && prev.state !== 'Playing') {
            const first = updatedTracks[0];
            setActiveTrackId(first.id);
            setFilePath(first.path);
            invoke('set_active_track', { trackId: first.id }).catch(() => { });
            return {
              ...prev,
              position_ms: 0,
              duration_ms: first.duration_ms,
              current_track: {
                id: `track-${first.id}`,
                uri: first.path,
                track_id: first.id,
                title: first.title,
                artist: first.artist,
                album: null,
                duration_ms: first.duration_ms,
              },
            };
          }
          return prev;
        });
      }

      showMessage(
        `Dodano do biblioteki: ${summary.new_or_updated_tracks} zindeksowano (znaleziono: ${summary.total_files_found}).`
      );
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
        await handleScanPaths(selected);

        const items: QueueItem[] = selected.map((filePath, idx) => {
          const matchingTrack = tracks.find((tr) => tr.path === filePath || filePath.endsWith(tr.path));
          const alb = matchingTrack ? albums.find((a) => a.id === matchingTrack.album_id) : null;
          const fname = filePath.split('/').pop() || filePath;
          return {
            id: `picked-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            track_id: matchingTrack?.id ?? null,
            uri: filePath,
            title: matchingTrack?.title || fname,
            artist: matchingTrack?.artist || 'Plik lokalny',
            album: alb?.title || null,
            duration_ms: (matchingTrack?.duration_ms || 0) as any,
          };
        });

        if (albumPlaybackMode === 'replace') {
          await invoke('set_queue', { items, startIndex: 0 });
          await refreshQueue();
        } else if (albumPlaybackMode === 'append') {
          const currentLen = queue.items.length;
          const combined = [...queue.items, ...items];
          await invoke('set_queue', { items: combined, startIndex: currentLen });
          await refreshQueue();
        } else {
          await handleLoadFile(selected[0]);
          await invoke('play');
          await refreshQueue();
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
      await handleScanPaths(paths);
      if (paths.length === 1) {
        const p = paths[0];
        const isAudio = /\.(flac|mp3|ogg|wav|m4a|aac|opus|alac|aiff|ape|wma)$/i.test(p);
        if (isAudio) {
          setFilePath(p);
          await invoke('load_file', { path: p });
          await invoke('play');
        }
      }
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

  // Synchronizacja zakładki dla bieżącego utworu oraz wielopunktowych znaczników (Cue Points)
  useEffect(() => {
    if (!activeTrackId) {
      setCurrentBookmark(null);
      setCurrentTrackBookmarks([]);
      return;
    }
    invoke<number | null>('get_bookmark', { trackId: activeTrackId })
      .then((b) => setCurrentBookmark(b ?? null))
      .catch(() => setCurrentBookmark(null));

    invoke<TrackBookmarkDto[]>('get_track_bookmarks', { trackId: activeTrackId })
      .then((bms) => setCurrentTrackBookmarks(bms ?? []))
      .catch(() => setCurrentTrackBookmarks([]));
  }, [activeTrackId]);

  const refreshTrackBookmarks = useCallback(() => {
    if (activeTrackId) {
      invoke<TrackBookmarkDto[]>('get_track_bookmarks', { trackId: activeTrackId })
        .then((bms) => setCurrentTrackBookmarks(bms ?? []))
        .catch(() => setCurrentTrackBookmarks([]));
    }
  }, [activeTrackId]);

  // Odtwarzanie utworu z biblioteki z obsługą zakładek, kontekstu kolejki i globalnego Loop
  const handlePlayLibraryTrack = async (track: TrackRecord, contextTracks?: TrackRecord[]) => {
    initialStartupPositionRef.current = null;
    if (isPlayingLibraryTrackRef.current) return;
    isPlayingLibraryTrackRef.current = true;
    const safetyTimeout = setTimeout(() => {
      isPlayingLibraryTrackRef.current = false;
    }, 4000);
    try {
      setActiveTrackId(track.id);
      setFilePath(track.path);

      // 1. Natychmiastowe zaktualizowanie Discord RPC / MPRIS (0ms) z okładką (online Cover Art Archive lub zdefiniowaną w aplikacji)
      const matchingAlbum = albums.find((a) => a.id === track.album_id);
      const appCover = matchingAlbum?.release_mbid
        ? `https://coverartarchive.org/release/${matchingAlbum.release_mbid}/front-500`
        : (matchingAlbum?.cover_path || trackDirectCover || null);

      invoke('update_mpris_metadata', {
        title: track.title,
        artist: track.artist,
        album: matchingAlbum?.title || 'Auralune Library',
        durationMs: track.duration_ms,
        artUrl: appCover,
      }).catch(() => { });

      // 2. Zarządzanie kolejką odtwarzania w zależności od albumPlaybackMode i przekazanego kontekstu
      const effectiveTracks = contextTracks && contextTracks.length > 0 ? contextTracks : [track];

      if (albumPlaybackMode === 'replace') {
        const trackIdx = effectiveTracks.findIndex((t) => t.id === track.id);
        const startIndex = trackIdx >= 0 ? trackIdx : 0;
        const queueItems: QueueItem[] = effectiveTracks.map((t, idx) => {
          const alb = albums.find((a) => a.id === t.album_id);
          return {
            id: `track-${t.id}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            track_id: t.id,
            uri: t.path,
            title: t.title,
            artist: t.artist,
            album: alb?.title || t.album_artist || null,
            duration_ms: (t.duration_ms || 0) as any,
          };
        });
        await invoke('set_queue', { items: queueItems, startIndex });
        await refreshQueue();
      } else if (albumPlaybackMode === 'append') {
        const trackIdx = effectiveTracks.findIndex((t) => t.id === track.id);
        const startIndex = trackIdx >= 0 ? trackIdx : 0;
        const queueItems: QueueItem[] = effectiveTracks.map((t, idx) => {
          const alb = albums.find((a) => a.id === t.album_id);
          return {
            id: `track-${t.id}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            track_id: t.id,
            uri: t.path,
            title: t.title,
            artist: t.artist,
            album: alb?.title || t.album_artist || null,
            duration_ms: (t.duration_ms || 0) as any,
          };
        });
        const currentLen = queue.items.length;
        const targetIdx = currentLen + startIndex;
        const combined = [...queue.items, ...queueItems];
        await invoke('set_queue', { items: combined, startIndex: targetIdx });
        await refreshQueue();
      } else {
        // Tryb 'single': bezpośrednie załadowanie utworu bez modyfikacji kolejki
        await invoke('load_file', { path: track.path });
        await invoke('play');
        await refreshQueue();
      }

      // Sprawdź czy jest zapisana zakładka (bookmark)
      const bookmark = await invoke<number | null>('get_bookmark', { trackId: track.id });
      setCurrentBookmark(bookmark ?? null);

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

      // Powiadomienie pulpitu Linuksa (libnotify / D-Bus)
      if (desktopNotificationsEnabled) {
        invoke('show_desktop_notification', {
          title: track.title,
          body: matchingAlbum?.title ? `${track.artist} • ${matchingAlbum.title}` : track.artist,
          icon: null,
        }).catch(() => { });
      }

      // ListenBrainz Scrobbler: status «Teraz odtwarzane»
      setScrobbledTrackId(null);
      if (listenbrainzEnabled && listenbrainzToken) {
        invoke('submit_listenbrainz_playing_now', {
          token: listenbrainzToken,
          artist: track.artist,
          title: track.title,
          album: matchingAlbum?.title || null,
          durationMs: track.duration_ms || null,
        }).catch((e) => console.warn('ListenBrainz Playing Now error:', e));
      }

      // Last.fm Scrobbler: status «Now Playing»
      setLastfmScrobbledTrackId(null);
      if (lastfmEnabled && lastfmSessionKey) {
        invoke('lastfm_update_now_playing', {
          request: {
            session_key: lastfmSessionKey,
            artist: track.artist,
            track: track.title,
            album: matchingAlbum?.title || null,
            duration_sec: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
            timestamp: null,
            api_key: lastfmCustomKey.trim() || null,
            api_secret: lastfmCustomSecret.trim() || null,
          },
        }).catch((e) => console.warn('Last.fm Now Playing error:', e));
      }

      // Auto ReplayGain: dynamiczne dopasowanie Album Gain vs Track Gain
      if (replaygainMode === 'Auto') {
        const prevTrack = tracks.find((t) => t.id === activeTrackId);
        const isSameAlbum = prevTrack?.album_id != null && prevTrack.album_id === track.album_id;
        invoke('apply_auto_replaygain', {
          isSameAlbum,
          isShuffle: Boolean(queue.shuffle),
        }).catch((e) => console.warn('Auto ReplayGain error:', e));
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      clearTimeout(safetyTimeout);
      isPlayingLibraryTrackRef.current = false;
    }
  };

  const handlePlayAlbum = (albumTracks: TrackRecord[], startIndex = 0) => {
    const sorted = [...albumTracks].sort(
      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
    );
    if (sorted.length > 0) {
      const target = sorted[startIndex] || sorted[0];
      handlePlayLibraryTrack(target, sorted);
    }
  };

  const handleAddAlbumToQueue = async (albumTracks: TrackRecord[]) => {
    const sorted = [...albumTracks].sort(
      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
    );
    if (sorted.length > 0) {
      try {
        await invoke('add_uris_to_queue', { uris: sorted.map((t) => t.path) });
        await refreshQueue();
        showMessage(t.notifications.loadedTracksToQueueMsg.replace('{0}', String(sorted.length)));
      } catch (e: any) {
        showMessage(`${t.common.errorPrefix} ${e}`, true);
      }
    }
  };

  // 1.0: Wymieszanie i natychmiastowe odtworzenie całej biblioteki lub kontekstu utworów
  const handleShuffleAll = async (sourceTracks?: TrackRecord[]) => {
    const pool = (sourceTracks && sourceTracks.length > 0)
      ? sourceTracks
      : (filteredTracks.length > 0 ? filteredTracks : tracks);

    if (pool.length === 0) {
      showMessage((loc.common as any)?.noResults || 'Brak utworów do odtworzenia', true);
      return;
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const queueItems: QueueItem[] = shuffled.map((t) => ({
      id: `track-${t.id}`,
      track_id: t.id,
      uri: t.path,
      title: t.title,
      artist: t.artist,
      album: albums.find((a) => a.id === t.album_id)?.title || null,
      duration_ms: (t.duration_ms || 0) > 0 ? t.duration_ms! : 0,
    }));

    try {
      await invoke('set_queue', { items: queueItems, startIndex: 0 });
      await invoke('set_shuffle', { enabled: true });
      await invoke('play');
      await refreshQueue();
      setActiveTrackId(shuffled[0].id);
      setFilePath(shuffled[0].path);
      showMessage(`🔀 Wymieszano i uruchomiono ${shuffled.length} utworów!`);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // 1.0: 1-klikowe profile sygnaturowe Auralune (Mastering Sound Profiles)
  const handleApplySignatureProfile = async (profileId: string) => {
    try {
      if (profileId === 'vocal_air') {
        await invoke('set_dsp_params', {
          engine: 'RubberBand',
          pitchSemitones: 0.0,
          tempoRatio: 1.0,
          rateRatio: 1.0,
        });
        const vocalBands = [0, 0, -1, 0, 0, 1.5, 2.5, 2.0, 1.5, 0];
        await invoke('set_equalizer_params', { enabled: true, bands: vocalBands });
        await invoke('set_stereo_widener', { active: true, amount: 0.35 });
        await invoke('set_limiter_enabled', { enabled: true });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'RubberBand',
          pitch_semitones: 0.0,
          tempo_ratio: 1.0,
          rate_ratio: 1.0,
          equalizer_enabled: true,
          equalizer_bands: vocalBands,
        }));
        showMessage('🌸 Zastosowano profil: Anime Vocal Air (Czysty wokal, poszerzona scena)');
      } else if (profileId === 'lofi_tape') {
        await invoke('set_dsp_params', {
          engine: 'SoundTouch',
          pitchSemitones: -0.5,
          tempoRatio: 0.94,
          rateRatio: 0.94,
        });
        const tapeBands = [2.5, 2.0, 1.0, 0, 0, 0, -1.0, -2.0, -3.0, -4.0];
        await invoke('set_equalizer_params', { enabled: true, bands: tapeBands });
        await invoke('set_crossfeed_config', {
          config: { enabled: true, preset: 'Default', fcut_hz: 700, feed_tenth_db: 45 },
        });
        vinylSimulator.setEnabled(true);
        vinylSimulator.setMode('tape');
        vinylSimulator.setIntensity(0.32);
        setStatus((prev) => ({
          ...prev,
          engine: 'SoundTouch',
          pitch_semitones: -0.5,
          tempo_ratio: 0.94,
          rate_ratio: 0.94,
          equalizer_enabled: true,
          equalizer_bands: tapeBands,
        }));
        showMessage('☕ Zastosowano profil: Midnight Lo-Fi Tape (Szum taśmy, ciepło analogu, crossfeed)');
      } else if (profileId === 'bit_perfect') {
        await invoke('set_dsp_params', {
          engine: 'Bypass',
          pitchSemitones: 0.0,
          tempoRatio: 1.0,
          rateRatio: 1.0,
        });
        await invoke('set_equalizer_params', { enabled: false, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
        await invoke('set_stereo_widener', { active: false, amount: 0.0 });
        await invoke('set_limiter_enabled', { enabled: false });
        await invoke('set_crossfeed_config', {
          config: { enabled: false, preset: 'Default', fcut_hz: 700, feed_tenth_db: 45 },
        });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'Bypass',
          pitch_semitones: 0.0,
          tempo_ratio: 1.0,
          rate_ratio: 1.0,
          equalizer_enabled: false,
          equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }));
        showMessage('🎧 Zastosowano profil: Audiophile Bit-Perfect (Passthrough bez DSP)');
      } else if (profileId === 'nightcore') {
        await invoke('set_dsp_params', {
          engine: 'RubberBand',
          pitchSemitones: 2.0,
          tempoRatio: 1.25,
          rateRatio: 1.25,
        });
        const clubBands = [3.0, 2.5, 0, 0, 1.0, 1.5, 2.0, 3.0, 3.5, 2.0];
        await invoke('set_equalizer_params', { enabled: true, bands: clubBands });
        await invoke('set_limiter_enabled', { enabled: true });
        await invoke('set_stereo_widener', { active: true, amount: 0.40 });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'RubberBand',
          pitch_semitones: 2.0,
          tempo_ratio: 1.25,
          rate_ratio: 1.25,
          equalizer_enabled: true,
          equalizer_bands: clubBands,
        }));
        showMessage('⚡ Zastosowano profil: Nightcore Club Anthem (+2 st, 1.25x, Limiter)');
      } else if (profileId === 'slowed') {
        await invoke('set_dsp_params', {
          engine: 'RubberBand',
          pitchSemitones: -1.5,
          tempoRatio: 0.84,
          rateRatio: 0.84,
        });
        const ambientBands = [2.5, 2.0, 1.0, 0, 0, 0, -1.0, -1.5, -2.0, -2.5];
        await invoke('set_equalizer_params', { enabled: true, bands: ambientBands });
        await invoke('set_stereo_widener', { active: true, amount: 0.55 });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'RubberBand',
          pitch_semitones: -1.5,
          tempo_ratio: 0.84,
          rate_ratio: 0.84,
          equalizer_enabled: true,
          equalizer_bands: ambientBands,
        }));
        showMessage('🌌 Zastosowano profil: Ambient Slowed & Space (0.84x, -1.5 st, Wide M/S)');
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
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
      showMessage(loc.player.bookmarkDeleted);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  // Skok do zapisanej zakładki
  const handleJumpToBookmark = async (pos: number) => {
    await handleSeek(pos);
    showMessage(loc.player.bookmarkJump.replace('{0}', formatTime(pos)));
  };

  // Sterowanie odtwarzaczem
  const handleLoadFile = async (path: string) => {
    try {
      setFilePath(path);
      const matchingTrack = tracks.find((t) => t.path === path || path.endsWith(t.path));
      if (matchingTrack) {
        setActiveTrackId(matchingTrack.id);
      }
      const matchingAlbum = matchingTrack ? albums.find((a) => a.id === matchingTrack.album_id) : null;
      const appCover = matchingAlbum?.release_mbid
        ? `https://coverartarchive.org/release/${matchingAlbum.release_mbid}/front-500`
        : (matchingAlbum?.cover_path || trackDirectCover || null);

      const filename = path.split('/').pop() || path;
      invoke('update_mpris_metadata', {
        title: matchingTrack?.title || filename,
        artist: matchingTrack?.artist || 'Plik lokalny',
        album: matchingAlbum?.title || 'Auralune Player',
        durationMs: matchingTrack?.duration_ms || 0,
        artUrl: appCover,
      }).catch(() => { });

      await invoke('load_file', { path });

      // Powiadomienie pulpitu Linuksa (libnotify / D-Bus)
      if (desktopNotificationsEnabled) {
        invoke('show_desktop_notification', {
          title: matchingTrack?.title || filename,
          body: matchingTrack?.artist || 'Plik lokalny',
          icon: null,
        }).catch(() => { });
      }

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
      if (activeDspVibe === vibe) {
        // Toggle off - ponowne kliknięcie wyłącza aktywny profil DSP (powrót do czystego Bypass)
        setActiveDspVibe(null);
        await invoke('set_dsp_engine', { engine: 'Bypass' });
        await invoke('set_tempo', { tempoRatio: 1.0 });
        await invoke('set_pitch', { semitones: 0.0 });
        await invoke('set_rate', { rateRatio: 1.0 });
        await invoke('set_equalizer_bands', { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
        await invoke('set_equalizer_enabled', { enabled: false });
        setStatus((prev) => ({
          ...prev,
          engine: 'Bypass',
          tempo_ratio: 1.0,
          pitch_semitones: 0.0,
          rate_ratio: 1.0,
          equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          equalizer_enabled: false,
        }));
        showMessage(t.notifications.dspVibeBypass);
        return;
      }

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
        msg = t.notifications.dspVibeNightcore;
      } else if (vibe === 'slowed') {
        targetTempo = 0.85;
        targetPitch = -2.0;
        targetRate = 1.0;
        bands = [4.5, 4.0, 3.0, 1.0, 0, 0, -1.0, -1.5, -2.5, -3.0];
        msg = t.notifications.dspVibeSlowed;
      } else if (vibe === 'vocal') {
        targetTempo = 1.0;
        targetPitch = 0.0;
        targetRate = 1.0;
        bands = [-2.0, -1.5, -1.0, 0, 1.5, 3.5, 4.0, 3.0, 1.5, 0.5];
        msg = t.notifications.dspVibeVocal;
      } else if (vibe === 'bass') {
        targetTempo = 1.0;
        targetPitch = 0.0;
        targetRate = 1.0;
        bands = [6.0, 5.5, 3.5, 1.0, 0, 0, 0, 0.5, 1.0, 1.0];
        msg = t.notifications.dspVibeBass;
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
      invoke('set_volume', { volume: preFadeVolumeRef.current }).catch(() => { });
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
          await invoke('pause').catch(() => { });
          setSleepTimerTargetMode(null);
          showMessage(t.notifications.sleepTimerTrackEnded);
        }
        return;
      }

      setSleepTimerRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          invoke('pause').catch(() => { });
          if (preFadeVolumeRef.current !== null) {
            invoke('set_volume', { volume: preFadeVolumeRef.current }).catch(() => { });
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
          invoke('set_volume', { volume: fadeVol }).catch(() => { });
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
        const currentUri = status.current_track?.uri || filePath;
        const targetResumePos = initialStartupPositionRef.current;
        if (currentUri && (!status.current_track?.duration_ms || status.duration_ms === 0 || targetResumePos !== null)) {
          try {
            await invoke('load_file', { path: currentUri });
          } catch (loadErr) {
            console.warn('load_file pre-check warning:', loadErr);
          }
        }
        await invoke('play');
        if (targetResumePos && targetResumePos > 1000) {
          initialStartupPositionRef.current = null;
          setTimeout(async () => {
            try {
              await invoke('seek', { positionMs: targetResumePos, fade: false });
            } catch (seekErr) {
              console.warn('Seek to restored position error:', seekErr);
            }
          }, 150);
        }
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

  const handleToggleStopAfterCurrent = async () => {
    try {
      const newVal = await invoke<boolean>('toggle_stop_after_current');
      setStatus((prev) => ({ ...prev, stop_after_current: newVal }));
      if (newVal) {
        showMessage(t.notifications.stopAfterCurrentOn);
      } else {
        showMessage(t.notifications.stopAfterCurrentOff);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const isPlayingQueueIndexRef = useRef(false);

  const handlePlayQueueIndex = async (index: number, queueItem?: QueueItem) => {
    initialStartupPositionRef.current = null;
    if (isPlayingQueueIndexRef.current) return;
    isPlayingQueueIndexRef.current = true;
    try {
      let targetIndex = index;
      if (queueItem && queue.items[targetIndex]?.id !== queueItem.id) {
        const found = queue.items.findIndex((it) => it.id === queueItem.id);
        if (found >= 0) targetIndex = found;
      }
      // Jeśli ten utwór już aktywnie gra, nie przeładowuj całego potoku
      if (targetIndex === queue.current_index && status.state === 'Playing') {
        return;
      }
      // Natychmiastowa aktualizacja optymistyczna (zero-freeze)
      setQueue((prev) => ({ ...prev, current_index: targetIndex }));
      setStatus((prev) => ({ ...prev, state: 'Playing' }));
      const item = await invoke<QueueItem | null>('play_queue_index', {
        index: targetIndex,
        expectedId: queueItem?.id ?? null,
      });
      await refreshQueue();
      if (item) {
        showMessage(t.notifications.playingMsg.replace('{0}', item.title));
        if (item.uri) setFilePath(item.uri);
        if (item.track_id) setActiveTrackId(item.track_id);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      isPlayingQueueIndexRef.current = false;
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

  const handleConfirmSaveQueueAsPlaylist = async (name: string) => {
    try {
      await invoke('save_queue_as_playlist', { name });
      await refreshPlaylists();
      showMessage(loc.queue.savedToPlaylist.replace('{0}', name));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleAddTrackToQueue = async (track: TrackRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const matchingAlb = track.album_id ? albums.find((a) => a.id === track.album_id) : null;
    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      track_id: track.id,
      uri: track.path,
      title: track.title,
      artist: track.artist,
      album: matchingAlb?.title || null,
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
    const matchingAlb = track.album_id ? albums.find((a) => a.id === track.album_id) : null;
    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      track_id: track.id,
      uri: track.path,
      title: track.title,
      artist: track.artist,
      album: matchingAlb?.title || null,
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
    } catch (err: any) {
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
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  };

  const handleToggleCloseToTray = async (enabled: boolean) => {
    setCloseToTray(enabled);
    try {
      await invoke('set_app_setting', { key: 'close_to_tray', value: String(enabled) });
      showMessage(
        enabled
          ? t.notifications.minimizeTrayOn
          : t.notifications.minimizeTrayOff
      );
    } catch (e: any) {
      console.warn('Błąd zapisu close_to_tray:', e);
    }
  };

  const handleToggleDiscordRpc = async (enabled: boolean) => {
    setDiscordRpcEnabled(enabled);
    try {
      await invoke('set_discord_rpc_enabled', { enabled });
      showMessage(
        enabled
          ? t.notifications.discordRpcOn
          : t.notifications.discordRpcOff
      );
      const st = await invoke<{ enabled: boolean; connected: boolean; client_id: string }>('get_discord_rpc_status');
      if (st) {
        setDiscordRpcConnected(st.connected);
      }
    } catch (e: any) {
      console.warn('Błąd set_discord_rpc_enabled:', e);
    }
  };

  const handleSaveDiscordClientId = async (newId: string) => {
    const finalId = newId.trim() || '1563876157387186226';
    setDiscordClientId(finalId);
    setDiscordClientId(finalId);
    setIsEditingDiscordClientId(false);
    try {
      await invoke('set_discord_rpc_client_id', { clientId: finalId });
      showMessage('Zaktualizowano identyfikator Discord Application ID');
    } catch (e: any) {
      console.warn('Błąd set_discord_rpc_client_id:', e);
    }
  };

  useEffect(() => {
    if (!isSettingsOpen) return;
    const interval = setInterval(() => {
      invoke<{ enabled: boolean; connected: boolean; client_id: string }>('get_discord_rpc_status')
        .then((st) => {
          if (st) {
            setDiscordRpcEnabled(st.enabled);
            setDiscordRpcConnected(st.connected);
            if (!isEditingDiscordClientId) {
              setDiscordClientId(st.client_id || '1563876157387186226');
              setDiscordClientId(st.client_id || '1563876157387186226');
            }
          }
        })
        .catch(() => { });
    }, 3000);
    return () => clearInterval(interval);
  }, [isSettingsOpen, isEditingDiscordClientId]);

  useEffect(() => {
    if (isSettingsOpen && settingsTab === 'transcode') {
      const curPath = currentPlayingTrack?.path || status.current_track?.uri;
      if (curPath && (!filePath || filePath === 'tests/fixtures/test_sine_440hz.wav')) {
        let clean = curPath;
        if (clean.startsWith('file://')) {
          try {
            clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
          } catch {
            clean = clean.replace(/^file:\/\//, '');
          }
        }
        setFilePath(clean);
      }

      // Jeśli w odtwarzaczu jest zdefiniowana aktywna pętla A-B, natychmiast synchronizujemy ją do formularza eksportu!
      if (loopPointA !== null || loopPointB !== null) {
        const strA = loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000';
        const strB = loopPointB !== null ? formatTimeMs(loopPointB) : '';
        setTranscodeRangeA(strA);
        setTranscodeRangeB(strB);
        setTranscodeApplyRange(true);

        const targetSource = curPath || filePath;
        if (targetSource) {
          let clean = targetSource;
          if (clean.startsWith('file://')) {
            try {
              clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
            } catch {
              clean = clean.replace(/^file:\/\//, '');
            }
          }
          const lastDot = clean.lastIndexOf('.');
          let base = lastDot > 0 ? clean.substring(0, lastDot) : clean;
          base = base.replace(/_loop_\d+-(?:\d+|end)$/i, '');
          const suffix = `_loop_${loopPointA !== null ? loopPointA : 0}-${loopPointB !== null ? loopPointB : 'end'}`;
          setTranscodeOutput(`${base}${suffix}.${transcodeFormat.toLowerCase()}`);
        }
      }
    }
  }, [isSettingsOpen, settingsTab, loopPointA, loopPointB, currentPlayingTrack, status.current_track]);

  const handleTestListenbrainz = async () => {
    if (!listenbrainzToken.trim()) {
      setListenbrainzStatusMsg(loc.settings.listenbrainzInvalid);
      return;
    }
    setListenbrainzTesting(true);
    setListenbrainzStatusMsg(null);
    try {
      const userName = await invoke<string>('validate_listenbrainz_token', { token: listenbrainzToken.trim() });
      setListenbrainzUser(userName);
      setListenbrainzStatusMsg(`${loc.settings.listenbrainzValid}: @${userName}`);
      await invoke('set_app_setting', { key: 'listenbrainz_token', value: listenbrainzToken.trim() });
      showMessage(`ListenBrainz: Zalogowano jako @${userName}`);
    } catch (err: any) {
      setListenbrainzUser(null);
      setListenbrainzStatusMsg(`${loc.settings.listenbrainzInvalid}: ${String(err)}`);
    } finally {
      setListenbrainzTesting(false);
    }
  };

  const handleToggleListenbrainz = async (enabled: boolean) => {
    setListenbrainzEnabled(enabled);
    try {
      await invoke('set_app_setting', { key: 'listenbrainz_enabled', value: enabled ? 'true' : 'false' });
      showMessage(
        enabled
          ? t.notifications.listenbrainzOn
          : t.notifications.listenbrainzOff
      );
    } catch (e) {
      console.warn('Błąd zapisu listenbrainz_enabled:', e);
    }
  };

  const handleListenbrainzTokenChange = async (token: string) => {
    setListenbrainzToken(token);
    try {
      await invoke('set_app_setting', { key: 'listenbrainz_token', value: token });
    } catch (e) {
      console.warn('Błąd zapisu listenbrainz_token:', e);
    }
  };

  const handleConnectLastfm = async () => {
    setLastfmTesting(true);
    setLastfmStatusMsg(null);
    try {
      const res = await invoke<{ token: string; auth_url: string }>('lastfm_get_auth_url', {
        apiKey: lastfmCustomKey.trim() || null,
      });
      setLastfmPendingToken(res.token);
      window.open(res.auth_url, '_blank');
      setLastfmStatusMsg(loc.settings.lastfmAuthWaiting);
    } catch (err: any) {
      setLastfmStatusMsg(`${loc.settings.lastfmInvalidSession}: ${String(err)}`);
    } finally {
      setLastfmTesting(false);
    }
  };

  const handleConfirmLastfmAuth = async () => {
    if (!lastfmPendingToken) return;
    setLastfmTesting(true);
    try {
      const session = await invoke<{ username: string; session_key: string }>('lastfm_fetch_session', {
        token: lastfmPendingToken,
        apiKey: lastfmCustomKey.trim() || null,
        apiSecret: lastfmCustomSecret.trim() || null,
      });
      setLastfmSessionKey(session.session_key);
      setLastfmUsername(session.username);
      setLastfmPendingToken(null);
      setLastfmStatusMsg(`${loc.settings.lastfmConnectedAs}: @${session.username}`);
      await invoke('set_app_setting', { key: 'lastfm_session_key', value: session.session_key });
      await invoke('set_app_setting', { key: 'lastfm_username', value: session.username });
      showMessage(t.notifications.lastfmLoginSuccess.replace('{0}', session.username));
    } catch (err: any) {
      setLastfmStatusMsg(`${loc.settings.lastfmInvalidSession}: ${String(err)}`);
    } finally {
      setLastfmTesting(false);
    }
  };

  const handleDisconnectLastfm = async () => {
    setLastfmSessionKey('');
    setLastfmUsername(null);
    setLastfmPendingToken(null);
    setLastfmStatusMsg(null);
    await invoke('set_app_setting', { key: 'lastfm_session_key', value: '' });
    await invoke('set_app_setting', { key: 'lastfm_username', value: '' });
    showMessage(t.notifications.lastfmDisconnected);
  };

  const handleManualLastfmSessionKeyChange = async (key: string) => {
    setLastfmSessionKey(key);
    await invoke('set_app_setting', { key: 'lastfm_session_key', value: key });
  };

  const handleValidateLastfmSession = async () => {
    if (!lastfmSessionKey.trim()) return;
    setLastfmTesting(true);
    try {
      const user = await invoke<string>('lastfm_validate_session', {
        sessionKey: lastfmSessionKey.trim(),
        apiKey: lastfmCustomKey.trim() || null,
        apiSecret: lastfmCustomSecret.trim() || null,
      });
      setLastfmUsername(user);
      setLastfmStatusMsg(`${loc.settings.lastfmConnectedAs}: @${user}`);
      await invoke('set_app_setting', { key: 'lastfm_username', value: user });
      showMessage(t.notifications.lastfmConnected.replace('{0}', user));
    } catch (err: any) {
      setLastfmStatusMsg(`${loc.settings.lastfmInvalidSession}: ${String(err)}`);
    } finally {
      setLastfmTesting(false);
    }
  };

  const handleToggleLastfm = async (enabled: boolean) => {
    setLastfmEnabled(enabled);
    try {
      await invoke('set_app_setting', { key: 'lastfm_enabled', value: enabled ? 'true' : 'false' });
      showMessage(
        enabled
          ? t.notifications.lastfmOn
          : t.notifications.lastfmOff
      );
    } catch (e) {
      console.warn('Błąd zapisu lastfm_enabled:', e);
    }
  };

  const handleSaveLastfmCustomKeys = async (key: string, secret: string) => {
    setLastfmCustomKey(key);
    setLastfmCustomSecret(secret);
    await invoke('set_app_setting', { key: 'lastfm_custom_key', value: key });
    await invoke('set_app_setting', { key: 'lastfm_custom_secret', value: secret });
  };

  const handleCrossfadeDurationChange = async (ms: number) => {
    const clamped = Math.max(0, Math.min(8000, ms));
    setCrossfadeDuration(clamped);
    try {
      await invoke('set_crossfade_duration', { durationMs: clamped });
      await invoke('set_app_setting', { key: 'crossfade_duration', value: clamped.toString() });
    } catch (e) {
      console.warn('Błąd zapisu crossfade_duration:', e);
    }
  };

  const handleTrackKeyBpmUpdated = (trackId: number, bpm: number, keyName: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, bpm, initial_key: keyName } : t))
    );
  };

  const handleBassBoostChange = async (boostDb: number) => {
    const clamped = Math.max(0, Math.min(12, boostDb));
    setBassBoost(clamped);
    if (clamped > 0) {
      lastBassBoostRef.current = clamped;
    }
    try {
      await invoke('set_app_setting', { key: 'bass_boost', value: clamped.toString() });
      const baseBands = [...(status.equalizer_bands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])];
      baseBands[0] = Math.min(12, Math.max(-24, clamped * 1.0));
      baseBands[1] = Math.min(12, Math.max(-24, clamped * 0.75));
      baseBands[2] = Math.min(12, Math.max(-24, clamped * 0.4));
      await invoke('set_equalizer_params', { enabled: true, bands: baseBands });
      setStatus((prev) => ({ ...prev, equalizer_bands: baseBands, equalizer_enabled: true }));
      if (clamped > 0 && !limiterEnabled) {
        handleToggleLimiter(true);
      }
      showMessage(
        clamped > 0
          ? t.notifications.bassBoostOn.replace('{0}', clamped.toFixed(1))
          : t.notifications.bassBoostOff
      );
    } catch (e) {
      console.warn('Błąd ustawiania Bass Boost:', e);
    }
  };

  const handleToggleStereoWidener = async (active: boolean) => {
    setStereoWidenerActive(active);
    try {
      await invoke('set_stereo_widener', { active, amount: stereoWidenerAmount });
      await invoke('set_app_setting', { key: 'stereo_widener_active', value: active ? 'true' : 'false' });
      showMessage(
        active
          ? t.notifications.stereoWidenerOn.replace('{0}', Math.round(stereoWidenerAmount * 100).toString())
          : t.notifications.stereoWidenerOff
      );
    } catch (e) {
      console.warn('Błąd przełączania stereo widenera:', e);
    }
  };

  const handleStereoWidenerAmountChange = async (amt: number) => {
    const clamped = Math.max(0, Math.min(1, amt));
    setStereoWidenerAmount(clamped);
    setStereoWidenerActive(true);
    try {
      await invoke('set_stereo_widener', { active: true, amount: clamped });
      await invoke('set_app_setting', { key: 'stereo_widener_amount', value: clamped.toString() });
      await invoke('set_app_setting', { key: 'stereo_widener_active', value: 'true' });
    } catch (e) {
      console.warn('Błąd ustawiania stereo widenera:', e);
    }
  };

  const handleToggleLimiter = async (enabled: boolean) => {
    setLimiterEnabled(enabled);
    try {
      await invoke('set_limiter_enabled', { enabled });
      await invoke('set_app_setting', { key: 'limiter_enabled', value: enabled ? 'true' : 'false' });
      showMessage(
        enabled
          ? t.notifications.limiterOn
          : t.notifications.limiterOff
      );
    } catch (e) {
      console.warn('Błąd przełączania limitera:', e);
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
          key: 'dsp_default_engine',
          value: status.engine,
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
        setDspDefaultEngine(status.engine as any);
        showMessage(t.notifications.dspAutostartOn);
      } else {
        showMessage(t.notifications.dspAutostartOff);
      }
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSetDefaultDspEngine = async (eng: 'Bypass' | 'RubberBand' | 'SoundTouch') => {
    setDspDefaultEngine(eng);
    try {
      await invoke('set_app_setting', {
        key: 'dsp_default_engine',
        value: eng,
      });
      showMessage(
        t.notifications.dspStartupEngineSaved.replace('{0}', eng === 'Bypass' ? 'Direct Bypass' : eng)
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSetAudioBuffer = async (val: number) => {
    const clamped = Math.max(50, Math.min(4000, Math.round(val)));
    setAudioBufferMs(clamped);
    try {
      await invoke('set_audio_buffer_duration_ms', { bufferMs: clamped });
      showMessage(
        t.notifications.audioBufferSet.replace('{0}', String(clamped)).replace('{1}', clamped === 600 ? ' (default)' : '')
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleSetDspBlockSize = async (size: number) => {
    const clamped = Math.max(256, Math.min(16384, Math.round(size)));
    setDspBlockSize(clamped);
    try {
      await invoke('set_dsp_block_size', { blockSize: clamped });
      showMessage(
        t.notifications.dspBlockSizeSet.replace('{0}', String(clamped)).replace('{1}', clamped === 2048 ? ' (default)' : '')
      );
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
        key: 'dsp_default_engine',
        value: status.engine,
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
      setDspDefaultEngine(status.engine as any);
      setDspAutoStartup(true);
      dspAutoStartupRef.current = true;
      showMessage(`${t.notifications.dspSavedAsStartup} (${status.engine})`);
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

  const handleCycleDspEngine = async () => {
    const engines: ('Bypass' | 'RubberBand' | 'SoundTouch')[] = ['Bypass', 'RubberBand', 'SoundTouch'];
    const curIdx = engines.indexOf(status.engine as any);
    const nextEngine = engines[(curIdx + 1) % engines.length];
    await handleEngineChange(nextEngine);
  };

  const handleResetBitPerfect = async () => {
    try {
      await handleResetDsp();
      await handleEngineChange('Bypass');
      if (status.equalizer_enabled) {
        await invoke('set_equalizer_enabled', { enabled: false });
        setStatus((prev) => ({ ...prev, equalizer_enabled: false }));
      }
      showMessage(t.notifications.resetBitPerfect);
    } catch (err: any) {
      console.error('Failed to reset bit-perfect:', err);
    }
  };

  const handleRestoreOriginalTrack = async () => {
    try {
      await invoke('restore_original_track');
      showMessage(t.notifications.restoredOriginalTrack);
    } catch (err: any) {
      showMessage(t.notifications.restoreOriginalTrackError.replace('{0}', String(err)), true);
    }
  };

  useEffect(() => {
    if (!isDspQuickMenuOpen) return;
    const handleOutsideClick = () => setIsDspQuickMenuOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isDspQuickMenuOpen]);

  useEffect(() => {
    if (!isEqPresetMenuOpen) return;
    const handleOutsideClick = () => setIsEqPresetMenuOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEqPresetMenuOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEqPresetMenuOpen]);

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
        return { ...prev, equalizer_bands: newBands, equalizer_enabled: true };
      });
      setSelectedEqPreset(t.notifications.eqCustom);
    } catch (e: any) {
      console.error('Błąd zmiany pasma EQ:', e);
    }
  };

  const handleEqToggle = async () => {
    const newEnabled = !status.equalizer_enabled;
    try {
      await invoke('set_equalizer_enabled', { enabled: newEnabled });
      setStatus((prev) => ({ ...prev, equalizer_enabled: newEnabled }));
      showMessage(newEnabled ? t.notifications.eqEnabledMsg : t.notifications.eqDisabledMsg);
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleApplyEqPreset = async (presetName: string) => {
    let targetBands: number[] | null = null;
    let targetName = presetName;

    const preset = eqPresets.find(
      (p) =>
        p.name === presetName ||
        getEqPresetDisplayName(p.name, true) === presetName ||
        getEqPresetDisplayName(p.name, false) === presetName
    );

    if (preset) {
      targetBands = preset.bands;
      targetName = preset.name;
    } else if (presetName === 'Flat' || presetName === 'Płaski (Flat)') {
      targetBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      targetName = t.notifications.eqFlat;
    }

    if (!targetBands) return;

    setSelectedEqPreset(targetName);
    setIsEqPresetMenuOpen(false);

    try {
      await invoke('set_equalizer_params', { enabled: true, bands: targetBands });
      await invoke('set_equalizer_bands', { bands: targetBands }).catch(() => {});
      setStatus((prev) => ({ ...prev, equalizer_bands: [...targetBands], equalizer_enabled: true }));
      showMessage(
        t.notifications.eqAppliedPreset.replace('{0}', getEqPresetDisplayName(targetName, loc))
      );
    } catch (e: any) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  };

  const handleResetEq = async () => {
    const flatBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    try {
      await invoke('set_equalizer_params', { enabled: true, bands: flatBands });
      await invoke('set_equalizer_bands', { bands: flatBands }).catch(() => {});
      await invoke('set_equalizer_preamp', { preampDb: 0.0 }).catch(() => {});
      setSelectedEqPreset(t.notifications.eqFlat);
      setIsEqPresetMenuOpen(false);
      setStatus((prev) => ({ ...prev, equalizer_bands: flatBands, equalizer_enabled: true }));
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

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ============================================
  // ============================================
  // OBSŁUGA GLOBALNYCH SKRÓTÓW KLAWISZOWYCH
  // ============================================
  // ============================================
  // ZARZĄDZANIE TRANSKODOWANIEM & EKSPORTEM AUDIO
  // ============================================
  const {
    transcodeOutput,
    setTranscodeOutput,
    transcodeFormat,
    setTranscodeFormat,
    transcodeBitrate,
    setTranscodeBitrate,
    transcodeApplyDsp,
    setTranscodeApplyDsp,
    transcodeApplyRange,
    setTranscodeApplyRange,
    transcodeRangeA,
    setTranscodeRangeA,
    transcodeRangeB,
    setTranscodeRangeB,
    transcodeAutoEnqueue,
    setTranscodeAutoEnqueue,
    isTranscoding,
    transcodeProgress,
    transcodeElapsedSeconds,
    lastExportedTrack,
    setLastExportedTrack,
    isPickingSource,
    isPickingDestination,
    handlePickTranscodeSource,
    handlePickTranscodeDestination,
    handleUseCurrentTrackAsSource,
    handleExportLoopFromModal,
    handleSaveLoopAsBookmarks,
    handleTranscode,
  } = useTranscodeManager({
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
    setIsSettingsOpen,
    refreshTrackBookmarks,
    handleAddTrackToQueue,
    loadLibrary,
    setTracks,
    setAlbums,
  });

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
        <AppHeader
          appVersion={appVersion}
          appIconStyle={appIconStyle}
          activeTab={activeTab as any}
          onSelectTab={(tab) => setActiveTab(tab as any)}
          trackCount={tracks.length}
          playlistCount={playlists.length}
          queueCount={queue.items.length}
          language={language}
          loc={loc}
          onOpenRecap={() => setIsRecapModalOpen(true)}
          onOpenKeyBpm={() => setIsKeyBpmModalOpen(true)}
          onOpenAnalysis={() => setIsAnalysisModalOpen(true)}
          isSleepTimerOpen={isSleepTimerOpen}
          onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
          sleepTimerRemainingSec={sleepTimerRemainingSec}
          sleepTimerTargetMode={sleepTimerTargetMode}
          showLyrics={showLyrics}
          onToggleLyrics={() => setShowLyrics(prev => !prev)}
          showDesktopLyrics={showDesktopLyrics}
          onToggleDesktopLyrics={toggleDesktopLyrics}
          ambienceMode={ambienceMode}
          onCycleAmbience={cycleAmbienceMode}
          isSoundscapeActive={soundscapeEngine.isSoundscapeActive()}
          onOpenSoundscape={() => setIsSoundscapeOpen(true)}
          onOpenHarmonicSuggester={() => setIsHarmonicSuggesterOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenBigScreen={() => setIsBigScreen(true)}
          uiScale={uiScale}
          onIncreaseScale={handleIncreaseScale}
          onDecreaseScale={handleDecreaseScale}
          onToggleMiniPlayer={toggleMiniPlayer}
          isQueueOpen={isQueueOpen}
          onToggleQueue={() => setIsQueueOpen(prev => !prev)}
          isSettingsOpen={isSettingsOpen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLanguageChange={setLanguage}
        />

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
        <main ref={mainContentRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: (activeTab !== 'player' || isPlayerScrolledDown) ? '88px' : '0' }}>
          {/* ZAKŁADKA 1: ODTWARZACZ (NOWOCZESNY WIDOK HI-FI DESKTOP) */}
          {activeTab === 'player' && (
            <PlayerView
              layoutMaxWidth={layoutMaxWidth}
              language={language}
              loc={loc}
              status={status}
              activeTrackId={activeTrackId}
              currentPlayingTrack={currentPlayingTrack}
              tracks={tracks}
              albums={albums}
              currentAlbum={currentAlbum}
              currentCover={currentCover}
              cleanLiveTitle={cleanLiveTitle}
              effectiveDisplayTitle={effectiveDisplayTitle}
              effectiveDisplayArtist={effectiveDisplayArtist}
              filePath={filePath}
              setFilePath={setFilePath}
              seekProgressPercent={seekProgressPercent}
              volumeProgressPercent={volumeProgressPercent}
              volumeUnit={volumeUnit}
              formatVolumeValue={formatVolumeValue}
              handleToggleVolumeUnit={handleToggleVolumeUnit}
              seekFadeEnabled={seekFadeEnabled}
              handleToggleSeekFade={handleToggleSeekFade}
              infinityQueue={infinityQueue}
              handleToggleInfinityQueue={handleToggleInfinityQueue}
              sleepTimerRemainingSec={sleepTimerRemainingSec}
              sleepTimerTargetMode={sleepTimerTargetMode}
              setIsSleepTimerOpen={setIsSleepTimerOpen}
              setIsAudioPathModalOpen={setIsAudioPathModalOpen}
              setIsLoFiModalOpen={setIsLoFiModalOpen}
              setIsShortcutsModalOpen={setIsShortcutsModalOpen}
              setIsLoopEditorOpen={setIsLoopEditorOpen}
              setIsBookmarksModalOpen={setIsBookmarksModalOpen}
              setIsSaveQueueModalOpen={setIsSaveQueueModalOpen}
              setStatsModalTrack={setStatsModalTrack}
              setActiveTab={setActiveTab}
              showLyrics={showLyrics}
              setShowLyrics={setShowLyrics}
              nowPlayingVisualMode={nowPlayingVisualMode}
              handleSelectNowPlayingVisualMode={handleSelectNowPlayingVisualMode}
              vinylRpm={vinylRpm}
              handleSelectVinylRpm={handleSelectVinylRpm}
              tapeSpeed={tapeSpeed}
              handleSelectTapeSpeed={handleSelectTapeSpeed}
              tapeType={tapeType}
              handleSelectTapeType={handleSelectTapeType}
              activeDspVibe={activeDspVibe}
              handleApplyDspVibe={handleApplyDspVibe}
              dspBadgeText={dspBadgeText}
              dspBadgeTitle={dspBadgeTitle}
              dspCombination={dspCombination}
              lastActiveDspEngineRef={lastActiveDspEngineRef}
              trackWaveformPeaks={trackWaveformPeaks}
              loopPointA={loopPointA}
              setLoopPointA={setLoopPointA}
              loopPointB={loopPointB}
              setLoopPointB={setLoopPointB}
              currentBookmark={currentBookmark}
              currentTrackBookmarks={currentTrackBookmarks}
              handleSaveBookmark={handleSaveBookmark}
              handleDeleteBookmark={handleDeleteBookmark}
              handleJumpToBookmark={handleJumpToBookmark}
              queue={queue}
              filteredQueueItems={filteredQueueItems}
              queueSearchQuery={queueSearchQuery}
              setQueueSearchQuery={setQueueSearchQuery}
              queueColumns={queueColumns}
              isColumnConfigOpen={isColumnConfigOpen}
              setIsColumnConfigOpen={setIsColumnConfigOpen}
              toggleQueueColumn={toggleQueueColumn}
              resetQueueColumns={resetQueueColumns}
              isQuickLoadOpen={isQuickLoadOpen}
              setIsQuickLoadOpen={setIsQuickLoadOpen}
              draggedQueueIdx={draggedQueueIdx}
              dragOverQueueIdx={dragOverQueueIdx}
              handleQueueDragStart={handleQueueDragStart}
              handleQueueDragOver={handleQueueDragOver}
              handleQueueDrop={handleQueueDrop}
              handleMoveQueueItem={handleMoveQueueItem}
              handlePlayQueueIndex={handlePlayQueueIndex}
              handleRemoveFromQueue={handleRemoveFromQueue}
              handleClearQueue={handleClearQueue}
              totalQueueDurationMs={totalQueueDurationMs}
              formatTotalDuration={formatTotalDuration}
              queueListRef={queueListRef}
              queueStartIndex={queueStartIndex}
              queueEndIndex={queueEndIndex}
              queueTopSpacer={queueTopSpacer}
              queueBottomSpacer={queueBottomSpacer}
              handleSeek={handleSeek}
              handlePlayPause={handlePlayPause}
              handleStop={handleStop}
              handlePrevious={handlePrevious}
              handleNext={handleNext}
              handleToggleShuffle={handleToggleShuffle}
              handleCycleLoopMode={handleCycleLoopMode}
              handleToggleStopAfterCurrent={handleToggleStopAfterCurrent}
              handleToggleMute={handleToggleMute}
              handleVolumeChange={handleVolumeChange}
              handlePitchChange={handlePitchChange}
              handleTempoChange={handleTempoChange}
              handleEngineChange={handleEngineChange}
              handleToggleFavorite={handleToggleFavorite}
              handleOpenContainingFolder={handleOpenContainingFolder}
              handleOpenCoverPicker={handleOpenCoverPicker}
              handleUploadCustomCoverDirect={handleUploadCustomCoverDirect}
              handleRestoreOriginalTrack={handleRestoreOriginalTrack}
              handleLoadFile={handleLoadFile}
              handlePickFiles={handlePickFiles}
              formatTime={formatTime}
              formatTimeMs={formatTimeMs}
              showMessage={showMessage}
            />
          )}
          {activeTab === 'library' && (
            <LibraryView
              layoutMaxWidth={layoutMaxWidth}
              currentLang={language}
              language={language}
              loc={loc}
              tracks={tracks}
              albums={albums}
              filteredTracks={filteredTracks}
              sortedTracks={sortedTracks}
              filteredAlbums={filteredAlbums}
              sortedAlbums={sortedAlbums}
              filteredArtists={filteredArtists}
              activeTrackId={activeTrackId}
              currentPlayingTrack={currentPlayingTrack}
              status={status}
              librarySubView={librarySubView}
              setLibrarySubView={setLibrarySubView}
              librarySearch={librarySearch}
              setLibrarySearch={setLibrarySearch}
              librarySearchInputRef={librarySearchInputRef}
              libraryFormatFilter={libraryFormatFilter}
              setLibraryFormatFilter={setLibraryFormatFilter}
              isFacetsFilterEnabled={isFacetsFilterEnabled}
              setIsFacetsFilterEnabled={setIsFacetsFilterEnabled}
              facetSelectedArtist={facetSelectedArtist}
              setFacetSelectedArtist={setFacetSelectedArtist}
              facetSelectedAlbumId={facetSelectedAlbumId}
              setFacetSelectedAlbumId={setFacetSelectedAlbumId}
              facetSelectedFormat={facetSelectedFormat}
              setFacetSelectedFormat={setFacetSelectedFormat}
              smartPlaylistFilter={smartPlaylistFilter}
              setSmartPlaylistFilter={setSmartPlaylistFilter}
              hideDuplicates={hideDuplicates}
              setHideDuplicates={setHideDuplicates}
              sortField={sortField}
              setSortField={setSortField}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              handleSort={handleSort}
              albumSortField={albumSortField}
              setAlbumSortField={setAlbumSortField}
              albumSortOrder={albumSortOrder}
              setAlbumSortOrder={setAlbumSortOrder}
              albumGridSize={albumGridSize}
              setAlbumGridSize={setAlbumGridSize}
              albumViewMode={albumViewMode}
              setAlbumViewMode={setAlbumViewMode}
              albumCoverFilter={albumCoverFilter}
              setAlbumCoverFilter={setAlbumCoverFilter}
              albumsWithCoverCount={albumsWithCoverCount}
              albumsWithoutCoverCount={albumsWithoutCoverCount}
              selectedAlbumDetail={selectedAlbumDetail}
              handleOpenAlbumDetail={handleOpenAlbumDetail}
              handleBackFromAlbumDetail={handleBackFromAlbumDetail}
              selectedAlbumForMb={selectedAlbumForMb}
              setSelectedAlbumForMb={setSelectedAlbumForMb}
              handleOpenMbModal={handleOpenMbModal}
              mbSearchTitle={mbSearchTitle}
              setMbSearchTitle={setMbSearchTitle}
              mbSearchArtist={mbSearchArtist}
              setMbSearchArtist={setMbSearchArtist}
              mbCandidates={mbCandidates}
              isSearchingMb={isSearchingMb}
              isFetchingCover={isFetchingCover}
              handleSearchMusicBrainz={handleSearchMusicBrainz}
              handleSelectCandidateAndFetchCover={handleSelectCandidateAndFetchCover}
              handleOpenCoverPicker={handleOpenCoverPicker}
              handlePlayLibraryTrack={handlePlayLibraryTrack}
              handleAddTrackToQueue={handleAddTrackToQueue}
              handleAddTrackNextToQueue={handleAddTrackNextToQueue}
              handlePlayAlbum={handlePlayAlbum}
              handleAddAlbumToQueue={handleAddAlbumToQueue}
              handleToggleFavorite={handleToggleFavorite}
              handleSetTrackRating={handleSetTrackRating}
              handleScanTrackReplayGain={handleScanTrackReplayGain}
              handleOpenContainingFolder={handleOpenContainingFolder}
              handleShuffleAll={handleShuffleAll}
              setTagEditorTrack={setTagEditorTrack}
              setStatsModalTrack={setStatsModalTrack}
              setTrackToAddToPlaylist={setTrackToAddToPlaylist}
              setShowPlaylistModal={setShowPlaylistModal}
              setCreateStemProjectTrack={setCreateStemProjectTrack}
              setIsCreateStemProjectOpen={setIsCreateStemProjectOpen}
              setIsCueModalOpen={setIsCueModalOpen}
              setIsDuplicateFinderOpen={setIsDuplicateFinderOpen}
              setIsFileRenamerOpen={setIsFileRenamerOpen}
              setIsUrlImportModalOpen={setIsUrlImportModalOpen}
              setShowDownloadHub={setShowDownloadHub}
              isScanFolderOpen={isScanFolderOpen}
              setIsScanFolderOpen={setIsScanFolderOpen}
              scanFolder={scanFolder}
              setScanFolder={setScanFolder}
              handlePickFolder={handlePickFolder}
              handlePickFiles={handlePickFiles}
              handleScanLibrary={handleScanLibrary}
              isScanning={isScanning}
              scanResult={scanResult}
              refreshQueue={refreshQueue}
              loadLibrary={loadLibrary}
              showMessage={showMessage}
              libraryTableRef={libraryTableRef}
              trackStartIndex={trackStartIndex}
              trackEndIndex={trackEndIndex}
              trackTopSpacer={trackTopSpacer}
              trackBottomSpacer={trackBottomSpacer}
              formatTime={formatTime}
            />
          )}
          {activeTab === 'dsp' && (
            <DspStudioView
              uiScale={uiScale}
              loc={loc}
              language={language}
              currentLang={language}
              status={status}
              activeTrackKeyBpm={activeTrackKeyBpm}
              dspAutoStartup={dspAutoStartup}
              dspDefaultEngine={dspDefaultEngine}
              dspBlockSize={dspBlockSize}
              dspCombination={dspCombination}
              bassBoost={bassBoost}
              lastBassBoostRef={lastBassBoostRef}
              stereoWidenerActive={stereoWidenerActive}
              stereoWidenerAmount={stereoWidenerAmount}
              limiterEnabled={limiterEnabled}
              crossfeedEnabled={crossfeedEnabled}
              crossfeedPreset={crossfeedPreset}
              crossfeedFcut={crossfeedFcut}
              crossfeedFeed={crossfeedFeed}
              reverbEnabled={reverbEnabled}
              reverbRoomSize={reverbRoomSize}
              reverbDamping={reverbDamping}
              reverbWidth={reverbWidth}
              reverbLevel={reverbLevel}
              presets={presets}
              eqAutoStartup={eqAutoStartup}
              selectedEqPreset={selectedEqPreset}
              eqPresets={eqPresets}
              newPresetName={newPresetName}
              setNewPresetName={setNewPresetName}
              handleToggleDspAutoStartup={handleToggleDspAutoStartup}
              handleSaveDspStartupDefault={handleSaveDspStartupDefault}
              handleResetDsp={handleResetDsp}
              handleEngineChange={handleEngineChange}
              handleSetDspBlockSize={handleSetDspBlockSize}
              handlePitchChange={handlePitchChange}
              handleTempoChange={handleTempoChange}
              handleRateChange={handleRateChange}
              handleBassBoostChange={handleBassBoostChange}
              handleToggleStereoWidener={handleToggleStereoWidener}
              handleStereoWidenerAmountChange={handleStereoWidenerAmountChange}
              handleToggleLimiter={handleToggleLimiter}
              handleSetCrossfeed={handleSetCrossfeed}
              handleUpdateReverb={handleUpdateReverb}
              handleLoadPreset={handleLoadPreset}
              handleSavePreset={handleSavePreset}
              handleApplySignatureProfile={handleApplySignatureProfile}
              handleToggleEqAutoStartup={handleToggleEqAutoStartup}
              handleApplyEqPreset={handleApplyEqPreset}
              getEqPresetDisplayName={getEqPresetDisplayName}
              handleResetEq={handleResetEq}
              handleEqToggle={handleEqToggle}
              handleEqBandChange={handleEqBandChange}
              setIsParametricEqOpen={setIsParametricEqOpen}
              setIsAutoEqOpen={setIsAutoEqOpen}
              setIsDynamicsStudioOpen={setIsDynamicsStudioOpen}
              showMessage={showMessage}
            />
          )}
          {activeTab === 'playlists' && (
            <PlaylistsView
              layoutMaxWidth={layoutMaxWidth}
              loc={loc}
              playlists={playlists}
              newPlaylistName={newPlaylistName}
              onNewPlaylistNameChange={setNewPlaylistName}
              onCreatePlaylist={handleCreatePlaylist}
              onImportPlaylistM3u8={handleImportPlaylistM3u8}
              selectedPlaylist={selectedPlaylist}
              onSelectPlaylist={setSelectedPlaylist}
              playlistTracks={playlistTracks}
              onSetPlaylistTracks={setPlaylistTracks}
              onPlayLibraryTrack={handlePlayLibraryTrack}
              refreshQueue={refreshQueue}
              showMessage={showMessage}
              onExportPlaylistM3u8={handleExportPlaylistM3u8}
              onDeletePlaylist={handleDeletePlaylist}
              formatTime={formatTime}
              onAddTrackToQueue={handleAddTrackToQueue}
              onOpenContainingFolder={handleOpenContainingFolder}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onOpenPlaylist={handleOpenPlaylist}
            />
          )}
          {activeTab === 'stem-projects' && (
            <div style={{ padding: '24px 16px', maxWidth: layoutMaxWidth, margin: '0 auto' }}>
              <StemProjectsLibraryView
                onOpenProject={(pid) => {
                  setActiveStemProjectId(pid);
                  setIsStemStudioOpen(true);
                }}
                onOpenCreateProject={() => {
                  setCreateStemProjectTrack(currentPlayingTrack || null);
                  setIsCreateStemProjectOpen(true);
                }}
              />
            </div>
          )}

          {/* Zakładka: Anime Web Radio */}
          {activeTab === 'radio' && (
            <RadioView
              currentLang={language}
              currentStation={currentRadioStation}
              isPlaying={status.state === 'Playing'}
              liveStreamTitle={status.live_stream_title}
              customStations={customRadioStations}
              onPlayStation={handlePlayRadioStation}
              onStop={handleStop}
              onOpenAddModal={() => setIsAddStationModalOpen(true)}
              onDeleteCustomStation={handleDeleteCustomStation}
            />
          )}
        </main>

        {/* Pływający dolny dok odtwarzacza (Mini-Player) */}
        <BottomPlaybackDock
          isVisible={(activeTab !== 'player' || isPlayerScrolledDown) && Boolean(status.state === 'Playing' || status.state === 'Paused' || currentPlayingTrack || status.current_track || filePath)}
          activeTab={activeTab}
          language={language}
          loc={loc}
          status={status}
          currentPlayingTrack={currentPlayingTrack}
          effectiveDisplayTitle={effectiveDisplayTitle}
          effectiveDisplayArtist={effectiveDisplayArtist}
          currentCover={currentCover}
          filePath={filePath}
          queue={queue}
          seekProgressPercent={seekProgressPercent}
          volumeProgressPercent={volumeProgressPercent}
          formatTime={formatTime}
          onScrollToTopOrSwitchTab={() => {
            if (activeTab === 'player') {
              mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              setActiveTab('player');
            }
          }}
          onOpenContainingFolder={handleOpenContainingFolder}
          onToggleShuffle={handleToggleShuffle}
          onPrevious={handlePrevious}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onCycleLoopMode={handleCycleLoopMode}
          onToggleStopAfterCurrent={handleToggleStopAfterCurrent}
          onSeek={handleSeek}
          onCycleDspEngine={handleCycleDspEngine}
          onSelectDspEngine={handleEngineChange}
          onToggleMute={handleToggleMute}
          onVolumeChange={handleVolumeChange}
          onToggleMiniPlayer={toggleMiniPlayer}
        />
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
        devicesProps={{
          language,
          loc,
          onOpenHealthCheck: () => setIsHealthCheckModalOpen(true),
          onRefreshDevices: refreshDevices,
          seekFadeEnabled,
          onToggleSeekFade: handleToggleSeekFade,
          instantVolume,
          onToggleInstantVolume: () => {
            const next = !instantVolume;
            setInstantVolume(next);
            try { localStorage.setItem('auralune_instant_volume', String(next)); } catch {}
          },
          volumeUnit,
          onSetVolumeUnit: handleSetVolumeUnit,
          volumeOsdPosition,
          onSetVolumeOsdPosition: (pos) => {
            setVolumeOsdPosition(pos);
            try { localStorage.setItem('auralune_volume_osd_position', pos); } catch {}
          },
          recapOptIn,
          onToggleRecapOptIn: () => {
            const next = !recapOptIn;
            setRecapOptIn(next);
            try { localStorage.setItem('auralune_recap_opt_in', String(next)); } catch {}
          },
          restoreSessionOnStartup,
          onToggleRestoreSessionOnStartup: handleToggleRestoreSessionOnStartup,
          dspAutoStartup,
          onToggleDspAutoStartup: handleToggleDspAutoStartup,
          dspDefaultEngine,
          onSetDefaultDspEngine: handleSetDefaultDspEngine,
          audioBufferMs,
          onSetAudioBuffer: handleSetAudioBuffer,
          dspBlockSize,
          onSetDspBlockSize: handleSetDspBlockSize,
          desktopNotificationsEnabled,
          onToggleDesktopNotifications: () => {
            const nextVal = !desktopNotificationsEnabled;
            setDesktopNotificationsEnabled(nextVal);
            try { localStorage.setItem('auralune_notifications_enabled', String(nextVal)); } catch {}
          },
          albumPlaybackMode,
          onSetAlbumPlaybackMode: (mode) => {
            setAlbumPlaybackMode(mode);
            try { localStorage.setItem('auralune_album_playback_mode', mode); } catch {}
          },
          replaygainMode,
          replaygainPreAmp,
          replaygainFallbackGain,
          replaygainPreventClipping,
          onSetReplayGain: handleSetReplayGain,
          replaygainStatus,
          replaygainScanWriteTags,
          onToggleReplaygainScanWriteTags: () => setReplaygainScanWriteTags(prev => !prev),
          onScanLibraryReplayGain: handleScanLibraryReplayGain,
          isReplaygainScanning,
          crossfeedEnabled,
          crossfeedPreset,
          crossfeedFcut,
          crossfeedFeed,
          onSetCrossfeed: handleSetCrossfeed,
          silenceTrimmingEnabled,
          silenceTrimmingThreshold,
          onSetSilenceTrimming: handleSetSilenceTrimming,
          cards,
          onDisableProAudio: handleDisableProAudio,
          onEnableProAudio: handleEnableProAudio,
          onSetCardProfile: handleSetCardProfile,
          onSetBluetoothCodec: handleSetBluetoothCodec,
        }}
        transcodeProps={{
          language,
          loc,
          currentPlayingTrack,
          status,
          onUseCurrentTrackAsSource: handleUseCurrentTrackAsSource,
          filePath,
          onFilePathChange: setFilePath,
          isPickingSource,
          onPickTranscodeSource: handlePickTranscodeSource,
          transcodeOutput,
          onTranscodeOutputChange: setTranscodeOutput,
          isPickingDestination,
          onPickTranscodeDestination: handlePickTranscodeDestination,
          transcodeFormat,
          onTranscodeFormatChange: setTranscodeFormat,
          transcodeBitrate,
          onTranscodeBitrateChange: setTranscodeBitrate,
          transcodeApplyDsp,
          onTranscodeApplyDspChange: setTranscodeApplyDsp,
          reverbEnabled,
          reverbLevel,
          transcodeApplyRange,
          onTranscodeApplyRangeChange: setTranscodeApplyRange,
          transcodeRangeA,
          onTranscodeRangeAChange: setTranscodeRangeA,
          transcodeRangeB,
          onTranscodeRangeBChange: setTranscodeRangeB,
          loopPointA,
          loopPointB,
          currentTrackBookmarks,
          transcodeAutoEnqueue,
          onTranscodeAutoEnqueueChange: setTranscodeAutoEnqueue,
          isTranscoding,
          transcodeProgress,
          transcodeElapsedSeconds,
          onMinimizeToBackground: () => setIsSettingsOpen(false),
          onTranscode: handleTranscode,
          lastExportedTrack,
          onDismissLastExported: () => setLastExportedTrack(null),
          onPlayLibraryTrack: handlePlayLibraryTrack,
          onAddTrackToQueue: handleAddTrackToQueue,
          onAddToPlaylist: (tr) => {
            setTrackToAddToPlaylist(tr);
            setShowPlaylistModal(true);
          },
          onOpenContainingFolder: handleOpenContainingFolder,
          onShowMessage: showMessage,
        }}
        themesProps={{
          language,
          loc,
          onLanguageChange: setLanguage,
          buttonGlowEnabled,
          onToggleGlow: () => setButtonGlowEnabled(prev => !prev),
          uiScale,
          onResetScale: handleResetScale,
          onSelectScale: handleSelectScale,
          themes,
          currentTheme,
          onSelectTheme: handleSelectTheme,
          customBgPath,
          onCustomBgPathChange: setCustomBgPath,
          themeBgImage,
          onPickWallpaperFromDisk: handlePickWallpaperFromDisk,
          onWallpaperDrop: handleWallpaperDrop,
          onUploadBgImage: handleUploadBgImage,
          onRemoveBgImage: handleRemoveBgImage,
          onSaveBackgroundSettings: handleSaveBackgroundSettings,
          themeOverlay,
          onThemeOverlayChange: setThemeOverlay,
          themeBlur,
          onThemeBlurChange: setThemeBlur,
          appIconStyle,
          onSelectIconStyle: handleSelectIconStyle,
          jsonExportContent,
          onExportTheme: handleExportTheme,
          jsonImportContent,
          onJsonImportContentChange: setJsonImportContent,
          onImportTheme: handleImportTheme,
        }}
        aboutProps={{
          appIconStyle,
          language,
          loc,
          onOpenHealthCheck: () => setIsHealthCheckModalOpen(true),
          onOpenChangelog: () => setSettingsTab('changelog'),
          onOpenOnboarding: () => setIsOnboardingOpen(true),
        }}
        backupProps={{
          language,
          loc,
          onExportBackup: handleExportProfileBackup,
          onImportBackup: handleImportProfileBackup,
          closeToTray,
          onToggleCloseToTray: handleToggleCloseToTray,
          discordRpcEnabled,
          discordRpcConnected,
          discordClientId,
          onToggleDiscordRpc: handleToggleDiscordRpc,
          onSaveDiscordClientId: handleSaveDiscordClientId,
          crossfadeDuration,
          onCrossfadeDurationChange: handleCrossfadeDurationChange,
          listenbrainzEnabled,
          listenbrainzToken,
          listenbrainzUser,
          listenbrainzStatusMsg,
          listenbrainzTesting,
          onToggleListenbrainz: handleToggleListenbrainz,
          onListenbrainzTokenChange: handleListenbrainzTokenChange,
          onTestListenbrainz: handleTestListenbrainz,
          lastfmEnabled,
          lastfmUsername,
          lastfmSessionKey,
          lastfmPendingToken,
          lastfmTesting,
          lastfmStatusMsg,
          lastfmCustomKey,
          lastfmCustomSecret,
          onToggleLastfm: handleToggleLastfm,
          onConnectLastfm: handleConnectLastfm,
          onConfirmLastfmAuth: handleConfirmLastfmAuth,
          onDisconnectLastfm: handleDisconnectLastfm,
          onManualLastfmSessionKeyChange: handleManualLastfmSessionKeyChange,
          onValidateLastfmSession: handleValidateLastfmSession,
          onSaveLastfmCustomKeys: handleSaveLastfmCustomKeys,
        }}
      />

      <AppModalsContainer
        language={language}
        loc={loc}
        status={status}
        tracks={tracks}
        albums={albums}
        playlists={playlists}
        currentPlayingTrack={currentPlayingTrack}
        currentAlbum={currentAlbum}
        currentCover={currentCover}
        effectiveDisplayTitle={effectiveDisplayTitle}
        effectiveDisplayArtist={effectiveDisplayArtist}
        filePath={filePath}
        queue={queue}
        filteredTracks={filteredTracks}
        activeTrackId={activeTrackId}
        loopPointA={loopPointA}
        loopPointB={loopPointB}
        setLoopPointA={setLoopPointA}
        setLoopPointB={setLoopPointB}
        crossfadeDuration={crossfadeDuration}
        showPlaylistModal={showPlaylistModal}
        setShowPlaylistModal={setShowPlaylistModal}
        trackToAddToPlaylist={trackToAddToPlaylist}
        setTrackToAddToPlaylist={setTrackToAddToPlaylist}
        handleAddTrackToPlaylist={handleAddTrackToPlaylist}
        isShortcutsModalOpen={isShortcutsModalOpen}
        setIsShortcutsModalOpen={setIsShortcutsModalOpen}
        coverPickerState={coverPickerState}
        setCoverPickerState={setCoverPickerState}
        setTrackDirectCover={setTrackDirectCover}
        setAlbums={setAlbums}
        loadLibrary={loadLibrary}
        showDesktopLyrics={showDesktopLyrics}
        setShowDesktopLyrics={setShowDesktopLyrics}
        isSleepTimerOpen={isSleepTimerOpen}
        setIsSleepTimerOpen={setIsSleepTimerOpen}
        sleepTimerRemainingSec={sleepTimerRemainingSec}
        sleepTimerTargetMode={sleepTimerTargetMode}
        sleepTimerFadeOut={sleepTimerFadeOut}
        handleSetSleepTimer={handleSetSleepTimer}
        handleCancelSleepTimer={handleCancelSleepTimer}
        isAudioPathModalOpen={isAudioPathModalOpen}
        setIsAudioPathModalOpen={setIsAudioPathModalOpen}
        handleResetBitPerfect={handleResetBitPerfect}
        isLoFiModalOpen={isLoFiModalOpen}
        setIsLoFiModalOpen={setIsLoFiModalOpen}
        isHealthCheckModalOpen={isHealthCheckModalOpen}
        setIsHealthCheckModalOpen={setIsHealthCheckModalOpen}
        isSoundscapeOpen={isSoundscapeOpen}
        setIsSoundscapeOpen={setIsSoundscapeOpen}
        isHarmonicSuggesterOpen={isHarmonicSuggesterOpen}
        setIsHarmonicSuggesterOpen={setIsHarmonicSuggesterOpen}
        handleTempoChange={handleTempoChange}
        handleNext={handleNext}
        handlePlayLibraryTrack={handlePlayLibraryTrack}
        handleAddTrackNextToQueue={handleAddTrackNextToQueue}
        handleAddTrackToQueue={handleAddTrackToQueue}
        handleCrossfadeDurationChange={handleCrossfadeDurationChange}
        handleTrackKeyBpmUpdated={handleTrackKeyBpmUpdated}
        isAutoEqOpen={isAutoEqOpen}
        setIsAutoEqOpen={setIsAutoEqOpen}
        setEqPresets={setEqPresets}
        setSelectedEqPreset={setSelectedEqPreset}
        setStatus={setStatus}
        handleResetEq={handleResetEq}
        isParametricEqOpen={isParametricEqOpen}
        setIsParametricEqOpen={setIsParametricEqOpen}
        isDynamicsStudioOpen={isDynamicsStudioOpen}
        setIsDynamicsStudioOpen={setIsDynamicsStudioOpen}
        statsModalTrack={statsModalTrack}
        setStatsModalTrack={setStatsModalTrack}
        handleResetTrackPlays={handleResetTrackPlays}
        isLoopEditorOpen={isLoopEditorOpen}
        setIsLoopEditorOpen={setIsLoopEditorOpen}
        handleExportLoopFromModal={handleExportLoopFromModal}
        handleSaveLoopAsBookmarks={handleSaveLoopAsBookmarks}
        isOnboardingOpen={isOnboardingOpen}
        setIsOnboardingOpen={setIsOnboardingOpen}
        setLanguage={setLanguage}
        recapOptIn={recapOptIn}
        setRecapOptIn={setRecapOptIn}
        instantVolume={instantVolume}
        setInstantVolume={setInstantVolume}
        volumeOsdPosition={volumeOsdPosition}
        setVolumeOsdPosition={setVolumeOsdPosition}
        isKeyBpmModalOpen={isKeyBpmModalOpen}
        setIsKeyBpmModalOpen={setIsKeyBpmModalOpen}
        handlePitchChange={handlePitchChange}
        isAnalysisModalOpen={isAnalysisModalOpen}
        setIsAnalysisModalOpen={setIsAnalysisModalOpen}
        analysisInitialTab={analysisInitialTab}
        isStemStudioOpen={isStemStudioOpen}
        setIsStemStudioOpen={setIsStemStudioOpen}
        activeStemProjectId={activeStemProjectId}
        setActiveStemProjectId={setActiveStemProjectId}
        isCreateStemProjectOpen={isCreateStemProjectOpen}
        setIsCreateStemProjectOpen={setIsCreateStemProjectOpen}
        createStemProjectTrack={createStemProjectTrack}
        setCreateStemProjectTrack={setCreateStemProjectTrack}
        isRecapModalOpen={isRecapModalOpen}
        setIsRecapModalOpen={setIsRecapModalOpen}
        tagEditorTrack={tagEditorTrack}
        setTagEditorTrack={setTagEditorTrack}
        isCommandPaletteOpen={isCommandPaletteOpen}
        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        handlePlayPause={handlePlayPause}
        handlePrevious={handlePrevious}
        handleToggleShuffle={handleToggleShuffle}
        handleToggleStopAfterCurrent={handleToggleStopAfterCurrent}
        setAmbienceMode={setAmbienceMode}
        handleEngineChange={handleEngineChange}
        handleResetDsp={handleResetDsp}
        setIsBigScreen={setIsBigScreen}
        setActiveTab={setActiveTab}
        handleShuffleAll={handleShuffleAll}
        isUrlImportModalOpen={isUrlImportModalOpen}
        setIsUrlImportModalOpen={setIsUrlImportModalOpen}
        setTracks={setTracks}
        isCueModalOpen={isCueModalOpen}
        setIsCueModalOpen={setIsCueModalOpen}
        handleLoadFile={handleLoadFile}
        handleSeek={handleSeek}
        refreshQueue={refreshQueue}
        showDownloadHub={showDownloadHub}
        setShowDownloadHub={setShowDownloadHub}
        isBookmarksModalOpen={isBookmarksModalOpen}
        setIsBookmarksModalOpen={setIsBookmarksModalOpen}
        refreshTrackBookmarks={refreshTrackBookmarks}
        isDuplicateFinderOpen={isDuplicateFinderOpen}
        setIsDuplicateFinderOpen={setIsDuplicateFinderOpen}
        isFileRenamerOpen={isFileRenamerOpen}
        setIsFileRenamerOpen={setIsFileRenamerOpen}
        isSaveQueueModalOpen={isSaveQueueModalOpen}
        setIsSaveQueueModalOpen={setIsSaveQueueModalOpen}
        handleConfirmSaveQueueAsPlaylist={handleConfirmSaveQueueAsPlaylist}
        isAddStationModalOpen={isAddStationModalOpen}
        setIsAddStationModalOpen={setIsAddStationModalOpen}
        handleSaveCustomStation={handleSaveCustomStation}
        showMessage={showMessage}
      />
      {/* Floating Background Export Badge */}
      {isTranscoding && (
        <div
          className="glass-card"
          style={{
            position: 'fixed',
            bottom: activeTab !== 'player' || isPlayerScrolledDown ? '90px' : '24px',
            right: '24px',
            zIndex: 1200,
            padding: '12px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(25, 20, 40, 0.95) 0%, rgba(15, 10, 25, 0.98) 100%)',
            border: '1px solid var(--accent-pink)',
            boxShadow: '0 8px 32px rgba(236, 72, 153, 0.3), 0 0 15px rgba(168, 85, 247, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.25s ease',
            minWidth: '280px',
            maxWidth: '380px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.5)',
            }}
          >
            <Loader2 size={18} className="spin" color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>
                {t.notifications.exportBackground}
              </span>
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-pink)' }}>
                {transcodeProgress && transcodeProgress.percent > 0
                  ? `${Math.round(transcodeProgress.percent)}%`
                  : `${transcodeElapsedSeconds}s`}
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', margin: '3px 0' }}>
              <div
                style={{
                  width:
                    transcodeProgress && transcodeProgress.percent > 0
                      ? `${Math.min(100, Math.max(3, transcodeProgress.percent))}%`
                      : '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-purple))',
                  borderRadius: '2px',
                  transition: 'width 0.2s ease',
                  animation: !transcodeProgress || transcodeProgress.percent === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {transcodeOutput ? transcodeOutput.split('/').pop() || transcodeOutput : t.notifications.exportProcessing}
            </div>
          </div>
          <button
            onClick={() => {
              setSettingsTab('transcode');
              setIsSettingsOpen(true);
            }}
            className="glass-card"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title={t.notifications.exportDetailsTooltip}
          >
            {t.notifications.exportDetails}
          </button>
        </div>
      )}
    </div>
  );
}
