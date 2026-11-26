import { describe, expect, it } from 'vitest';
import {
  headerRelease,
  pageItems,
  visibleReleases,
  type ChangelogRelease,
} from './changelogModel';

const SAMPLE_ITEM = { en: 'Item', pl: 'Pozycja', de: 'Punkt', fi: 'Kohta', la: 'Res' };

const RELEASES: ChangelogRelease[] = [
  {
    version: '1.1.6-dev',
    codename: 'Development Channel',
    date: '2026-11-26',
    author: 'Tester',
    isDev: true,
    added: [SAMPLE_ITEM],
    fixed: [],
  },
  {
    version: '1.1.5',
    codename: 'Latest Stable',
    date: '2026-11-15',
    author: 'Tester',
    isLatest: true,
    added: [SAMPLE_ITEM],
    fixed: [],
  },
];

describe('visibleReleases and headerRelease', () => {
  it('hides isDev releases on stable builds and defaults header to isLatest', () => {
    expect(visibleReleases(RELEASES, 'stable').map((r) => r.version)).toEqual(['1.1.5']);
    expect(visibleReleases(RELEASES).map((r) => r.version)).toEqual(['1.1.5']);
    expect(headerRelease(RELEASES, 'stable')?.version).toBe('1.1.5');
  });

  it('includes isDev releases and highlights the dev entry on dev builds', () => {
    expect(visibleReleases(RELEASES, 'dev').map((r) => r.version)).toEqual(['1.1.6-dev', '1.1.5']);
    expect(headerRelease(RELEASES, 'dev')?.version).toBe('1.1.6-dev');
  });
});

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
