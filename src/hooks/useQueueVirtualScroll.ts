import { useCallback, useMemo, useRef } from 'react';
import type { QueueItem } from '../types/queue';
import { useVirtualScroll } from './useVirtualScroll';
import { getTranslations, type Translations } from '../i18n';
import { fmt } from '../utils/fmt';

export interface UseQueueVirtualScrollOptions {
  items: QueueItem[];
  searchQuery: string;
  compactMode: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  loc?: Translations;
}

export function formatTotalDuration(ms: number, t: Translations = getTranslations()): string {
  if (!ms || ms <= 0) return fmt(t.common.durationMinutes, '0');
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return fmt(t.common.durationHoursMinutes, String(hours), String(minutes));
  }
  return fmt(t.common.durationMinutesSeconds, String(minutes), String(seconds));
}

export function useQueueVirtualScroll({
  items,
  searchQuery,
  compactMode,
  containerRef,
  loc,
}: UseQueueVirtualScrollOptions) {
  const formatDuration = useCallback((ms: number) => formatTotalDuration(ms, loc), [loc]);
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
    formatTotalDuration: formatDuration,
    filteredQueueItems,
    queueStartIndex,
    queueEndIndex,
    queueTopSpacer,
    queueBottomSpacer,
  };
}
