import { vi } from 'vitest';

/**
 * Wspólny mock `invoke` z `@tauri-apps/api/core` dla wszystkich testów Vitest.
 * Rejestrowany globalnie w `src/test/setup.ts` i resetowany przed każdym testem
 * (domyślnie rozwiązuje się do `undefined`).
 *
 * Użycie w teście:
 *   import { invokeMock } from '../test/ipcMock';
 *   invokeMock.mockResolvedValueOnce({ ... });
 *   expect(invokeMock).toHaveBeenCalledWith('play');
 */
// Luźne typy celowo: testy podstawiają dowolne odpowiedzi i czytają dowolne argumenty.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const invokeMock = vi.fn<(cmd: string, args?: any) => Promise<any>>();
