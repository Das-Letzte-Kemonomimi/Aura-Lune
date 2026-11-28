import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHoverIntent } from './useHoverIntent';

describe('useHoverIntent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after the pointer rests for the delay', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useHoverIntent(onIntent, 100));
    result.current.onPointerEnter();
    result.current.onPointerEnter();
    vi.advanceTimersByTime(99);
    expect(onIntent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it('cancels when the pointer leaves early', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useHoverIntent(onIntent, 100));
    result.current.onPointerEnter();
    vi.advanceTimersByTime(50);
    result.current.onPointerLeave();
    vi.advanceTimersByTime(200);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('cancels on unmount', () => {
    const onIntent = vi.fn();
    const { result, unmount } = renderHook(() => useHoverIntent(onIntent, 100));
    result.current.onFocus();
    unmount();
    vi.advanceTimersByTime(200);
    expect(onIntent).not.toHaveBeenCalled();
  });
});
