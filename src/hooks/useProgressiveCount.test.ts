import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProgressiveCount } from './useProgressiveCount';

describe('useProgressiveCount', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts small and grows in steps until the whole list is mounted', () => {
    const { result } = renderHook(() => useProgressiveCount(100, 'grid', 10, 30));
    expect(result.current).toBe(10);
    act(() => void vi.advanceTimersByTime(16));
    expect(result.current).toBe(40);
    act(() => void vi.advanceTimersByTime(16));
    expect(result.current).toBe(70);
    act(() => void vi.advanceTimersByTime(16));
    expect(result.current).toBe(100);
  });

  it('never exceeds the total and restarts when the reset key changes', () => {
    const { result, rerender } = renderHook(({ total, key }) => useProgressiveCount(total, key, 10, 30), {
      initialProps: { total: 5, key: 'grid' },
    });
    expect(result.current).toBe(5);
    rerender({ total: 200, key: 'list' });
    expect(result.current).toBe(10);
  });
});
