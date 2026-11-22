/**
 * Jedyny punkt wejścia frontendu do komend backendu Tauri.
 *
 * - `invoke` przyjmuje wyłącznie nazwy komend zarejestrowanych w backendzie (`CommandName`,
 *   generowane z `src-tauri/src/lib.rs`) — literówka lub usunięta komenda to błąd kompilacji.
 * - Każdy błąd backendu jest normalizowany do `IpcError` z polami `code` i `message`,
 *   niezależnie od tego, czy komenda zwraca `CommandError` (`{ code, message }`) czy zwykły tekst.
 *   `String(err)` / `${err}` zwracają sam komunikat, więc istniejące komunikaty UI się nie zmieniają.
 *
 * Bezpośredni import `@tauri-apps/api/core` poza katalogiem `src/api/` jest blokowany przez oxlint.
 */
import { invoke as tauriInvoke, type InvokeArgs } from '@tauri-apps/api/core';
import type { CommandName } from './commands.generated';

export type { CommandName } from './commands.generated';
export { COMMAND_NAMES } from './commands.generated';

/** Kategorie błędów zwracanych przez `CommandError` w backendzie (`commands/error.rs`). */
export type IpcErrorCode =
  | 'storage'
  | 'engine'
  | 'io'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'internal'
  /** Backend zwrócił zwykły tekst lub nieznany kształt błędu. */
  | 'unknown';

const KNOWN_CODES: ReadonlySet<string> = new Set<IpcErrorCode>([
  'storage',
  'engine',
  'io',
  'not_found',
  'validation',
  'network',
  'internal',
  'unknown',
]);

export class IpcError extends Error {
  readonly code: IpcErrorCode;
  readonly command: string;

  constructor(command: string, code: IpcErrorCode, message: string) {
    super(message);
    this.name = 'IpcError';
    this.code = code;
    this.command = command;
  }

  /** Zachowuje dotychczasowe zachowanie `String(err)`, gdy backend zwracał zwykły tekst. */
  override toString(): string {
    return this.message;
  }
}

/** Zamienia dowolny błąd odrzucony przez `invoke` na `IpcError`. */
export function toIpcError(command: string, raw: unknown): IpcError {
  if (raw instanceof IpcError) return raw;
  if (typeof raw === 'string') return new IpcError(command, 'unknown', raw);
  if (raw && typeof raw === 'object') {
    const { code, message } = raw as { code?: unknown; message?: unknown };
    if (typeof message === 'string') {
      const normalized = typeof code === 'string' && KNOWN_CODES.has(code) ? (code as IpcErrorCode) : 'unknown';
      return new IpcError(command, normalized, message);
    }
  }
  if (raw instanceof Error) return new IpcError(command, 'unknown', raw.message);
  return new IpcError(command, 'unknown', String(raw));
}

/** Wywołuje komendę backendu. Odrzuca wyłącznie `IpcError`. */
export async function invoke<T = unknown>(command: CommandName, args?: InvokeArgs): Promise<T> {
  try {
    // Argumenty przekazywane dokładnie tak, jak podał je wywołujący (bez jawnego `undefined`).
    return await (args === undefined ? tauriInvoke<T>(command) : tauriInvoke<T>(command, args));
  } catch (raw) {
    throw toIpcError(command, raw);
  }
}

/** Czytelny komunikat z dowolnego złapanego błędu (do `catch (e: unknown)`). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
}

/** Czy błąd pochodzi z backendu i ma podaną kategorię. */
export function isIpcError(error: unknown, code?: IpcErrorCode): error is IpcError {
  return error instanceof IpcError && (code === undefined || error.code === code);
}
