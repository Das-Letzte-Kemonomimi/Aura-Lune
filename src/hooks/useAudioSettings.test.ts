import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioSettings } from './useAudioSettings';
import { getTranslations } from '../i18n';
import type { AudioCard } from '../types/audioDevices';
import { invokeMock as mockInvoke } from '../test/ipcMock';


describe('useAudioSettings hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockResolvedValue(null);
  });

  it('pushes a saved 0 dB untagged preamp as 0, not the -6 dB default', () => {
    localStorage.setItem('auralune_replaygain_mode', 'Track');
    localStorage.setItem('auralune_replaygain_preamp', '2');
    localStorage.setItem('auralune_replaygain_fallback', '0');
    const { result } = renderHook(() => useAudioSettings({ showMessage, loc }));

    expect(result.current.replaygainFallbackGain).toBe(0);
    expect(mockInvoke).toHaveBeenCalledWith('set_replaygain_config', {
      config: expect.objectContaining({ mode: 'Track', pre_amp_db: 2, fallback_gain_db: 0 }),
    });
  });

  it('initializes with default audio settings and loads config on mount', () => {
    const { result } = renderHook(() =>
      useAudioSettings({ showMessage, loc })
    );

    expect(result.current.cards).toEqual([]);
    expect(result.current.replaygainMode).toBe('Off');
    expect(result.current.crossfeedEnabled).toBe(false);
    expect(result.current.crossfeedPreset).toBe('Default');
    expect(result.current.silenceTrimmingEnabled).toBe(false);
    expect(result.current.seekFadeEnabled).toBe(true);
    expect(result.current.eqAutoStartup).toBe(false);

    // Mount effect should push saved configs to backend
    expect(mockInvoke).toHaveBeenCalledWith(
      'set_replaygain_config',
      expect.objectContaining({
        config: expect.objectContaining({ mode: 'Off' }),
      })
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'set_crossfeed_config',
      expect.objectContaining({
        config: expect.objectContaining({ enabled: false }),
      })
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'set_silence_trimming_config',
      expect.objectContaining({
        config: expect.objectContaining({ enabled: false }),
      })
    );
  });

  it('refreshes audio devices and enables Pro Audio', async () => {
    const mockCards: AudioCard[] = [
      {
        index: 0,
        name: 'alsa_card.pci-0000_00_1f.3',
        description: 'Built-in Audio',
        is_bluetooth: false,
        active_profile: 'analog-stereo',
        profiles: [
          {
            name: 'pro-audio',
            description: 'Pro Audio',
            available: true,
            is_pro_audio: true,
            bluetooth_codec: null,
          },
        ],
      },
    ];

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_devices') return mockCards;
      return null;
    });

    const { result } = renderHook(() =>
      useAudioSettings({ showMessage, loc })
    );

    await act(async () => {
      await result.current.refreshDevices();
    });

    expect(result.current.cards).toEqual(mockCards);

    await act(async () => {
      await result.current.handleEnableProAudio('alsa_card.pci-0000_00_1f.3');
    });

    expect(mockInvoke).toHaveBeenCalledWith('enable_pro_audio', {
      cardName: 'alsa_card.pci-0000_00_1f.3',
    });
    expect(showMessage).toHaveBeenCalled();
  });

  it('updates Crossfeed preset and settings correctly', async () => {
    const { result } = renderHook(() =>
      useAudioSettings({ showMessage, loc })
    );

    await act(async () => {
      await result.current.handleSetCrossfeed(true, 'JanMeier');
    });

    expect(result.current.crossfeedEnabled).toBe(true);
    expect(result.current.crossfeedPreset).toBe('JanMeier');
    expect(result.current.crossfeedFcut).toBe(650);
    expect(result.current.crossfeedFeed).toBe(90);
    expect(mockInvoke).toHaveBeenCalledWith('set_crossfeed_config', {
      config: {
        enabled: true,
        preset: 'JanMeier',
        fcut_hz: 650,
        feed_tenth_db: 90,
      },
    });
  });

  it('toggles seek fade and notifies user', async () => {
    const { result } = renderHook(() =>
      useAudioSettings({ showMessage, loc })
    );

    expect(result.current.seekFadeEnabled).toBe(true);

    await act(async () => {
      await result.current.handleToggleSeekFade();
    });

    expect(result.current.seekFadeEnabled).toBe(false);
  });
});
