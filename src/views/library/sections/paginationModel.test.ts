import { describe, expect, it } from 'vitest';
import { clampPage, pageCount, pageOfIndex, pageRange, pageWindow, parsePageSize } from './paginationModel';

describe('pagination model', () => {
  it('counts at least one page, even for an empty list', () => {
    expect(pageCount(0, 100)).toBe(1);
    expect(pageCount(100, 100)).toBe(1);
    expect(pageCount(101, 100)).toBe(2);
  });

  it('clamps a stale page after the list shrinks', () => {
    expect(clampPage(9, 250, 100)).toBe(3);
    expect(clampPage(0, 250, 100)).toBe(1);
  });

  it('gives the item range of each page, with a short last page', () => {
    expect(pageRange(1, 250, 100)).toEqual({ start: 0, end: 100 });
    expect(pageRange(3, 250, 100)).toEqual({ start: 200, end: 250 });
    expect(pageRange(1, 0, 100)).toEqual({ start: 0, end: 0 });
  });

  it('finds the page of an item index', () => {
    expect(pageOfIndex(0, 100)).toBe(1);
    expect(pageOfIndex(99, 100)).toBe(1);
    expect(pageOfIndex(100, 100)).toBe(2);
  });

  it('accepts only listed page sizes', () => {
    expect(parsePageSize('100')).toBe(100);
    expect(parsePageSize('77')).toBeUndefined();
    expect(parsePageSize('abc')).toBeUndefined();
  });

  it('builds a page window with gaps', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 9, 10]);
  });
});
