import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const listeners = new Map<string, (event: { payload: unknown }) => void>();
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, cb: (event: { payload: unknown }) => void) => {
    listeners.set(name, cb);
    return () => listeners.delete(name);
  }),
}));

import { PLAYBACK_ERROR_EVENT, usePlaybackErrorToasts } from './usePlaybackErrorToasts';

describe('usePlaybackErrorToasts', () => {
  beforeEach(() => listeners.clear());

  it('shows backend playback errors as error toasts', async () => {
    const showMessage = vi.fn();
    renderHook(() => usePlaybackErrorToasts(showMessage));
    await vi.waitFor(() => expect(listeners.has(PLAYBACK_ERROR_EVENT)).toBe(true));

    listeners.get(PLAYBACK_ERROR_EVENT)?.({ payload: { message: 'Decoder failed' } });

    expect(showMessage).toHaveBeenCalledWith('Decoder failed', true);
  });
});
