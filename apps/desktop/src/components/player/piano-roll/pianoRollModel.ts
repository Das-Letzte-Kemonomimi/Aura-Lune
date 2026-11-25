/**
 * Czysty model Piano-Rolla: zakres wysokości, wyszukiwanie widocznych nut (binarnie po `onset_ms`),
 * mapowanie czas/wysokość ↔ piksele CSS, siatka taktów i linijka. Bez DOM i canvasu — w całości testowalny.
 */
import type { DetectedNote } from '../../../types/analysis';

/** Zakres klawiatury fortepianu (A0..C8). */
export const MIDI_FLOOR = 21;
export const MIDI_CEIL = 108;
/** Margines (w półtonach) nad najwyższą i pod najniższą nutą. */
export const PITCH_MARGIN = 2;
/** Minimalna liczba wierszy, żeby pojedyncza nuta nie rozciągała się na cały ekran. */
export const MIN_ROWS = 24;

export const MIN_PX_PER_SEC = 20;
export const MAX_PX_PER_SEC = 400;
export const DEFAULT_PX_PER_SEC = 80;
/** W trybie „Follow” głowica stoi w tym ułamku szerokości obszaru nut. */
export const FOLLOW_RATIO = 0.3;

export interface PitchRange {
  minMidi: number;
  maxMidi: number;
}

/** Zakres wysokości z danych: min/max ± margines, ograniczony do klawiatury, min. `MIN_ROWS` wierszy. */
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
  // Dopełnienie do minimalnej liczby wierszy (najpierw w górę, potem w dół, w granicach klawiatury).
  while (maxMidi - minMidi + 1 < MIN_ROWS) {
    if (maxMidi < MIDI_CEIL) maxMidi += 1;
    if (maxMidi - minMidi + 1 >= MIN_ROWS) break;
    if (minMidi > MIDI_FLOOR) minMidi -= 1;
  }
  return { minMidi, maxMidi };
}

export function isBlackKey(midi: number): boolean {
  const n = ((midi % 12) + 12) % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------------------------------------------
// Indeks nut
// ---------------------------------------------------------------------------------------------------------------

export interface NoteIndex {
  /** Nuty posortowane rosnąco po `onset_ms`. */
  notes: DetectedNote[];
  /** Najdłuższa nuta (ms) — ogranicza „wstecz” poszukiwanie nut zaczętych przed oknem. */
  maxDurationMs: number;
}

export function buildNoteIndex(notes: readonly DetectedNote[]): NoteIndex {
  const sorted = [...notes].sort((a, b) => a.onset_ms - b.onset_ms);
  let maxDurationMs = 0;
  for (const n of sorted) if (n.duration_ms > maxDurationMs) maxDurationMs = n.duration_ms;
  return { notes: sorted, maxDurationMs };
}

/** Pierwszy indeks `i`, dla którego `notes[i].onset_ms >= ms` (długość tablicy, gdy brak). */
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
 * Półotwarty przedział indeksów `[start, end)` nut, które MOGĄ nachodzić na okno `[t0, t1]`.
 * Początek cofnięty o `maxDurationMs`, więc nuty zaczęte przed oknem, a trwające w nim, są uwzględnione;
 * wywołujący odfiltrowuje te, które jednak kończą się przed `t0` (`noteOverlaps`).
 */
export function visibleNoteRange(index: NoteIndex, t0: number, t1: number): [number, number] {
  const start = lowerBound(index.notes, t0 - index.maxDurationMs);
  // Pierwsza nuta zaczynająca się dopiero po oknie.
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
// Mapowanie współrzędnych (piksele CSS)
// ---------------------------------------------------------------------------------------------------------------

export interface Layout {
  width: number;
  height: number;
  /** Szerokość kolumny klawiatury po lewej. */
  keyWidth: number;
  /** Wysokość linijki czasu u góry. */
  rulerHeight: number;
  /** Wysokość minimapy u dołu (0 = ukryta). */
  minimapHeight: number;
}

export const KEY_WIDTH = 56;
export const RULER_HEIGHT = 20;
export const MINIMAP_HEIGHT = 34;
/** Poniżej tej wysokości canvasu minimapa jest ukrywana. */
export const MINIMAP_MIN_CANVAS_HEIGHT = 220;
export const MIN_KEY_HEIGHT = 5;
/** Minimalna wysokość wiersza, gdy włączone są podpisy nut (czytelny tekst; reszta zakresu = przewijanie). */
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

/** Obszar nut (bez klawiatury, linijki i minimapy). */
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

/** Oś czasu: `originMs` to czas na lewej krawędzi obszaru nut. */
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

/** Oś wysokości: wiersz 0 to `maxMidi`; `scrollRows` przesuwa widok w dół (w wierszach, ułamki dozwolone). */
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

/** Wysokość (MIDI) wiersza pod pikselem `y`; wynik może wykraczać poza zakres osi. */
export function yToPitch(axis: PitchAxis, y: number): number {
  const row = Math.floor((y - axis.top) / axis.keyHeight + axis.scrollRows);
  return axis.maxMidi - row;
}

export function rowCount(range: PitchRange): number {
  return range.maxMidi - range.minMidi + 1;
}

/** Wysokość wiersza: wypełnia obszar, ale w granicach czytelności (przy większej liczbie wierszy → przewijanie). */
export function computeKeyHeight(rollHeight: number, rows: number, minKeyHeight = MIN_KEY_HEIGHT): number {
  if (rows <= 0 || rollHeight <= 0) return minKeyHeight;
  return clamp(rollHeight / rows, minKeyHeight, MAX_KEY_HEIGHT);
}

export function maxScrollRows(rollHeight: number, keyHeight: number, rows: number): number {
  return Math.max(0, rows - rollHeight / keyHeight);
}

// ---------------------------------------------------------------------------------------------------------------
// Widok czasowy: follow / free
// ---------------------------------------------------------------------------------------------------------------

/** Początek osi czasu w trybie „Follow”: głowica stoi w `FOLLOW_RATIO` szerokości, ale nie pokazujemy czasu < 0. */
export function followOriginMs(positionMs: number, rollWidth: number, pxPerSec: number): number {
  const origin = positionMs - ((rollWidth * FOLLOW_RATIO) / pxPerSec) * 1000;
  return Math.max(0, origin);
}

/** Ogranicza początek osi do `[0, max(0, duration − szerokość okna)]` (w trybie „Free”). */
export function clampOriginMs(originMs: number, durationMs: number, rollWidth: number, pxPerSec: number): number {
  const visibleMs = (rollWidth / pxPerSec) * 1000;
  return clamp(originMs, 0, Math.max(0, durationMs - visibleMs));
}

/** Zoom względem punktu na ekranie (czas pod kursorem zostaje pod kursorem). */
export function zoomAround(axis: TimeAxis, anchorX: number, nextPxPerSec: number): TimeAxis {
  const pxPerSec = clamp(nextPxPerSec, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
  const anchorMs = xToTime(axis, anchorX);
  return { ...axis, pxPerSec, originMs: anchorMs - ((anchorX - axis.left) / pxPerSec) * 1000 };
}

// ---------------------------------------------------------------------------------------------------------------
// Siatka i linijka
// ---------------------------------------------------------------------------------------------------------------

export interface GridLine {
  ms: number;
  /** Granica taktu (mocniejsza kreska). */
  bar: boolean;
}

/** Najmniejszy odstęp (px) między liniami siatki, poniżej którego linie są pomijane. */
const MIN_GRID_SPACING_PX = 7;
const BEATS_PER_BAR = 4;
/** Zabezpieczenie przed pętlą o milionie kroków przy skrajnym oddaleniu. */
const MAX_GRID_LINES = 2000;

/**
 * Linie siatki widoczne w oknie `[t0, t1]` (od początku utworu, metrum 4/4). Pokazujemy tylko to, co widać:
 * przy małym powiększeniu zostają same takty, a gdy i one są zbyt gęste — nic.
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
/** Minimalny odstęp (px) między etykietami linijki. */
const RULER_MIN_LABEL_PX = 64;

export interface RulerTick {
  ms: number;
}

/** Znaczniki linijki czasu w oknie `[t0, t1]`; krok dobrany tak, by etykiety się nie nakładały. */
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
// Minimapa i trafienia
// ---------------------------------------------------------------------------------------------------------------

/**
 * Gęstość nut w `buckets` równych przedziałach całego utworu, znormalizowana do `0..1`.
 * Liczy się nuty brzmiące w danym przedziale (a nie tylko zaczynające się w nim).
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
  /** Dodatkowa tolerancja (px) wokół krótkich nut, żeby dało się je trafić myszą. */
  slopPx?: number;
}

/** Nuta pod kursorem (najpóźniej zaczęta wygrywa, bo jest rysowana na wierzchu) albo `null`. */
export function hitTestNote({ index, time, pitch, x, y, slopPx = 2 }: HitArgs): DetectedNote | null {
  const midi = yToPitch(pitch, y);
  if (midi < pitch.minMidi || midi > pitch.maxMidi) return null;
  const slopMs = (slopPx / time.pxPerSec) * 1000;
  // Nuty krótsze niż 4 px są rysowane z minimalną szerokością — trafiamy w narysowany prostokąt.
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
