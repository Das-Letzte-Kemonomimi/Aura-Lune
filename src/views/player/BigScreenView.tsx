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
import { parseOneOf, usePersistedState } from '../../hooks/usePersistedState';
import { BigScreenControls } from './bigscreen/BigScreenControls';
import { BigScreenTapeDeck } from './bigscreen/BigScreenTapeDeck';
import { BigScreenVinyl } from './bigscreen/BigScreenVinyl';
import { BigScreenHud } from './bigscreen/BigScreenHud';
import { cn } from '../../utils/cn';
import { Button, SegmentedControl } from '../../components/ui';

const BIG_SCREEN_VISUAL_MODES = ['cover', 'vinyl', 'cassette'] as const;
type BigScreenVisualMode = (typeof BIG_SCREEN_VISUAL_MODES)[number];

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
  const [visualMode, handleSetVisualMode] = usePersistedState<BigScreenVisualMode>(
    'auralune_bigscreen_visual_mode',
    'vinyl',
    { parse: parseOneOf(BIG_SCREEN_VISUAL_MODES) },
  );
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
          <SegmentedControl
            label={t.player.displayModeLabel}
            tone="purple"
            value={visualMode}
            onChange={handleSetVisualMode}
            items={[
              { value: 'cover', label: t.bigScreenModes.cover, icon: <Image size={13} /> },
              { value: 'vinyl', label: t.bigScreenModes.vinyl, icon: <Disc3 size={13} /> },
              { value: 'cassette', label: t.bigScreenModes.cassette, icon: <CassetteTape size={13} /> },
            ]}
          />

          {/* MODE 1: classic album cover */}
          {visualMode === 'cover' && (
            <div
              className={cn(
                'relative flex items-center justify-center overflow-hidden rounded-4xl border-2 border-line-accent transition-shadow duration-300 will-change-transform',
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
                    'flex h-4/5 w-4/5 items-center justify-center rounded-full border-3 border-line',
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
              <Button variant="tinted" tone="cyan" onClick={onFetchCover}>
                <Download size={13} /> {t.player.fetchCover}
              </Button>
            )}
            {onUploadCover && (
              <Button variant="tinted" tone="pink" onClick={onUploadCover}>
                <Upload size={13} /> {t.covers.uploadCustomCover}
              </Button>
            )}
          </div>

          <div>
            <h1
              className={cn(
                'mx-0 mt-0 mb-2 font-extrabold tracking-tight text-shadow-bigscreen',
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
