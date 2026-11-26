import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionManager } from './useSessionManager';
import { getTranslations } from '../i18n';
import type { PlaybackStatus } from '../types/playback';
import { invokeMock as mockInvoke } from '../test/ipcMock';


describe('useSessionManager hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();

  const mockStatus: PlaybackStatus = {
    state: 'Stopped',
    position_ms: 12000,
    duration_ms: 180000,
    volume: 0.8,
    pitch_semitones: 0,
    tempo_ratio: 1,
    rate_ratio: 1,
    engine: 'Bypass',
    capabilities: {
      engine: 'Bypass',
      name: 'Direct',
      min_pitch_semitones: -24,
      max_pitch_semitones: 24,
      min_tempo_ratio: 0.15,
      max_tempo_ratio: 4,
      supports_formants: false,
      description: 'Bit-perfect direct stream without DSP (zero CPU overhead)',
    },
    equalizer_enabled: false,
    equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    current_track: {
      id: 'track-1',
      uri: '/music/song.flac',
      track_id: 1,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration_ms: 180000,
    },
  };

  const setStatus = vi.fn();
  const setFilePath = vi.fn();
  const setActiveTrackId = vi.fn();
  const setVolumeUnit = vi.fn();
  const setNowPlayingVisualMode = vi.fn();
  const initialStartupPositionRef = { current: null as number | null };

  const defaultProps = {
    status: mockStatus,
    setStatus,
    filePath: '/music/song.flac',
    setFilePath,
    currentPlayingTrack: null,
    activeTrackId: 1,
    setActiveTrackId,
    volumeUnit: 'percent' as const,
    setVolumeUnit,
    nowPlayingVisualMode: 'turntable' as const,
    setNowPlayingVisualMode,
    currentAlbum: null,
    initialStartupPositionRef,
    showMessage,
    loc,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockResolvedValue(null);
    initialStartupPositionRef.current = null;
  });

  it('initializes restoreSessionOnStartup to true by default', () => {
    const { result } = renderHook(() => useSessionManager(defaultProps));
    expect(result.current.restoreSessionOnStartup).toBe(true);
  });

  it('toggles restoreSessionOnStartup and notifies user', async () => {
    const { result } = renderHook(() => useSessionManager(defaultProps));
    expect(result.current.restoreSessionOnStartup).toBe(true);

    await act(async () => {
      await result.current.handleToggleRestoreSessionOnStartup();
    });

    expect(result.current.restoreSessionOnStartup).toBe(false);
    expect(localStorage.getItem('auralune_restore_session_on_startup')).toBe('false');
    expect(mockInvoke).toHaveBeenCalledWith('set_app_setting', {
      key: 'restore_session_on_startup',
      value: 'false',
    });
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.restoreSessionMsgOff);
  });

  it('restores session state on mount when saved session exists', async () => {
    const savedSession = {
      volume_unit: 'db',
      track_id: 42,
      uri: '/music/restored.flac',
      title: 'Restored Song',
      artist: 'Restored Artist',
      album: 'Restored Album',
      position_ms: 45000,
      duration_ms: 200000,
      engine: 'SoundTouch',
      pitch_semitones: 2.0,
      tempo_ratio: 1.1,
      rate_ratio: 1.0,
      equalizer_enabled: true,
      equalizer_bands: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0],
      nowplaying_visual_mode: 'cover',
    };
    localStorage.setItem('auralune_playback_session', JSON.stringify(savedSession));

    renderHook(() => useSessionManager(defaultProps));

    expect(setStatus).toHaveBeenCalled();
    expect(setVolumeUnit).toHaveBeenCalledWith('db');
    expect(setNowPlayingVisualMode).toHaveBeenCalledWith('cover');
    expect(setActiveTrackId).toHaveBeenCalledWith(42);
    expect(setFilePath).toHaveBeenCalledWith('/music/restored.flac');
    expect(initialStartupPositionRef.current).toBe(45000);
    expect(mockInvoke).not.toHaveBeenCalledWith('set_volume', expect.anything());
    expect(mockInvoke).toHaveBeenCalledWith('set_dsp_params', {
      engine: 'SoundTouch',
      pitchSemitones: 2.0,
      tempoRatio: 1.1,
      rateRatio: 1.0,
    });
  });
});
