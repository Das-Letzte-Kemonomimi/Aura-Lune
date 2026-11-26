import React from 'react';
import type { Translations } from '../../../i18n';
import { ShieldCheck, AlertTriangle } from '../../ui/icons';
import { type ParametricEqPresetDto, type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import { fmt } from '../../../utils/fmt';
import { Badge, Button, RangeSlider, Select } from '../../ui';

export type PeqPresetBarProps = {
  selectedPresetName: string;
  handleSelectPreset: (presetName: string) => void;
  loc: Translations;
  presets: ParametricEqPresetDto[];
  state: ParametricEqStateDto;
  handlePreampChange: (val: number) => void;
  maxEffectiveBoost: number;
  handleApplySafePreamp: () => void;
  safePreampDb: number;
};

export const PeqPresetBar: React.FC<PeqPresetBarProps> = ({
  handleApplySafePreamp,
  handlePreampChange,
  handleSelectPreset,
  loc,
  maxEffectiveBoost,
  presets,
  safePreampDb,
  selectedPresetName,
  state,
}) => {
  const preamp = state.preamp_db;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-black/25 px-6 py-3">
      <label className="flex items-center gap-2 text-ui font-semibold text-fg-secondary">
        Preset:
        <Select size="sm" value={selectedPresetName} onChange={(e) => handleSelectPreset(e.target.value)} className="w-auto">
          <option value="">{loc.parametricEq.customProfile}</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>

      {/* Preamp with clipping protection */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2">
          <span className="text-ui font-semibold text-fg-secondary">Preamp:</span>
          <RangeSlider
            aria-label="Preamp"
            min={-20}
            max={10}
            step={0.5}
            value={preamp}
            onChange={handlePreampChange}
            className="w-25"
          />
          <Badge mono tone={preamp < 0 ? 'cyan' : preamp > 0 ? 'pink' : 'neutral'} className="min-w-16 justify-center">
            {preamp > 0 ? `+${preamp.toFixed(1)}` : preamp.toFixed(1)} dB
          </Badge>
        </div>

        {maxEffectiveBoost > 0.01 ? (
          <Button
            variant="tinted"
            tone="amber"
            size="sm"
            onClick={handleApplySafePreamp}
            title={fmt(loc.parametricEq.clippingRiskTitle, maxEffectiveBoost.toFixed(1), safePreampDb.toFixed(1))}
          >
            <AlertTriangle size={13} />
            {fmt(loc.parametricEq.clippingRiskBadge, maxEffectiveBoost.toFixed(1))}
          </Button>
        ) : (
          <Badge tone="green">
            <ShieldCheck size={12} /> {loc.parametricEq.headroomOk}
          </Badge>
        )}
      </div>
    </div>
  );
};
