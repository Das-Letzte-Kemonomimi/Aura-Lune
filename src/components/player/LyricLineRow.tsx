import React from 'react';
import { Clock } from '../ui/icons';
import { cn } from '../../utils/cn';
import { Badge, Button } from '../ui';
import type { RomajiMode } from './lyricsModel';

export interface LyricLineRowProps {
  index: number;
  text: string;
  /** Pre-computed transliteration (null when the mode or the line needs none). */
  romaji: string | null;
  romajiMode: RomajiMode;
  isActive: boolean;
  isPast: boolean;
  isTarget: boolean;
  isSyncMode: boolean;
  /** Timestamp shown in sync mode. */
  timeLabel: string;
  syncActionLabel: string;
  syncTooltip: string;
  /** Attached only to the active line (autoscroll target). */
  lineRef?: React.Ref<HTMLDivElement>;
  /** Stable handlers (receive the line index). */
  onLineClick: (index: number) => void;
  onSetLineTime: (index: number) => void;
}

/**
 * One synced lyric line. Memoised: the lyrics view re-renders on every position tick, but a line only
 * re-renders when its own flags change (it becomes active / past / the sync target), and its romaji
 * is computed once per lyrics load instead of per tick.
 */
export const LyricLineRow = React.memo(function LyricLineRow({
  index,
  text,
  romaji,
  romajiMode,
  isActive,
  isPast,
  isTarget,
  isSyncMode,
  timeLabel,
  syncActionLabel,
  syncTooltip,
  lineRef,
  onLineClick,
  onSetLineTime,
}: LyricLineRowProps) {
  return (
    <div
      ref={lineRef}
      className={cn(
        'border-l-4',
        'flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-2 leading-normal wrap-anywhere motion-safe:transition-[color,background-color,border-color,opacity,scale] motion-safe:duration-200',
        isActive ? 'text-2xl font-bold' : 'text-base font-medium',
        isActive ? 'text-fg' : isPast ? 'text-fg-secondary' : 'text-fg-muted',
        isActive ? 'opacity-100' : isPast ? 'opacity-65' : 'opacity-45',
        isTarget ? 'bg-accent-pink/20' : isActive ? 'bg-accent-purple/10' : 'bg-transparent',
        isActive ? 'border-accent-cyan' : isTarget ? 'border-accent-pink' : 'border-transparent',
        isActive && 'scale-104 text-shadow-glow',
      )}
      onClick={() => onLineClick(index)}
    >
      {/* Timestamp in sync mode */}
      {isSyncMode && (
        <div className="flex items-center gap-1.5">
          <Badge mono>{timeLabel}</Badge>
          <Button
            variant="tinted"
            tone="pink"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSetLineTime(index);
            }}
            title={syncTooltip}
            className="text-xxs"
          >
            <Clock size={11} /> {syncActionLabel}
          </Button>
        </div>
      )}

      {/* Lyric line text with optional Romaji transliteration */}
      {romajiMode === 'original' ? (
        <span className="min-w-0 flex-1">{text}</span>
      ) : romajiMode === 'romaji' ? (
        <span className="min-w-0 flex-1">{romaji ?? text}</span>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <span>{text}</span>
          {romaji !== null && (
            <span
              className={cn(
                'text-[0.72em] font-medium tracking-wide italic transition-[color,opacity] duration-200',
                isActive ? 'text-accent-cyan opacity-95' : 'text-fg-secondary opacity-65',
              )}
            >
              {romaji}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
