import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useInertialSpin } from './useInertialSpin';
import { installFakeRaf, type FakeRaf } from '../test/canvasMock';

let raf: FakeRaf;

afterEach(() => {
  cleanup();
  raf?.restore();
});

function Probe({ playing, target, apply }: { playing: boolean; target: number; apply: (a: number, s: number) => void }) {
  useInertialSpin({ targetDegPerSec: target, playing, tauUp: 0.2, tauDown: 0.4, apply });
  return null;
}

describe('useInertialSpin', () => {
  it('spins up while playing and applies increasing angles', () => {
    raf = installFakeRaf();
    const apply = vi.fn();
    render(<Probe playing target={190} apply={apply} />);
    for (let i = 0; i < 30; i++) raf.step(16);
    expect(apply).toHaveBeenCalled();
    const angles = apply.mock.calls.map(([a]) => a as number);
    expect(angles[angles.length - 1]).not.toBe(angles[0]);
    expect(raf.pending()).toBe(1); // wciąż się kręci
  });

  it('goes to sleep after a full stop and wakes up again when playback resumes', () => {
    raf = installFakeRaf();
    const apply = vi.fn();
    const { rerender } = render(<Probe playing target={190} apply={apply} />);
    for (let i = 0; i < 20; i++) raf.step(16);

    rerender(<Probe playing={false} target={0} apply={apply} />);
    for (let i = 0; i < 400; i++) raf.step(16);
    expect(raf.pending()).toBe(0); // pętla śpi — brak pracy bez ruchu

    rerender(<Probe playing target={190} apply={apply} />);
    expect(raf.pending()).toBe(1);
  });

  it('does nothing while idle from the start', () => {
    raf = installFakeRaf();
    const apply = vi.fn();
    render(<Probe playing={false} target={0} apply={apply} />);
    raf.step();
    raf.step();
    expect(apply).not.toHaveBeenCalled();
    expect(raf.pending()).toBe(0);
  });
});
