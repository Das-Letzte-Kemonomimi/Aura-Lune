// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useStableCallback } from './useStableCallback';

describe('useStableCallback', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the exact same function identity across re-renders while reading the latest closure', () => {
    const { result, rerender } = renderHook(
      ({ factor }: { factor: number }) => useStableCallback((x: number) => x * factor),
      { initialProps: { factor: 2 } },
    );

    const firstIdentity = result.current;
    expect(firstIdentity(5)).toBe(10);

    rerender({ factor: 7 });
    expect(result.current).toBe(firstIdentity);
    expect(result.current(5)).toBe(35);
  });
});
