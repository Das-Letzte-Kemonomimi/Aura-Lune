import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaybackQueue } from './usePlaybackQueue';
import { DEFAULT_QUEUE_COLUMNS } from '../types/queue';
import { invokeMock } from '../test/ipcMock';

// Domyślne odpowiedzi backendu dla testów kolejki.
beforeEach(() => {
  invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
    if (cmd === 'get_queue') {
      return {
        items: [
          {
            id: 'item-1',
            track_id: 1,
            uri: '/music/track1.flac',
            title: 'Track 1',
            artist: 'Artist 1',
            album: 'Album 1',
            duration_ms: 180000,
          },
          {
            id: 'item-2',
            track_id: 2,
            uri: '/music/track2.flac',
            title: 'Track 2',
            artist: 'Artist 2',
            album: 'Album 2',
            duration_ms: 210000,
          },
        ],
        current_index: 0,
        loop_mode: 'None',
        shuffle: false,
        shuffle_order: [0, 1],
        shuffle_cursor: 0,
      };
    }
    if (cmd === 'play_queue_index') {
      const { index } = (args as { index: number }) || { index: 0 };
      return {
        id: `item-${index + 1}`,
        track_id: index + 1,
        uri: `/music/track${index + 1}.flac`,
        title: `Track ${index + 1}`,
        artist: `Artist ${index + 1}`,
        album: `Album ${index + 1}`,
        duration_ms: 180000,
      };
    }
    return null;
  });
});


describe('usePlaybackQueue hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with default state and default columns', () => {
    const { result } = renderHook(() => usePlaybackQueue());

    expect(result.current.isQueueOpen).toBe(false);
    expect(result.current.queue.items).toEqual([]);
    expect(result.current.queueColumns).toEqual(DEFAULT_QUEUE_COLUMNS);
    expect(result.current.queueSearchQuery).toBe('');
  });

  it('refreshes queue and populates items from Tauri backend', async () => {
    const { result } = renderHook(() => usePlaybackQueue());

    await act(async () => {
      await result.current.refreshQueue();
    });

    expect(result.current.queue.items.length).toBe(2);
    expect(result.current.queue.items[0].title).toBe('Track 1');
    expect(result.current.queue.current_index).toBe(0);
  });

  it('toggles column visibility and persists change in localStorage', () => {
    const { result } = renderHook(() => usePlaybackQueue());

    expect(result.current.queueColumns.showPath).toBe(false);

    act(() => {
      result.current.toggleColumn('showPath');
    });

    expect(result.current.queueColumns.showPath).toBe(true);

    const stored = JSON.parse(localStorage.getItem('auralune_queue_columns_v1') || '{}');
    expect(stored.showPath).toBe(true);
  });

  it('notifies on track selected when playing queue index', async () => {
    const onTrackSelected = vi.fn();
    const { result } = renderHook(() => usePlaybackQueue({ onTrackSelected }));

    await act(async () => {
      await result.current.playQueueIndex(1);
    });

    expect(onTrackSelected).toHaveBeenCalledWith({
      uri: '/music/track2.flac',
      trackId: 2,
      title: 'Track 2',
    });
  });

  it('guards against negative index playback early', async () => {
    const onTrackSelected = vi.fn();
    const { result } = renderHook(() => usePlaybackQueue({ onTrackSelected }));

    let res: unknown;
    await act(async () => {
      res = await result.current.playQueueIndex(-1);
    });

    expect(res).toBeNull();
    expect(onTrackSelected).not.toHaveBeenCalled();
  });

  it('manages drag and drop state correctly', async () => {
    const { result } = renderHook(() => usePlaybackQueue());

    const dragEventStart = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleQueueDragStart(1, dragEventStart);
    });

    expect(result.current.draggedQueueIdx).toBe(1);
    expect(dragEventStart.dataTransfer.setData).toHaveBeenCalledWith('text/plain', '1');

    const dragEventOver = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: '' },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleQueueDragOver(0, dragEventOver);
    });

    expect(result.current.dragOverQueueIdx).toBe(0);

    const dragEventDrop = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.DragEvent;

    await act(async () => {
      await result.current.handleQueueDrop(0, dragEventDrop);
    });

    expect(result.current.draggedQueueIdx).toBeNull();
    expect(result.current.dragOverQueueIdx).toBeNull();
  });

  it('adds track to queue and dispatches notification', async () => {
    const onNotify = vi.fn();
    const { result } = renderHook(() =>
      usePlaybackQueue({
        onNotify,
        albums: [{ id: 10, title: 'Album X', album_artist: 'Artist X', year: 2024, cover_path: null }],
      })
    );

    const sampleTrack = {
      id: 5,
      path: '/path/song.mp3',
      title: 'Song Title',
      artist: 'Song Artist',
      album_artist: 'Song Artist',
      album_id: 10,
      disc_no: 1,
      track_no: 1,
      duration_ms: 150000,
      format: 'MP3',
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      file_size: 5000000,
      modified_time: 1700000000,
    };

    await act(async () => {
      await result.current.addTrackToQueue(sampleTrack);
    });

    expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('Song Title'), false);
  });
});

