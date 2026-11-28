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
import { useLiveStatus, useLiveVolume } from '../../state/livePlayback';
import { cn } from '../../utils/cn';
import { cssVars } from '../../utils/cssVars';
import { fmt } from '../../utils/fmt';
import { Badge, Button, Chip, IconButton, MenuItem, Popover, type Tone } from '../ui';
import { textTones, tintedTones } from '../ui/tones';
import { VolumeIcon, VolumeSlider } from '../player/VolumeSlider';

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
  /** Volume readout in the user's unit (`useVolumeUnit().formatVolumeValue`). */
  formatVolumeValue: (gain: number) => string;
  onToggleMiniPlayer: () => void;
}

/** Round transport toggle (shuffle, loop, stop after current). */
const ROUND_TOGGLE = 'relative size-9 rounded-full p-0';

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

/** Volume + mute controls: reads `livePlayback` volume so drag/smooth fades avoid dock re-renders. */
const DockVolumeCluster: React.FC<{
  stopAfterCurrent: boolean | undefined;
  volumeFallback: number;
  loc: Translations;
  onToggleStopAfterCurrent: () => void;
  onToggleMute: () => void;
  onVolumeChange: (val: number, immediate?: boolean) => void;
  formatVolumeValue: (gain: number) => string;
}> = React.memo(({
  stopAfterCurrent,
  volumeFallback,
  loc,
  onToggleStopAfterCurrent,
  onToggleMute,
  onVolumeChange,
  formatVolumeValue,
}) => {
  const volume = useLiveVolume(volumeFallback);
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-black/25 p-1">
      <Chip
        tone="amber"
        pressed={Boolean(stopAfterCurrent)}
        onClick={onToggleStopAfterCurrent}
        aria-label={stopAfterCurrent ? loc.bottomDock.stopAfterCurrentOn : loc.bottomDock.stopAfterCurrentOff}
        title={stopAfterCurrent ? loc.bottomDock.stopAfterCurrentOn : loc.bottomDock.stopAfterCurrentOff}
        className="size-8 rounded-xl p-0 max-md:hidden"
      >
        <Square size={14} fill={stopAfterCurrent ? 'currentColor' : 'none'} />
      </Chip>
      <IconButton
        size="md"
        label={volume === 0 ? loc.bottomDock.mutedTooltip : loc.bottomDock.volumeTooltip}
        onClick={onToggleMute}
        className="size-8 rounded-xl"
      >
        <VolumeIcon gain={volume} size={18} />
      </IconButton>
      <VolumeSlider
        ariaLabel={loc.player.volume}
        gain={volume}
        onGainChange={onVolumeChange}
        title={`${loc.player.volume}: ${formatVolumeValue(volume)}`}
        className="mr-2 h-1.5 w-20 max-xl:w-14 max-lg:hidden"
      />
    </div>
  );
});

interface DockProgressProps {
  status: PlaybackStatus;
  seekLabel: string;
  formatTime: (ms: number) => string;
  onSeek: (ms: number) => void;
  onSeekPreview?: (ms: number) => void;
  onSeekCommit?: (ms: number) => void;
}

/** Progress slider and timestamps: owns the live position subscription so the dock itself does not tick 10×/s. */
const DockProgress: React.FC<DockProgressProps> = ({
  status: statusProp,
  seekLabel,
  formatTime,
  onSeek,
  onSeekPreview,
  onSeekCommit,
}) => {
  const status = useLiveStatus(statusProp);
  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;

  return (
    <div className="flex w-full items-center gap-2.5">
      <span className="min-w-11 rounded-md bg-black/30 px-1.5 py-px text-center font-mono text-xs tabular-nums text-fg">{formatTime(status.position_ms)}</span>
      <input
        type="range"
        aria-label={seekLabel}
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
      <span className="min-w-11 rounded-md bg-black/30 px-1.5 py-px text-center font-mono text-xs tabular-nums text-fg-muted">{formatTime(status.duration_ms || 0)}</span>
    </div>
  );
};

export const BottomPlaybackDock: React.FC<BottomPlaybackDockProps> = React.memo(({
  isVisible,
  activeTab,
  language: _language,
  loc,
  status,
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
  formatVolumeValue,
  onToggleMiniPlayer,
}) => {
  const [isDspQuickMenuOpen, setIsDspQuickMenuOpen] = useState(false);

  if (!isVisible) return null;

  const closeDspMenu = () => setIsDspQuickMenuOpen(false);
  const dspBypassed = status.engine === 'Bypass';
  const loopTitle =
    queue.loop_mode === "Track" ? loc.player.loopTrack : queue.loop_mode === "Queue" ? loc.player.loopQueue : loc.player.loopOff;

  const t = loc;

  return (
    // Height `h-21.5` (5.375rem / 86px) is coupled to clearances in MainContentRouter (`pb-24.5`), BackgroundExportBadge (`bottom-25`), and VolumeOsd (`bottom-32.5`).
    // Three zones: track, transport (always centred on the bar), tools. Below `lg` the tools shrink to the essentials.
    <div className="fixed inset-x-0 bottom-0 z-40 grid h-21.5 items-center gap-3 border-t border-line-accent bg-ink/95 px-4 shadow-dock motion-safe:animate-fade-in xl:grid-cols-[minmax(0,1fr)_minmax(0,37rem)_minmax(0,1fr)] xl:gap-4 xl:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)_minmax(0,1fr)] max-lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_auto]">
      {/* Left: cover, title, artist */}
      <div
        onClick={onScrollToTopOrSwitchTab}
        className="group flex min-w-0 cursor-pointer items-center gap-3"
        title={activeTab === 'player' ? loc.bottomDock.scrollToTop : loc.bottomDock.openFullPlayer}
      >
        <div
          className={cn(
            'flex size-13.5 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line shadow-lift shadow-black/40 transition-colors group-hover:border-line-accent max-md:size-11.5',
            !currentCover && 'bg-accent-gradient',
          )}
          style={currentCover ? { background: `url("${currentCover}") center/cover no-repeat` } : undefined}
        >
          {!currentCover && (
            <Disc size={26} className={cn('text-on-accent', status.state === 'Playing' && 'motion-safe:animate-spin-slow')} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug font-extrabold tracking-tight text-fg transition-colors group-hover:text-accent-pink xl:text-base" title={effectiveDisplayTitle}>
            {effectiveDisplayTitle}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-accent-pink xl:text-ui" title={effectiveDisplayArtist}>
            {effectiveDisplayArtist}
          </p>
          <div className="mt-1 flex items-center gap-1.5 max-md:hidden">
            {currentPlayingTrack?.format && (
              <Badge tone="cyan" size="xs" mono>
                {currentPlayingTrack.format}
              </Badge>
            )}
            {(currentPlayingTrack?.path || filePath || status.current_track?.uri) && (
              <IconButton
                size="sm"
                label={loc.queue.openContainingFolder}
                className="size-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenContainingFolder(
                    currentPlayingTrack?.path || filePath || status.current_track?.uri || '',
                    e
                  );
                }}
              >
                <FolderOpen size={14} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* Centre: transport and the position bar */}
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <div className="flex items-center gap-2 max-md:gap-1.5">
          <Chip
            tone="cyan"
            pressed={queue.shuffle}
            onClick={onToggleShuffle}
            aria-label={queue.shuffle ? loc.player.shuffleOn : loc.player.shuffleOff}
            title={queue.shuffle ? loc.player.shuffleOn : loc.player.shuffleOff}
            className={ROUND_TOGGLE}
          >
            <Shuffle size={16} />
          </Chip>

          <IconButton
            size="md"
            label={t.bottomDock.prevTooltip}
            onClick={onPrevious}
            className="size-9 rounded-full border-transparent bg-white/8 text-fg"
          >
            <SkipBack size={18} />
          </IconButton>

          <Button
            variant="primary"
            onClick={onPlayPause}
            aria-label={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
            title={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
            className="size-10.5 rounded-full p-0 shadow-halo-lg shadow-accent-pink/45"
          >
            {status.state === 'Playing' ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" className="ml-0.5" />
            )}
          </Button>

          <IconButton
            size="md"
            label={t.bottomDock.nextTooltip}
            onClick={onNext}
            className="size-9 rounded-full border-transparent bg-white/8 text-fg"
          >
            <SkipForward size={18} />
          </IconButton>

          <Chip
            tone="pink"
            pressed={queue.loop_mode !== 'None'}
            onClick={onCycleLoopMode}
            aria-label={loopTitle}
            title={loopTitle}
            className={ROUND_TOGGLE}
          >
            {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            {queue.loop_mode === 'Queue' && (
              <span aria-hidden="true" className="absolute right-1 bottom-1 size-1 rounded-full bg-accent-pink" />
            )}
          </Chip>
        </div>

        {/* Position slider: preview while dragging, one seek on release */}
        <DockProgress
          status={status}
          seekLabel={loc.bottomDock.seekLabel}
          formatTime={formatTime}
          onSeek={onSeek}
          onSeekPreview={onSeekPreview}
          onSeekCommit={onSeekCommit}
        />
      </div>

      {/* Right: DSP engine, volume and window controls, each in its own rail */}
      <div className="flex min-w-0 items-center justify-end gap-2.5 max-lg:gap-2">
        <div className="flex items-center gap-1.5 max-lg:hidden">
          <Popover
            open={isDspQuickMenuOpen}
            onClose={closeDspMenu}
            side="top"
            align="end"
            label={loc.bottomDock.selectDspEngine}
            className="min-w-51"
            trigger={
              <div
                className={cn(
                  'inline-flex items-center rounded-lg border',
                  dspBypassed ? 'border-line bg-white/5 text-fg-muted opacity-60' : tintedTones[ENGINE_TONE[status.engine]],
                )}
                data-bypassed={dspBypassed || undefined}
              >
                <button
                  type="button"
                  onClick={onCycleDspEngine}
                  className="flex items-center gap-1.5 rounded-r-none py-2 pr-3 pl-3.5 text-ui font-bold"
                  title={fmt(
                    loc.bottomDock.dspEngineCycleTooltip,
                    status.engine === 'Bypass'
                      ? `Direct Bypass (${loc.bottomDock.cleanAudio})`
                      : status.engine === 'RubberBand'
                        ? 'Rubber Band (Hi-Fi R3)'
                        : status.engine
                  )}
                >
                  <Zap size={16} fill={dspBypassed ? 'none' : 'currentColor'} />
                  {status.engine === 'RubberBand' ? 'Rubber Band' : status.engine}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDspQuickMenuOpen(!isDspQuickMenuOpen)}
                  aria-expanded={isDspQuickMenuOpen}
                  aria-haspopup="menu"
                  aria-label={loc.bottomDock.selectDspEngineList}
                  title={loc.bottomDock.selectDspEngineList}
                  className="flex items-center rounded-l-none border-l border-line py-2 pr-2.5 pl-1.5"
                >
                  <ChevronUp size={15} className={cn('motion-safe:transition-transform', isDspQuickMenuOpen && 'rotate-180')} />
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
                icon={<Zap size={15} className={textTones[ENGINE_TONE[eng.id]]} fill={eng.id !== 'Bypass' ? 'currentColor' : 'none'} />}
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
            <Badge
              tone={dspBypassed ? 'neutral' : 'pink'}
              size="sm"
              title={dspBypassed ? `${t.bottomDock.pitchTooltip}: ${t.bottomDock.bypassedTooltip}` : t.bottomDock.pitchTooltip}
              className={cn(dspBypassed && 'opacity-60')}
            >
              {status.pitch_semitones > 0 ? `+${status.pitch_semitones}` : status.pitch_semitones} st
            </Badge>
          )}
          {status.tempo_ratio !== 1.0 && (
            <Badge
              tone={dspBypassed ? 'neutral' : 'cyan'}
              size="sm"
              title={dspBypassed ? `${t.bottomDock.tempoTooltip}: ${t.bottomDock.bypassedTooltip}` : t.bottomDock.tempoTooltip}
              className={cn(dspBypassed && 'opacity-60')}
            >
              {status.tempo_ratio.toFixed(2)}x
            </Badge>
          )}
        </div>

        <DockVolumeCluster
          stopAfterCurrent={status.stop_after_current}
          volumeFallback={status.volume}
          loc={loc}
          onToggleStopAfterCurrent={onToggleStopAfterCurrent}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
          formatVolumeValue={formatVolumeValue}
        />

        <div className="flex items-center gap-1 rounded-2xl border border-line bg-black/25 p-1">
          <IconButton
            variant="ghost"
            size="md"
            label={activeTab === 'player' ? t.bottomDock.scrollToTop : t.bottomDock.openFullPlayer}
            onClick={onScrollToTopOrSwitchTab}
            className="size-8 rounded-xl"
          >
            {activeTab === 'player' ? <ChevronUp size={18} /> : <Maximize2 size={16} />}
          </IconButton>
          <IconButton
            variant="ghost"
            size="md"
            label={t.bottomDock.maximizeTooltip}
            onClick={onToggleMiniPlayer}
            className="size-8 rounded-xl"
          >
            <Minimize2 size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  );
});
