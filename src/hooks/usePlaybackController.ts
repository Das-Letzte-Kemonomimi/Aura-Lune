import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '../api/ipc';
import { setSetting } from '../api/settings';
import { livePlayback } from '../state/livePlayback';
import { shouldCommitStatus } from '../state/statusCommit';
import { useTauriEvent } from './useTauriEvent';
import type { PlaybackStatus } from '../types/playback';
import type { PlaybackQueue, QueueItem } from '../types/queue';
import type { TrackRecord, AlbumRecord } from '../types/library';
import type { TrackBookmarkDto } from '../types/player';
import type { Translations } from '../i18n';
import { fmt } from '../utils/fmt';

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
  instantVolume?: boolean;
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

/** Engine ramp for "instant" volume: short enough to feel immediate, long enough to avoid clicks. */
export const INSTANT_VOLUME_RAMP_MS = 15;
/** The volume is saved this long after the last change, so a drag writes the database once. */
export const VOLUME_SAVE_DEBOUNCE_MS = 750;

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
  instantVolume = true,
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
  const instantVolumeRef = useRef<boolean>(instantVolume);
  useEffect(() => {
    instantVolumeRef.current = instantVolume;
  }, [instantVolume]);
  const smoothVolumeAnimRef = useRef<number | null>(null);

  // User gesture interaction guards to eliminate UI lag & rubberbanding
  const isSeekingRef = useRef<boolean>(false);
  const seekReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVolumeInteractingRef = useRef<boolean>(false);
  const volumeInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeThrottleTimerRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  const pendingVolumeRef = useRef<number | null>(null);
  const volumeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const pollingDepsRef = useRef({
    tracks,
    albums,
    listenbrainzEnabled,
    listenbrainzToken,
    scrobbledTrackId,
    setScrobbledTrackId,
    lastfmEnabled,
    lastfmSessionKey,
    lastfmCustomKey,
    lastfmCustomSecret,
    lastfmScrobbledTrackId,
    setLastfmScrobbledTrackId,
    showMessage,
    loc,
    setStatus,
    setFilePath,
    setActiveTrackId,
    setReplaygainStatus,
    setTracks,
    initialStartupPositionRef,
  });

  useEffect(() => {
    pollingDepsRef.current = {
      tracks,
      albums,
      listenbrainzEnabled,
      listenbrainzToken,
      scrobbledTrackId,
      setScrobbledTrackId,
      lastfmEnabled,
      lastfmSessionKey,
      lastfmCustomKey,
      lastfmCustomSecret,
      lastfmScrobbledTrackId,
      setLastfmScrobbledTrackId,
      showMessage,
      loc,
      setStatus,
      setFilePath,
      setActiveTrackId,
      setReplaygainStatus,
      setTracks,
      initialStartupPositionRef,
    };
  });

  // Clean up volume animation & timers on unmount
  useEffect(() => {
    return () => {
      if (smoothVolumeAnimRef.current) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(smoothVolumeAnimRef.current);
        } else {
          clearTimeout(smoothVolumeAnimRef.current);
        }
      }
      if (volumeThrottleTimerRef.current) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(volumeThrottleTimerRef.current);
        } else {
          clearTimeout(volumeThrottleTimerRef.current);
        }
      }
      if (volumeInteractionTimerRef.current) {
        clearTimeout(volumeInteractionTimerRef.current);
      }
      // Quitting saves the engine volume anyway (src-tauri/src/setup/shutdown.rs).
      if (volumeSaveTimerRef.current) {
        clearTimeout(volumeSaveTimerRef.current);
      }
    };
  }, []);

  // 1. Playback status: the backend (setup/playback_ticker.rs) emits the
  //    `auralune://playback-status` event ~10×/s while playing and ~4×/s while paused.
  //    The position and spectrum go to `livePlayback` on every frame; the React state is
  //    updated only on meaningful changes (`shouldCommitStatus`).
  const loopPointsRef = useRef<{ a: number | null; b: number | null }>({ a: null, b: null });
  useEffect(() => {
    loopPointsRef.current = { a: loopPointA, b: loopPointB };
  }, [loopPointA, loopPointB]);
  const loopSeekPendingRef = useRef(false);
  const handleSeekRef = useRef<((val: number) => Promise<void>) | null>(null);
  const lastStatusEventAtRef = useRef(0);

  const applyStatus = useCallback((res: PlaybackStatus) => {
    const {
      tracks: currentTracks,
      albums: currentAlbums,
      listenbrainzEnabled: lbEnabled,
      listenbrainzToken: lbToken,
      scrobbledTrackId: curScrobbledTrackId,
      setScrobbledTrackId: curSetScrobbledTrackId,
      lastfmEnabled: lfEnabled,
      lastfmSessionKey: lfSessionKey,
      lastfmCustomKey: lfCustomKey,
      lastfmCustomSecret: lfCustomSecret,
      lastfmScrobbledTrackId: curLastfmScrobbledTrackId,
      setLastfmScrobbledTrackId: curSetLastfmScrobbledTrackId,
      showMessage: curShowMessage,
      loc: curLoc,
      setStatus: curSetStatus,
      setFilePath: curSetFilePath,
      setActiveTrackId: curSetActiveTrackId,
      setReplaygainStatus: curSetReplaygainStatus,
      setTracks: curSetTracks,
      initialStartupPositionRef: curInitialStartupPositionRef,
    } = pollingDepsRef.current;

    // "Live" frame: the position (unless the user is dragging the slider) and the spectrum.
    if (!isSeekingRef.current) {
      // After start-up (Stopped state) the UI shows the resume position from the saved session.
      const resumePos = pollingDepsRef.current.initialStartupPositionRef.current;
      const livePos = res.state === 'Stopped' && resumePos !== null ? resumePos : res.position_ms;
      livePlayback.publish({ positionMs: livePos, spectrum: res.spectrum });
      statusRef.current = {
        ...statusRef.current,
        ...res,
        volume: isVolumeInteractingRef.current ? statusRef.current.volume : res.volume,
      };
    } else if (res.spectrum) {
      livePlayback.publish({ spectrum: res.spectrum });
    }

    // The A-B loop is checked on every frame (~100 ms accuracy).
    const { a: loopA, b: loopB } = loopPointsRef.current;
    if (loopA !== null && loopB !== null && loopB > loopA && res.state === 'Playing') {
      if (res.position_ms >= loopB && !loopSeekPendingRef.current) {
        loopSeekPendingRef.current = true;
        handleSeekRef.current?.(loopA);
      } else if (res.position_ms < loopB) {
        loopSeekPendingRef.current = false;
      }
    }

    curSetStatus((prev) => {
      // If the user is actively dragging the seek slider, preserve local position
      const targetPosition = isSeekingRef.current ? prev.position_ms : res.position_ms;
      // If the user is actively sliding volume, preserve local volume
      const targetVolume = isVolumeInteractingRef.current ? prev.volume : res.volume;

      if (res.state === 'Stopped' && curInitialStartupPositionRef.current !== null && prev.current_track) {
        return {
          ...res,
          position_ms: curInitialStartupPositionRef.current,
          duration_ms: prev.duration_ms || res.duration_ms,
          current_track: prev.current_track,
          volume: targetVolume,
        };
      }
      const merged = {
        ...res,
        position_ms: targetPosition,
        volume: targetVolume,
      };
      return shouldCommitStatus(prev, merged) ? merged : prev;
    });

    if (res.replaygain_status) {
      curSetReplaygainStatus(res.replaygain_status);
    }

    if (res.current_track) {
      if (res.current_track.uri) {
        const trackUri = res.current_track.uri;
        curSetFilePath(trackUri);
      }
      if (res.current_track.track_id) {
        const trackId = res.current_track.track_id;
        curSetActiveTrackId(trackId);

        // Listening time (Recap) is counted by the backend playback ticker.

        // Loop detection
        if (res.position_ms < 3000 && lastTrackPositionMsRef.current > 5000) {
          lastRecordedTrackRef.current.recorded = false;
          if (curSetScrobbledTrackId) curSetScrobbledTrackId(null);
          if (curSetLastfmScrobbledTrackId) curSetLastfmScrobbledTrackId(null);
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
            console.warn('Failed to record the play:', e)
          );
          curSetTracks((prev) =>
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
          lbEnabled &&
          lbToken &&
          curScrobbledTrackId !== trackId &&
          res.duration_ms &&
          res.duration_ms >= 30000 &&
          res.position_ms >= Math.min(res.duration_ms * 0.5, 240000)
        ) {
          if (curSetScrobbledTrackId) curSetScrobbledTrackId(trackId);
          const currentTrackObj = currentTracks.find((t) => t.id === trackId);
          if (currentTrackObj) {
            const trackAlb = currentTrackObj.album_id
              ? currentAlbums.find((a) => a.id === currentTrackObj.album_id)?.title
              : null;
            invoke('submit_listenbrainz_listen', {
              token: lbToken,
              artist: currentTrackObj.artist,
              title: currentTrackObj.title,
              album: trackAlb || null,
              durationMs: currentTrackObj.duration_ms || null,
              listenedAt: Math.floor(Date.now() / 1000),
            })
              .then(() => {
                curShowMessage(fmt(curLoc.notifications.scrobbledListenbrainz, currentTrackObj.title));
              })
              .catch((e) => console.warn('Failed to send the scrobble:', e));
          }
        }

        // Last.fm scrobbler
        if (
          res.state === 'Playing' &&
          lfEnabled &&
          lfSessionKey &&
          curLastfmScrobbledTrackId !== trackId &&
          res.duration_ms &&
          res.duration_ms >= 30000 &&
          res.position_ms >= Math.min(res.duration_ms * 0.5, 240000)
        ) {
          if (curSetLastfmScrobbledTrackId) curSetLastfmScrobbledTrackId(trackId);
          const currentTrackObj = currentTracks.find((t) => t.id === trackId);
          if (currentTrackObj) {
            const trackAlb = currentTrackObj.album_id
              ? currentAlbums.find((a) => a.id === currentTrackObj.album_id)?.title
              : null;
            invoke('lastfm_scrobble', {
              request: {
                session_key: lfSessionKey,
                artist: currentTrackObj.artist,
                track: currentTrackObj.title,
                album: trackAlb || null,
                timestamp: Math.floor(Date.now() / 1000),
                duration_sec: currentTrackObj.duration_ms
                  ? Math.round(currentTrackObj.duration_ms / 1000)
                  : null,
                api_key: lfCustomKey.trim() || null,
                api_secret: lfCustomSecret.trim() || null,
              },
            })
              .then(() => {
                curShowMessage(fmt(curLoc.notifications.scrobbledLastfm, currentTrackObj.title));
              })
              .catch((e) => console.warn('Failed to send the Last.fm scrobble:', e));
          }
        }
      }
    }
  }, []);

  useTauriEvent<PlaybackStatus>('auralune://playback-status', (res) => {
    lastStatusEventAtRef.current = Date.now();
    applyStatus(res);
  });

  // Start-up and fallback: the first status is fetched right away; if events stop
  // arriving (e.g. an environment without the ticker), the status is polled once a second.
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = () => {
      invoke<PlaybackStatus>('get_status')
        .then((res) => {
          if (!cancelled && res) applyStatus(res);
        })
        .catch(() => {
          // The backend is still initialising
        });
    };
    fetchOnce();
    const watchdog = setInterval(() => {
      if (Date.now() - lastStatusEventAtRef.current > 1500) fetchOnce();
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(watchdog);
      if (seekReleaseTimerRef.current) clearTimeout(seekReleaseTimerRef.current);
      if (volumeInteractionTimerRef.current) clearTimeout(volumeInteractionTimerRef.current);
      if (volumeThrottleTimerRef.current) clearTimeout(volumeThrottleTimerRef.current);
    };
  }, [applyStatus]);

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
      livePlayback.publish({ positionMs: val });
    },
    []
  );

  const handleSeekCommit = useCallback(
    async (val: number, fade?: boolean) => {
      initialStartupPositionRef.current = null;
      isSeekingRef.current = true;
      if (seekReleaseTimerRef.current) {
        clearTimeout(seekReleaseTimerRef.current);
      }
      livePlayback.publish({ positionMs: val });
      setStatus((prev) => ({ ...prev, position_ms: val }));
      try {
        const shouldFade = typeof fade === 'boolean' ? fade : seekFadeEnabled;
        await invoke('seek', { positionMs: val, fade: shouldFade });
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      } finally {
        seekReleaseTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
          seekReleaseTimerRef.current = null;
        }, 200);
      }
    },
    [initialStartupPositionRef, setStatus, showMessage, loc, seekFadeEnabled]
  );

  const handleSeek = useCallback(
    async (val: number) => {
      return handleSeekCommit(val, seekFadeEnabled);
    },
    [handleSeekCommit, seekFadeEnabled]
  );

  useEffect(() => {
    handleSeekRef.current = handleSeek;
  }, [handleSeek]);

  // 4. Transport Actions
  const handlePlayPause = useCallback(async () => {
    try {
      if (status.state === 'Playing') {
        await invoke('pause');
      } else {
        const currentUri = status.current_track?.uri || filePath;
        const targetResumePos = initialStartupPositionRef.current;
        // Only load if the engine has no loaded track duration yet (e.g. UI-only session restore).
        // Reloading unconditionally when `targetResumePos` is set would wipe the backend's position.
        const needsLoad =
          Boolean(currentUri) &&
          !status.current_track?.duration_ms &&
          (!status.duration_ms || status.duration_ms === 0);
        if (needsLoad && currentUri) {
          try {
            await invoke('load_file', { path: currentUri });
          } catch (loadErr) {
            console.warn('load_file pre-check warning:', loadErr);
          }
        }
        if (targetResumePos && targetResumePos > 1000) {
          try {
            await invoke('seek', { positionMs: targetResumePos, fade: false });
          } catch (seekErr) {
            console.warn('Seek to restored position error:', seekErr);
          }
        }
        initialStartupPositionRef.current = null;
        await invoke('play');
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [status, filePath, initialStartupPositionRef, showMessage, loc]);

  const handleStop = useCallback(async () => {
    try {
      await invoke('stop');
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [showMessage, loc]);

  const handleVolumeChange = useCallback(
    (volume: number, immediate = false) => {
      const clamped = Math.max(0, Math.min(1.0, volume));
      const isInstant = instantVolumeRef.current;

      isVolumeInteractingRef.current = true;
      if (volumeInteractionTimerRef.current) {
        clearTimeout(volumeInteractionTimerRef.current);
      }
      volumeInteractionTimerRef.current = setTimeout(() => {
        isVolumeInteractingRef.current = false;
        volumeInteractionTimerRef.current = null;
      }, 400);

      // Persist while running, not only on quit: a crash or a kill keeps the last level.
      if (volumeSaveTimerRef.current) {
        clearTimeout(volumeSaveTimerRef.current);
      }
      volumeSaveTimerRef.current = setTimeout(() => {
        volumeSaveTimerRef.current = null;
        setSetting('playback_volume', String(clamped)).catch((e: unknown) => {
          console.warn('Failed to save the volume:', e);
        });
      }, VOLUME_SAVE_DEBOUNCE_MS);

      // Cancel any ongoing smooth animation to prevent jitter
      if (smoothVolumeAnimRef.current) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(smoothVolumeAnimRef.current);
        } else {
          clearTimeout(smoothVolumeAnimRef.current);
        }
        smoothVolumeAnimRef.current = null;
      }

      if (isInstant) {
        // Mode 1: Instant Response (direct, zero-delay IPC & optimistic UI update)
        setStatus((prev) => ({ ...prev, volume: clamped }));

        if (immediate) {
          if (volumeThrottleTimerRef.current) {
            if (typeof cancelAnimationFrame !== 'undefined') {
              cancelAnimationFrame(volumeThrottleTimerRef.current);
            } else {
              clearTimeout(volumeThrottleTimerRef.current);
            }
            volumeThrottleTimerRef.current = null;
          }
          pendingVolumeRef.current = null;
          invoke('set_volume', { volume: clamped, smooth: true, fadeMs: INSTANT_VOLUME_RAMP_MS }).catch((e: unknown) => {
            showMessage(`${loc.common.errorPrefix} ${e}`, true);
          });
          return;
        }

        // Display-synced high-frequency dispatch (0ms initial, coalesced intermediate moves)
        pendingVolumeRef.current = clamped;
        if (!volumeThrottleTimerRef.current) {
          invoke('set_volume', { volume: clamped, smooth: true, fadeMs: INSTANT_VOLUME_RAMP_MS }).catch((e: unknown) => {
            showMessage(`${loc.common.errorPrefix} ${e}`, true);
          });
          const scheduleNext = typeof requestAnimationFrame !== 'undefined'
            ? requestAnimationFrame
            : (cb: () => void) => setTimeout(cb, 16);

          volumeThrottleTimerRef.current = scheduleNext(() => {
            volumeThrottleTimerRef.current = null;
            if (pendingVolumeRef.current !== null && pendingVolumeRef.current !== clamped) {
              const latestVol = pendingVolumeRef.current;
              pendingVolumeRef.current = null;
              invoke('set_volume', { volume: latestVol, smooth: true, fadeMs: INSTANT_VOLUME_RAMP_MS }).catch((e: unknown) => {
                showMessage(`${loc.common.errorPrefix} ${e}`, true);
              });
            }
          });
        }
      } else {
        // Mode 2: Smooth Fade (soft S-curve ramping avoiding digital pops and zipper noise)
        if (immediate) {
          if (volumeThrottleTimerRef.current) {
            if (typeof cancelAnimationFrame !== 'undefined') {
              cancelAnimationFrame(volumeThrottleTimerRef.current);
            } else {
              clearTimeout(volumeThrottleTimerRef.current);
            }
            volumeThrottleTimerRef.current = null;
          }
          pendingVolumeRef.current = null;

          // Backend smoothly ramps over 120ms
          invoke('set_volume', { volume: clamped, smooth: true, fadeMs: 120 }).catch((e: unknown) => {
            showMessage(`${loc.common.errorPrefix} ${e}`, true);
          });

          // Frontend smoothly animates the visual slider position
          const startVol = statusRef.current.volume;
          const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const duration = 120;

          if (Math.abs(startVol - clamped) > 0.01 && typeof requestAnimationFrame !== 'undefined') {
            const animate = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(1, elapsed / duration);
              // Cosine S-curve easing
              const factor = 0.5 * (1 - Math.cos(Math.PI * progress));
              const currentVal = startVol + (clamped - startVol) * factor;
              setStatus((prev) => ({ ...prev, volume: currentVal }));
              if (progress < 1) {
                smoothVolumeAnimRef.current = requestAnimationFrame(animate);
              } else {
                setStatus((prev) => ({ ...prev, volume: clamped }));
                smoothVolumeAnimRef.current = null;
              }
            };
            smoothVolumeAnimRef.current = requestAnimationFrame(animate);
          } else {
            setStatus((prev) => ({ ...prev, volume: clamped }));
          }
          return;
        }

        // When dragging in smooth mode, UI tracks cursor directly while engine micro-eases
        setStatus((prev) => ({ ...prev, volume: clamped }));
        pendingVolumeRef.current = clamped;
        if (!volumeThrottleTimerRef.current) {
          invoke('set_volume', { volume: clamped, smooth: true, fadeMs: 60 }).catch((e: unknown) => {
            showMessage(`${loc.common.errorPrefix} ${e}`, true);
          });
          const scheduleNext = typeof requestAnimationFrame !== 'undefined'
            ? requestAnimationFrame
            : (cb: () => void) => setTimeout(cb, 20);

          volumeThrottleTimerRef.current = scheduleNext(() => {
            volumeThrottleTimerRef.current = null;
            if (pendingVolumeRef.current !== null && pendingVolumeRef.current !== clamped) {
              const latestVol = pendingVolumeRef.current;
              pendingVolumeRef.current = null;
              invoke('set_volume', { volume: latestVol, smooth: true, fadeMs: 60 }).catch((e: unknown) => {
                showMessage(`${loc.common.errorPrefix} ${e}`, true);
              });
            }
          });
        }
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
        showMessage(fmt(loc.notifications.nextTrackMsg, nextItem.title));
        if (nextItem.uri) setFilePath(nextItem.uri);
        if (nextItem.track_id) setActiveTrackId(nextItem.track_id);
      } else {
        showMessage(loc.notifications.queueEndMsg);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [refreshQueue, setFilePath, setActiveTrackId, showMessage, loc]);

  const handlePrevious = useCallback(async () => {
    try {
      const prevItem = await invoke<QueueItem | null>('play_previous');
      await refreshQueue();
      if (prevItem) {
        showMessage(fmt(loc.notifications.prevTrackMsg, prevItem.title));
        if (prevItem.uri) setFilePath(prevItem.uri);
        if (prevItem.track_id) setActiveTrackId(prevItem.track_id);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [refreshQueue, setFilePath, setActiveTrackId, showMessage, loc]);

  const handleToggleShuffle = useCallback(async () => {
    try {
      const newShuffle = await invoke<boolean>('toggle_shuffle');
      await refreshQueue();
      showMessage(newShuffle ? loc.notifications.shuffleOnMsg : loc.notifications.shuffleOffMsg);
    } catch (e: unknown) {
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
      showMessage(fmt(loc.notifications.loopModeMsg, loopLabel));
    } catch (e: unknown) {
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
    } catch (e: unknown) {
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
