import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSleepTimer } from './useSleepTimer';
import type { PlaybackStatus } from '../types/playback';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';
import { getTranslations } from '../i18n';
import { invokeMock as mockInvoke } from '../test/ipcMock';
import { isVolumeOsdSilenced, resetVolumeOsdSilence } from '../state/volumeOsdSilence';


describe('useSleepTimer hook', () => {
  const loc = getTranslations('en');
  let statusRef: { current: PlaybackStatus };
  const showMessage = vi.fn() as ((msg: string) => void) & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetVolumeOsdSilence();

    statusRef = {
      current: {
        ...DEFAULT_PLAYBACK_STATUS,
        state: 'Playing',
        position_ms: 10000,
        duration_ms: 200000,
        volume: 0.8,
        tempo_ratio: 1.0,
        pitch_semitones: 0.0,
        rate_ratio: 1.0,
        current_track: {
          id: '1',
          track_id: 1,
          uri: 'file:///music/test.flac',
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          duration_ms: 200000,
        },
      },
    };

    mockInvoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with inactive timer state', () => {
    const { result } = renderHook(() =>
      useSleepTimer({
        statusRef,
        filePath: 'file:///music/test.flac',
        showMessage,
        loc,
      })
    );

    expect(result.current.sleepTimerRemainingSec).toBeNull();
    expect(result.current.sleepTimerTargetMode).toBeNull();
    expect(result.current.sleepTimerFadeOut).toBe(true);
    expect(result.current.isSleepTimerOpen).toBe(false);
  });

  it('sets timed sleep timer and formats duration notification', () => {
    const { result } = renderHook(() =>
      useSleepTimer({
        statusRef,
        filePath: 'file:///music/test.flac',
        showMessage,
        loc,
      })
    );

    act(() => {
      result.current.handleSetSleepTimer(5, true);
    });

    expect(result.current.sleepTimerTargetMode).toBe('time');
    expect(result.current.sleepTimerRemainingSec).toBe(300);
    expect(showMessage).toHaveBeenCalledWith(
      loc.notifications.sleepTimerSet.replace('{0}', '5')
    );
  });

  it('sets end_of_track sleep timer mode', () => {
    const { result } = renderHook(() =>
      useSleepTimer({
        statusRef,
        filePath: 'file:///music/test.flac',
        showMessage,
        loc,
      })
    );

    act(() => {
      result.current.handleSetSleepTimer('end_of_track', false);
    });

    expect(result.current.sleepTimerTargetMode).toBe('end_of_track');
    expect(result.current.sleepTimerRemainingSec).toBeNull();
    expect(result.current.sleepTimerFadeOut).toBe(false);
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.sleepTimerEndOfTrack);
  });

  it('cancels active timer and notifies user', () => {
    const { result } = renderHook(() =>
      useSleepTimer({
        statusRef,
        filePath: 'file:///music/test.flac',
        showMessage,
        loc,
      })
    );

    act(() => {
      result.current.handleSetSleepTimer(10, true);
    });
    expect(result.current.sleepTimerRemainingSec).toBe(600);

    act(() => {
      result.current.handleCancelSleepTimer();
    });

    expect(result.current.sleepTimerRemainingSec).toBeNull();
    expect(result.current.sleepTimerTargetMode).toBeNull();
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.sleepTimerCancelled);
  });

  it('executes countdown and applies volume fade-out before pausing at zero', async () => {
    const { result } = renderHook(() =>
      useSleepTimer({
        statusRef,
        filePath: 'file:///music/test.flac',
        showMessage,
        loc,
      })
    );

    act(() => {
      // Set to 32 seconds so fade starts in 2 seconds
      result.current.handleSetSleepTimer(32 / 60, true);
    });
    expect(result.current.sleepTimerRemainingSec).toBe(32);

    // Advance 2 seconds (now 30 seconds left)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.sleepTimerRemainingSec).toBe(30);

    // Advance 10 more seconds (20 seconds left) -> volume fade should be called
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.sleepTimerRemainingSec).toBe(20);
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', expect.objectContaining({
      volume: expect.any(Number),
    }));

    // Advance until countdown expires
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(mockInvoke).toHaveBeenCalledWith('pause');
    expect(result.current.sleepTimerRemainingSec).toBeNull();
    expect(result.current.sleepTimerTargetMode).toBeNull();
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.sleepTimerPaused);
  });

  it('fade steps and the final restore are announced as silent so the volume OSD stays hidden', () => {
    const { result } = renderHook(() =>
      useSleepTimer({ statusRef, filePath: 'file:///music/test.flac', showMessage, loc })
    );

    act(() => {
      result.current.handleSetSleepTimer(31 / 60, true);
    });
    // The fade starts once 30 s are left.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    // 16 s left: 0.8 * 16/30
    expect(mockInvoke).toHaveBeenLastCalledWith('set_volume', { volume: expect.closeTo(0.8 * 16 / 30, 5) });
    expect(isVolumeOsdSilenced(0.8 * 16 / 30)).toBe(true);
    // A user change to another gain is not silenced.
    expect(isVolumeOsdSilenced(0.7)).toBe(false);

    // Timer ends: pause, then the original volume comes back silently.
    act(() => {
      vi.advanceTimersByTime(16000);
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.8 });
    expect(isVolumeOsdSilenced(0.8)).toBe(true);
  });

  it('pauses playback when end_of_track threshold is reached in end_of_track mode', async () => {
    const { result } = renderHook(() =>
      useSleepTimer({
        statusRef,
        filePath: 'file:///music/test.flac',
        showMessage,
        loc,
      })
    );

    act(() => {
      result.current.handleSetSleepTimer('end_of_track', false);
    });
    expect(result.current.sleepTimerTargetMode).toBe('end_of_track');

    // Simulate track position nearing duration (within 800ms of end)
    statusRef.current = {
      ...statusRef.current,
      position_ms: 199500, // 200000 - 500ms
    };

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockInvoke).toHaveBeenCalledWith('pause');
    expect(result.current.sleepTimerTargetMode).toBeNull();
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.sleepTimerTrackEnded);
  });

  it('keeps counting down when the host re-renders with a new showMessage every 100 ms', () => {
    // Regression: during playback App renders ~10×/s, and `showMessage` was a new function
    // on every render. The 1 s interval was restarted before it could run.
    const { result, rerender } = renderHook(
      ({ notify }) =>
        useSleepTimer({
          statusRef,
          filePath: 'file:///music/test.flac',
          showMessage: notify,
          loc,
        }),
      { initialProps: { notify: vi.fn() as (msg: string) => void } }
    );

    act(() => {
      result.current.handleSetSleepTimer(3 / 60, false);
    });
    expect(result.current.sleepTimerRemainingSec).toBe(3);

    for (let i = 0; i < 25; i++) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender({ notify: vi.fn() as (msg: string) => void });
    }

    expect(result.current.sleepTimerRemainingSec).toBe(1);

    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      rerender({ notify: vi.fn() as (msg: string) => void });
    }

    expect(result.current.sleepTimerRemainingSec).toBeNull();
    const pauseCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'pause');
    expect(pauseCalls).toHaveLength(1);
  });
});
