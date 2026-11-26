import React from 'react';
import { CheckCircle, Flame, Headphones, ShieldCheck, SlidersHorizontal, Point, PointFilled } from '../../../components/ui/icons';
import type { DspStudioViewProps } from '../DspStudioView';
import { cn } from '../../../utils/cn';

export type DspMasteringRackProps = Pick<DspStudioViewProps, 'loc' | 'handleBassBoostChange' | 'bassBoost' | 'lastBassBoostRef' | 'handleToggleStereoWidener' | 'stereoWidenerActive' | 'stereoWidenerAmount' | 'handleStereoWidenerAmountChange' | 'handleToggleLimiter' | 'limiterEnabled' | 'handleSetCrossfeed' | 'crossfeedEnabled' | 'crossfeedPreset' | 'crossfeedFcut' | 'crossfeedFeed'>;

export const DspMasteringRack: React.FC<DspMasteringRackProps> = ({
  bassBoost,
  crossfeedEnabled,
  crossfeedFcut,
  crossfeedFeed,
  crossfeedPreset,
  handleBassBoostChange,
  handleSetCrossfeed,
  handleStereoWidenerAmountChange,
  handleToggleLimiter,
  handleToggleStereoWidener,
  lastBassBoostRef,
  limiterEnabled,
  loc,
  stereoWidenerActive,
  stereoWidenerAmount,
}) => (
    <div
      className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-5 rounded-2xl border border-line bg-black/30 p-5"
    >
      {/* CARD 1: BASS BOOST (SUB-BASS EXCITER) */}
      <div className="flex flex-col gap-3 rounded-xl border border-accent-pink/20 bg-accent-pink/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-accent-pink" />
            <div>
              <h4 className="m-0 text-md font-bold">
                {loc.dsp.bassBoostTitle}
              </h4>
              <span className="text-xs text-fg-muted">
                {loc.dsp.bassBoostDesc}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleBassBoostChange(bassBoost > 0 ? 0 : (lastBassBoostRef?.current || 6))}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold',
              bassBoost > 0 ? 'bg-accent-pink/25' : 'bg-white/6',
              bassBoost > 0 ? 'border-accent-pink' : 'border-line',
              bassBoost > 0 ? 'text-accent-pink' : 'text-fg-muted',
            )}
          >
            {bassBoost > 0 ? <PointFilled size={12} /> : <Point size={12} />}
            {bassBoost > 0 ? `BASS +${bassBoost.toFixed(1)} dB` : 'BYPASS'}
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={12}
          step={0.5}
          value={bassBoost}
          onChange={(e) => handleBassBoostChange(Number(e.target.value))}
          className="w-full cursor-pointer"
        />

        <div className="flex flex-wrap gap-1.5">
          {[0, 3, 6, 9, 12].map((db) => (
            <button
              key={db}
              onClick={() => handleBassBoostChange(db)}
              className={cn(
                'rounded-md border px-2 py-1 text-xxs font-semibold',
                bassBoost === db ? 'bg-accent-pink/30' : 'bg-white/5',
                bassBoost === db ? 'border-accent-pink' : 'border-line',
                bassBoost === db ? 'text-accent-pink' : 'text-fg-muted',
              )}
            >
              {db === 0 ? '0 dB (Off)' : `+${db} dB`}
            </button>
          ))}
        </div>
      </div>

      {/* CARD 2: STEREO WIDENER (STEREO BASE) */}
      <div className="flex flex-col gap-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-accent-cyan" />
            <div>
              <h4 className="m-0 text-md font-bold">
                {loc.dsp.stereoWidenerTitle}
              </h4>
              <span className="text-xs text-fg-muted">
                {loc.dsp.stereoWidenerDesc}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleToggleStereoWidener(!stereoWidenerActive)}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold',
              stereoWidenerActive ? 'bg-sky-400/25' : 'bg-white/6',
              stereoWidenerActive ? 'border-accent-cyan' : 'border-line',
              stereoWidenerActive ? 'text-accent-cyan' : 'text-fg-muted',
            )}
          >
            {stereoWidenerActive ? <PointFilled size={12} /> : <Point size={12} />}
            {stereoWidenerActive ? 'WIDENER ON' : 'BYPASS'}
          </button>
        </div>

        <div className={cn(stereoWidenerActive ? 'opacity-100' : 'opacity-45')}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-secondary">{loc.dsp.stereoStageWidth}</span>
            <span className="font-mono font-bold">
              {Math.round(stereoWidenerAmount * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={stereoWidenerAmount}
            onChange={(e) => handleStereoWidenerAmountChange(Number(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>
      </div>

      {/* CARD 3: TRUE-PEAK LIMITER */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-accent-green" />
              <div>
                <h4 className="m-0 text-md font-bold">
                  {loc.dsp.limiterTitle}
                </h4>
                <span className="text-xs text-fg-muted">
                  {loc.dsp.limiterDesc}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleToggleLimiter(!limiterEnabled)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold',
                limiterEnabled ? 'bg-green-500/25' : 'bg-white/6',
                limiterEnabled ? 'border-accent-green' : 'border-line',
                limiterEnabled ? 'text-accent-green' : 'text-fg-muted',
              )}
            >
              {limiterEnabled ? <PointFilled size={12} /> : <Point size={12} />}
              {limiterEnabled ? 'LIMITER ON' : 'BYPASS'}
            </button>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-2 text-xs',
            limiterEnabled ? 'text-green-300' : 'text-fg-muted',
          )}
        >
          <CheckCircle size={14} />
          <span>
            {limiterEnabled
              ? loc.dsp.limiterDesc
              : loc.dsp.limiterOffWarning}
          </span>
        </div>
      </div>

      {/* CARD 4: BAUER HEADPHONE CROSSFEED (BS2B) */}
      <div className="flex flex-col gap-3 rounded-xl border border-accent-purple/20 bg-accent-purple/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones size={18} className="text-accent-purple" />
            <div>
              <h4 className="m-0 text-md font-bold">
                {loc.settings.crossfeedTitle}
              </h4>
              <span className="text-xs text-fg-muted">
                {loc.settings.crossfeedDesc}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleSetCrossfeed(!crossfeedEnabled, crossfeedPreset)}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold',
              crossfeedEnabled ? 'bg-accent-purple/25' : 'bg-white/6',
              crossfeedEnabled ? 'border-accent-purple' : 'border-line',
              crossfeedEnabled ? 'text-accent-purple' : 'text-fg-muted',
            )}
          >
            {crossfeedEnabled ? <PointFilled size={12} /> : <Point size={12} />}
            {crossfeedEnabled ? 'CROSSFEED ON' : 'BYPASS'}
          </button>
        </div>

        <div className={cn('flex flex-col gap-2.5', crossfeedEnabled ? 'opacity-100' : 'opacity-65')}>
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'Default', label: 'Default (700Hz/4.5dB)' },
              { id: 'ChuMoy', label: 'Chu Moy (700Hz/6dB)' },
              { id: 'JanMeier', label: 'Jan Meier (650Hz/9dB)' },
              { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
            ] as const).map((p) => {
              const isActive = crossfeedPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSetCrossfeed(true, p.id)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-semibold',
                    isActive && crossfeedEnabled ? 'bg-accent-purple/30' : 'bg-white/5',
                    isActive && crossfeedEnabled ? 'border-accent-purple' : 'border-line',
                    isActive && crossfeedEnabled ? 'text-accent-purple' : 'text-fg-muted',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {crossfeedPreset === 'Custom' && (
            <div className="mt-1 flex flex-col gap-2">
              <div>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-fg-secondary">{loc.settings.crossfeedFcut}:</span>
                  <span className="font-mono font-bold">{crossfeedFcut} Hz</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="2000"
                  step="25"
                  value={crossfeedFcut}
                  onChange={(e) => handleSetCrossfeed(true, 'Custom', parseInt(e.target.value, 10), crossfeedFeed)}
                  className="w-full cursor-pointer"
                />
              </div>
              <div>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-fg-secondary">{loc.settings.crossfeedFeed}:</span>
                  <span className="font-mono font-bold">{(crossfeedFeed / 10).toFixed(1)} dB</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={crossfeedFeed}
                  onChange={(e) => handleSetCrossfeed(true, 'Custom', crossfeedFcut, parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
);
