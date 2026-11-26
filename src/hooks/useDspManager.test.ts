import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDspManager } from './useDspManager';
import type { PlaybackStatus } from '../types/playback';
import { getTranslations } from '../i18n';
import { invokeMock as mockInvoke } from '../test/ipcMock';
import { fmt } from '../utils/fmt';


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

  describe('graphic EQ presets are selected by id', () => {
    const bass = { id: 'bass-boost', name: 'Bass Boost', bands: [6, 5, 4, 2, 0.5, 0, 0, 0, 0, 0] };

    async function setupWithPresets() {
      mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'get_equalizer_presets' ? [bass] : null));
      const hook = setupHook();
      await waitFor(() => expect(hook.result.current.eqPresets).toHaveLength(1));
      return hook;
    }

    it('starts on the flat preset id', () => {
      const { result } = setupHook();
      expect(result.current.selectedEqPreset).toBe('flat');
    });

    it('applies a preset by id and announces its localised name', async () => {
      const { result } = await setupWithPresets();
      await act(async () => {
        await result.current.handleApplyEqPreset('bass-boost');
      });
      expect(result.current.selectedEqPreset).toBe('bass-boost');
      expect(mockInvoke).toHaveBeenCalledWith('set_equalizer_params', { enabled: true, bands: bass.bands });
      expect(showMessage).toHaveBeenCalledWith(fmt(loc.notifications.eqAppliedPreset, loc.dsp.eqPreset['bass-boost']));
    });

    it('ignores an id that is not in the list', async () => {
      const { result } = await setupWithPresets();
      await act(async () => {
        await result.current.handleApplyEqPreset('Bass Boost');
      });
      expect(result.current.selectedEqPreset).toBe('flat');
      expect(mockInvoke).not.toHaveBeenCalledWith('set_equalizer_params', expect.anything());
    });

    it('can apply flat before the preset list has loaded', async () => {
      const { result } = setupHook();
      await act(async () => {
        await result.current.handleApplyEqPreset('flat');
      });
      expect(mockInvoke).toHaveBeenCalledWith('set_equalizer_params', { enabled: true, bands: new Array(10).fill(0) });
    });

    it('marks the selection as custom after a band is dragged, and flat after a reset', async () => {
      const { result } = await setupWithPresets();
      await act(async () => {
        await result.current.handleApplyEqPreset('bass-boost');
      });
      await act(async () => {
        await result.current.handleEqBandChange(3, 2.5);
      });
      expect(result.current.selectedEqPreset).toBe('custom');
      await act(async () => {
        await result.current.handleResetEq();
      });
      expect(result.current.selectedEqPreset).toBe('flat');
    });
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
    expect(mockInvoke).toHaveBeenCalledWith('apply_dsp_profile', {
      engine: null,
      tempoRatio: 1.0,
      pitchSemitones: 0.0,
      rateRatio: 1.25,
      equalizerBands: [0, 0, 0, 0, 1.0, 1.5, 2.5, 3.0, 2.5, 2.0],
      equalizerEnabled: true,
    });
    // One IPC round trip for the whole profile.
    expect(mockInvoke.mock.calls.filter(([cmd]) => cmd === 'apply_dsp_profile')).toHaveLength(1);
    expect(mockInvoke).not.toHaveBeenCalledWith('set_rate', expect.anything());
  });

  it('handleApplyDspVibe toggles the active vibe off back to Bypass in one call', async () => {
    const { result } = setupHook();
    await act(async () => {
      await result.current.handleApplyDspVibe('slowed');
    });
    mockInvoke.mockClear();
    await act(async () => {
      await result.current.handleApplyDspVibe('slowed');
    });
    expect(result.current.activeDspVibe).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('apply_dsp_profile', {
      engine: 'Bypass',
      tempoRatio: 1.0,
      pitchSemitones: 0.0,
      rateRatio: 1.0,
      equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      equalizerEnabled: false,
    });
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
