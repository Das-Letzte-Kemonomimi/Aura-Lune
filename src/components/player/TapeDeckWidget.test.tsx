import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TapeDeckWidget } from './TapeDeckWidget';
import { installFakeRaf, type FakeRaf } from '../../test/canvasMock';

let raf: FakeRaf;

afterEach(() => {
  cleanup();
  raf?.restore();
});

/** Rotating overlays: CSS `rotate(…deg)` with the rotation centre given in viewBox space as `transform-origin`. */
const rotatingParts = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('div.will-change-transform')].map((el) => ({
    origin: el.style.transformOrigin,
    transform: el.style.transform,
  }));

describe('TapeDeckWidget', () => {
  it('spins both reels and the pinch roller while playing', () => {
    raf = installFakeRaf();
    const { container } = render(<TapeDeckWidget isPlaying positionMs={30_000} durationMs={180_000} />);
    for (let i = 0; i < 30; i++) raf.step(16);
    const parts = rotatingParts(container);
    expect(parts).toHaveLength(3);
    // Left reel (65, 75), right reel (175, 75) and pinch roller (158, 135) in the 240×155 viewBox
    const centres = [
      [65, 75],
      [175, 75],
      [158, 135],
    ];
    parts.forEach((part, i) => {
      const [x, y] = part.origin.split(' ').map(parseFloat);
      expect(x).toBeCloseTo((centres[i][0] / 240) * 100, 2);
      expect(y).toBeCloseTo((centres[i][1] / 155) * 100, 2);
    });
    for (const part of parts) expect(part.transform).toMatch(/^rotate\(-?\d+(\.\d+)?deg\)$/);
  });

  it('keeps a single loop per reel while the position (reel radii) advances (regression: loop restarted on every tick)', () => {
    raf = installFakeRaf();
    const { rerender } = render(<TapeDeckWidget isPlaying positionMs={10_000} durationMs={180_000} />);
    raf.step();
    const pending = raf.pending();
    for (let s = 11; s < 20; s++) {
      rerender(<TapeDeckWidget isPlaying positionMs={s * 1000} durationMs={180_000} />);
      expect(raf.pending()).toBe(pending);
      raf.step();
    }
  });

  it('goes idle after playback stops', () => {
    raf = installFakeRaf();
    const { rerender } = render(<TapeDeckWidget isPlaying positionMs={0} durationMs={60_000} />);
    for (let i = 0; i < 40; i++) raf.step(16);
    rerender(<TapeDeckWidget isPlaying={false} positionMs={0} durationMs={60_000} />);
    for (let i = 0; i < 600 && raf.pending() > 0; i++) raf.step(16);
    expect(raf.pending()).toBe(0);
  });

  it('uses unique SVG gradient ids per instance (no clashes between two decks)', () => {
    raf = installFakeRaf();
    const { container } = render(
      <>
        <TapeDeckWidget isPlaying={false} />
        <TapeDeckWidget isPlaying={false} tapeType="METAL" />
      </>
    );
    const ids = [...container.querySelectorAll('radialGradient, linearGradient')].map((n) => n.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(4);
  });
});
