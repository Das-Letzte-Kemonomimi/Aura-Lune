import { useCallback } from 'react';
import { errorMessage, invoke } from '../api/ipc';

interface UseProfileBackupOptions {
  importTitle: string;
  errorPrefix: string;
  refreshPlaylists: () => Promise<unknown>;
  loadLibrary: () => Promise<unknown>;
  showMessage: (msg: string, isError?: boolean) => void;
}

/** Handles profile backup export and import dialogs outside the App component body. */
export function useProfileBackup({
  importTitle,
  errorPrefix,
  refreshPlaylists,
  loadLibrary,
  showMessage,
}: UseProfileBackupOptions) {
  const handleExportProfileBackup = useCallback(async () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const dest = await invoke<string | null>('pick_save_destination', {
        defaultName: `auralune-profile-backup-${dateStr}.json`,
        extension: 'json',
      });
      if (!dest) return;

      const msg = await invoke<string>('export_profile_backup', {
        destinationPath: dest,
      });
      showMessage(msg);
    } catch (err: unknown) {
      showMessage(`${errorPrefix} ${errorMessage(err)}`, true);
    }
  }, [errorPrefix, showMessage]);

  const handleImportProfileBackup = useCallback(async () => {
    try {
      const filePath = await invoke<string | null>('pick_custom_file', {
        title: importTitle,
        filter: '*.json|Auralune backup (*.json)',
      });
      if (!filePath) return;

      const msg = await invoke<string>('import_profile_backup', {
        filePathOrJson: filePath,
      });
      await refreshPlaylists();
      await loadLibrary();
      showMessage(msg);
    } catch (err: unknown) {
      showMessage(`${errorPrefix} ${errorMessage(err)}`, true);
    }
  }, [errorPrefix, importTitle, loadLibrary, refreshPlaylists, showMessage]);

  return {
    handleExportProfileBackup,
    handleImportProfileBackup,
  };
}
