/**
 * Centralized File Size & Data Rate Formatting Utilities
 */

/**
 * Formats a raw byte count into human-readable binary size string (e.g. 14.2 MB, 1.1 GB).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
