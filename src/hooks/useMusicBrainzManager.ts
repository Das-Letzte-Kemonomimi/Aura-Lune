import { useState, useCallback } from 'react';
import { invoke } from '../api/ipc';
import type { AlbumRecord, ReleaseCandidateDto, TrackRecord } from '../types/library';
import type { PlaybackStatus } from '../types/player';
import type { Translations } from '../i18n';
import { fmt } from '../utils/fmt';

export interface UseMusicBrainzManagerOptions {
  setAlbums: React.Dispatch<React.SetStateAction<AlbumRecord[]>>;
  loadLibrary: () => Promise<void>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
  status?: PlaybackStatus;
  albums?: AlbumRecord[];
  currentAlbum?: AlbumRecord | null;
  currentPlayingTrack?: TrackRecord | null;
  setTrackDirectCover?: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useMusicBrainzManager({
  setAlbums,
  loadLibrary,
  showMessage,
  loc,
  status,
  albums,
  currentAlbum,
  currentPlayingTrack,
  setTrackDirectCover,
}: UseMusicBrainzManagerOptions) {
  const [selectedAlbumForMb, setSelectedAlbumForMb] = useState<AlbumRecord | null>(null);
  const [mbSearchTitle, setMbSearchTitle] = useState('');
  const [mbSearchArtist, setMbSearchArtist] = useState('');
  const [mbCandidates, setMbCandidates] = useState<ReleaseCandidateDto[]>([]);
  const [isSearchingMb, setIsSearchingMb] = useState(false);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  const handleOpenMbModal = useCallback((album: AlbumRecord) => {
    setSelectedAlbumForMb(album);
    setMbSearchTitle(album.title);
    setMbSearchArtist(album.album_artist);
    setMbCandidates([]);
  }, []);

  const handleSearchMusicBrainz = useCallback(async () => {
    if (!mbSearchTitle.trim()) {
      showMessage(loc.notifications.mbSearchPrompt, true);
      return;
    }
    setIsSearchingMb(true);
    try {
      const candidates = await invoke<ReleaseCandidateDto[]>('search_musicbrainz_releases', {
        album: mbSearchTitle.trim(),
        artist: mbSearchArtist.trim(),
      });
      setMbCandidates(candidates);
      if (candidates.length === 0) {
        showMessage(loc.notifications.mbNoMatches, true);
      } else {
        showMessage(fmt(loc.notifications.mbFoundReleases, String(candidates.length)));
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    } finally {
      setIsSearchingMb(false);
    }
  }, [loc.common.errorPrefix, loc.notifications.mbFoundReleases, loc.notifications.mbNoMatches, loc.notifications.mbSearchPrompt, mbSearchArtist, mbSearchTitle, showMessage]);

  const handleSelectCandidateAndFetchCover = useCallback(async (candidate: ReleaseCandidateDto) => {
    if (!selectedAlbumForMb) return;
    setIsFetchingCover(true);
    try {
      const coverDataUri = await invoke<string>('fetch_and_apply_cover', {
        albumId: selectedAlbumForMb.id,
        mbid: candidate.mbid,
      });

      setAlbums((prev) =>
        prev.map((a) =>
          a.id === selectedAlbumForMb.id
            ? { ...a, cover_path: coverDataUri, release_mbid: candidate.mbid }
            : a
        )
      );

      showMessage(fmt(loc.notifications.caaCoverDownloaded, selectedAlbumForMb.title));
      const updatedId = selectedAlbumForMb.id;
      setSelectedAlbumForMb(null);
      if (updatedId <= 0) {
        await loadLibrary();
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    } finally {
      setIsFetchingCover(false);
    }
  }, [loadLibrary, loc.common.errorPrefix, loc.notifications.caaCoverDownloaded, selectedAlbumForMb, setAlbums, showMessage]);

  const handleAutoFetchCover = useCallback(async (album: AlbumRecord) => {
    try {
      showMessage(fmt(loc.notifications.mbSearchingCover, album.title));
      const coverDataUri = await invoke<string | null>('auto_fetch_album_cover', {
        albumId: album.id,
        albumTitle: album.title,
        artist: album.album_artist,
      });

      if (coverDataUri) {
        setAlbums((prev) =>
          prev.map((a) => (a.id === album.id ? { ...a, cover_path: coverDataUri } : a))
        );
        showMessage(fmt(loc.notifications.mbCoverMatched, album.title));
        if (album.id <= 0) {
          await loadLibrary();
        }
      } else {
        showMessage(loc.notifications.mbCoverLowScore, true);
        handleOpenMbModal(album);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [handleOpenMbModal, loadLibrary, loc.common.errorPrefix, loc.notifications.mbCoverLowScore, loc.notifications.mbCoverMatched, loc.notifications.mbSearchingCover, setAlbums, showMessage]);

  const handleFetchCurrentTrackCover = useCallback(async () => {
    const curTrack = status?.current_track;
    if (!curTrack) {
      showMessage(loc.notifications.noCurrentTrackForCover, true);
      return;
    }
    const albumTitle = curTrack.album || curTrack.title;
    const artist = curTrack.artist || 'Unknown';

    const normTitle = albumTitle.trim().toLowerCase();
    const normArtist = (currentPlayingTrack?.album_artist || artist).trim().toLowerCase();
    const foundAlbum =
      currentAlbum ||
      (albums || []).find(
        (a) =>
          a.title.trim().toLowerCase() === normTitle &&
          a.album_artist.trim().toLowerCase() === normArtist
      );

    if (foundAlbum) {
      await handleAutoFetchCover(foundAlbum);
    } else {
      const tempAlbum: AlbumRecord = {
        id: 0,
        title: albumTitle,
        album_artist: artist,
        year: null,
        cover_path: null,
        release_mbid: null,
      };
      handleOpenMbModal(tempAlbum);
    }
  }, [albums, currentAlbum, currentPlayingTrack?.album_artist, handleAutoFetchCover, handleOpenMbModal, loc.notifications.noCurrentTrackForCover, showMessage, status?.current_track]);

  const handleUploadCustomCoverDirect = useCallback(async (album?: AlbumRecord | null) => {
    try {
      const selectedPath = await invoke<string | null>('pick_image_file');
      if (selectedPath) {
        const targetAlbumId = album?.id || currentAlbum?.id || 0;
        const targetTitle = album?.title || currentAlbum?.title || status?.current_track?.album || status?.current_track?.title || 'Unknown Album';
        const targetArtist = album?.album_artist || currentAlbum?.album_artist || status?.current_track?.artist || 'Unknown Artist';

        const coverDataUri = await invoke<string>('apply_custom_cover_file', {
          albumId: targetAlbumId,
          filePath: selectedPath,
          albumTitle: targetTitle,
          artist: targetArtist,
          trackId: currentPlayingTrack?.id || null,
        });

        if (targetAlbumId > 0) {
          setAlbums((prev) =>
            prev.map((a) => (a.id === targetAlbumId ? { ...a, cover_path: coverDataUri } : a))
          );
        }
        if (setTrackDirectCover) {
          setTrackDirectCover(coverDataUri);
        }
        showMessage(fmt(loc.covers.customCoverSaved, targetTitle));
        await loadLibrary();
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [currentAlbum, currentPlayingTrack, loadLibrary, loc.common.errorPrefix, loc.covers.customCoverSaved, setAlbums, setTrackDirectCover, showMessage, status?.current_track]);

  return {
    selectedAlbumForMb,
    setSelectedAlbumForMb,
    mbSearchTitle,
    setMbSearchTitle,
    mbSearchArtist,
    setMbSearchArtist,
    mbCandidates,
    setMbCandidates,
    isSearchingMb,
    isFetchingCover,
    handleOpenMbModal,
    handleSearchMusicBrainz,
    handleSelectCandidateAndFetchCover,
    handleAutoFetchCover,
    handleFetchCurrentTrackCover,
    handleUploadCustomCoverDirect,
  };
}
