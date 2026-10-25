import React, { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
} from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';
import { toRomaji, hasJapaneseCharacters } from '../utils/romaji';
import type { LyricsDto } from './LyricsView';

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
  positionMs,
  isPlaying,
  currentLang = 'en',
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
}) => {
  const loc = getTranslations(currentLang);

  // Pozycja widżetu na ekranie
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
    // Domyślnie na dole na środku okna
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

  // Stan tekstów
  const [lyrics, setLyrics] = useState<LyricsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Przeciąganie myszą (Drag & Drop)
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({
    mouseX: 0,
    mouseY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Pobieranie tekstów po zmianie utworu
  useEffect(() => {
    if (!isOpen || (!trackTitle && !trackPath)) {
      setLyrics(null);
      return;
    }

    let active = true;
    setLoading(true);

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
        console.error('DesktopLyricsOverlay błąd pobierania tekstów:', err);
        if (active) {
          setLyrics(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, trackTitle, trackArtist, trackPath, durationMs]);

  // Efektywne linie zsynchronizowanego tekstu
  const lines = useMemo(() => {
    return lyrics?.lines || [];
  }, [lyrics]);

  // Wyznaczenie aktywnego indeksu wersu
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

  // Obsługa przeciągania
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

  // Obliczenie tła i styli
  const bgAlpha = opacityLevel === 'low' ? '0.45' : opacityLevel === 'med' ? '0.78' : '0.94';
  const blurPx = opacityLevel === 'low' ? '12px' : '20px';
  const fontSizeMain = fontSize === 'sm' ? '1.1rem' : fontSize === 'md' ? '1.4rem' : '1.85rem';
  const fontSizeRomaji = fontSize === 'sm' ? '0.78rem' : fontSize === 'md' ? '0.92rem' : '1.15rem';

  const progress = durationMs && durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: isCollapsed ? '380px' : '620px',
        maxWidth: '92vw',
        zIndex: 99998,
        borderRadius: '20px',
        background: `rgba(10, 8, 22, ${bgAlpha})`,
        backdropFilter: `blur(${blurPx}) saturate(180%)`,
        WebkitBackdropFilter: `blur(${blurPx}) saturate(180%)`,
        border: '1px solid rgba(168, 85, 247, 0.4)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 25px rgba(168, 85, 247, 0.25)',
        color: '#fff',
        userSelect: 'none',
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
        cursor: isLocked ? 'default' : 'grab',
      }}
    >
      {/* Pasek postępu audio na samej górze obramowania */}
      <div
        onClick={(e) => {
          if (!durationMs || durationMs <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek(Math.floor(pct * durationMs));
        }}
        style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          position: 'relative',
        }}
        title="Seek"
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-cyan))',
            boxShadow: '0 0 8px var(--accent-cyan)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* Belka nagłówkowa (Uchwyt przeciągania + Mini kontrolki) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {!isLocked && <GripHorizontal size={14} color="var(--text-muted)" style={{ opacity: 0.7 }} />}
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }}
            />
          ) : (
            <Music size={14} color="var(--accent-pink)" />
          )}
          <span
            style={{
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isCollapsed ? '160px' : '260px',
            }}
          >
            {trackTitle || 'Auralune'}
          </span>
          <span
            style={{
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isCollapsed ? '100px' : '180px',
            }}
          >
            • {trackArtist}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Romaji Switcher Button */}
          <button
            onClick={handleCycleRomaji}
            title={`${loc.lyricsView.romajiModeTooltip}: ${romajiMode}`}
            style={{
              background: romajiMode !== 'original' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              border: `1px solid ${romajiMode !== 'original' ? 'var(--accent-cyan)' : 'transparent'}`,
              color: romajiMode !== 'original' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              borderRadius: '6px',
              padding: '3px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.68rem',
              fontWeight: 600,
            }}
          >
            <Languages size={11} />
            {romajiMode === 'original' ? 'Kana' : romajiMode === 'romaji' ? 'Romaji' : 'Dual'}
          </button>

          {/* Opcje wyglądu */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title={loc.desktopOverlay.title}
            style={{
              background: showSettings ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
              border: 'none',
              color: showSettings ? 'var(--accent-purple)' : 'var(--text-muted)',
              borderRadius: '6px',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <Sliders size={13} />
          </button>

          {/* Blokada pozycji */}
          <button
            onClick={handleToggleLock}
            title={isLocked ? loc.desktopOverlay.unlockPosition : loc.desktopOverlay.lockPosition}
            style={{
              background: 'transparent',
              border: 'none',
              color: isLocked ? 'var(--accent-pink)' : 'var(--text-muted)',
              borderRadius: '6px',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>

          {/* Zwiń / Rozwiń */}
          <button
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>

          {/* Zamknij overlay */}
          <button
            onClick={onClose}
            title={loc.desktopOverlay.closeTooltip}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Panel ustawień wyglądu (czcionka i przezroczystość) */}
      {showSettings && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(0,0,0,0.4)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{loc.desktopOverlay.fontSize}:</span>
            {(['sm', 'md', 'lg'] as FontSize[]).map((sz) => (
              <button
                key={sz}
                onClick={() => handleSelectFontSize(sz)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: fontSize === sz ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {sz}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{loc.desktopOverlay.opacity}:</span>
            {(['low', 'med', 'high'] as OpacityLevel[]).map((op) => (
              <button
                key={op}
                onClick={() => handleSelectOpacity(op)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: opacityLevel === op ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.06)',
                  color: opacityLevel === op ? '#000' : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Główny obszar wersu tekstu */}
      <div
        style={{
          padding: isCollapsed ? '10px 18px' : '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '6px',
        }}
      >
        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {loc.lyricsView.searching}
          </div>
        )}

        {!loading && !currentLine && (
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 500,
              fontStyle: 'italic',
            }}
          >
            {lyrics?.plain_lyrics ? lyrics.plain_lyrics.split('\n')[0] : loc.desktopOverlay.noLyrics}
          </div>
        )}

        {!loading && currentLine && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
            {/* Główny wers z neonowym gradientem karaoke */}
            <div
              style={{
                fontSize: fontSizeMain,
                fontWeight: 800,
                lineHeight: 1.35,
                background: 'linear-gradient(135deg, #ffffff 10%, #f472b6 60%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 16px rgba(244, 63, 94, 0.4), 0 0 30px rgba(6, 182, 212, 0.3)',
                letterSpacing: '-0.01em',
                transition: 'all 0.2s ease',
              }}
            >
              {romajiMode === 'romaji'
                ? toRomaji(currentLine.text)
                : currentLine.text}
            </div>

            {/* Transliteracja Romaji w trybie dwuwiersza */}
            {romajiMode === 'dual' && hasJapaneseCharacters(currentLine.text) && (
              <div
                style={{
                  fontSize: fontSizeRomaji,
                  fontStyle: 'italic',
                  fontWeight: 600,
                  color: 'var(--accent-cyan)',
                  textShadow: '0 0 12px rgba(6, 182, 212, 0.5)',
                  letterSpacing: '0.03em',
                }}
              >
                {toRomaji(currentLine.text)}
              </div>
            )}

            {/* Podgląd nadchodzącego wersu (Upcoming preview) w trybie rozwiniętym */}
            {!isCollapsed && nextLine && (
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  opacity: 0.6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '90%',
                }}
              >
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', marginRight: '6px', color: 'var(--accent-pink)' }}>
                  {loc.desktopOverlay.upcoming}
                </span>
                {romajiMode === 'romaji' ? toRomaji(nextLine.text) : nextLine.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dolny mikro-pasek sterowania (w trybie rozwiniętym) */}
      {!isCollapsed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '6px 16px 10px 16px',
          }}
        >
          <button
            onClick={onPrev}
            title={loc.player.previous}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={onPlayPause}
            title={isPlaying ? loc.player.pause : loc.player.play}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(244, 63, 94, 0.45)',
            }}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: '1px' }} />}
          </button>

          <button
            onClick={onNext}
            title={loc.player.next}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
          >
            <SkipForward size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
