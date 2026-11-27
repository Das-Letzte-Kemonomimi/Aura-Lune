import React from 'react';
import type { Translations } from '../../../i18n';
import { Play, Pause, SkipBack, SkipForward } from '../../../components/ui/icons';
import { SpectrumVisualizer } from '../../../components/player/SpectrumVisualizer';
import { VuMeterWidget } from '../../../components/player/VuMeterWidget';
import { WaveformCanvas } from '../../../components/player/WaveformCanvas';
import { VolumeIcon, VolumeSlider } from '../../../components/player/VolumeSlider';
import { useLiveVolume } from '../../../state/livePlayback';
import { formatTime } from '../../../utils/timeFormat';
import type { BigScreenViewProps } from '../BigScreenView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';
import { Badge, Button, IconButton, SegmentedControl } from '../../../components/ui';
import type { SpectralBandTriple } from '../../../types/analysis';

/** Round transport button (previous, next). */
const transportClass = 'size-11.5 rounded-full border-transparent bg-white/8 text-fg';

export type BigScreenControlsProps = Pick<BigScreenViewProps, 'volume' | 'isPlaying' | 'durationMs' | 'currentLang' | 'onSeek' | 'onSeekPreview' | 'onSeekCommit' | 'tempoRatio' | 'onPrev' | 'onPlayPause' | 'onNext' | 'onVolumeChange' | 'onToggleMute' | 'formatVolumeValue' | 'onToggleVolumeUnit' | 'volumeUnit'> & {
  showHud: boolean;
  setBottomVisualMode: Dispatch<SetStateAction<"spectrum" | "vumeter">>;
  bottomVisualMode: "spectrum" | "vumeter";
  spectrum: number[];
  waveformPeaks: number[];
  waveformBands?: SpectralBandTriple[];
  isWaveformLoading?: boolean;
  progress: number;
  positionMs: number;
  t: Translations;
};

export const BigScreenControls: React.FC<BigScreenControlsProps> = ({
  bottomVisualMode,
  currentLang,
  durationMs,
  formatVolumeValue,
  isPlaying,
  onNext,
  onPlayPause,
  onPrev,
  onSeek,
  onSeekCommit,
  onSeekPreview,
  onToggleMute,
  onToggleVolumeUnit,
  onVolumeChange,
  positionMs,
  progress,
  setBottomVisualMode,
  showHud,
  spectrum,
  t,
  tempoRatio,
  volume: volumeProp,
  volumeUnit,
  waveformBands,
  waveformPeaks,
  isWaveformLoading,
}) => {
  const volume = useLiveVolume(volumeProp);
  return (
    <div
      className={cn(
        'flex flex-col gap-3 transition-opacity duration-300',
        showHud ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {/* Neon spectrum visualizer or analog VU meter */}
      <div className="relative w-full">
        <SegmentedControl
          label={t.player.displayModeLabel}
          size="sm"
          value={bottomVisualMode}
          onChange={setBottomVisualMode}
          items={[
            { value: 'spectrum', label: 'Spectrum' },
            { value: 'vumeter', label: 'VU-Meter' },
          ]}
          className="absolute top-1.5 left-1.5 z-10"
        />

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
          spectralBands={waveformBands}
          isLoading={isWaveformLoading}
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
              <Badge tone="purple" size="xs" title={`${t.dsp.tempo}: ${tempoRatio.toFixed(2)}x`}>
                DSP {tempoRatio.toFixed(2)}x
              </Badge>
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
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div aria-hidden="true" className="hidden sm:block" />
        <div className="flex items-center justify-center gap-5">
          <IconButton label={t.player.previous} onClick={onPrev} className={transportClass}>
            <SkipBack size={22} />
          </IconButton>
          <Button
            variant="primary"
            onClick={onPlayPause}
            aria-label={isPlaying ? t.player.pause : t.player.play}
            title={isPlaying ? t.player.pause : t.player.play}
            className="size-16 rounded-full p-0 shadow-halo-xl shadow-accent-pink/55"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </Button>
          <IconButton label={t.player.next} onClick={onNext} className={transportClass}>
            <SkipForward size={22} />
          </IconButton>
        </div>

        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <IconButton size="sm" label={volume === 0 ? t.player.unmute : t.player.mute} onClick={onToggleMute}>
            <VolumeIcon gain={volume} size={18} />
          </IconButton>
          <VolumeSlider ariaLabel={t.player.volume} gain={volume} onGainChange={onVolumeChange} className="w-20" />
          <Button
            size="sm"
            onClick={onToggleVolumeUnit}
            disabled={!onToggleVolumeUnit}
            title={t.player.volumeToggleUnitTooltip}
            className={cn('min-w-11.5 rounded-md px-1.5 py-0.5 font-mono', volumeUnit === 'db' ? 'text-accent-cyan' : 'text-accent-pink')}
          >
            {formatVolumeValue(volume)}
          </Button>
        </div>
      </div>
    </div>
  );
};
