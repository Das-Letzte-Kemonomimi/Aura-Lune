import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { VuMeterWidget } from './VuMeterWidget';
import { livePlayback } from '../../state/livePlayback';
import { installCanvasMock, installFakeRaf, type CanvasMock, type FakeRaf } from '../../test/canvasMock';

let raf: FakeRaf;
let canvas: CanvasMock;

afterEach(() => {
  cleanup();
  canvas?.restore();
  raf?.restore();
});

function mount(props: { isPlaying: boolean; spectrum?: number[] }) {
  raf = installFakeRaf();
  canvas = installCanvasMock({ width: 237, height: 101 });
  canvas.setDpr(1.5);
  return render(<VuMeterWidget isPlaying={props.isPlaying} spectrum={props.spectrum ?? []} />);
}

describe('VuMeterWidget', () => {
  it('keeps one loop and never reallocates its buffers across spectrum updates at fractional DPR', () => {
    const view = mount({ isPlaying: true, spectrum: Array(32).fill(0.5) });
    for (let i = 0; i < 5; i++) raf.step();
    const widthSets = canvas.widthAssignments();
    expect(raf.pending()).toBe(1);

    // 100 ms tiki spektrum: dawniej przy każdym zrywano i budowano pętlę oraz realokowano bufor
    for (let i = 0; i < 20; i++) {
      act(() => livePlayback.publish({ positionMs: i * 100, spectrum: Array(32).fill(0.2 + (i % 5) * 0.1) }));
      view.rerender(<VuMeterWidget isPlaying spectrum={Array(32).fill(0.2 + (i % 5) * 0.1)} />);
      raf.step();
      expect(raf.pending()).toBe(1);
    }
    expect(canvas.widthAssignments()).toBe(widthSets);
  });

  it('blits the pre-rendered face instead of redrawing the dial every frame', () => {
    mount({ isPlaying: true, spectrum: Array(32).fill(0.5) });
    raf.step();
    const gradientsAfterFirst = canvas.calls.filter((c) => c === 'createLinearGradient').length;
    for (let i = 0; i < 10; i++) raf.step();
    const gradientsAfter = canvas.calls.filter((c) => c === 'createLinearGradient').length;
    expect(gradientsAfter).toBe(gradientsAfterFirst); // statyczne gradienty tylko w warstwie, raz
    expect(canvas.calls.filter((c) => c === 'drawImage').length).toBeGreaterThanOrEqual(10);
  });

  it('sleeps once the needle has settled while paused and wakes when playback starts', () => {
    const view = mount({ isPlaying: false });
    raf.step();
    for (let i = 0; i < 5 && raf.pending() > 0; i++) raf.step();
    expect(raf.pending()).toBe(0);

    view.rerender(<VuMeterWidget isPlaying spectrum={Array(32).fill(0.6)} />);
    expect(raf.pending()).toBe(1);
  });
});
