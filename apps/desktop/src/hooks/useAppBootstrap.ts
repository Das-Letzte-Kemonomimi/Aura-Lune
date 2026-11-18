import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { Language } from '../i18n';

export interface UseAppBootstrapOptions {
  refreshDevices: () => Promise<unknown> | unknown;
  loadLibrary: () => Promise<unknown> | unknown;
  loadPresets: () => Promise<unknown> | unknown;
  loadThemes: () => Promise<unknown> | unknown;
  refreshQueue: () => Promise<unknown> | unknown;
  refreshPlaylists: () => Promise<unknown> | unknown;
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

export function useAppBootstrap({
  refreshDevices,
  loadLibrary,
  loadPresets,
  loadThemes,
  refreshQueue,
  refreshPlaylists,
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

  // 1. Wczytanie początkowych ustawień aplikacji z SQLite
  useEffect(() => {
    invoke<string | null>('get_app_setting', { key: 'eq_enabled_on_startup' })
      .then((val) => {
        setEqAutoStartup(val === 'true');
      })
      .catch((e) => console.warn('Błąd odczytu eq_enabled_on_startup:', e));

    invoke<string | null>('get_app_setting', { key: 'app_language' })
      .then((val) => {
        if (val && (val === 'en' || val === 'pl' || val === 'de' || val === 'fi' || val === 'la')) {
          setLanguage(val as Language);
        }
      })
      .catch((e) => console.warn('Błąd odczytu app_language:', e));

    invoke<string | null>('get_app_setting', { key: 'seek_fade_enabled' })
      .then((val) => {
        if (val !== null) {
          setSeekFadeEnabled(val === 'true');
        }
      })
      .catch((e) => console.warn('Błąd odczytu seek_fade_enabled:', e));

    invoke<string | null>('get_app_setting', { key: 'close_to_tray' })
      .then((val) => {
        setCloseToTray(val !== 'false');
      })
      .catch((e) => console.warn('Błąd odczytu close_to_tray:', e));

    invoke<string | null>('get_app_setting', { key: 'crossfade_duration' })
      .then((val) => {
        const ms = val ? parseInt(val, 10) : 1500;
        if (!isNaN(ms)) {
          setCrossfadeDuration(ms);
          invoke('set_crossfade_duration', { durationMs: ms }).catch(() => {});
        }
      })
      .catch((e) => console.warn('Błąd odczytu crossfade_duration:', e));

    invoke<string | null>('get_app_setting', { key: 'bass_boost' })
      .then((val) => {
        if (val) {
          const num = parseFloat(val);
          if (!isNaN(num)) setBassBoost(num);
        }
      })
      .catch((e) => console.warn('Błąd odczytu bass_boost:', e));

    invoke<string | null>('get_app_setting', { key: 'stereo_widener_active' })
      .then((val) => {
        const active = val === 'true';
        setStereoWidenerActive(active);
        invoke('set_stereo_widener', { active, amount: stereoWidenerAmount }).catch(() => {});
      })
      .catch((e) => console.warn('Błąd odczytu stereo_widener_active:', e));

    invoke<string | null>('get_app_setting', { key: 'stereo_widener_amount' })
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

    invoke<string | null>('get_app_setting', { key: 'limiter_enabled' })
      .then((val) => {
        const enabled = val !== 'false';
        setLimiterEnabled(enabled);
        invoke('set_limiter_enabled', { enabled }).catch(() => {});
      })
      .catch((e) => console.warn('Błąd odczytu limiter_enabled:', e));
  }, []);

  // 2. Inicjalizacja usług, biblioteki, motywów, kolejki i rejestracja zdarzeń drag & drop
  useEffect(() => {
    refreshDevices();
    loadLibrary();
    loadPresets();
    loadThemes();
    refreshQueue();
    refreshPlaylists();

    invoke<string>('get_app_version')
      .then((ver) => {
        if (ver) setAppVersion(ver);
      })
      .catch(() => {});

    let isInternalDragging = false;
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

      if (paths.length > 0) {
        handleDropPaths(paths);
      }
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

    let unlistenWebview: (() => void) | null = null;
    let unlistenWindow: (() => void) | null = null;
    let unlistenTauriEvent: (() => void) | null = null;
    let unlistenQueueEvent: (() => void) | null = null;

    listen('queue_changed', () => {
      refreshQueue();
    })
      .then((unlisten) => {
        unlistenQueueEvent = unlisten;
      })
      .catch(() => {});

    const savedAlbumMode = localStorage.getItem('auralune_album_playback_mode');
    if (savedAlbumMode) {
      invoke('set_app_setting', { key: 'album_playback_mode', value: savedAlbumMode }).catch(() => {});
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
              handleDropPaths(event.payload.paths);
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          unlistenWebview = unlisten;
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
              handleDropPaths(event.payload.paths);
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          unlistenWindow = unlisten;
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
        handleDropPaths(event.payload.paths);
      }
    })
      .then((unlisten) => {
        unlistenTauriEvent = unlisten;
      })
      .catch(() => {});

    return () => {
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
  }, []);

  return {
    isDraggingOver,
    setIsDraggingOver,
  };
}
