import React, { useState } from 'react';
import { Activity, ChevronDown, Headphones, Power, Sliders } from '../../../components/ui/icons';
import { EQUALIZER_BANDS } from '../../../types/equalizer';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { ToggleSwitch } from '../../../components/common/ToggleSwitch';
import {
  Badge,
  Button,
  Card,
  Chip,
  MenuItem,
  Popover,
  RangeSlider,
  SectionHeader,
  StatusDot,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { presetLabel } from '../../../utils/dspPresetLabels';
import { PreampControl } from './PreampControl';

export type DspGraphicEqRackProps = Pick<
  DspStudioViewProps,
  | 'loc'
  | 'selectedEqPreset'
  | 'eqPresets'
  | 'handleApplyEqPreset'
  | 'handleResetEq'
  | 'setIsAutoEqOpen'
  | 'setIsParametricEqOpen'
  | 'setIsDynamicsStudioOpen'
  | 'handleEqToggle'
  | 'handleToggleEqAutoStartup'
  | 'eqAutoStartup'
  | 'handleEqBandChange'
  | 'preampDb'
  | 'preampAuto'
  | 'autoPreampValue'
  | 'handlePreampChange'
  | 'handleTogglePreampAuto'
> & {
  status: PlaybackStatus;
};

const formatGain = (gain: number) => `${gain > 0 ? '+' : ''}${gain.toFixed(1)} dB`;

export const DspGraphicEqRack: React.FC<DspGraphicEqRackProps> = ({
  autoPreampValue,
  eqAutoStartup,
  eqPresets,
  handleApplyEqPreset,
  handleEqBandChange,
  handleEqToggle,
  handlePreampChange,
  handleResetEq,
  handleToggleEqAutoStartup,
  handleTogglePreampAuto,
  loc,
  preampAuto,
  preampDb,
  selectedEqPreset,
  setIsAutoEqOpen,
  setIsDynamicsStudioOpen,
  setIsParametricEqOpen,
  status,
}) => {
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const closePresetMenu = () => setIsPresetMenuOpen(false);
  // Sliders moved by hand leave the "custom" sentinel id, which is not in the list: show it as its own row.
  const isCustom = Boolean(selectedEqPreset) && !eqPresets.some((p) => p.id === selectedEqPreset);
  const selectedLabel = presetLabel(
    loc,
    'eq',
    selectedEqPreset,
    eqPresets.find((p) => p.id === selectedEqPreset)?.name ?? selectedEqPreset,
  );
  const dynamicsOn = status.compressor_enabled || status.saturator_enabled;

  return (
    <Card highlight={Boolean(status.equalizer_enabled) && 'pink'}>
      <SectionHeader
        icon={<Sliders size={18} />}
        tone="pink"
        title={loc.dsp.equalizer}
        description={loc.dsp.eqDesc}
        actions={<ToggleSwitch checked={Boolean(status.equalizer_enabled)} onChange={handleEqToggle} label={loc.dsp.equalizer} />}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Popover
          open={isPresetMenuOpen}
          onClose={closePresetMenu}
          label={loc.dsp.eqPresets}
          className="max-h-90 min-w-55 overflow-y-auto"
          trigger={
            <Button
              size="sm"
              aria-haspopup="menu"
              aria-expanded={isPresetMenuOpen}
              title={loc.dsp.eqPresets}
              onClick={() => setIsPresetMenuOpen((open) => !open)}
            >
              <Sliders size={13} className="text-accent-pink" />
              {selectedLabel}
              <ChevronDown
                size={12}
                className={cn('text-fg-muted transition-transform duration-200', isPresetMenuOpen && 'rotate-180')}
              />
            </Button>
          }
        >
          <div aria-hidden="true" className="label-caps px-3 py-1">{loc.dsp.eqPresets}</div>
          {isCustom && (
            <MenuItem selected onClick={closePresetMenu}>
              {selectedLabel}
            </MenuItem>
          )}
          {eqPresets.map((preset) => (
            <MenuItem
              key={preset.id}
              selected={preset.id === selectedEqPreset}
              onClick={() => handleApplyEqPreset(preset.id)}
            >
              {presetLabel(loc, 'eq', preset.id, preset.name)}
            </MenuItem>
          ))}
        </Popover>

        <Button size="sm" onClick={handleResetEq}>
          {loc.dsp.reset} (0 dB)
        </Button>

        {/* AutoEQ headphone profile database */}
        <Button
          variant="tinted"
          tone="cyan"
          size="sm"
          onClick={() => setIsAutoEqOpen(true)}
          title={loc.dsp.autoEqHarmanTooltip}
        >
          <Headphones size={13} /> AutoEQ
        </Button>

        {/* Multi-band parametric equalizer; the dot shows it is processing */}
        <Button
          variant="tinted"
          tone="purple"
          size="sm"
          onClick={() => setIsParametricEqOpen(true)}
          title={loc.parametricEq.subtitle}
        >
          <Sliders size={13} /> PEQ Studio
          {status.parametric_eq_enabled && <StatusDot tone="purple" />}
        </Button>

        {/* Dynamics & tube studio (compressor / saturator) */}
        <Button
          variant="tinted"
          tone="pink"
          size="sm"
          onClick={() => setIsDynamicsStudioOpen(true)}
          title={loc.dsp.dynamicsStudioTooltip}
        >
          <Activity size={13} /> Dynamics Studio
          {dynamicsOn && <StatusDot tone="pink" />}
        </Button>

        <Chip pressed={eqAutoStartup} tone="green" onClick={handleToggleEqAutoStartup} title={loc.dsp.eqAutostart}>
          <Power size={12} /> {loc.dsp.eqAutostartShort}
        </Chip>
      </div>

      <PreampControl
        loc={loc}
        preampDb={preampDb}
        preampAuto={preampAuto}
        autoPreampValue={autoPreampValue}
        equalizerEnabled={Boolean(status.equalizer_enabled)}
        onPreampChange={handlePreampChange}
        onToggleAuto={handleTogglePreampAuto}
      />

      {/* 10 bands in two columns */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {EQUALIZER_BANDS.map((band, idx) => {
          const gain = status.equalizer_bands?.[idx] ?? 0;
          return (
            <Card key={band.freq} variant="inset" padding="none" className="flex flex-col gap-2 px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span>
                  <span className="mr-1.5 text-sm font-bold text-fg">{band.freq}</span>
                  <span className="text-xxs text-fg-muted">({band.label})</span>
                </span>
                <Badge mono tone={gain > 0 ? 'pink' : gain < 0 ? 'cyan' : 'neutral'}>
                  {formatGain(gain)}
                </Badge>
              </div>
              <RangeSlider
                aria-label={`${band.freq} (${band.label})`}
                min={-24}
                max={12}
                step={0.5}
                value={gain}
                onChange={(v) => handleEqBandChange(idx, v)}
              />
            </Card>
          );
        })}
      </div>
    </Card>
  );
};
