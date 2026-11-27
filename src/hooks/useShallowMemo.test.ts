// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useShallowMemo } from './useShallowMemo';

describe('useShallowMemo', () => {
  afterEach(() => {
    cleanup();
  });

  it('preserves object identity when all properties match by Object.is', () => {
    const fn = () => {};
    const { result, rerender } = renderHook(
      (props: { a: number; b: string; fn: () => void; extra?: boolean }) => useShallowMemo(props),
      { initialProps: { a: 1, b: 'ok', fn } as { a: number; b: string; fn: () => void; extra?: boolean } },
    );

    const first = result.current;
    rerender({ a: 1, b: 'ok', fn });
    expect(result.current).toBe(first);

    // NaN === NaN under Object.is
    rerender({ a: Number.NaN, b: 'ok', fn });
    const nanObj = result.current;
    expect(nanObj).not.toBe(first);
    rerender({ a: Number.NaN, b: 'ok', fn });
    expect(result.current).toBe(nanObj);

    // Value change returns new object
    rerender({ a: 2, b: 'ok', fn });
    expect(result.current).not.toBe(nanObj);

    // Key count / key set change returns new object
    const third = result.current;
    rerender({ a: 2, b: 'ok', fn, extra: true });
    expect(result.current).not.toBe(third);
  });
});
