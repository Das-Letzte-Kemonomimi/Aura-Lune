import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfinityQueue } from './useInfinityQueue';
import { getTranslations } from '../i18n';
import type { PlaybackStatus } from '../types/playback';
import type { PlaybackQueue } from '../types/queue';


describe('useInfinityQueue hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();
  const refreshQueue = vi.fn().mockResolvedValue(undefined);

  const mockStatus: PlaybackStatus = {
    state: 'Stopped',
    position_ms: 0,
    duration_ms: 120000,
    volume: 1.0,
    pitch_semitones: 0,
    tempo_ratio: 1.0,
    rate_ratio: 1.0,
    engine: 'Bypass',
    capabilities: {
      engine: 'Bypass',
      name: 'Bypass',
      min_pitch_semitones: -12,
      max_pitch_semitones: 12,
      min_tempo_ratio: 0.5,
      max_tempo_ratio: 2.0,
      supports_formants: false,
      description: 'Bypass',
    },
  };

  const mockQueue: PlaybackQueue = {
    items: [],
    current_index: null,
    loop_mode: 'None',
    shuffle: false,
    shuffle_order: [],
    shuffle_cursor: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes infinityQueue state from default or localStorage', () => {
    const { result } = renderHook(() =>
      useInfinityQueue({
        status: mockStatus,
        queue: mockQueue,
        currentPlayingTrack: null,
        tracks: [],
        albums: [],
        refreshQueue,
        showMessage,
        loc,
      })
    );

    expect(result.current.infinityQueue).toBe(false);
  });

  it('toggles infinityQueue state and notifies user', () => {
    const { result } = renderHook(() =>
      useInfinityQueue({
        status: mockStatus,
        queue: mockQueue,
        currentPlayingTrack: null,
        tracks: [],
        albums: [],
        refreshQueue,
        showMessage,
        loc,
      })
    );

    act(() => {
      result.current.handleToggleInfinityQueue();
    });

    expect(result.current.infinityQueue).toBe(true);
    expect(localStorage.getItem('auralune_infinity_queue')).toBe('true');
    expect(showMessage).toHaveBeenCalled();
  });
});
