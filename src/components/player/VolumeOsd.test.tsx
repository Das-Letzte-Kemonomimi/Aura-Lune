import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { VolumeOsd, VOLUME_OSD_HIDE_MS, DEFAULT_VOLUME_OSD_POSITION, type VolumeOsdPosition } from './VolumeOsd';

/** Lets the `queueMicrotask` show/hide run. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderOsd(volume: number, position: VolumeOsdPosition = DEFAULT_VOLUME_OSD_POSITION, unit: 'percent' | 'db' = 'percent') {
  return render(<VolumeOsd volume={volume} position={position} unit={unit} />);
}

describe('VolumeOsd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('stays hidden on the first render', async () => {
    renderOsd(0.5);
    await flush();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows on a volume change and hides after 1200 ms', async () => {
    const { rerender } = renderOsd(1);
    rerender(<VolumeOsd volume={0.125} position="bottom-right" />);
    await flush();
    // Cubic curve: gain 0.125 is half way along the slider.
    expect(screen.getByRole('status').textContent).toContain('50%');

    act(() => {
      vi.advanceTimersByTime(VOLUME_OSD_HIDE_MS - 1);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('restarts the hide timer on every change', async () => {
    const { rerender } = renderOsd(1);
    rerender(<VolumeOsd volume={0.5} position="bottom-right" />);
    await flush();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<VolumeOsd volume={0.4} position="bottom-right" />);
    await flush();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
  });

  it('shows the real gain in dB with the slider position alongside', async () => {
    const { rerender } = renderOsd(1, 'bottom-right', 'db');
    rerender(<VolumeOsd volume={0.125} position="bottom-right" unit="db" />);
    await flush();
    const text = screen.getByRole('status').textContent;
    expect(text).toContain('-18.1 dB');
    expect(text).toContain('(50%)');
  });

  it('is centred above the dock by default', async () => {
    const { rerender } = renderOsd(1);
    rerender(<VolumeOsd volume={0.5} position={DEFAULT_VOLUME_OSD_POSITION} />);
    await flush();
    expect(screen.getByRole('status').className).toContain('bottom-36.5 left-1/2 -translate-x-1/2');
  });

  it('can sit in the bottom-right corner', async () => {
    const { rerender } = renderOsd(1, 'bottom-right');
    rerender(<VolumeOsd volume={0.5} position="bottom-right" />);
    await flush();
    expect(screen.getByRole('status').className).toContain('bottom-36.5 right-8');
  });

  it('never shows when switched off', async () => {
    const { rerender } = renderOsd(1, 'off');
    rerender(<VolumeOsd volume={0.5} position="off" />);
    await flush();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
