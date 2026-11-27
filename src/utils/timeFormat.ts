import { fmt } from './fmt';

/**
 * Centralized Time Formatting & Parsing Utilities
 * Single Source of Truth for audio playback timing in Auralune.
 */

/**
 * Formats milliseconds into standard playback clock format: M:SS (e.g. 3:45 or 0:00).
 */
export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0 || isNaN(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Formats milliseconds down to millisecond precision: M:SS.mmm (e.g. 1:23.450).
 */
export function formatTimeMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0 || isNaN(ms)) return '0:00.000';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const remMs = Math.floor(ms % 1000);
  return `${m}:${s < 10 ? '0' : ''}${s}.${remMs.toString().padStart(3, '0')}`;
}

/**
 * Formats duration in milliseconds into human-readable duration: M:SS or H:MM:SS.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0 || isNaN(ms)) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parses user text inputs into millisecond integers.
 * Supports:
 * - Millisecond suffix: "860ms", "860 ms"
 * - Seconds suffix: "1.5s", "12s"
 * - Colons: "MM:SS.mmm" or "HH:MM:SS.mmm"
 * - Decimal seconds: "12.5" -> 12500ms
 * - Pure digits: "860" -> 860ms
 */
export function parseTimeToMs(input: string): number | null {
  if (!input) return null;
  let str = input.trim().toLowerCase();
  if (!str) return null;

  // Strip prefixes like 'a:', 'b:', 'punkt a:', 'punkt b:'
  str = str.replace(/^(?:punkt\s*)?[ab]\s*:\s*/i, '').trim();
  // Decimal comma to dot
  str = str.replace(',', '.');

  // 1. Explicit 'ms' suffix
  if (str.endsWith('ms')) {
    const val = parseFloat(str.slice(0, -2).trim());
    return isNaN(val) ? null : Math.max(0, Math.round(val));
  }

  // 2. Explicit 's' suffix
  if (str.endsWith('s')) {
    const val = parseFloat(str.slice(0, -1).trim());
    return isNaN(val) ? null : Math.max(0, Math.round(val * 1000));
  }

  // 3. Colon format [HH:]MM:SS[.mmm]
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length === 2) {
      const minutes = parseFloat(parts[0]);
      const seconds = parseFloat(parts[1]);
      if (isNaN(minutes) || isNaN(seconds)) return null;
      return Math.max(0, Math.round((minutes * 60 + seconds) * 1000));
    } else if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
      return Math.max(0, Math.round((hours * 3600 + minutes * 60 + seconds) * 1000));
    }
    return null;
  }

  // 4. Dot without colon (treated as seconds)
  if (str.includes('.')) {
    const val = parseFloat(str);
    return isNaN(val) ? null : Math.max(0, Math.round(val * 1000));
  }

  // 5. Plain integer digits -> milliseconds
  const val = parseInt(str, 10);
  return isNaN(val) ? null : Math.max(0, val);
}

export interface RelativeTimeLabels {
  never: string;
  justNow: string;
  /** Templates with a `{0}` placeholder for the count. */
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  oneDayAgo: string;
}

/**
 * Formats a unix timestamp (seconds) as "5 min ago" / "3 h ago" / "2 days ago".
 * `nowSec` is injectable for deterministic tests.
 */
export function formatRelativeTime(
  timestampSec: number | null | undefined,
  labels: RelativeTimeLabels,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  if (!timestampSec) return labels.never;
  const diff = Math.max(0, nowSec - timestampSec);
  if (diff < 60) return labels.justNow;
  if (diff < 3600) return fmt(labels.minutesAgo, Math.floor(diff / 60));
  if (diff < 86400) return fmt(labels.hoursAgo, Math.floor(diff / 3600));
  const days = Math.floor(diff / 86400);
  return days === 1 ? labels.oneDayAgo : fmt(labels.daysAgo, days);
}
