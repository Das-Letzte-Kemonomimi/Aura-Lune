import React from 'react';
import { Activity, Check, ChevronDown, Headphones, Sliders, Point, PointFilled } from '../../../components/ui/icons';
import { EQUALIZER_BANDS } from '../../../types/equalizer';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

export type DspGraphicEqRackProps = Pick<DspStudioViewProps, 'loc' | 'getEqPresetDisplayName' | 'selectedEqPreset' | 'eqPresets' | 'handleApplyEqPreset' | 'handleResetEq' | 'setIsAutoEqOpen' | 'setIsParametricEqOpen' | 'setIsDynamicsStudioOpen' | 'handleEqToggle' | 'handleToggleEqAutoStartup' | 'eqAutoStartup' | 'handleEqBandChange'> & {
  setIsEqPresetMenuOpen: Dispatch<SetStateAction<boolean>>;
  isEqPresetMenuOpen: boolean;
  status: PlaybackStatus;
};

export const DspGraphicEqRack: React.FC<DspGraphicEqRackProps> = ({
  eqAutoStartup,
  eqPresets,
  getEqPresetDisplayName,
  handleApplyEqPreset,
  handleEqBandChange,
  handleEqToggle,
  handleResetEq,
  handleToggleEqAutoStartup,
  isEqPresetMenuOpen,
  loc,
  selectedEqPreset,
  setIsAutoEqOpen,
  setIsDynamicsStudioOpen,
  setIsEqPresetMenuOpen,
  setIsParametricEqOpen,
  status,
}) => (
    <div className="mt-7 border-t border-line pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg">
            <Sliders size={18} className="text-accent-pink" /> {loc.dsp.equalizer}
          </h3>
          <p className="mt-0.5 text-xs text-fg-secondary">
            {loc.dsp.eqDesc}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* EQ preset dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEqPresetMenuOpen((prev) => !prev);
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg border bg-field/95 px-3.5 py-1.5 text-ui font-semibold text-fg shadow-md shadow-black/30 transition-all duration-200',
                isEqPresetMenuOpen ? 'border-accent-pink' : 'border-line',
              )}
              title={loc.dsp.eqPresets}
            >
              <Sliders size={13} className="text-accent-pink" />
              <span>{getEqPresetDisplayName(selectedEqPreset, loc)}</span>
              <ChevronDown
                size={12}
                className={cn(
                  'text-fg-muted transition-transform duration-200',
                  isEqPresetMenuOpen && 'rotate-180',
                )}
              />
            </button>

            {isEqPresetMenuOpen && (
              <div
                className="absolute top-full left-0 z-20 mt-1.5 flex min-w-55 flex-col gap-0.5 rounded-xl border border-line-accent bg-ink/95 p-1.5 shadow-2xl shadow-black/70 backdrop-blur-lg motion-safe:animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-xxs font-semibold text-fg-muted">
                  {loc.dsp.eqPresets}
                </div>

                {/* The Custom option, when the sliders were changed by hand */}
                {selectedEqPreset &&
                  !eqPresets.some(
                    (p) =>
                      p.name === selectedEqPreset ||
                      getEqPresetDisplayName(p.name, true) === getEqPresetDisplayName(selectedEqPreset, true)
                  ) && (
                    <div
                      className="mb-1 flex items-center justify-between rounded-lg bg-accent-pink/10 px-2.5 py-2 text-ui font-bold text-accent-pink"
                    >
                      <span>{getEqPresetDisplayName(selectedEqPreset, loc)}</span>
                      <Check size={13} className="text-accent-pink" />
                    </div>
                  )}

                {eqPresets.map((preset) => {
                  const isSelected =
                    selectedEqPreset === preset.name ||
                    getEqPresetDisplayName(selectedEqPreset, true) === getEqPresetDisplayName(preset.name, true);
                  const displayName = getEqPresetDisplayName(preset.name, loc);
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyEqPreset(preset.name)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border-0 px-2.5 py-2 text-left text-ui transition-colors duration-100',
                        isSelected ? 'bg-accent-pink/15' : 'bg-transparent hover:bg-white/6',
                        isSelected ? 'text-accent-pink' : 'text-fg',
                        isSelected ? 'font-bold' : 'font-medium',
                      )}
                    >
                      <span>{displayName}</span>
                      {isSelected && <Check size={13} className="text-accent-pink" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* EQ reset button */}
          <button
            onClick={handleResetEq}
            className="rounded-lg border border-line bg-white/6 px-3 py-1.5 text-xs font-semibold text-fg-secondary"
          >
            {loc.dsp.reset} (0 dB)
          </button>

          {/* AutoEQ headphone profile database button */}
          <button
            onClick={() => setIsAutoEqOpen(true)}
            title={loc.dsp.autoEqHarmanTooltip}
            className="flex items-center gap-1.5 rounded-lg border border-blue-500/45 bg-blue-500/20 px-3 py-1.5 text-xs font-bold text-blue-400"
          >
            <Headphones size={13} /> AutoEQ
          </button>

          {/* Multi-band parametric equalizer (PEQ) button */}
          <button
            onClick={() => setIsParametricEqOpen(true)}
            title={loc.parametricEq.subtitle}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold',
              status.parametric_eq_enabled ? 'bg-accent-purple/30' : 'bg-accent-purple/15',
              status.parametric_eq_enabled ? 'border-accent-purple/70' : 'border-accent-purple/35',
              status.parametric_eq_enabled ? 'shadow-halo-sm shadow-accent-purple/30' : 'shadow-none',
              status.parametric_eq_enabled ? 'text-purple-100' : 'text-purple-400',
            )}
          >
            <Sliders size={13} /> PEQ Studio
            {status.parametric_eq_enabled && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400 shadow-halo-sm shadow-fuchsia-400" />
            )}
          </button>

          {/* Dynamics & tube studio button (compressor / saturator / limiter) */}
          <button
            onClick={() => setIsDynamicsStudioOpen(true)}
            title={loc.dsp.dynamicsStudioTooltip}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold',
              status.compressor_enabled || status.saturator_enabled ? 'bg-pink-500/30' : 'bg-pink-500/15',
              status.compressor_enabled || status.saturator_enabled ? 'border-pink-500/70' : 'border-pink-500/35',
              status.compressor_enabled || status.saturator_enabled ? 'shadow-halo-sm shadow-pink-500/30' : 'shadow-none',
              status.compressor_enabled || status.saturator_enabled ? 'text-fuchsia-50' : 'text-pink-400',
            )}
          >
            <Activity size={13} /> Dynamics Studio
            {(status.compressor_enabled || status.saturator_enabled) && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-pink-500 shadow-halo-sm shadow-pink-400" />
            )}
          </button>

          {/* EQ on / off toggle (Bypass) */}
          <button
            onClick={handleEqToggle}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-3.5 py-1.5 text-xs font-bold',
              status.equalizer_enabled ? 'bg-accent-pink/25' : 'bg-white/6',
              status.equalizer_enabled ? 'border-accent-pink' : 'border-line',
              status.equalizer_enabled ? 'text-accent-pink' : 'text-fg-muted',
            )}
          >
            {status.equalizer_enabled ? <PointFilled size={12} /> : <Point size={12} />}
            {status.equalizer_enabled ? loc.dsp.eqEnabled : loc.dsp.eqBypass}
          </button>

          {/* EQ autostart toggle */}
          <button
            onClick={handleToggleEqAutoStartup}
            title={loc.dsp.eqAutostart}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold',
              eqAutoStartup ? 'bg-accent-green/20' : 'bg-white/5',
              eqAutoStartup ? 'border-accent-green' : 'border-line',
              eqAutoStartup ? 'text-accent-green' : 'text-fg-muted',
            )}
          >
            {eqAutoStartup ? <Check size={12} /> : <Point size={12} />}
            {eqAutoStartup ? loc.dsp.eqAutostartOn : loc.dsp.eqAutostartOff}
          </button>
        </div>
      </div>

      {/* 10 bands in a 2-column layout */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-black/25 p-4">
        {EQUALIZER_BANDS.map((band, idx) => {
          const gain = (status.equalizer_bands && status.equalizer_bands[idx]) ?? 0;
          return (
            <div
              key={band.freq}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-card/60 px-3.5 py-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="mr-1.5 text-sm font-bold text-fg">
                    {band.freq}
                  </span>
                  <span className="text-xxs text-fg-muted">
                    ({band.label})
                  </span>
                </div>
                <span
                  className={cn(
                    'rounded-sm px-1.5 py-px font-mono text-xs font-bold',
                    gain > 0 ? 'bg-accent-pink/20' : gain < 0 ? 'bg-sky-400/20' : 'bg-white/6',
                    gain > 0 ? 'text-accent-pink' : gain < 0 ? 'text-accent-cyan' : 'text-fg-muted',
                  )}
                >
                  {gain > 0 ? `+${gain.toFixed(1)} dB` : `${gain.toFixed(1)} dB`}
                </span>
              </div>

              <input
                type="range"
                min={-24}
                max={12}
                step={0.5}
                value={gain}
                onChange={(e) => handleEqBandChange(idx, Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          );
        })}
      </div>
    </div>
);
