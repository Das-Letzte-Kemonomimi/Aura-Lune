import type { AppTab } from '../../types/navigation';
import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Square,
  Volume2,
  VolumeX,
  Disc,
  FolderOpen,
  Zap,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import { type PlaybackStatus, type TrackRecord, type DspEngineType } from '../../types/player';
import { type PlaybackQueue } from '../../types/queue';
import { useLiveStatus } from '../../state/livePlayback';
import { cn } from '../../utils/cn';
import { cssVars } from '../../utils/cssVars';

export interface BottomPlaybackDockProps {
  isVisible: boolean;
  activeTab: AppTab;
  language: Language;
  loc: Translations;
  status: PlaybackStatus;
  currentPlayingTrack: TrackRecord | null;
  effectiveDisplayTitle: string;
  effectiveDisplayArtist: string;
  currentCover: string | null;
  filePath: string;
  queue: PlaybackQueue;
  volumeProgressPercent: number;
  formatTime: (ms: number) => string;
  onScrollToTopOrSwitchTab: () => void;
  onOpenContainingFolder: (path: string, e: React.MouseEvent) => void;
  onToggleShuffle: () => void;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onCycleLoopMode: () => void;
  onToggleStopAfterCurrent: () => void;
  onSeek: (ms: number) => void;
  onSeekPreview?: (ms: number) => void;
  onSeekCommit?: (ms: number) => void;
  onCycleDspEngine: () => void;
  onSelectDspEngine: (engine: DspEngineType) => void;
  onToggleMute: () => void;
  onVolumeChange: (val: number) => void;
  onToggleMiniPlayer: () => void;
}

/** Round transport toggle; the pressed look comes from `aria-pressed`. */
const ROUND_TOGGLE =
  'flex items-center justify-center rounded-full border border-transparent bg-transparent p-1.5 text-fg-muted transition-all duration-200 hover:text-fg aria-pressed:shadow-halo-sm';

const PRESSED_TONES = {
  cyan: 'aria-pressed:border-accent-cyan aria-pressed:bg-accent-cyan/20 aria-pressed:text-accent-cyan aria-pressed:shadow-accent-cyan/40',
  pink: 'aria-pressed:border-accent-pink aria-pressed:bg-accent-pink/20 aria-pressed:text-accent-pink aria-pressed:shadow-accent-pink/40',
  yellow: 'aria-pressed:border-yellow-500 aria-pressed:bg-yellow-500/20 aria-pressed:text-yellow-500 aria-pressed:shadow-yellow-500/40',
} as const;

const TRANSPORT_BUTTON = 'flex items-center bg-transparent p-1 text-fg-secondary hover:text-fg';

const DOCK_GLASS_BUTTON = 'glass-card flex items-center gap-1 px-2 py-1.5 text-xs text-fg-secondary';

/** DSP engine pill: border, tint, text and glow per engine. */
const ENGINE_TONES: Record<DspEngineType, string> = {
  Bypass: 'border-accent-green/45 bg-accent-green/15 text-accent-green shadow-accent-green/20',
  RubberBand: 'border-accent-pink/45 bg-accent-pink/15 text-accent-pink shadow-accent-pink/30',
  SoundTouch: 'border-accent-cyan/45 bg-accent-cyan/15 text-accent-cyan shadow-accent-cyan/30',
};

const ENGINE_TEXT: Record<DspEngineType, string> = {
  Bypass: 'text-accent-green',
  RubberBand: 'text-accent-pink',
  SoundTouch: 'text-accent-cyan',
};

const ENGINE_MENU_PRESSED: Record<DspEngineType, string> = {
  Bypass: 'aria-pressed:border-accent-green aria-pressed:text-accent-green',
  RubberBand: 'aria-pressed:border-accent-pink aria-pressed:text-accent-pink',
  SoundTouch: 'aria-pressed:border-accent-cyan aria-pressed:text-accent-cyan',
};

export const BottomPlaybackDock: React.FC<BottomPlaybackDockProps> = React.memo(({
  isVisible,
  activeTab,
  language: _language,
  loc,
  status: statusProp,
  currentPlayingTrack,
  effectiveDisplayTitle,
  effectiveDisplayArtist,
  currentCover,
  filePath,
  queue,
  volumeProgressPercent,
  formatTime,
  onScrollToTopOrSwitchTab,
  onOpenContainingFolder,
  onToggleShuffle,
  onPrevious,
  onPlayPause,
  onNext,
  onCycleLoopMode,
  onToggleStopAfterCurrent,
  onSeek,
  onSeekPreview,
  onSeekCommit,
  onCycleDspEngine,
  onSelectDspEngine,
  onToggleMute,
  onVolumeChange,
  onToggleMiniPlayer,
}) => {
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const status = useLiveStatus(statusProp);
  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;
  const [isDspQuickMenuOpen, setIsDspQuickMenuOpen] = useState(false);

  if (!isVisible) return null;

  const t = loc;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-19 items-center justify-between gap-4 border-t border-line-accent bg-ink/95 px-6 shadow-dock motion-safe:animate-fade-in">
      {/* Lewa strona: Mini okładka, Tytuł, Wykonawca */}
      <div
        onClick={onScrollToTopOrSwitchTab}
        className="flex max-w-3/10 min-w-55 cursor-pointer items-center gap-3.5"
        title={activeTab === 'player' ? loc.bottomDock.scrollToTop : loc.bottomDock.openFullPlayer}
      >
        <div
          className={cn(
            'flex size-11.5 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-lift shadow-black/40',
            !currentCover && 'bg-accent-gradient',
          )}
          style={currentCover ? { background: `url("${currentCover}") center/cover no-repeat` } : undefined}
        >
          {!currentCover && (
            <Disc size={24} className={cn('text-on-accent', status.state === 'Playing' && 'motion-safe:animate-spin-slow')} />
          )}
        </div>
        <div className="min-w-0 overflow-hidden">
          <p className="truncate text-sm font-bold text-fg">{effectiveDisplayTitle}</p>
          <p className="mt-0.5 truncate text-xs text-fg-secondary">
            {effectiveDisplayArtist}
            {currentPlayingTrack?.format && (
              <span className="ml-1.5 rounded-sm bg-accent-cyan/15 px-1.5 py-px font-mono text-xxs text-accent-cyan">
                {currentPlayingTrack.format}
              </span>
            )}
            {(currentPlayingTrack?.path || filePath || status.current_track?.uri) && (
              <button
                onClick={(e) =>
                  onOpenContainingFolder(
                    currentPlayingTrack?.path || filePath || status.current_track?.uri || '',
                    e
                  )
                }
                title={loc.queue.openContainingFolder}
                className="ml-1.5 inline-flex items-center bg-transparent px-1 py-0.5 align-middle text-fg-muted hover:text-fg"
              >
                <FolderOpen size={13} />
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Środek: Sterowanie odtwarzaniem i pasek pozycji */}
      <div className="flex max-w-140 flex-1 flex-col items-center gap-1.5">
        <div className="flex items-center gap-3.5">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            aria-pressed={queue.shuffle}
            className={cn(ROUND_TOGGLE, PRESSED_TONES.cyan)}
            title={queue.shuffle ? loc.player.shuffleOn : loc.player.shuffleOff}
          >
            <Shuffle size={16} />
          </button>

          {/* Previous */}
          <button onClick={onPrevious} className={TRANSPORT_BUTTON} title={t.bottomDock.prevTooltip}>
            <SkipBack size={18} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={onPlayPause}
            className="bg-accent-gradient flex size-9.5 items-center justify-center rounded-full text-on-accent shadow-halo-lg shadow-accent-pink/45"
            title={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
          >
            {status.state === 'Playing' ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button onClick={onNext} className={TRANSPORT_BUTTON} title={t.bottomDock.nextTooltip}>
            <SkipForward size={18} />
          </button>

          {/* Loop Mode */}
          <button
            onClick={onCycleLoopMode}
            aria-pressed={queue.loop_mode !== 'None'}
            className={cn(ROUND_TOGGLE, PRESSED_TONES.pink)}
            title={
              queue.loop_mode === 'Track'
                ? loc.player.loopTrack
                : queue.loop_mode === 'Queue'
                  ? loc.player.loopQueue
                  : loc.player.loopOff
            }
          >
            {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>

          {/* Stop After Current */}
          <button
            onClick={onToggleStopAfterCurrent}
            aria-pressed={Boolean(status.stop_after_current)}
            className={cn(ROUND_TOGGLE, PRESSED_TONES.yellow)}
            title={
              status.stop_after_current
                ? loc.bottomDock.stopAfterCurrentOn
                : loc.bottomDock.stopAfterCurrentOff
            }
          >
            <Square size={13} fill={status.stop_after_current ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Position Slider */}
        <div className="flex w-full items-center gap-2.5">
          <span className="min-w-9 text-right font-mono text-xs text-fg-muted">{formatTime(status.position_ms)}</span>
          <input
            type="range"
            min={0}
            max={status.duration_ms || 100}
            value={status.position_ms}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onSeekPreview) onSeekPreview(val);
              else onSeek(val);
            }}
            onPointerUp={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onMouseUp={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onTouchEnd={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onKeyUp={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                onSeekCommit?.(Number(e.currentTarget.value));
              }
            }}
            className="range-fill h-1 flex-1"
            style={cssVars({ '--fill': `${seekProgressPercent}%` })}
          />
          <span className="min-w-9 font-mono text-xs text-fg-muted">{formatTime(status.duration_ms || 0)}</span>
        </div>
      </div>

      {/* Prawa strona: DSP, Głośność, Maksymalizacja */}
      <div className="flex min-w-60 items-center justify-end gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'relative inline-flex items-center rounded-2xl border shadow-halo-sm transition-all duration-200',
              ENGINE_TONES[status.engine],
            )}
          >
            <button
              onClick={onCycleDspEngine}
              className="flex items-center gap-1.5 bg-transparent py-1 pr-2 pl-2.5 text-xs font-bold"
              title={loc.bottomDock.dspEngineCycleTooltip.replace(
                '{0}',
                status.engine === 'Bypass'
                  ? `Direct Bypass (${loc.bottomDock.cleanAudio})`
                  : status.engine === 'RubberBand'
                    ? 'Rubber Band (Hi-Fi R3)'
                    : status.engine
              )}
            >
              <Zap size={13} fill={status.engine !== 'Bypass' ? 'currentColor' : 'none'} />
              <span>{status.engine === 'RubberBand' ? 'Rubber Band' : status.engine}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDspQuickMenuOpen(!isDspQuickMenuOpen);
              }}
              aria-expanded={isDspQuickMenuOpen}
              className="flex items-center border-l border-white/10 bg-transparent py-1 pr-1.5 pl-0.5"
              title={loc.bottomDock.selectDspEngineList}
            >
              <ChevronUp size={12} className={cn('transition-transform duration-200', isDspQuickMenuOpen && 'rotate-180')} />
            </button>

            {isDspQuickMenuOpen && (
              <div
                className="absolute right-0 bottom-full z-10 mb-2 flex min-w-51 flex-col gap-1 rounded-xl border border-line bg-ink/95 p-1.5 shadow-panel backdrop-blur-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-xxs font-semibold text-fg-muted">{loc.bottomDock.selectDspEngine}</div>
                {[
                  { id: 'Bypass' as DspEngineType, name: 'Direct Bypass', desc: loc.bottomDock.cleanAudio },
                  { id: 'RubberBand' as DspEngineType, name: 'Rubber Band', desc: 'Hi-Fi R3' },
                  { id: 'SoundTouch' as DspEngineType, name: 'SoundTouch', desc: loc.bottomDock.fastEngine },
                ].map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => {
                      onSelectDspEngine(eng.id);
                      setIsDspQuickMenuOpen(false);
                    }}
                    aria-pressed={status.engine === eng.id}
                    className={cn(
                      'flex items-center justify-between gap-2 border border-transparent bg-transparent px-2.5 py-2 text-left text-xs font-medium text-fg-secondary aria-pressed:bg-white/10 aria-pressed:font-bold',
                      ENGINE_MENU_PRESSED[eng.id],
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap size={12} className={ENGINE_TEXT[eng.id]} fill={eng.id !== 'Bypass' ? 'currentColor' : 'none'} />
                      {eng.name}
                    </span>
                    <span className="text-xxs font-normal text-fg-muted">{eng.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {status.pitch_semitones !== 0 && (
            <span
              className="rounded-md bg-accent-pink/20 px-2 py-0.5 text-xxs font-semibold text-accent-pink"
              title={t.bottomDock.pitchTooltip}
            >
              {status.pitch_semitones > 0 ? `+${status.pitch_semitones}` : status.pitch_semitones} st
            </span>
          )}
          {status.tempo_ratio !== 1.0 && (
            <span
              className="rounded-md bg-accent-cyan/20 px-2 py-0.5 text-xxs font-semibold text-accent-cyan"
              title={t.bottomDock.tempoTooltip}
            >
              {status.tempo_ratio.toFixed(2)}x
            </span>
          )}
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className="bg-transparent p-0 text-fg-muted hover:text-fg"
            title={status.volume === 0 ? t.bottomDock.mutedTooltip : t.bottomDock.volumeTooltip}
          >
            {status.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={status.volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            title={`${loc.player.volume}: ${Math.round(status.volume * 100)}%`}
            className="range-fill h-1 w-24"
            style={cssVars({ '--fill': `${volumeProgressPercent}%` })}
          />
        </div>

        {/* Scroll to Top / Expand to Player View */}
        <button
          onClick={onScrollToTopOrSwitchTab}
          className={DOCK_GLASS_BUTTON}
          title={activeTab === 'player' ? t.bottomDock.scrollToTop : t.bottomDock.openFullPlayer}
        >
          {activeTab === 'player' ? <ChevronUp size={15} /> : <Maximize2 size={14} />}
        </button>

        {/* Mini Player Toggle */}
        <button onClick={onToggleMiniPlayer} className={DOCK_GLASS_BUTTON} title={t.bottomDock.maximizeTooltip}>
          <Minimize2 size={14} />
        </button>
      </div>
    </div>
  );
});
