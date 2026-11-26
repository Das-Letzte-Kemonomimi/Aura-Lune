import { beforeEach, vi } from 'vitest';
import { invokeMock } from './ipcMock';
import { livePlayback } from '../state/livePlayback';

vi.mock('@tauri-apps/api/core', async () => {
  const { invokeMock: shared } = await import('./ipcMock');
  return { invoke: shared };
});

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(undefined);
  livePlayback.reset();
});
