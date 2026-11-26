import React from 'react';
import { Sparkles, Point, PointFilled } from '../../../components/ui/icons';
import type { DspStudioViewProps } from '../DspStudioView';
import { cn } from '../../../utils/cn';

export type DspReverbPanelProps = Pick<DspStudioViewProps, 'reverbEnabled' | 'loc' | 'handleUpdateReverb' | 'reverbRoomSize' | 'reverbDamping' | 'reverbWidth' | 'reverbLevel' | 'handleTempoChange' | 'handlePitchChange' | 'showMessage'>;

export const DspReverbPanel: React.FC<DspReverbPanelProps> = ({
  handlePitchChange,
  handleTempoChange,
  handleUpdateReverb,
  loc,
  reverbDamping,
  reverbEnabled,
  reverbLevel,
  reverbRoomSize,
  reverbWidth,
  showMessage,
}) => (
    <div
      className={cn(
        'mb-7 rounded-2xl border bg-black/30 p-5 transition-all duration-200',
        reverbEnabled ? 'border-accent-purple/40' : 'border-line',
        reverbEnabled ? 'shadow-xl shadow-accent-purple/15' : 'shadow-none',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles className={cn(reverbEnabled ? 'text-accent-purple' : 'text-fg-muted')} size={20} />
          <div>
            <h4 className="m-0 text-md font-bold">
              {loc.dsp.spatialReverbTitle}
            </h4>
            <span className="text-xs text-fg-muted">
              {loc.dsp.spatialReverbDesc}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleUpdateReverb(!reverbEnabled)}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border px-3.5 py-1.5 text-xs font-bold',
            reverbEnabled ? 'bg-accent-purple/30' : 'bg-white/6',
            reverbEnabled ? 'border-accent-purple' : 'border-line',
            reverbEnabled ? 'text-accent-purple' : 'text-fg-muted',
          )}
        >
          {reverbEnabled ? <PointFilled size={12} /> : <Point size={12} />}
          {reverbEnabled ? 'REVERB ON' : 'REVERB BYPASS'}
        </button>
      </div>

      {/* Reverb parameter sliders */}
      <div className={cn('grid grid-cols-2 gap-4', reverbEnabled ? 'opacity-100' : 'opacity-45')}>
        {/* Room size */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-secondary">Room Size:</span>
            <span className="font-mono font-bold">{Math.round(reverbRoomSize * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbRoomSize}
            onChange={(e) => handleUpdateReverb(true, Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Damping */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-secondary">{loc.dsp.dampingLabel}</span>
            <span className="font-mono font-bold">{Math.round(reverbDamping * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbDamping}
            onChange={(e) => handleUpdateReverb(true, undefined, Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Stereo width */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-secondary">{loc.dsp.stereoWidthLabel}</span>
            <span className="font-mono font-bold">{Math.round(reverbWidth * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbWidth}
            onChange={(e) => handleUpdateReverb(true, undefined, undefined, Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Reverb wet level */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-secondary">Wet Level:</span>
            <span className="font-mono font-bold">{Math.round(reverbLevel * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbLevel}
            onChange={(e) => handleUpdateReverb(true, undefined, undefined, undefined, Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Quick reverb presets */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="flex items-center text-xs text-fg-muted">
          Presets:
        </span>
        <button
          onClick={() => handleUpdateReverb(true, 0.40, 0.50, 0.70, 0.25)}
          className="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs text-fg"
        >
          Small Room
        </button>
        <button
          onClick={() => handleUpdateReverb(true, 0.70, 0.30, 0.90, 0.35)}
          className="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs text-fg"
        >
          Ambient Hall
        </button>
        <button
          onClick={() => handleUpdateReverb(true, 0.85, 0.15, 1.0, 0.45)}
          className="rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs text-fg"
        >
          Cathedral
        </button>
        {/* The user's favourite profile: Slowed + Reverb */}
        <button
          onClick={() => {
            handleTempoChange(0.82);
            handlePitchChange(-2.0);
            handleUpdateReverb(true, 0.75, 0.35, 1.0, 0.40);
            showMessage('Activated profile: Slowed + Reverb 🌌');
          }}
          className="rounded-lg border border-accent-pink bg-linear-135 from-accent-pink/30 to-accent-purple/30 px-3 py-1 text-xs font-bold text-fg"
        >
          🌌 Slowed + Reverb
        </button>
      </div>
    </div>
);
