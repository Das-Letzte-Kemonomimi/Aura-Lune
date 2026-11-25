import { describe, it, expect } from 'vitest';
import type { DetectedNote } from '../../../types/analysis';
import {
  MIDI_CEIL,
  MIDI_FLOOR,
  MIN_ROWS,
  buildNoteIndex,
  clampOriginMs,
  computeDensity,
  computeKeyHeight,
  maxScrollRows,
  MIN_KEY_HEIGHT,
  LABEL_KEY_HEIGHT,
  computePitchRange,
  followOriginMs,
  hiddenNotesBeyondView,
  clampRowHeight,
  resolveKeyHeight,
  ROW_HEIGHT_MAX,
  ROW_HEIGHT_MIN,
  hitTestNote,
  followScrollGoal,
  pitchSpanInWindow,
  noteOverlaps,
  pitchToY,
  rulerTicks,
  timeToX,
  visibleGridLines,
  visibleNoteRange,
  xToTime,
  yToPitch,
  zoomAround,
  type PitchAxis,
  type TimeAxis,
} from './pianoRollModel';

function note(onset_ms: number, duration_ms: number, midi_pitch = 60): DetectedNote {
  return { onset_ms, duration_ms, midi_pitch, pitch_name: 'C4', cents_offset: 0, velocity: 90 };
}

/** Indeksy nut, które faktycznie nachodzą na okno (po filtrowaniu, jak w pętli rysowania). */
function visible(notes: DetectedNote[], t0: number, t1: number): DetectedNote[] {
  const index = buildNoteIndex(notes);
  const [s, e] = visibleNoteRange(index, t0, t1);
  return index.notes.slice(s, e).filter((n) => noteOverlaps(n, t0, t1));
}

describe('computePitchRange', () => {
  it('pads the data range by two semitones', () => {
    expect(computePitchRange([note(0, 100, 50), note(0, 100, 80)])).toEqual({ minMidi: 48, maxMidi: 82 });
  });

  it('covers the whole detected range, including notes outside the old 36–84 window', () => {
    const range = computePitchRange([note(0, 100, 30), note(0, 100, 95)]);
    expect(range.minMidi).toBeLessThanOrEqual(28);
    expect(range.maxMidi).toBeGreaterThanOrEqual(97);
  });

  it('clamps to the piano keyboard', () => {
    const range = computePitchRange([note(0, 100, 10), note(0, 100, 120)]);
    expect(range).toEqual({ minMidi: MIDI_FLOOR, maxMidi: MIDI_CEIL });
  });

  it('never shrinks below the minimum number of rows', () => {
    const range = computePitchRange([note(0, 100, 60)]);
    expect(range.maxMidi - range.minMidi + 1).toBeGreaterThanOrEqual(MIN_ROWS);
    expect(range.minMidi).toBeLessThanOrEqual(58);
    expect(range.maxMidi).toBeGreaterThanOrEqual(62);
  });

  it('has a usable default for an empty transcription', () => {
    const range = computePitchRange([]);
    expect(range.maxMidi - range.minMidi + 1).toBe(MIN_ROWS);
  });
});

describe('visibleNoteRange', () => {
  it('returns only notes that overlap the window', () => {
    const notes = [note(0, 500), note(1000, 500), note(2000, 500), note(3000, 500)];
    expect(visible(notes, 900, 2100).map((n) => n.onset_ms)).toEqual([1000, 2000]);
  });

  it('includes a long note that started before the window', () => {
    const notes = [note(0, 10_000, 40), note(5000, 200), note(20_000, 200)];
    const onsets = visible(notes, 6000, 7000).map((n) => n.onset_ms);
    expect(onsets).toEqual([0]);
  });

  it('keeps a long note even when many short notes sit between it and the window', () => {
    const notes = [note(0, 30_000, 40)];
    for (let t = 1000; t < 20_000; t += 500) notes.push(note(t, 100));
    const onsets = visible(notes, 25_000, 26_000).map((n) => n.onset_ms);
    expect(onsets).toEqual([0]);
  });

  it('excludes notes that end before the window and start after it', () => {
    const notes = [note(0, 100), note(500, 100), note(5000, 100)];
    expect(visible(notes, 1000, 2000)).toEqual([]);
  });

  it('includes a note starting exactly at the window end', () => {
    expect(visible([note(2000, 100)], 1000, 2000)).toHaveLength(1);
  });

  it('handles unsorted input and an empty list', () => {
    const notes = [note(3000, 100), note(1000, 100), note(2000, 100)];
    expect(visible(notes, 0, 10_000).map((n) => n.onset_ms)).toEqual([1000, 2000, 3000]);
    expect(visibleNoteRange(buildNoteIndex([]), 0, 1000)).toEqual([0, 0]);
  });
});

describe('coordinate mapping', () => {
  const time: TimeAxis = { originMs: 12_345, pxPerSec: 137, left: 56 };
  const pitch: PitchAxis = { maxMidi: 84, minMidi: 48, keyHeight: 14, top: 20, scrollRows: 3.5 };

  it('round-trips time ↔ x at a fractional zoom', () => {
    for (const ms of [0, 999, 12_345, 90_001.5]) {
      expect(xToTime(time, timeToX(time, ms))).toBeCloseTo(ms, 6);
    }
  });

  it('maps the origin to the left edge of the roll', () => {
    expect(timeToX(time, time.originMs)).toBe(time.left);
  });

  it('round-trips pitch ↔ y for every row, also while scrolled vertically', () => {
    for (let midi = pitch.minMidi; midi <= pitch.maxMidi; midi++) {
      const y = pitchToY(pitch, midi);
      expect(yToPitch(pitch, y + pitch.keyHeight / 2)).toBe(midi);
      expect(yToPitch(pitch, y + 0.01)).toBe(midi);
    }
  });

  it('keeps the time under the cursor fixed when zooming', () => {
    const anchorX = 400;
    const before = xToTime(time, anchorX);
    const zoomed = zoomAround(time, anchorX, 300);
    expect(zoomed.pxPerSec).toBe(300);
    expect(xToTime(zoomed, anchorX)).toBeCloseTo(before, 6);
  });

  it('limits zoom to the supported range', () => {
    expect(zoomAround(time, 100, 1).pxPerSec).toBe(20);
    expect(zoomAround(time, 100, 99_999).pxPerSec).toBe(400);
  });
});

describe('view origin', () => {
  it('puts the playhead at 30% of the roll while following', () => {
    const origin = followOriginMs(60_000, 1000, 100);
    const axis: TimeAxis = { originMs: origin, pxPerSec: 100, left: 0 };
    expect(timeToX(axis, 60_000)).toBeCloseTo(300, 6);
  });

  it('does not scroll before the start of the track', () => {
    expect(followOriginMs(500, 1000, 100)).toBe(0);
  });

  it('clamps free panning to the track', () => {
    expect(clampOriginMs(-500, 60_000, 1000, 100)).toBe(0);
    // okno ma 10 s, utwór 60 s → maksymalny początek to 50 s
    expect(clampOriginMs(999_999, 60_000, 1000, 100)).toBe(50_000);
    expect(clampOriginMs(5, 3000, 1000, 100)).toBe(0);
  });
});

describe('visibleGridLines', () => {
  it('emits beats with every 4th as a bar line', () => {
    const lines = visibleGridLines(0, 4000, 120, 100); // 500 ms/beat
    expect(lines.map((l) => l.ms)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]);
    expect(lines.filter((l) => l.bar).map((l) => l.ms)).toEqual([0, 2000, 4000]);
  });

  it('only returns lines inside the window', () => {
    const lines = visibleGridLines(10_000, 11_000, 120, 100);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.ms).toBeGreaterThanOrEqual(10_000 - 500);
      expect(l.ms).toBeLessThanOrEqual(11_000);
    }
  });

  it('falls back to bars only when zoomed out, and to nothing when even bars are too dense', () => {
    const bars = visibleGridLines(0, 60_000, 120, 12); // beat ≈ 6 px, bar ≈ 24 px
    expect(bars.every((l) => l.bar)).toBe(true);
    expect(visibleGridLines(0, 60_000, 120, 2)).toEqual([]);
  });

  it('ignores an unknown tempo', () => {
    expect(visibleGridLines(0, 10_000, 0, 100)).toEqual([]);
    expect(visibleGridLines(0, 10_000, Number.NaN, 100)).toEqual([]);
  });
});

describe('rulerTicks', () => {
  it('picks a step that keeps labels apart', () => {
    const ticks = rulerTicks(0, 60_000, 80);
    const spacingPx = ((ticks[1].ms - ticks[0].ms) / 1000) * 80;
    expect(spacingPx).toBeGreaterThanOrEqual(64);
  });

  it('starts at the first tick inside the window', () => {
    const ticks = rulerTicks(7300, 20_000, 100);
    expect(ticks[0].ms).toBeGreaterThanOrEqual(7300);
  });
});

describe('computeDensity', () => {
  it('normalises to the busiest bucket and spreads long notes across buckets', () => {
    const density = computeDensity([note(0, 250), note(0, 250), note(500, 250)], 1000, 4);
    expect(density).toHaveLength(4);
    expect(density[0]).toBe(1);
    expect(density[2]).toBeCloseTo(0.5, 6);
    expect(Math.max(...density)).toBe(1);
  });

  it('counts a note in every bucket it sounds in', () => {
    const density = computeDensity([note(0, 900)], 1000, 4);
    expect(density.every((d) => d === 1)).toBe(true);
  });

  it('returns nothing for an empty track', () => {
    expect(computeDensity([], 0, 10)).toEqual([]);
    expect(computeDensity([note(0, 10)], 1000, 0)).toEqual([]);
  });
});

describe('hitTestNote', () => {
  const time: TimeAxis = { originMs: 0, pxPerSec: 100, left: 56 };
  const pitch: PitchAxis = { maxMidi: 72, minMidi: 48, keyHeight: 14, top: 20, scrollRows: 0 };
  const index = buildNoteIndex([note(1000, 1000, 60), note(1000, 1000, 64)]);

  it('finds the note under the cursor', () => {
    const x = timeToX(time, 1500);
    const y = pitchToY(pitch, 64) + 7;
    expect(hitTestNote({ index, time, pitch, x, y })?.midi_pitch).toBe(64);
  });

  it('misses the neighbouring row and empty time', () => {
    const y = pitchToY(pitch, 62) + 7;
    expect(hitTestNote({ index, time, pitch, x: timeToX(time, 1500), y })).toBeNull();
    expect(hitTestNote({ index, time, pitch, x: timeToX(time, 5000), y: pitchToY(pitch, 60) + 7 })).toBeNull();
  });

  it('hits a very short note through its minimum drawn width', () => {
    const short = buildNoteIndex([note(2000, 5, 60)]);
    const x = timeToX(time, 2000) + 3;
    expect(hitTestNote({ index: short, time, pitch, x, y: pitchToY(pitch, 60) + 7 })).not.toBeNull();
  });
});

describe('computeKeyHeight', () => {
  it('shrinks rows so a wide pitch range fits without vertical scrolling', () => {
    const rows = 50;
    const roll = 300;
    const keyHeight = computeKeyHeight(roll, rows);
    expect(keyHeight * rows).toBeLessThanOrEqual(roll + 1e-9);
    expect(maxScrollRows(roll, keyHeight, rows)).toBe(0);
  });

  it('keeps rows readable and scrolls only when the area is very small', () => {
    const keyHeight = computeKeyHeight(100, 88);
    expect(keyHeight).toBe(MIN_KEY_HEIGHT);
    expect(maxScrollRows(100, keyHeight, 88)).toBeGreaterThan(0);
  });
});

describe('computeKeyHeight with a minimum for readable labels', () => {
  it('keeps rows at the label height and leaves the rest to scrolling', () => {
    const keyHeight = computeKeyHeight(300, 50, LABEL_KEY_HEIGHT);
    expect(keyHeight).toBe(LABEL_KEY_HEIGHT);
    expect(maxScrollRows(300, keyHeight, 50)).toBeGreaterThan(0);
  });
});

describe('vertical follow', () => {
  const notes = [note(0, 500, 40), note(1000, 500, 70), note(9000, 500, 90)];
  const index = buildNoteIndex(notes);

  it('reports the pitch span of notes inside a window, or null when empty', () => {
    expect(pitchSpanInWindow(index, 0, 2000)).toEqual({ lo: 40, hi: 70 });
    expect(pitchSpanInWindow(index, 3000, 4000)).toBeNull();
  });

  it('does not move when the span already fits (no jitter)', () => {
    const goal = followScrollGoal({ span: { lo: 60, hi: 64 }, maxMidi: 80, viewRows: 20, current: 5, maxScroll: 30 });
    expect(goal).toBe(5); // wiersze 16–21 mieszczą się w oknie 5–25
  });

  it('scrolls up by the minimum needed when notes rise above the view', () => {
    const goal = followScrollGoal({ span: { lo: 76, hi: 80 }, maxMidi: 80, viewRows: 20, current: 10, maxScroll: 30 });
    expect(goal).toBe(0); // górna krawędź (wiersz 0) wraca do widoku
  });

  it('scrolls down by the minimum needed when notes fall below the view', () => {
    const goal = followScrollGoal({ span: { lo: 30, hi: 34 }, maxMidi: 80, viewRows: 20, current: 0, maxScroll: 40 });
    expect(goal).toBeGreaterThan(0);
    const bottomRow = 80 - 30 + 1;
    expect(goal + 20).toBeGreaterThanOrEqual(bottomRow);
  });

  it('centres a span taller than the view and stays within the scroll range', () => {
    const goal = followScrollGoal({ span: { lo: 30, hi: 70 }, maxMidi: 80, viewRows: 20, current: 0, maxScroll: 30 });
    expect(goal).toBeGreaterThan(0);
    expect(goal).toBeLessThanOrEqual(30);
  });

  it('keeps the current scroll when there are no notes nearby', () => {
    expect(followScrollGoal({ span: null, maxMidi: 80, viewRows: 20, current: 7, maxScroll: 30 })).toBe(7);
    expect(followScrollGoal({ span: null, maxMidi: 80, viewRows: 20, current: 99, maxScroll: 30 })).toBe(30);
  });
});

describe('hiddenNotesBeyondView', () => {
  it('flags notes above and below the visible rows', () => {
    const base = { maxMidi: 80, viewRows: 10 };
    expect(hiddenNotesBeyondView({ ...base, span: { lo: 40, hi: 78 }, scrollRows: 5 })).toEqual({ above: true, below: true });
    expect(hiddenNotesBeyondView({ ...base, span: { lo: 72, hi: 78 }, scrollRows: 0 })).toEqual({ above: false, below: false });
    expect(hiddenNotesBeyondView({ ...base, span: null, scrollRows: 0 })).toEqual({ above: false, below: false });
  });
});

describe('resolveKeyHeight', () => {
  it('uses the automatic fit (or label minimum) when no height is chosen', () => {
    expect(resolveKeyHeight(300, 50, null, true)).toBe(LABEL_KEY_HEIGHT);
    expect(resolveKeyHeight(300, 20, null, false)).toBeCloseTo(15, 6);
  });

  it('honours a chosen height, within the allowed range', () => {
    expect(resolveKeyHeight(300, 30, 20, false)).toBe(20);
    expect(resolveKeyHeight(300, 30, 999, false)).toBe(ROW_HEIGHT_MAX);
  });

  it('never leaves an empty strip under the lowest row', () => {
    // 24 wierszy po 8 px = 192 < 300 → wiersze rosną do wysokości obszaru
    expect(resolveKeyHeight(300, 24, 8, false) * 24).toBeGreaterThanOrEqual(300 - 1e-9);
  });

  it('clamps and rounds user input', () => {
    expect(clampRowHeight(2)).toBe(ROW_HEIGHT_MIN);
    expect(clampRowHeight(14.6)).toBe(15);
  });
});
