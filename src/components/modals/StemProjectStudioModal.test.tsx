import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StemProjectStudioModal } from './StemProjectStudioModal';

describe('StemProjectStudioModal seek slider', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    projectId: null,
    currentLang: 'en' as const,
    currentTimeMs: 65_000,
    durationMs: 200_000,
  };

  it('is reachable by role and name and announces the time as text', () => {
    render(<StemProjectStudioModal {...defaultProps} />);

    const slider = screen.getByRole('slider', { name: 'Project position' });
    expect(slider.getAttribute('aria-valuetext')).toBe('1:05 / 3:20');
  });

  it('seeks to the chosen position', () => {
    const onSeek = vi.fn();
    render(<StemProjectStudioModal {...defaultProps} onSeek={onSeek} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Project position' }), {
      target: { value: '90000' },
    });

    expect(onSeek).toHaveBeenCalledWith(90000);
  });

  it('uses the label of the selected language', () => {
    render(<StemProjectStudioModal {...defaultProps} currentLang="pl" />);

    expect(screen.getByRole('slider', { name: 'Pozycja projektu' })).toBeTruthy();
  });
});
