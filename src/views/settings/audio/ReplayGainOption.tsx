import React from 'react';
import { Activity, Sliders, Zap, ShieldCheck } from '../../../components/ui/icons';
import { Badge, Button, Card, SectionHeader, SegmentedControl, SettingRow, SliderRow, Spinner } from '../../../components/ui';
import { ToggleSwitch } from '../../../components/common/ToggleSwitch';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type ReplayGainOptionProps = Pick<
  AudioDevicesSettingsViewProps,
  | 'replaygainMode'
  | 'loc'
  | 'onSetReplayGain'
  | 'replaygainPreAmp'
  | 'replaygainFallbackGain'
  | 'replaygainPreventClipping'
  | 'replaygainStatus'
  | 'replaygainScanWriteTags'
  | 'onToggleReplaygainScanWriteTags'
  | 'onScanLibraryReplayGain'
  | 'isReplaygainScanning'
>;

type ReplayGainMode = ReplayGainOptionProps['replaygainMode'];

const signedDb = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} dB`;

export const ReplayGainOption: React.FC<ReplayGainOptionProps> = ({
  isReplaygainScanning,
  loc,
  onScanLibraryReplayGain,
  onSetReplayGain,
  onToggleReplaygainScanWriteTags,
  replaygainFallbackGain,
  replaygainMode,
  replaygainPreAmp,
  replaygainPreventClipping,
  replaygainScanWriteTags,
  replaygainStatus,
}) => {
  const modeLabels: Record<ReplayGainMode, string> = {
    Off: loc.settings.replaygainModeOff,
    Track: loc.settings.replaygainModeTrack,
    Album: loc.settings.replaygainModeAlbum,
    Auto: loc.settings.replaygainModeAuto,
  };
  const active = replaygainMode !== 'Off';
  const set = (
    mode = replaygainMode,
    preAmp = replaygainPreAmp,
    fallback = replaygainFallbackGain,
    preventClipping = replaygainPreventClipping,
  ) => onSetReplayGain(mode, preAmp, fallback, preventClipping);

  return (
    <Card highlight={active && 'purple'}>
      <SectionHeader
        icon={<Sliders size={20} />}
        tone="purple"
        title={loc.settings.replaygainTitle}
        description={loc.settings.replaygainDesc}
        actions={
          active && (
            <Badge tone="purple">
              <Zap size={12} /> {modeLabels[replaygainMode]}
            </Badge>
          )
        }
      />

      {/* Normalisation modes: Off / Track / Album / Auto */}
      <SegmentedControl
        items={(['Off', 'Track', 'Album', 'Auto'] as const).map((m) => ({ value: m, label: modeLabels[m] }))}
        value={replaygainMode}
        onChange={(m) => set(m)}
        label={loc.settings.replaygainTitle}
        tone="purple"
        fullWidth
        className="mt-4 *:whitespace-normal *:leading-tight"
      />

      {/* ReplayGain sliders and options */}
      <div className="mt-4 flex flex-col gap-3">
        <SliderRow
          label={loc.settings.replaygainPreAmp}
          tone="purple"
          min={-6}
          max={6}
          step={0.5}
          value={replaygainPreAmp}
          format={signedDb}
          disabled={!active}
          onChange={(v) => set(replaygainMode, v)}
        />
        <SliderRow
          label={loc.settings.replaygainFallbackGain}
          tone="purple"
          min={-12}
          max={0}
          step={1}
          value={replaygainFallbackGain}
          format={signedDb}
          disabled={!active}
          onChange={(v) => set(replaygainMode, replaygainPreAmp, v)}
        />
        <SettingRow
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          title={loc.settings.replaygainPreventClipping}
          control={
            <ToggleSwitch
              checked={replaygainPreventClipping}
              disabled={!active}
              onChange={(on) => set(replaygainMode, replaygainPreAmp, replaygainFallbackGain, on)}
              label={loc.settings.replaygainPreventClipping}
            />
          }
          className="py-0"
        />
      </div>

      {/* Real-time adjustment and limiter status */}
      {active && (
        <Card variant="inset" padding="none" className="mt-3 flex items-center justify-between px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span>{loc.settings.replaygainTargetAdjustment}:</span>
            <strong className="font-mono text-fg">{signedDb(replaygainStatus[0])}</strong>
          </div>
          <div className="flex items-center gap-1 font-semibold text-accent-green">
            <ShieldCheck size={14} /> {loc.settings.replaygainLimiterActive}
          </div>
        </Card>
      )}

      {/* EBU R128 loudness scanner */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-3.5">
        <div className="flex items-center gap-2.5 text-ui text-fg-secondary">
          <ToggleSwitch
            checked={replaygainScanWriteTags}
            onChange={onToggleReplaygainScanWriteTags}
            label={loc.settings.scanReplayGainWriteTags}
          />
          <span aria-hidden="true">{loc.settings.scanReplayGainWriteTags}</span>
        </div>
        <Button variant="tinted" tone="purple" onClick={onScanLibraryReplayGain} disabled={isReplaygainScanning}>
          {isReplaygainScanning ? <Spinner size="sm" tone="purple" /> : <Activity size={16} />}
          {isReplaygainScanning ? loc.settings.scanReplayGainScanning : loc.settings.scanReplayGainLibrary}
        </Button>
      </div>
    </Card>
  );
};
