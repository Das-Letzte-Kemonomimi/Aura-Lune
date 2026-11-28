import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SleepTimerModal } from './SleepTimerModal';

describe('SleepTimerModal component', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentLang: 'en' as const,
    remainingSec: null,
    targetMode: null,
    fadeOut: true,
    onSetTimer: vi.fn(),
    onCancelTimer: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SleepTimerModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders presets and sets timer on submit', () => {
    const onSetTimer = vi.fn();
    render(<SleepTimerModal {...defaultProps} onSetTimer={onSetTimer} />);

    // Click 45 min preset button
    const preset45 = screen.getByRole('button', { name: /45\s*min/i });
    fireEvent.click(preset45);

    // Click Start Sleep Timer button
    const startBtn = screen.getByRole('button', { name: /start sleep timer/i });
    fireEvent.click(startBtn);

    expect(onSetTimer).toHaveBeenCalledWith(45, true);
  });

  it('selects end of track mode and submits', () => {
    const onSetTimer = vi.fn();
    render(<SleepTimerModal {...defaultProps} onSetTimer={onSetTimer} />);

    // Find end of track button in presets grid
    const endOfTrackBtn = screen.getByRole('button', { name: /end of track/i });
    fireEvent.click(endOfTrackBtn);

    const startBtn = screen.getByRole('button', { name: /start sleep timer/i });
    fireEvent.click(startBtn);

    expect(onSetTimer).toHaveBeenCalledWith('end_of_track', true);
  });

  it('calls onCancelTimer when cancelling an active timer', () => {
    const onCancelTimer = vi.fn();
    render(
      <SleepTimerModal
        {...defaultProps}
        remainingSec={300}
        targetMode="time"
        onCancelTimer={onCancelTimer}
      />
    );

    // Cancel button in active countdown card
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelBtn);

    expect(onCancelTimer).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking backdrop overlay', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SleepTimerModal {...defaultProps} onClose={onClose} />
    );

    // First child is the backdrop overlay
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });
});
