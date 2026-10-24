import React, { useEffect, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Mic2,
  RefreshCw,
  X,
  Radio,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  Music,
  Clock,
  Save,
  Check,
  Wand2,
} from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

export interface LyricLineDto {
  time_ms: number;
  text: string;
}

export interface LyricsDto {
  is_synced: boolean;
  lines: LyricLineDto[];
  plain_lyrics: string | null;
  source: string; // "local_lrc" | "lrclib"
}

interface LyricsViewProps {
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string | null;
  trackPath?: string | null;
  durationSec?: number | null;
  currentPositionMs: number;
  currentLang?: Language;
  onSeek: (positionMs: number) => void;
  onClose: () => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  trackTitle,
  trackArtist,
  trackAlbum,
  trackPath,
  durationSec,
  currentPositionMs,
  currentLang = 'en',
  onSeek,
  onClose,
}) => {
  const loc = getTranslations(currentLang);
  const [lyrics, setLyrics] = useState<LyricsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_lyrics_autoscroll');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    try {
      localStorage.setItem('auralune_lyrics_autoscroll', String(next));
    } catch {}
  };
  const [offsetMs, setOffsetMs] = useState<number>(0);
  const [isSyncMode, setIsSyncMode] = useState<boolean>(false);
  const [syncTargetIndex, setSyncTargetIndex] = useState<number>(0);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Pobieranie tekstów piosenek
  const loadLyrics = async () => {
    if (!trackTitle && !trackPath) {
      setLyrics(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSaveSuccessMsg(null);
    setOffsetMs(0);

    try {
      const data = await invoke<LyricsDto | null>('get_lyrics', {
        trackPath: trackPath || null,
        title: trackTitle || 'Unknown',
        artist: trackArtist || 'Unknown',
        album: trackAlbum || null,
        durationSec: durationSec || null,
      });

      setLyrics(data);
      if (data && data.lines.length > 0) {
        setSyncTargetIndex(0);
      }
    } catch (err) {
      console.error('Błąd pobierania tekstów:', err);
      setError(String(err));
      setLyrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLyrics();
  }, [trackTitle, trackArtist, trackPath]);

  // Efektywne linie z uwzględnieniem przesunięcia (offsetMs)
  const effectiveLines = useMemo(() => {
    if (!lyrics || !lyrics.lines) return [];
    return lyrics.lines.map((line) => ({
      ...line,
      effective_time_ms: Math.max(0, line.time_ms + offsetMs),
    }));
  }, [lyrics, offsetMs]);

  // Wyznaczanie indeksu aktualnej linii
  const activeIndex = useMemo(() => {
    if (!lyrics || !lyrics.is_synced || effectiveLines.length === 0) {
      return -1;
    }

    let found = -1;
    for (let i = 0; i < effectiveLines.length; i++) {
      if (effectiveLines[i].effective_time_ms <= currentPositionMs) {
        found = i;
      } else {
        break;
      }
    }
    return found;
  }, [lyrics, effectiveLines, currentPositionMs]);

  // Autoscroll do aktywnej linii
  useEffect(() => {
    if (autoScroll && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScroll]);

  // Ręczna synchronizacja: ustawienie czasu dla konkretnej linii
  const handleSetLineTime = (index: number, timeMs: number) => {
    if (!lyrics) return;
    const newLines = [...lyrics.lines];
    newLines[index] = { ...newLines[index], time_ms: Math.max(0, timeMs - offsetMs) };
    setLyrics({
      ...lyrics,
      lines: newLines,
      is_synced: true,
    });
    setSyncTargetIndex(Math.min(newLines.length - 1, index + 1));
  };

  // Automatyczny rozkład linii (Auto-Sync) wzdłuż trwania utworu
  const handleAutoDistribute = () => {
    if (!lyrics) return;
    const linesToProcess = lyrics.lines.length > 0
      ? lyrics.lines
      : (lyrics.plain_lyrics || '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .map((text) => ({ time_ms: 0, text }));

    if (linesToProcess.length === 0) return;

    const totalDurMs = durationSec && durationSec > 10 ? durationSec * 1000 : 180000;
    const startDelayMs = 6000; // 6s intro
    const availableMs = Math.max(10000, totalDurMs - startDelayMs - 12000); // 12s outro
    const stepMs = availableMs / linesToProcess.length;

    const distributed = linesToProcess.map((line, idx) => ({
      time_ms: Math.round(startDelayMs + idx * stepMs),
      text: line.text,
    }));

    setLyrics({
      is_synced: true,
      lines: distributed,
      plain_lyrics: lyrics.plain_lyrics,
      source: 'auto_distributed',
    });
    setOffsetMs(0);
    setSaveSuccessMsg(loc.lyricsView.autoDistributedSuccess);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Formatowanie do formatu standardowego LRC
  const formatTimeLrc = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}]`;
  };

  // Zapis do lokalnego pliku .lrc
  const handleSaveLrc = async () => {
    if (!trackPath || !lyrics || !lyrics.lines || lyrics.lines.length === 0) {
      alert(loc.lyricsView.noLyricsFound);
      return;
    }

    try {
      const lrcHeader = `[ti:${trackTitle}]\n[ar:${trackArtist}]\n[al:${trackAlbum || ''}]\n[by:Auralune - Das Letzte Kemonomimi]\n\n`;
      const lrcBody = lyrics.lines
        .map((l) => `${formatTimeLrc(Math.max(0, l.time_ms + offsetMs))} ${l.text}`)
        .join('\n');
      const fullLrc = lrcHeader + lrcBody;

      const savedPath = await invoke<string>('save_lyrics_lrc', {
        trackPath,
        lrcContent: fullLrc,
      });

      setLyrics({
        ...lyrics,
        lines: lyrics.lines.map((l) => ({ ...l, time_ms: Math.max(0, l.time_ms + offsetMs) })),
        source: 'local_lrc',
      });
      setOffsetMs(0);
      setSaveSuccessMsg(`${loc.lyricsView.lrcSavedSuccess}: ${savedPath}`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`${loc.lyricsView.errorPrefix}: ${err}`);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      {/* Nagłówek okna tekstów */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(0, 0, 0, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Mic2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {trackTitle || loc.lyricsView.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {trackArtist}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {lyrics && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                background: lyrics.is_synced ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: lyrics.is_synced ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: `1px solid ${lyrics.is_synced ? 'rgba(6, 182, 212, 0.3)' : 'var(--border-subtle)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {lyrics.is_synced ? <Radio size={12} /> : <FileText size={12} />}
              {lyrics.source === 'local_lrc'
                ? loc.lyricsView.localLrcBadge
                : lyrics.source === 'auto_distributed'
                ? loc.lyricsView.autoSyncBadge
                : loc.lyricsView.lrcLibBadge}
            </span>
          )}

          {/* Przycisk trybu edycji/synchronizacji */}
          <button
            onClick={() => setIsSyncMode(!isSyncMode)}
            title={loc.lyricsView.syncModeTitle}
            style={{
              background: isSyncMode ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isSyncMode ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
              color: isSyncMode ? 'var(--accent-pink)' : 'var(--text-secondary)',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Clock size={13} />
            {isSyncMode ? loc.lyricsView.syncToggleClose : loc.lyricsView.syncToggleOpen}
          </button>

          {lyrics?.is_synced && (
            <button
              onClick={handleToggleAutoScroll}
              title={autoScroll ? loc.lyricsView.autoScrollOn : loc.lyricsView.autoScrollOff}
              style={{
                background: autoScroll ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                border: `1px solid ${autoScroll ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
                color: autoScroll ? 'var(--accent-purple)' : 'var(--text-muted)',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.75rem',
              }}
            >
              {autoScroll ? <Lock size={13} /> : <Unlock size={13} />}
              {loc.lyricsView.autoScroll}
            </button>
          )}

          <button
            onClick={loadLyrics}
            title={loc.lyricsView.refreshTooltip}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onClose}
            title={loc.lyricsView.closeTooltip}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* PASEK NARZĘDZI SYNCHRONIZACJI (Offset & Auto-Sync & Save) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          gap: '8px',
        }}
      >
        {/* Korekta przesunięcia (Offset) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{loc.lyricsView.compensation}:</span>
          <button
            onClick={() => setOffsetMs((prev) => prev - 500)}
            style={{
              padding: '3px 7px',
              borderRadius: '5px',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            -500ms
          </button>
          <button
            onClick={() => setOffsetMs((prev) => prev - 100)}
            style={{
              padding: '3px 7px',
              borderRadius: '5px',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            -100ms
          </button>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '5px',
              background: offsetMs !== 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.04)',
              color: offsetMs !== 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            }}
          >
            {offsetMs > 0 ? `+${offsetMs}ms` : `${offsetMs}ms`}
          </span>
          <button
            onClick={() => setOffsetMs((prev) => prev + 100)}
            style={{
              padding: '3px 7px',
              borderRadius: '5px',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            +100ms
          </button>
          <button
            onClick={() => setOffsetMs((prev) => prev + 500)}
            style={{
              padding: '3px 7px',
              borderRadius: '5px',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            +500ms
          </button>
          {offsetMs !== 0 && (
            <button
              onClick={() => setOffsetMs(0)}
              style={{
                padding: '3px 7px',
                borderRadius: '5px',
                background: 'rgba(244,63,94,0.15)',
                color: 'var(--accent-pink)',
                border: '1px solid rgba(244,63,94,0.3)',
                cursor: 'pointer',
              }}
            >
              {loc.lyricsView.resetOffset}
            </button>
          )}
        </div>

        {/* Akcje Auto-Sync i Zapis pliku */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleAutoDistribute}
            title={loc.lyricsView.autoDistribute}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              color: 'var(--accent-purple)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Wand2 size={13} /> {loc.lyricsView.autoDistribute}
          </button>

          {trackPath && (
            <button
              onClick={handleSaveLrc}
              title={loc.lyricsView.saveLrc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: 'var(--accent-green)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Save size={13} /> {loc.lyricsView.saveLrc}
            </button>
          )}
        </div>
      </div>

      {/* Komunikat o sukcesie zapisu */}
      {saveSuccessMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.35)',
            color: 'var(--accent-green)',
            padding: '6px 16px',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Check size={14} /> {saveSuccessMsg}
        </div>
      )}

      {/* PANEL AKTYWNEJ MANUALNEJ SYNCHRONIZACJI */}
      {isSyncMode && lyrics && lyrics.lines && lyrics.lines.length > 0 && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.12)',
            borderBottom: '1px solid rgba(244, 63, 94, 0.25)',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-pink)', fontWeight: 700, textTransform: 'uppercase' }}>
              {loc.lyricsView.syncTargetLabel.replace('{i}', String(syncTargetIndex + 1)).replace('{n}', String(lyrics.lines.length))}:
            </span>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {lyrics.lines[syncTargetIndex]?.text || loc.lyricsView.endOfLyrics}
            </div>
          </div>

          <button
            onClick={() => handleSetLineTime(syncTargetIndex, currentPositionMs)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'var(--accent-pink)',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(244, 63, 94, 0.4)',
            }}
          >
            <Clock size={14} /> {loc.lyricsView.clickAtTime}: {formatTimeLrc(currentPositionMs)}
          </button>
        </div>
      )}

      {/* Główny obszar wyświetlania tekstu */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '30px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '14px',
              color: 'var(--text-secondary)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--accent-purple)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: '0.88rem' }}>{loc.lyricsView.searching}</span>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <AlertCircle size={32} color="var(--accent-pink)" />
            <span style={{ fontSize: '0.9rem' }}>{loc.lyricsView.errorPrefix}: {error}</span>
            <button
              onClick={loadLyrics}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              {loc.lyricsView.retry}
            </button>
          </div>
        )}

        {!loading && !error && !lyrics && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <Music size={32} opacity={0.5} />
            <span style={{ fontSize: '0.9rem' }}>{loc.lyricsView.noLyricsFound}</span>
            <div style={{ fontSize: '0.78rem', maxWidth: '320px', lineHeight: 1.5 }}>
              {loc.lyricsView.noLyricsHint.replace('{file}', trackTitle ? `${trackTitle}.lrc` : 'track.lrc')}
            </div>
          </div>
        )}

        {/* Tekst zsynchronizowany */}
        {!loading && lyrics?.is_synced && lyrics.lines && lyrics.lines.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              paddingTop: '15vh',
              paddingBottom: '25vh',
            }}
          >
            {lyrics.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              const isTarget = isSyncMode && idx === syncTargetIndex;

              return (
                <div
                  key={`${line.time_ms}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: isActive ? '1.45rem' : '1.05rem',
                    fontWeight: isActive ? 700 : 500,
                    lineHeight: 1.45,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: isActive
                      ? 'var(--text-primary)'
                      : isPast
                      ? 'var(--text-secondary)'
                      : 'var(--text-muted)',
                    opacity: isActive ? 1 : isPast ? 0.65 : 0.45,
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    background: isTarget
                      ? 'rgba(244, 63, 94, 0.18)'
                      : isActive
                      ? 'rgba(168, 85, 247, 0.12)'
                      : 'transparent',
                    textShadow: isActive
                      ? '0 0 20px var(--accent-purple), 0 0 40px var(--accent-cyan)'
                      : 'none',
                    borderLeft: isActive
                      ? '4px solid var(--accent-cyan)'
                      : isTarget
                      ? '4px solid var(--accent-pink)'
                      : '4px solid transparent',
                  }}
                  onClick={() => {
                    if (isSyncMode) {
                      setSyncTargetIndex(idx);
                    } else {
                      onSeek(Math.max(0, line.time_ms + offsetMs));
                    }
                  }}
                >
                  {/* Znacznik czasu w trybie synchronizacji */}
                  {isSyncMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        {formatTimeLrc(Math.max(0, line.time_ms + offsetMs))}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetLineTime(idx, currentPositionMs);
                        }}
                        title={loc.lyricsView.syncLineTooltip}
                        style={{
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: 'rgba(244, 63, 94, 0.25)',
                          color: 'var(--accent-pink)',
                          border: '1px solid rgba(244, 63, 94, 0.4)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⏱ {loc.lyricsView.syncLineAction}
                      </button>
                    </div>
                  )}

                  <span style={{ flex: 1 }}>{line.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tekst statyczny (plain) z opcją konwersji do zsynchronizowanego */}
        {!loading && !lyrics?.is_synced && lyrics?.plain_lyrics && (
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              padding: '20px 0',
            }}
          >
            <div
              style={{
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {loc.lyricsView.staticNotice}
              </div>
              <button
                onClick={handleAutoDistribute}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--accent-purple)',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Wand2 size={13} /> {loc.lyricsView.autoSyncAction}
              </button>
            </div>

            <div
              style={{
                whiteSpace: 'pre-line',
                lineHeight: 1.8,
                fontSize: '1rem',
                color: 'var(--text-primary)',
                opacity: 0.9,
              }}
            >
              {lyrics.plain_lyrics}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

