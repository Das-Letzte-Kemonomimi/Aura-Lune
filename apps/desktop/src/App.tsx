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
} from 'lucide-react';

interface PlaybackStatus {
  state: 'Playing' | 'Paused' | 'Stopped';
  position_ms: number;
  duration_ms: number | null;
  volume: number;
  pitch_semitones: number;
  tempo_ratio: number;
  rate_ratio: number;
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
  });

  const [cards, setCards] = useState<AudioCard[]>([]);
  const [activeTab, setActiveTab] = useState<'player' | 'dsp' | 'devices' | 'transcode'>('player');
  const [transcodeOutput, setTranscodeOutput] = useState('tests/fixtures/converted_sample.opus');
  const [transcodeFormat, setTranscodeFormat] = useState<'Opus' | 'Flac' | 'Wav'>('Opus');
  const [transcodeBitrate, setTranscodeBitrate] = useState(192);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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

  // Pobieranie listy urządzeń audio
  const refreshDevices = async () => {
    try {
      const res = await invoke<AudioCard[]>('list_devices');
      setCards(res);
      showMessage('Zaktualizowano listę kart audio i urządzeń Bluetooth');
    } catch (e: any) {
      showMessage(`Błąd pobierania urządzeń: ${e}`, true);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  const showMessage = (msg: string, isError = false) => {
    setInfoMessage(isError ? `⚠️ ${msg}` : `✨ ${msg}`);
    setTimeout(() => setInfoMessage(null), 4000);
  };

  // Obsługa komend odtwarzacza
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
        <nav style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px' }}>
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
            Odtwarzacz
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
            }}
          >
            Panel DSP
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            style={{
              padding: '8px 16px',
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
              padding: '8px 16px',
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
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '20px' }}>
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

        {/* Zakładka DSP */}
        {activeTab === 'dsp' && (
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={20} color="var(--accent-purple)" /> Procesor DSP czasu rzeczywistego (SoundTouch / Rubber Band)
            </h2>

            {/* Suwak Pitch */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Wysokość dźwięku (Pitch Shift):</label>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-pink)', fontWeight: 600 }}>
                  {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st ({Math.round(status.pitch_semitones * 100)} cents)
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
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
                    {st === 0 ? 'Reset' : st > 0 ? `+${st}` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Suwak Tempo */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Tempo (Time Stretch bez zmiany wysokości):</label>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {status.tempo_ratio.toFixed(2)}x ({Math.round(status.tempo_ratio * 100)}%)
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
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
          </div>
        )}

        {/* Zakładka Pro Audio & Bluetooth */}
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

        {/* Zakładka Transkodowanie & Opus */}
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
