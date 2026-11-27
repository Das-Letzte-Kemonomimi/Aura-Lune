/**
 * Static Piano Roll layers, rendered to offscreen canvases and only blitted on each frame:
 * the keyboard + row background, and the density minimap. Rebuilt only when the size / DPR / range /
 * vertical scroll / data change, never when the playhead moves.
 */
import { computeBackingSize } from '../../../utils/canvasDraw';
import { isBlackKey, midiNoteName, type PitchAxis } from './pianoRollModel';

export const COLORS = {
  background: '#090a12',
  rowWhite: '#1a2133',
  rowBlack: '#111827',
  rowLine: 'rgba(51, 65, 85, 0.55)',
  rowLineOctave: 'rgba(148, 163, 184, 0.45)',
  keyWhite: '#f1f5f9',
  keyBlack: '#0b1020',
  keyBorder: '#475569',
  keyLabel: '#0f172a',
  keyLabelOnBlack: '#e2e8f0',
  keyActive: '#f43f5e',
  beat: 'rgba(100, 116, 139, 0.16)',
  bar: 'rgba(148, 163, 184, 0.34)',
  rulerBg: '#0d1020',
  rulerText: '#94a3b8',
  rulerTick: 'rgba(148, 163, 184, 0.5)',
  playhead: '#ec4899',
  noteMelody: '#c084fc',
  noteBass: '#38bdf8',
  noteDrums: '#facc15',
  noteActive: '#fb7185',
  // Dark text has ≥ 7:1 contrast on purple, blue, yellow and pink notes (white ≈ 2.4:1 on purple).
  noteLabel: '#0b1020',
  noteOutline: 'rgba(255, 255, 255, 0.9)',
  scrollTrack: 'rgba(148, 163, 184, 0.18)',
  scrollThumb: 'rgba(226, 232, 240, 0.6)',
  edgeMarker: 'rgba(236, 72, 153, 0.45)',
  edgeMarkerFade: 'rgba(236, 72, 153, 0)',
  edgeMarkerArrow: 'rgba(255, 255, 255, 0.9)',
  minimapBg: '#0d1020',
  minimapBar: 'rgba(192, 132, 252, 0.7)',
  minimapView: 'rgba(255, 255, 255, 0.14)',
  minimapViewBorder: 'rgba(255, 255, 255, 0.55)',
} as const;

export const FONT_MONO = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
export const FONT_KEY_LABEL = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
export const FONT_KEY_LABEL_COMPACT = 'bold 7.5px ui-monospace, SFMono-Regular, Menlo, monospace';
const MIN_ALL_KEY_LABELS_HEIGHT = 9;

export function drawPianoKeyLabel(
  ctx: CanvasRenderingContext2D,
  midi: number,
  y: number,
  keyHeight: number,
  showAllKeyLabels: boolean,
  onDark: boolean,
): void {
  const isC = ((midi % 12) + 12) % 12 === 0;
  if (!isC && (!showAllKeyLabels || keyHeight < MIN_ALL_KEY_LABELS_HEIGHT)) return;
  ctx.fillStyle = onDark ? COLORS.keyLabelOnBlack : COLORS.keyLabel;
  ctx.font = keyHeight < 11 ? FONT_KEY_LABEL_COMPACT : FONT_KEY_LABEL;
  ctx.textBaseline = 'middle';
  ctx.fillText(midiNoteName(midi), 6, y + keyHeight / 2);
}

export function noteColor(stem: string | undefined): string {
  if (stem === 'bass') return COLORS.noteBass;
  if (stem === 'drums') return COLORS.noteDrums;
  return COLORS.noteMelody;
}

function makeLayer(width: number, height: number, dpr: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  const size = computeBackingSize(width, height, dpr);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  // Drawing happens in CSS pixels; the buffer is `dpr` times denser, so lines and text are sharp.
  ctx?.setTransform(size.width / Math.max(1, width), 0, 0, size.height / Math.max(1, height), 0, 0);
  return { canvas, ctx };
}

export interface RowsLayerKey {
  width: number;
  height: number;
  dpr: number;
  minMidi: number;
  maxMidi: number;
  keyHeight: number;
  scrollRows: number;
  keyWidth: number;
  showAllKeyLabels: boolean;
}

export function rowsKeyEquals(a: RowsLayerKey | null, b: RowsLayerKey): boolean {
  return (
    a !== null &&
    a.width === b.width &&
    a.height === b.height &&
    a.dpr === b.dpr &&
    a.minMidi === b.minMidi &&
    a.maxMidi === b.maxMidi &&
    a.keyHeight === b.keyHeight &&
    a.scrollRows === b.scrollRows &&
    a.keyWidth === b.keyWidth &&
    a.showAllKeyLabels === b.showAllKeyLabels
  );
}

/**
 * Layer: row background (black/white key stripes, divider lines, a stronger line at C) in the note
 * area, plus the keyboard column. Returns two separate canvases (drawn in different places and order).
 */
export function renderRowsLayer(
  key: RowsLayerKey,
  axis: PitchAxis,
): { rows: HTMLCanvasElement; keys: HTMLCanvasElement } {
  const rollW = Math.max(1, key.width - key.keyWidth);
  const rows = makeLayer(rollW, key.height, key.dpr);
  const keys = makeLayer(key.keyWidth, key.height, key.dpr);
  const rc = rows.ctx;
  const kc = keys.ctx;
  // Coordinate system as on screen (the `top` axis relative to the layer = 0).
  const local: PitchAxis = { ...axis, top: 0 };
  const rowY = (midi: number) => (local.maxMidi - midi - local.scrollRows) * local.keyHeight;

  if (rc) {
    rc.fillStyle = COLORS.background;
    rc.fillRect(0, 0, rollW, key.height);
  }
  if (kc) {
    kc.fillStyle = COLORS.background;
    kc.fillRect(0, 0, key.keyWidth, key.height);
    kc.textBaseline = 'middle';
  }

  for (let m = key.minMidi; m <= key.maxMidi; m++) {
    const y = rowY(m);
    if (y + key.keyHeight < 0 || y > key.height) continue;
    const black = isBlackKey(m);
    if (rc) {
      rc.fillStyle = black ? COLORS.rowBlack : COLORS.rowWhite;
      rc.fillRect(0, y, rollW, key.keyHeight);
      rc.fillStyle = m % 12 === 0 ? COLORS.rowLineOctave : COLORS.rowLine;
      rc.fillRect(0, y + key.keyHeight - 1, rollW, 1);
    }
    if (kc) {
      kc.fillStyle = black ? COLORS.keyBlack : COLORS.keyWhite;
      kc.fillRect(0, y, key.keyWidth, key.keyHeight);
      kc.fillStyle = COLORS.keyBorder;
      kc.fillRect(0, y + key.keyHeight - 1, key.keyWidth, 1);
      drawPianoKeyLabel(kc, m, y, key.keyHeight, key.showAllKeyLabels, black);
    }
  }
  if (kc) {
    kc.fillStyle = COLORS.keyBorder;
    kc.fillRect(key.keyWidth - 1, 0, 1, key.height);
  }
  return { rows: rows.canvas, keys: keys.canvas };
}

export interface MinimapKey {
  width: number;
  height: number;
  dpr: number;
  /** Identity of the density array (a data change → rebuild). */
  density: readonly number[];
}

export function minimapKeyEquals(a: MinimapKey | null, b: MinimapKey): boolean {
  return a !== null && a.width === b.width && a.height === b.height && a.dpr === b.dpr && a.density === b.density;
}

/** Minimap layer: note density bars for the whole track. */
export function renderMinimapLayer(key: MinimapKey): HTMLCanvasElement {
  const { canvas, ctx } = makeLayer(key.width, key.height, key.dpr);
  if (!ctx) return canvas;
  ctx.fillStyle = COLORS.minimapBg;
  ctx.fillRect(0, 0, key.width, key.height);
  const n = key.density.length;
  if (n === 0) return canvas;
  const barW = key.width / n;
  const inner = key.height - 6;
  ctx.fillStyle = COLORS.minimapBar;
  for (let i = 0; i < n; i++) {
    const h = Math.max(key.density[i] > 0 ? 1 : 0, key.density[i] * inner);
    if (h <= 0) continue;
    ctx.fillRect(i * barW, key.height - 3 - h, Math.max(1, barW - 0.5), h);
  }
  return canvas;
}
