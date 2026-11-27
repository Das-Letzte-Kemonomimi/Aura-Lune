import { useSyncExternalStore } from 'react';

export interface LyricLineDto {
  time_ms: number;
  text: string;
}

export interface LyricsDto {
  is_synced: boolean;
  lines: LyricLineDto[];
  plain_lyrics: string | null;
  source: string; // "local_lrc" | "lrclib" | "auto_distributed"
}

export interface TrackLyricsEntry {
  lyrics: LyricsDto | null;
  previousLyrics: LyricsDto | null;
  offsetMs: number;
  loading: boolean;
  error: string | null;
  fetched: boolean;
}

const EMPTY_ENTRY: TrackLyricsEntry = {
  lyrics: null,
  previousLyrics: null,
  offsetMs: 0,
  loading: false,
  error: null,
  fetched: false,
};

const MAX_CACHED_TRACKS = 20;
const entries = new Map<string, TrackLyricsEntry>();
const listeners = new Set<() => void>();
const inFlight = new Map<string, number>();
let requestSeq = 0;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getEntry(trackKey: string): TrackLyricsEntry {
  if (!trackKey) return EMPTY_ENTRY;
  return entries.get(trackKey) ?? EMPTY_ENTRY;
}

function setEntry(trackKey: string, next: TrackLyricsEntry): void {
  if (!trackKey) return;
  if (!entries.has(trackKey) && entries.size >= MAX_CACHED_TRACKS) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey !== undefined) {
      entries.delete(oldestKey);
    }
  }
  entries.set(trackKey, next);
  emit();
}

export function buildLyricsTrackKey(params: {
  trackPath?: string | null;
  trackTitle: string;
  trackArtist: string;
  trackAlbum?: string | null;
}): string {
  if (params.trackPath) {
    return `path:${params.trackPath}`;
  }
  if (params.trackTitle) {
    return `meta:${params.trackArtist}\0${params.trackTitle}\0${params.trackAlbum ?? ''}`;
  }
  return '';
}

export function useTrackLyrics(trackKey: string): TrackLyricsEntry {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => getEntry(trackKey),
    () => getEntry(trackKey),
  );
}

export async function loadTrackLyrics(
  trackKey: string,
  fetcher: () => Promise<LyricsDto | null>,
  force = false,
): Promise<void> {
  if (!trackKey) return;
  const current = entries.get(trackKey);
  if (!force && current && (current.fetched || current.loading)) {
    return;
  }

  const seq = ++requestSeq;
  inFlight.set(trackKey, seq);

  setEntry(trackKey, {
    lyrics: force ? current?.lyrics ?? null : null,
    previousLyrics: null,
    offsetMs: 0,
    loading: true,
    error: null,
    fetched: false,
  });

  try {
    const data = await fetcher();
    if (inFlight.get(trackKey) !== seq) return;
    setEntry(trackKey, {
      lyrics: data,
      previousLyrics: null,
      offsetMs: 0,
      loading: false,
      error: null,
      fetched: true,
    });
  } catch (err: unknown) {
    if (inFlight.get(trackKey) !== seq) return;
    setEntry(trackKey, {
      lyrics: null,
      previousLyrics: null,
      offsetMs: 0,
      loading: false,
      error: String(err),
      fetched: true,
    });
  }
}

export function setTrackLyrics(
  trackKey: string,
  updater: (prev: LyricsDto | null) => LyricsDto | null,
): void {
  if (!trackKey) return;
  const current = getEntry(trackKey);
  setEntry(trackKey, {
    ...current,
    lyrics: updater(current.lyrics),
  });
}

export function setTrackOffsetMs(
  trackKey: string,
  updater: number | ((prev: number) => number),
): void {
  if (!trackKey) return;
  const current = getEntry(trackKey);
  const nextOffset = typeof updater === 'function' ? updater(current.offsetMs) : updater;
  if (nextOffset === current.offsetMs) return;
  setEntry(trackKey, {
    ...current,
    offsetMs: nextOffset,
  });
}

export function autoDistributeTrackLyrics(
  trackKey: string,
  durationSec?: number | null,
): boolean {
  if (!trackKey) return false;
  const current = getEntry(trackKey);
  const lyrics = current.lyrics;
  if (!lyrics) return false;

  const linesToProcess =
    lyrics.lines.length > 0
      ? lyrics.lines
      : (lyrics.plain_lyrics || '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .map((text) => ({ time_ms: 0, text }));

  if (linesToProcess.length === 0) return false;

  const totalDurMs = durationSec && durationSec > 10 ? durationSec * 1000 : 180000;
  const startDelayMs = 6000; // 6s intro
  const availableMs = Math.max(10000, totalDurMs - startDelayMs - 12000); // 12s outro
  const stepMs = availableMs / linesToProcess.length;

  const distributed = linesToProcess.map((line, idx) => ({
    time_ms: Math.round(startDelayMs + idx * stepMs),
    text: line.text,
  }));

  setEntry(trackKey, {
    ...current,
    previousLyrics: current.previousLyrics ?? lyrics,
    lyrics: {
      is_synced: true,
      lines: distributed,
      plain_lyrics: lyrics.plain_lyrics,
      source: 'auto_distributed',
    },
    offsetMs: 0,
  });
  return true;
}

export function revertAutoDistributeTrackLyrics(trackKey: string): boolean {
  if (!trackKey) return false;
  const current = getEntry(trackKey);
  if (!current.previousLyrics) return false;

  setEntry(trackKey, {
    ...current,
    lyrics: current.previousLyrics,
    previousLyrics: null,
    offsetMs: 0,
  });
  return true;
}

export function clearTrackPreviousLyrics(trackKey: string): void {
  if (!trackKey) return;
  const current = getEntry(trackKey);
  if (current.previousLyrics === null) return;
  setEntry(trackKey, {
    ...current,
    previousLyrics: null,
  });
}

export function resetLyricsStoreForTests(): void {
  entries.clear();
  inFlight.clear();
  requestSeq = 0;
  emit();
}
