import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlaybackQueue, QueueItem, QueueColumnConfig } from '../types/queue';
import { DEFAULT_QUEUE_COLUMNS } from '../types/queue';

const QUEUE_COLUMNS_STORAGE_KEY = 'auralune_queue_columns_v1';

export interface UsePlaybackQueueProps {
  onNotify?: (message: string, isError?: boolean) => void;
  onTrackSelected?: (track: { uri: string; trackId: number | null; title: string }) => void;
}

export function usePlaybackQueue({ onNotify, onTrackSelected }: UsePlaybackQueueProps = {}) {
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

  const refreshQueue = useCallback(async () => {
    try {
      const q = await invoke<PlaybackQueue>('get_queue');
      setQueue(q);
      return q;
    } catch (e: unknown) {
      console.warn('Błąd pobierania kolejki:', e);
      return null;
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
        notify(`Błąd odtwarzania kolejki: ${e}`, true);
        return null;
      }
    },
    [refreshQueue, onTrackSelected, notify]
  );

  const removeFromQueue = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        await invoke('remove_from_queue', { id });
        await refreshQueue();
        notify('Usunięto utwór z kolejki');
      } catch (err: unknown) {
        notify(`Błąd usuwania: ${err}`, true);
      }
    },
    [refreshQueue, notify]
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
        notify(`Błąd zmiany kolejności: ${err}`, true);
      }
    },
    [queue.items.length, refreshQueue, notify]
  );

  const clearQueue = useCallback(async () => {
    try {
      await invoke('clear_queue');
      await refreshQueue();
      notify('Wyczyszczono kolejkę');
    } catch (e: unknown) {
      notify(`Błąd czyszczenia kolejki: ${e}`, true);
    }
  }, [refreshQueue, notify]);

  const addToQueue = useCallback(
    async (item: QueueItem) => {
      try {
        await invoke('add_to_queue', { item });
        await refreshQueue();
        notify(`Dodano do kolejki: ${item.title}`);
      } catch (err: unknown) {
        notify(`Błąd dodawania do kolejki: ${err}`, true);
      }
    },
    [refreshQueue, notify]
  );

  const addNextToQueue = useCallback(
    async (item: QueueItem) => {
      try {
        await invoke('add_next_to_queue', { item });
        await refreshQueue();
        notify(`Ustawiono jako następny: ${item.title}`);
      } catch (err: unknown) {
        notify(`Błąd dodawania jako następny: ${err}`, true);
      }
    },
    [refreshQueue, notify]
  );

  const setEntireQueue = useCallback(
    async (items: QueueItem[], startIndex = 0) => {
      try {
        await invoke('set_queue', { items, startIndex });
        await refreshQueue();
      } catch (err: unknown) {
        notify(`Błąd ustawiania kolejki: ${err}`, true);
      }
    },
    [refreshQueue, notify]
  );

  const addUrisToQueue = useCallback(
    async (uris: string[]) => {
      if (uris.length === 0) return;
      try {
        await invoke('add_uris_to_queue', { uris });
        await refreshQueue();
        notify(`Dodano ${uris.length} utworów do kolejki`);
      } catch (err: unknown) {
        notify(`Błąd dodawania utworów: ${err}`, true);
      }
    },
    [refreshQueue, notify]
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
  };
}
