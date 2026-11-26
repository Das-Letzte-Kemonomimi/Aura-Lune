import React from 'react';
import type { Translations } from '../../../i18n';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from '../../../components/ui/icons';
import { SpectrumVisualizer } from '../../../components/player/SpectrumVisualizer';
import { VuMeterWidget } from '../../../components/player/VuMeterWidget';
import { WaveformCanvas } from '../../../components/player/WaveformCanvas';
import { formatTime } from '../../../utils/timeFormat';
import type { BigScreenViewProps } from '../BigScreenView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';
import { cssVars } from '../../../utils/cssVars';

export type BigScreenControlsProps = Pick<BigScreenViewProps, 'volume' | 'isPlaying' | 'durationMs' | 'currentLang' | 'onSeek' | 'onSeekPreview' | 'onSeekCommit' | 'tempoRatio' | 'onPrev' | 'onPlayPause' | 'onNext' | 'onVolumeChange' | 'onToggleVolumeUnit' | 'volumeUnit'> & {
  showHud: boolean;
  setBottomVisualMode: Dispatch<SetStateAction<"spectrum" | "vumeter">>;
  bottomVisualMode: "spectrum" | "vumeter";
  spectrum: number[];
  waveformPeaks: number[];
  progress: number;
  positionMs: number;
  t: Translations;
};

export const BigScreenControls: React.FC<BigScreenControlsProps> = ({
  bottomVisualMode,
  currentLang,
  durationMs,
  isPlaying,
  onNext,
  onPlayPause,
  onPrev,
  onSeek,
  onSeekCommit,
  onSeekPreview,
  onToggleVolumeUnit,
  onVolumeChange,
  positionMs,
  progress,
  setBottomVisualMode,
  showHud,
  spectrum,
  t,
  tempoRatio,
  volume,
  volumeUnit,
  waveformPeaks,
}) => (
    <div
      className={cn(
        'flex flex-col gap-3 transition-opacity duration-300',
        showHud ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {/* Neon spectrum visualizer or analog VU meter */}
      <div className="relative w-full">
        <div className="absolute -top-7 right-0 z-10 flex gap-1.5">
          <button
            onClick={() => setBottomVisualMode('spectrum')}
            className={cn(
              'rounded-md border border-line px-2 py-0.5 text-xxs font-bold',
              bottomVisualMode === 'spectrum' ? 'bg-accent-pink text-fg' : 'bg-black/50 text-fg-muted',
            )}
          >
            Spectrum
          </button>
          <button
            onClick={() => setBottomVisualMode('vumeter')}
            className={cn(
              'rounded-md border border-line px-2 py-0.5 text-xxs font-bold',
              bottomVisualMode === 'vumeter' ? 'bg-accent-pink text-fg' : 'bg-black/50 text-fg-muted',
            )}
          >
            VU-Meter
          </button>
        </div>

        {bottomVisualMode === 'vumeter' ? (
          <VuMeterWidget
            spectrum={spectrum}
            volume={volume}
            isPlaying={isPlaying}
            className="h-22.5 px-3 py-1.5"
          />
        ) : (
          <div className="h-18 w-full">
            <SpectrumVisualizer
              spectrum={spectrum}
              isPlaying={isPlaying}
              className="h-18"
            />
          </div>
        )}
      </div>

      {/* Seeker with the waveform and the DSP indicator */}
      <div className="flex flex-col gap-1.5">
        {/* Waveform bars */}
        <WaveformCanvas
          peaks={waveformPeaks}
          progress={progress}
          durationMs={durationMs || 0}
          positionMs={positionMs || 0}
          isPlaying={isPlaying}
          height={64}
          currentLang={currentLang}
          onSeek={(pct) => {
            if (durationMs && durationMs > 0) {
              onSeek(Math.floor(pct * durationMs));
            }
          }}
          onSeekPreview={(pct) => {
            if (durationMs && durationMs > 0) {
              onSeekPreview?.(Math.floor(pct * durationMs));
            }
          }}
          onSeekCommit={(pct) => {
            if (durationMs && durationMs > 0) {
              if (onSeekCommit) {
                onSeekCommit(Math.floor(pct * durationMs));
              } else {
                onSeek(Math.floor(pct * durationMs));
              }
            }
          }}
          title={t.waveform.hint}
        />

        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-ui font-bold text-fg">
              {formatTime(positionMs)}
            </span>
            {(tempoRatio !== 1.0) && (
              <span
                className="rounded-sm border border-accent-purple/50 bg-accent-purple/30 px-1.5 py-px text-xxs font-bold text-accent-purple"
                title={`${t.dsp.tempo}: ${tempoRatio.toFixed(2)}x`}
              >
                DSP {tempoRatio.toFixed(2)}x
              </span>
            )}
          </div>
          <div
            onClick={(e) => {
              if (!durationMs || durationMs <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(Math.floor(pct * durationMs));
            }}
            className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-sm bg-white/10"
          >
            <div
              className="h-full rounded-sm bg-linear-to-r from-accent-cyan to-accent-pink shadow-halo shadow-accent-cyan"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-ui text-fg-muted">
            {durationMs ? formatTime(durationMs) : '--:--'}
          </span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-center gap-5">
        <button
          onClick={onPrev}
          title={t.player.previous}
          className="flex h-11.5 w-11.5 items-center justify-center rounded-full border-0 bg-white/8 text-fg"
        >
          <SkipBack size={22} />
        </button>

        <button
          onClick={onPlayPause}
          title={isPlaying ? t.player.pause : t.player.play}
          className="flex h-16 w-16 items-center justify-center rounded-full border-0 bg-accent-gradient text-on-accent shadow-halo-xl shadow-accent-pink/55"
        >
          {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
        </button>

        <button
          onClick={onNext}
          title={t.player.next}
          className="flex h-11.5 w-11.5 items-center justify-center rounded-full border-0 bg-white/8 text-fg"
        >
          <SkipForward size={22} />
        </button>

        <div className="absolute right-12 flex items-center gap-2">
          <button
            onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
            title={volume === 0 ? t.player.unmute : t.player.mute}
            className="flex border-0 bg-transparent text-fg-muted"
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            onPointerUp={(e) => e.currentTarget.blur()}
            onMouseUp={(e) => e.currentTarget.blur()}
            onKeyDown={(e) => {
              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.currentTarget.blur();
              }
            }}
            className="w-20 range-fill"
            style={cssVars({ '--fill': `${Math.min(100, Math.max(0, volume * 100))}%` })}
          />
          <button
            type="button"
            onClick={onToggleVolumeUnit}
            title={volumeUnit === 'db' ? 'Volume in dB (Click to toggle %)' : 'Volume in % (Click to toggle dB)'}
            className={cn(
              'min-w-11.5 rounded-md border border-line bg-white/8 px-1.5 py-0.5 text-center font-mono text-xs font-bold',
              volumeUnit === 'db' ? 'text-accent-cyan' : 'text-accent-pink',
              onToggleVolumeUnit ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            {volumeUnit === 'db'
              ? (volume <= 0.0001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`)
              : `${Math.round(volume * 100)}%`}
          </button>
        </div>
      </div>
    </div>
);
