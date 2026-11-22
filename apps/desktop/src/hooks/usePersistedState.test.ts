import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBoolean, usePersistedState } from './usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => localStorage.clear());

  it('returns the fallback when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
    expect(result.current[0]).toBe(true);
  });

  it('writes and reads back under the same key', () => {
    const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
    act(() => result.current[1](false));
    expect(localStorage.getItem('k')).toBe('false');
    const { result: again } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
    expect(again.current[0]).toBe(false);
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
    act(() => result.current[1]((v) => !v));
    expect(result.current[0]).toBe(true);
  });

  it('ignores corrupt values and falls back', () => {
    localStorage.setItem('k', '{not json');
    const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
    expect(result.current[0]).toBe(true);
  });

  it('migrates a value saved under a legacy key', () => {
    localStorage.setItem('old_key', 'false');
    const { result } = renderHook(() =>
      usePersistedState('new_key', true, { parse: parseBoolean, legacyKeys: ['old_key'] }),
    );
    expect(result.current[0]).toBe(false);
  });
});
