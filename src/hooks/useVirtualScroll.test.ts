import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVirtualScroll } from './useVirtualScroll';

describe('useVirtualScroll hook', () => {
  it('returns valid initial indices for small lists', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 600, writable: true });
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

    const containerRef = { current: container };

    const { result } = renderHook(() =>
      useVirtualScroll({
        itemCount: 20,
        itemHeight: 40,
        containerRef,
        overscan: 5,
      })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(20);
    expect(result.current.topSpacerHeight).toBe(0);
    expect(result.current.bottomSpacerHeight).toBe(0);
    expect(result.current.isVirtualizing).toBe(false);
  });

  it('virtualizes large datasets and calculates spacer heights accurately', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 400, writable: true });
    Object.defineProperty(container, 'scrollTop', { value: 1000, writable: true });

    const containerRef = { current: container };

    const { result } = renderHook(() =>
      useVirtualScroll({
        itemCount: 1000,
        itemHeight: 50,
        containerRef,
        overscan: 10,
      })
    );

    // Initial range or after scroll calculation
    expect(result.current.isVirtualizing).toBe(true);
    expect(result.current.startIndex).toBeGreaterThanOrEqual(0);
    expect(result.current.endIndex).toBeLessThanOrEqual(1000);
    expect(result.current.topSpacerHeight).toBeGreaterThanOrEqual(0);
    expect(result.current.bottomSpacerHeight).toBeGreaterThanOrEqual(0);
  });
});
