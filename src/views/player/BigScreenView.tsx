import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Disc,
  Download,
  Upload,
  CassetteTape,
  Disc3,
  Image,
} from '../../components/ui/icons';
import { LyricsView } from '../../components/player/LyricsView';
import { type Language, getTranslations } from '../../i18n';
import { useLivePositionMs, useLiveSpectrum } from '../../state/livePlayback';
import { BigScreenControls } from './bigscreen/BigScreenControls';
import { BigScreenTapeDeck } from './bigscreen/BigScreenTapeDeck';
import { BigScreenVinyl } from './bigscreen/BigScreenVinyl';
import { BigScreenHud } from './bigscreen/BigScreenHud';
import { cn } from '../../utils/cn';

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
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const positionMs = useLivePositionMs(positionMsProp);
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
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

  // Deterministic waveform profile for the full-screen view
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
      className={cn(
        'fixed inset-0 z-90 flex transform-gpu select-none flex-col justify-between overflow-x-hidden overflow-y-auto px-[clamp(1rem,3vw,3rem)] py-[clamp(0.875rem,3vh,2.25rem)] text-fg will-change-transform',
        showHud ? 'cursor-default' : 'cursor-none',
      )}
      style={{ background: 'radial-gradient(circle at center, #140e26 0%, #06070e 100%)' }}
    >
      {/* Top HUD bar */}
      <BigScreenHud {...props} showHud={showHud} t={t} setShowLyrics={setShowLyrics} showLyrics={showLyrics} />

      {/* Centre: cover and lyrics in a panoramic layout */}
      <div
        className={cn(
          'my-[clamp(0.5rem,2vh,1.25rem)] grid min-h-0 items-center gap-[clamp(1.25rem,3vw,3.125rem)] flex-[1_0_auto]',
          showLyrics ? 'grid-cols-[minmax(0,--spacing(105))_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]',
        )}
      >
        {/* Left column: large spinning vinyl record / cover */}
        <div className="flex flex-col items-center gap-5 text-center">
          {/* Visual mode toggle: cover / vinyl / retro cassette */}
          <div
            className="flex items-center gap-1 rounded-3xl border border-white/10 bg-white/6 p-1 shadow-lift shadow-black/30"
          >
            <button
              onClick={() => handleSetVisualMode('cover')}
              className={cn(
                'flex items-center gap-1.5 rounded-2xl border-0 px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                visualMode === 'cover' ? 'bg-accent-purple text-fg' : 'bg-transparent text-fg-muted',
              )}
            >
              <Image size={13} /> {t.bigScreenModes.cover}
            </button>
            <button
              onClick={() => handleSetVisualMode('vinyl')}
              className={cn(
                'flex items-center gap-1.5 rounded-2xl border-0 px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                visualMode === 'vinyl' ? 'bg-accent-gradient text-fg shadow-halo-sm shadow-accent-pink/40' : 'bg-transparent text-fg-muted shadow-none',
              )}
            >
              <Disc3 size={13} /> {t.bigScreenModes.vinyl}
            </button>
            <button
              onClick={() => handleSetVisualMode('cassette')}
              className={cn(
                'flex items-center gap-1.5 rounded-2xl border-0 px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                visualMode === 'cassette' ? 'text-fg shadow-halo-sm shadow-accent-cyan/40' : 'text-fg-muted shadow-none',
                visualMode === 'cassette' ? 'bg-linear-135 from-accent-cyan to-sky-600' : 'bg-transparent',
              )}
            >
              <CassetteTape size={13} /> {t.bigScreenModes.cassette}
            </button>
          </div>

          {/* MODE 1: classic album cover */}
          {visualMode === 'cover' && (
            <div
              className={cn(
                'relative flex items-center justify-center overflow-hidden rounded-4xl border-2 border-white/15 transition-shadow duration-300 will-change-transform',
                isPlaying ? 'shadow-halo-2xl shadow-accent-purple/45' : 'shadow-2xl shadow-black/70',
              )}
              style={{
                width: showLyrics ? 'min(340px, 36vh)' : 'min(440px, 44vh)',
                height: showLyrics ? 'min(340px, 36vh)' : 'min(440px, 44vh)',
                background: coverUrl
                  ? `url("${coverUrl}") center/cover no-repeat`
                  : 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
                transform: 'translateZ(0)',
              }}
            >
              {!coverUrl && (
                <div
                  className={cn(
                    'flex h-4/5 w-4/5 items-center justify-center rounded-full border-3 border-white/8',
                    isPlaying && 'animate-spin',
                  )}
                  style={{
                    background: 'radial-gradient(circle, #0b0f19 35%, #182032 50%, #0f172a 75%, #050811 100%)',
                  }}
                >
                  <Disc size={64} className="text-accent-pink" />
                </div>
              )}
            </div>
          )}

          {/* MODE 2: spinning vinyl with grooves, a label and a tonearm */}
          {visualMode === 'vinyl' && (
            <BigScreenVinyl {...props} showLyrics={showLyrics} progress={progress} />
          )}

          {/* MODE 3: 90s retro cassette (spinning reels and tape) */}
          {visualMode === 'cassette' && (
            <BigScreenTapeDeck {...props} showLyrics={showLyrics} t={t} progress={progress} />
          )}

          <div className="flex flex-wrap gap-2">
            {onFetchCover && (
              <button
                onClick={onFetchCover}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-3.5 py-1.5 text-ui font-semibold text-accent-cyan transition-all duration-200"
              >
                <Download size={13} /> {t.player.fetchCover}
              </button>
            )}
            {onUploadCover && (
              <button
                onClick={onUploadCover}
                className="flex items-center gap-1.5 rounded-lg border border-pink-500/35 bg-pink-500/15 px-3.5 py-1.5 text-ui font-semibold text-accent-pink transition-all duration-200"
              >
                <Upload size={13} /> {t.covers.uploadCustomCover}
              </button>
            )}
          </div>

          <div>
            <h1
              className={cn(
                'mx-0 mt-0 mb-2 font-extrabold tracking-tight [text-shadow:0_0_1.25rem_rgb(255_255_255/0.2)]',
                showLyrics ? 'text-3xl' : 'text-4xl',
              )}
            >
              {title || 'Auralune Player'}
            </h1>
            <p
              className={cn(
                'mx-0 mt-0 mb-1 font-semibold text-accent-pink',
                showLyrics ? 'text-lg' : 'text-xl',
              )}
            >
              {artist || t.player.unknownArtist}
            </p>
            {album && (
              <p className="m-0 text-sm text-fg-muted">
                {album}
              </p>
            )}
          </div>
        </div>

        {/* Right column: synced lyrics */}
        {showLyrics && (
          // The lyrics are absolutely positioned inside this cell so their content
          // height never stretches the grid row (the cell sizes from the cover column).
          <div className="relative min-h-[min(23.75rem,50vh)] min-w-0 self-stretch">
            <div className="absolute inset-0 min-w-0 overflow-hidden">
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

      {/* Bottom control panel and HUD visualizer */}
      <BigScreenControls {...props} showHud={showHud} setBottomVisualMode={setBottomVisualMode} bottomVisualMode={bottomVisualMode} spectrum={spectrum} waveformPeaks={waveformPeaks} progress={progress} positionMs={positionMs} t={t} />
    </div>
  );
};
