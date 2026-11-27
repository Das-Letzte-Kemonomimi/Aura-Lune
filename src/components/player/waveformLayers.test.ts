import { describe, expect, it } from 'vitest';
import { computeBarLayout } from './waveformGeometry';
import { playedClipX, type WaveLayerSpec } from './waveformLayers';

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
  const { count, barWidth, step } =
    s.style === 'mirror' ? computeBarLayout(s.width, s.peaks.length, 2.5, 2) : computeBarLayout(s.width, s.peaks.length, 3, 2.5);
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
    const { barWidth, step } =
      style === 'mirror' ? computeBarLayout(400, 40, 2.5, 2) : computeBarLayout(400, 40, 3, 2.5);
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
