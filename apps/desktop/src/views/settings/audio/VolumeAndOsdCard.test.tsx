import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { VolumeAndOsdCard, type VolumeAndOsdCardProps } from './VolumeAndOsdCard';
import { getTranslations } from '../../../i18n';

const loc = getTranslations('en');

function props(overrides: Partial<VolumeAndOsdCardProps> = {}): VolumeAndOsdCardProps {
  return {
    loc,
    instantVolume: false,
    onToggleInstantVolume: vi.fn(),
    volumeUnit: 'db',
    onSetVolumeUnit: vi.fn(),
    volumeDbStep: 1.5,
    onSetVolumeDbStep: vi.fn(),
    volumeOsdPosition: 'bottom-center',
    onSetVolumeOsdPosition: vi.fn(),
    recapOptIn: false,
    onToggleRecapOptIn: vi.fn(),
    ...overrides,
  };
}

describe('VolumeAndOsdCard dB step switch', () => {
  afterEach(() => cleanup());

  it('is shown below the unit selector only when dB is enabled', () => {
    const { rerender } = render(<VolumeAndOsdCard {...props({ volumeUnit: 'percent' })} />);
    expect(screen.queryByText(loc.settings.volumeDbStepTitle)).toBeNull();

    rerender(<VolumeAndOsdCard {...props({ volumeUnit: 'db' })} />);
    expect(screen.getByText(loc.settings.volumeDbStepTitle)).toBeTruthy();
    expect(screen.getByText('-1.5 dB')).toBeTruthy();
    expect(screen.getByText('-1.2 dB')).toBeTruthy();
  });

  it('marks the active step and switches to 1.2 dB per 5%', () => {
    const onSetVolumeDbStep = vi.fn();
    render(<VolumeAndOsdCard {...props({ onSetVolumeDbStep, volumeDbStep: 1.5 })} />);

    expect(screen.getByText('-1.5 dB').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('-1.2 dB').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByText('-1.2 dB'));
    expect(onSetVolumeDbStep).toHaveBeenCalledWith(1.2);
  });
});
