import React from 'react';
import { Activity, Zap, ShieldCheck } from '../../../components/ui/icons';
import { Badge, Button, SegmentedControl, SettingRow, SettingsGroup, SliderRow, Spinner } from '../../../components/ui';
import { ToggleRow } from '../ToggleRow';
import type { AudioSettingsProps } from './audioSettingsProps';
import { formatSignedDb } from '../../../utils/preamp';

export type ReplayGainOptionProps = Pick<
  AudioSettingsProps,
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

/** Mirrors `domain::replaygain::{TAGGED,UNTAGGED}_PREAMP_*`. */
const TAGGED_PREAMP_MIN_DB = -12;
const TAGGED_PREAMP_MAX_DB = 12;
const UNTAGGED_PREAMP_MIN_DB = -15;
const UNTAGGED_PREAMP_MAX_DB = 15;

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
    <SettingsGroup
      label={loc.settings.replaygainTitle}
      description={loc.settings.replaygainDesc}
      actions={
        active && (
          <Badge tone="purple">
            <Zap size={12} /> {modeLabels[replaygainMode]}
          </Badge>
        )
      }
    >
      {/* Normalisation modes: Off / Track / Album / Auto */}
      <SettingRow
        compact
        title={loc.settings.replaygainTitle}
        control={
          <SegmentedControl
            size="sm"
            items={(['Off', 'Track', 'Album', 'Auto'] as const).map((m) => ({ value: m, label: modeLabels[m] }))}
            value={replaygainMode}
            onChange={(m) => set(m)}
            label={loc.settings.replaygainTitle}
            tone="purple"
          />
        }
      />

      {/* Pre-amps, clipping guard and live status: only while normalisation is on */}
      {active && (
        <div className="flex flex-col gap-3 px-4 py-3">
          <SliderRow
            label={loc.settings.replaygainPreampTagged}
            tone="purple"
            min={TAGGED_PREAMP_MIN_DB}
            max={TAGGED_PREAMP_MAX_DB}
            step={0.5}
            value={replaygainPreAmp}
            format={formatSignedDb}
            onChange={(v) => set(replaygainMode, v)}
          />
          <SliderRow
            label={loc.settings.replaygainPreampUntagged}
            tone="purple"
            min={UNTAGGED_PREAMP_MIN_DB}
            max={UNTAGGED_PREAMP_MAX_DB}
            step={0.5}
            value={replaygainFallbackGain}
            format={formatSignedDb}
            onChange={(v) => set(replaygainMode, replaygainPreAmp, v)}
          />
        </div>
      )}
      {active && (
        <ToggleRow
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          title={loc.settings.replaygainPreventClipping}
          checked={replaygainPreventClipping}
          onChange={(on) => set(replaygainMode, replaygainPreAmp, replaygainFallbackGain, on)}
        />
      )}
      {active && (
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span>{loc.settings.replaygainTargetAdjustment}:</span>
            <strong className="font-mono text-fg">{formatSignedDb(replaygainStatus[0])}</strong>
          </div>
          {replaygainStatus[2] ? (
            <div className="flex items-center gap-1 font-semibold text-accent-green">
              <ShieldCheck size={14} /> {loc.settings.replaygainLimiterActive}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-fg-muted">{loc.settings.replaygainLimiterOff}</div>
          )}
        </div>
      )}

      {/* EBU R128 loudness scanner */}
      <ToggleRow
        title={loc.settings.scanReplayGainWriteTags}
        checked={replaygainScanWriteTags}
        onChange={onToggleReplaygainScanWriteTags}
      />
      <SettingRow
        compact
        title={loc.settings.scanReplayGainLibrary}
        control={
          <Button variant="tinted" tone="purple" onClick={onScanLibraryReplayGain} disabled={isReplaygainScanning}>
            {isReplaygainScanning ? <Spinner size="sm" tone="purple" /> : <Activity size={16} />}
            {isReplaygainScanning ? loc.settings.scanReplayGainScanning : loc.settings.scanReplayGainLibrary}
          </Button>
        }
      />
    </SettingsGroup>
  );
};
