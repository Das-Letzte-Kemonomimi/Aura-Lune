import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranscodeManager } from './useTranscodeManager';
import { getTranslations } from '../i18n';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';

describe('useTranscodeManager', () => {
  const loc = getTranslations('en');

  const defaultProps = {
    filePath: '/path/to/audio.flac',
    setFilePath: vi.fn(),
    currentPlayingTrack: null,
    status: DEFAULT_PLAYBACK_STATUS,
    loopPointA: null,
    loopPointB: null,
    currentTrackBookmarks: [],
    activeTrackId: null,
    reverbEnabled: false,
    reverbLevel: 0,
    language: 'en' as const,
    loc,
    t: loc,
    showMessage: vi.fn(),
    setSettingsTab: vi.fn(),
    setIsSettingsOpen: vi.fn(),
    refreshTrackBookmarks: vi.fn(),
    handleAddTrackToQueue: vi.fn().mockResolvedValue(undefined),
    loadLibrary: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    setAlbums: vi.fn(),
  };

  it('initializes with default transcode settings', () => {
    const { result } = renderHook(() => useTranscodeManager(defaultProps));

    expect(result.current.transcodeFormat).toBe('Opus');
    expect(result.current.transcodeBitrate).toBe(192);
    expect(result.current.transcodeApplyDsp).toBe(false);
    expect(result.current.isTranscoding).toBe(false);
  });

  it('updates output filename correctly when format changes', () => {
    const { result } = renderHook(() => useTranscodeManager(defaultProps));

    act(() => {
      result.current.updateTranscodeOutputFilename('/music/song.wav', 'Flac');
    });

    expect(result.current.transcodeOutput).toBe('/music/song.flac');
  });

  it('formats loop range in filename when applyRange is enabled', () => {
    const { result } = renderHook(() => useTranscodeManager(defaultProps));

    act(() => {
      result.current.updateTranscodeOutputFilename(
        '/music/track.mp3',
        'Opus',
        '0:10.000',
        '0:25.000',
        true
      );
    });

    expect(result.current.transcodeOutput).toBe('/music/track_loop_10000-25000.opus');
  });
});
