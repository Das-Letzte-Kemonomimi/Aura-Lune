import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { cn } from '../../../utils/cn';

export type DspEngineSelectorProps = Pick<DspStudioViewProps, 'loc' | 'handleEngineChange'> & {
  status: PlaybackStatus;
};

export const DspEngineSelector: React.FC<DspEngineSelectorProps> = ({
  handleEngineChange,
  loc,
  status,
}) => (
    <div className="mb-6">
      <label className="mb-2.5 block text-sm font-semibold text-fg-secondary">
        {loc.dsp.engine}:
      </label>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(55),1fr))] gap-3.5">
        {/* Bypass card (no DSP / clean sound) */}
        <div
          onClick={() => handleEngineChange('Bypass')}
          className={cn(
            'glass-card cursor-pointer rounded-2xl p-4',
            status.engine === 'Bypass' ? 'border-2 border-accent-green' : 'border border-line',
            status.engine === 'Bypass' ? 'bg-accent-green/15' : 'bg-black/20',
          )}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-base font-bold text-fg">{loc.dsp.bypass}</span>
            <span className="rounded-md bg-accent-green/20 px-2 py-0.5 text-xxs font-bold text-accent-green">
              DIRECT
            </span>
          </div>
          <p className="text-xs leading-snug text-fg-secondary">
            {loc.dsp.bypassDesc}
          </p>
        </div>

        {/* Rubber Band card */}
        <div
          onClick={() => handleEngineChange('RubberBand')}
          className={cn(
            'glass-card cursor-pointer rounded-2xl p-4',
            status.engine === 'RubberBand' ? 'border-2 border-accent-pink' : 'border border-line',
            status.engine === 'RubberBand' ? 'bg-pink-500/15' : 'bg-black/20',
          )}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-base font-bold text-fg">{loc.dsp.rubberband}</span>
            <span className="rounded-md bg-accent-pink/20 px-2 py-0.5 text-xxs font-bold text-accent-pink">
              HI-FI (MSC)
            </span>
          </div>
          <p className="text-xs leading-snug text-fg-secondary">
            {loc.dsp.rubberbandDesc}
          </p>
        </div>

        {/* SoundTouch card */}
        <div
          onClick={() => handleEngineChange('SoundTouch')}
          className={cn(
            'glass-card cursor-pointer rounded-2xl p-4',
            status.engine === 'SoundTouch' ? 'border-2 border-accent-purple' : 'border border-line',
            status.engine === 'SoundTouch' ? 'bg-accent-purple/15' : 'bg-black/20',
          )}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-base font-bold text-fg">{loc.dsp.soundtouch}</span>
            <span className="rounded-md bg-sky-400/20 px-2 py-0.5 text-xxs font-bold text-accent-cyan">
              LOW CPU
            </span>
          </div>
          <p className="text-xs leading-snug text-fg-secondary">
            {loc.dsp.soundtouchDesc}
          </p>
        </div>
      </div>
    </div>
);
