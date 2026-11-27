/**
 * Pure Piano Roll model: pitch range, visible note lookup (binary search on `onset_ms`),
 * time/pitch ↔ CSS pixel mapping, the bar grid and the ruler. No DOM and no canvas, so it is fully testable.
 */
import type { DetectedNote } from '../../../types/analysis';

/** Piano keyboard range (A0..C8). */
export const MIDI_FLOOR = 21;
export const MIDI_CEIL = 108;
/** Margin (in semitones) above the highest and below the lowest note. */
export const PITCH_MARGIN = 2;
/** Minimum number of rows, so a single note does not stretch over the whole screen. */
export const MIN_ROWS = 24;

export const MIN_PX_PER_SEC = 20;
export const MAX_PX_PER_SEC = 400;
export const DEFAULT_PX_PER_SEC = 80;
/** In "Follow" mode the playhead stands at this fraction of the note area width. */
export const FOLLOW_RATIO = 0.3;

export interface PitchRange {
  minMidi: number;
  maxMidi: number;
}

/** Pitch range from the data: min/max ± margin, limited to the keyboard, at least `MIN_ROWS` rows. */
export function computePitchRange(notes: readonly DetectedNote[]): PitchRange {
  if (notes.length === 0) return { minMidi: 48, maxMidi: 48 + MIN_ROWS - 1 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) {
    if (n.midi_pitch < lo) lo = n.midi_pitch;
    if (n.midi_pitch > hi) hi = n.midi_pitch;
  }
  let minMidi = Math.max(MIDI_FLOOR, lo - PITCH_MARGIN);
  let maxMidi = Math.min(MIDI_CEIL, hi + PITCH_MARGIN);
  // Pad to the minimum number of rows (up first, then down, within the keyboard).
  while (maxMidi - minMidi + 1 < MIN_ROWS) {
    if (maxMidi < MIDI_CEIL) maxMidi += 1;
    if (maxMidi - minMidi + 1 >= MIN_ROWS) break;
    if (minMidi > MIDI_FLOOR) minMidi -= 1;
  }
  return { minMidi, maxMidi };
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function isBlackKey(midi: number): boolean {
  const n = ((midi % 12) + 12) % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

/** Scientific pitch notation for a MIDI note number (e.g. 60 → `C4`, 61 → `C#4`). */
export function midiNoteName(midi: number): string {
  const n = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[n]}${octave}`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------------------------------------------
// Note index
// ---------------------------------------------------------------------------------------------------------------

export interface NoteIndex {
  /** Notes sorted ascending by `onset_ms`. */
  notes: DetectedNote[];
  /** The longest note (ms): bounds the backward search for notes that started before the window. */
  maxDurationMs: number;
}

export function buildNoteIndex(notes: readonly DetectedNote[]): NoteIndex {
  const sorted = [...notes].sort((a, b) => a.onset_ms - b.onset_ms);
  let maxDurationMs = 0;
  for (const n of sorted) if (n.duration_ms > maxDurationMs) maxDurationMs = n.duration_ms;
  return { notes: sorted, maxDurationMs };
}

/** The first index `i` for which `notes[i].onset_ms >= ms` (the array length when there is none). */
function lowerBound(notes: readonly DetectedNote[], ms: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].onset_ms < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Half-open index range `[start, end)` of the notes that MAY overlap the window `[t0, t1]`.
 * The start is moved back by `maxDurationMs`, so notes that started before the window but last into it are included;
 * the caller filters out those that still end before `t0` (`noteOverlaps`).
 */
export function visibleNoteRange(index: NoteIndex, t0: number, t1: number): [number, number] {
  const start = lowerBound(index.notes, t0 - index.maxDurationMs);
  // The first note that starts only after the window.
  const end = lowerBound(index.notes, Math.floor(t1) + 1);
  return [start, Math.max(start, end)];
}

export function noteOverlaps(note: DetectedNote, t0: number, t1: number): boolean {
  return note.onset_ms <= t1 && note.onset_ms + note.duration_ms >= t0;
}

export function isNoteActive(note: DetectedNote, positionMs: number): boolean {
  return positionMs >= note.onset_ms && positionMs < note.onset_ms + note.duration_ms;
}

// ---------------------------------------------------------------------------------------------------------------
// Coordinate mapping (CSS pixels)
// ---------------------------------------------------------------------------------------------------------------

export interface Layout {
  width: number;
  height: number;
  /** Width of the keyboard column on the left. */
  keyWidth: number;
  /** Height of the time ruler at the top. */
  rulerHeight: number;
  /** Height of the minimap at the bottom (0 = hidden). */
  minimapHeight: number;
}

export const KEY_WIDTH = 56;
export const RULER_HEIGHT = 20;
export const MINIMAP_HEIGHT = 34;
/** Below this canvas height the minimap is hidden. */
export const MINIMAP_MIN_CANVAS_HEIGHT = 220;
export const MIN_KEY_HEIGHT = 5;
/** Minimum row height when note labels are on (readable text; the rest of the range scrolls). */
export const LABEL_KEY_HEIGHT = 16;
export const MAX_KEY_HEIGHT = 22;

export function computeLayout(width: number, height: number): Layout {
  return {
    width,
    height,
    keyWidth: KEY_WIDTH,
    rulerHeight: RULER_HEIGHT,
    minimapHeight: height >= MINIMAP_MIN_CANVAS_HEIGHT ? MINIMAP_HEIGHT : 0,
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Note area (without the keyboard, ruler and minimap). */
export function rollRect(layout: Layout): Rect {
  return {
    x: layout.keyWidth,
    y: layout.rulerHeight,
    w: Math.max(0, layout.width - layout.keyWidth),
    h: Math.max(0, layout.height - layout.rulerHeight - layout.minimapHeight),
  };
}

export function minimapRect(layout: Layout): Rect {
  return {
    x: layout.keyWidth,
    y: layout.height - layout.minimapHeight,
    w: Math.max(0, layout.width - layout.keyWidth),
    h: layout.minimapHeight,
  };
}

/** Time axis: `originMs` is the time at the left edge of the note area. */
export interface TimeAxis {
  originMs: number;
  pxPerSec: number;
  left: number;
}

export function timeToX(axis: TimeAxis, ms: number): number {
  return axis.left + ((ms - axis.originMs) / 1000) * axis.pxPerSec;
}

export function xToTime(axis: TimeAxis, x: number): number {
  return axis.originMs + ((x - axis.left) / axis.pxPerSec) * 1000;
}

/** Pitch axis: row 0 is `maxMidi`; `scrollRows` moves the view down (in rows, fractions allowed). */
export interface PitchAxis {
  maxMidi: number;
  minMidi: number;
  keyHeight: number;
  top: number;
  scrollRows: number;
}

export function pitchToY(axis: PitchAxis, midi: number): number {
  return axis.top + (axis.maxMidi - midi - axis.scrollRows) * axis.keyHeight;
}

/** Pitch (MIDI) of the row under pixel `y`; the result can fall outside the axis range. */
export function yToPitch(axis: PitchAxis, y: number): number {
  const row = Math.floor((y - axis.top) / axis.keyHeight + axis.scrollRows);
  return axis.maxMidi - row;
}

export function rowCount(range: PitchRange): number {
  return range.maxMidi - range.minMidi + 1;
}

/** Row height: fills the area, but within readability limits (more rows → scrolling). */
export function computeKeyHeight(rollHeight: number, rows: number, minKeyHeight = MIN_KEY_HEIGHT): number {
  if (rows <= 0 || rollHeight <= 0) return minKeyHeight;
  return clamp(rollHeight / rows, minKeyHeight, MAX_KEY_HEIGHT);
}

/** Manually chosen row height (px); `null` in the view = automatic. */
export const ROW_HEIGHT_MIN = 8;
export const ROW_HEIGHT_MAX = 40;
export const ROW_HEIGHT_STEP = 2;
/** The ± buttons start from this value while the height is still automatic. */
export const DEFAULT_ROW_HEIGHT = 14;

export function clampRowHeight(px: number): number {
  return clamp(Math.round(px), ROW_HEIGHT_MIN, ROW_HEIGHT_MAX);
}

/**
 * Row height: automatic (`rowHeight === null`: fills the area, with labels no less than `LABEL_KEY_HEIGHT`)
 * or chosen by the user, never smaller than needed for the range to fill the area (no empty strip below the notes).
 */
export function resolveKeyHeight(rollHeight: number, rows: number, rowHeight: number | null, showLabels: boolean): number {
  if (rowHeight === null) return computeKeyHeight(rollHeight, rows, showLabels ? LABEL_KEY_HEIGHT : undefined);
  const fit = rows > 0 ? rollHeight / rows : 0;
  return clamp(Math.max(clampRowHeight(rowHeight), fit), ROW_HEIGHT_MIN, Math.max(ROW_HEIGHT_MAX, fit));
}

export function maxScrollRows(rollHeight: number, keyHeight: number, rows: number): number {
  return Math.max(0, rows - rollHeight / keyHeight);
}

/** Width of a monospace font character relative to its size (with headroom for `ui-monospace` fallbacks). */
const LABEL_CHAR_EM = 0.62;
export const MIN_LABEL_FONT_PX = 8;

/**
 * Label font size that fits in `room` px: `maxFontPx` if there is enough space, otherwise
 * reduced (not below `MIN_LABEL_FONT_PX`); `null` when even then the text does not fit.
 */
export function fitLabelFontPx(chars: number, room: number, maxFontPx: number): number | null {
  if (chars <= 0 || room <= 0) return null;
  const fitting = Math.floor(room / (chars * LABEL_CHAR_EM));
  const px = Math.min(maxFontPx, fitting);
  return px >= MIN_LABEL_FONT_PX ? px : null;
}

export interface PitchSpan {
  lo: number;
  hi: number;
}

/** The lowest and highest pitch of the notes overlapping the time window (`null` when the window is empty). */
export function pitchSpanInWindow(index: NoteIndex, t0: number, t1: number): PitchSpan | null {
  let lo = Infinity;
  let hi = -Infinity;
  const [first, last] = visibleNoteRange(index, t0, t1);
  for (let i = first; i < last; i++) {
    const n = index.notes[i];
    if (!noteOverlaps(n, t0, t1)) continue;
    if (n.midi_pitch < lo) lo = n.midi_pitch;
    if (n.midi_pitch > hi) hi = n.midi_pitch;
  }
  return hi >= lo ? { lo, hi } : null;
}

/** Rows (from the top, fractional) taken by the pitch range: `[top edge, bottom edge]`. */
function spanRows(maxMidi: number, span: PitchSpan): [number, number] {
  return [maxMidi - span.hi, maxMidi - span.lo + 1];
}

/**
 * Vertical scroll goal in Follow mode: the smallest move after which the whole `span` range is visible
 * (no jitter when it already fits). When the range is taller than the window, it is centred.
 */
export function followScrollGoal(args: {
  span: PitchSpan | null;
  maxMidi: number;
  viewRows: number;
  current: number;
  maxScroll: number;
}): number {
  const { span, maxMidi, viewRows, current, maxScroll } = args;
  if (!span) return clamp(current, 0, maxScroll);
  const [top, bottom] = spanRows(maxMidi, span);
  const margin = Math.min(0.5, Math.max(0, (viewRows - (bottom - top)) / 2));
  let goal = current;
  if (bottom - top > viewRows) goal = (top + bottom) / 2 - viewRows / 2;
  else if (top - margin < current) goal = top - margin;
  else if (bottom + margin > current + viewRows) goal = bottom + margin - viewRows;
  return clamp(goal, 0, maxScroll);
}

/** Whether the time window has notes fully above / below the visible rows (for the edge markers). */
export function hiddenNotesBeyondView(args: {
  span: PitchSpan | null;
  maxMidi: number;
  viewRows: number;
  scrollRows: number;
}): { above: boolean; below: boolean } {
  const { span, maxMidi, viewRows, scrollRows } = args;
  if (!span) return { above: false, below: false };
  const [top, bottom] = spanRows(maxMidi, span);
  return { above: top + 1 <= scrollRows + 1e-6, below: bottom - 1 >= scrollRows + viewRows - 1e-6 };
}

// ---------------------------------------------------------------------------------------------------------------
// Time view: follow / free
// ---------------------------------------------------------------------------------------------------------------

/** Time axis start in "Follow" mode: the playhead stands at `FOLLOW_RATIO` of the width, but no time < 0 is shown. */
export function followOriginMs(positionMs: number, rollWidth: number, pxPerSec: number): number {
  const origin = positionMs - ((rollWidth * FOLLOW_RATIO) / pxPerSec) * 1000;
  return Math.max(0, origin);
}

/** Clamps the axis start to `[0, max(0, duration − window width)]` (in "Free" mode). */
export function clampOriginMs(originMs: number, durationMs: number, rollWidth: number, pxPerSec: number): number {
  const visibleMs = (rollWidth / pxPerSec) * 1000;
  return clamp(originMs, 0, Math.max(0, durationMs - visibleMs));
}

/** Zoom around a point on the screen (the time under the cursor stays under the cursor). */
export function zoomAround(axis: TimeAxis, anchorX: number, nextPxPerSec: number): TimeAxis {
  const pxPerSec = clamp(nextPxPerSec, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
  const anchorMs = xToTime(axis, anchorX);
  return { ...axis, pxPerSec, originMs: anchorMs - ((anchorX - axis.left) / pxPerSec) * 1000 };
}

// ---------------------------------------------------------------------------------------------------------------
// Grid and ruler
// ---------------------------------------------------------------------------------------------------------------

export interface GridLine {
  ms: number;
  /** Bar boundary (a stronger line). */
  bar: boolean;
}

/** Smallest gap (px) between grid lines, below which lines are skipped. */
const MIN_GRID_SPACING_PX = 7;
const BEATS_PER_BAR = 4;
/** Guard against a loop of a million steps at extreme zoom-out. */
const MAX_GRID_LINES = 2000;

/**
 * Grid lines visible in the window `[t0, t1]` (from the track start, 4/4 time). Only what is visible is shown:
 * at low zoom only the bars remain, and when even those are too dense, nothing.
 */
export function visibleGridLines(t0: number, t1: number, bpm: number, pxPerSec: number): GridLine[] {
  if (!Number.isFinite(bpm) || bpm <= 0 || t1 <= t0) return [];
  const beatMs = 60000 / bpm;
  const beatPx = (beatMs / 1000) * pxPerSec;
  const barPx = beatPx * BEATS_PER_BAR;
  if (barPx < MIN_GRID_SPACING_PX) return [];
  const showBeats = beatPx >= MIN_GRID_SPACING_PX;
  const stepMs = showBeats ? beatMs : beatMs * BEATS_PER_BAR;
  const first = Math.max(0, Math.floor(t0 / stepMs));
  const lines: GridLine[] = [];
  for (let i = first; lines.length < MAX_GRID_LINES; i++) {
    const ms = i * stepMs;
    if (ms > t1) break;
    lines.push({ ms, bar: showBeats ? i % BEATS_PER_BAR === 0 : true });
  }
  return lines;
}

const RULER_STEPS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
/** Minimum gap (px) between ruler labels. */
const RULER_MIN_LABEL_PX = 64;

export interface RulerTick {
  ms: number;
}

/** Time ruler marks in the window `[t0, t1]`; the step is chosen so the labels do not overlap. */
export function rulerTicks(t0: number, t1: number, pxPerSec: number): RulerTick[] {
  if (t1 <= t0 || pxPerSec <= 0) return [];
  const stepSec = RULER_STEPS_SEC.find((s) => s * pxPerSec >= RULER_MIN_LABEL_PX) ?? RULER_STEPS_SEC[RULER_STEPS_SEC.length - 1];
  const stepMs = stepSec * 1000;
  const ticks: RulerTick[] = [];
  for (let ms = Math.max(0, Math.ceil(t0 / stepMs) * stepMs); ms <= t1 && ticks.length < MAX_GRID_LINES; ms += stepMs) {
    ticks.push({ ms });
  }
  return ticks;
}

// ---------------------------------------------------------------------------------------------------------------
// Minimap and hit testing
// ---------------------------------------------------------------------------------------------------------------

/**
 * Note density in `buckets` equal intervals of the whole track, normalised to `0..1`.
 * Counts the notes sounding in an interval (not only the ones starting in it).
 */
export function computeDensity(notes: readonly DetectedNote[], durationMs: number, buckets: number): number[] {
  const n = Math.max(0, Math.floor(buckets));
  if (n === 0 || durationMs <= 0) return [];
  const counts = new Array<number>(n).fill(0);
  const bucketMs = durationMs / n;
  for (const note of notes) {
    const from = clamp(Math.floor(note.onset_ms / bucketMs), 0, n - 1);
    const to = clamp(Math.floor((note.onset_ms + note.duration_ms) / bucketMs), 0, n - 1);
    for (let i = from; i <= to; i++) counts[i] += 1;
  }
  let peak = 0;
  for (const c of counts) if (c > peak) peak = c;
  return peak === 0 ? counts : counts.map((c) => c / peak);
}

export interface HitArgs {
  index: NoteIndex;
  time: TimeAxis;
  pitch: PitchAxis;
  x: number;
  y: number;
  /** Extra tolerance (px) around short notes, so they can be hit with the mouse. */
  slopPx?: number;
}

/** Note under the cursor (the one started latest wins, because it is drawn on top), or `null`. */
export function hitTestNote({ index, time, pitch, x, y, slopPx = 2 }: HitArgs): DetectedNote | null {
  const midi = yToPitch(pitch, y);
  if (midi < pitch.minMidi || midi > pitch.maxMidi) return null;
  const slopMs = (slopPx / time.pxPerSec) * 1000;
  // Notes shorter than 4 px are drawn with a minimum width, so the hit test uses the drawn rectangle.
  const minDrawnMs = (4 / time.pxPerSec) * 1000;
  const t = xToTime(time, x);
  const [start, end] = visibleNoteRange(index, t - slopMs - minDrawnMs, t + slopMs);
  for (let i = end - 1; i >= start; i--) {
    const note = index.notes[i];
    if (note.midi_pitch !== midi) continue;
    const drawnMs = Math.max(note.duration_ms, minDrawnMs);
    if (t >= note.onset_ms - slopMs && t <= note.onset_ms + drawnMs + slopMs) return note;
  }
  return null;
}
