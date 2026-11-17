import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayer } from './useAudioPlayer';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, _args?: unknown) => {
    if (cmd === 'get_playback_status') {
      return {
        ...DEFAULT_PLAYBACK_STATUS,
        state: 'Playing',
        position_ms: 50000,
        duration_ms: 200000,
      };
    }
    if (cmd === 'list_devices') {
      return [
        {
          index: 0,
          name: 'hw:0,0',
          description: 'Built-in Audio',
          is_default: true,
          active_profile: 'stereo',
          available_profiles: [],
        },
      ];
    }
    return null;
  }),
}));

describe('useAudioPlayer hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default status and progress metrics', () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(result.current.status.state).toBe('Stopped');
    expect(result.current.status.volume).toBe(1.0);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.seekProgressPercent).toBe(0);
    expect(result.current.volumeProgressPercent).toBe(100);
  });

  it('calculates progress percentage accurately when duration is known', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.pollStatus();
    });

    expect(result.current.status.state).toBe('Playing');
    expect(result.current.status.position_ms).toBe(50000);
    expect(result.current.status.duration_ms).toBe(200000);
    // 50000 / 200000 * 100 = 25%
    expect(result.current.seekProgressPercent).toBe(25);
  });

  it('clamps volume changes between 0.0 and 2.0', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.setVolume(2.5);
    });
    expect(result.current.status.volume).toBe(2.0);

    await act(async () => {
      await result.current.setVolume(-0.5);
    });
    expect(result.current.status.volume).toBe(0.0);
    expect(result.current.isMuted).toBe(true);
  });

  it('toggles mute and restores previous non-zero volume', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.setVolume(0.75);
    });
    expect(result.current.isMuted).toBe(false);

    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(true);
    expect(result.current.status.volume).toBe(0.0);

    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(false);
    expect(result.current.status.volume).toBe(0.75);
  });

  it('clamps DSP pitch semitones to safe limits [-24, 24]', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.setPitch(30);
    });
    expect(result.current.status.pitch_semitones).toBe(24);

    await act(async () => {
      await result.current.setPitch(-30);
    });
    expect(result.current.status.pitch_semitones).toBe(-24);
  });
});
