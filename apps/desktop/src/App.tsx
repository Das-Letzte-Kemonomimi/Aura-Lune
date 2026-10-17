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
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'player' | 'library' | 'dsp' | 'devices' | 'transcode'>('player');
  const [transcodeOutput, setTranscodeOutput] = useState('tests/fixtures/converted_sample.opus');
  const [transcodeFormat, setTranscodeFormat] = useState<'Opus' | 'Flac' | 'Wav'>('Opus');
  const [transcodeBitrate, setTranscodeBitrate] = useState(192);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Stan biblioteki
  const [scanFolder, setScanFolder] = useState('tests/fixtures');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanSummaryDto | null>(null);
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);

  // Stan presetów DSP (Etap 3)
  const [presets, setPresets] = useState<DspPresetRecord[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  // Odpytywanie statusu odtwarzacza
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await invoke<PlaybackStatus>('get_status');
        setStatus(res);
      } catch (e) {
        // Ignoruj błędy gdy backend nie jest jeszcze zainicjalizowany
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 250);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    refreshDevices();
    loadLibrary();
    loadPresets();
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px' }}>
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
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: activeTrackId ? 'var(--accent-amber)' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  <Bookmark size={16} /> Zapisz zakładkę
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={handleStop}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Square size={18} />
                  </button>

                  <button
                    onClick={handlePlayPause}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'var(--shadow-glow)',
                    }}
                  >
                    {status.state === 'Playing' ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '4px' }} />}
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

            {/* Tabela utworów */}
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
                  </tr>
                </thead>
                <tbody>
                  {tracks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
      </main>
    </div>
  );
}
