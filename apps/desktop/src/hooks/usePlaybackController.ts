import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlaybackStatus } from '../types/playback';
import type { PlaybackQueue, QueueItem } from '../types/queue';
import type { TrackRecord, AlbumRecord } from '../types/library';
import type { TrackBookmarkDto } from '../components/modals/TrackBookmarksModal';
import type { Translations } from '../i18n';

export interface UsePlaybackControllerOptions {
  status: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  filePath: string | null;
  setFilePath: (path: string) => void;
  activeTrackId: number | null;
  setActiveTrackId: React.Dispatch<React.SetStateAction<number | null>>;
  queue: PlaybackQueue;
  refreshQueue: () => Promise<void>;
  seekFadeEnabled: boolean;
  initialStartupPositionRef: React.MutableRefObject<number | null>;
  tracks: TrackRecord[];
  setTracks: React.Dispatch<React.SetStateAction<TrackRecord[]>>;
  albums: AlbumRecord[];
  setReplaygainStatus: React.Dispatch<React.SetStateAction<[number, number, boolean]>>;
  listenbrainzEnabled?: boolean;
  listenbrainzToken?: string;
  scrobbledTrackId?: number | null;
  setScrobbledTrackId?: React.Dispatch<React.SetStateAction<number | null>>;
  lastfmEnabled?: boolean;
  lastfmSessionKey?: string;
  lastfmCustomKey?: string;
  lastfmCustomSecret?: string;
  lastfmScrobbledTrackId?: number | null;
  setLastfmScrobbledTrackId?: React.Dispatch<React.SetStateAction<number | null>>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function usePlaybackController({
  status,
  setStatus,
  filePath,
  setFilePath,
  activeTrackId,
  setActiveTrackId,
  queue,
  refreshQueue,
  seekFadeEnabled,
  initialStartupPositionRef,
  tracks,
  setTracks,
  albums,
  setReplaygainStatus,
  listenbrainzEnabled = false,
  listenbrainzToken = '',
  scrobbledTrackId = null,
  setScrobbledTrackId,
  lastfmEnabled = false,
  lastfmSessionKey = '',
  lastfmCustomKey = '',
  lastfmCustomSecret = '',
  lastfmScrobbledTrackId = null,
  setLastfmScrobbledTrackId,
  showMessage,
  loc,
}: UsePlaybackControllerOptions) {
  // Volume reference for mute/unmute
  const lastNonZeroVolRef = useRef<number>(1.0);

  // User gesture interaction guards to eliminate UI lag & rubberbanding
  const isSeekingRef = useRef<boolean>(false);
  const seekReleaseTimerRef = useRef<any>(null);
  const isVolumeInteractingRef = useRef<boolean>(false);
  const volumeInteractionTimerRef = useRef<any>(null);
  const volumeThrottleTimerRef = useRef<any>(null);
  const pendingVolumeRef = useRef<number | null>(null);

  // A-B Repeat Loop State
  const [loopPointA, setLoopPointA] = useState<number | null>(null);
  const [loopPointB, setLoopPointB] = useState<number | null>(null);
  const [isLoopEditorOpen, setIsLoopEditorOpen] = useState(false);

  // Track Bookmarks State
  const [currentBookmark, setCurrentBookmark] = useState<number | null>(null);
  const [currentTrackBookmarks, setCurrentTrackBookmarks] = useState<TrackBookmarkDto[]>([]);
  const [isBookmarksModalOpen, setIsBookmarksModalOpen] = useState(false);

  // Stats / Recap tracking refs
  const lastRecordedTrackRef = useRef<{ id: number; recorded: boolean }>({ id: -1, recorded: false });
  const lastTrackPositionMsRef = useRef<number>(0);
  const lastListeningTickRef = useRef<number>(Date.now());
  const statusRef = useRef(status);
  statusRef.current = status;

  // 1. Status Polling Loop (Adaptive: 100ms when Playing, 350ms when idle/paused)
  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await invoke<PlaybackStatus>('get_status');
        setStatus((prev) => {
          // If the user is actively dragging the seek slider, preserve local position
          const targetPosition = isSeekingRef.current ? prev.position_ms : res.position_ms;
          // If the user is actively sliding volume, preserve local volume
          const targetVolume = isVolumeInteractingRef.current ? prev.volume : res.volume;

          if (res.state === 'Stopped' && initialStartupPositionRef.current !== null && prev.current_track) {
            return {
              ...res,
              position_ms: initialStartupPositionRef.current,
              duration_ms: prev.duration_ms || res.duration_ms,
              current_track: prev.current_track,
              volume: targetVolume,
            };
          }
          if (
            prev.state === res.state &&
            res.state !== 'Playing' &&
            prev.current_track?.track_id === res.current_track?.track_id &&
            prev.position_ms === targetPosition &&
            prev.volume === targetVolume &&
            prev.tempo_ratio === res.tempo_ratio &&
            prev.pitch_semitones === res.pitch_semitones &&
            prev.equalizer_enabled === res.equalizer_enabled &&
            JSON.stringify(prev.equalizer_bands) === JSON.stringify(res.equalizer_bands)
          ) {
            return prev;
          }
          return {
            ...res,
            position_ms: targetPosition,
            volume: targetVolume,
          };
        });

        if (res.replaygain_status) {
          setReplaygainStatus(res.replaygain_status);
        }

        if (res.current_track) {
          if (res.current_track.uri) {
            const trackUri = res.current_track.uri;
            setFilePath(trackUri);
          }
          if (res.current_track.track_id) {
            const trackId = res.current_track.track_id;
            setActiveTrackId(trackId);

            // Record actual listening time (Recap & Stats)
            if (res.state === 'Playing') {
              const now = Date.now();
              const elapsed = now - lastListeningTickRef.current;
              if (elapsed >= 5000 && elapsed < 30000) {
                lastListeningTickRef.current = now;
                invoke('record_track_listening', { trackId, durationMs: elapsed }).catch(() => { });
              } else if (elapsed >= 30000) {
                lastListeningTickRef.current = now;
              }
            } else {
              lastListeningTickRef.current = Date.now();
            }

            // Loop detection
            if (res.position_ms < 3000 && lastTrackPositionMsRef.current > 5000) {
              lastRecordedTrackRef.current.recorded = false;
              if (setScrobbledTrackId) setScrobbledTrackId(null);
              if (setLastfmScrobbledTrackId) setLastfmScrobbledTrackId(null);
              invoke('notify_track_looped', { positionMs: res.position_ms }).catch(() => { });
            }
            lastTrackPositionMsRef.current = res.position_ms;

            const playThresholdMs = Math.min(
              15000,
              res.duration_ms && res.duration_ms > 0 ? res.duration_ms * 0.5 : 15000
            );

            if (lastRecordedTrackRef.current.id !== trackId) {
              lastRecordedTrackRef.current = { id: trackId, recorded: false };
            } else if (
              !lastRecordedTrackRef.current.recorded &&
              res.state === 'Playing' &&
              res.position_ms >= playThresholdMs
            ) {
              lastRecordedTrackRef.current.recorded = true;
              invoke('record_track_play', { trackId }).catch((e) =>
                console.warn('Błąd zapisu odtworzenia:', e)
              );
              setTracks((prev) =>
                prev.map((t) =>
                  t.id === trackId
                    ? {
                        ...t,
                        play_count: (t.play_count || 0) + 1,
                        last_played_at: Math.floor(Date.now() / 1000),
                      }
                    : t
                )
              );
            }

            // ListenBrainz scrobbler
            if (
              res.state === 'Playing' &&
              listenbrainzEnabled &&
              listenbrainzToken &&
              scrobbledTrackId !== trackId &&
              res.duration_ms &&
              res.duration_ms >= 30000 &&
              res.position_ms >= Math.min(res.duration_ms * 0.5, 240000)
            ) {
              if (setScrobbledTrackId) setScrobbledTrackId(trackId);
              const currentTrackObj = tracks.find((t) => t.id === trackId);
              if (currentTrackObj) {
                const trackAlb = currentTrackObj.album_id
                  ? albums.find((a) => a.id === currentTrackObj.album_id)?.title
                  : null;
                invoke('submit_listenbrainz_listen', {
                  token: listenbrainzToken,
                  artist: currentTrackObj.artist,
                  title: currentTrackObj.title,
                  album: trackAlb || null,
                  durationMs: currentTrackObj.duration_ms || null,
                  listenedAt: Math.floor(Date.now() / 1000),
                })
                  .then(() => {
                    showMessage(loc.notifications.scrobbledListenbrainz.replace('{0}', currentTrackObj.title));
                  })
                  .catch((e) => console.warn('Błąd wysyłania scrobble:', e));
              }
            }

            // Last.fm scrobbler
            if (
              res.state === 'Playing' &&
              lastfmEnabled &&
              lastfmSessionKey &&
              lastfmScrobbledTrackId !== trackId &&
              res.duration_ms &&
              res.duration_ms >= 30000 &&
              res.position_ms >= Math.min(res.duration_ms * 0.5, 240000)
            ) {
              if (setLastfmScrobbledTrackId) setLastfmScrobbledTrackId(trackId);
              const currentTrackObj = tracks.find((t) => t.id === trackId);
              if (currentTrackObj) {
                const trackAlb = currentTrackObj.album_id
                  ? albums.find((a) => a.id === currentTrackObj.album_id)?.title
                  : null;
                invoke('lastfm_scrobble', {
                  request: {
                    session_key: lastfmSessionKey,
                    artist: currentTrackObj.artist,
                    track: currentTrackObj.title,
                    album: trackAlb || null,
                    timestamp: Math.floor(Date.now() / 1000),
                    duration_sec: currentTrackObj.duration_ms
                      ? Math.round(currentTrackObj.duration_ms / 1000)
                      : null,
                    api_key: lastfmCustomKey.trim() || null,
                    api_secret: lastfmCustomSecret.trim() || null,
                  },
                })
                  .then(() => {
                    showMessage(loc.notifications.scrobbledLastfm.replace('{0}', currentTrackObj.title));
                  })
                  .catch((e) => console.warn('Błąd wysyłania Last.fm scrobble:', e));
              }
            }
          }
        }
      } catch (_) {
        // Ignore backend initialisation errors
      } finally {
        if (isMounted) {
          const delay = statusRef.current?.state === 'Playing' ? 100 : 350;
          timeoutId = setTimeout(fetchStatus, delay);
        }
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (seekReleaseTimerRef.current) clearTimeout(seekReleaseTimerRef.current);
      if (volumeInteractionTimerRef.current) clearTimeout(volumeInteractionTimerRef.current);
      if (volumeThrottleTimerRef.current) clearTimeout(volumeThrottleTimerRef.current);
    };
  }, []);

  // 2. Track Bookmarks sync
  useEffect(() => {
    if (!activeTrackId) {
      setCurrentBookmark(null);
      setCurrentTrackBookmarks([]);
      return;
    }
    invoke<number | null>('get_bookmark', { trackId: activeTrackId })
      .then((b) => setCurrentBookmark(b ?? null))
      .catch(() => setCurrentBookmark(null));

    invoke<TrackBookmarkDto[]>('get_track_bookmarks', { trackId: activeTrackId })
      .then((bms) => setCurrentTrackBookmarks(bms ?? []))
      .catch(() => setCurrentTrackBookmarks([]));
  }, [activeTrackId]);

  const refreshTrackBookmarks = useCallback(() => {
    if (activeTrackId) {
      invoke<TrackBookmarkDto[]>('get_track_bookmarks', { trackId: activeTrackId })
        .then((bms) => setCurrentTrackBookmarks(bms ?? []))
        .catch(() => setCurrentTrackBookmarks([]));
    }
  }, [activeTrackId]);

  // 3. A-B Repeat Loop enforcement & Responsive Seeking
  const handleSeekPreview = useCallback(
    (val: number) => {
      isSeekingRef.current = true;
      if (seekReleaseTimerRef.current) {
        clearTimeout(seekReleaseTimerRef.current);
        seekReleaseTimerRef.current = null;
      }
      setStatus((prev) => ({ ...prev, position_ms: val }));
    },
    [setStatus]
  );

  const handleSeekCommit = useCallback(
    async (val: number, fade?: boolean) => {
      isSeekingRef.current = true;
      if (seekReleaseTimerRef.current) {
        clearTimeout(seekReleaseTimerRef.current);
      }
      setStatus((prev) => ({ ...prev, position_ms: val }));
      try {
        const shouldFade = typeof fade === 'boolean' ? fade : seekFadeEnabled;
        await invoke('seek', { positionMs: val, fade: shouldFade });
      } catch (e: any) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      } finally {
        seekReleaseTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
          seekReleaseTimerRef.current = null;
        }, 200);
      }
    },
    [setStatus, showMessage, loc, seekFadeEnabled]
  );

  const handleSeek = useCallback(
    async (val: number) => {
      return handleSeekCommit(val, seekFadeEnabled);
    },
    [handleSeekCommit, seekFadeEnabled]
  );

  useEffect(() => {
    if (
      loopPointA !== null &&
      loopPointB !== null &&
      loopPointB > loopPointA &&
      status.state === 'Playing' &&
      status.position_ms >= loopPointB
    ) {
      handleSeek(loopPointA);
    }
  }, [status.position_ms, status.state, loopPointA, loopPointB, handleSeek]);

  // 4. Transport Actions
  const handlePlayPause = useCallback(async () => {
    try {
      if (status.state === 'Playing') {
        await invoke('pause');
      } else {
        const currentUri = status.current_track?.uri || filePath;
        const targetResumePos = initialStartupPositionRef.current;
        if (
          currentUri &&
          (!status.current_track?.duration_ms || status.duration_ms === 0 || targetResumePos !== null)
        ) {
          try {
            await invoke('load_file', { path: currentUri });
          } catch (loadErr) {
            console.warn('load_file pre-check warning:', loadErr);
          }
        }
        await invoke('play');
        if (targetResumePos && targetResumePos > 1000) {
          initialStartupPositionRef.current = null;
          setTimeout(async () => {
            try {
              await invoke('seek', { positionMs: targetResumePos, fade: false });
            } catch (seekErr) {
              console.warn('Seek to restored position error:', seekErr);
            }
          }, 150);
        }
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [status, filePath, initialStartupPositionRef, showMessage, loc]);

  const handleStop = useCallback(async () => {
    try {
      await invoke('stop');
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [showMessage, loc]);

  const handleVolumeChange = useCallback(
    (volume: number, immediate = false) => {
      const clamped = Math.max(0, Math.min(1.0, volume));
      isVolumeInteractingRef.current = true;
      if (volumeInteractionTimerRef.current) {
        clearTimeout(volumeInteractionTimerRef.current);
      }
      volumeInteractionTimerRef.current = setTimeout(() => {
        isVolumeInteractingRef.current = false;
        volumeInteractionTimerRef.current = null;
      }, 400);

      // Instant optimistic UI update
      setStatus((prev) => ({ ...prev, volume: clamped }));

      if (immediate) {
        if (volumeThrottleTimerRef.current) {
          clearTimeout(volumeThrottleTimerRef.current);
          volumeThrottleTimerRef.current = null;
        }
        pendingVolumeRef.current = null;
        invoke('set_volume', { volume: clamped }).catch((e: any) => {
          showMessage(`${loc.common.errorPrefix} ${e}`, true);
        });
        return;
      }

      // Non-blocking trailing-edge throttled IPC to prevent queue saturation
      pendingVolumeRef.current = clamped;
      if (!volumeThrottleTimerRef.current) {
        invoke('set_volume', { volume: clamped }).catch((e: any) => {
          showMessage(`${loc.common.errorPrefix} ${e}`, true);
        });
        volumeThrottleTimerRef.current = setTimeout(() => {
          volumeThrottleTimerRef.current = null;
          if (pendingVolumeRef.current !== null && pendingVolumeRef.current !== clamped) {
            const latestVol = pendingVolumeRef.current;
            pendingVolumeRef.current = null;
            invoke('set_volume', { volume: latestVol }).catch((e: any) => {
              showMessage(`${loc.common.errorPrefix} ${e}`, true);
            });
          }
        }, 30);
      }
    },
    [setStatus, showMessage, loc]
  );

  const handleToggleMute = useCallback(() => {
    const currentVol = statusRef.current.volume;
    if (currentVol > 0) {
      lastNonZeroVolRef.current = currentVol;
      handleVolumeChange(0, true);
    } else {
      handleVolumeChange(lastNonZeroVolRef.current || 1.0, true);
    }
  }, [handleVolumeChange]);

  const handleNext = useCallback(async () => {
    try {
      const nextItem = await invoke<QueueItem | null>('play_next');
      await refreshQueue();
      if (nextItem) {
        showMessage(loc.notifications.nextTrackMsg.replace('{0}', nextItem.title));
        if (nextItem.uri) setFilePath(nextItem.uri);
        if (nextItem.track_id) setActiveTrackId(nextItem.track_id);
      } else {
        showMessage(loc.notifications.queueEndMsg);
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [refreshQueue, setFilePath, setActiveTrackId, showMessage, loc]);

  const handlePrevious = useCallback(async () => {
    try {
      const prevItem = await invoke<QueueItem | null>('play_previous');
      await refreshQueue();
      if (prevItem) {
        showMessage(loc.notifications.prevTrackMsg.replace('{0}', prevItem.title));
        if (prevItem.uri) setFilePath(prevItem.uri);
        if (prevItem.track_id) setActiveTrackId(prevItem.track_id);
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [refreshQueue, setFilePath, setActiveTrackId, showMessage, loc]);

  const handleToggleShuffle = useCallback(async () => {
    try {
      const newShuffle = await invoke<boolean>('toggle_shuffle');
      await refreshQueue();
      showMessage(newShuffle ? loc.notifications.shuffleOnMsg : loc.notifications.shuffleOffMsg);
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [refreshQueue, showMessage, loc]);

  const handleCycleLoopMode = useCallback(async () => {
    try {
      const modes: ('None' | 'Queue' | 'Track')[] = ['None', 'Queue', 'Track'];
      const currentIdx = modes.indexOf(queue.loop_mode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      await invoke('set_loop_mode', { mode: nextMode });
      await refreshQueue();
      const loopLabel =
        nextMode === 'None'
          ? loc.queue.loopNone
          : nextMode === 'Track'
          ? loc.queue.loopTrack
          : loc.queue.loopQueue;
      showMessage(loc.notifications.loopModeMsg.replace('{0}', loopLabel));
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [queue.loop_mode, refreshQueue, showMessage, loc]);

  const handleToggleStopAfterCurrent = useCallback(async () => {
    try {
      const newVal = await invoke<boolean>('toggle_stop_after_current');
      setStatus((prev) => ({ ...prev, stop_after_current: newVal }));
      if (newVal) {
        showMessage(loc.notifications.stopAfterCurrentOn);
      } else {
        showMessage(loc.notifications.stopAfterCurrentOff);
      }
    } catch (e: any) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [setStatus, showMessage, loc]);

  return {
    handlePlayPause,
    handleStop,
    handleSeek,
    handleSeekPreview,
    handleSeekCommit,
    handleVolumeChange,
    handleToggleMute,
    handleNext,
    handlePrevious,
    handleCycleLoopMode,
    handleToggleShuffle,
    handleToggleStopAfterCurrent,
    loopPointA,
    setLoopPointA,
    loopPointB,
    setLoopPointB,
    isLoopEditorOpen,
    setIsLoopEditorOpen,
    currentBookmark,
    setCurrentBookmark,
    currentTrackBookmarks,
    setCurrentTrackBookmarks,
    isBookmarksModalOpen,
    setIsBookmarksModalOpen,
    refreshTrackBookmarks,
    lastNonZeroVolRef,
    statusRef,
  };
}
