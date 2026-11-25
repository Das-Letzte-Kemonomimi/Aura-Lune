import type { ChordSegment } from '../types/analysis';

/** Visual family of a chord, used for colour coding. */
export type ChordTone = 'major' | 'minor' | 'seventh' | 'other' | 'none';

export function chordTone(quality: string): ChordTone {
  if (quality === 'N') return 'none';
  if (quality === 'maj') return 'major';
  if (quality.startsWith('min')) return 'minor';
  if (quality.includes('7')) return 'seventh';
  return 'other';
}

/** Accent colour per chord family. */
export const TONE_COLORS: Record<ChordTone, string> = {
  major: '#38bdf8',
  minor: '#c084fc',
  seventh: '#fbbf24',
  other: '#2dd4bf',
  none: '#64748b',
};

/** One or more consecutive identical detections inside a single bar, shown as one chip. */
export interface ChordCell {
  chord: string;
  quality: string;
  start_ms: number;
  end_ms: number;
  bar: number;
  /** Lowest confidence of the merged detections (0–1). */
  confidence: number;
  /** Indices into the original `chords` array (needed to apply edits to every merged detection). */
  idxs: number[];
}

export interface ChordBar {
  bar: number;
  start_ms: number;
  end_ms: number;
  cells: ChordCell[];
}

export function mergeChordSegments(chords: ChordSegment[]): ChordCell[] {
  const cells: ChordCell[] = [];
  chords.forEach((seg, idx) => {
    const last = cells[cells.length - 1];
    if (last && last.chord === seg.chord && last.bar === seg.bar) {
      last.end_ms = seg.end_ms;
      last.confidence = Math.min(last.confidence, seg.confidence);
      last.idxs.push(idx);
      return;
    }
    cells.push({
      chord: seg.chord,
      quality: seg.quality,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      bar: seg.bar,
      confidence: seg.confidence,
      idxs: [idx],
    });
  });
  return cells;
}

export function groupByBar(cells: ChordCell[]): ChordBar[] {
  const bars: ChordBar[] = [];
  for (const cell of cells) {
    const last = bars[bars.length - 1];
    if (last && last.bar === cell.bar) {
      last.cells.push(cell);
      last.end_ms = Math.max(last.end_ms, cell.end_ms);
      continue;
    }
    bars.push({ bar: cell.bar, start_ms: cell.start_ms, end_ms: cell.end_ms, cells: [cell] });
  }
  return bars;
}

export function findActiveCell(cells: ChordCell[], positionMs: number): number {
  return cells.findIndex((c) => positionMs >= c.start_ms && positionMs < c.end_ms);
}

/** First cell after `activeIdx` that is a different chord (skips repeats across bars). */
export function findNextDistinctCell(cells: ChordCell[], activeIdx: number): ChordCell | null {
  if (activeIdx < 0) return null;
  const current = cells[activeIdx].chord;
  for (let i = activeIdx + 1; i < cells.length; i++) {
    if (cells[i].chord !== current) return cells[i];
  }
  return null;
}
