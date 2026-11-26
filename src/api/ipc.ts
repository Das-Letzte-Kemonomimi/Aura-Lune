/**
 * The frontend's only entry point to the Tauri backend commands.
 *
 * - `invoke` accepts only command names registered in the backend (`CommandName`,
 *   generated from `src-tauri/src/lib.rs`): a typo or a removed command is a compile error.
 * - Every backend error is normalised to an `IpcError` with `code` and `message` fields,
 *   whether the command returns a `CommandError` (`{ code, message }`) or plain text.
 *   `String(err)` / `${err}` return the message alone, so existing UI messages do not change.
 *
 * oxlint blocks direct imports of `@tauri-apps/api/core` outside `src/api/`.
 */
import { invoke as tauriInvoke, type InvokeArgs } from '@tauri-apps/api/core';
import type { CommandName } from './commands.generated';

export type { CommandName } from './commands.generated';
export { COMMAND_NAMES } from './commands.generated';

/** Error categories returned by `CommandError` in the backend (`commands/error.rs`). */
export type IpcErrorCode =
  | 'storage'
  | 'engine'
  | 'io'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'internal'
  /** The backend returned plain text or an unknown error shape. */
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

  /** Keeps the old `String(err)` behaviour when the backend returned plain text. */
  override toString(): string {
    return this.message;
  }
}

/** Turns any error rejected by `invoke` into an `IpcError`. */
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

/** Calls a backend command. Rejects only with `IpcError`. */
export async function invoke<T = unknown>(command: CommandName, args?: InvokeArgs): Promise<T> {
  try {
    // Arguments are passed exactly as the caller gave them (no explicit `undefined`).
    return await (args === undefined ? tauriInvoke<T>(command) : tauriInvoke<T>(command, args));
  } catch (raw) {
    throw toIpcError(command, raw);
  }
}

/** A readable message from any caught error (for `catch (e: unknown)`). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
}

/** Whether the error comes from the backend and has the given category. */
export function isIpcError(error: unknown, code?: IpcErrorCode): error is IpcError {
  return error instanceof IpcError && (code === undefined || error.code === code);
}

/** Opens an HTTPS URL in the host browser via the backend allowlist command. */
export async function openExternalUrl(url: string): Promise<void> {
  await invoke('open_external_url', { url });
}
