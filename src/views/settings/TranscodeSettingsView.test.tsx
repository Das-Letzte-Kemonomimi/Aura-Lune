import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TranscodeSettingsView, type TranscodeSettingsViewProps } from './TranscodeSettingsView';
import { getTranslations } from '../../i18n';
import { DEFAULT_PLAYBACK_STATUS } from '../../types/player';

const loc = getTranslations('en');

function makeProps(overrides: Partial<TranscodeSettingsViewProps> = {}): TranscodeSettingsViewProps {
  return {
    language: 'en',
    loc,
    currentPlayingTrack: null,
    status: DEFAULT_PLAYBACK_STATUS,
    onUseCurrentTrackAsSource: vi.fn(),
    filePath: '/music/source.flac',
    onFilePathChange: vi.fn(),
    isPickingSource: false,
    onPickTranscodeSource: vi.fn(),
    transcodeOutput: '/music/out.opus',
    onTranscodeOutputChange: vi.fn(),
    isPickingDestination: false,
    onPickTranscodeDestination: vi.fn(),
    transcodeFormat: 'Opus',
    onTranscodeFormatChange: vi.fn(),
    transcodeBitrate: 192,
    onTranscodeBitrateChange: vi.fn(),
    transcodeApplyDsp: false,
    onTranscodeApplyDspChange: vi.fn(),
    reverbEnabled: false,
    reverbLevel: 0,
    transcodeApplyRange: false,
    onTranscodeApplyRangeChange: vi.fn(),
    transcodeRangeA: '',
    onTranscodeRangeAChange: vi.fn(),
    transcodeRangeB: '',
    onTranscodeRangeBChange: vi.fn(),
    loopPointA: null,
    loopPointB: null,
    currentTrackBookmarks: [],
    transcodeAutoEnqueue: true,
    onTranscodeAutoEnqueueChange: vi.fn(),
    isTranscoding: false,
    transcodeProgress: null,
    transcodeElapsedSeconds: 0,
    onMinimizeToBackground: vi.fn(),
    onTranscode: vi.fn(),
    lastExportedTrack: null,
    onDismissLastExported: vi.fn(),
    onPlayLibraryTrack: vi.fn(),
    onAddTrackToQueue: vi.fn(),
    onAddToPlaylist: vi.fn(),
    onOpenContainingFolder: vi.fn(),
    onShowMessage: vi.fn(),
    ...overrides,
  };
}

describe('TranscodeSettingsView', () => {
  afterEach(cleanup);

  it('reflects unchecked auto-enqueue state and forwards toggle changes', () => {
    const onChangeUnchecked = vi.fn();
    const { rerender } = render(
      <TranscodeSettingsView
        {...makeProps({ transcodeAutoEnqueue: false, onTranscodeAutoEnqueueChange: onChangeUnchecked })}
      />,
    );

    const toggle = screen.getByRole('switch', { name: loc.settings.transcodeAutoEnqueue }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(onChangeUnchecked).toHaveBeenCalledWith(true);

    const onChangeChecked = vi.fn();
    rerender(
      <TranscodeSettingsView
        {...makeProps({ transcodeAutoEnqueue: true, onTranscodeAutoEnqueueChange: onChangeChecked })}
      />,
    );
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(onChangeChecked).toHaveBeenCalledWith(false);
  });
});
