/**
 * Warstwy statyczne Piano-Rolla, renderowane do canvasów offscreen i tylko blitowane w każdej klatce:
 * klawiatura + tło wierszy oraz minimapa gęstości. Przebudowa wyłącznie przy zmianie rozmiaru / DPR / zakresu /
 * przewinięcia pionowego / danych — nigdy przy ruchu głowicy.
 */
import { computeBackingSize } from '../../../utils/canvasDraw';
import { isBlackKey, type PitchAxis } from './pianoRollModel';

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
  noteLabel: '#ffffff',
  noteLabelDark: '#111827',
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
  // Rysujemy w pikselach CSS; bufor jest `dpr` razy gęstszy, więc linie i tekst są ostre.
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
    a.keyWidth === b.keyWidth
  );
}

/**
 * Warstwa: tło wierszy (paski czarnych/białych klawiszy, linie podziału, mocniejsza linia przy C) w obszarze
 * nut oraz kolumna klawiatury. Zwraca dwa osobne canvasy (rysowane w różnych miejscach i kolejności).
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
  // Układ współrzędnych jak na ekranie (oś `top` względem warstwy = 0).
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
      if (m % 12 === 0) {
        kc.fillStyle = COLORS.keyLabel;
        kc.font = FONT_KEY_LABEL;
        kc.fillText(`C${Math.floor(m / 12) - 1}`, 6, y + key.keyHeight / 2);
      }
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
  /** Tożsamość tablicy gęstości (zmiana danych → przebudowa). */
  density: readonly number[];
}

export function minimapKeyEquals(a: MinimapKey | null, b: MinimapKey): boolean {
  return a !== null && a.width === b.width && a.height === b.height && a.dpr === b.dpr && a.density === b.density;
}

/** Warstwa minimapy: słupki gęstości nut dla całego utworu. */
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
