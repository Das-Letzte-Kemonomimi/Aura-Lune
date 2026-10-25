import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Minimize2,
  Volume2,
  VolumeX,
  Disc,
  Radio,
  Zap,
  Mic2,
  Download,
  Upload,
  CassetteTape,
  Disc3,
  Image,
} from 'lucide-react';
import { SpectrumVisualizer } from './SpectrumVisualizer';
import { LyricsView } from './LyricsView';
import { WaveformCanvas } from './WaveformCanvas';
import { type Language, getTranslations } from '../i18n';

interface BigScreenViewProps {
  title: string;
  artist: string;
  album?: string | null;
  format?: string;
  coverUrl?: string | null;
  trackPath?: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs?: number | null;
  volume: number;
  pitchSemitones: number;
  tempoRatio: number;
  spectrum?: number[];
  currentLang?: Language;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
  onFetchCover?: () => void;
  onUploadCover?: () => void;
}

export const BigScreenView: React.FC<BigScreenViewProps> = ({
  title,
  artist,
  album,
  format,
  coverUrl,
  trackPath,
  isPlaying,
  positionMs,
  durationMs,
  volume,
  pitchSemitones,
  tempoRatio,
  spectrum,
  currentLang = 'en',
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onClose,
  onFetchCover,
  onUploadCover,
}) => {
  const t = getTranslations(currentLang);
  const [showHud, setShowHud] = useState(true);
  const [showLyrics, setShowLyrics] = useState(true);
  const [visualMode, setVisualMode] = useState<'cover' | 'vinyl' | 'cassette'>(() => {
    try {
      const saved = localStorage.getItem('auralune_bigscreen_visual_mode');
      if (saved === 'cover' || saved === 'vinyl' || saved === 'cassette') return saved;
    } catch {}
    return 'vinyl';
  });

  const handleSetVisualMode = (mode: 'cover' | 'vinyl' | 'cassette') => {
    setVisualMode(mode);
    try {
      localStorage.setItem('auralune_bigscreen_visual_mode', mode);
    } catch {}
  };
  const hideTimerRef = useRef<number | null>(null);

  const resetHideTimer = () => {
    setShowHud(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowHud(false);
      }
    }, 3500);
  };

  useEffect(() => {
    resetHideTimer();
    const handleMouseMove = () => resetHideTimer();
    window.addEventListener('mousemove', handleMouseMove);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F11') {
        e.preventDefault();
        onClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        onPlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const progress = durationMs && durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  // Deterministyczny profil fali (Waveform) dla widoku pełnoekranowego
  const waveformPeaks = useMemo(() => {
    const seedStr = `${title}-${artist}-${durationMs ?? 0}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const peaks: number[] = [];
    const count = 80;
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
  }, [title, artist, durationMs]);

  return (
    <div
      onMouseMove={resetHideTimer}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(circle at center, #140e26 0%, #06070e 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 48px',
        color: '#fff',
        userSelect: 'none',
        overflow: 'hidden',
        cursor: showHud ? 'default' : 'none',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      {/* Pasek górny HUD */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: showHud ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: showHud ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: 'var(--accent-cyan)',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Radio size={14} /> PipeWire Hi-Fi • {format || 'FLAC'}
          </span>
          {(Math.abs(pitchSemitones) > 0.05 || Math.abs(tempoRatio - 1.0) > 0.02) && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(244, 63, 94, 0.2)',
                border: '1px solid var(--accent-pink)',
                color: 'var(--accent-pink)',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Zap size={12} /> DSP: {tempoRatio.toFixed(2)}x
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            style={{
              background: showLyrics ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${showLyrics ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
              borderRadius: '10px',
              color: showLyrics ? 'var(--accent-purple)' : 'var(--text-secondary)',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Mic2 size={16} />
            {t.nav.lyrics}
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: '#fff',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
            title={`${t.common.close} (Esc / F11)`}
          >
            <Minimize2 size={16} />
            {t.common.close} (Esc)
          </button>
        </div>
      </div>

      {/* Środek: Okładka i teksty piosenek w układzie panoramicznym */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showLyrics ? '420px 1fr' : '1fr',
          gap: '50px',
          alignItems: 'center',
          flex: 1,
          maxHeight: 'calc(100vh - 200px)',
          margin: '20px 0',
        }}
      >
        {/* Kolumna lewa: Wielka wirująca płyta winylowa / Okładka */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
          {/* Przełącznik trybu wizualizacji: Okładka / Winyl / Retro Kaseta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <button
              onClick={() => handleSetVisualMode('cover')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '16px',
                background: visualMode === 'cover' ? 'var(--accent-purple)' : 'transparent',
                color: visualMode === 'cover' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Image size={13} /> {t.bigScreenModes.cover}
            </button>
            <button
              onClick={() => handleSetVisualMode('vinyl')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '16px',
                background: visualMode === 'vinyl' ? 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))' : 'transparent',
                color: visualMode === 'vinyl' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: visualMode === 'vinyl' ? '0 0 10px rgba(244, 63, 94, 0.4)' : 'none',
              }}
            >
              <Disc3 size={13} /> {t.bigScreenModes.vinyl}
            </button>
            <button
              onClick={() => handleSetVisualMode('cassette')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '16px',
                background: visualMode === 'cassette' ? 'linear-gradient(135deg, var(--accent-cyan), #0284c7)' : 'transparent',
                color: visualMode === 'cassette' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: visualMode === 'cassette' ? '0 0 10px rgba(6, 182, 212, 0.4)' : 'none',
              }}
            >
              <CassetteTape size={13} /> {t.bigScreenModes.cassette}
            </button>
          </div>

          {/* TRYB 1: Tradycyjna Okładka Albumu */}
          {visualMode === 'cover' && (
            <div
              style={{
                width: showLyrics ? '340px' : '440px',
                height: showLyrics ? '340px' : '440px',
                borderRadius: '28px',
                position: 'relative',
                overflow: 'hidden',
                background: coverUrl
                  ? `url("${coverUrl}") center/cover no-repeat`
                  : 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                boxShadow: isPlaying ? '0 0 35px rgba(168, 85, 247, 0.45)' : '0 15px 35px rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'box-shadow 0.4s ease',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            >
              {!coverUrl && (
                <div
                  style={{
                    width: '80%',
                    height: '80%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #0b0f19 35%, #182032 50%, #0f172a 75%, #050811 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: isPlaying ? 'spin 12s linear infinite' : 'none',
                  }}
                >
                  <Disc size={64} color="var(--accent-pink)" />
                </div>
              )}
            </div>
          )}

          {/* TRYB 2: Wirujący Winyl z rowkami, naklejką i ramieniem gramofonu */}
          {visualMode === 'vinyl' && (
            <div
              style={{
                position: 'relative',
                width: showLyrics ? '340px' : '440px',
                height: showLyrics ? '340px' : '440px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Czarna płyta winylowa z mikro-rowkami */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: `repeating-radial-gradient(
                    circle at center,
                    #111116 0px,
                    #111116 2px,
                    #08080a 3px,
                    #08080a 4px
                  )`,
                  border: '3px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: isPlaying
                    ? '0 0 40px rgba(168, 85, 247, 0.45), 0 20px 50px rgba(0, 0, 0, 0.85)'
                    : '0 20px 50px rgba(0, 0, 0, 0.85)',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: isPlaying
                    ? `spin ${Math.max(1, 3.6 / (tempoRatio || 1.0))}s linear infinite`
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Stożkowe odbłyski światła na winylu (Vinyl sheen reflections) */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: `conic-gradient(
                      from 45deg,
                      transparent 0deg,
                      rgba(255, 255, 255, 0.08) 35deg,
                      transparent 70deg,
                      transparent 180deg,
                      rgba(255, 255, 255, 0.08) 215deg,
                      transparent 250deg,
                      transparent 360deg
                    )`,
                    pointerEvents: 'none',
                  }}
                />

                {/* Wewnętrzny rowek wybiegowy (Run-out groove) */}
                <div
                  style={{
                    position: 'absolute',
                    width: '52%',
                    height: '52%',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Centralna naklejka albumu z otworem wrzeciona */}
                <div
                  style={{
                    width: '38%',
                    height: '38%',
                    borderRadius: '50%',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '2px solid rgba(255, 255, 255, 0.25)',
                    background: coverUrl
                      ? `url("${coverUrl}") center/cover no-repeat`
                      : 'radial-gradient(circle, #3b0764 0%, #1e1b4b 70%, #030712 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(0,0,0,0.6)',
                  }}
                >
                  {!coverUrl && <Disc size={36} color="var(--accent-pink)" />}
                  {/* Otwór na wrzeciono gramofonu */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#000',
                      border: '2px solid rgba(255, 255, 255, 0.6)',
                      boxShadow: 'inset 0 0 4px #000',
                    }}
                  />
                </div>
              </div>

              {/* Ramię gramofonowe (Tonearm) płynnie sunące po rowkach wraz z postępem utworu */}
              <div
                style={{
                  position: 'absolute',
                  top: '-15px',
                  right: '-15px',
                  width: '130px',
                  height: '240px',
                  pointerEvents: 'none',
                  transformOrigin: '95px 25px',
                  transform: isPlaying
                    ? `rotate(${16 + (progress / 100) * 22}deg)`
                    : 'rotate(0deg)',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 10,
                  filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.75))',
                }}
              >
                {/* Podstawa ramienia (Pivot Base) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '20px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #94a3b8 0%, #334155 70%, #0f172a 100%)',
                    border: '2px solid rgba(255,255,255,0.4)',
                  }}
                />
                {/* Przeciwwaga (Counterweight) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '28px',
                    width: '16px',
                    height: '18px',
                    borderRadius: '3px',
                    background: 'linear-gradient(90deg, #475569, #94a3b8, #334155)',
                  }}
                />
                {/* Rurka ramienia */}
                <div
                  style={{
                    position: 'absolute',
                    top: '25px',
                    right: '34px',
                    width: '5px',
                    height: '150px',
                    background: 'linear-gradient(to right, #cbd5e1, #ffffff, #64748b)',
                    borderRadius: '3px',
                    transformOrigin: 'top center',
                    transform: 'rotate(-12deg)',
                  }}
                />
                {/* Zagięcie przed wkładką */}
                <div
                  style={{
                    position: 'absolute',
                    top: '165px',
                    right: '58px',
                    width: '5px',
                    height: '30px',
                    background: 'linear-gradient(to right, #cbd5e1, #ffffff, #64748b)',
                    borderRadius: '3px',
                    transform: 'rotate(18deg)',
                  }}
                />
                {/* Wkładka gramofonowa (Cartridge) z neonowym akcentem */}
                <div
                  style={{
                    position: 'absolute',
                    top: '188px',
                    right: '54px',
                    width: '16px',
                    height: '24px',
                    borderRadius: '2px 2px 4px 4px',
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 0 8px rgba(14, 165, 233, 0.6)',
                  }}
                />
              </div>
            </div>
          )}

          {/* TRYB 3: Retro Kaseta Magnetofonowa z lat 90. (Obracające się szpule i taśma) */}
          {visualMode === 'cassette' && (
            <div
              style={{
                width: showLyrics ? '360px' : '440px',
                height: showLyrics ? '230px' : '280px',
                borderRadius: '16px',
                background: 'linear-gradient(145deg, #181926 0%, #0d0e17 100%)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                boxShadow: isPlaying
                  ? '0 0 35px rgba(244, 63, 94, 0.35), 0 20px 45px rgba(0, 0, 0, 0.85)'
                  : '0 20px 45px rgba(0, 0, 0, 0.85)',
                position: 'relative',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                overflow: 'hidden',
                userSelect: 'none',
                boxSizing: 'border-box',
              }}
            >
              {/* 4 śrubki narożne */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
                <div
                  key={corner}
                  style={{
                    position: 'absolute',
                    top: corner.includes('top') ? '6px' : 'auto',
                    bottom: corner.includes('bottom') ? '6px' : 'auto',
                    left: corner.includes('left') ? '6px' : 'auto',
                    right: corner.includes('right') ? '6px' : 'auto',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#94a3b8',
                    border: '1px solid #475569',
                    boxShadow: 'inset 0 0 2px #000',
                  }}
                />
              ))}

              {/* Naklejka etykiety kasety (Vintage Paper Label) */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
                  color: '#1e1b4b',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  border: '1px solid #e9d5ff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-pink)', letterSpacing: '0.08em' }}>
                    {t.bigScreenModes.sideA}
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6b21a8' }}>
                    {t.bigScreenModes.stereo}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#111827',
                    fontFamily: 'monospace, sans-serif',
                  }}
                >
                  {title || 'Auralune Track'}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#4b5563',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {artist || 'Unknown Artist'}
                </div>
              </div>

              {/* Środkowe przezroczyste okienko taśmy ze szpulami */}
              <div
                style={{
                  flex: 1,
                  margin: '10px 0',
                  background: 'rgba(0, 0, 0, 0.65)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)',
                }}
              >
                {/* Podziałka magnetofonowa: 100 • 50 • 0 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    fontSize: '0.6rem',
                    color: 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '8px',
                    fontFamily: 'monospace',
                    pointerEvents: 'none',
                  }}
                >
                  100 • 50 • 0
                </div>

                {/* Lewa szpula (Feed reel) - taśma maleje od 100% do 0% */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(32, 70 - (progress / 100) * 36)}px`,
                      height: `${Math.max(32, 70 - (progress / 100) * 36)}px`,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #271a15 30%, #451a03 70%, #1e130c 100%)',
                      boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                      position: 'absolute',
                      transition: 'width 0.2s, height 0.2s',
                    }}
                  />
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#f8fafc',
                      border: '2px solid #cbd5e1',
                      boxShadow: 'inset 0 0 6px #64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      animation: isPlaying
                        ? `spin ${Math.max(0.8, 2.5 / (tempoRatio || 1.0))}s linear infinite`
                        : 'none',
                    }}
                  >
                    {[0, 60, 120].map((deg) => (
                      <div
                        key={deg}
                        style={{
                          position: 'absolute',
                          width: '4px',
                          height: '24px',
                          background: '#475569',
                          borderRadius: '1px',
                          transform: `rotate(${deg}deg)`,
                        }}
                      />
                    ))}
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#0f172a',
                        zIndex: 3,
                      }}
                    />
                  </div>
                </div>

                {/* Przechodzący pasek taśmy magnetycznej */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    width: '65%',
                    height: '6px',
                    background: 'linear-gradient(90deg, #451a03, #78350f, #451a03)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  }}
                />

                {/* Prawa szpula (Take-up reel) - taśma rośnie od 0% do 100% */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(32, 34 + (progress / 100) * 36)}px`,
                      height: `${Math.max(32, 34 + (progress / 100) * 36)}px`,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #271a15 30%, #451a03 70%, #1e130c 100%)',
                      boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                      position: 'absolute',
                      transition: 'width 0.2s, height 0.2s',
                    }}
                  />
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#f8fafc',
                      border: '2px solid #cbd5e1',
                      boxShadow: 'inset 0 0 6px #64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      animation: isPlaying
                        ? `spin ${Math.max(0.8, 2.5 / (tempoRatio || 1.0))}s linear infinite`
                        : 'none',
                    }}
                  >
                    {[0, 60, 120].map((deg) => (
                      <div
                        key={deg}
                        style={{
                          position: 'absolute',
                          width: '4px',
                          height: '24px',
                          background: '#475569',
                          borderRadius: '1px',
                          transform: `rotate(${deg}deg)`,
                        }}
                      />
                    ))}
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#0f172a',
                        zIndex: 3,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Dolny profil kasety z rolkami prowadzącymi */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 30px',
                }}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#64748b', border: '1px solid #94a3b8' }} />
                <div style={{ width: '28px', height: '10px', background: '#334155', borderRadius: '2px', border: '1px solid #475569' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#64748b', border: '1px solid #94a3b8' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onFetchCover && (
              <button
                onClick={onFetchCover}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Download size={13} /> {t.player.fetchCover}
              </button>
            )}
            {onUploadCover && (
              <button
                onClick={onUploadCover}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid rgba(236, 72, 153, 0.35)',
                  color: 'var(--accent-pink)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={13} /> {t.covers.uploadCustomCover}
              </button>
            )}
          </div>

          <div>
            <h1
              style={{
                fontSize: showLyrics ? '1.8rem' : '2.4rem',
                fontWeight: 800,
                margin: '0 0 8px 0',
                letterSpacing: '-0.02em',
                textShadow: '0 0 20px rgba(255,255,255,0.2)',
              }}
            >
              {title || 'Auralune Player'}
            </h1>
            <p
              style={{
                fontSize: showLyrics ? '1.1rem' : '1.3rem',
                fontWeight: 600,
                color: 'var(--accent-pink)',
                margin: '0 0 4px 0',
              }}
            >
              {artist || t.player.unknownArtist}
            </p>
            {album && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {album}
              </p>
            )}
          </div>
        </div>

        {/* Kolumna prawa: Teksty synchronizowane */}
        {showLyrics && (
          <div style={{ height: '100%', minHeight: '380px' }}>
            <LyricsView
              trackTitle={title}
              trackArtist={artist}
              trackAlbum={album}
              trackPath={trackPath}
              durationSec={durationMs ? durationMs / 1000 : null}
              currentPositionMs={positionMs}
              currentLang={currentLang}
              onSeek={onSeek}
              onClose={() => setShowLyrics(false)}
            />
          </div>
        )}
      </div>

      {/* Dolny panel sterowania i wizualizator HUD */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          opacity: showHud ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: showHud ? 'auto' : 'none',
        }}
      >
        {/* Neonowy wizualizator widma */}
        <div style={{ height: '72px', width: '100%' }}>
          <SpectrumVisualizer
            spectrum={spectrum}
            isPlaying={isPlaying}
            style={{ height: '72px' }}
          />
        </div>

        {/* Seeker z wizualizacją fali (Waveform) i wskaźnikiem DSP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Waveform bars */}
          <WaveformCanvas
            peaks={waveformPeaks}
            progress={progress}
            height={48}
            onSeek={(pct) => {
              if (durationMs && durationMs > 0) {
                onSeek(Math.floor(pct * durationMs));
              }
            }}
            title={t.waveform.hint}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>
                {formatTime(positionMs)}
              </span>
              {(tempoRatio !== 1.0) && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(168, 85, 247, 0.3)',
                    color: 'var(--accent-purple)',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                  }}
                  title={`${t.dsp.tempo}: ${tempoRatio.toFixed(2)}x`}
                >
                  DSP {tempoRatio.toFixed(2)}x
                </span>
              )}
            </div>
            <div
              onClick={(e) => {
                if (!durationMs || durationMs <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(Math.floor(pct * durationMs));
              }}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(255, 255, 255, 0.12)',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-pink))',
                  borderRadius: '3px',
                  boxShadow: '0 0 12px var(--accent-cyan)',
                }}
              />
            </div>
            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {durationMs ? formatTime(durationMs) : '--:--'}
            </span>
          </div>
        </div>

        {/* Przyciski sterowania */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onPrev}
            title={t.player.previous}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SkipBack size={22} />
          </button>

          <button
            onClick={onPlayPause}
            title={isPlaying ? t.player.pause : t.player.play}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(244, 63, 94, 0.55)',
            }}
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
          </button>

          <button
            onClick={onNext}
            title={t.player.next}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SkipForward size={22} />
          </button>

          <div style={{ position: 'absolute', right: '48px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
              title={volume === 0 ? t.player.unmute : t.player.mute}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              style={{
                width: '80px',
                cursor: 'pointer',
                background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${Math.min(100, Math.max(0, volume * 100))}%, rgba(255, 255, 255, 0.12) ${Math.min(100, Math.max(0, volume * 100))}%, rgba(255, 255, 255, 0.12) 100%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
