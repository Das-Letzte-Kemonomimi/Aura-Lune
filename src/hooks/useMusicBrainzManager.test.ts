import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMusicBrainzManager } from './useMusicBrainzManager';
import { getTranslations } from '../i18n';
import type { AlbumRecord } from '../types/library';


describe('useMusicBrainzManager hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();
  const setAlbums = vi.fn();
  const loadLibrary = vi.fn().mockResolvedValue(undefined);

  const sampleAlbum: AlbumRecord = {
    id: 42,
    title: 'Neon Genesis',
    album_artist: 'Yoko Kanno',
    year: 1995,
    cover_path: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with null selected album and empty candidates', () => {
    const { result } = renderHook(() =>
      useMusicBrainzManager({ setAlbums, loadLibrary, showMessage, loc })
    );

    expect(result.current.selectedAlbumForMb).toBeNull();
    expect(result.current.mbCandidates).toEqual([]);
    expect(result.current.isSearchingMb).toBe(false);
    expect(result.current.isFetchingCover).toBe(false);
  });

  it('populates search fields when handleOpenMbModal is called', () => {
    const { result } = renderHook(() =>
      useMusicBrainzManager({ setAlbums, loadLibrary, showMessage, loc })
    );

    act(() => {
      result.current.handleOpenMbModal(sampleAlbum);
    });

    expect(result.current.selectedAlbumForMb).toEqual(sampleAlbum);
    expect(result.current.mbSearchTitle).toBe('Neon Genesis');
    expect(result.current.mbSearchArtist).toBe('Yoko Kanno');
    expect(result.current.mbCandidates).toEqual([]);
  });

  it('shows error notification when handleFetchCurrentTrackCover is called with no current track', async () => {
    const { result } = renderHook(() =>
      useMusicBrainzManager({ setAlbums, loadLibrary, showMessage, loc })
    );

    await act(async () => {
      await result.current.handleFetchCurrentTrackCover();
    });

    expect(showMessage).toHaveBeenCalledWith(loc.notifications.noCurrentTrackForCover, true);
  });

  it('handles custom cover upload successfully', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'pick_image_file') return Promise.resolve('/path/to/custom_cover.png');
      if (cmd === 'apply_custom_cover_file') return Promise.resolve('data:image/png;base64,mock');
      return Promise.resolve(null);
    });

    const setTrackDirectCover = vi.fn();
    const { result } = renderHook(() =>
      useMusicBrainzManager({
        setAlbums,
        loadLibrary,
        showMessage,
        loc,
        currentAlbum: sampleAlbum,
        setTrackDirectCover,
      })
    );

    await act(async () => {
      await result.current.handleUploadCustomCoverDirect(sampleAlbum);
    });

    expect(setTrackDirectCover).toHaveBeenCalledWith('data:image/png;base64,mock');
    expect(showMessage).toHaveBeenCalledWith(loc.covers.customCoverSaved.replace('{0}', 'Neon Genesis'));
    expect(loadLibrary).toHaveBeenCalled();
  });
});

