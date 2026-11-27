import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AnimeAmbienceFX } from './AnimeAmbienceFX';
import { installCanvasMock, installFakeRaf, type CanvasMock, type FakeRaf } from '../../test/canvasMock';

let raf: FakeRaf;
let canvas: CanvasMock;

beforeEach(() => {
  raf = installFakeRaf();
  canvas = installCanvasMock();
});

afterEach(() => {
  cleanup();
  raf.restore();
  canvas.restore();
});

const count = (name: string) => canvas.calls.filter((c) => c === name).length;

describe('AnimeAmbienceFX', () => {
  it('draws at most 30 frames per second on a fast display', () => {
    render(<AnimeAmbienceFX mode="snow" />);
    raf.step(16);
    const before = count('clearRect');
    // One second on a ~120 Hz display
    for (let i = 0; i < 120; i++) raf.step(8);
    const drawn = count('clearRect') - before;
    expect(drawn).toBeGreaterThan(20);
    expect(drawn).toBeLessThanOrEqual(31);
  });

  it('draws ember glows from cached sprites instead of a per-particle blur', () => {
    render(<AnimeAmbienceFX mode="embers" />);
    for (let i = 0; i < 4; i++) raf.step(34);
    const drawImages = count('drawImage');
    expect(drawImages).toBeGreaterThan(0);
    // The sprite is rendered once per glow colour (4 ember colours), not once per frame or particle.
    expect(count('createRadialGradient')).toBeLessThanOrEqual(4);
  });

  it('renders nothing and keeps no loop running when off', () => {
    const { container } = render(<AnimeAmbienceFX mode="off" />);
    expect(container.querySelector('canvas')).toBeNull();
    raf.step(16);
    expect(raf.pending()).toBe(0);
  });

  it('stops the loop when switched off', () => {
    const { rerender } = render(<AnimeAmbienceFX mode="sakura" />);
    raf.step(34);
    expect(raf.pending()).toBe(1);
    rerender(<AnimeAmbienceFX mode="off" />);
    raf.step(34);
    expect(raf.pending()).toBe(0);
  });
});
