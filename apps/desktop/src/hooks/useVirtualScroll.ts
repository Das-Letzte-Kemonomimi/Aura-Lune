import { useState, useEffect, useCallback, useRef } from 'react';

export interface VirtualScrollOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Estimated or fixed height of each row in pixels */
  itemHeight: number;
  /** Scrollable container element ref (e.g. <main>) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Reference to the list/table element inside the container */
  tableRef?: React.RefObject<HTMLElement | null>;
  /** Number of buffer items rendered above and below the visible viewport */
  overscan?: number;
}

export interface VirtualScrollResult {
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  isVirtualizing: boolean;
}

/**
 * Ultra-performant, zero-dependency virtual scroll hook.
 * Renders only the visible rows plus buffer, keeping the exact container scroll height
 * via top and bottom spacer rows for 60-144 FPS scrolling on libraries with 10,000+ tracks.
 */
export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerRef,
  tableRef,
  overscan = 24,
}: VirtualScrollOptions): VirtualScrollResult {
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.min(itemCount, 50),
  });

  const rafId = useRef<number | null>(null);

  const calculateRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight || window.innerHeight;

    let offsetTop = 0;
    if (tableRef?.current) {
      let el: HTMLElement | null = tableRef.current;
      while (el && el !== container) {
        offsetTop += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      if (offsetTop === 0) {
        const tableRect = tableRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        offsetTop = Math.max(0, Math.round(tableRect.top - containerRect.top + scrollTop));
      }
    }

    // Liczba pikseli, o jaką przewinięto w głąb tabeli
    const scrollInside = Math.max(0, scrollTop - offsetTop);

    const rawStart = Math.floor(scrollInside / itemHeight);
    const visibleCount = Math.ceil(clientHeight / itemHeight);

    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(itemCount, rawStart + visibleCount + overscan);

    setRange((prev) => {
      if (prev.start === start && prev.end === end) return prev;
      return { start, end };
    });
  }, [itemCount, itemHeight, containerRef, tableRef, overscan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        calculateRange();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Initial calculation
    calculateRange();

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [calculateRange, containerRef]);

  // Gdy liczba elementów zmieni się (np. filtr, wyszukiwanie, sortowanie), natychmiast zaktualizuj zakres
  useEffect(() => {
    calculateRange();
  }, [itemCount, calculateRange]);

  const startIndex = Math.min(range.start, Math.max(0, itemCount - 1));
  const endIndex = Math.min(range.end, itemCount);

  const topSpacerHeight = startIndex * itemHeight;
  const bottomSpacerHeight = Math.max(0, (itemCount - endIndex) * itemHeight);

  return {
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    isVirtualizing: itemCount > 50,
  };
}
