import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { VinylTurntable } from './VinylTurntable';
import { installFakeRaf, type FakeRaf } from '../../test/canvasMock';

let raf: FakeRaf;

afterEach(() => {
  cleanup();
  raf?.restore();
});

const platter = (container: HTMLElement) =>
  container.querySelector('div[style*="will-change: transform"]') as HTMLDivElement | null;

describe('VinylTurntable', () => {
  it('spins the platter while playing', () => {
    raf = installFakeRaf();
    const { container } = render(<VinylTurntable isPlaying />);
    for (let i = 0; i < 30; i++) raf.step(16);
    expect(platter(container)?.style.transform).toMatch(/^rotate\(/);
    expect(raf.pending()).toBe(1);
  });

  it('does not restart its loop when tempo/rate change (regression: effect depended on target speed)', () => {
    raf = installFakeRaf();
    const { rerender } = render(<VinylTurntable isPlaying engine="RubberBand" tempo={1} />);
    raf.step();
    expect(raf.pending()).toBe(1);
    rerender(<VinylTurntable isPlaying engine="RubberBand" tempo={1.4} />);
    expect(raf.pending()).toBe(1);
  });

  it('stops its loop completely once the platter has come to rest', () => {
    raf = installFakeRaf();
    const { rerender } = render(<VinylTurntable isPlaying />);
    for (let i = 0; i < 40; i++) raf.step(16);
    rerender(<VinylTurntable isPlaying={false} />);
    for (let i = 0; i < 600 && raf.pending() > 0; i++) raf.step(16);
    expect(raf.pending()).toBe(0);

    rerender(<VinylTurntable isPlaying />);
    expect(raf.pending()).toBe(1);
  });

  it('shows the effective RPM from tempo*rate when a DSP engine is active', () => {
    raf = installFakeRaf();
    const { getByText } = render(<VinylTurntable isPlaying engine="RubberBand" tempo={1.5} rate={1} />);
    expect(getByText('49.5 RPM')).toBeTruthy();
  });
});
