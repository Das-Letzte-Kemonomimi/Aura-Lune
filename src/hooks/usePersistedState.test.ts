import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBoolean, parseOneOf, usePersistedState } from './usePersistedState';

/** What a second window does: the value changes in storage and the browser fires `storage` here. */
function writeFromAnotherWindow(key: string, newValue: string | null) {
  if (newValue === null) localStorage.removeItem(key);
  else localStorage.setItem(key, newValue);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

describe('usePersistedState', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

  it('composes two functional updates made in the same tick', () => {
    const { result } = renderHook(() =>
      usePersistedState('k', 0, { parse: (raw) => (Number.isFinite(Number(raw)) ? Number(raw) : undefined) }),
    );
    act(() => {
      result.current[1]((v) => v + 1);
      result.current[1]((v) => v + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem('k')).toBe('2');
  });

  it('ignores corrupt values and falls back', () => {
    localStorage.setItem('k', '{not json');
    const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
    expect(result.current[0]).toBe(true);
  });

  it('falls back when parse throws', () => {
    localStorage.setItem('k', 'x');
    const { result } = renderHook(() =>
      usePersistedState('k', 'fallback', {
        parse: () => {
          throw new Error('boom');
        },
      }),
    );
    expect(result.current[0]).toBe('fallback');
  });

  it('migrates a value saved under a legacy key', () => {
    localStorage.setItem('old_key', 'false');
    const { result } = renderHook(() =>
      usePersistedState('new_key', true, { parse: parseBoolean, legacyKeys: ['old_key'] }),
    );
    expect(result.current[0]).toBe(false);
  });

  it('prefers the current key over a legacy key', () => {
    localStorage.setItem('old_key', 'false');
    localStorage.setItem('new_key', 'true');
    const { result } = renderHook(() =>
      usePersistedState('new_key', false, { parse: parseBoolean, legacyKeys: ['old_key'] }),
    );
    expect(result.current[0]).toBe(true);
  });

  it('uses the custom serialize', () => {
    const { result } = renderHook(() =>
      usePersistedState<number>('k', 33, {
        parse: (raw) => (raw === '33' ? 33 : raw === '45' ? 45 : undefined),
        serialize: (v) => `${v}`,
      }),
    );
    act(() => result.current[1](45));
    expect(localStorage.getItem('k')).toBe('45');
  });

  it('keeps the setter identity when the options object and serialize are inline', () => {
    const { result, rerender } = renderHook(() =>
      usePersistedState('k', true, { parse: parseBoolean, serialize: (v) => String(v) }),
    );
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it('writes to storage once per update, also under StrictMode', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }), {
      wrapper: StrictMode,
    });
    act(() => result.current[1]((v) => !v));
    expect(result.current[0]).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps the same object reference across renders until the stored text changes', () => {
    const parse = (raw: string) => JSON.parse(raw) as { x: number };
    localStorage.setItem('k', '{"x":1}');
    const { result, rerender } = renderHook(() => usePersistedState('k', { x: 0 }, { parse, serialize: JSON.stringify }));
    const first = result.current[0];
    rerender();
    expect(result.current[0]).toBe(first);
    act(() => result.current[1]({ x: 2 }));
    expect(result.current[0]).toEqual({ x: 2 });
  });

  it('reads the fallback only on the first render', () => {
    const { result, rerender } = renderHook(({ fb }) => usePersistedState('k', fb, { parse: parseBoolean }), {
      initialProps: { fb: true },
    });
    rerender({ fb: false });
    expect(result.current[0]).toBe(true);
  });

  describe('sync between instances', () => {
    it('a write in one hook updates another hook on the same key', () => {
      const a = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      const b = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      act(() => a.result.current[1](true));
      expect(a.result.current[0]).toBe(true);
      expect(b.result.current[0]).toBe(true);
    });

    it('a functional update in B starts from the value A wrote', () => {
      const a = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      const b = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      act(() => a.result.current[1](true));
      act(() => b.result.current[1]((v) => !v));
      expect(a.result.current[0]).toBe(false);
      expect(b.result.current[0]).toBe(false);
    });

    it('does not touch hooks on other keys', () => {
      const a = renderHook(() => usePersistedState('k1', false, { parse: parseBoolean }));
      const b = renderHook(() => usePersistedState('k2', false, { parse: parseBoolean }));
      act(() => a.result.current[1](true));
      expect(b.result.current[0]).toBe(false);
    });

    it('each instance parses with its own parse function', () => {
      const asBool = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      const asWord = renderHook(() =>
        usePersistedState<string>('k', 'none', { parse: (raw) => (raw === 'true' ? 'yes' : undefined) }),
      );
      act(() => asBool.result.current[1](true));
      expect(asWord.result.current[0]).toBe('yes');
    });

    it('a storage event from another window updates the hook', () => {
      const { result } = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      act(() => writeFromAnotherWindow('k', 'true'));
      expect(result.current[0]).toBe(true);
    });

    it('a storage event that removes the key returns to the fallback', () => {
      localStorage.setItem('k', 'false');
      const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
      expect(result.current[0]).toBe(false);
      act(() => writeFromAnotherWindow('k', null));
      expect(result.current[0]).toBe(true);
    });

    it('a storage event for localStorage.clear() (key null) updates every hook', () => {
      localStorage.setItem('k', 'false');
      const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
      localStorage.clear();
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: null }));
      });
      expect(result.current[0]).toBe(true);
    });

    it('ignores a storage event that carries an invalid value', () => {
      const { result } = renderHook(() => usePersistedState('k', true, { parse: parseBoolean }));
      act(() => writeFromAnotherWindow('k', 'nonsense'));
      expect(result.current[0]).toBe(true);
    });

    it('stops listening once the last instance unmounts', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const a = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      const b = renderHook(() => usePersistedState('other', false, { parse: parseBoolean }));
      expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);

      a.unmount();
      expect(remove.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(0);
      b.unmount();
      expect(remove.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
    });

    it('the remaining instances keep syncing after another one unmounts', () => {
      const a = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      const b = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      const c = renderHook(() => usePersistedState('k', false, { parse: parseBoolean }));
      b.unmount();
      act(() => a.result.current[1](true));
      expect(c.result.current[0]).toBe(true);
    });
  });

  describe('when localStorage cannot be written', () => {
    it('still shows the change in the UI and shares it between instances', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      const a = renderHook(() => usePersistedState('unwritable-key', false, { parse: parseBoolean }));
      const b = renderHook(() => usePersistedState('unwritable-key', false, { parse: parseBoolean }));
      act(() => a.result.current[1](true));
      expect(a.result.current[0]).toBe(true);
      expect(b.result.current[0]).toBe(true);
    });

    it('uses the fallback when localStorage cannot be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      const { result } = renderHook(() => usePersistedState('unreadable-key', true, { parse: parseBoolean }));
      expect(result.current[0]).toBe(true);
    });
  });
});

describe('parseOneOf', () => {
  const parse = parseOneOf(['a', 'b'] as const);

  it('accepts listed values', () => {
    expect(parse('a')).toBe('a');
  });

  it('rejects anything else', () => {
    expect(parse('c')).toBeUndefined();
    expect(parse('')).toBeUndefined();
  });
});
