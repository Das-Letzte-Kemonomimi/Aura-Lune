import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PlaybackSettingsView, type PlaybackSettingsViewProps } from './PlaybackSettingsView';
import { getTranslations } from '../../i18n';

const loc = getTranslations('en');

afterEach(cleanup);

function renderView(overrides: Partial<PlaybackSettingsViewProps> = {}) {
  const props: PlaybackSettingsViewProps = {
    loc,
    crossfadeDuration: 0,
    onCrossfadeDurationChange: vi.fn(),
    seekFadeEnabled: true,
    onToggleSeekFade: vi.fn(),
    silenceTrimmingEnabled: false,
    silenceTrimmingThreshold: -50,
    onSetSilenceTrimming: vi.fn(),
    instantVolume: false,
    onToggleInstantVolume: vi.fn(),
    volumeUnit: 'percent',
    onSetVolumeUnit: vi.fn(),
    volumeCurve: 'cubic',
    onSetVolumeCurve: vi.fn(),
    volumeOsdPosition: 'bottom-right',
    onSetVolumeOsdPosition: vi.fn(),
    replaygainMode: 'Off',
    replaygainPreAmp: 0,
    replaygainFallbackGain: -6,
    replaygainPreventClipping: true,
    onSetReplayGain: vi.fn(),
    replaygainStatus: [0, 0, false],
    replaygainScanWriteTags: false,
    onToggleReplaygainScanWriteTags: vi.fn(),
    onScanLibraryReplayGain: vi.fn(),
    isReplaygainScanning: false,
    ...overrides,
  };
  render(<PlaybackSettingsView {...props} />);
  return props;
}

describe('PlaybackSettingsView', () => {
  it('shows the silence threshold only while trimming is on', () => {
    renderView({ silenceTrimmingEnabled: false });
    expect(screen.queryByText(loc.settings.silenceTrimmingThreshold)).toBeNull();
    cleanup();
    renderView({ silenceTrimmingEnabled: true });
    expect(screen.getByText(loc.settings.silenceTrimmingThreshold)).toBeTruthy();
  });

  it('shows the ReplayGain pre-amps only while normalisation is on', () => {
    renderView({ replaygainMode: 'Off' });
    expect(screen.queryByText(loc.settings.replaygainPreampTagged)).toBeNull();
    cleanup();
    renderView({ replaygainMode: 'Album' });
    expect(screen.getByText(loc.settings.replaygainPreampTagged)).toBeTruthy();
  });
});
