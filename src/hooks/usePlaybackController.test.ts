import { useState, useEffect } from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePlaybackController } from './usePlaybackController';
import { livePlayback } from '../state/livePlayback';
import type { PlaybackStatus } from '../types/playback';
import type { PlaybackQueue } from '../types/queue';
import { getTranslations } from '../i18n';
import { invokeMock as mockInvoke } from '../test/ipcMock';

const eventHandlers = vi.hoisted(() => new Map<string, (e: { payload: unknown }) => void>());
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (e: { payload: unknown }) => void) => {
    eventHandlers.set(name, cb);
    return Promise.resolve(() => eventHandlers.delete(name));
  }),
}));

function emitStatus(status: PlaybackStatus) {
  eventHandlers.get('auralune://playback-status')?.({ payload: status });
}


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
    cleanup();
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
    const { result, rerender } = renderHook(
      (props: Partial<Parameters<typeof usePlaybackController>[0]>) =>
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
          ...props,
        }),
      { initialProps: { status: mockStatus } }
    );

    // 1. Play from stopped
    await act(async () => {
      await result.current.handlePlayPause();
    });
    expect(mockInvoke).toHaveBeenCalledWith('play');

    // 2. Pause when playing (committed via status prop)
    rerender({ status: { ...mockStatus, state: 'Playing' } });
    await act(async () => {
      await result.current.handlePlayPause();
    });
    expect(mockInvoke).toHaveBeenCalledWith('pause');
  });

  it('handlePlayPause seeks before play without reloading when resuming startup position', async () => {
    initialStartupPositionRef.current = 45_000;
    mockStatus.current_track = {
      id: 'track-1',
      uri: '/music/song.flac',
      track_id: 1,
      title: 'Song',
      artist: 'Artist',
      album: null,
      duration_ms: 200_000,
    };

    const { result } = setupHook();
    mockInvoke.mockClear();

    await act(async () => {
      await result.current.handlePlayPause();
      vi.advanceTimersByTime(500);
    });

    const calls = mockInvoke.mock.calls.map(([cmd, args]) => [cmd, args]);
    expect(calls).toEqual([
      ['seek', { positionMs: 45_000, fade: false }],
      ['play', undefined],
    ]);
    expect(initialStartupPositionRef.current).toBeNull();
  });

  it('handleSeekCommit clears pending startup resume position', async () => {
    initialStartupPositionRef.current = 45_000;
    const { result } = setupHook();

    await act(async () => {
      await result.current.handleSeekCommit(12_000);
    });

    expect(initialStartupPositionRef.current).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('seek', { positionMs: 12_000, fade: true });
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

  it('handleSeekPreview moves the live position without re-rendering App or firing IPC seek', () => {
    const { result } = setupHook();
    setStatus.mockClear();
    act(() => {
      result.current.handleSeekPreview(12000);
    });
    expect(livePlayback.getSnapshot()).toMatchObject({ ready: true, positionMs: 12000 });
    expect(setStatus).not.toHaveBeenCalled();
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

  it('handleVolumeChange updates livePlayback while dragging and commits to App when immediate', async () => {
    const { result } = setupHook();
    setStatus.mockClear();
    act(() => {
      result.current.handleVolumeChange(0.65);
    });
    expect(livePlayback.getSnapshot()).toMatchObject({ volumeReady: true, volume: 0.65 });
    expect(setStatus).not.toHaveBeenCalled();
    // Instant mode still ramps for a few ms in the engine, so a jump never clicks.
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.65, smooth: true, fadeMs: 15 });

    act(() => {
      result.current.handleVolumeChange(0.65, true);
    });
    expect(setStatus).toHaveBeenCalledTimes(1);
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
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0, smooth: true, fadeMs: 15 });

    // Muted: rerender with volume 0 -> unmute restores 0.8
    rerender({ status: { ...mockStatus, volume: 0 } });
    act(() => {
      result.current.handleToggleMute();
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.8, smooth: true, fadeMs: 15 });
  });

  it('handleVolumeChange in smooth fade mode sends smooth flag and fadeMs via livePlayback', async () => {
    const { result } = setupHook({ instantVolume: false });
    setStatus.mockClear();
    act(() => {
      result.current.handleVolumeChange(0.45);
    });
    expect(livePlayback.getSnapshot()).toMatchObject({ volumeReady: true, volume: 0.45 });
    expect(setStatus).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.45, smooth: true, fadeMs: 60 });
  });

  it('handleToggleMute in smooth fade mode uses smooth transition', async () => {
    const { result } = setupHook({ instantVolume: false, status: { ...mockStatus, volume: 0.75 } });
    act(() => {
      result.current.handleToggleMute();
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0, smooth: true, fadeMs: 120 });
  });

  it('saves the volume once, 750 ms after the last change', () => {
    const { result } = setupHook();
    const saves = () => mockInvoke.mock.calls.filter(([cmd]) => cmd === 'set_app_setting');

    act(() => {
      result.current.handleVolumeChange(0.3);
      vi.advanceTimersByTime(500);
      result.current.handleVolumeChange(0.4);
      vi.advanceTimersByTime(500);
      result.current.handleVolumeChange(0.5);
      vi.advanceTimersByTime(749);
    });
    expect(saves()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(saves()).toEqual([['set_app_setting', { key: 'playback_volume', value: '0.5' }]]);
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

  describe('status events from the backend ticker', () => {
    const playing = (position_ms: number, extra: Partial<PlaybackStatus> = {}): PlaybackStatus => ({
      ...mockStatus,
      state: 'Playing',
      position_ms,
      spectrum: [position_ms / 1000],
      ...extra,
    });

    it('publishes every frame to the live store but commits React state only on real changes', async () => {
      setupHook();
      await act(async () => {});
      act(() => emitStatus(playing(10_000)));
      setStatus.mockClear();

      act(() => {
        emitStatus(playing(10_100));
        emitStatus(playing(10_200));
        emitStatus(playing(10_300));
      });

      expect(livePlayback.getSnapshot()).toMatchObject({ ready: true, positionMs: 10_300 });
      expect(livePlayback.getSnapshot().spectrum).toEqual([10.3]);
      // The updater is called, but without structural changes it returns the previous object (no re-render).
      expect(mockStatus.position_ms).toBe(10_000);

      act(() => emitStatus(playing(10_300, { volume: 0.3 })));
      expect(mockStatus.volume).toBe(0.3);
      expect(mockStatus.position_ms).toBe(10_300);
    });

    it('keeps the dragged position while the user is seeking', async () => {
      const { result } = setupHook();
      await act(async () => {});
      act(() => {
        result.current.handleSeekPreview(50_000);
        emitStatus(playing(10_000));
      });
      expect(livePlayback.getSnapshot().positionMs).toBe(50_000);
    });

    it('jumps back to loop point A as soon as a frame passes loop point B', async () => {
      const { result } = setupHook();
      await act(async () => {});
      act(() => {
        result.current.setLoopPointA(5_000);
        result.current.setLoopPointB(8_000);
      });

      await act(async () => {
        emitStatus(playing(7_900));
        emitStatus(playing(8_000));
        emitStatus(playing(8_100));
      });

      const seeks = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'seek');
      expect(seeks).toHaveLength(1);
      expect(seeks[0][1]).toMatchObject({ positionMs: 5_000 });
    });

    it('two identical status events cause no second App state commit (including replaygain_status)', async () => {
      const settledStatus: PlaybackStatus = {
        ...mockStatus,
        state: 'Stopped',
        replaygain_status: [-3.5, 0.9, true],
      };
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_status') return settledStatus;
        if (cmd === 'get_bookmark') return null;
        if (cmd === 'get_track_bookmarks') return [];
        return null;
      });
      let commits = 0;
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        const [st, setSt] = useState<PlaybackStatus>(settledStatus);
        const [rg, setRg] = useState<[number, number, boolean]>([-3.5, 0.9, true]);
        useEffect(() => {
          commits++;
        });
        usePlaybackController({
          status: st,
          setStatus: setSt,
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
          setReplaygainStatus: setRg,
          showMessage: showMessage as any,
          loc,
        });
        return { st, rg };
      });
      await act(async () => {});

      const settledCommits = commits;
      act(() => emitStatus({ ...settledStatus, replaygain_status: [-3.5, 0.9, true] }));
      act(() => emitStatus({ ...settledStatus, replaygain_status: [-3.5, 0.9, true] }));
      expect(commits).toBe(settledCommits);

      // Genuine transition commits once; subsequent identical events cause zero additional commits
      const nextStatus: PlaybackStatus = {
        ...settledStatus,
        replaygain_status: [-1.2, 0.85, false],
      };
      act(() => emitStatus(nextStatus));
      expect(commits).toBe(settledCommits + 1);
      const commitsAfterTransition = commits;
      act(() => emitStatus({ ...nextStatus, replaygain_status: [-1.2, 0.85, false] }));
      const rendersAfterFirstDuplicate = renders;
      act(() => emitStatus({ ...nextStatus, replaygain_status: [-1.2, 0.85, false] }));
      expect(result.current.rg).toEqual([-1.2, 0.85, false]);
      expect(commits).toBe(commitsAfterTransition);
      expect(renders).toBe(rendersAfterFirstDuplicate);
    });

    it('does not commit repeatedly while stopped on a restored session tick', async () => {
      initialStartupPositionRef.current = 45_000;
      const restoredTrack = {
        id: 'restored-1',
        uri: '/music/song.flac',
        track_id: 10,
        title: 'Song',
        artist: 'Artist',
        album: null,
        duration_ms: 200_000,
      };
      let renders = 0;
      renderHook(() => {
        renders++;
        const [st, setSt] = useState<PlaybackStatus>({
          ...mockStatus,
          state: 'Stopped',
          position_ms: 45_000,
          current_track: restoredTrack,
        });
        const [, setRg] = useState<[number, number, boolean]>([0, 0, false]);
        return usePlaybackController({
          status: st,
          setStatus: setSt,
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
          setReplaygainStatus: setRg,
          showMessage: showMessage as any,
          loc,
        });
      });
      await act(async () => {});

      const stoppedTick: PlaybackStatus = {
        ...mockStatus,
        state: 'Stopped',
        position_ms: 0,
        current_track: null,
      };

      act(() => emitStatus(stoppedTick));
      const rendersAfterFirst = renders;

      act(() => emitStatus({ ...stoppedTick }));
      expect(renders).toBe(rendersAfterFirst);
    });
  });
});
