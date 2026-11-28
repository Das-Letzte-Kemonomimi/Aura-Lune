import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { KeyBpmModal } from './KeyBpmModal';

const CACHE_KEY = 'auralune_track_key_bpm_7';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  currentTrackId: 7,
  currentTrackPath: '/music/a.flac',
  pitchSemitones: 0,
  tempoRatio: 1,
  rateRatio: 1,
  onPitchChange: vi.fn(),
  onTempoChange: vi.fn(),
  currentLang: 'en' as const,
};

function bpmInput(): HTMLInputElement {
  return screen.getByLabelText(/bpm/i, { selector: 'input' }) as HTMLInputElement;
}

function tap(times: number, gapMs: number) {
  const btn = screen.getByRole('button', { name: /tap/i });
  for (let i = 0; i < times; i++) {
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(gapMs);
    });
  }
}

describe('KeyBpmModal tap tempo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ baseKeyIndex: 0, isMinor: false, baseBpm: 100, source: 'acoustic' })
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('applies the tapped tempo and keeps it when the parent re-renders with new callbacks', () => {
    const { rerender } = render(
      <KeyBpmModal {...baseProps} onTrackKeyBpmUpdated={vi.fn()} />
    );
    expect(bpmInput().value).toBe('100');

    tap(4, 500); // 500 ms between taps = 120 BPM
    expect(bpmInput().value).toBe('120');

    // Playback status ticks re-render the parent, which passes a fresh inline callback
    rerender(<KeyBpmModal {...baseProps} onTrackKeyBpmUpdated={vi.fn()} />);
    rerender(<KeyBpmModal {...baseProps} onTrackKeyBpmUpdated={vi.fn()} />);
    expect(bpmInput().value).toBe('120');
  });

  it('stores the tapped tempo as a manual override for the track', () => {
    render(<KeyBpmModal {...baseProps} />);
    tap(3, 400); // 150 BPM

    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    expect(stored.baseBpm).toBe(150);
    expect(stored.source).toBe('manual');
  });

  it('ignores a single tap and out-of-range intervals', () => {
    render(<KeyBpmModal {...baseProps} />);
    tap(1, 5000); // the lone tap expires from the 3 s window
    expect(bpmInput().value).toBe('100');

    // 2.5 s between taps = 24 BPM, below the accepted range
    tap(2, 2500);
    expect(bpmInput().value).toBe('100');
  });
});
