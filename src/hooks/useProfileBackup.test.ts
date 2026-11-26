import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { invokeMock } from '../test/ipcMock';
import { useProfileBackup } from './useProfileBackup';

describe('useProfileBackup', () => {
  const makeOptions = () => ({
    importTitle: 'Import backup',
    errorPrefix: 'Error:',
    refreshPlaylists: vi.fn().mockResolvedValue([]),
    loadLibrary: vi.fn().mockResolvedValue(undefined),
    showMessage: vi.fn(),
  });

  it('exports profile backup to the chosen destination', async () => {
    const opts = makeOptions();
    invokeMock
      .mockResolvedValueOnce('/tmp/backup.json')
      .mockResolvedValueOnce('Saved backup');

    const { result } = renderHook(() => useProfileBackup(opts));
    await act(async () => {
      await result.current.handleExportProfileBackup();
    });

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      'pick_save_destination',
      expect.objectContaining({
        defaultName: expect.stringMatching(/^auralune-profile-backup-\d{4}-\d{2}-\d{2}\.json$/),
        extension: 'json',
      }),
    );
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'export_profile_backup', {
      destinationPath: '/tmp/backup.json',
    });
    expect(opts.showMessage).toHaveBeenCalledWith('Saved backup');
  });

  it('aborts cleanly when save dialog is cancelled', async () => {
    const opts = makeOptions();
    invokeMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useProfileBackup(opts));
    await act(async () => {
      await result.current.handleExportProfileBackup();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(opts.showMessage).not.toHaveBeenCalled();
  });

  it('imports profile backup and reloads playlists and library', async () => {
    const opts = makeOptions();
    invokeMock
      .mockResolvedValueOnce('/tmp/restore.json')
      .mockResolvedValueOnce('Imported backup');

    const { result } = renderHook(() => useProfileBackup(opts));
    await act(async () => {
      await result.current.handleImportProfileBackup();
    });

    expect(invokeMock).toHaveBeenNthCalledWith(2, 'import_profile_backup', {
      filePathOrJson: '/tmp/restore.json',
    });
    expect(opts.refreshPlaylists).toHaveBeenCalledTimes(1);
    expect(opts.loadLibrary).toHaveBeenCalledTimes(1);
    expect(opts.showMessage).toHaveBeenCalledWith('Imported backup');
  });

  it('reports IPC errors via showMessage', async () => {
    const opts = makeOptions();
    invokeMock.mockRejectedValueOnce({ code: 'io', command: 'pick_custom_file', message: 'disk full' });

    const { result } = renderHook(() => useProfileBackup(opts));
    await act(async () => {
      await result.current.handleImportProfileBackup();
    });

    expect(opts.showMessage).toHaveBeenCalledWith('Error: disk full', true);
  });
});
