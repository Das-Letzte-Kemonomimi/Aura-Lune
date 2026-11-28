import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioMasteringEffects } from './useAudioMasteringEffects';
import type { PlaybackStatus } from '../types/player';
import { getTranslations } from '../i18n';
import { invokeMock } from '../test/ipcMock';


describe('useAudioMasteringEffects', () => {
  const loc = getTranslations('en');

  const baseStatus: PlaybackStatus = {
    state: 'Playing',
    position_ms: 1000,
    duration_ms: 60000,
    volume: 1.0,
    engine: 'RubberBand',
    capabilities: {
      engine: 'RubberBand',
      name: 'RubberBand',
      min_pitch_semitones: -12,
      max_pitch_semitones: 12,
      min_tempo_ratio: 0.5,
      max_tempo_ratio: 2.0,
      supports_formants: true,
      description: 'RubberBand DSP',
    },
    pitch_semitones: 0,
    tempo_ratio: 1.0,
    rate_ratio: 1.0,
    equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    equalizer_enabled: false,
  };

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
  });

  it('updates crossfade duration and persists setting', async () => {
    const { result } = renderHook(() =>
      useAudioMasteringEffects({
        status: baseStatus,
        setStatus: vi.fn(),
        showMessage: vi.fn(),
        loc,
      })
    );

    await act(async () => {
      await result.current.handleCrossfadeDurationChange(2500);
    });

    expect(result.current.crossfadeDuration).toBe(2500);
    expect(invokeMock).toHaveBeenCalledWith('set_crossfade_duration', { durationMs: 2500 });
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', {
      key: 'crossfade_duration',
      value: '2500',
    });
  });

  it('toggles limiter on and off', async () => {
    const showMessage = vi.fn();
    const { result } = renderHook(() =>
      useAudioMasteringEffects({
        status: baseStatus,
        setStatus: vi.fn(),
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handleToggleLimiter(false);
    });

    expect(result.current.limiterEnabled).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('set_limiter_enabled', { enabled: false });
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', {
      key: 'limiter_enabled',
      value: 'false',
    });
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.limiterOff);
  });

  it('applies bass boost through its own stage and never touches the EQ', async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useAudioMasteringEffects({
        status: { ...baseStatus, equalizer_bands: [1, -2, 3, 0, 0, 0, 0, 0, 0, 0] },
        setStatus,
        showMessage: vi.fn(),
        loc,
      })
    );

    await act(async () => {
      await result.current.handleBassBoostChange(4.0);
    });
    await act(async () => {
      await result.current.handleBassBoostChange(0);
    });

    expect(result.current.bassBoost).toBe(0);
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', { key: 'bass_boost', value: '4' });
    expect(invokeMock).toHaveBeenCalledWith('set_bass_boost', { boostDb: 4 });
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', { key: 'bass_boost', value: '0' });
    expect(invokeMock).toHaveBeenCalledWith('set_bass_boost', { boostDb: 0 });
    const touchedEq = invokeMock.mock.calls.some(([cmd]) => String(cmd).startsWith('set_equalizer'));
    expect(touchedEq).toBe(false);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('toggles stereo widener', async () => {
    const showMessage = vi.fn();
    const { result } = renderHook(() =>
      useAudioMasteringEffects({
        status: baseStatus,
        setStatus: vi.fn(),
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handleToggleStereoWidener(true);
    });

    expect(result.current.stereoWidenerActive).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('set_stereo_widener', {
      active: true,
      amount: 0.15,
    });
    expect(showMessage).toHaveBeenCalled();
  });
});
