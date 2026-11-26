import { describe, expect, it } from 'vitest';
import { pageItems } from './changelogModel';

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('puts gaps around the pages near the current one', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, 'gap', 10]);
    expect(pageItems(6, 12)).toEqual([1, 'gap', 4, 5, 6, 7, 8, 'gap', 12]);
    expect(pageItems(10, 10)).toEqual([1, 'gap', 8, 9, 10]);
  });
});
