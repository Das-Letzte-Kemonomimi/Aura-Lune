import { describe, it, expect } from 'vitest';
import { invokeMock } from '../test/ipcMock';
import { invoke, IpcError, toIpcError, errorMessage, isIpcError, COMMAND_NAMES } from './ipc';

describe('api/ipc', () => {
  it('forwards command and arguments exactly as given', async () => {
    invokeMock.mockResolvedValueOnce(42);
    await expect(invoke<number>('get_app_version')).resolves.toBe(42);
    expect(invokeMock).toHaveBeenLastCalledWith('get_app_version');

    await invoke('set_volume', { volume: 0.5 });
    expect(invokeMock).toHaveBeenLastCalledWith('set_volume', { volume: 0.5 });
  });

  it('normalizes structured CommandError payloads', async () => {
    invokeMock.mockRejectedValueOnce({ code: 'not_found', message: 'Nie znaleziono utworu o ID 7' });
    const err = await invoke('set_active_track', { trackId: 7 }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(IpcError);
    expect(isIpcError(err, 'not_found')).toBe(true);
    expect((err as IpcError).command).toBe('set_active_track');
    expect(String(err)).toBe('Nie znaleziono utworu o ID 7');
    expect(`${err}`).toBe('Nie znaleziono utworu o ID 7');
  });

  it('keeps plain string errors readable for existing String(err) call sites', async () => {
    invokeMock.mockRejectedValueOnce('Błąd bazy danych');
    const err = await invoke('get_queue').catch((e: unknown) => e);

    expect(isIpcError(err, 'unknown')).toBe(true);
    expect(String(err)).toBe('Błąd bazy danych');
  });

  it('maps unknown codes and odd shapes to "unknown"', () => {
    expect(toIpcError('x', { code: 'weird', message: 'm' }).code).toBe('unknown');
    expect(toIpcError('x', new Error('boom')).message).toBe('boom');
    expect(toIpcError('x', 404).message).toBe('404');
    const existing = new IpcError('y', 'io', 'disk');
    expect(toIpcError('x', existing)).toBe(existing);
  });

  it('errorMessage extracts text from any thrown value', () => {
    expect(errorMessage(new IpcError('x', 'io', 'disk full'))).toBe('disk full');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage({ message: 'obj' })).toBe('obj');
    expect(errorMessage(null)).toBe('null');
  });

  it('exposes the generated command registry', () => {
    expect(COMMAND_NAMES).toContain('get_status');
    expect(new Set(COMMAND_NAMES).size).toBe(COMMAND_NAMES.length);
  });
});
