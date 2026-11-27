import React from 'react';
import { Play, VolumeX, Waves, Zap } from '../../components/ui/icons';
import { Card, Chip, SectionHeader, SliderRow, ToggleCard } from '../../components/ui';
import { fmt } from '../../utils/fmt';
import { ReplayGainOption } from './audio/ReplayGainOption';
import { VolumeAndOsdCard } from './audio/VolumeAndOsdCard';
import type { AudioSettingsProps } from './audio/audioSettingsProps';
import { SettingsPage } from './SettingsPage';

const CROSSFADE_PRESETS_MS = [0, 1000, 1500, 3000, 5000] as const;

export type PlaybackSettingsViewProps = Pick<
  AudioSettingsProps,
  | 'loc'
  | 'seekFadeEnabled'
  | 'onToggleSeekFade'
  | 'silenceTrimmingEnabled'
  | 'silenceTrimmingThreshold'
  | 'onSetSilenceTrimming'
  | 'instantVolume'
  | 'onToggleInstantVolume'
  | 'volumeUnit'
  | 'onSetVolumeUnit'
  | 'volumeCurve'
  | 'onSetVolumeCurve'
  | 'volumeOsdPosition'
  | 'onSetVolumeOsdPosition'
  | 'replaygainMode'
  | 'replaygainPreAmp'
  | 'replaygainFallbackGain'
  | 'replaygainPreventClipping'
  | 'onSetReplayGain'
  | 'replaygainStatus'
  | 'replaygainScanWriteTags'
  | 'onToggleReplaygainScanWriteTags'
  | 'onScanLibraryReplayGain'
  | 'isReplaygainScanning'
> & {
  crossfadeDuration: number;
  onCrossfadeDurationChange: (durationMs: number) => void;
};

/** Playback: crossfade, seek fade, silence trimming, loudness normalisation and volume behaviour. */
export const PlaybackSettingsView: React.FC<PlaybackSettingsViewProps> = (props) => {
  const {
    loc,
    seekFadeEnabled,
    onToggleSeekFade,
    silenceTrimmingEnabled,
    silenceTrimmingThreshold,
    onSetSilenceTrimming,
    crossfadeDuration,
    onCrossfadeDurationChange,
  } = props;

  return (
    <SettingsPage title={loc.settings.nav.playback} icon={<Play size={22} />} tone="green">
      {/* Smooth crossfade between tracks */}
      <Card>
        <SectionHeader
          icon={<Zap size={20} />}
          tone="pink"
          title={loc.settings.crossfadeTitle}
          description={loc.settings.crossfadeDesc}
        />
        <Card variant="inset" padding="sm" className="mt-4 flex flex-col gap-3">
          <SliderRow
            label={
              crossfadeDuration === 0
                ? loc.settings.crossfadeDisabled
                : fmt(loc.settings.crossfadeTime, (crossfadeDuration / 1000).toFixed(2), String(crossfadeDuration))
            }
            ariaLabel={loc.settings.crossfadeTitle}
            min={0}
            max={8000}
            step={250}
            value={crossfadeDuration}
            format={(ms) => `${(ms / 1000).toFixed(2)} s`}
            onChange={onCrossfadeDurationChange}
          />
          <div className="flex flex-wrap gap-1.5">
            {CROSSFADE_PRESETS_MS.map((presetMs) => (
              <Chip
                key={presetMs}
                size="xs"
                pressed={crossfadeDuration === presetMs}
                onClick={() => onCrossfadeDurationChange(presetMs)}
              >
                {presetMs === 0 ? '0s (Off)' : `${presetMs / 1000}s`}
              </Chip>
            ))}
          </div>
        </Card>
      </Card>

      {/* Smooth fade when seeking */}
      <ToggleCard
        icon={<Waves size={20} />}
        tone="pink"
        title={loc.player.seekFadeTitle}
        description={loc.player.seekFadeDesc}
        checked={seekFadeEnabled}
        onChange={onToggleSeekFade}
      />

      {/* Automatic silence skipping (silence trimming) */}
      <ToggleCard
        icon={<VolumeX size={20} />}
        tone="green"
        title={loc.settings.silenceTrimmingTitle}
        description={loc.settings.silenceTrimmingDesc}
        checked={silenceTrimmingEnabled}
        onChange={(on) => onSetSilenceTrimming(on, silenceTrimmingThreshold)}
      >
        <SliderRow
          label={loc.settings.silenceTrimmingThreshold}
          tone="green"
          min={-80}
          max={-25}
          step={2.5}
          value={silenceTrimmingThreshold}
          format={(v) => `${v.toFixed(1)} dBFS`}
          disabled={!silenceTrimmingEnabled}
          onChange={(v) => onSetSilenceTrimming(silenceTrimmingEnabled, v)}
        />
        <div className="mt-1 flex justify-between text-xxs text-fg-muted">
          <span>-80 dB ({loc.settings.silenceTrimmingPure})</span>
          <span>-50 dB ({loc.settings.silenceTrimmingRecommended})</span>
          <span>-25 dB ({loc.settings.silenceTrimmingAggressive})</span>
        </div>
      </ToggleCard>

      {/* ReplayGain 2.0 / EBU R128 volume normalisation */}
      <ReplayGainOption {...props} />

      {/* Volume response, unit, curve and OSD */}
      <VolumeAndOsdCard {...props} />
    </SettingsPage>
  );
};
