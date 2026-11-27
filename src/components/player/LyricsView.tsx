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
  RotateCcw,
} from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { parseBoolean, usePersistedState } from '../../hooks/usePersistedState';
import { toRomaji, hasJapaneseCharacters } from '../../utils/romaji';
import {
  DEFAULT_ROMAJI_MODE,
  nextRomajiMode,
  parseRomajiMode,
  ROMAJI_MODE_STORAGE_KEY,
  type RomajiMode,
} from './lyricsModel';
import { cn } from '../../utils/cn';
import { useStableCallback } from '../../hooks/useStableCallback';
import { LyricLineRow } from './LyricLineRow';
import { useLivePositionMs } from '../../state/livePlayback';
import { Badge, Button, Chip, IconButton, Spinner } from '../ui';
import {
  autoDistributeTrackLyrics,
  buildLyricsTrackKey,
  clearTrackPreviousLyrics,
  loadTrackLyrics,
  revertAutoDistributeTrackLyrics,
  setTrackLyrics,
  setTrackOffsetMs,
  useTrackLyrics,
  type LyricLineDto,
  type LyricsDto,
} from './lyricsStore';

export type { LyricLineDto, LyricsDto };

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
  currentPositionMs: currentPositionMsProp,
  currentLang = 'en',
  onSeek,
  onClose,
}) => {
  // Live position/spectrum (livePlayback): this lyrics view renders, not PlayerView.
  const currentPositionMs = useLivePositionMs(currentPositionMsProp);
  const loc = getTranslations(currentLang);
  const trackKey = useMemo(
    () => buildLyricsTrackKey({ trackPath, trackTitle, trackArtist, trackAlbum }),
    [trackPath, trackTitle, trackArtist, trackAlbum],
  );
  const { lyrics, previousLyrics, offsetMs, loading, error } = useTrackLyrics(trackKey);
  // Both are shared with every other lyrics view on screen (player, BigScreen, desktop overlay).
  const [romajiMode, setRomajiMode] = usePersistedState<RomajiMode>(ROMAJI_MODE_STORAGE_KEY, DEFAULT_ROMAJI_MODE, {
    parse: parseRomajiMode,
  });
  const [autoScroll, setAutoScroll] = usePersistedState('auralune_lyrics_autoscroll', true, { parse: parseBoolean });

  const handleToggleAutoScroll = () => setAutoScroll(!autoScroll);
  const [isSyncMode, setIsSyncMode] = useState<boolean>(false);
  const [syncTargetIndex, setSyncTargetIndex] = useState<number>(0);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const fetchLyrics = useCallback(
    () =>
      invoke<LyricsDto | null>('get_lyrics', {
        trackPath: trackPath || null,
        title: trackTitle || 'Unknown',
        artist: trackArtist || 'Unknown',
        album: trackAlbum || null,
        durationSec: durationSec || null,
      }),
    [trackTitle, trackArtist, trackAlbum, trackPath, durationSec],
  );

  // Fetch the song lyrics (skips network/disk if already cached in the shared store for this track)
  const loadLyrics = useCallback(
    async (force = false) => {
      if (!trackKey) return;
      if (force) {
        setSaveSuccessMsg(null);
      }
      await loadTrackLyrics(trackKey, fetchLyrics, force);
    },
    [trackKey, fetchLyrics],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadLyrics(false);
      }
    });
    return () => {
      active = false;
    };
  }, [loadLyrics]);

  useEffect(() => {
    setSyncTargetIndex(0);
    setSaveSuccessMsg(null);
  }, [trackKey]);

  // Effective lines with the offset applied (offsetMs)
  const effectiveLines = useMemo(() => {
    if (!lyrics || !lyrics.lines) return [];
    return lyrics.lines.map((line) => ({
      ...line,
      effective_time_ms: Math.max(0, line.time_ms + offsetMs),
    }));
  }, [lyrics, offsetMs]);

  // Find the current line index
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

  // Autoscroll to the active line
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

  // Manual sync: set the time for a specific line
  const handleSetLineTime = (index: number, timeMs: number) => {
    if (!lyrics) return;
    const newLines = [...lyrics.lines];
    newLines[index] = { ...newLines[index], time_ms: Math.max(0, timeMs - offsetMs) };
    setTrackLyrics(trackKey, (prev) =>
      prev
        ? {
            ...prev,
            lines: newLines,
            is_synced: true,
          }
        : prev,
    );
    setSyncTargetIndex(Math.min(newLines.length - 1, index + 1));
  };

  // Stable handlers for the memoised line rows (they read the latest state when called).
  const handleLineClick = useStableCallback((idx: number) => {
    if (isSyncMode) {
      setSyncTargetIndex(idx);
      return;
    }
    const line = lyrics?.lines[idx];
    if (line) onSeek(Math.max(0, line.time_ms + offsetMs));
  });
  const handleSetLineTimeNow = useStableCallback((idx: number) => handleSetLineTime(idx, currentPositionMs));

  // Transliteration per line, computed once per lyrics/mode change instead of on every position tick.
  const romajiLines = useMemo(() => {
    if (romajiMode === 'original' || !lyrics?.lines) return null;
    return lyrics.lines.map((line) =>
      romajiMode === 'romaji' || hasJapaneseCharacters(line.text) ? toRomaji(line.text) : null,
    );
  }, [lyrics, romajiMode]);

  // Automatic line layout (Auto-Sync) along the track duration
  const handleAutoDistribute = () => {
    if (!autoDistributeTrackLyrics(trackKey, durationSec)) return;
    setSaveSuccessMsg(loc.lyricsView.autoDistributedSuccess);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Revert back to the lyrics state before Auto-Distribute was clicked
  const handleRevertAutoDistribute = () => {
    if (!revertAutoDistributeTrackLyrics(trackKey)) return;
    setSaveSuccessMsg(null);
  };

  // Format as standard LRC
  const formatTimeLrc = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}]`;
  };

  // Save to a local .lrc file
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

      setTrackLyrics(trackKey, (prev) =>
        prev
          ? {
              ...prev,
              lines: prev.lines.map((l) => ({ ...l, time_ms: Math.max(0, l.time_ms + offsetMs) })),
              source: 'local_lrc',
            }
          : prev,
      );
      clearTrackPreviousLyrics(trackKey);
      setTrackOffsetMs(trackKey, 0);
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
      {/* Lyrics window header */}
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
            <Badge tone={lyrics.is_synced ? 'cyan' : 'neutral'}>
              {lyrics.is_synced ? <Radio size={12} /> : <FileText size={12} />}
              {lyrics.source === 'local_lrc'
                ? loc.lyricsView.localLrcBadge
                : lyrics.source === 'auto_distributed'
                ? loc.lyricsView.autoSyncBadge
                : lyrics.is_synced
                ? loc.lyricsView.lrcLibBadge
                : loc.lyricsView.lrcLibPlainBadge}
            </Badge>
          )}

          {/* Edit/sync mode button */}
          <Chip pressed={isSyncMode} onClick={() => setIsSyncMode(!isSyncMode)} title={loc.lyricsView.syncModeTitle}>
            <Clock size={13} />
            {isSyncMode ? loc.lyricsView.syncToggleClose : loc.lyricsView.syncToggleOpen}
          </Chip>

          {lyrics?.is_synced && (
            <Chip
              tone="purple"
              pressed={autoScroll}
              onClick={handleToggleAutoScroll}
              title={autoScroll ? loc.lyricsView.autoScrollOn : loc.lyricsView.autoScrollOff}
            >
              {autoScroll ? <Lock size={13} /> : <Unlock size={13} />}
              {loc.lyricsView.autoScroll}
            </Chip>
          )}

          {/* Romaji transliteration toggle (Kana / Romaji / two-line karaoke) */}
          <Chip
            tone="cyan"
            pressed={romajiMode !== 'original'}
            onClick={() => setRomajiMode(nextRomajiMode(romajiMode))}
            title={`${loc.lyricsView.romajiModeTooltip}: ${
              romajiMode === 'original'
                ? loc.lyricsView.romajiModeKana
                : romajiMode === 'romaji'
                ? loc.lyricsView.romajiModeRomaji
                : loc.lyricsView.romajiModeDual
            }`}
          >
            <Languages size={13} />
            {romajiMode === 'original' ? 'あ Kana' : romajiMode === 'romaji' ? 'A Romaji' : 'あ/A Dual'}
          </Chip>

          <IconButton variant="secondary" size="sm" label={loc.lyricsView.refreshTooltip} onClick={() => void loadLyrics(true)}>
            <RefreshCw size={14} className={cn(loading && 'motion-safe:animate-spin')} />
          </IconButton>
          <IconButton variant="secondary" size="sm" label={loc.lyricsView.closeTooltip} onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
      </div>

      {/* SYNC TOOLBAR (offset & Auto-Sync & save) */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-black/20 px-4.5 py-2 text-xs"
      >
        {/* Offset correction */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-fg-muted">{loc.lyricsView.compensation}</span>
          <Button size="sm" onClick={() => setTrackOffsetMs(trackKey, (prev) => prev - 500)} className="font-mono">
            -500ms
          </Button>
          <Button size="sm" onClick={() => setTrackOffsetMs(trackKey, (prev) => prev - 100)} className="font-mono">
            -100ms
          </Button>
          <Badge mono tone={offsetMs !== 0 ? 'cyan' : 'neutral'}>
            {offsetMs > 0 ? `+${offsetMs}ms` : `${offsetMs}ms`}
          </Badge>
          <Button size="sm" onClick={() => setTrackOffsetMs(trackKey, (prev) => prev + 100)} className="font-mono">
            +100ms
          </Button>
          <Button size="sm" onClick={() => setTrackOffsetMs(trackKey, (prev) => prev + 500)} className="font-mono">
            +500ms
          </Button>
          {offsetMs !== 0 && (
            <Button variant="tinted" tone="pink" size="sm" onClick={() => setTrackOffsetMs(trackKey, 0)}>
              {loc.lyricsView.resetOffset}
            </Button>
          )}
        </div>

        {/* Auto-Sync and save file actions */}
        <div className="flex items-center gap-2">
          {previousLyrics && (
            <Button variant="tinted" tone="pink" size="sm" onClick={handleRevertAutoDistribute}>
              <RotateCcw size={13} /> {loc.lyricsView.undoAutoDistribute}
            </Button>
          )}
          <Button variant="tinted" tone="purple" size="sm" onClick={handleAutoDistribute}>
            <Wand2 size={13} /> {loc.lyricsView.autoDistribute}
          </Button>

          {trackPath && (
            <Button variant="tinted" tone="green" size="sm" onClick={handleSaveLrc}>
              <Save size={13} /> {loc.lyricsView.saveLrc}
            </Button>
          )}
        </div>
      </div>

      {/* Save success message */}
      {saveSuccessMsg && (
        <div
          className="flex items-center gap-1.5 border-b border-accent-green/35 bg-accent-green/20 px-4 py-1.5 text-ui text-accent-green"
        >
          <Check size={14} /> {saveSuccessMsg}
        </div>
      )}

      {/* ACTIVE MANUAL SYNC PANEL */}
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

          <Button variant="primary" onClick={() => handleSetLineTime(syncTargetIndex, currentPositionMs)}>
            <Clock size={14} /> {loc.lyricsView.clickAtTime}: {formatTimeLrc(currentPositionMs)}
          </Button>
        </div>
      )}

      {/* Main lyrics display area */}
      <div
        ref={scrollContainerRef}
        className="flex min-h-0 min-w-0 flex-1 select-none flex-col items-center gap-4 overflow-y-auto overflow-x-hidden px-6 py-7.5 text-center wrap-anywhere"
      >
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3.5 text-fg-secondary">
            <Spinner size="lg" tone="purple" />
            <span className="text-sm">{loc.lyricsView.searching}</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-fg-muted">
            <AlertCircle size={32} className="text-accent-pink" />
            <span className="text-sm">{loc.lyricsView.errorPrefix}: {error}</span>
            <Button onClick={() => void loadLyrics(true)} className="mt-2.5">
              {loc.lyricsView.retry}
            </Button>
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

        {/* Synced lyrics */}
        {!loading && lyrics?.is_synced && lyrics.lines && lyrics.lines.length > 0 && (
          <div className="flex w-full max-w-205 min-w-0 flex-col gap-3.5 pt-[15vh] pb-[25vh]">
            {lyrics.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <LyricLineRow
                  key={`${line.time_ms}-${idx}`}
                  index={idx}
                  text={line.text}
                  romaji={romajiLines?.[idx] ?? null}
                  romajiMode={romajiMode}
                  isActive={isActive}
                  isPast={idx < activeIndex}
                  isTarget={isSyncMode && idx === syncTargetIndex}
                  isSyncMode={isSyncMode}
                  timeLabel={isSyncMode ? formatTimeLrc(Math.max(0, line.time_ms + offsetMs)) : ''}
                  syncActionLabel={loc.lyricsView.syncLineAction}
                  syncTooltip={loc.lyricsView.syncLineTooltip}
                  lineRef={isActive ? activeLineRef : undefined}
                  onLineClick={handleLineClick}
                  onSetLineTime={handleSetLineTimeNow}
                />
              );
            })}
          </div>
        )}

        {/* Static (plain) lyrics with an option to convert them to synced lyrics */}
        {!loading && !lyrics?.is_synced && lyrics?.plain_lyrics && (
          <div className="flex w-full max-w-170 min-w-0 flex-col gap-5 px-0 py-5">
            <div
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-accent-purple/25 bg-accent-purple/10 px-4 py-3"
            >
              <div className="text-left text-ui text-fg-secondary">
                {loc.lyricsView.staticNotice}
              </div>
              <Button variant="primary" onClick={handleAutoDistribute}>
                <Wand2 size={13} /> {loc.lyricsView.autoSyncAction}
              </Button>
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

