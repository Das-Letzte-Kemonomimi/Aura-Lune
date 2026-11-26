import React from 'react';
import { Activity, RotateCcw } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cn } from '../../../utils/cn';

export type DspBlockSizeOptionProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'dspBlockSize' | 'onSetDspBlockSize'>;

export const DspBlockSizeOption: React.FC<DspBlockSizeOptionProps> = ({
  dspBlockSize,
  loc,
  onSetDspBlockSize,
}) => (
    <div className="glass-card mb-3.5 rounded-xl border border-line px-5 py-4.5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-2 text-md font-bold text-fg">
            <Activity size={17} className="text-accent-pink" />
            {loc.settings.dspBlockSizeTitle}
            {dspBlockSize === 2048 && (
              <span className="rounded-xl bg-accent-green/20 px-2 py-0.5 text-xxs font-semibold text-accent-green">
                {loc.settings.dspBlockSizeDefault}
              </span>
            )}
          </div>
          <div className="max-w-130 text-ui leading-snug text-fg-secondary">
            {loc.settings.dspBlockSizeDesc}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-base font-bold',
            dspBlockSize === 2048 ? 'text-accent-green' : 'text-accent-cyan',
          )}>
            {dspBlockSize} {loc.settings.dspBlockSizeFrames}
          </span>
          <button
            onClick={() => onSetDspBlockSize(2048)}
            disabled={dspBlockSize === 2048}
            className={cn(
              'glass-card flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-accent-green',
              dspBlockSize === 2048 ? 'opacity-40' : 'opacity-100',
              dspBlockSize === 2048 ? 'cursor-default' : 'cursor-pointer',
            )}
            title={loc.settings.dspBlockSizeReset}
          >
            <RotateCcw size={12} /> {loc.settings.dspBlockSizeDefaultLabel}
          </button>
        </div>
      </div>

      {/* Quick DSP block presets */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {[
          { label: loc.settings.dspBlockPreset512, value: 512 },
          { label: loc.settings.dspBlockPreset1024, value: 1024 },
          { label: loc.settings.dspBlockPreset2048, value: 2048, isDefault: true },
          { label: loc.settings.dspBlockPreset4096, value: 4096 },
          { label: loc.settings.dspBlockPreset8192, value: 8192 },
        ].map((preset) => {
          const isActive = dspBlockSize === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => onSetDspBlockSize(preset.value)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-all duration-150',
                isActive ? 'font-bold' : 'font-medium',
                isActive ? preset.isDefault ? 'bg-accent-green/25' : 'bg-sky-400/25' : 'bg-white/4',
                isActive ? preset.isDefault ? 'border-accent-green' : 'border-accent-cyan' : 'border-line',
                isActive ? preset.isDefault ? 'text-accent-green' : 'text-accent-cyan' : 'text-fg-secondary',
              )}
            >
              {preset.label}
            </button>
          );
        })}

        {/* Manual entry of any size */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-fg-muted">
            {loc.settings.dspBlockCustom}
          </span>
          <input
            type="number"
            min={256}
            max={16384}
            step={256}
            value={dspBlockSize}
            onChange={(e) => onSetDspBlockSize(Number(e.target.value))}
            className="w-20 rounded-md border border-line bg-white/5 px-2 py-1.5 text-center text-ui text-fg"
          />
        </div>
      </div>
    </div>
);
