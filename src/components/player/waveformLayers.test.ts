import { describe, expect, it, vi } from 'vitest';
import {
  barLayoutFor,
  blitScrollLayers,
  playedClipX,
  scrollPlayedSplit,
  type WaveLayers,
  type WaveLayerSpec,
} from './waveformLayers';

const spec = (style: WaveLayerSpec['style'], peaks = 40): WaveLayerSpec => ({
  style,
  peaks: Array.from({ length: peaks }, (_, i) => (i * 7) % 100),
  bands: [],
  width: 400,
  height: 66,
  colors: { start: '#f00', end: '#00f', unplayed: '#888' },
});

/** Bars counted as played by the old per-bar rule: centre at or left of the playhead. */
function playedBarsByCentre(s: WaveLayerSpec, currentX: number): number {
  const { count, barWidth, step } = barLayoutFor(s);
  let played = 0;
  for (let i = 0; i < count; i++) if (i * step + barWidth / 2 <= currentX) played++;
  return played;
}

describe('playedClipX', () => {
  it('clips the smooth wave exactly at the playhead, clamped to the width', () => {
    expect(playedClipX(spec('smooth'), 0)).toBe(0);
    expect(playedClipX(spec('smooth'), 123.4)).toBe(123.4);
    expect(playedClipX(spec('smooth'), 999)).toBe(400);
  });

  it.each(['bars', 'mirror'] as const)('%s: the clip shows exactly the bars whose centre passed the playhead', (style) => {
    const s = spec(style);
    const { barWidth, step } = barLayoutFor(s);
    for (let x = 0; x <= 400; x += 0.75) {
      const clip = playedClipX(s, x);
      const expected = playedBarsByCentre(s, x);
      // Bars fully left of the clip edge count as visible-played; the edge never cuts through a bar.
      let visible = 0;
      for (let i = 0; i * step < 400; i++) if (i * step + barWidth <= clip + 1e-9) visible++;
      expect(visible).toBe(expected);
    }
  });
});

describe('scrolling wave strips', () => {
  const UNIT = 6.5 / 3;
  const BAR = 1.5;
  const COUNT = 480;

  it('splits at exactly the bars whose left edge is at or before the needle', () => {
    for (let offset = 0; offset <= COUNT * UNIT; offset += 0.37) {
      const { played, clipX } = scrollPlayedSplit(offset, UNIT, BAR, COUNT);
      let byEdge = 0;
      for (let i = 0; i < COUNT; i++) if (i * UNIT <= offset) byEdge++;
      expect(played).toBe(byEdge);
      // The split lies in the gap after the last played bar and never cuts a bar in half.
      if (played > 0 && played < COUNT) {
        expect(clipX).toBeGreaterThanOrEqual((played - 1) * UNIT + BAR - 1e-9);
        expect(clipX).toBeLessThanOrEqual(played * UNIT + 1e-9);
      }
    }
  });

  it('plays nothing before the start and everything at the end', () => {
    expect(scrollPlayedSplit(-5, UNIT, BAR, COUNT).played).toBe(0);
    const end = scrollPlayedSplit(COUNT * UNIT, UNIT, BAR, COUNT);
    expect(end.played).toBe(COUNT);
    expect(end.clipX).toBeCloseTo(COUNT * UNIT, 9);
  });

  describe('blitScrollLayers', () => {
    const strip = (width: number) => ({ width, height: 70 }) as unknown as HTMLCanvasElement;
    const layers: WaveLayers = { played: strip(1040), unplayed: strip(1040) };

    function blit(offset: number, canvasWidth = 800) {
      const drawImage = vi.fn();
      const ctx = {
        canvas: { width: canvasWidth },
        save: vi.fn(),
        restore: vi.fn(),
        setTransform: vi.fn(),
        drawImage,
      } as unknown as CanvasRenderingContext2D;
      blitScrollLayers(ctx, layers, { playheadX: 400, offset, unitWidth: UNIT, barWidth: BAR, count: COUNT, scaleX: 1 });
      return drawImage.mock.calls as [HTMLCanvasElement, number, number, number, number, number, number, number, number][];
    }

    it('draws only the part of each strip that lands on the canvas', () => {
      for (const offset of [0, 150, 520, 1040]) {
        for (const [, sx, , sw, , dx, , dw] of blit(offset)) {
          expect(sw).toBe(dw);
          expect(dx).toBeGreaterThanOrEqual(0);
          expect(dx + dw).toBeLessThanOrEqual(800);
          expect(sx).toBeGreaterThanOrEqual(0);
          expect(sx + sw).toBeLessThanOrEqual(1040);
        }
      }
    });

    it('puts the played strip left of the needle and the unplayed strip right of it', () => {
      const calls = blit(520);
      const played = calls.find((c) => c[0] === layers.played);
      const unplayed = calls.find((c) => c[0] === layers.unplayed);
      expect(played).toBeDefined();
      expect(unplayed).toBeDefined();
      // Destination of the split: the played slice ends where the unplayed one starts, next to the needle (x = 400).
      const playedEnd = played![5] + played![7];
      expect(playedEnd).toBe(unplayed![5]);
      expect(Math.abs(playedEnd - 400)).toBeLessThanOrEqual(3);
    });

    it('shows next to nothing as played at the very start (only the first bar is at the needle)', () => {
      const calls = blit(0);
      const playedWidth = calls.filter((c) => c[0] === layers.played).reduce((s, c) => s + c[7], 0);
      expect(playedWidth).toBeLessThanOrEqual(2);
    });
  });
});
