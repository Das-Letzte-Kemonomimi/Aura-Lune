/**
 * Helper to normalize string for case-insensitive, accent-insensitive search and matching.
 */
export function normalizeStr(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
