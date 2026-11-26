import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cn } from '../../../utils/cn';

export type OutputBufferOptionProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'audioBufferMs' | 'onSetAudioBuffer'>;

export const OutputBufferOption: React.FC<OutputBufferOptionProps> = ({
  audioBufferMs,
  loc,
  onSetAudioBuffer,
}) => (
    <div className="glass-card mb-3.5 rounded-xl border border-line px-5 py-4.5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-2 text-md font-bold text-fg">
            <Layers size={17} className="text-accent-cyan" />
            {loc.settings.audioBufferTitle}
            {audioBufferMs === 600 && (
              <span className="rounded-xl bg-accent-green/20 px-2 py-0.5 text-xxs font-semibold text-accent-green">
                {loc.settings.audioBufferDefault}
              </span>
            )}
          </div>
          <div className="max-w-130 text-ui leading-snug text-fg-secondary">
            {loc.settings.audioBufferDesc}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-base font-bold',
            audioBufferMs === 600 ? 'text-accent-green' : 'text-accent-pink',
          )}>
            {audioBufferMs} ms
          </span>
          <button
            onClick={() => onSetAudioBuffer(600)}
            disabled={audioBufferMs === 600}
            className={cn(
              'glass-card flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-accent-green',
              audioBufferMs === 600 ? 'opacity-40' : 'opacity-100',
              audioBufferMs === 600 ? 'cursor-default' : 'cursor-pointer',
            )}
            title={loc.settings.audioBufferReset}
          >
            <RotateCcw size={12} /> {loc.settings.audioBufferDefaultLabel}
          </button>
        </div>
      </div>

      {/* Slider + presets */}
      <div className="mt-2 flex items-center gap-3.5">
        <input
          type="range"
          min={50}
          max={2000}
          step={25}
          value={audioBufferMs}
          onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
          className="flex-1 cursor-pointer accent-accent-pink"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={50}
            max={4000}
            value={audioBufferMs}
            onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
            className="w-17.5 rounded-md border border-line bg-white/5 px-2 py-1.5 text-center text-ui text-fg"
          />
          <span className="text-ui text-fg-muted">ms</span>
        </div>
      </div>

      {/* Quick audio buffer presets */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {[
          { label: '80 ms (Ultra-low)', value: 80 },
          { label: loc.settings.audioBufferPreset250, value: 250 },
          { label: loc.settings.audioBufferPreset600, value: 600, isDefault: true },
          { label: loc.settings.audioBufferPreset1000, value: 1000 },
          { label: loc.settings.audioBufferPreset2000, value: 2000 },
        ].map((preset) => {
          const isActive = audioBufferMs === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => onSetAudioBuffer(preset.value)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition-all duration-150',
                isActive ? 'font-bold' : 'font-medium',
                isActive ? preset.isDefault ? 'bg-accent-green/25' : 'bg-pink-500/25' : 'bg-white/4',
                isActive ? preset.isDefault ? 'border-accent-green' : 'border-accent-pink' : 'border-line',
                isActive ? preset.isDefault ? 'text-accent-green' : 'text-accent-pink' : 'text-fg-secondary',
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
);
