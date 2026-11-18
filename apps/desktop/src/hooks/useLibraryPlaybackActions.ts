import { useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TrackRecord, AlbumRecord, PlaybackStatus } from '../types/player';
import type { PlaybackQueue, QueueItem } from '../types/queue';
import type { AlbumPlaybackBehavior } from '../types/playback';
import type { TrackStatsData } from '../components/modals/TrackStatsModal';
import type { Translations } from '../i18n';
import { formatTime, formatTimeMs } from '../utils/timeFormat';
import { vinylSimulator } from '../utils/vinylSimulator';

export interface UseLibraryPlaybackActionsOptions {
  tracks: TrackRecord[];
  setTracks: React.Dispatch<React.SetStateAction<TrackRecord[]>>;
  albums: AlbumRecord[];
  queue: PlaybackQueue;
  refreshQueue: () => Promise<void>;
  albumPlaybackMode: AlbumPlaybackBehavior;
  activeTrackId: number | null;
  setActiveTrackId: React.Dispatch<React.SetStateAction<number | null>>;
  setFilePath: React.Dispatch<React.SetStateAction<string>>;
  status: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  trackDirectCover: string | null;
  desktopNotificationsEnabled: boolean;
  replaygainMode: string;
  listenbrainzEnabled: boolean;
  listenbrainzToken: string;
  setScrobbledTrackId: React.Dispatch<React.SetStateAction<number | null>>;
  lastfmEnabled: boolean;
  lastfmSessionKey: string;
  lastfmCustomKey: string;
  lastfmCustomSecret: string;
  setLastfmScrobbledTrackId: React.Dispatch<React.SetStateAction<number | null>>;
  setCurrentBookmark: React.Dispatch<React.SetStateAction<number | null>>;
  handleSeek: (posMs: number) => Promise<void>;
  handleScanPaths: (paths: string[]) => Promise<void>;
  filteredTracks: TrackRecord[];
  statsModalTrack: TrackStatsData | null;
  setStatsModalTrack: React.Dispatch<React.SetStateAction<TrackStatsData | null>>;
  initialStartupPositionRef: React.MutableRefObject<number | null>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useLibraryPlaybackActions({
  tracks,
  setTracks,
  albums,
  queue,
  refreshQueue,
  albumPlaybackMode,
  activeTrackId,
  setActiveTrackId,
  setFilePath,
  status,
  setStatus,
  trackDirectCover,
  desktopNotificationsEnabled,
  replaygainMode,
  listenbrainzEnabled,
  listenbrainzToken,
  setScrobbledTrackId,
  lastfmEnabled,
  lastfmSessionKey,
  lastfmCustomKey,
  lastfmCustomSecret,
  setLastfmScrobbledTrackId,
  setCurrentBookmark,
  handleSeek,
  handleScanPaths,
  filteredTracks,
  statsModalTrack,
  setStatsModalTrack,
  initialStartupPositionRef,
  showMessage,
  loc,
}: UseLibraryPlaybackActionsOptions) {
  const isPlayingLibraryTrackRef = useRef<boolean>(false);

  // Sterowanie odtwarzaczem - ładowanie bezpośrednie pliku
  const handleLoadFile = async (path: string) => {
    try {
      setFilePath(path);
      const matchingTrack = tracks.find((t) => t.path === path || path.endsWith(t.path));
      if (matchingTrack) {
        setActiveTrackId(matchingTrack.id);
      }
      const matchingAlbum = matchingTrack ? albums.find((a) => a.id === matchingTrack.album_id) : null;
      const appCover = matchingAlbum?.release_mbid
        ? `https://coverartarchive.org/release/${matchingAlbum.release_mbid}/front-500`
        : (matchingAlbum?.cover_path || trackDirectCover || null);

      const filename = path.split('/').pop() || path;
      invoke('update_mpris_metadata', {
        title: matchingTrack?.title || filename,
        artist: matchingTrack?.artist || 'Plik lokalny',
        album: matchingAlbum?.title || 'Auralune Player',
        durationMs: matchingTrack?.duration_ms || 0,
        artUrl: appCover,
      }).catch(() => {});

      await invoke('load_file', { path });

      // Powiadomienie pulpitu Linuksa (libnotify / D-Bus)
      if (desktopNotificationsEnabled) {
        invoke('show_desktop_notification', {
          title: matchingTrack?.title || filename,
          body: matchingTrack?.artist || 'Plik lokalny',
          icon: null,
        }).catch(() => {});
      }

      showMessage(loc.notifications.fileLoaded.replace('{0}', path));
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Systemowy wybór plików audio (kdialog Dolphin / zenity)
  const handlePickFiles = async () => {
    try {
      const selected = await invoke<string[]>('pick_files');
      if (selected && selected.length > 0) {
        showMessage(loc.notifications.filesSelectedDolphin.replace('{0}', String(selected.length)));
        await handleScanPaths(selected);

        const items: QueueItem[] = selected.map((filePath, idx) => {
          const matchingTrack = tracks.find((tr) => tr.path === filePath || filePath.endsWith(tr.path));
          const alb = matchingTrack ? albums.find((a) => a.id === matchingTrack.album_id) : null;
          const fname = filePath.split('/').pop() || filePath;
          return {
            id: `picked-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            track_id: matchingTrack?.id ?? null,
            uri: filePath,
            title: matchingTrack?.title || fname,
            artist: matchingTrack?.artist || 'Plik lokalny',
            album: alb?.title || null,
            duration_ms: (matchingTrack?.duration_ms || 0) as any,
          };
        });

        if (albumPlaybackMode === 'replace') {
          await invoke('set_queue', { items, startIndex: 0 });
          await refreshQueue();
        } else if (albumPlaybackMode === 'append') {
          const currentLen = queue.items.length;
          const combined = [...queue.items, ...items];
          await invoke('set_queue', { items: combined, startIndex: currentLen });
          await refreshQueue();
        } else {
          await handleLoadFile(selected[0]);
          await invoke('play');
          await refreshQueue();
        }
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Obsługa upuszczenia plików lub folderów (Drag & Drop)
  const handleDropPaths = async (paths: string[]) => {
    if (!paths || paths.length === 0) return;
    try {
      await handleScanPaths(paths);
      if (paths.length === 1) {
        const p = paths[0];
        const isAudio = /\.(flac|mp3|ogg|wav|m4a|aac|opus|alac|aiff|ape|wma)$/i.test(p);
        if (isAudio) {
          setFilePath(p);
          await invoke('load_file', { path: p });
          await invoke('play');
        }
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Odtwarzanie utworu z biblioteki z obsługą zakładek, kontekstu kolejki i globalnego Loop
  const handlePlayLibraryTrack = async (track: TrackRecord, contextTracks?: TrackRecord[]) => {
    initialStartupPositionRef.current = null;
    if (isPlayingLibraryTrackRef.current) return;
    isPlayingLibraryTrackRef.current = true;
    const safetyTimeout = setTimeout(() => {
      isPlayingLibraryTrackRef.current = false;
    }, 4000);
    try {
      setActiveTrackId(track.id);
      setFilePath(track.path);

      // 1. Natychmiastowe zaktualizowanie Discord RPC / MPRIS (0ms) z okładką
      const matchingAlbum = albums.find((a) => a.id === track.album_id);
      const appCover = matchingAlbum?.release_mbid
        ? `https://coverartarchive.org/release/${matchingAlbum.release_mbid}/front-500`
        : (matchingAlbum?.cover_path || trackDirectCover || null);

      invoke('update_mpris_metadata', {
        title: track.title,
        artist: track.artist,
        album: matchingAlbum?.title || 'Auralune Library',
        durationMs: track.duration_ms,
        artUrl: appCover,
      }).catch(() => {});

      // 2. Zarządzanie kolejką odtwarzania w zależności od albumPlaybackMode i kontekstu
      const effectiveTracks = contextTracks && contextTracks.length > 0 ? contextTracks : [track];

      if (albumPlaybackMode === 'replace') {
        const trackIdx = effectiveTracks.findIndex((t) => t.id === track.id);
        const startIndex = trackIdx >= 0 ? trackIdx : 0;
        const queueItems: QueueItem[] = effectiveTracks.map((t, idx) => {
          const alb = albums.find((a) => a.id === t.album_id);
          return {
            id: `track-${t.id}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            track_id: t.id,
            uri: t.path,
            title: t.title,
            artist: t.artist,
            album: alb?.title || t.album_artist || null,
            duration_ms: (t.duration_ms || 0) as any,
          };
        });
        await invoke('set_queue', { items: queueItems, startIndex });
        await refreshQueue();
      } else if (albumPlaybackMode === 'append') {
        const trackIdx = effectiveTracks.findIndex((t) => t.id === track.id);
        const startIndex = trackIdx >= 0 ? trackIdx : 0;
        const queueItems: QueueItem[] = effectiveTracks.map((t, idx) => {
          const alb = albums.find((a) => a.id === t.album_id);
          return {
            id: `track-${t.id}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            track_id: t.id,
            uri: t.path,
            title: t.title,
            artist: t.artist,
            album: alb?.title || t.album_artist || null,
            duration_ms: (t.duration_ms || 0) as any,
          };
        });
        const currentLen = queue.items.length;
        const targetIdx = currentLen + startIndex;
        const combined = [...queue.items, ...queueItems];
        await invoke('set_queue', { items: combined, startIndex: targetIdx });
        await refreshQueue();
      } else {
        // Tryb 'single': bezpośrednie załadowanie utworu bez modyfikacji kolejki
        await invoke('load_file', { path: track.path });
        await invoke('play');
        await refreshQueue();
      }

      // Sprawdź czy jest zapisana zakładka (bookmark)
      const bookmark = await invoke<number | null>('get_bookmark', { trackId: track.id });
      setCurrentBookmark(bookmark ?? null);

      if (bookmark && bookmark > 2000) {
        try {
          await invoke('seek', { positionMs: bookmark });
          showMessage(loc.notifications.resumedTrack.replace('{0}', track.title).replace('{1}', formatTime(bookmark)));
        } catch {
          showMessage(loc.notifications.startedPlayback.replace('{0}', track.title).replace('{1}', track.artist));
        }
      } else {
        showMessage(loc.notifications.startedPlayback.replace('{0}', track.title).replace('{1}', track.artist));
      }

      // Powiadomienie pulpitu Linuksa (libnotify / D-Bus)
      if (desktopNotificationsEnabled) {
        invoke('show_desktop_notification', {
          title: track.title,
          body: matchingAlbum?.title ? `${track.artist} • ${matchingAlbum.title}` : track.artist,
          icon: null,
        }).catch(() => {});
      }

      // ListenBrainz Scrobbler
      setScrobbledTrackId(null);
      if (listenbrainzEnabled && listenbrainzToken) {
        invoke('submit_listenbrainz_playing_now', {
          token: listenbrainzToken,
          artist: track.artist,
          title: track.title,
          album: matchingAlbum?.title || null,
          durationMs: track.duration_ms || null,
        }).catch((e) => console.warn('ListenBrainz Playing Now error:', e));
      }

      // Last.fm Scrobbler
      setLastfmScrobbledTrackId(null);
      if (lastfmEnabled && lastfmSessionKey) {
        invoke('lastfm_update_now_playing', {
          request: {
            session_key: lastfmSessionKey,
            artist: track.artist,
            track: track.title,
            album: matchingAlbum?.title || null,
            duration_sec: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
            timestamp: null,
            api_key: lastfmCustomKey.trim() || null,
            api_secret: lastfmCustomSecret.trim() || null,
          },
        }).catch((e) => console.warn('Last.fm Now Playing error:', e));
      }

      // Auto ReplayGain: dynamiczne dopasowanie Album Gain vs Track Gain
      if (replaygainMode === 'Auto') {
        const prevTrack = tracks.find((t) => t.id === activeTrackId);
        const isSameAlbum = prevTrack?.album_id != null && prevTrack.album_id === track.album_id;
        invoke('apply_auto_replaygain', {
          isSameAlbum,
          isShuffle: Boolean(queue.shuffle),
        }).catch((e) => console.warn('Auto ReplayGain error:', e));
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    } finally {
      clearTimeout(safetyTimeout);
      isPlayingLibraryTrackRef.current = false;
    }
  };

  const handlePlayAlbum = (albumTracks: TrackRecord[], startIndex = 0) => {
    const sorted = [...albumTracks].sort(
      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
    );
    if (sorted.length > 0) {
      const target = sorted[startIndex] || sorted[0];
      handlePlayLibraryTrack(target, sorted);
    }
  };

  const handleAddAlbumToQueue = async (albumTracks: TrackRecord[]) => {
    const sorted = [...albumTracks].sort(
      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
    );
    if (sorted.length > 0) {
      try {
        await invoke('add_uris_to_queue', { uris: sorted.map((t) => t.path) });
        await refreshQueue();
        showMessage(loc.notifications.loadedTracksToQueueMsg.replace('{0}', String(sorted.length)));
      } catch (e: any) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    }
  };

  // Wymieszanie i natychmiastowe odtworzenie całej biblioteki lub kontekstu utworów
  const handleShuffleAll = async (sourceTracks?: TrackRecord[]) => {
    const pool = (sourceTracks && sourceTracks.length > 0)
      ? sourceTracks
      : (filteredTracks.length > 0 ? filteredTracks : tracks);

    if (pool.length === 0) {
      showMessage((loc.common as any)?.noResults || 'Brak utworów do odtworzenia', true);
      return;
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const queueItems: QueueItem[] = shuffled.map((t) => ({
      id: `track-${t.id}`,
      track_id: t.id,
      uri: t.path,
      title: t.title,
      artist: t.artist,
      album: albums.find((a) => a.id === t.album_id)?.title || null,
      duration_ms: (t.duration_ms || 0) > 0 ? t.duration_ms! : 0,
    }));

    try {
      await invoke('set_queue', { items: queueItems, startIndex: 0 });
      await invoke('set_shuffle', { enabled: true });
      await invoke('play');
      await refreshQueue();
      setActiveTrackId(shuffled[0].id);
      setFilePath(shuffled[0].path);
      showMessage(`🔀 Wymieszano i uruchomiono ${shuffled.length} utworów!`);
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Profile sygnaturowe Auralune (Mastering Sound Profiles)
  const handleApplySignatureProfile = async (profileId: string) => {
    try {
      if (profileId === 'vocal_air') {
        await invoke('set_dsp_params', {
          engine: 'RubberBand',
          pitchSemitones: 0.0,
          tempoRatio: 1.0,
          rateRatio: 1.0,
        });
        const vocalBands = [0, 0, -1, 0, 0, 1.5, 2.5, 2.0, 1.5, 0];
        await invoke('set_equalizer_params', { enabled: true, bands: vocalBands });
        await invoke('set_stereo_widener', { active: true, amount: 0.35 });
        await invoke('set_limiter_enabled', { enabled: true });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'RubberBand',
          pitch_semitones: 0.0,
          tempo_ratio: 1.0,
          rate_ratio: 1.0,
          equalizer_enabled: true,
          equalizer_bands: vocalBands,
        }));
        showMessage('🌸 Zastosowano profil: Anime Vocal Air (Czysty wokal, poszerzona scena)');
      } else if (profileId === 'lofi_tape') {
        await invoke('set_dsp_params', {
          engine: 'SoundTouch',
          pitchSemitones: -0.5,
          tempoRatio: 0.94,
          rateRatio: 0.94,
        });
        const tapeBands = [2.5, 2.0, 1.0, 0, 0, 0, -1.0, -2.0, -3.0, -4.0];
        await invoke('set_equalizer_params', { enabled: true, bands: tapeBands });
        await invoke('set_crossfeed_config', {
          config: { enabled: true, preset: 'Default', fcut_hz: 700, feed_tenth_db: 45 },
        });
        vinylSimulator.setEnabled(true);
        vinylSimulator.setMode('tape');
        vinylSimulator.setIntensity(0.32);
        setStatus((prev) => ({
          ...prev,
          engine: 'SoundTouch',
          pitch_semitones: -0.5,
          tempo_ratio: 0.94,
          rate_ratio: 0.94,
          equalizer_enabled: true,
          equalizer_bands: tapeBands,
        }));
        showMessage('☕ Zastosowano profil: Midnight Lo-Fi Tape (Szum taśmy, ciepło analogu, crossfeed)');
      } else if (profileId === 'bit_perfect') {
        await invoke('set_dsp_params', {
          engine: 'Bypass',
          pitchSemitones: 0.0,
          tempoRatio: 1.0,
          rateRatio: 1.0,
        });
        await invoke('set_equalizer_params', { enabled: false, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
        await invoke('set_stereo_widener', { active: false, amount: 0.0 });
        await invoke('set_limiter_enabled', { enabled: false });
        await invoke('set_crossfeed_config', {
          config: { enabled: false, preset: 'Default', fcut_hz: 700, feed_tenth_db: 45 },
        });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'Bypass',
          pitch_semitones: 0.0,
          tempo_ratio: 1.0,
          rate_ratio: 1.0,
          equalizer_enabled: false,
          equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }));
        showMessage('🎧 Zastosowano profil: Audiophile Bit-Perfect (Passthrough bez DSP)');
      } else if (profileId === 'nightcore') {
        await invoke('set_dsp_params', {
          engine: 'RubberBand',
          pitchSemitones: 2.0,
          tempoRatio: 1.25,
          rateRatio: 1.25,
        });
        const clubBands = [3.0, 2.5, 0, 0, 1.0, 1.5, 2.0, 3.0, 3.5, 2.0];
        await invoke('set_equalizer_params', { enabled: true, bands: clubBands });
        await invoke('set_limiter_enabled', { enabled: true });
        await invoke('set_stereo_widener', { active: true, amount: 0.40 });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'RubberBand',
          pitch_semitones: 2.0,
          tempo_ratio: 1.25,
          rate_ratio: 1.25,
          equalizer_enabled: true,
          equalizer_bands: clubBands,
        }));
        showMessage('⚡ Zastosowano profil: Nightcore Club Anthem (+2 st, 1.25x, Limiter)');
      } else if (profileId === 'slowed') {
        await invoke('set_dsp_params', {
          engine: 'RubberBand',
          pitchSemitones: -1.5,
          tempoRatio: 0.84,
          rateRatio: 0.84,
        });
        const ambientBands = [2.5, 2.0, 1.0, 0, 0, 0, -1.0, -1.5, -2.0, -2.5];
        await invoke('set_equalizer_params', { enabled: true, bands: ambientBands });
        await invoke('set_stereo_widener', { active: true, amount: 0.55 });
        vinylSimulator.setEnabled(false);
        setStatus((prev) => ({
          ...prev,
          engine: 'RubberBand',
          pitch_semitones: -1.5,
          tempo_ratio: 0.84,
          rate_ratio: 0.84,
          equalizer_enabled: true,
          equalizer_bands: ambientBands,
        }));
        showMessage('🌌 Zastosowano profil: Ambient Slowed & Space (0.84x, -1.5 st, Wide M/S)');
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Zapis zakładki dla aktywnego utworu
  const handleSaveBookmark = async () => {
    if (!activeTrackId) {
      showMessage(loc.notifications.firstSelectTrack, true);
      return;
    }
    try {
      await invoke('save_bookmark', {
        trackId: activeTrackId,
        positionMs: status.position_ms,
      });
      setCurrentBookmark(status.position_ms);
      showMessage(loc.notifications.bookmarkSaved.replace('{0}', formatTimeMs(status.position_ms)));
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Usunięcie zakładki dla aktywnego utworu
  const handleDeleteBookmark = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeTrackId) return;
    try {
      await invoke('delete_bookmark', { trackId: activeTrackId });
      setCurrentBookmark(null);
      showMessage(loc.player.bookmarkDeleted);
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Skok do zapisanej zakładki
  const handleJumpToBookmark = async (pos: number) => {
    await handleSeek(pos);
    showMessage(loc.player.bookmarkJump.replace('{0}', formatTime(pos)));
  };

  // Reset licznika odtworzeń utworu
  const handleResetTrackPlays = async (trackId: number) => {
    try {
      await invoke('reset_track_plays', { trackId });
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, play_count: 0, last_played_at: null }
            : t
        )
      );
      if (statsModalTrack && statsModalTrack.id === trackId) {
        setStatsModalTrack((prev: TrackStatsData | null) => (prev ? { ...prev, play_count: 0, last_played_at: null } : null));
      }
      showMessage(loc.notifications.trackStatsReset);
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  };

  // Otwarcie folderu nadrzędnego
  const handleOpenContainingFolder = async (rawPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!rawPath) return;
    try {
      const folder = await invoke<string>('open_containing_folder', { filePath: rawPath });
      showMessage(loc.notifications.openedFolder.replace('{0}', folder));
    } catch (err: any) {
      console.error('Failed to open containing folder:', err);
      showMessage(loc.notifications.openFolderError.replace('{0}', String(err)), true);
    }
  };

  // Ustawienie oceny gwiazdkowej (0-5)
  const handleSetTrackRating = async (trackId: number, rating: number) => {
    try {
      await invoke('set_track_rating', { trackId, rating });
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, rating } : t))
      );
    } catch (err: any) {
      console.error('Błąd zapisu oceny utworu:', err);
    }
  };

  // Funkcja przełączania ulubionego (Favorites ❤️)
  const handleToggleFavorite = async (trackId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const isFav = await invoke<boolean>('toggle_favorite', { trackId });
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, is_favorite: isFav } : t))
      );
      showMessage(isFav ? loc.notifications.addedFavorite : loc.notifications.removedFavorite);
    } catch (err) {
      console.error('Błąd przełączania ulubionego:', err);
    }
  };

  return {
    handleLoadFile,
    handlePickFiles,
    handleDropPaths,
    handlePlayLibraryTrack,
    handlePlayAlbum,
    handleAddAlbumToQueue,
    handleShuffleAll,
    handleApplySignatureProfile,
    handleSaveBookmark,
    handleDeleteBookmark,
    handleJumpToBookmark,
    handleResetTrackPlays,
    handleOpenContainingFolder,
    handleSetTrackRating,
    handleToggleFavorite,
  };
}
