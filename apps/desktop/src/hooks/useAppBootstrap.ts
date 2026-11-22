import { useState, useEffect, useRef } from 'react';
import { invoke } from '../api/ipc';
import { getSetting, setSetting } from '../api/settings';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { Language } from '../i18n';

export interface UseAppBootstrapOptions {
  refreshDevices: () => Promise<unknown> | unknown;
  loadLibrary: () => Promise<unknown> | unknown;
  loadThemes: () => Promise<unknown> | unknown;
  refreshQueue: () => Promise<unknown> | unknown;
  setAppVersion: (ver: string) => void;
  setLanguage: (lang: Language) => void;
  setSeekFadeEnabled: (enabled: boolean) => void;
  setCloseToTray: (enabled: boolean) => void;
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

/** Okno czasowe, w którym identyczne upuszczenie z innego kanału zdarzeń jest ignorowane. */
const DUPLICATE_DROP_WINDOW_MS = 1000;

export function useAppBootstrap({
  refreshDevices,
  loadLibrary,
  loadThemes,
  refreshQueue,
  setAppVersion,
  setLanguage,
  setSeekFadeEnabled,
  setCloseToTray,
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

  // Najnowszy handler upuszczenia — rejestracja nasłuchów odbywa się raz, przy montowaniu.
  const handleDropPathsRef = useRef(handleDropPaths);
  useEffect(() => {
    handleDropPathsRef.current = handleDropPaths;
  }, [handleDropPaths]);

  // 1. Wczytanie początkowych ustawień aplikacji z SQLite
  useEffect(() => {
    getSetting('eq_enabled_on_startup')
      .then((val) => {
        setEqAutoStartup(val === 'true');
      })
      .catch((e) => console.warn('Błąd odczytu eq_enabled_on_startup:', e));

    getSetting('app_language')
      .then((val) => {
        if (val && (val === 'en' || val === 'pl' || val === 'de' || val === 'fi' || val === 'la')) {
          setLanguage(val as Language);
        }
      })
      .catch((e) => console.warn('Błąd odczytu app_language:', e));

    getSetting('seek_fade_enabled')
      .then((val) => {
        if (val !== null) {
          setSeekFadeEnabled(val === 'true');
        }
      })
      .catch((e) => console.warn('Błąd odczytu seek_fade_enabled:', e));

    getSetting('close_to_tray')
      .then((val) => {
        setCloseToTray(val !== 'false');
      })
      .catch((e) => console.warn('Błąd odczytu close_to_tray:', e));

    getSetting('crossfade_duration')
      .then((val) => {
        const ms = val ? parseInt(val, 10) : 1500;
        if (!isNaN(ms)) {
          setCrossfadeDuration(ms);
          invoke('set_crossfade_duration', { durationMs: ms }).catch(() => {});
        }
      })
      .catch((e) => console.warn('Błąd odczytu crossfade_duration:', e));

    getSetting('bass_boost')
      .then((val) => {
        if (val) {
          const num = parseFloat(val);
          if (!isNaN(num)) setBassBoost(num);
        }
      })
      .catch((e) => console.warn('Błąd odczytu bass_boost:', e));

    getSetting('stereo_widener_active')
      .then((val) => {
        const active = val === 'true';
        setStereoWidenerActive(active);
        invoke('set_stereo_widener', { active, amount: stereoWidenerAmount }).catch(() => {});
      })
      .catch((e) => console.warn('Błąd odczytu stereo_widener_active:', e));

    getSetting('stereo_widener_amount')
      .then((val) => {
        if (val) {
          const amt = parseFloat(val);
          if (!isNaN(amt)) {
            setStereoWidenerAmount(amt);
            invoke('set_stereo_widener', { active: stereoWidenerActive, amount: amt }).catch(() => {});
          }
        }
      })
      .catch((e) => console.warn('Błąd odczytu stereo_widener_amount:', e));

    getSetting('limiter_enabled')
      .then((val) => {
        const enabled = val !== 'false';
        setLimiterEnabled(enabled);
        invoke('set_limiter_enabled', { enabled }).catch(() => {});
      })
      .catch((e) => console.warn('Błąd odczytu limiter_enabled:', e));
    // Jednorazowe wczytanie ustawień przy montowaniu — zależności to stabilne settery i wartości startowe.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Inicjalizacja usług, biblioteki, motywów, kolejki i rejestracja zdarzeń drag & drop
  useEffect(() => {
    // Presety DSP i playlisty wczytują własne hooki (useDspManager / usePlaylistManager).
    refreshDevices();
    loadLibrary();
    loadThemes();
    refreshQueue();

    invoke<string>('get_app_version')
      .then((ver) => {
        if (ver) setAppVersion(ver);
      })
      .catch(() => {});

    let isInternalDragging = false;

    // To samo upuszczenie może dotrzeć kilkoma kanałami (zdarzenie webview, okna, surowe
    // `tauri://drag-drop` oraz HTML5 `drop` — zależnie od platformy/WebKitGTK). Identyczny
    // zestaw ścieżek w krótkim oknie czasowym jest obsługiwany tylko raz.
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
          const file = e.dataTransfer.files[i] as any;
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

    // Cleanup może nastąpić, zanim rejestracje się rozwiążą — wtedy wyrejestrowujemy od razu.
    let disposed = false;
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
          console.warn('getCurrentWebview.onDragDropEvent niedostępne:', err);
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
          console.warn('getCurrentWindow.onDragDropEvent niedostępne:', err);
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
    // Inicjalizacja usług i rejestracja nasłuchów drag & drop dokładnie raz (handler czytany z ref).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isDraggingOver,
    setIsDraggingOver,
  };
}
