import { describe, it, expect } from 'vitest';
import type { ChordSegment } from '../types/analysis';
import {
  chordTone,
  findActiveCell,
  findNextDistinctCell,
  groupByBar,
  mergeChordSegments,
} from './chordChart';

const seg = (chord: string, quality: string, start: number, end: number, bar: number): ChordSegment => ({
  start_ms: start,
  end_ms: end,
  chord,
  root_note: chord[0],
  quality,
  confidence: 0.9,
  beat: 1,
  bar,
});

describe('chordChart', () => {
  const chords = [
    seg('C', 'maj', 0, 500, 1),
    seg('C', 'maj', 500, 1000, 1),
    seg('Am', 'min', 1000, 2000, 1),
    seg('Am', 'min', 2000, 3000, 2),
    seg('G7', '7', 3000, 4000, 2),
  ];

  it('merges identical neighbours within a bar only and remembers original indices', () => {
    const cells = mergeChordSegments(chords);
    expect(cells.map((c) => [c.chord, c.bar, c.start_ms, c.end_ms])).toEqual([
      ['C', 1, 0, 1000],
      ['Am', 1, 1000, 2000],
      ['Am', 2, 2000, 3000],
      ['G7', 2, 3000, 4000],
    ]);
    expect(cells[0].idxs).toEqual([0, 1]);
  });

  it('keeps the lowest confidence of merged detections', () => {
    const low = [seg('C', 'maj', 0, 500, 1), { ...seg('C', 'maj', 500, 1000, 1), confidence: 0.4 }];
    expect(mergeChordSegments(low)[0].confidence).toBe(0.4);
  });

  it('groups cells by bar', () => {
    const bars = groupByBar(mergeChordSegments(chords));
    expect(bars.map((b) => [b.bar, b.cells.length, b.start_ms, b.end_ms])).toEqual([
      [1, 2, 0, 2000],
      [2, 2, 2000, 4000],
    ]);
  });

  it('finds the active cell and the next different chord', () => {
    const cells = mergeChordSegments(chords);
    expect(findActiveCell(cells, 1500)).toBe(1);
    expect(findActiveCell(cells, 9999)).toBe(-1);
    expect(findNextDistinctCell(cells, 1)?.chord).toBe('G7');
    expect(findNextDistinctCell(cells, 3)).toBeNull();
    expect(findNextDistinctCell(cells, -1)).toBeNull();
  });

  it('classifies chord qualities', () => {
    expect(['maj', 'min', 'min7', '7', 'maj7', 'sus4', 'N'].map(chordTone)).toEqual([
      'major',
      'minor',
      'minor',
      'seventh',
      'seventh',
      'other',
      'none',
    ]);
  });
});
