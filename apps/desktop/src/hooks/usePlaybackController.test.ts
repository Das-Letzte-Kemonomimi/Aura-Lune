import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePlaybackController } from './usePlaybackController';
import type { PlaybackStatus } from '../types/playback';
import type { PlaybackQueue } from '../types/queue';
import { getTranslations } from '../i18n';
import { invokeMock as mockInvoke } from '../test/ipcMock';


describe('usePlaybackController', () => {
  const loc = getTranslations('en');
  let mockStatus: PlaybackStatus;
  let setStatus: ReturnType<typeof vi.fn>;
  let setFilePath: ReturnType<typeof vi.fn>;
  let setActiveTrackId: ReturnType<typeof vi.fn>;
  let refreshQueue: ReturnType<typeof vi.fn>;
  let setTracks: ReturnType<typeof vi.fn>;
  let setReplaygainStatus: ReturnType<typeof vi.fn>;
  let showMessage: ReturnType<typeof vi.fn>;
  let initialStartupPositionRef: { current: number | null };

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
    vi.useFakeTimers();

    mockStatus = {
      state: 'Stopped',
      position_ms: 0,
      duration_ms: 200000,
      volume: 0.8,
      tempo_ratio: 1.0,
      pitch_semitones: 0.0,
      rate_ratio: 1.0,
      engine: 'RubberBand',
      capabilities: {
        engine: 'RubberBand',
        name: 'RubberBand',
        min_pitch_semitones: -12,
        max_pitch_semitones: 12,
        min_tempo_ratio: 0.5,
        max_tempo_ratio: 2.0,
        supports_formants: true,
        description: 'High quality DSP',
      },
      current_track: null,
      stop_after_current: false,
      equalizer_enabled: false,
      equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      parametric_eq_enabled: false,
      compressor_enabled: false,
      saturator_enabled: false,
      limiter_enabled: true,
      spectrum: Array(16).fill(0.05),
    };

    setStatus = vi.fn((updater) => {
      if (typeof updater === 'function') {
        mockStatus = updater(mockStatus);
      } else {
        mockStatus = updater;
      }
    });

    setFilePath = vi.fn();
    setActiveTrackId = vi.fn();
    refreshQueue = vi.fn(async () => {});
    setTracks = vi.fn();
    setReplaygainStatus = vi.fn();
    showMessage = vi.fn();
    initialStartupPositionRef = { current: null };

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_status') return mockStatus;
      if (cmd === 'get_bookmark') return null;
      if (cmd === 'get_track_bookmarks') return [];
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupHook(overrides: Partial<Parameters<typeof usePlaybackController>[0]> = {}) {
    return renderHook(() =>
      usePlaybackController({
        status: mockStatus,
        setStatus: setStatus as any,
        filePath: '/music/song.flac',
        setFilePath: setFilePath as any,
        activeTrackId: 10,
        setActiveTrackId: setActiveTrackId as any,
        queue: mockQueue,
        refreshQueue: refreshQueue as any,
        seekFadeEnabled: true,
        initialStartupPositionRef,
        tracks: [],
        setTracks: setTracks as any,
        albums: [],
        setReplaygainStatus: setReplaygainStatus as any,
        showMessage: showMessage as any,
        loc,
        ...overrides,
      })
    );
  }

  it('initializes loop points and bookmarks properly', () => {
    const { result } = setupHook();
    expect(result.current.loopPointA).toBeNull();
    expect(result.current.loopPointB).toBeNull();
    expect(result.current.isLoopEditorOpen).toBe(false);
    expect(result.current.currentBookmark).toBeNull();
    expect(result.current.currentTrackBookmarks).toEqual([]);
    expect(result.current.isBookmarksModalOpen).toBe(false);
  });

  it('handlePlayPause plays when Stopped and pauses when Playing', async () => {
    const { result } = setupHook();

    // 1. Play from stopped
    await act(async () => {
      await result.current.handlePlayPause();
    });
    expect(mockInvoke).toHaveBeenCalledWith('play');

    // 2. Pause when playing
    mockStatus.state = 'Playing';
    await act(async () => {
      await result.current.handlePlayPause();
    });
    expect(mockInvoke).toHaveBeenCalledWith('pause');
  });

  it('handleStop calls stop command', async () => {
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleStop();
    });
    expect(mockInvoke).toHaveBeenCalledWith('stop');
  });

  it('handleSeek updates status optimistically and calls seek with fade', async () => {
    const { result } = setupHook({ seekFadeEnabled: true });
    await act(async () => {
      await result.current.handleSeek(55000);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('seek', { positionMs: 55000, fade: true });
  });

  it('handleSeekPreview updates status optimistically without firing IPC seek', () => {
    const { result } = setupHook();
    act(() => {
      result.current.handleSeekPreview(12000);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('seek', expect.anything());
  });

  it('handleSeekCommit respects seekFadeEnabled by default on progress bar release', async () => {
    const { result } = setupHook({ seekFadeEnabled: true });
    await act(async () => {
      await result.current.handleSeekCommit(42000);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('seek', { positionMs: 42000, fade: true });
  });

  it('handleSeekCommit honors explicit fade override', async () => {
    const { result } = setupHook({ seekFadeEnabled: true });
    await act(async () => {
      await result.current.handleSeekCommit(42000, false);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('seek', { positionMs: 42000, fade: false });
  });

  it('handleVolumeChange clamps volume and sends set_volume', async () => {
    const { result } = setupHook();
    act(() => {
      result.current.handleVolumeChange(0.65);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.65 });
  });

  it('handleToggleMute mutes and restores last non-zero volume', async () => {
    const { result, rerender } = renderHook(
      (props: any) =>
        usePlaybackController({
          status: mockStatus,
          setStatus,
          filePath: '/music/song.flac',
          setFilePath,
          activeTrackId: 10,
          setActiveTrackId,
          queue: mockQueue,
          refreshQueue,
          seekFadeEnabled: true,
          initialStartupPositionRef,
          tracks: [],
          setTracks,
          albums: [],
          setReplaygainStatus,
          showMessage,
          loc,
          ...props,
        }),
      { initialProps: { status: { ...mockStatus, volume: 0.8 } } }
    );

    // Initially volume is 0.8 -> mutes to 0
    act(() => {
      result.current.handleToggleMute();
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0 });

    // Muted: rerender with volume 0 -> unmute restores 0.8
    rerender({ status: { ...mockStatus, volume: 0 } });
    act(() => {
      result.current.handleToggleMute();
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.8 });
  });

  it('handleVolumeChange in smooth fade mode sends smooth flag and fadeMs', async () => {
    const { result } = setupHook({ instantVolume: false });
    act(() => {
      result.current.handleVolumeChange(0.45);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.45, smooth: true, fadeMs: 60 });
  });

  it('handleToggleMute in smooth fade mode uses smooth transition', async () => {
    const { result } = setupHook({ instantVolume: false, status: { ...mockStatus, volume: 0.75 } });
    act(() => {
      result.current.handleToggleMute();
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0, smooth: true, fadeMs: 120 });
  });

  it('handleCycleLoopMode cycles through loop modes', async () => {
    const { result } = setupHook({ queue: { ...mockQueue, loop_mode: 'None' } });
    await act(async () => {
      await result.current.handleCycleLoopMode();
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_loop_mode', { mode: 'Queue' });
    expect(refreshQueue).toHaveBeenCalled();
  });

  it('handleToggleShuffle calls toggle_shuffle and refreshes queue', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'toggle_shuffle') return true;
      return null;
    });
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleToggleShuffle();
    });
    expect(mockInvoke).toHaveBeenCalledWith('toggle_shuffle');
    expect(refreshQueue).toHaveBeenCalled();
  });
});
