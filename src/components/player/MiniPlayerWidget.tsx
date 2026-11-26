import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Volume2,
  VolumeX,
  Disc,
  Zap,
} from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';
import { formatTime } from '../../utils/timeFormat';
import { useLivePositionMs } from '../../state/livePlayback';
import { cn } from '../../utils/cn';
import { cssVars } from '../../utils/cssVars';

interface MiniPlayerWidgetProps {
  title: string;
  artist: string;
  coverUrl?: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number | null;
  volume: number;
  pitchSemitones: number;
  tempoRatio: number;
  currentLang?: Language;
  volumeUnit?: 'percent' | 'db';
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleVolumeUnit?: () => void;
  onRestore: () => void;
}

export const MiniPlayerWidget: React.FC<MiniPlayerWidgetProps> = ({
  title,
  artist,
  coverUrl,
  isPlaying,
  positionMs: positionMsProp,
  durationMs,
  volume,
  pitchSemitones,
  tempoRatio,
  currentLang = 'en',
  volumeUnit = 'percent',
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleVolumeUnit,
  onRestore,
}) => {
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const positionMs = useLivePositionMs(positionMsProp);
  const t = getTranslations(currentLang);
  const progress = durationMs && durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const isDspActive = Math.abs(pitchSemitones) > 0.05 || Math.abs(tempoRatio - 1.0) > 0.02;

  return (
    <div
      className="flex h-screen w-screen select-none flex-col justify-between overflow-hidden rounded-xl border border-line-accent bg-deep px-3.5 py-3 text-fg"
    >
      {/* Top bar: cover, title, DSP and the restore button */}
      <div className="flex items-center gap-2.5">
        {/* Cover */}
        <div
          className={cn(
            'flex size-10.5 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-card transition-shadow duration-300',
            isPlaying && 'shadow-accent-glow',
          )}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <Disc
              size={22}
              className={cn('text-accent-purple', isPlaying && 'animate-spin')}
            />
          )}
        </div>

        {/* Title and artist */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-fg">
            {title || 'Auralune'}
          </div>
          <div className="truncate text-xs text-fg-secondary">
            {artist || t.player.noTrack}
          </div>
        </div>

        {/* Optional active DSP badge */}
        {isDspActive && (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-sm border border-accent-pink/40 bg-accent-pink/20 px-1.5 py-0.5 text-xxs font-bold text-accent-pink"
          >
            <Zap size={10} />
            {tempoRatio.toFixed(2)}x
          </span>
        )}

        {/* Back to the full window */}
        <button
          onClick={onRestore}
          title={`${t.nav.miniPlayer} (${t.common.close})`}
          className="flex shrink-0 items-center justify-center rounded-md border border-line bg-white/8 p-1.5 text-fg-secondary"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-0 my-1">
        <div
          onClick={(e) => {
            if (!durationMs || durationMs <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            onSeek(Math.floor(pct * durationMs));
          }}
          className="relative h-1 cursor-pointer overflow-hidden rounded-xs bg-white/10"
        >
          <div
            className="h-full rounded-xs bg-linear-to-r from-accent-purple to-accent-pink shadow-halo-sm shadow-accent-pink"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xxs text-fg-muted">
          <span>{formatTime(positionMs)}</span>
          <span>{durationMs ? formatTime(durationMs) : '--:--'}</span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
            title={volume === 0 ? t.player.unmute : t.player.mute}
            className="flex border-0 bg-transparent p-1 text-fg-muted"
          >
            {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
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
            className="h-1 w-12.5 range-fill"
            style={cssVars({ '--fill': `${Math.min(100, Math.max(0, volume * 100))}%` })}
          />
          <button
            type="button"
            onClick={onToggleVolumeUnit}
            title={volumeUnit === 'db' ? 'dB (Toggle %)' : '% (Toggle dB)'}
            className={cn(
              'border-0 bg-transparent px-0.5 py-0 font-mono text-xxs font-bold',
              volumeUnit === 'db' ? 'text-accent-cyan' : 'text-accent-pink',
              onToggleVolumeUnit ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            {volumeUnit === 'db'
              ? (volume <= 0.0001 ? '-∞' : `${(20 * Math.log10(volume)).toFixed(0)}dB`)
              : `${Math.round(volume * 100)}%`}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            title={t.player.previous}
            className="flex border-0 bg-transparent p-1 text-fg-secondary"
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={onPlayPause}
            title={isPlaying ? t.player.pause : t.player.play}
            className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-linear-135 from-accent-purple to-accent-pink text-on-accent shadow-halo-sm shadow-accent-purple/40"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-px" />}
          </button>

          <button
            onClick={onNext}
            title={t.player.next}
            className="flex border-0 bg-transparent p-1 text-fg-secondary"
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
