import React from 'react';
import { Headphones } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cn } from '../../../utils/cn';

export type CrossfeedOptionProps = Pick<AudioDevicesSettingsViewProps, 'crossfeedEnabled' | 'loc' | 'onSetCrossfeed' | 'crossfeedPreset' | 'crossfeedFcut' | 'crossfeedFeed'>;

export const CrossfeedOption: React.FC<CrossfeedOptionProps> = ({
  crossfeedEnabled,
  crossfeedFcut,
  crossfeedFeed,
  crossfeedPreset,
  loc,
  onSetCrossfeed,
}) => (
    <div
      className={cn(
        'glass-card mb-3.5 rounded-xl border px-5 py-4.5 transition-all duration-200',
        crossfeedEnabled ? 'border-indigo-500/45' : 'border-line',
        crossfeedEnabled ? 'bg-indigo-500/5' : 'bg-white/3',
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones size={18} className="text-accent-cyan" />
          <span className="text-md font-bold text-fg">
            {loc.settings.crossfeedTitle}
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={crossfeedEnabled}
            onChange={(e) => onSetCrossfeed(e.target.checked, crossfeedPreset)}
            className="h-4.5 w-4.5 cursor-pointer accent-accent-cyan"
          />
          <span className={cn('text-ui font-semibold', crossfeedEnabled ? 'text-accent-cyan' : 'text-fg-muted')}>
            {crossfeedEnabled ? loc.settings.crossfeedActive : loc.settings.crossfeedOff}
          </span>
        </label>
      </div>

      <div className="mb-3.5 text-ui text-fg-secondary">
        {loc.settings.crossfeedDesc}
      </div>

      {/* Wybór presetu: Default / ChuMoy / JanMeier / Custom */}
      <div className={cn(
        'mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(--spacing(32.5),1fr))] gap-2',
        crossfeedEnabled ? 'opacity-100' : 'opacity-45',
        crossfeedEnabled ? 'pointer-events-auto' : 'pointer-events-none',
      )}>
        {([
          { id: 'Default', label: loc.settings.crossfeedPresetDefault },
          { id: 'ChuMoy', label: loc.settings.crossfeedPresetChuMoy },
          { id: 'JanMeier', label: loc.settings.crossfeedPresetJanMeier },
          { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
        ] as const).map((p) => {
          const isActive = crossfeedPreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSetCrossfeed(crossfeedEnabled, p.id)}
              className={cn(
                'rounded-lg border px-2.5 py-2 text-center text-xs font-bold transition-all duration-150',
                isActive ? 'bg-indigo-500/25' : 'bg-white/6',
                isActive ? 'border-indigo-500/60' : 'border-line',
                isActive ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Suwaki częstotliwości i feedu */}
      <div className={cn(
        'flex flex-col gap-2.5 transition-opacity duration-200',
        crossfeedEnabled ? 'opacity-100' : 'opacity-45',
        crossfeedEnabled && crossfeedPreset === 'Custom' ? 'pointer-events-auto' : 'pointer-events-none',
      )}>
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-ui text-fg-secondary">
              {loc.settings.crossfeedFcut}
            </span>
            <span className="font-mono text-ui font-bold text-fg">
              {crossfeedFcut} Hz
            </span>
          </div>
          <input
            type="range"
            min="300"
            max="2000"
            step="25"
            value={crossfeedFcut}
            onChange={(e) => onSetCrossfeed(crossfeedEnabled, 'Custom', parseInt(e.target.value, 10), crossfeedFeed)}
            className="w-full accent-accent-cyan"
          />
        </div>
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-ui text-fg-secondary">
              {loc.settings.crossfeedFeed}
            </span>
            <span className="font-mono text-ui font-bold text-fg">
              {(crossfeedFeed / 10).toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            step="5"
            value={crossfeedFeed}
            onChange={(e) => onSetCrossfeed(crossfeedEnabled, 'Custom', crossfeedFcut, parseInt(e.target.value, 10))}
            className="w-full accent-accent-cyan"
          />
        </div>
      </div>
    </div>
);
