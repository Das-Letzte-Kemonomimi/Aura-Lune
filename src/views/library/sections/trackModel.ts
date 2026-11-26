import type { TrackRecord } from '../../../types/library';

/** Hi-res audio: 24-bit or more, or a sample rate of 88.2 kHz and up. */
export const isHiRes = (t: Pick<TrackRecord, 'bit_depth' | 'sample_rate'>): boolean =>
  Boolean(t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200;

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
