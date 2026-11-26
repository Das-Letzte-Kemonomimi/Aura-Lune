import { describe, it, expect } from 'vitest';
import {
  MODE_DRAWERS,
  VISUALIZER_MODES,
  isVisualizerMode,
  nextVisualizerMode,
  type SpectrumDrawState,
  type VisualizerMode,
} from './spectrumModes';
import { GradientCache } from '../../utils/canvasDraw';
import { installCanvasMock } from '../../test/canvasMock';

describe('visualizer modes list', () => {
  it('includes every mode, notably lissajous (was missing from the saved-mode whitelist)', () => {
    expect(VISUALIZER_MODES).toHaveLength(8);
    for (const m of VISUALIZER_MODES) expect(isVisualizerMode(m)).toBe(true);
    expect(isVisualizerMode('lissajous')).toBe(true);
    expect(isVisualizerMode('nope')).toBe(false);
    expect(isVisualizerMode(null)).toBe(false);
  });

  it('cycles through all modes and wraps around', () => {
    const seen: string[] = [];
    let m: VisualizerMode = VISUALIZER_MODES[0];
    for (let i = 0; i < VISUALIZER_MODES.length; i++) {
      seen.push(m);
      m = nextVisualizerMode(m);
    }
    expect(new Set(seen).size).toBe(VISUALIZER_MODES.length);
    expect(m).toBe(VISUALIZER_MODES[0]);
  });
});

describe('mode drawers', () => {
  const mock = installCanvasMock();
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

  const state = (overrides: Partial<SpectrumDrawState> = {}): SpectrumDrawState => ({
    ctx,
    width: 320,
    height: 88,
    bands: Array(16).fill(0.5),
    peaks: Array(16).fill(0.6),
    count: 16,
    isPlaying: true,
    rotation: 1.2,
    time: 3.4,
    gradients: new GradientCache(),
    ...overrides,
  });

  it.each(VISUALIZER_MODES)('%s draws without throwing for normal, silent, single-band and tiny inputs', (mode) => {
    const draw = MODE_DRAWERS[mode];
    expect(() => draw(state())).not.toThrow();
    expect(() => draw(state({ bands: Array(16).fill(0), peaks: Array(16).fill(0), isPlaying: false }))).not.toThrow();
    expect(() => draw(state({ bands: [0.7], peaks: [0.7], count: 1 }))).not.toThrow();
    expect(() => draw(state({ width: 20, height: 10 }))).not.toThrow();
  });

  it.each(VISUALIZER_MODES)('%s leaves the context state balanced (save/restore) and does not leak shadows', (mode) => {
    mock.calls.length = 0;
    MODE_DRAWERS[mode](state());
    const saves = mock.calls.filter((c) => c === 'save').length;
    const restores = mock.calls.filter((c) => c === 'restore').length;
    expect(restores).toBe(saves);
  });

  it('reuses cached gradients instead of creating one per bar per frame', () => {
    const gradients = new GradientCache();
    mock.calls.length = 0;
    MODE_DRAWERS.bars(state({ gradients }));
    const first = mock.calls.filter((c) => c === 'createLinearGradient').length;
    mock.calls.length = 0;
    MODE_DRAWERS.bars(state({ gradients }));
    expect(mock.calls.filter((c) => c === 'createLinearGradient').length).toBe(0);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(1); // all bars of the same height share one gradient
  });

  it('wave mode skips drawing with fewer than two bands (regression: division by zero)', () => {
    mock.calls.length = 0;
    MODE_DRAWERS.wave(state({ bands: [0.5], count: 1 }));
    expect(mock.calls).not.toContain('quadraticCurveTo');
    expect(mock.calls).not.toContain('stroke');
  });
});
