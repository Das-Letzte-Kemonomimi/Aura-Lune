import React from 'react';
import type { Translations } from '../../../i18n';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { type ParametricEqPresetDto, type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

export type PeqPresetBarProps = {} & {
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
}) => (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-black/25 px-6 py-3">
      {/* Wybór Presetu */}
      <div className="flex items-center gap-2">
        <span className="text-ui font-semibold text-fg-secondary">
          Preset:
        </span>
        <select
          value={selectedPresetName}
          onChange={(e) => handleSelectPreset(e.target.value)}
          className="cursor-pointer rounded-lg border border-line bg-white/8 px-3 py-1.5 text-ui font-semibold text-fg outline-none"
        >
          <option value="">{loc.parametricEq.customProfile}</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Przedwzmacniacz (Preamp) z ochroną przed clippingiem */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2">
          <span className="text-ui font-semibold text-fg-secondary">
            Preamp:
          </span>
          <input
            type="range"
            min="-20"
            max="10"
            step="0.5"
            value={state.preamp_db}
            onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
            className="w-25 cursor-pointer"
          />
          <span
            className={cn(
              'min-w-14 font-mono text-ui font-bold',
              state.preamp_db < 0 ? 'text-blue-400' : state.preamp_db > 0 ? 'text-accent-pink' : 'text-fg-muted',
            )}
          >
            {state.preamp_db > 0 ? `+${state.preamp_db.toFixed(1)}` : state.preamp_db.toFixed(1)} dB
          </span>
        </div>

        {/* Ostrzeżenie przed przesterowaniem */}
        {maxEffectiveBoost > 0.01 ? (
          <button
            onClick={handleApplySafePreamp}
            title={fmt(loc.parametricEq.clippingRiskTitle, maxEffectiveBoost.toFixed(1), safePreampDb.toFixed(1))}
            className="flex items-center gap-1.5 rounded-lg border border-accent-amber/40 bg-accent-amber/20 px-2.5 py-1.5 text-xs font-bold text-amber-400"
          >
            <AlertTriangle size={13} />
            {fmt(loc.parametricEq.clippingRiskBadge, maxEffectiveBoost.toFixed(1))}
          </button>
        ) : (
          <span
            className="flex items-center gap-1 rounded-md bg-accent-green/10 px-2 py-1 text-xxs font-semibold text-accent-green"
          >
            <ShieldCheck size={12} /> {loc.parametricEq.headroomOk}
          </span>
        )}
      </div>
    </div>
);
