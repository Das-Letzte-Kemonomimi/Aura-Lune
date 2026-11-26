import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { invoke } from '../../api/ipc';
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
  Languages,
} from 'lucide-react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { toRomaji, hasJapaneseCharacters } from '../../utils/romaji';
import { cn } from '../../utils/cn';

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
  const [romajiMode, setRomajiMode] = useState<'original' | 'romaji' | 'dual'>(() => {
    try {
      const saved = localStorage.getItem('auralune_lyrics_romaji_mode');
      if (saved === 'original' || saved === 'romaji' || saved === 'dual') return saved;
    } catch {}
    return 'dual';
  });
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
  const loadLyrics = useCallback(async () => {
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
  }, [trackTitle, trackArtist, trackAlbum, trackPath, durationSec]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadLyrics();
      }
    });
    return () => {
      active = false;
    };
  }, [loadLyrics]);

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
    const container = scrollContainerRef.current;
    const line = activeLineRef.current;
    if (autoScroll && container && line) {
      // Scroll only the lyrics container (scrollIntoView would also shift
      // overflow:hidden ancestors, e.g. the fullscreen player root).
      const cRect = container.getBoundingClientRect();
      const lRect = line.getBoundingClientRect();
      const delta = lRect.top - cRect.top - (cRect.height - lRect.height) / 2;
      container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
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
    } catch (err: unknown) {
      alert(`${loc.lyricsView.errorPrefix}: ${err}`);
    }
  };

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 max-w-full transform-gpu flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel will-change-transform"
    >
      {/* Nagłówek okna tekstów */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-line bg-black/35 px-5 py-3.5">
        <div className="flex min-w-0 grow basis-45 items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-135 from-accent-purple to-accent-pink text-on-accent"
          >
            <Mic2 size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-md font-bold text-fg">
              {trackTitle || loc.lyricsView.title}
            </div>
            <div className="truncate text-ui text-fg-secondary">
              {trackArtist}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {lyrics && (
            <span
              className={cn(
                'border',
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
                lyrics.is_synced ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-white/8 text-fg-secondary',
                lyrics.is_synced ? 'border-accent-cyan/30' : 'border-line',
              )}
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
            className={cn(
              'border',
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-200',
              isSyncMode ? 'bg-accent-pink/25 text-accent-pink' : 'bg-white/6 text-fg-secondary',
              isSyncMode ? 'border-accent-pink' : 'border-line',
            )}
          >
            <Clock size={13} />
            {isSyncMode ? loc.lyricsView.syncToggleClose : loc.lyricsView.syncToggleOpen}
          </button>

          {lyrics?.is_synced && (
            <button
              onClick={handleToggleAutoScroll}
              title={autoScroll ? loc.lyricsView.autoScrollOn : loc.lyricsView.autoScrollOff}
              className={cn(
                'border',
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
                autoScroll ? 'bg-accent-purple/20 text-accent-purple' : 'bg-transparent text-fg-muted',
                autoScroll ? 'border-line-accent' : 'border-line',
              )}
            >
              {autoScroll ? <Lock size={13} /> : <Unlock size={13} />}
              {loc.lyricsView.autoScroll}
            </button>
          )}

          {/* Przełącznik transliteracji Romaji (Kana / Romaji / Dwuwiersz Karaoke) */}
          <button
            onClick={() => {
              const next = romajiMode === 'original' ? 'dual' : romajiMode === 'dual' ? 'romaji' : 'original';
              setRomajiMode(next);
              try {
                localStorage.setItem('auralune_lyrics_romaji_mode', next);
              } catch {}
            }}
            title={`${loc.lyricsView.romajiModeTooltip}: ${
              romajiMode === 'original'
                ? loc.lyricsView.romajiModeKana
                : romajiMode === 'romaji'
                ? loc.lyricsView.romajiModeRomaji
                : loc.lyricsView.romajiModeDual
            }`}
            className={cn(
              'border',
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-200',
              romajiMode !== 'original' ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-white/6 text-fg-secondary',
              romajiMode !== 'original' ? 'border-accent-cyan' : 'border-line',
            )}
          >
            <Languages size={13} />
            {romajiMode === 'original' ? 'あ Kana' : romajiMode === 'romaji' ? 'A Romaji' : 'あ/A Dual'}
          </button>

          <button
            onClick={loadLyrics}
            title={loc.lyricsView.refreshTooltip}
            className="rounded-lg border border-line bg-transparent p-1.5 text-fg-secondary"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onClose}
            title={loc.lyricsView.closeTooltip}
            className="rounded-lg border border-line bg-transparent p-1.5 text-fg-secondary"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* PASEK NARZĘDZI SYNCHRONIZACJI (Offset & Auto-Sync & Save) */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-black/20 px-4.5 py-2 text-xs"
      >
        {/* Korekta przesunięcia (Offset) */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-fg-muted">{loc.lyricsView.compensation}:</span>
          <button
            onClick={() => setOffsetMs((prev) => prev - 500)}
            className="rounded-md border border-line bg-white/6 px-2 py-1 text-fg"
          >
            -500ms
          </button>
          <button
            onClick={() => setOffsetMs((prev) => prev - 100)}
            className="rounded-md border border-line bg-white/6 px-2 py-1 text-fg"
          >
            -100ms
          </button>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 font-mono font-bold',
              offsetMs !== 0 ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-white/4 text-fg-secondary',
            )}
          >
            {offsetMs > 0 ? `+${offsetMs}ms` : `${offsetMs}ms`}
          </span>
          <button
            onClick={() => setOffsetMs((prev) => prev + 100)}
            className="rounded-md border border-line bg-white/6 px-2 py-1 text-fg"
          >
            +100ms
          </button>
          <button
            onClick={() => setOffsetMs((prev) => prev + 500)}
            className="rounded-md border border-line bg-white/6 px-2 py-1 text-fg"
          >
            +500ms
          </button>
          {offsetMs !== 0 && (
            <button
              onClick={() => setOffsetMs(0)}
              className="rounded-md border border-accent-pink/30 bg-accent-pink/15 px-2 py-1 text-accent-pink"
            >
              {loc.lyricsView.resetOffset}
            </button>
          )}
        </div>

        {/* Akcje Auto-Sync i Zapis pliku */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDistribute}
            title={loc.lyricsView.autoDistribute}
            className="flex items-center gap-1 rounded-md border border-accent-purple/35 bg-accent-purple/15 px-2.5 py-1 font-semibold text-accent-purple"
          >
            <Wand2 size={13} /> {loc.lyricsView.autoDistribute}
          </button>

          {trackPath && (
            <button
              onClick={handleSaveLrc}
              title={loc.lyricsView.saveLrc}
              className="flex items-center gap-1 rounded-md border border-accent-green/35 bg-accent-green/15 px-2.5 py-1 font-semibold text-accent-green"
            >
              <Save size={13} /> {loc.lyricsView.saveLrc}
            </button>
          )}
        </div>
      </div>

      {/* Komunikat o sukcesie zapisu */}
      {saveSuccessMsg && (
        <div
          className="flex items-center gap-1.5 border-b border-accent-green/35 bg-accent-green/20 px-4 py-1.5 text-ui text-accent-green"
        >
          <Check size={14} /> {saveSuccessMsg}
        </div>
      )}

      {/* PANEL AKTYWNEJ MANUALNEJ SYNCHRONIZACJI */}
      {isSyncMode && lyrics && lyrics.lines && lyrics.lines.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 border-b border-accent-pink/25 bg-accent-pink/10 px-4.5 py-2.5"
        >
          <div className="flex-1 overflow-hidden">
            <span className="text-xs font-bold text-accent-pink uppercase">
              {loc.lyricsView.syncTargetLabel.replace('{i}', String(syncTargetIndex + 1)).replace('{n}', String(lyrics.lines.length))}:
            </span>
            <div className="truncate text-sm font-semibold text-fg">
              {lyrics.lines[syncTargetIndex]?.text || loc.lyricsView.endOfLyrics}
            </div>
          </div>

          <button
            onClick={() => handleSetLineTime(syncTargetIndex, currentPositionMs)}
            className="flex items-center gap-1.5 rounded-lg bg-accent-pink px-3.5 py-1.5 text-ui font-bold text-on-accent shadow-halo shadow-accent-pink/40"
          >
            <Clock size={14} /> {loc.lyricsView.clickAtTime}: {formatTimeLrc(currentPositionMs)}
          </button>
        </div>
      )}

      {/* Główny obszar wyświetlania tekstu */}
      <div
        ref={scrollContainerRef}
        className="flex min-h-0 min-w-0 flex-1 select-none flex-col items-center gap-4 overflow-y-auto overflow-x-hidden px-6 py-7.5 text-center wrap-anywhere"
      >
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3.5 text-fg-secondary">
            <div className="size-10 animate-spin rounded-full border-3 border-line border-t-accent-purple" />
            <span className="text-sm">{loc.lyricsView.searching}</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-fg-muted">
            <AlertCircle size={32} className="text-accent-pink" />
            <span className="text-sm">{loc.lyricsView.errorPrefix}: {error}</span>
            <button
              onClick={loadLyrics}
              className="mt-2.5 rounded-lg border border-line bg-white/8 px-4 py-2 text-fg"
            >
              {loc.lyricsView.retry}
            </button>
          </div>
        )}

        {!loading && !error && !lyrics && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-fg-muted">
            <Music size={32} opacity={0.5} />
            <span className="text-sm">{loc.lyricsView.noLyricsFound}</span>
            <div className="max-w-80 text-ui leading-normal">
              {loc.lyricsView.noLyricsHint.replace('{file}', trackTitle ? `${trackTitle}.lrc` : 'track.lrc')}
            </div>
          </div>
        )}

        {/* Tekst zsynchronizowany */}
        {!loading && lyrics?.is_synced && lyrics.lines && lyrics.lines.length > 0 && (
          <div className="flex w-full max-w-205 min-w-0 flex-col gap-3.5 pt-[15vh] pb-[25vh]">
            {lyrics.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              const isTarget = isSyncMode && idx === syncTargetIndex;

              return (
                <div
                  key={`${line.time_ms}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  className={cn(
                    'border-l-4',
                    'flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-2 leading-normal wrap-anywhere transition-all duration-200',
                    isActive ? 'text-2xl font-bold' : 'text-base font-medium',
                    isActive ? 'text-fg' : isPast ? 'text-fg-secondary' : 'text-fg-muted',
                    isActive ? 'opacity-100' : isPast ? 'opacity-65' : 'opacity-45',
                    isTarget ? 'bg-accent-pink/20' : isActive ? 'bg-accent-purple/10' : 'bg-transparent',
                    isActive ? 'border-accent-cyan' : isTarget ? 'border-accent-pink' : 'border-transparent',
                    isActive && 'scale-104 text-shadow-glow',
                  )}
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
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-sm bg-white/6 px-1.5 py-0.5 font-mono text-xs text-fg-muted">
                        {formatTimeLrc(Math.max(0, line.time_ms + offsetMs))}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetLineTime(idx, currentPositionMs);
                        }}
                        title={loc.lyricsView.syncLineTooltip}
                        className="rounded-md border border-accent-pink/40 bg-accent-pink/25 px-2 py-1 text-xxs font-bold text-accent-pink"
                      >
                        ⏱ {loc.lyricsView.syncLineAction}
                      </button>
                    </div>
                  )}

                  {/* Treść wersu tekstu z opcjonalną transliteracją Romaji */}
                  {romajiMode === 'original' ? (
                    <span className="min-w-0 flex-1">{line.text}</span>
                  ) : romajiMode === 'romaji' ? (
                    <span className="min-w-0 flex-1">{toRomaji(line.text)}</span>
                  ) : (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                      <span>{line.text}</span>
                      {hasJapaneseCharacters(line.text) && (
                        <span
                          className={cn(
                            'text-[0.72em] font-medium tracking-wide italic transition-[color,opacity] duration-200',
                            isActive ? 'text-accent-cyan opacity-95' : 'text-fg-secondary opacity-65',
                          )}
                        >
                          {toRomaji(line.text)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tekst statyczny (plain) z opcją konwersji do zsynchronizowanego */}
        {!loading && !lyrics?.is_synced && lyrics?.plain_lyrics && (
          <div className="flex w-full max-w-170 min-w-0 flex-col gap-5 px-0 py-5">
            <div
              className="flex items-center justify-between rounded-xl border border-accent-purple/25 bg-accent-purple/10 px-4 py-3"
            >
              <div className="text-left text-ui text-fg-secondary">
                {loc.lyricsView.staticNotice}
              </div>
              <button
                onClick={handleAutoDistribute}
                className="flex items-center gap-1.5 rounded-lg bg-accent-purple px-3 py-1.5 text-ui font-semibold text-on-accent"
              >
                <Wand2 size={13} /> {loc.lyricsView.autoSyncAction}
              </button>
            </div>

            <div className="text-base leading-loose whitespace-pre-line wrap-anywhere text-fg opacity-90">
              {romajiMode === 'original'
                ? lyrics.plain_lyrics
                : romajiMode === 'romaji'
                ? toRomaji(lyrics.plain_lyrics)
                : lyrics.plain_lyrics
                    .split('\n')
                    .map((pl) => {
                      if (!hasJapaneseCharacters(pl)) return pl;
                      return `${pl}\n[${toRomaji(pl)}]`;
                    })
                    .join('\n')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

