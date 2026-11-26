import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from './useToasts';

describe('useToasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows errors and hides info messages by default', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.showMessage('saved');
      result.current.showMessage('failed', true);
    });
    expect(result.current.toasts.map((t) => [t.level, t.text])).toEqual([['error', 'failed']]);
  });

  it('shows info messages when enabled', () => {
    const { result } = renderHook(() => useToasts({ showInfo: true }));
    act(() => result.current.showMessage('saved'));
    expect(result.current.toasts[0]).toMatchObject({ level: 'info', text: 'saved' });
  });

  it('keeps earlier messages instead of overwriting them, up to the limit', () => {
    const { result } = renderHook(() => useToasts({ maxVisible: 2 }));
    act(() => {
      result.current.showMessage('a', true);
      result.current.showMessage('b', true);
      result.current.showMessage('c', true);
    });
    expect(result.current.toasts.map((t) => t.text)).toEqual(['b', 'c']);
  });

  it('does not duplicate an identical message', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.showMessage('same', true);
      result.current.showMessage('same', true);
    });
    expect(result.current.toasts).toHaveLength(1);
  });

  it('expires each message on its own timer', () => {
    const { result } = renderHook(() => useToasts({ durationMs: { error: 1000 } }));
    act(() => result.current.showMessage('first', true));
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.showMessage('second', true));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.toasts.map((t) => t.text)).toEqual(['second']);
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('keeps a stable showMessage reference across renders', () => {
    const { result, rerender } = renderHook(() => useToasts());
    const first = result.current.showMessage;
    rerender();
    expect(result.current.showMessage).toBe(first);
  });

  it('clears pending timers on unmount', () => {
    const { result, unmount } = renderHook(() => useToasts());
    act(() => result.current.showMessage('x', true));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
