import React, { useState } from 'react';
import { Disc, MoreVertical, Play, Star, Zap } from '../../../components/ui/icons';
import type { TrackRecord } from '../../../types/library';
import { Badge, IconButton, MenuItem, Popover, type ToneOrNeutral } from '../../../components/ui';
import { textTones } from '../../../components/ui/tones';
import { cn } from '../../../utils/cn';
import { fmt } from '../../../utils/fmt';
import type { Translations } from '../../../i18n';
import { isHiRes } from './trackModel';

/** Format pill of a track row: cyan for hi-res files, grey otherwise. */
export function TrackFormatBadge({ track, suffix }: { track: TrackRecord; suffix?: string }) {
  return (
    <Badge tone={isHiRes(track) ? 'cyan' : 'neutral'} mono>
      {track.format}
      {suffix}
    </Badge>
  );
}

/** First cell of the playing row: a bolt while it plays, a play glyph while it is paused. */
export function NowPlayingMark({ playing }: { playing: boolean }) {
  return playing ? (
    <Zap size={14} className="inline text-accent-pink" />
  ) : (
    <Play size={13} fill="currentColor" className="inline text-accent-pink" />
  );
}

export interface TrackActionProps {
  label: string;
  tone: ToneOrNeutral;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

/** Small coloured icon action in a track row. Stops the click so the row does not start playing. */
export function TrackAction({ label, tone, onClick, children }: TrackActionProps) {
  return (
    <IconButton
      size="sm"
      label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn('size-5 rounded-md', textTones[tone])}
    >
      {children}
    </IconButton>
  );
}

/** Five-star rating; clicking the current rating clears it. */
export function StarRating({
  rating,
  onRate,
  loc,
}: {
  rating: number | null | undefined;
  onRate: (stars: number) => void;
  loc: Translations;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (rating || 0) >= star;
        return (
          <IconButton
            key={star}
            size="sm"
            label={fmt(loc.library.ratingTooltip, String(star))}
            onClick={() => onRate(rating === star ? 0 : star)}
            className={cn('size-4 rounded-sm', active ? 'text-accent-amber' : 'text-fg-muted/40')}
          >
            <Star size={12} fill={active ? 'currentColor' : 'none'} />
          </IconButton>
        );
      })}
    </div>
  );
}

/** Square album cover of a track row, or a disc glyph on a tinted gradient when the album has none. */
export const TrackCover = React.memo(function TrackCover({ src }: { src: string | null | undefined }) {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-linear-135 from-accent-purple/20 to-accent-cyan/15">
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : (
        <Disc size={16} className="text-fg-muted/50" aria-hidden="true" />
      )}
    </div>
  );
});

export interface TrackMenuEntry {
  label: string;
  icon: React.ReactNode;
  onSelect: (e: React.MouseEvent) => void;
}

/** "More" button of a track row: a menu with the less frequent actions. Stops clicks from playing the row. */
export function TrackRowMenu({ label, entries }: { label: string; entries: readonly TrackMenuEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        label={label}
        trigger={
          <IconButton size="sm" label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((prev) => !prev)} className="size-5 rounded-md text-fg-muted">
            <MoreVertical size={15} />
          </IconButton>
        }
      >
        {entries.map((entry) => (
          <MenuItem
            key={entry.label}
            icon={entry.icon}
            onClick={(e) => {
              setOpen(false);
              entry.onSelect(e);
            }}
          >
            {entry.label}
          </MenuItem>
        ))}
      </Popover>
    </span>
  );
}
