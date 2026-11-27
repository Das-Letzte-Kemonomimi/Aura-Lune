import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ReplayGainOption, type ReplayGainOptionProps } from './ReplayGainOption';
import { getTranslations } from '../../../i18n';

const loc = getTranslations('en');

afterEach(cleanup);

function renderOption(overrides: Partial<ReplayGainOptionProps> = {}) {
  const props: ReplayGainOptionProps = {
    loc,
    replaygainMode: 'Track',
    onSetReplayGain: vi.fn(),
    replaygainPreAmp: 0,
    replaygainFallbackGain: -6,
    replaygainPreventClipping: true,
    replaygainStatus: [-3, -3, true],
    replaygainScanWriteTags: false,
    onToggleReplaygainScanWriteTags: vi.fn(),
    onScanLibraryReplayGain: vi.fn(),
    isReplaygainScanning: false,
    ...overrides,
  };
  render(<ReplayGainOption {...props} />);
  return props;
}

describe('ReplayGainOption limiter status', () => {
  it('shows the limiter as active when the engine reports it running', () => {
    renderOption({ replaygainStatus: [-3, -3, true] });
    expect(screen.getByText(loc.settings.replaygainLimiterActive)).toBeTruthy();
    expect(screen.queryByText(loc.settings.replaygainLimiterOff)).toBeNull();
  });

  it('shows the limiter as off when the engine reports it stopped', () => {
    renderOption({ replaygainPreventClipping: false, replaygainStatus: [-3, -3, false] });
    expect(screen.getByText(loc.settings.replaygainLimiterOff)).toBeTruthy();
    expect(screen.queryByText(loc.settings.replaygainLimiterActive)).toBeNull();
  });
});
