import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDspManager, getEqPresetDisplayName } from './useDspManager';
import type { PlaybackStatus } from '../types/playback';
import { getTranslations } from '../i18n';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('useDspManager', () => {
  const loc = getTranslations('en');
  let mockStatus: PlaybackStatus;
  let setStatus: ReturnType<typeof vi.fn>;
  let showMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

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
        description: 'RubberBand DSP',
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

    showMessage = vi.fn();

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_dsp_presets') return [];
      if (cmd === 'get_equalizer_presets') return [];
      return null;
    });
  });

  function setupHook() {
    return renderHook(() =>
      useDspManager({
        status: mockStatus,
        setStatus: setStatus as any,
        showMessage: showMessage as any,
        loc,
      })
    );
  }

  it('translates EQ preset display names properly', () => {
    expect(getEqPresetDisplayName('Flat', loc)).toBe(loc.dsp.presetFlat);
    expect(getEqPresetDisplayName('Bass Boost', loc)).toBe(loc.dsp.presetBassBoost);
    expect(getEqPresetDisplayName('Custom', loc)).toBe(loc.dsp.presetCustom);
    expect(getEqPresetDisplayName('Unknown')).toBe('Unknown');
  });

  it('initializes default DSP state properly', () => {
    const { result } = setupHook();
    expect(result.current.dspAutoStartup).toBe(false);
    expect(result.current.dspDefaultEngine).toBe('Bypass');
    expect(result.current.audioBufferMs).toBe(600);
    expect(result.current.dspBlockSize).toBe(2048);
    expect(result.current.activeDspVibe).toBeNull();
    expect(result.current.reverbEnabled).toBe(false);
  });

  it('handlePitchChange updates status and calls set_pitch', async () => {
    const { result } = setupHook();
    act(() => {
      result.current.handlePitchChange(2.5);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('set_pitch', { semitones: 2.5 });
  });

  it('handleTempoChange updates status and calls set_tempo', async () => {
    const { result } = setupHook();
    act(() => {
      result.current.handleTempoChange(1.2);
    });
    expect(setStatus).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('set_tempo', { tempoRatio: 1.2 });
  });

  it('handleResetDsp resets state to default', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'reset_dsp') {
        return { ...mockStatus, pitch_semitones: 0, tempo_ratio: 1, rate_ratio: 1 };
      }
      return null;
    });
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleResetDsp();
    });
    expect(mockInvoke).toHaveBeenCalledWith('reset_dsp');
    expect(setStatus).toHaveBeenCalled();
  });

  it('handleEngineChange switches DSP engine', async () => {
    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'set_dsp_engine') {
        return { ...mockStatus, engine: args.engine };
      }
      return null;
    });
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleEngineChange('SoundTouch');
    });
    expect(mockInvoke).toHaveBeenCalledWith('set_dsp_engine', { engine: 'SoundTouch' });
  });

  it('handleApplyDspVibe applies nightcore vibe', async () => {
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleApplyDspVibe('nightcore');
    });
    expect(result.current.activeDspVibe).toBe('nightcore');
    expect(mockInvoke).toHaveBeenCalledWith('set_rate', { rateRatio: 1.25 });
    expect(mockInvoke).toHaveBeenCalledWith('set_equalizer_enabled', { enabled: true });
  });

  it('handleUpdateReverb sets parameters and calls IPC', async () => {
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleUpdateReverb(true, 0.7, 0.4, 0.9, 0.3);
    });
    expect(result.current.reverbEnabled).toBe(true);
    expect(result.current.reverbRoomSize).toBe(0.7);
    expect(mockInvoke).toHaveBeenCalledWith('set_reverb_params', {
      enabled: true,
      roomSize: 0.7,
      damping: 0.4,
      width: 0.9,
      level: 0.3,
    });
  });
});
