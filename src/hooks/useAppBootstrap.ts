import { useState, useEffect, useRef } from 'react';
import { invoke } from '../api/ipc';
import { getSetting, setSetting } from '../api/settings';
import { clampPreampDb, parseFiniteSetting } from '../utils/preamp';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { isSupportedLanguage, loadLocale, type Language } from '../i18n';

export interface UseAppBootstrapOptions {
  refreshDevices: () => Promise<unknown> | unknown;
  loadLibrary: () => Promise<unknown> | unknown;
  loadThemes: () => Promise<unknown> | unknown;
  refreshQueue: () => Promise<unknown> | unknown;
  setAppVersion: (ver: string) => void;
  setLanguage: (lang: Language) => void;
  setSeekFadeEnabled: (enabled: boolean) => void;
  setCloseToTray: (enabled: boolean) => void;
  setAutoFetchCoversBg?: (enabled: boolean) => void;
  setCrossfadeDuration: (ms: number) => void;
  setBassBoost: (val: number) => void;
  setStereoWidenerActive: (active: boolean) => void;
  setStereoWidenerAmount: (amt: number) => void;
  setLimiterEnabled: (enabled: boolean) => void;
  setEqAutoStartup: (enabled: boolean) => void;
  handleDropPaths: (paths: string[]) => Promise<void>;
  stereoWidenerActive: boolean;
  stereoWidenerAmount: number;
}

/** Time window in which an identical drop from another event channel is ignored. */
const DUPLICATE_DROP_WINDOW_MS = 1000;

/** Maximum time the startup splash waits for IPC initializers before revealing the UI. */
export const BOOT_SAFETY_TIMEOUT_MS = 4500;

/** Fade-out duration for the startup splash overlay before unmounting. */
export const BOOT_EXIT_DURATION_MS = 280;

export type BootStage =
  | 'themes'
  | 'settings'
  | 'devices'
  | 'queue'
  | 'library'
  | 'ready';

export interface BootState {
  isReady: boolean;
  isExiting: boolean;
  progress: number;
  stage: BootStage;
}

const BOOT_STAGE_ORDER: Exclude<BootStage, 'ready'>[] = [
  'themes',
  'settings',
  'devices',
  'queue',
  'library',
];

/**
 * Asks the Rust host to map the main window to the Wayland compositor for the first time.
 * Uses a double requestAnimationFrame so WebKitGTK has committed at least one full-size
 * composited frame before GTK calls gtk_widget_show.  Never awaited — fire-and-forget.
 */
function triggerWindowReveal(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      invoke('reveal_main_window').catch((e: unknown) => {
        console.warn('reveal_main_window failed:', e);
      });
    });
  });
}

export function useAppBootstrap({
  refreshDevices,
  loadLibrary,
  loadThemes,
  refreshQueue,
  setAppVersion,
  setLanguage,
  setSeekFadeEnabled,
  setCloseToTray,
  setAutoFetchCoversBg,
  setCrossfadeDuration,
  setBassBoost,
  setStereoWidenerActive,
  setStereoWidenerAmount,
  setLimiterEnabled,
  setEqAutoStartup,
  handleDropPaths,
  stereoWidenerActive,
  stereoWidenerAmount,
}: UseAppBootstrapOptions) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [bootState, setBootState] = useState<BootState>({
    isReady: false,
    isExiting: false,
    progress: 0,
    stage: 'themes',
  });

  // The latest drop handler; listeners are registered once, on mount.
  const handleDropPathsRef = useRef(handleDropPaths);
  useEffect(() => {
    handleDropPathsRef.current = handleDropPaths;
  }, [handleDropPaths]);

  // Initialise settings, services, the library, themes and the queue, and register drag & drop events
  useEffect(() => {
    let disposed = false;
    let bootFinished = false;
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const loadInitialSettings = () =>
      Promise.allSettled([
        getSetting('eq_enabled_on_startup')
          .then((val) => {
            if (!disposed) setEqAutoStartup(val === 'true');
          })
          .catch((e) => console.warn('Failed to read eq_enabled_on_startup:', e)),

        getSetting('app_language')
          .then(async (val) => {
            if (val && isSupportedLanguage(val)) {
              await loadLocale(val);
              if (!disposed) setLanguage(val);
            }
          })
          .catch((e) => console.warn('Failed to read app_language:', e)),

        getSetting('seek_fade_enabled')
          .then((val) => {
            if (!disposed && val !== null) {
              setSeekFadeEnabled(val === 'true');
            }
          })
          .catch((e) => console.warn('Failed to read seek_fade_enabled:', e)),

        getSetting('close_to_tray')
          .then((val) => {
            if (!disposed) setCloseToTray(val !== 'false');
          })
          .catch((e) => console.warn('Failed to read close_to_tray:', e)),

        getSetting('auto_fetch_covers_bg')
          .then((val) => {
            if (!disposed && setAutoFetchCoversBg) setAutoFetchCoversBg(val !== 'false');
          })
          .catch((e) => console.warn('Failed to read auto_fetch_covers_bg:', e)),

        getSetting('crossfade_duration')
          .then((val) => {
            const ms = val ? parseInt(val, 10) : 1500;
            if (!isNaN(ms)) {
              if (!disposed) setCrossfadeDuration(ms);
              invoke('set_crossfade_duration', { durationMs: ms }).catch(() => {});
            }
          })
          .catch((e) => console.warn('Failed to read crossfade_duration:', e)),

        getSetting('bass_boost')
          .then((val) => {
            if (!disposed && val) {
              const num = parseFloat(val);
              if (!isNaN(num)) {
                setBassBoost(num);
                invoke('set_bass_boost', { boostDb: num }).catch(() => {});
              }
            }
          })
          .catch((e) => console.warn('Failed to read bass_boost:', e)),

        getSetting('stereo_widener_active')
          .then((val) => {
            const active = val === 'true';
            if (!disposed) setStereoWidenerActive(active);
            invoke('set_stereo_widener', { active, amount: stereoWidenerAmount }).catch(() => {});
          })
          .catch((e) => console.warn('Failed to read stereo_widener_active:', e)),

        getSetting('stereo_widener_amount')
          .then((val) => {
            if (val) {
              const amt = parseFloat(val);
              if (!isNaN(amt)) {
                if (!disposed) setStereoWidenerAmount(amt);
                invoke('set_stereo_widener', { active: stereoWidenerActive, amount: amt }).catch(() => {});
              }
            }
          })
          .catch((e) => console.warn('Failed to read stereo_widener_amount:', e)),

        getSetting('limiter_enabled')
          .then((val) => {
            const enabled = val !== 'false';
            if (!disposed) setLimiterEnabled(enabled);
            invoke('set_limiter_enabled', { enabled }).catch(() => {});
          })
          .catch((e) => console.warn('Failed to read limiter_enabled:', e)),

        // The always-on preamp (DSP Studio); its controls are restored by useDspManager.
        getSetting('preamp_db')
          .then((val) => {
            const preampDb = clampPreampDb(parseFiniteSetting(val, 0));
            if (preampDb !== 0) invoke('set_preamp', { preampDb }).catch(() => {});
          })
          .catch((e) => console.warn('Failed to read preamp_db:', e)),
      ]);

    const beginBootExit = () => {
      if (disposed || bootFinished) return;
      bootFinished = true;
      console.info(`[perf] bootstrap completed in ${performance.now().toFixed(1)} ms`);
      if (safetyTimer !== null) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      setBootState({
        isReady: false,
        isExiting: true,
        progress: 100,
        stage: 'ready',
      });
      exitTimer = setTimeout(() => {
        if (!disposed) {
          setBootState({
            isReady: true,
            isExiting: true,
            progress: 100,
            stage: 'ready',
          });
        }
      }, BOOT_EXIT_DURATION_MS);
    };

    const completedStages = new Set<Exclude<BootStage, 'ready'>>();
    const markStageSettled = (stage: Exclude<BootStage, 'ready'>) => {
      if (disposed || bootFinished) return;
      completedStages.add(stage);
      const progress = Math.round((completedStages.size / BOOT_STAGE_ORDER.length) * 100);
      const nextStage = BOOT_STAGE_ORDER.find((candidate) => !completedStages.has(candidate)) ?? 'ready';
      setBootState((prev) =>
        prev.isExiting
          ? prev
          : {
              isReady: false,
              isExiting: false,
              progress,
              stage: nextStage,
            },
      );
    };

    const runStage = (stage: Exclude<BootStage, 'ready'>, task: () => unknown) => {
      let result: Promise<unknown>;
      try {
        result = Promise.resolve(task());
      } catch (err) {
        result = Promise.reject(err);
      }
      return result.finally(() => {
        markStageSettled(stage);
      });
    };

    safetyTimer = setTimeout(() => {
      console.warn('Startup bootstrap exceeded safety timeout; revealing UI.');
      beginBootExit();
    }, BOOT_SAFETY_TIMEOUT_MS);

    // Ask the Rust host to show the main window once WebKitGTK has committed a full frame.
    // Double rAF ensures layout and style are flushed before gtk_widget_show maps the surface.
    triggerWindowReveal();

    // DSP presets and playlists are loaded by their own hooks (useDspManager / usePlaylistManager).
    Promise.allSettled([
      runStage('themes', loadThemes),
      runStage('settings', loadInitialSettings),
      runStage('devices', refreshDevices),
      runStage('queue', refreshQueue),
      runStage('library', loadLibrary),
    ]).then(() => {
      beginBootExit();
    });

    invoke<string>('get_app_version')
      .then((ver) => {
        if (!disposed && ver) setAppVersion(ver);
      })
      .catch(() => {});

    let isInternalDragging = false;

    // The same drop can arrive through several channels (webview event, window event, raw
    // `tauri://drag-drop` and HTML5 `drop`, depending on the platform/WebKitGTK). An identical
    // set of paths within a short time window is handled only once.
    const createDropDispatcher = () => {
      let lastKey = '';
      let lastAt = 0;
      return (paths: string[]) => {
        if (!paths || paths.length === 0) return;
        const key = [...paths].sort().join('\n');
        const now = Date.now();
        if (key === lastKey && now - lastAt < DUPLICATE_DROP_WINDOW_MS) return;
        lastKey = key;
        lastAt = now;
        handleDropPathsRef.current(paths);
      };
    };
    const dispatchDrop = createDropDispatcher();
    const handleDragStart = () => {
      isInternalDragging = true;
    };
    const handleDragEnd = () => {
      isInternalDragging = false;
      setIsDraggingOver(false);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInternalDragging) return;
      const types = e.dataTransfer?.types;
      if (types && (types.includes('Files') || Array.from(types).includes('Files'))) {
        setIsDraggingOver(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDraggingOver(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isInternalDragging = false;
      setIsDraggingOver(false);

      const paths: string[] = [];
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          // WebKitGTK adds the absolute `path` of a dropped file; standard `File` objects have none.
          const file = e.dataTransfer.files[i] as File & { path?: string };
          if (file.path) {
            paths.push(file.path);
          }
        }
      }

      const uriList = e.dataTransfer?.getData('text/uri-list');
      if (uriList) {
        const lines = uriList.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            if (trimmed.startsWith('file://')) {
              try {
                const decoded = decodeURIComponent(new URL(trimmed).pathname);
                if (decoded && !paths.includes(decoded)) {
                  paths.push(decoded);
                }
              } catch {
                const plain = decodeURIComponent(trimmed.replace('file://', ''));
                if (plain && !paths.includes(plain)) {
                  paths.push(plain);
                }
              }
            } else if (trimmed.startsWith('/')) {
              if (!paths.includes(trimmed)) {
                paths.push(trimmed);
              }
            }
          }
        }
      }

      dispatchDrop(paths);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDraggingOver(false);
      }
    };

    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup can happen before the registrations resolve; in that case we unregister right away.
    let unlistenWebview: (() => void) | null = null;
    let unlistenWindow: (() => void) | null = null;
    let unlistenTauriEvent: (() => void) | null = null;
    let unlistenQueueEvent: (() => void) | null = null;

    listen('queue_changed', () => {
      refreshQueue();
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else unlistenQueueEvent = unlisten;
      })
      .catch(() => {});

    const savedAlbumMode = localStorage.getItem('auralune_album_playback_mode');
    if (savedAlbumMode) {
      setSetting('album_playback_mode', savedAlbumMode).catch(() => {});
    }

    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            if (!isInternalDragging) {
              setIsDraggingOver(true);
            }
          } else if (event.payload.type === 'drop') {
            setIsDraggingOver(false);
            if (event.payload.paths && event.payload.paths.length > 0) {
              dispatchDrop(event.payload.paths);
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          if (disposed) unlisten();
          else unlistenWebview = unlisten;
        })
        .catch((err) => {
          console.warn('getCurrentWebview.onDragDropEvent unavailable:', err);
        });
    } catch (err) {
      console.warn('getCurrentWebview error:', err);
    }

    try {
      getCurrentWindow()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            if (!isInternalDragging) {
              setIsDraggingOver(true);
            }
          } else if (event.payload.type === 'drop') {
            setIsDraggingOver(false);
            if (event.payload.paths && event.payload.paths.length > 0) {
              dispatchDrop(event.payload.paths);
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          if (disposed) unlisten();
          else unlistenWindow = unlisten;
        })
        .catch((err) => {
          console.warn('getCurrentWindow.onDragDropEvent unavailable:', err);
        });
    } catch (err) {
      console.warn('getCurrentWindow error:', err);
    }

    listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      setIsDraggingOver(false);
      if (event.payload?.paths && event.payload.paths.length > 0) {
        dispatchDrop(event.payload.paths);
      }
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else unlistenTauriEvent = unlisten;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      if (exitTimer !== null) clearTimeout(exitTimer);
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('keydown', handleKeyDown);
      if (unlistenWebview) unlistenWebview();
      if (unlistenWindow) unlistenWindow();
      if (unlistenTauriEvent) unlistenTauriEvent();
      if (unlistenQueueEvent) unlistenQueueEvent();
    };
    // Initialise services and register the drag & drop listeners exactly once (the handler is read from a ref).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isDraggingOver,
    setIsDraggingOver,
    bootState,
  };
}
