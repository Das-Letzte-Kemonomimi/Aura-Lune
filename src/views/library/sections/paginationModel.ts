/** Rows-per-page choices of the track table. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;
export const DEFAULT_PAGE_SIZE = 100;

/** Validator for the persisted page size: only a listed choice is accepted. */
export const parsePageSize = (raw: string): number | undefined => {
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : undefined;
};

export const pageCount = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / pageSize));

/** Keeps `page` (1-based) inside the pages that exist for `total` items. */
export const clampPage = (page: number, total: number, pageSize: number): number =>
  Math.min(Math.max(1, page), pageCount(total, pageSize));

/** Item range `[start, end)` of a page. */
export function pageRange(page: number, total: number, pageSize: number): { start: number; end: number } {
  const start = (clampPage(page, total, pageSize) - 1) * pageSize;
  return { start, end: Math.min(start + pageSize, total) };
}

/** The 1-based page that holds the item at `index`. */
export const pageOfIndex = (index: number, pageSize: number): number => Math.floor(index / pageSize) + 1;

/**
 * Page buttons to show: the first and last page and the current one with `siblings` on each side,
 * with `'gap'` where pages are skipped (a gap of a single page shows that page instead).
 */
export function pageWindow(page: number, count: number, siblings = 1): (number | 'gap')[] {
  const wanted = new Set<number>([1, count]);
  for (let p = page - siblings; p <= page + siblings; p += 1) {
    if (p >= 1 && p <= count) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) out.push('gap');
    out.push(p);
  });
  return out;
}
