import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { BigScreenView } from './BigScreenView';
import { installCanvasMock } from '../../test/canvasMock';

describe('BigScreenView HUD visibility timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installCanvasMock();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('hides the HUD after 3.5 s while playing even when parent re-renders continuously with fresh callbacks', () => {
    const onClose = vi.fn();
    const onPlayPause = vi.fn();

    const makeProps = (posMs: number) => ({
      title: 'Test Track',
      artist: 'Test Artist',
      isPlaying: true,
      positionMs: posMs,
      durationMs: 180_000,
      volume: 0.8,
      pitchSemitones: 0,
      tempoRatio: 1.0,
      onPlayPause: () => onPlayPause(),
      onPrev: () => {},
      onNext: () => {},
      onSeek: () => {},
      onVolumeChange: () => {},
      onToggleMute: () => {},
      formatVolumeValue: (g: number) => `${Math.round(g * 100)}%`,
      onClose: () => onClose(),
    });

    const { container, rerender } = render(<BigScreenView {...makeProps(0)} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('cursor-default');

    // Simulate parent re-renders every 250 ms over 3.25 s with inline callback identities
    for (let elapsed = 250; elapsed < 3500; elapsed += 250) {
      act(() => {
        vi.advanceTimersByTime(250);
        rerender(<BigScreenView {...makeProps(elapsed)} />);
      });
      expect(root.className).toContain('cursor-default');
    }

    // Completing 3.5 s hides the HUD
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(root.className).toContain('cursor-none');

    // Moving the mouse reveals the HUD again
    act(() => {
      fireEvent.mouseMove(window);
    });
    expect(root.className).toContain('cursor-default');

    // Window key handlers invoke the latest callbacks
    act(() => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
