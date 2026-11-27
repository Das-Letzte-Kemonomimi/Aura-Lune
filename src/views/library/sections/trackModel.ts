import type { TrackRecord } from '../../../types/library';

/** Hi-res audio: 24-bit or more, or a sample rate of 88.2 kHz and up. */
export const isHiRes = (t: Pick<TrackRecord, 'bit_depth' | 'sample_rate'>): boolean =>
  Boolean(t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200;

export const FORGOTTEN_MIN_PLAYS = 3;
export const FORGOTTEN_MIN_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Forgotten Gem: played enough times to prove it's a keeper (`>= 3` plays),
 * but not heard recently (at least 30 days since `last_played_at`, or timestamp unknown).
 */
export function isForgottenGem(
  t: Pick<TrackRecord, 'play_count' | 'last_played_at'>,
  nowSeconds: number,
): boolean {
  if ((t.play_count || 0) < FORGOTTEN_MIN_PLAYS) return false;
  if (t.last_played_at && nowSeconds - t.last_played_at < FORGOTTEN_MIN_AGE_SECONDS) return false;
  return true;
}

/**
 * Ranks forgotten gems highest when they have strong engagement (plays, favorite, 4–5★ rating)
 * and haven't been played for a long time.
 */
export function forgottenGemScore(
  t: Pick<TrackRecord, 'play_count' | 'last_played_at' | 'is_favorite' | 'rating'>,
  nowSeconds: number,
): number {
  const daysSincePlayed = t.last_played_at ? Math.max(0, (nowSeconds - t.last_played_at) / 86400) : 365;
  const gemWeight =
    (t.play_count || 0) +
    (t.is_favorite ? 5 : 0) +
    (t.rating && t.rating >= 4 ? t.rating : 0);
  return gemWeight * Math.log2(1 + daysSincePlayed);
}

export type TrackSortField = 'title' | 'artist' | 'duration' | 'format' | 'date' | 'plays' | 'year' | 'added';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Builds a comparator for an explicit track sort. `albumYears` maps `album_id` to the album's release
 * year (tracks carry no year of their own). Tracks without a year always sort last, in either direction.
 */
export function trackComparator(
  field: TrackSortField,
  order: 'asc' | 'desc',
  albumYears: ReadonlyMap<number, number>,
): (a: TrackRecord, b: TrackRecord) => number {
  const sign = order === 'asc' ? 1 : -1;
  const yearOf = (t: TrackRecord): number | null => (t.album_id == null ? null : (albumYears.get(t.album_id) ?? null));

  return (a, b) => {
    switch (field) {
      case 'title':
        return sign * collator.compare(a.title || '', b.title || '');
      case 'artist':
        return sign * collator.compare(a.artist || '', b.artist || '');
      case 'duration':
        return sign * (a.duration_ms - b.duration_ms);
      case 'format':
        return sign * collator.compare(a.format || '', b.format || '');
      case 'date':
        return sign * ((a.modified_time || 0) - (b.modified_time || 0));
      case 'plays':
        return sign * ((a.play_count || 0) - (b.play_count || 0));
      case 'added':
        return sign * ((a.added_at || 0) - (b.added_at || 0));
      case 'year': {
        const ay = yearOf(a);
        const by = yearOf(b);
        if (ay === null || by === null) return ay === by ? 0 : ay === null ? 1 : -1;
        // Same year: keep a stable, readable order by artist then title.
        return sign * (ay - by) || collator.compare(a.artist || '', b.artist || '') || collator.compare(a.title || '', b.title || '');
      }
    }
  };
}

/** Short local date (e.g. "Nov 14, 2023") of a unix-seconds timestamp; empty when unknown. */
export function formatAddedDate(seconds: number | null | undefined, locale?: string): string {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}
