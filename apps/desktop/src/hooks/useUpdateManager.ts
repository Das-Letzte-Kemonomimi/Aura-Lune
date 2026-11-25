import { useCallback, useEffect, useState } from 'react';
import { errorMessage, invoke } from '../api/ipc';
import { getSetting, setSetting } from '../api/settings';
import type { BuildInfo, UpdateInfo, UpdateProgress } from '../types/updates';
import { useTauriEvent } from './useTauriEvent';

export const UPDATE_AVAILABLE_EVENT = 'auralune://update-available';
export const UPDATE_PROGRESS_EVENT = 'auralune://update-progress';

/**
 * Stan aktualizacji aplikacji. Sprawdzanie w tle robi backend (start + co 6 h) i sygnalizuje je
 * zdarzeniem; ręczne „Sprawdź teraz” wymusza zapytanie. Instalacja jest dostępna tylko dla
 * AppImage z `install.sh` (`info.can_install`).
 */
export function useUpdateManager() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skippedVersion, setSkippedVersion] = useState<string | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    invoke<BuildInfo>('get_build_info')
      .then((b) => !cancelled && setBuildInfo(b))
      .catch(() => {});
    invoke<UpdateInfo | null>('get_cached_update_info')
      .then((cached) => !cancelled && cached && setInfo(cached))
      .catch(() => {});
    getSetting('update_skipped_version')
      .then((v) => !cancelled && setSkippedVersion(v || null))
      .catch(() => {});
    getSetting('update_check_enabled')
      .then((v) => !cancelled && setAutoCheckEnabled(v !== 'false'))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useTauriEvent<UpdateInfo>(UPDATE_AVAILABLE_EVENT, setInfo);
  useTauriEvent<UpdateProgress>(UPDATE_PROGRESS_EVENT, setProgress, installing);

  const checkNow = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setInfo(await invoke<UpdateInfo>('check_for_update', { force: true }));
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }, []);

  const install = useCallback(async () => {
    setInstalling(true);
    setProgress(null);
    setError(null);
    try {
      await invoke<void>('install_update');
      setInstalled(true);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setInstalling(false);
    }
  }, []);

  const restart = useCallback(async () => {
    setError(null);
    try {
      await invoke<void>('restart_after_update');
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, []);

  const skip = useCallback(async () => {
    const version = info?.latest_version;
    if (!version) return;
    setSkippedVersion(version);
    try {
      await setSetting('update_skipped_version', version);
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, [info?.latest_version]);

  const setAutoCheck = useCallback(async (enabled: boolean) => {
    setAutoCheckEnabled(enabled);
    try {
      await setSetting('update_check_enabled', String(enabled));
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, []);

  const isSkipped = !!info?.latest_version && info.latest_version === skippedVersion;
  /** Odznaka w nagłówku: nowa wersja (niepominięta) albo pobrana i czekająca na restart. */
  const hasUpdate = installed || (!!info?.available && !isSkipped);

  return {
    buildInfo,
    info,
    checking,
    installing,
    installed,
    progress,
    error,
    isSkipped,
    hasUpdate,
    autoCheckEnabled,
    checkNow,
    install,
    restart,
    skip,
    setAutoCheck,
  };
}

export type UpdateManager = ReturnType<typeof useUpdateManager>;
