import { vi } from 'vitest';

/**
 * Shared mock of `invoke` from `@tauri-apps/api/core` for all Vitest tests.
 * Registered globally in `src/test/setup.ts` and reset before each test
 * (resolves to `undefined` by default).
 *
 * Usage in a test:
 *   import { invokeMock } from '../test/ipcMock';
 *   invokeMock.mockResolvedValueOnce({ ... });
 *   expect(invokeMock).toHaveBeenCalledWith('play');
 */
// Loose types on purpose: tests substitute any responses and read any arguments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const invokeMock = vi.fn<(cmd: string, args?: any) => Promise<any>>();
