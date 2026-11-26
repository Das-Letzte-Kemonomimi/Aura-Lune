export interface ChangelogItem {
  pl: string;
  en: string;
  de: string;
  fi: string;
  la: string;
}

export interface ChangelogRelease {
  version: string;
  codename: string;
  date: string;
  author: string;
  isLatest?: boolean;
  isDev?: boolean;
  added: ChangelogItem[];
  changed?: ChangelogItem[];
  fixed: ChangelogItem[];
}

function hasAnyItems(rel: ChangelogRelease): boolean {
  return (rel.added?.length ?? 0) + (rel.changed?.length ?? 0) + (rel.fixed?.length ?? 0) > 0;
}

/** Filters releases by build channel (`dev` sees non-empty `isDev` builds; `stable` hides them). */
export function visibleReleases(releases: readonly ChangelogRelease[], channel?: string): ChangelogRelease[] {
  if (channel === 'dev') return releases.filter((rel) => !rel.isDev || hasAnyItems(rel));
  return releases.filter((rel) => !rel.isDev);
}

/** Picks the release highlighted in the changelog header pill. */
export function headerRelease(releases: readonly ChangelogRelease[], channel?: string): ChangelogRelease | undefined {
  const visible = visibleReleases(releases, channel);
  if (channel === 'dev') {
    const devEntry = visible.find((rel) => rel.isDev);
    if (devEntry) return devEntry;
  }
  return visible.find((rel) => rel.isLatest && !rel.isDev) ?? visible[0];
}

/** A page number, or a gap between two runs of page numbers. */
export type PageItem = number | 'gap';

/**
 * Page buttons for a paginator: always the first and last page, the pages within `delta` of the
 * current one, and a gap marker wherever pages are skipped.
 */
export function pageItems(current: number, total: number, delta = 2): PageItem[] {
  if (total <= 1) return [1];
  const items: PageItem[] = [1];
  const start = Math.max(2, current - delta);
  const end = Math.min(total - 1, current + delta);
  if (start > 2) items.push('gap');
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push('gap');
  items.push(total);
  return items;
}
