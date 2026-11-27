import { useState, useCallback } from 'react';
import { invoke } from '../api/ipc';
import type { PlaybackQueue, QueueItem, QueueColumnConfig } from '../types/queue';
import { DEFAULT_QUEUE_COLUMNS } from '../types/queue';
import type { TrackRecord, AlbumRecord } from '../types/player';
import { getTranslations, type Translations } from '../i18n';
import { fmt } from '../utils/fmt';

const QUEUE_COLUMNS_STORAGE_KEY = 'auralune_queue_columns_v1';

export interface UsePlaybackQueueProps {
  onNotify?: (message: string, isError?: boolean) => void;
  onTrackSelected?: (track: { uri: string; trackId: number | null; title: string }) => void;
  albums?: AlbumRecord[];
  loc?: Translations;
  onPlaylistSaved?: () => Promise<unknown> | unknown;
}

export function usePlaybackQueue({
  onNotify,
  onTrackSelected,
  albums,
  loc,
  onPlaylistSaved,
}: UsePlaybackQueueProps = {}) {
  const t = loc ?? getTranslations();
  const [queue, setQueue] = useState<PlaybackQueue>({
    items: [],
    current_index: null,
    loop_mode: 'None',
    shuffle: false,
    shuffle_order: [],
    shuffle_cursor: 0,
  });

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [draggedQueueIdx, setDraggedQueueIdx] = useState<number | null>(null);
  const [dragOverQueueIdx, setDragOverQueueIdx] = useState<number | null>(null);

  const [queueColumns, setQueueColumns] = useState<QueueColumnConfig>(() => {
    try {
      const stored = localStorage.getItem(QUEUE_COLUMNS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_QUEUE_COLUMNS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback on corrupt JSON or blocked storage
    }
    return DEFAULT_QUEUE_COLUMNS;
  });

  const notify = useCallback(
    (msg: string, isError = false) => {
      if (onNotify) {
        onNotify(msg, isError);
      }
    },
    [onNotify]
  );

  const refreshQueue = useCallback(async (): Promise<void> => {
    try {
      const q = await invoke<PlaybackQueue>('get_queue');
      setQueue(q);
    } catch (e: unknown) {
      console.warn('Failed to fetch the queue:', e);
    }
  }, []);

  const playQueueIndex = useCallback(
    async (targetIndex: number, expectedItem?: QueueItem | null) => {
      if (targetIndex < 0) return null;
      try {
        setQueue((prev) => ({ ...prev, current_index: targetIndex }));
        const item = await invoke<QueueItem | null>('play_queue_index', {
          index: targetIndex,
          expectedId: expectedItem?.id ?? null,
        });
        await refreshQueue();
        if (item && onTrackSelected) {
          onTrackSelected({
            uri: item.uri,
            trackId: item.track_id,
            title: item.title,
          });
        }
        return item;
      } catch (e: unknown) {
        notify(fmt(t.notifications.queuePlayError, String(e)), true);
        return null;
      }
    },
    [refreshQueue, onTrackSelected, notify, t]
  );

  const removeFromQueue = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        await invoke('remove_from_queue', { id });
        await refreshQueue();
        notify(t.notifications.trackRemovedFromQueue);
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueRemoveError, String(err)), true);
      }
    },
    [refreshQueue, notify, t]
  );

  const moveQueueItem = useCallback(
    async (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      if (fromIdx < 0 || toIdx < 0) return;
      if (fromIdx >= queue.items.length || toIdx >= queue.items.length) return;

      try {
        await invoke('reorder_queue', { fromIdx, toIdx });
        await refreshQueue();
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueReorderError, String(err)), true);
      }
    },
    [queue.items.length, refreshQueue, notify, t]
  );

  const clearQueue = useCallback(async () => {
    try {
      await invoke('clear_queue');
      await refreshQueue();
      notify(t.notifications.queueCleared);
    } catch (e: unknown) {
      notify(fmt(t.notifications.queueClearError, String(e)), true);
    }
  }, [refreshQueue, notify, t]);

  const addToQueue = useCallback(
    async (item: QueueItem) => {
      try {
        await invoke('add_to_queue', { item });
        await refreshQueue();
        notify(
          fmt(t.notifications.addedToQueueEndMsg, item.title)
        );
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueAddError, String(err)), true);
      }
    },
    [refreshQueue, notify, t]
  );

  const addNextToQueue = useCallback(
    async (item: QueueItem) => {
      try {
        await invoke('add_next_to_queue', { item });
        await refreshQueue();
        notify(
          fmt(t.notifications.setAsNextTrack, item.title)
        );
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueAddNextError, String(err)), true);
      }
    },
    [refreshQueue, notify, t]
  );

  const setEntireQueue = useCallback(
    async (items: QueueItem[], startIndex = 0) => {
      try {
        await invoke('set_queue', { items, startIndex });
        await refreshQueue();
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueSetError, String(err)), true);
      }
    },
    [refreshQueue, notify, t]
  );

  const addUrisToQueue = useCallback(
    async (uris: string[]) => {
      if (uris.length === 0) return;
      try {
        await invoke('add_uris_to_queue', { uris });
        await refreshQueue();
        notify(
          fmt(t.notifications.loadedTracksToQueueMsg, String(uris.length))
        );
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueAddTracksError, String(err)), true);
      }
    },
    [refreshQueue, notify, t]
  );

  const toggleColumn = useCallback((key: keyof QueueColumnConfig) => {
    setQueueColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(QUEUE_COLUMNS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      return updated;
    });
  }, []);

  const resetQueueColumns = useCallback(() => {
    setQueueColumns(DEFAULT_QUEUE_COLUMNS);
    try {
      localStorage.setItem(QUEUE_COLUMNS_STORAGE_KEY, JSON.stringify(DEFAULT_QUEUE_COLUMNS));
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleQueueDragStart = useCallback((idx: number, e: React.DragEvent) => {
    setDraggedQueueIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${idx}`);
  }, []);

  const handleQueueDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverQueueIdx(idx);
  }, []);

  const handleQueueDrop = useCallback(
    async (toIdx: number, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const fromIdx = draggedQueueIdx;
      setDraggedQueueIdx(null);
      setDragOverQueueIdx(null);
      if (fromIdx !== null && fromIdx !== toIdx) {
        await moveQueueItem(fromIdx, toIdx);
      }
    },
    [draggedQueueIdx, moveQueueItem]
  );

  const addTrackToQueue = useCallback(
    async (track: TrackRecord, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const matchingAlb = track.album_id && albums ? albums.find((a) => a.id === track.album_id) : null;
      const item: QueueItem = {
        id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        track_id: track.id,
        uri: track.path,
        title: track.title,
        artist: track.artist,
        album: matchingAlb?.title || null,
        duration_ms: track.duration_ms,
      };
      try {
        await invoke('add_to_queue', { item });
        await refreshQueue();
        notify(
          fmt(t.notifications.addedToQueueEndMsg, track.title)
        );
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueAddError, String(err)), true);
      }
    },
    [albums, refreshQueue, notify, t]
  );

  const addTrackNextToQueue = useCallback(
    async (track: TrackRecord, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const matchingAlb = track.album_id && albums ? albums.find((a) => a.id === track.album_id) : null;
      const item: QueueItem = {
        id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        track_id: track.id,
        uri: track.path,
        title: track.title,
        artist: track.artist,
        album: matchingAlb?.title || null,
        duration_ms: track.duration_ms,
      };
      try {
        await invoke('add_next_to_queue', { item });
        await refreshQueue();
        notify(
          fmt(t.notifications.setAsNextMsg, track.title)
        );
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueAddNextError, String(err)), true);
      }
    },
    [albums, refreshQueue, notify, t]
  );

  const confirmSaveQueueAsPlaylist = useCallback(
    async (name: string) => {
      try {
        await invoke('save_queue_as_playlist', { name });
        if (onPlaylistSaved) {
          await onPlaylistSaved();
        }
        notify(
          fmt(t.queue.savedToPlaylist, name)
        );
      } catch (err: unknown) {
        notify(fmt(t.notifications.queueSavePlaylistError, String(err)), true);
      }
    },
    [onPlaylistSaved, notify, t]
  );

  return {
    queue,
    setQueue,
    isQueueOpen,
    setIsQueueOpen,
    queueSearchQuery,
    setQueueSearchQuery,
    queueColumns,
    setQueueColumns,
    draggedQueueIdx,
    setDraggedQueueIdx,
    dragOverQueueIdx,
    setDragOverQueueIdx,
    refreshQueue,
    playQueueIndex,
    removeFromQueue,
    moveQueueItem,
    clearQueue,
    addToQueue,
    addNextToQueue,
    setEntireQueue,
    addUrisToQueue,
    toggleColumn,
    resetQueueColumns,
    handleQueueDragStart,
    handleQueueDragOver,
    handleQueueDrop,
    addTrackToQueue,
    addTrackNextToQueue,
    confirmSaveQueueAsPlaylist,
  };
}
