import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TapeDeckWidget } from './TapeDeckWidget';
import { installFakeRaf, type FakeRaf } from '../../test/canvasMock';

let raf: FakeRaf;

afterEach(() => {
  cleanup();
  raf?.restore();
});

const reelTransforms = (container: HTMLElement) =>
  [...container.querySelectorAll('g[transform^="rotate("]')].map((g) => g.getAttribute('transform'));

describe('TapeDeckWidget', () => {
  it('spins both reels and the pinch roller while playing', () => {
    raf = installFakeRaf();
    const { container } = render(<TapeDeckWidget isPlaying positionMs={30_000} durationMs={180_000} />);
    for (let i = 0; i < 30; i++) raf.step(16);
    const transforms = reelTransforms(container);
    expect(transforms.length).toBeGreaterThanOrEqual(3);
    expect(transforms.some((t) => t?.includes('65 75'))).toBe(true);
    expect(transforms.some((t) => t?.includes('175 75'))).toBe(true);
    expect(transforms.some((t) => t?.includes('158 135'))).toBe(true);
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
