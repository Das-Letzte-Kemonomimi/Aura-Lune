import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { PianoRollCanvas, type PianoRollCanvasProps } from './PianoRollCanvas';
import { buildNoteIndex } from './pianoRollModel';
import { livePlayback } from '../../../state/livePlayback';
import { installCanvasMock, installFakeRaf, type CanvasMock, type FakeRaf } from '../../../test/canvasMock';
import type { DetectedNote } from '../../../types/analysis';

let raf: FakeRaf;
let canvas: CanvasMock;

afterEach(() => {
  cleanup();
  livePlayback.reset();
  canvas?.restore();
  raf?.restore();
});

function makeNote(onset_ms: number, duration_ms: number, midi_pitch: number): DetectedNote {
  return { onset_ms, duration_ms, midi_pitch, pitch_name: 'C4', cents_offset: 0, velocity: 90 };
}

const index = buildNoteIndex([makeNote(0, 1000, 60), makeNote(2000, 1000, 64), makeNote(8000, 500, 67)]);

function baseProps(overrides: Partial<PianoRollCanvasProps> = {}): PianoRollCanvasProps {
  return {
    index,
    bpm: 120,
    durationMs: 60_000,
    isPlaying: false,
    fallbackPositionMs: 0,
    pxPerSec: 100,
    mode: 'follow',
    rowHeight: null,
  showLabels: true,
    onViewChange: vi.fn(),
    onSeek: vi.fn(),
    labels: { start: 'start', length: 'length', velocity: 'velocity' },
    ariaLabel: 'piano roll',
    ...overrides,
  };
}

function mount(props: PianoRollCanvasProps, css = { width: 723, height: 411 }, dpr = 2) {
  raf = installFakeRaf();
  canvas = installCanvasMock(css);
  canvas.setDpr(dpr);
  return render(<PianoRollCanvas {...props} />);
}

function settle() {
  for (let i = 0; i < 30 && raf.pending() > 0; i++) raf.step();
}

describe('PianoRollCanvas', () => {
  it('sizes the buffer at the device pixel ratio, not a fixed 900×686', () => {
    mount(baseProps(), { width: 723, height: 411 }, 2);
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    expect(el.width).toBe(1446);
    expect(el.height).toBe(822);
  });

  it('follows a window resize with a matching buffer', () => {
    mount(baseProps(), { width: 500, height: 300 }, 1.5);
    raf.step();
    canvas.setCssSize(640, 360);
    act(() => canvas.triggerResize());
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    expect(el.width).toBe(960);
    expect(el.height).toBe(540);
  });

  it('sleeps when paused and settled', () => {
    mount(baseProps({ isPlaying: false }));
    settle();
    expect(raf.pending()).toBe(0);
  });

  it('keeps animating while playing', () => {
    mount(baseProps({ isPlaying: true }));
    for (let i = 0; i < 10; i++) {
      raf.step();
      expect(raf.pending()).toBe(1);
    }
  });

  it('wakes when playback starts and sleeps again after pausing', () => {
    const props = baseProps({ isPlaying: false });
    const view = mount(props);
    settle();
    view.rerender(<PianoRollCanvas {...props} isPlaying />);
    expect(raf.pending()).toBe(1);
    view.rerender(<PianoRollCanvas {...props} isPlaying={false} />);
    settle();
    expect(raf.pending()).toBe(0);
  });

  it('redraws when the backend reports a new position while paused (seek)', () => {
    mount(baseProps());
    settle();
    expect(raf.pending()).toBe(0);
    act(() => livePlayback.publish({ positionMs: 5000 }));
    expect(raf.pending()).toBe(1);
  });

  it('does not reallocate the buffer on re-render or live position updates at fractional DPR', () => {
    const props = baseProps({ isPlaying: true });
    const view = mount(props, { width: 723, height: 411 }, 1.5);
    for (let i = 0; i < 5; i++) raf.step();
    const widthSets = canvas.widthAssignments();
    const heightSets = canvas.heightAssignments();

    for (let i = 0; i < 20; i++) {
      act(() => livePlayback.publish({ positionMs: i * 100 }));
      view.rerender(<PianoRollCanvas {...props} fallbackPositionMs={i * 100} />);
      raf.step();
    }
    expect(canvas.widthAssignments()).toBe(widthSets);
    expect(canvas.heightAssignments()).toBe(heightSets);
  });

  it('click-to-seek uses CSS pixels at a width that is not the old 900 px buffer', () => {
    const onSeek = vi.fn();
    mount(baseProps({ onSeek, pxPerSec: 100, mode: 'follow' }), { width: 723, height: 411 }, 2);
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;

    // Pozycja 0 + tryb Follow → początek osi = 0; obszar nut zaczyna się za kolumną klawiatury (56 px).
    // x = 56 + 300 px przy 100 px/s → 3 s.
    fireEvent.pointerDown(el, { clientX: 356, clientY: 150, button: 0, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 356, clientY: 150, button: 0, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(3000);
  });

  it('click-to-seek accounts for the followed position (content scrolls under the playhead)', () => {
    const onSeek = vi.fn();
    act(() => livePlayback.publish({ positionMs: 40_000 }));
    mount(baseProps({ onSeek, pxPerSec: 100, mode: 'follow' }), { width: 723, height: 411 }, 1);
    for (let i = 0; i < 20; i++) raf.step(); // ease display position to the target

    const el = document.querySelector('canvas') as HTMLCanvasElement;
    // Roll ma 667 px → głowica stoi w 30% (≈200 px) od lewej krawędzi obszaru nut → x = 56 + 200.1.
    const playheadX = 56 + 667 * 0.3;
    fireEvent.pointerDown(el, { clientX: playheadX, clientY: 150, button: 0, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: playheadX, clientY: 150, button: 0, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(Math.abs((onSeek.mock.calls[0][0] as number) - 40_000)).toBeLessThanOrEqual(15);
  });

  it('does not seek when the click lands on the keyboard column', () => {
    const onSeek = vi.fn();
    mount(baseProps({ onSeek }));
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    fireEvent.pointerDown(el, { clientX: 20, clientY: 150, button: 0, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 20, clientY: 150, button: 0, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('drag pans in free mode instead of seeking', () => {
    const onSeek = vi.fn();
    const onViewChange = vi.fn();
    mount(baseProps({ onSeek, onViewChange }));
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    fireEvent.pointerDown(el, { clientX: 300, clientY: 150, button: 0, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 260, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 260, clientY: 150, button: 0, pointerId: 1 });
    expect(onSeek).not.toHaveBeenCalled();
    expect(onViewChange).toHaveBeenCalledWith({ mode: 'free' });
  });

  it('ctrl+wheel zooms the time axis and scrolls nothing else', () => {
    const onViewChange = vi.fn();
    mount(baseProps({ onViewChange, pxPerSec: 100 }));
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    const notCancelled = fireEvent.wheel(el, { deltaY: -200, ctrlKey: true, clientX: 300, clientY: 150 });
    expect(notCancelled).toBe(false); // preventDefault → modal nie przewija się pod spodem
    const zoom = onViewChange.mock.calls.find((c) => c[0].pxPerSec !== undefined)?.[0].pxPerSec as number;
    expect(zoom).toBeGreaterThan(100);
  });
});

describe('PianoRollCanvas note labels', () => {
  const labelCalls = (showLabels: boolean) => {
    mount(baseProps({ showLabels }), { width: 723, height: 411 }, 1);
    for (let i = 0; i < 5; i++) raf.step();
    return canvas.calls.filter((c) => c === 'fillText').length;
  };

  it('draws note names only when labels are enabled', () => {
    const off = labelCalls(false);
    cleanup();
    canvas.restore();
    raf.restore();
    const on = labelCalls(true);
    expect(on).toBeGreaterThan(off);
  });
});

describe('PianoRollCanvas vertical navigation', () => {
  // 24 wiersze po 16 px (podpisy) w obszarze ≈357 px → jest co przewijać.
  const open = (overrides: Partial<PianoRollCanvasProps> = {}) => {
    const props = baseProps(overrides);
    mount(props, { width: 723, height: 411 }, 1);
    raf.step();
    return { props, el: document.querySelector('canvas') as HTMLCanvasElement };
  };

  it('mouse wheel scrolls rows without leaving Follow when rows overflow', () => {
    const { props, el } = open();
    const notCancelled = fireEvent.wheel(el, { deltaY: 120, clientX: 300, clientY: 150 });
    expect(notCancelled).toBe(false);
    expect(props.onViewChange).not.toHaveBeenCalled();
  });

  it('Shift+wheel moves time (and switches to Free) even when rows overflow', () => {
    const { props, el } = open();
    fireEvent.wheel(el, { deltaY: 120, shiftKey: true, clientX: 300, clientY: 150 });
    expect(props.onViewChange).toHaveBeenCalledWith({ mode: 'free' });
  });

  it('mouse wheel moves time when every row already fits', () => {
    const { props, el } = open({ showLabels: false });
    fireEvent.wheel(el, { deltaY: 120, clientX: 300, clientY: 150 });
    expect(props.onViewChange).toHaveBeenCalledWith({ mode: 'free' });
  });

  it('a vertical drag scrolls rows, stays in Follow and does not seek', () => {
    const { props, el } = open();
    fireEvent.pointerDown(el, { clientX: 300, clientY: 200, button: 0, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 301, clientY: 140, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 301, clientY: 140, button: 0, pointerId: 1 });
    expect(props.onViewChange).not.toHaveBeenCalled();
    expect(props.onSeek).not.toHaveBeenCalled();
  });

  it('grabbing the scrollbar neither seeks nor leaves Follow', () => {
    const { props, el } = open();
    fireEvent.pointerDown(el, { clientX: 718, clientY: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 718, clientY: 160, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 718, clientY: 160, button: 0, pointerId: 1 });
    expect(props.onSeek).not.toHaveBeenCalled();
    expect(props.onViewChange).not.toHaveBeenCalled();
  });

  it('a click on the scrollbar track does not seek', () => {
    const { props, el } = open();
    fireEvent.pointerDown(el, { clientX: 718, clientY: 300, button: 0, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 718, clientY: 300, button: 0, pointerId: 1 });
    expect(props.onSeek).not.toHaveBeenCalled();
  });
});

describe('PianoRollCanvas row height', () => {
  it('a chosen row height makes rows overflow, so the wheel scrolls rows instead of leaving Follow', () => {
    const props = baseProps({ showLabels: false, rowHeight: 30 });
    mount(props, { width: 723, height: 411 }, 1);
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    fireEvent.wheel(el, { deltaY: 120, clientX: 300, clientY: 150 });
    expect(props.onViewChange).not.toHaveBeenCalled();
  });

  it('Alt+wheel changes the row height and reports it', () => {
    const props = baseProps();
    mount(props, { width: 723, height: 411 }, 1);
    raf.step();
    const el = document.querySelector('canvas') as HTMLCanvasElement;
    const notCancelled = fireEvent.wheel(el, { deltaY: -200, altKey: true, clientX: 300, clientY: 150 });
    expect(notCancelled).toBe(false);
    const change = (props.onViewChange as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0].rowHeight !== undefined);
    expect(change?.[0].rowHeight).toBeGreaterThan(16);
  });
});
