import React from 'react';
import { Volume2 } from 'lucide-react';
import { type VolumeOsdPosition } from '../../../components/player/VolumeOsd';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cn } from '../../../utils/cn';

export type VolumeAndOsdCardProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'instantVolume' | 'onToggleInstantVolume' | 'volumeUnit' | 'onSetVolumeUnit' | 'volumeOsdPosition' | 'onSetVolumeOsdPosition' | 'onToggleRecapOptIn' | 'recapOptIn'>;

export const VolumeAndOsdCard: React.FC<VolumeAndOsdCardProps> = ({
  instantVolume,
  loc,
  onSetVolumeOsdPosition,
  onSetVolumeUnit,
  onToggleInstantVolume,
  onToggleRecapOptIn,
  recapOptIn,
  volumeOsdPosition,
  volumeUnit,
}) => (
    <div className="glass-card mb-3.5 rounded-xl p-5">
      <h4 className="mx-0 mt-0 mb-4 flex items-center gap-2 text-base font-bold text-fg">
        <Volume2 size={18} className="text-accent-cyan" /> {loc.settings.volumeSectionTitle}
      </h4>

      <div className="flex flex-col gap-3.5 text-ui">
        {/* Tryb głośności: Natychmiastowy vs Płynny */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-fg">
              {loc.settings.volumeSliderResponse}
            </div>
            <div className="text-xs text-fg-muted">
              {instantVolume
                ? loc.settings.volumeSliderInstantDesc
                : loc.settings.volumeSliderSmoothDesc}
            </div>
          </div>
          <button
            onClick={onToggleInstantVolume}
            className={cn(
              'rounded-lg border px-3.5 py-1.5 text-xs font-bold',
              instantVolume ? 'bg-accent-cyan/25' : 'bg-white/6',
              instantVolume ? 'border-accent-cyan' : 'border-line',
              instantVolume ? 'text-accent-cyan' : 'text-fg-muted',
            )}
          >
            {instantVolume ? loc.settings.volumeSliderInstant : loc.settings.volumeSliderSmooth}
          </button>
        </div>

        {/* Jednostka wyświetlania głośności: Procenty vs Decybele */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-fg">
              {loc.settings.volumeUnitTitle}
            </div>
            <div className="text-xs text-fg-muted">
              {volumeUnit === 'db' ? loc.settings.volumeUnitDb : loc.settings.volumeUnitPercent}
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-black/30 p-1">
            <button
              type="button"
              onClick={() => onSetVolumeUnit('percent')}
              className={cn(
                'rounded-md border-0 px-2.5 py-1 text-xs font-bold',
                volumeUnit === 'percent' ? 'bg-accent-pink' : 'bg-transparent',
                volumeUnit === 'percent' ? 'text-fg' : 'text-fg-muted',
              )}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => onSetVolumeUnit('db')}
              className={cn(
                'rounded-md border-0 px-2.5 py-1 text-xs font-bold',
                volumeUnit === 'db' ? 'bg-accent-cyan' : 'bg-transparent',
                volumeUnit === 'db' ? 'text-fg' : 'text-fg-muted',
              )}
            >
              dB
            </button>
          </div>
        </div>

        {/* Pozycja OSD głośności */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-fg">
              {loc.settings.volumeOsdPosTitle}
            </div>
            <div className="text-xs text-fg-muted">
              {loc.settings.volumeOsdPosDesc}
            </div>
          </div>
          <select
            value={volumeOsdPosition}
            onChange={(e) => onSetVolumeOsdPosition(e.target.value as VolumeOsdPosition)}
            className="rounded-lg"
          >
            <option value="bottom-center">{loc.settings.volumeOsdBottomCenter}</option>
            <option value="center">{loc.settings.volumeOsdCenter}</option>
            <option value="top-right">{loc.settings.volumeOsdTopRight}</option>
            <option value="top-left">{loc.settings.volumeOsdTopLeft}</option>
            <option value="bottom-right">{loc.settings.volumeOsdBottomRight}</option>
            <option value="bottom-left">{loc.settings.volumeOsdBottomLeft}</option>
            <option value="off">{loc.settings.volumeOsdOff}</option>
          </select>
        </div>

        {/* Zgoda na Auralune Recap (Opt-In) */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-fg">
              {loc.settings.recapTitle}
            </div>
            <div className="text-xs text-fg-muted">
              {loc.settings.recapDesc}
            </div>
          </div>
          <button
            onClick={onToggleRecapOptIn}
            className={cn(
              'rounded-lg border px-3.5 py-1.5 text-xs font-bold',
              recapOptIn ? 'bg-accent-pink/25' : 'bg-white/6',
              recapOptIn ? 'border-accent-pink' : 'border-line',
              recapOptIn ? 'text-accent-pink' : 'text-fg-muted',
            )}
          >
            {recapOptIn ? loc.settings.recapEnabled : loc.settings.recapDisabled}
          </button>
        </div>
      </div>
    </div>
);
