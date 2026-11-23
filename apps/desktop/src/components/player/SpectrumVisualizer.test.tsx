import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { SpectrumVisualizer } from './SpectrumVisualizer';
import { livePlayback } from '../../state/livePlayback';
import { installCanvasMock, installFakeRaf, type CanvasMock, type FakeRaf } from '../../test/canvasMock';

let raf: FakeRaf;
let canvas: CanvasMock;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  canvas?.restore();
  raf?.restore();
});

function mount(props: { isPlaying: boolean; spectrum?: number[] }, css = { width: 321, height: 89 }, dpr = 1.5) {
  raf = installFakeRaf();
  canvas = installCanvasMock(css);
  canvas.setDpr(dpr);
  return render(<SpectrumVisualizer isPlaying={props.isPlaying} spectrum={props.spectrum ?? []} />);
}

describe('SpectrumVisualizer', () => {
  it('restores a saved lissajous mode (regression: it reverted to bars on reload)', () => {
    localStorage.setItem('auralune_visualizer_mode', 'lissajous');
    const { getByText } = mount({ isPlaying: false });
    expect(getByText('lissajous')).toBeTruthy();
  });

  it('falls back to bars for an unknown saved mode', () => {
    localStorage.setItem('auralune_visualizer_mode', 'bogus');
    const { getByText } = mount({ isPlaying: false });
    expect(getByText('bars')).toBeTruthy();
  });

  it('cycles through all 8 modes on click, persists the choice and wraps around', () => {
    const { container, getByText } = mount({ isPlaying: false });
    const wrapper = container.firstElementChild as HTMLElement;
    const order = ['retro_bars', 'anime_circle', 'oscilloscope', 'wave', 'circular', 'mirrored', 'lissajous', 'bars'];
    for (const expected of order) {
      fireEvent.click(wrapper);
      expect(getByText(expected)).toBeTruthy();
      expect(localStorage.getItem('auralune_visualizer_mode')).toBe(expected);
    }
  });

  it('sleeps when paused and settled, and wakes when playback starts', () => {
    const view = mount({ isPlaying: false });
    for (let i = 0; i < 5 && raf.pending() > 0; i++) raf.step();
    expect(raf.pending()).toBe(0);

    view.rerender(<SpectrumVisualizer isPlaying spectrum={Array(32).fill(0.5)} />);
    expect(raf.pending()).toBe(1);
  });

  it('keeps one loop and does not reallocate the buffer across live spectrum updates at fractional DPR', () => {
    const view = mount({ isPlaying: true, spectrum: Array(32).fill(0.4) });
    for (let i = 0; i < 5; i++) raf.step();
    const widthSets = canvas.widthAssignments();
    const heightSets = canvas.heightAssignments();

    for (let i = 0; i < 20; i++) {
      act(() => livePlayback.publish({ positionMs: i * 100, spectrum: Array(32).fill(0.2 + (i % 5) * 0.1) }));
      view.rerender(<SpectrumVisualizer isPlaying spectrum={Array(32).fill(0.3)} />);
      raf.step();
      expect(raf.pending()).toBe(1);
    }
    expect(canvas.widthAssignments()).toBe(widthSets);
    expect(canvas.heightAssignments()).toBe(heightSets);
  });

  it('renders at the device pixel ratio (sharp on HiDPI) while drawing in CSS pixels', () => {
    mount({ isPlaying: true, spectrum: Array(32).fill(0.4) }, { width: 321, height: 89 }, 2);
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    expect(el.width).toBe(642);
    expect(el.height).toBe(178);
  });

  it('draws nothing while hidden without size (display:none) and does not spin', () => {
    mount({ isPlaying: true, spectrum: Array(32).fill(0.4) }, { width: 0, height: 0 });
    raf.step();
    expect(raf.pending()).toBe(0);
  });
});
