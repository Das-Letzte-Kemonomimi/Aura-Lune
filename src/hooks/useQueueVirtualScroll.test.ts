// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQueueVirtualScroll, formatTotalDuration } from './useQueueVirtualScroll';
import type { QueueItem } from '../types/queue';

describe('formatTotalDuration', () => {
  it('formats zero or negative duration correctly', () => {
    expect(formatTotalDuration(0)).toBe('0 min');
    expect(formatTotalDuration(-100)).toBe('0 min');
  });

  it('formats minutes and seconds', () => {
    expect(formatTotalDuration(65000)).toBe('1 min 5 s');
  });

  it('formats hours and minutes', () => {
    expect(formatTotalDuration(3665000)).toBe('1 h 1 min');
  });
});

describe('useQueueVirtualScroll', () => {
  const sampleItems: QueueItem[] = [
    {
      id: '1',
      track_id: 1,
      title: 'First Song',
      artist: 'Artist A',
      album: 'Album 1',
      uri: 'file:///path/song1.flac',
      duration_ms: 180000,
    },
    {
      id: '2',
      track_id: 2,
      title: 'Second Track',
      artist: 'Artist B',
      album: 'Album 2',
      uri: 'file:///path/song2.flac',
      duration_ms: 240000,
    },
  ];

  it('calculates total duration and returns all items when searchQuery is empty', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useQueueVirtualScroll({
        items: sampleItems,
        searchQuery: '',
        compactMode: false,
        containerRef,
      })
    );

    expect(result.current.totalQueueDurationMs).toBe(420000);
    expect(result.current.filteredQueueItems).toHaveLength(2);
    expect(result.current.filteredQueueItems[0].it.title).toBe('First Song');
    expect(result.current.queueStartIndex).toBe(0);
    expect(result.current.queueEndIndex).toBe(2);
  });

  it('filters items correctly by title, artist, or album', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useQueueVirtualScroll({
        items: sampleItems,
        searchQuery: 'track',
        compactMode: false,
        containerRef,
      })
    );

    expect(result.current.filteredQueueItems).toHaveLength(1);
    expect(result.current.filteredQueueItems[0].it.title).toBe('Second Track');
    expect(result.current.filteredQueueItems[0].originalIdx).toBe(1);
  });
});
