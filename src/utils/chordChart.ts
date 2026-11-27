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

/** Length of one 4/4 bar in ms for a tempo; 0 when the tempo is unknown. */
function barLengthMs(bpm?: number): number {
  return bpm && bpm > 0 ? (60000 / bpm) * 4 : 0;
}

/**
 * Splits a cell spanning several bars into one cell per bar (legacy or hand-edited data can carry
 * a single long run). Split cells share `idxs`, so an edit still reaches every original detection.
 */
function splitCellByBar(cell: ChordCell, barMs: number): ChordCell[] {
  const count = barMs > 0 ? Math.round((cell.end_ms - cell.start_ms) / barMs) : 1;
  if (count <= 1) return [cell];
  const parts: ChordCell[] = [];
  for (let k = 0; k < count; k++) {
    const start = Math.round(cell.start_ms + k * barMs);
    const end = k === count - 1 ? cell.end_ms : Math.round(cell.start_ms + (k + 1) * barMs);
    parts.push({ ...cell, start_ms: start, end_ms: end, bar: cell.bar + k });
  }
  return parts;
}

export function groupByBar(cells: ChordCell[], bpm?: number): ChordBar[] {
  const barMs = barLengthMs(bpm);
  const bars: ChordBar[] = [];
  for (const cell of cells.flatMap((c) => splitCellByBar(c, barMs))) {
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

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  DB: 'C#',
  EB: 'D#',
  FB: 'E',
  GB: 'F#',
  AB: 'G#',
  BB: 'A#',
  CB: 'B',
};

function transposeNotePart(part: string, semitones: number): string {
  if (!part) return part;
  const hasAccidental = part.length > 1 && (part[1] === '#' || part[1] === 'b');
  const root = hasAccidental ? part.substring(0, 2) : part.substring(0, 1);
  const remainder = hasAccidental ? part.substring(2) : part.substring(1);
  const upper = root.toUpperCase();
  const normalized = FLAT_TO_SHARP[upper] ?? upper;
  const idx = CHROMATIC.indexOf(normalized as (typeof CHROMATIC)[number]);
  if (idx === -1) return part;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return `${CHROMATIC[newIdx]}${remainder}`;
}

/** Transposes a chord symbol (including flats and slash bass notes) by `semitones`. */
export function transposeChordName(chord: string, semitones: number): string {
  if (semitones === 0 || !chord || chord === 'N') return chord;
  const slashIdx = chord.indexOf('/');
  if (slashIdx === -1) return transposeNotePart(chord, semitones);
  const main = transposeNotePart(chord.slice(0, slashIdx), semitones);
  const bass = transposeNotePart(chord.slice(slashIdx + 1), semitones);
  return `${main}/${bass}`;
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
