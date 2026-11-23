import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Disc,
  Download,
  Upload,
  CassetteTape,
  Disc3,
  Image,
} from 'lucide-react';
import { LyricsView } from '../../components/player/LyricsView';
import { type Language, getTranslations } from '../../i18n';
import { useLivePositionMs, useLiveSpectrum } from '../../state/livePlayback';
import { BigScreenControls } from './bigscreen/BigScreenControls';
import { BigScreenTapeDeck } from './bigscreen/BigScreenTapeDeck';
import { BigScreenVinyl } from './bigscreen/BigScreenVinyl';
import { BigScreenHud } from './bigscreen/BigScreenHud';

export interface BigScreenViewProps {
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
  volumeUnit?: 'percent' | 'db';
  volumeDbStep?: number;
  currentChord?: string;
  onCreateStemProject?: () => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (positionMs: number) => void;
  onSeekPreview?: (positionMs: number) => void;
  onSeekCommit?: (positionMs: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleVolumeUnit?: () => void;
  onClose: () => void;
  onFetchCover?: () => void;
  onUploadCover?: () => void;
}

export const BigScreenView: React.FC<BigScreenViewProps> = (props) => {
  const {
    title,
    artist,
    album,
    coverUrl,
    trackPath,
    isPlaying,
    positionMs: positionMsProp,
    durationMs,
    spectrum: spectrumProp,
    currentLang = 'en',
    onPlayPause,
    onSeek,
    onClose,
    onFetchCover,
    onUploadCover,
  } = props;
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const positionMs = useLivePositionMs(positionMsProp);
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const spectrum = useLiveSpectrum(spectrumProp ?? []);
  const t = getTranslations(currentLang);
  const [showHud, setShowHud] = useState(true);
  const [showLyrics, setShowLyrics] = useState(true);
  const [bottomVisualMode, setBottomVisualMode] = useState<'spectrum' | 'vumeter'>('spectrum');
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

  const resetHideTimer = useCallback(() => {
    setShowHud(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowHud(false);
      }
    }, 3500);
  }, [isPlaying]);

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
  }, [isPlaying, onClose, onPlayPause, resetHideTimer]);

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
        padding: 'clamp(14px, 3vh, 36px) clamp(16px, 3vw, 48px)',
        color: '#fff',
        userSelect: 'none',
        overflowX: 'hidden',
        overflowY: 'auto',
        cursor: showHud ? 'default' : 'none',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      {/* Pasek górny HUD */}
      <BigScreenHud {...props} showHud={showHud} t={t} setShowLyrics={setShowLyrics} showLyrics={showLyrics} />

      {/* Środek: Okładka i teksty piosenek w układzie panoramicznym */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showLyrics ? 'minmax(0, 420px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: 'clamp(20px, 3vw, 50px)',
          alignItems: 'center',
          flex: '1 0 auto',
          minHeight: 0,
          margin: 'clamp(8px, 2vh, 20px) 0',
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
                width: showLyrics ? 'min(340px, 36vh)' : 'min(440px, 44vh)',
                height: showLyrics ? 'min(340px, 36vh)' : 'min(440px, 44vh)',
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
            <BigScreenVinyl {...props} showLyrics={showLyrics} progress={progress} />
          )}

          {/* TRYB 3: Retro Kaseta Magnetofonowa z lat 90. (Obracające się szpule i taśma) */}
          {visualMode === 'cassette' && (
            <BigScreenTapeDeck {...props} showLyrics={showLyrics} t={t} progress={progress} />
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
          // The lyrics are absolutely positioned inside this cell so their content
          // height never stretches the grid row (the cell sizes from the cover column).
          <div style={{ position: 'relative', alignSelf: 'stretch', minWidth: 0, minHeight: 'min(380px, 50vh)' }}>
            <div style={{ position: 'absolute', inset: 0, minWidth: 0, overflow: 'hidden' }}>
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
          </div>
        )}
      </div>

      {/* Dolny panel sterowania i wizualizator HUD */}
      <BigScreenControls {...props} showHud={showHud} setBottomVisualMode={setBottomVisualMode} bottomVisualMode={bottomVisualMode} spectrum={spectrum} waveformPeaks={waveformPeaks} progress={progress} positionMs={positionMs} t={t} />
    </div>
  );
};
