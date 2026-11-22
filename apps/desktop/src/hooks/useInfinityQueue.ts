import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '../api/ipc';
import { evaluateHarmonicMatch } from '../utils/harmonicMixing';
import type { PlaybackStatus } from '../types/playback';
import type { PlaybackQueue } from '../types/queue';
import type { TrackRecord, AlbumRecord } from '../types/library';
import type { Translations } from '../i18n';

export interface UseInfinityQueueOptions {
  status: PlaybackStatus;
  queue: PlaybackQueue;
  currentPlayingTrack: TrackRecord | null;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  refreshQueue: () => Promise<void>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useInfinityQueue({
  status,
  queue,
  currentPlayingTrack,
  tracks,
  albums,
  refreshQueue,
  showMessage,
  loc,
}: UseInfinityQueueOptions) {
  const [infinityQueue, setInfinityQueue] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_infinity_queue') === 'true';
    } catch {
      return false;
    }
  });

  const autoDjBusyRef = useRef<boolean>(false);
  const lastAutoDjTrackIdRef = useRef<number | null>(null);

  const handleToggleInfinityQueue = useCallback(() => {
    setInfinityQueue((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('auralune_infinity_queue', next ? 'true' : 'false');
      } catch {
        // ignore
      }
      showMessage(
        next
          ? loc.notifications.infinityQueueActive
          : loc.notifications.infinityQueueDisabled
      );
      return next;
    });
  }, [loc.notifications.infinityQueueActive, loc.notifications.infinityQueueDisabled, showMessage]);

  // Smart Auto-DJ / Infinity Queue: automatic Camelot harmonic match selection
  useEffect(() => {
    if (!infinityQueue) return;
    if (status.state !== 'Playing') return;
    if (autoDjBusyRef.current) return;
    if (!tracks || tracks.length === 0) return;

    const remainingItems = queue.items.length - (queue.current_index ?? 0);
    if (remainingItems > 1) return;

    const activeIdx = queue.current_index ?? 0;
    const currentQItem = queue.items[activeIdx];
    const currentTrack = currentPlayingTrack || (currentQItem ? tracks.find((t) => t.id === currentQItem.track_id) : null);
    if (!currentTrack) return;
    if (lastAutoDjTrackIdRef.current === currentTrack.id) return;

    autoDjBusyRef.current = true;
    lastAutoDjTrackIdRef.current = currentTrack.id;

    // Filter out tracks already in queue
    const queuedIds = new Set(queue.items.map((i) => i.track_id).filter(Boolean));
    queuedIds.add(currentTrack.id);

    const candidates = tracks.filter((t) => !queuedIds.has(t.id));
    const pool = candidates.length > 0 ? candidates : tracks.filter((t) => t.id !== currentTrack.id);

    if (pool.length === 0) {
      autoDjBusyRef.current = false;
      return;
    }

    let bestTrack = pool[0];
    let bestScore = -1;
    let bestBadge = '';

    if (currentTrack.initial_key) {
      for (const cand of pool) {
        if (cand.initial_key) {
          const match = evaluateHarmonicMatch(
            currentTrack.initial_key,
            currentTrack.bpm,
            cand.initial_key,
            cand.bpm
          );
          if (match.score > bestScore) {
            bestScore = match.score;
            bestTrack = cand;
            bestBadge = `${match.badgeLabel} (${match.score}%)`;
          }
        }
      }
    }

    // Fallback if no high harmonic score
    if (bestScore < 60) {
      const randIdx = Math.floor(Math.random() * pool.length);
      bestTrack = pool[randIdx];
      bestBadge = 'Smart Shuffle';
    }

    const payload = {
      id: `infinity-${bestTrack.id}-${Date.now()}`,
      track_id: bestTrack.id,
      uri: bestTrack.path,
      title: bestTrack.title,
      artist: bestTrack.artist,
      album: bestTrack.album_id ? (albums.find((a) => a.id === bestTrack.album_id)?.title || null) : null,
      duration_ms: bestTrack.duration_ms,
    };

    invoke('add_to_queue', { item: payload })
      .then(async () => {
        await refreshQueue();
        showMessage(
          loc.notifications.infinityQueuePicked
            .replace('{0}', bestTrack.title)
            .replace('{1}', bestBadge)
        );
      })
      .catch((err) => {
        console.error('Auto-DJ add_to_queue error:', err);
      })
      .finally(() => {
        setTimeout(() => {
          autoDjBusyRef.current = false;
        }, 3500);
      });
  }, [
    albums,
    currentPlayingTrack,
    infinityQueue,
    loc.notifications.infinityQueuePicked,
    queue.current_index,
    queue.items,
    refreshQueue,
    showMessage,
    status.state,
    tracks,
  ]);

  return {
    infinityQueue,
    setInfinityQueue,
    handleToggleInfinityQueue,
  };
}
