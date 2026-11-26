import React from 'react';
import { Activity, Sliders, Zap, ShieldCheck, Loader2 } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cn } from '../../../utils/cn';

export type ReplayGainOptionProps = Pick<AudioDevicesSettingsViewProps, 'replaygainMode' | 'loc' | 'onSetReplayGain' | 'replaygainPreAmp' | 'replaygainFallbackGain' | 'replaygainPreventClipping' | 'replaygainStatus' | 'replaygainScanWriteTags' | 'onToggleReplaygainScanWriteTags' | 'onScanLibraryReplayGain' | 'isReplaygainScanning'>;

export const ReplayGainOption: React.FC<ReplayGainOptionProps> = ({
  isReplaygainScanning,
  loc,
  onScanLibraryReplayGain,
  onSetReplayGain,
  onToggleReplaygainScanWriteTags,
  replaygainFallbackGain,
  replaygainMode,
  replaygainPreAmp,
  replaygainPreventClipping,
  replaygainScanWriteTags,
  replaygainStatus,
}) => (
    <div
      className={cn(
        'glass-card mb-3.5 rounded-xl border px-5 py-4.5 transition-all duration-200',
        replaygainMode !== 'Off' ? 'border-accent-purple/45' : 'border-line',
        replaygainMode !== 'Off' ? 'bg-accent-purple/5' : 'bg-white/3',
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-accent-purple" />
          <span className="text-md font-bold text-fg">
            {loc.settings.replaygainTitle}
          </span>
        </div>
        {replaygainMode !== 'Off' && (
          <span
            className="flex items-center gap-1 rounded-md bg-accent-purple/25 px-2 py-1 text-xs font-bold text-accent-purple"
          >
            <Zap size={11} /> {
              replaygainMode === 'Auto'
                ? loc.settings.replaygainModeAuto
                : (replaygainMode === 'Track'
                  ? loc.settings.replaygainModeTrack
                  : loc.settings.replaygainModeAlbum)
            }
          </span>
        )}
      </div>

      <div className="mb-3.5 text-ui text-fg-secondary">
        {loc.settings.replaygainDesc}
      </div>

      {/* Tryby normalizacji: Off / Track / Album / Auto */}
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
        {(['Off', 'Track', 'Album', 'Auto'] as const).map((m) => {
          const isActive = replaygainMode === m;
          const label =
            m === 'Off'
              ? loc.settings.replaygainModeOff
              : m === 'Track'
                ? loc.settings.replaygainModeTrack
                : m === 'Album'
                  ? loc.settings.replaygainModeAlbum
                  : loc.settings.replaygainModeAuto;
          return (
            <button
              key={m}
              onClick={() => onSetReplayGain(m, replaygainPreAmp, replaygainFallbackGain, replaygainPreventClipping)}
              className={cn(
                'rounded-lg border px-3 py-2 text-ui font-bold transition-all duration-150',
                isActive ? 'bg-accent-purple/25' : 'bg-white/6',
                isActive ? 'border-accent-purple' : 'border-line',
                isActive ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Suwaki i opcje ReplayGain */}
      <div className={cn(
        'flex flex-col gap-3 transition-opacity duration-200',
        replaygainMode === 'Off' ? 'opacity-45' : 'opacity-100',
        replaygainMode === 'Off' ? 'pointer-events-none' : 'pointer-events-auto',
      )}>
        {/* Suwak Przedwzmacniacza (Pre-Amp Gain) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-ui text-fg-secondary">
              {loc.settings.replaygainPreAmp}
            </span>
            <span className="font-mono text-ui font-bold text-fg">
              {replaygainPreAmp >= 0 ? `+${replaygainPreAmp.toFixed(1)}` : replaygainPreAmp.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="-6"
            max="6"
            step="0.5"
            value={replaygainPreAmp}
            onChange={(e) => onSetReplayGain(replaygainMode, parseFloat(e.target.value), replaygainFallbackGain, replaygainPreventClipping)}
            className="w-full accent-accent-purple"
          />
        </div>

        {/* Suwak Fallback Gain */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-ui text-fg-secondary">
              {loc.settings.replaygainFallbackGain}
            </span>
            <span className="font-mono text-ui font-bold text-fg">
              {replaygainFallbackGain >= 0 ? `+${replaygainFallbackGain.toFixed(1)}` : replaygainFallbackGain.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="-12"
            max="0"
            step="1"
            value={replaygainFallbackGain}
            onChange={(e) => onSetReplayGain(replaygainMode, replaygainPreAmp, parseFloat(e.target.value), replaygainPreventClipping)}
            className="w-full accent-accent-purple"
          />
        </div>

        {/* Przełącznik True-Peak Limiter */}
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-ui text-fg-secondary">
            <ShieldCheck size={14} className="text-accent-green" /> {loc.settings.replaygainPreventClipping}
          </span>
          <input
            type="checkbox"
            checked={replaygainPreventClipping}
            onChange={(e) => onSetReplayGain(replaygainMode, replaygainPreAmp, replaygainFallbackGain, e.target.checked)}
            className="h-4.5 w-4.5 cursor-pointer accent-accent-purple"
          />
        </div>
      </div>

      {/* Status w czasie rzeczywistym i wskaźnik Peak Limiter */}
      {replaygainMode !== 'Off' && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span>{loc.settings.replaygainTargetAdjustment}:</span>
            <strong className="font-mono text-fg">
              {replaygainStatus[0] >= 0 ? `+${replaygainStatus[0].toFixed(1)}` : replaygainStatus[0].toFixed(1)} dB
            </strong>
          </div>
          <div className="flex items-center gap-1 font-semibold text-accent-green">
            <ShieldCheck size={13} /> {loc.settings.replaygainLimiterActive}
          </div>
        </div>
      )}

      {/* Sekcja kalkulatora / skanera głośności EBU R128 */}
      <div className="mt-4 border-t border-line pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-ui text-fg-secondary">
            <input
              type="checkbox"
              checked={replaygainScanWriteTags}
              onChange={(e) => onToggleReplaygainScanWriteTags(e.target.checked)}
              className="accent-accent-purple"
            />
            <span>{loc.settings.scanReplayGainWriteTags}</span>
          </label>

          <button
            onClick={onScanLibraryReplayGain}
            disabled={isReplaygainScanning}
            className={cn(
              'glass-card flex items-center gap-2 rounded-lg border border-accent-purple bg-accent-purple/25 px-4 py-2 text-ui font-bold text-fg transition-all duration-150',
              isReplaygainScanning ? 'cursor-not-allowed' : 'cursor-pointer',
              isReplaygainScanning ? 'opacity-60' : 'opacity-100',
            )}
          >
            {isReplaygainScanning ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
            {isReplaygainScanning ? loc.settings.scanReplayGainScanning : loc.settings.scanReplayGainLibrary}
          </button>
        </div>
      </div>
    </div>
);
