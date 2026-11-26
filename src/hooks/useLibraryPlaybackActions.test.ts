import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibraryPlaybackActions } from './useLibraryPlaybackActions';
import type { TrackRecord, AlbumRecord, PlaybackStatus } from '../types/player';
import type { PlaybackQueue } from '../types/queue';
import { getTranslations } from '../i18n';
import { invokeMock } from '../test/ipcMock';


describe('useLibraryPlaybackActions', () => {
  const loc = getTranslations('en');

  const mockTrack1: TrackRecord = {
    id: 1,
    title: 'Track One',
    artist: 'Artist One',
    album_artist: 'Artist One',
    album_id: 10,
    path: '/music/track1.flac',
    duration_ms: 180000,
    format: 'flac',
    sample_rate: 44100,
    channels: 2,
    disc_no: 1,
    track_no: 1,
    bit_depth: 16,
    file_size: 10240,
    modified_time: 1234567,
  };

  const mockAlbum1: AlbumRecord = {
    id: 10,
    title: 'Album One',
    album_artist: 'Artist One',
    year: 2024,
    cover_path: '/covers/album1.jpg',
  };

  const mockQueue: PlaybackQueue = {
    items: [],
    current_index: 0,
    loop_mode: 'None',
    shuffle: false,
    shuffle_order: [],
    shuffle_cursor: 0,
  };

  const mockStatus: PlaybackStatus = {
    state: 'Stopped',
    position_ms: 45000,
    duration_ms: 180000,
    volume: 1.0,
    engine: 'SoundTouch',
    capabilities: {
      engine: 'SoundTouch',
      name: 'SoundTouch',
      min_pitch_semitones: -12,
      max_pitch_semitones: 12,
      min_tempo_ratio: 0.5,
      max_tempo_ratio: 2.0,
      supports_formants: false,
      description: 'SoundTouch DSP',
    },
    pitch_semitones: 0,
    tempo_ratio: 1.0,
    rate_ratio: 1.0,
  };

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
  });

  it('handles play library track with queue replace mode', async () => {
    const setActiveTrackId = vi.fn();
    const setFilePath = vi.fn();
    const refreshQueue = vi.fn().mockResolvedValue(undefined);
    const setCurrentBookmark = vi.fn();
    const showMessage = vi.fn();

    const initialStartupPositionRef = { current: null };

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [mockTrack1],
        setTracks: vi.fn(),
        albums: [mockAlbum1],
        queue: mockQueue,
        refreshQueue,
        albumPlaybackMode: 'replace',
        activeTrackId: null,
        setActiveTrackId,
        setFilePath,
        status: mockStatus,
        setStatus: vi.fn(),
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark,
        handleSeek: vi.fn().mockResolvedValue(undefined),
        handleScanPaths: vi.fn().mockResolvedValue(undefined),
        filteredTracks: [mockTrack1],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef,
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handlePlayLibraryTrack(mockTrack1);
    });

    expect(setActiveTrackId).toHaveBeenCalledWith(1);
    expect(setFilePath).toHaveBeenCalledWith('/music/track1.flac');
    expect(invokeMock).toHaveBeenCalledWith('set_queue', expect.objectContaining({ startIndex: 0 }));
    expect(refreshQueue).toHaveBeenCalled();
  });

  it('handles bookmark saving and jumping', async () => {
    const setCurrentBookmark = vi.fn();
    const handleSeek = vi.fn().mockResolvedValue(undefined);
    const showMessage = vi.fn();

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [mockTrack1],
        setTracks: vi.fn(),
        albums: [mockAlbum1],
        queue: mockQueue,
        refreshQueue: vi.fn().mockResolvedValue(undefined),
        albumPlaybackMode: 'replace',
        activeTrackId: 1,
        setActiveTrackId: vi.fn(),
        setFilePath: vi.fn(),
        status: mockStatus,
        setStatus: vi.fn(),
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark,
        handleSeek,
        handleScanPaths: vi.fn().mockResolvedValue(undefined),
        filteredTracks: [mockTrack1],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef: { current: null },
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handleSaveBookmark();
    });

    expect(invokeMock).toHaveBeenCalledWith('save_bookmark', {
      trackId: 1,
      positionMs: 45000,
    });
    expect(setCurrentBookmark).toHaveBeenCalledWith(45000);

    await act(async () => {
      await result.current.handleJumpToBookmark(12000);
    });

    expect(handleSeek).toHaveBeenCalledWith(12000);
  });

  it('handles opening containing folder', async () => {
    invokeMock.mockResolvedValue('/music');
    const showMessage = vi.fn();

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [mockTrack1],
        setTracks: vi.fn(),
        albums: [mockAlbum1],
        queue: mockQueue,
        refreshQueue: vi.fn().mockResolvedValue(undefined),
        albumPlaybackMode: 'replace',
        activeTrackId: null,
        setActiveTrackId: vi.fn(),
        setFilePath: vi.fn(),
        status: mockStatus,
        setStatus: vi.fn(),
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark: vi.fn(),
        handleSeek: vi.fn().mockResolvedValue(undefined),
        handleScanPaths: vi.fn().mockResolvedValue(undefined),
        filteredTracks: [mockTrack1],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef: { current: null },
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handleOpenContainingFolder('/music/track1.flac');
    });

    expect(invokeMock).toHaveBeenCalledWith('open_containing_folder', {
      filePath: '/music/track1.flac',
    });
    expect(showMessage).toHaveBeenCalled();
  });

  it('handles setting track rating', async () => {
    const setTracks = vi.fn();
    invokeMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [mockTrack1],
        setTracks,
        albums: [mockAlbum1],
        queue: mockQueue,
        refreshQueue: vi.fn().mockResolvedValue(undefined),
        albumPlaybackMode: 'replace',
        activeTrackId: null,
        setActiveTrackId: vi.fn(),
        setFilePath: vi.fn(),
        status: mockStatus,
        setStatus: vi.fn(),
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark: vi.fn(),
        handleSeek: vi.fn().mockResolvedValue(undefined),
        handleScanPaths: vi.fn().mockResolvedValue(undefined),
        filteredTracks: [mockTrack1],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef: { current: null },
        showMessage: vi.fn(),
        loc,
      })
    );

    await act(async () => {
      await result.current.handleSetTrackRating(1, 5);
    });

    expect(invokeMock).toHaveBeenCalledWith('set_track_rating', {
      trackId: 1,
      rating: 5,
    });
    expect(setTracks).toHaveBeenCalled();
  });

  it('handles toggling track favorite', async () => {
    const setTracks = vi.fn();
    const showMessage = vi.fn();
    invokeMock.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [mockTrack1],
        setTracks,
        albums: [mockAlbum1],
        queue: mockQueue,
        refreshQueue: vi.fn().mockResolvedValue(undefined),
        albumPlaybackMode: 'replace',
        activeTrackId: null,
        setActiveTrackId: vi.fn(),
        setFilePath: vi.fn(),
        status: mockStatus,
        setStatus: vi.fn(),
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark: vi.fn(),
        handleSeek: vi.fn().mockResolvedValue(undefined),
        handleScanPaths: vi.fn().mockResolvedValue(undefined),
        filteredTracks: [mockTrack1],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef: { current: null },
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handleToggleFavorite(1);
    });

    expect(invokeMock).toHaveBeenCalledWith('toggle_favorite', { trackId: 1 });
    expect(setTracks).toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.addedFavorite);
  });

  it('shuffle-all replaces the queue, enables backend shuffle and starts playback in order', async () => {
    const mockTrack2: TrackRecord = { ...mockTrack1, id: 2, path: '/music/track2.flac', title: 'Track Two' };
    const showMessage = vi.fn();

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [mockTrack1, mockTrack2],
        setTracks: vi.fn(),
        albums: [mockAlbum1],
        queue: mockQueue,
        refreshQueue: vi.fn().mockResolvedValue(undefined),
        albumPlaybackMode: 'replace',
        activeTrackId: null,
        setActiveTrackId: vi.fn(),
        setFilePath: vi.fn(),
        status: mockStatus,
        setStatus: vi.fn(),
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark: vi.fn(),
        handleSeek: vi.fn().mockResolvedValue(undefined),
        handleScanPaths: vi.fn().mockResolvedValue(undefined),
        filteredTracks: [mockTrack1, mockTrack2],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef: { current: null },
        showMessage,
        loc,
      })
    );

    await act(async () => {
      await result.current.handleShuffleAll();
    });

    const commands = invokeMock.mock.calls.map(([cmd]) => cmd);
    const setQueueAt = commands.indexOf('set_queue');
    const setShuffleAt = commands.indexOf('set_shuffle');
    const playAt = commands.indexOf('play');
    expect(setQueueAt).toBeGreaterThanOrEqual(0);
    expect(setShuffleAt).toBeGreaterThan(setQueueAt);
    expect(playAt).toBeGreaterThan(setShuffleAt);
    expect(invokeMock).toHaveBeenCalledWith('set_shuffle', { enabled: true });
    expect(showMessage).not.toHaveBeenCalledWith(expect.anything(), true);
  });

  it('drops a single audio file, updates activeTrackId/filePath/status, refreshes queue, and starts playback', async () => {
    const droppedPath = '/home/kamu/Music/20 Sorrowful feather C2Rmix.flac';
    const scannedTrack: TrackRecord = {
      ...mockTrack1,
      id: 42,
      title: 'Sorrowful feather C2Rmix',
      artist: 'TENMON & Eiichiro Yanagi',
      path: droppedPath,
      duration_ms: 215000,
    };
    const nextStatus: PlaybackStatus = {
      ...mockStatus,
      state: 'Playing',
      position_ms: 0,
      duration_ms: 215000,
      current_track: {
        id: 'track-42',
        track_id: 42,
        uri: droppedPath,
        title: 'Sorrowful feather C2Rmix',
        artist: 'TENMON & Eiichiro Yanagi',
        album: 'ef - a tale of memories. ORIGINAL SOUNDTRACK -espressivo-',
        duration_ms: 215000,
      },
    };
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_status') return nextStatus;
      return null;
    });

    const setActiveTrackId = vi.fn();
    const setFilePath = vi.fn();
    const setStatus = vi.fn();
    const refreshQueue = vi.fn().mockResolvedValue(undefined);
    const initialStartupPositionRef = { current: 45000 };
    const handleScanPaths = vi.fn().mockResolvedValue({ tracks: [scannedTrack], albums: [] });

    const { result } = renderHook(() =>
      useLibraryPlaybackActions({
        tracks: [],
        setTracks: vi.fn(),
        albums: [],
        queue: mockQueue,
        refreshQueue,
        albumPlaybackMode: 'replace',
        activeTrackId: 1,
        setActiveTrackId,
        setFilePath,
        status: mockStatus,
        setStatus,
        trackDirectCover: null,
        desktopNotificationsEnabled: false,
        replaygainMode: 'Off',
        listenbrainzEnabled: false,
        listenbrainzToken: '',
        setScrobbledTrackId: vi.fn(),
        lastfmEnabled: false,
        lastfmSessionKey: '',
        lastfmCustomKey: '',
        lastfmCustomSecret: '',
        setLastfmScrobbledTrackId: vi.fn(),
        setCurrentBookmark: vi.fn(),
        handleSeek: vi.fn().mockResolvedValue(undefined),
        handleScanPaths,
        filteredTracks: [],
        statsModalTrack: null,
        setStatsModalTrack: vi.fn(),
        initialStartupPositionRef,
        showMessage: vi.fn(),
        loc,
      })
    );

    await act(async () => {
      await result.current.handleDropPaths([droppedPath]);
    });

    expect(handleScanPaths).toHaveBeenCalledWith([droppedPath], { skipAutoActivate: true });
    expect(initialStartupPositionRef.current).toBeNull();
    expect(setActiveTrackId).toHaveBeenCalledWith(42);
    expect(setFilePath).toHaveBeenCalledWith(droppedPath);
    expect(invokeMock).toHaveBeenCalledWith('load_file', { path: droppedPath });
    expect(invokeMock).toHaveBeenCalledWith('play');
    expect(refreshQueue).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(nextStatus);
  });
});
