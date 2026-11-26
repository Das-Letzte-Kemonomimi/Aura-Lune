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
