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
} from '../ui/icons';
import { type Language, type Translations } from '../../i18n';
import { type PlaybackStatus, type TrackRecord, type DspEngineType } from '../../types/player';
import { type PlaybackQueue } from '../../types/queue';
import { useLiveStatus } from '../../state/livePlayback';
import { cn } from '../../utils/cn';
import { cssVars } from '../../utils/cssVars';
import { fmt } from '../../utils/fmt';
import { Badge, Button, Chip, IconButton, MenuItem, Popover, RangeSlider, type Tone } from '../ui';
import { textTones, tintedTones } from '../ui/tones';

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

/** Round transport toggle (shuffle, loop, stop after current). */
const ROUND_TOGGLE = 'relative size-8.5 rounded-full p-0';

/** Colour of each DSP engine (pill, menu icon). */
const ENGINE_TONE: Record<DspEngineType, Tone> = {
  Bypass: 'green',
  RubberBand: 'pink',
  SoundTouch: 'cyan',
};

const DSP_ENGINES: readonly { id: DspEngineType; name: string; desc: (loc: Translations) => string }[] = [
  { id: 'Bypass', name: 'Direct Bypass', desc: (loc) => loc.bottomDock.cleanAudio },
  { id: 'RubberBand', name: 'Rubber Band', desc: () => 'Hi-Fi R3' },
  { id: 'SoundTouch', name: 'SoundTouch', desc: (loc) => loc.bottomDock.fastEngine },
];

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
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const status = useLiveStatus(statusProp);
  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;
  const [isDspQuickMenuOpen, setIsDspQuickMenuOpen] = useState(false);

  if (!isVisible) return null;

  const closeDspMenu = () => setIsDspQuickMenuOpen(false);
  const loopTitle =
    queue.loop_mode === "Track" ? loc.player.loopTrack : queue.loop_mode === "Queue" ? loc.player.loopQueue : loc.player.loopOff;

  const t = loc;

  return (
    // Height `h-23` (5.75rem / 92px) is coupled to clearances in MainContentRouter (`pb-26`), BackgroundExportBadge (`bottom-26.5`), and VolumeOsd (`bottom-34`).
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-23 items-center justify-between gap-4 border-t border-line-accent bg-ink/95 px-6 shadow-dock motion-safe:animate-fade-in max-lg:gap-3 max-lg:px-4">
      {/* Left side: mini cover, title, artist */}
      <div
        onClick={onScrollToTopOrSwitchTab}
        className="group flex min-w-44 max-w-3/10 cursor-pointer items-center gap-3.5 lg:min-w-56"
        title={activeTab === 'player' ? loc.bottomDock.scrollToTop : loc.bottomDock.openFullPlayer}
      >
        <div
          className={cn(
            'flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line shadow-lift shadow-black/40 transition-colors group-hover:border-line-accent',
            !currentCover && 'bg-accent-gradient',
          )}
          style={currentCover ? { background: `url("${currentCover}") center/cover no-repeat` } : undefined}
        >
          {!currentCover && (
            <Disc size={28} className={cn('text-on-accent', status.state === 'Playing' && 'motion-safe:animate-spin-slow')} />
          )}
        </div>
        <div className="min-w-0 overflow-hidden">
          <p className="truncate text-md font-bold leading-snug text-fg transition-colors group-hover:text-accent-pink">
            {effectiveDisplayTitle}
          </p>
          <div className="mt-1 flex items-center gap-2 truncate text-ui text-fg-secondary">
            <span className="truncate">{effectiveDisplayArtist}</span>
            {currentPlayingTrack?.format && (
              <Badge tone="cyan" size="sm" mono>
                {currentPlayingTrack.format}
              </Badge>
            )}
            {(currentPlayingTrack?.path || filePath || status.current_track?.uri) && (
              <IconButton
                size="sm"
                label={loc.queue.openContainingFolder}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenContainingFolder(
                    currentPlayingTrack?.path || filePath || status.current_track?.uri || '',
                    e
                  );
                }}
                className="size-6.5"
              >
                <FolderOpen size={15} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* Centre: playback controls and the position bar */}
      <div className="flex min-w-0 max-w-152 flex-1 flex-col items-center gap-2">
        <div className="flex items-center gap-3.5 lg:gap-4">
          <Chip
            tone="cyan"
            pressed={queue.shuffle}
            onClick={onToggleShuffle}
            aria-label={queue.shuffle ? loc.player.shuffleOn : loc.player.shuffleOff}
            title={queue.shuffle ? loc.player.shuffleOn : loc.player.shuffleOff}
            className={ROUND_TOGGLE}
          >
            <Shuffle size={18} />
          </Chip>

          <IconButton
            size="md"
            label={t.bottomDock.prevTooltip}
            onClick={onPrevious}
            className="rounded-full text-fg-secondary hover:bg-white/8 hover:text-fg"
          >
            <SkipBack size={20} />
          </IconButton>

          <Button
            variant="primary"
            onClick={onPlayPause}
            aria-label={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
            title={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
            className="size-11 rounded-full p-0 shadow-halo-lg shadow-accent-pink/45"
          >
            {status.state === 'Playing' ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </Button>

          <IconButton
            size="md"
            label={t.bottomDock.nextTooltip}
            onClick={onNext}
            className="rounded-full text-fg-secondary hover:bg-white/8 hover:text-fg"
          >
            <SkipForward size={20} />
          </IconButton>

          <Chip
            tone="pink"
            pressed={queue.loop_mode !== 'None'}
            onClick={onCycleLoopMode}
            aria-label={loopTitle}
            title={loopTitle}
            className={ROUND_TOGGLE}
          >
            {queue.loop_mode === 'Track' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            {queue.loop_mode === 'Queue' && (
              <span aria-hidden="true" className="absolute right-1 bottom-1 size-1 rounded-full bg-accent-pink" />
            )}
          </Chip>

          <Chip
            tone="amber"
            pressed={Boolean(status.stop_after_current)}
            onClick={onToggleStopAfterCurrent}
            aria-label={status.stop_after_current ? loc.bottomDock.stopAfterCurrentOn : loc.bottomDock.stopAfterCurrentOff}
            title={status.stop_after_current ? loc.bottomDock.stopAfterCurrentOn : loc.bottomDock.stopAfterCurrentOff}
            className={ROUND_TOGGLE}
          >
            <Square size={15} fill={status.stop_after_current ? 'currentColor' : 'none'} />
          </Chip>
        </div>

        {/* Position slider: preview while dragging, one seek on release */}
        <div className="flex w-full items-center gap-3">
          <span className="min-w-10 text-right font-mono text-xs tabular-nums text-fg-muted">{formatTime(status.position_ms)}</span>
          <input
            type="range"
            aria-label={loc.bottomDock.seekLabel}
            min={0}
            max={status.duration_ms || 100}
            value={status.position_ms}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onSeekPreview) onSeekPreview(val);
              else onSeek(val);
            }}
            onPointerUp={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onKeyUp={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                onSeekCommit?.(Number(e.currentTarget.value));
              }
            }}
            className="h-1.5 flex-1 range-fill"
            style={cssVars({ '--fill': `${seekProgressPercent}%` })}
          />
          <span className="min-w-10 font-mono text-xs tabular-nums text-fg-muted">{formatTime(status.duration_ms || 0)}</span>
        </div>
      </div>

      {/* Right side: DSP, volume, maximise */}
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-3.5 max-lg:gap-2.5">
        <div className="flex items-center gap-2">
          <Popover
            open={isDspQuickMenuOpen}
            onClose={closeDspMenu}
            side="top"
            align="end"
            label={loc.bottomDock.selectDspEngine}
            className="min-w-51"
            trigger={
              <div className={cn('inline-flex items-center rounded-lg border', tintedTones[ENGINE_TONE[status.engine]])}>
                <button
                  type="button"
                  onClick={onCycleDspEngine}
                  className="flex items-center gap-1.5 rounded-r-none py-1.5 pr-2.5 pl-3 text-xs font-bold"
                  title={fmt(
                    loc.bottomDock.dspEngineCycleTooltip,
                    status.engine === 'Bypass'
                      ? `Direct Bypass (${loc.bottomDock.cleanAudio})`
                      : status.engine === 'RubberBand'
                        ? 'Rubber Band (Hi-Fi R3)'
                        : status.engine
                  )}
                >
                  <Zap size={15} fill={status.engine !== 'Bypass' ? 'currentColor' : 'none'} />
                  {status.engine === 'RubberBand' ? 'Rubber Band' : status.engine}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDspQuickMenuOpen(!isDspQuickMenuOpen)}
                  aria-expanded={isDspQuickMenuOpen}
                  aria-haspopup="menu"
                  aria-label={loc.bottomDock.selectDspEngineList}
                  title={loc.bottomDock.selectDspEngineList}
                  className="flex items-center rounded-l-none border-l border-line py-1.5 pr-2 pl-1"
                >
                  <ChevronUp size={14} className={cn('motion-safe:transition-transform', isDspQuickMenuOpen && 'rotate-180')} />
                </button>
              </div>
            }
          >
            <div aria-hidden="true" className="px-2 py-1 text-xxs font-semibold text-fg-muted">
              {loc.bottomDock.selectDspEngine}
            </div>
            {DSP_ENGINES.map((eng) => (
              <MenuItem
                key={eng.id}
                selected={status.engine === eng.id}
                icon={<Zap size={14} className={textTones[ENGINE_TONE[eng.id]]} fill={eng.id !== 'Bypass' ? 'currentColor' : 'none'} />}
                onClick={() => {
                  onSelectDspEngine(eng.id);
                  closeDspMenu();
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  {eng.name}
                  <span className="text-xxs font-normal text-fg-muted">{eng.desc(loc)}</span>
                </span>
              </MenuItem>
            ))}
          </Popover>

          {status.pitch_semitones !== 0 && (
            <Badge tone="pink" size="sm" title={t.bottomDock.pitchTooltip}>
              {status.pitch_semitones > 0 ? `+${status.pitch_semitones}` : status.pitch_semitones} st
            </Badge>
          )}
          {status.tempo_ratio !== 1.0 && (
            <Badge tone="cyan" size="sm" title={t.bottomDock.tempoTooltip}>
              {status.tempo_ratio.toFixed(2)}x
            </Badge>
          )}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <IconButton
            size="md"
            label={status.volume === 0 ? t.bottomDock.mutedTooltip : t.bottomDock.volumeTooltip}
            onClick={onToggleMute}
            className="rounded-full"
          >
            {status.volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </IconButton>
          <RangeSlider
            aria-label={loc.player.volume}
            min={0}
            max={1}
            step={0.01}
            value={status.volume}
            onChange={onVolumeChange}
            title={`${loc.player.volume}: ${Math.round(status.volume * 100)}%`}
            className="h-1.5 w-20 lg:w-26"
          />
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            variant="secondary"
            size="md"
            label={activeTab === 'player' ? t.bottomDock.scrollToTop : t.bottomDock.openFullPlayer}
            onClick={onScrollToTopOrSwitchTab}
          >
            {activeTab === 'player' ? <ChevronUp size={18} /> : <Maximize2 size={17} />}
          </IconButton>
          <IconButton variant="secondary" size="md" label={t.bottomDock.maximizeTooltip} onClick={onToggleMiniPlayer}>
            <Minimize2 size={17} />
          </IconButton>
        </div>
      </div>
    </div>
  );
});
