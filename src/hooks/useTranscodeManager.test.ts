import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY, useTranscodeManager } from './useTranscodeManager';
import { getTranslations } from '../i18n';
import { DEFAULT_PLAYBACK_STATUS, type TrackRecord } from '../types/player';
import { invokeMock } from '../test/ipcMock';

function makeTrack(path: string): TrackRecord {
  return {
    id: 42,
    path,
    title: 'Rendered',
    artist: 'Artist',
    album_artist: null,
    album_id: null,
    disc_no: 1,
    track_no: 1,
    duration_ms: 120000,
    format: 'opus',
    sample_rate: 48000,
    channels: 2,
    bit_depth: 16,
    file_size: 1024,
    modified_time: 1000,
    is_favorite: false,
    play_count: 0,
    last_played_at: null,
    total_play_time_ms: 0,
  };
}

describe('useTranscodeManager', () => {
  const loc = getTranslations('en');

  const createProps = () => ({
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
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with default transcode settings', () => {
    const { result } = renderHook(() => useTranscodeManager(createProps()));

    expect(result.current.transcodeFormat).toBe('Opus');
    expect(result.current.transcodeBitrate).toBe(192);
    expect(result.current.transcodeApplyDsp).toBe(false);
    expect(result.current.transcodeAutoEnqueue).toBe(true);
    expect(result.current.isTranscoding).toBe(false);
  });

  it('persists transcodeAutoEnqueue state across remounts and falls back on invalid data', () => {
    const first = renderHook(() => useTranscodeManager(createProps()));
    expect(first.result.current.transcodeAutoEnqueue).toBe(true);

    act(() => {
      first.result.current.setTranscodeAutoEnqueue(false);
    });
    expect(first.result.current.transcodeAutoEnqueue).toBe(false);
    expect(localStorage.getItem(TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY)).toBe('false');
    first.unmount();

    const second = renderHook(() => useTranscodeManager(createProps()));
    expect(second.result.current.transcodeAutoEnqueue).toBe(false);

    act(() => {
      second.result.current.setTranscodeAutoEnqueue(true);
    });
    expect(localStorage.getItem(TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY)).toBe('true');
    second.unmount();

    localStorage.setItem(TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY, 'not-a-boolean');
    const third = renderHook(() => useTranscodeManager(createProps()));
    expect(third.result.current.transcodeAutoEnqueue).toBe(true);
  });

  it('skips auto-enqueue after export when the persisted preference is false', async () => {
    localStorage.setItem(TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY, 'false');
    const props = createProps();
    const rendered = makeTrack('tests/fixtures/converted_sample.opus');

    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_library_tracks') return [rendered];
      if (cmd === 'get_library_albums') return [];
      return undefined;
    });

    const { result } = renderHook(() => useTranscodeManager(props));
    expect(result.current.transcodeAutoEnqueue).toBe(false);

    await act(async () => {
      await result.current.handleTranscode();
    });

    expect(props.handleAddTrackToQueue).not.toHaveBeenCalled();
    expect(result.current.lastExportedTrack).toEqual(rendered);
  });

  it('auto-enqueues rendered track when enabled and respects disabling mid-export', async () => {
    const props = createProps();
    const rendered = makeTrack('tests/fixtures/converted_sample.opus');

    let resolveTranscode!: () => void;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'transcode_file') {
        return new Promise<void>((resolve) => {
          resolveTranscode = resolve;
        });
      }
      if (cmd === 'get_library_tracks') return Promise.resolve([rendered]);
      if (cmd === 'get_library_albums') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useTranscodeManager(props));

    let transcodePromise!: Promise<void>;
    act(() => {
      transcodePromise = result.current.handleTranscode();
    });

    act(() => {
      result.current.setTranscodeAutoEnqueue(false);
    });

    await act(async () => {
      resolveTranscode();
      await transcodePromise;
    });

    expect(props.handleAddTrackToQueue).not.toHaveBeenCalled();

    act(() => {
      result.current.setTranscodeAutoEnqueue(true);
    });

    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_library_tracks') return [rendered];
      if (cmd === 'get_library_albums') return [];
      return undefined;
    });

    await act(async () => {
      await result.current.handleTranscode();
    });

    expect(props.handleAddTrackToQueue).toHaveBeenCalledWith(rendered);
  });

  it('updates output filename correctly when format changes', () => {
    const { result } = renderHook(() => useTranscodeManager(createProps()));

    act(() => {
      result.current.updateTranscodeOutputFilename('/music/song.wav', 'Flac');
    });

    expect(result.current.transcodeOutput).toBe('/music/song.flac');
  });

  it('formats loop range in filename when applyRange is enabled', () => {
    const { result } = renderHook(() => useTranscodeManager(createProps()));

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
