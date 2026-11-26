import type { TrackRecord } from '../../../types/library';

/** Hi-res audio: 24-bit or more, or a sample rate of 88.2 kHz and up. */
export const isHiRes = (t: Pick<TrackRecord, 'bit_depth' | 'sample_rate'>): boolean =>
  Boolean(t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200;
