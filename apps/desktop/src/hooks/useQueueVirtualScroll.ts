import { useMemo, useRef } from 'react';
import type { QueueItem } from '../types/queue';
import { useVirtualScroll } from './useVirtualScroll';

export interface UseQueueVirtualScrollOptions {
  items: QueueItem[];
  searchQuery: string;
  compactMode: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function formatTotalDuration(ms: number): string {
  if (!ms || ms <= 0) return '0 min';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours} godz. ${minutes} min`;
  }
  return `${minutes} min ${seconds} s`;
}

export function useQueueVirtualScroll({
  items,
  searchQuery,
  compactMode,
  containerRef,
}: UseQueueVirtualScrollOptions) {
  const queueListRef = useRef<HTMLDivElement | null>(null);

  const totalQueueDurationMs = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.duration_ms || 0), 0);
  }, [items]);

  const filteredQueueItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items.map((it, idx) => ({ it, originalIdx: idx }));
    }
    const q = searchQuery.toLowerCase();
    return items
      .map((it, idx) => ({ it, originalIdx: idx }))
      .filter(
        ({ it }) =>
          it.title.toLowerCase().includes(q) ||
          it.artist.toLowerCase().includes(q) ||
          (it.album ? it.album.toLowerCase().includes(q) : false) ||
          it.uri.toLowerCase().includes(q)
      );
  }, [items, searchQuery]);

  const {
    startIndex: queueStartIndex,
    endIndex: queueEndIndex,
    topSpacerHeight: queueTopSpacer,
    bottomSpacerHeight: queueBottomSpacer,
  } = useVirtualScroll({
    itemCount: filteredQueueItems.length,
    itemHeight: compactMode ? 54 : 72,
    containerRef,
    tableRef: queueListRef,
    overscan: 20,
  });

  return {
    queueListRef,
    totalQueueDurationMs,
    formatTotalDuration,
    filteredQueueItems,
    queueStartIndex,
    queueEndIndex,
    queueTopSpacer,
    queueBottomSpacer,
  };
}
