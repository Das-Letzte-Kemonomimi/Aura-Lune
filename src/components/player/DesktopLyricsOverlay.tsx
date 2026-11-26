import React, { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '../../api/ipc';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Lock,
  Unlock,
  Languages,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Sliders,
  Music,
} from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { toRomaji, hasJapaneseCharacters } from '../../utils/romaji';
import type { LyricsDto } from './LyricsView';
import { useLivePositionMs } from '../../state/livePlayback';
import { cn } from '../../utils/cn';

interface DesktopLyricsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string | null;
  trackPath?: string | null;
  coverUrl?: string | null;
  durationMs?: number | null;
  positionMs: number;
  isPlaying: boolean;
  currentLang?: Language;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (positionMs: number) => void;
}

type FontSize = 'sm' | 'md' | 'lg';
type OpacityLevel = 'low' | 'med' | 'high';

export const DesktopLyricsOverlay: React.FC<DesktopLyricsOverlayProps> = ({
  isOpen,
  onClose,
  trackTitle,
  trackArtist,
  trackAlbum,
  trackPath,
  coverUrl,
  durationMs,
  positionMs: positionMsProp,
  isPlaying,
  currentLang = 'en',
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
}) => {
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const positionMs = useLivePositionMs(positionMsProp);
  const loc = getTranslations(currentLang);

  // Widget position on the screen
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('auralune_desktop_lyrics_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    // Default: bottom centre of the window
    return { x: Math.max(20, Math.floor((window.innerWidth - 640) / 2)), y: Math.max(40, window.innerHeight - 200) };
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_desktop_lyrics_locked') === 'true';
    } catch {
      return false;
    }
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_desktop_lyrics_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    try {
      const saved = localStorage.getItem('auralune_desktop_lyrics_font_size');
      if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved;
    } catch {}
    return 'md';
  });

  const [opacityLevel, setOpacityLevel] = useState<OpacityLevel>(() => {
    try {
      const saved = localStorage.getItem('auralune_desktop_lyrics_opacity');
      if (saved === 'low' || saved === 'med' || saved === 'high') return saved;
    } catch {}
    return 'med';
  });

  const [romajiMode, setRomajiMode] = useState<'original' | 'romaji' | 'dual'>(() => {
    try {
      const saved = localStorage.getItem('auralune_lyrics_romaji_mode');
      if (saved === 'original' || saved === 'romaji' || saved === 'dual') return saved;
    } catch {}
    return 'dual';
  });

  // Lyrics state
  const [lyrics, setLyrics] = useState<LyricsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Mouse dragging (drag & drop)
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({
    mouseX: 0,
    mouseY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Fetch the lyrics after a track change
  useEffect(() => {
    let active = true;

    if (!isOpen || (!trackTitle && !trackPath)) {
      queueMicrotask(() => {
        if (active) setLyrics(null);
      });
      return;
    }

    queueMicrotask(() => {
      if (active) setLoading(true);
    });

    invoke<LyricsDto | null>('get_lyrics', {
      trackPath: trackPath || null,
      title: trackTitle || 'Unknown',
      artist: trackArtist || 'Unknown',
      album: trackAlbum || null,
      durationSec: durationMs ? Math.floor(durationMs / 1000) : null,
    })
      .then((res) => {
        if (active) {
          setLyrics(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('DesktopLyricsOverlay failed to fetch the lyrics:', err);
        if (active) {
          setLyrics(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, trackTitle, trackArtist, trackAlbum, trackPath, durationMs]);

  // Effective synced lyric lines
  const lines = useMemo(() => {
    return lyrics?.lines || [];
  }, [lyrics]);

  // Find the active line index
  const activeIndex = useMemo(() => {
    if (!lyrics || !lyrics.is_synced || lines.length === 0) return -1;
    let found = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time_ms <= positionMs) {
        found = i;
      } else {
        break;
      }
    }
    return found;
  }, [lyrics, lines, positionMs]);

  const currentLine = activeIndex >= 0 && activeIndex < lines.length ? lines[activeIndex] : null;
  const nextLine = activeIndex + 1 < lines.length ? lines[activeIndex + 1] : null;

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;

      const maxX = Math.max(0, window.innerWidth - 300);
      const maxY = Math.max(0, window.innerHeight - 80);

      const newX = Math.max(10, Math.min(maxX, dragStartRef.current.initialX + dx));
      const newY = Math.max(10, Math.min(maxY, dragStartRef.current.initialY + dy));

      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        try {
          localStorage.setItem('auralune_desktop_lyrics_pos', JSON.stringify(pos));
        } catch {}
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleToggleLock = () => {
    const next = !isLocked;
    setIsLocked(next);
    try {
      localStorage.setItem('auralune_desktop_lyrics_locked', String(next));
    } catch {}
  };

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('auralune_desktop_lyrics_collapsed', String(next));
    } catch {}
  };

  const handleCycleRomaji = () => {
    const next = romajiMode === 'original' ? 'dual' : romajiMode === 'dual' ? 'romaji' : 'original';
    setRomajiMode(next);
    try {
      localStorage.setItem('auralune_lyrics_romaji_mode', next);
    } catch {}
  };

  const handleSelectFontSize = (size: FontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem('auralune_desktop_lyrics_font_size', size);
    } catch {}
  };

  const handleSelectOpacity = (op: OpacityLevel) => {
    setOpacityLevel(op);
    try {
      localStorage.setItem('auralune_desktop_lyrics_opacity', op);
    } catch {}
  };

  if (!isOpen) return null;

  // Compute the background and styles
  const bgAlpha = opacityLevel === 'low' ? '0.45' : opacityLevel === 'med' ? '0.78' : '0.94';
  const blurPx = opacityLevel === 'low' ? '12px' : '20px';
  const fontSizeMain = fontSize === 'sm' ? '1.1rem' : fontSize === 'md' ? '1.4rem' : '1.85rem';
  const fontSizeRomaji = fontSize === 'sm' ? '0.78rem' : fontSize === 'md' ? '0.92rem' : '1.15rem';

  const progress = durationMs && durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'fixed z-120 max-w-[92vw] select-none overflow-hidden rounded-3xl border border-accent-purple/40 text-fg shadow-modal transition-[width,box-shadow] duration-300',
        isCollapsed ? 'w-95' : 'w-155',
        isLocked ? 'cursor-default' : 'cursor-grab',
      )}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        background: `rgba(10, 8, 22, ${bgAlpha})`,
        backdropFilter: `blur(${blurPx}) saturate(180%)`,
        WebkitBackdropFilter: `blur(${blurPx}) saturate(180%)`,
      }}
    >
      {/* Audio progress bar along the very top of the border */}
      <div
        onClick={(e) => {
          if (!durationMs || durationMs <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek(Math.floor(pct * durationMs));
        }}
        className="relative h-1 w-full cursor-pointer bg-white/10"
        title={loc.waveform.hint}
      >
        <div
          className="h-full bg-linear-to-r from-accent-pink to-accent-cyan shadow-halo-sm shadow-accent-cyan transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header bar (drag handle + mini controls) */}
      <div className="flex items-center justify-between border-b border-white/6 bg-black/25 px-3.5 py-2 text-xs">
        <div className="flex min-w-0 flex-auto items-center gap-2 overflow-hidden">
          {!isLocked && <GripHorizontal size={14} className="shrink-0 text-fg-muted opacity-70" />}
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-4.5 w-4.5 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <Music size={14} className="shrink-0 text-accent-pink" />
          )}
          <span className="shrink truncate font-bold text-fg">
            {trackTitle || 'Auralune'}
          </span>
          <span className="shrink-2 truncate text-fg-muted">
            • {trackArtist}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Romaji Switcher Button */}
          <button
            onClick={handleCycleRomaji}
            title={`${loc.lyricsView.romajiModeTooltip}: ${romajiMode}`}
            className={cn(
              'border',
              'flex items-center gap-1 rounded-md px-1.5 py-1 text-xxs font-semibold',
              romajiMode !== 'original' ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-transparent text-fg-muted',
              romajiMode !== 'original' ? 'border-accent-cyan' : 'border-transparent',
            )}
          >
            <Languages size={11} />
            {romajiMode === 'original' ? 'Kana' : romajiMode === 'romaji' ? 'Romaji' : 'Dual'}
          </button>

          {/* Appearance options */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title={loc.desktopOverlay.title}
            className={cn(
              'flex rounded-md border-0 p-1',
              showSettings ? 'bg-accent-purple/20 text-accent-purple' : 'bg-transparent text-fg-muted',
            )}
          >
            <Sliders size={13} />
          </button>

          {/* Position lock */}
          <button
            onClick={handleToggleLock}
            title={isLocked ? loc.desktopOverlay.unlockPosition : loc.desktopOverlay.lockPosition}
            className={cn(
              'flex rounded-md border-0 bg-transparent p-1',
              isLocked ? 'text-accent-pink' : 'text-fg-muted',
            )}
          >
            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>

          {/* Collapse / expand */}
          <button
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className="flex rounded-md border-0 bg-transparent p-1 text-fg-muted"
          >
            {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>

          {/* Close the overlay */}
          <button
            onClick={onClose}
            title={loc.desktopOverlay.closeTooltip}
            className="flex rounded-md border-0 bg-transparent p-1 text-fg-muted"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Appearance settings panel (font and opacity) */}
      {showSettings && (
        <div className="flex items-center justify-between gap-3 border-b border-white/6 bg-black/40 px-4 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-fg-muted">{loc.desktopOverlay.fontSize}:</span>
            {(['sm', 'md', 'lg'] as FontSize[]).map((sz) => (
              <button
                key={sz}
                onClick={() => handleSelectFontSize(sz)}
                className={cn(
                  'rounded-sm border-0 px-2 py-0.5 text-xxs font-semibold text-fg uppercase',
                  fontSize === sz ? 'bg-accent-purple' : 'bg-white/6',
                )}
              >
                {sz}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-fg-muted">{loc.desktopOverlay.opacity}:</span>
            {(['low', 'med', 'high'] as OpacityLevel[]).map((op) => (
              <button
                key={op}
                onClick={() => handleSelectOpacity(op)}
                className={cn(
                  'rounded-sm border-0 px-2 py-0.5 text-xxs font-semibold uppercase',
                  opacityLevel === op ? 'bg-accent-cyan text-black' : 'bg-white/6 text-fg',
                )}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main lyric line area */}
      <div
        className={cn(
          'flex flex-col items-center gap-1.5 text-center',
          isCollapsed ? 'px-4.5 py-2.5' : 'px-6 py-4',
        )}
      >
        {loading && (
          <div className="text-sm text-fg-muted">
            {loc.lyricsView.searching}
          </div>
        )}

        {!loading && !currentLine && (
          <div className="text-sm font-medium text-fg-muted italic">
            {lyrics?.plain_lyrics ? lyrics.plain_lyrics.split('\n')[0] : loc.desktopOverlay.noLyrics}
          </div>
        )}

        {!loading && currentLine && (
          <div className="flex w-full flex-col items-center gap-1">
            {/* Main line with a neon karaoke gradient */}
            <div
              className="leading-snug font-extrabold tracking-tight transition-all duration-200"
              style={{
                fontSize: fontSizeMain,
                background: 'linear-gradient(135deg, #ffffff 10%, #f472b6 60%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 16px rgba(244, 63, 94, 0.4), 0 0 30px rgba(6, 182, 212, 0.3)',
              }}
            >
              {romajiMode === 'romaji'
                ? toRomaji(currentLine.text)
                : currentLine.text}
            </div>

            {/* Romaji transliteration in two-line mode */}
            {romajiMode === 'dual' && hasJapaneseCharacters(currentLine.text) && (
              <div
                className="font-semibold tracking-wide text-accent-cyan italic"
                style={{ fontSize: fontSizeRomaji, textShadow: '0 0 12px rgba(6, 182, 212, 0.5)' }}
              >
                {toRomaji(currentLine.text)}
              </div>
            )}

            {/* Upcoming line preview in the expanded mode */}
            {!isCollapsed && nextLine && (
              <div className="mt-1.5 max-w-9/10 truncate text-ui font-medium text-fg-muted opacity-60">
                <span className="mr-1.5 text-xs text-accent-pink uppercase">
                  {loc.desktopOverlay.upcoming}
                </span>
                {romajiMode === 'romaji' ? toRomaji(nextLine.text) : nextLine.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom micro control bar (in the expanded mode) */}
      {!isCollapsed && (
        <div className="flex items-center justify-center gap-4 px-4 pt-1.5 pb-2.5">
          <button
            onClick={onPrev}
            title={loc.player.previous}
            className="flex items-center justify-center border-0 bg-transparent p-1 text-fg-muted transition-colors duration-200"
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={onPlayPause}
            title={isPlaying ? loc.player.pause : loc.player.play}
            className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-accent-gradient text-on-accent shadow-halo shadow-accent-pink/45"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-px" />}
          </button>

          <button
            onClick={onNext}
            title={loc.player.next}
            className="flex items-center justify-center border-0 bg-transparent p-1 text-fg-muted transition-colors duration-200"
          >
            <SkipForward size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
