import React from 'react';
import { Clock, Disc, Plus, Search, Sparkles } from '../../../components/ui/icons';
import type { AlbumRecord } from '../../../types/library';
import type { Translations } from '../../../i18n';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Card, IconButton, ProgressBar } from '../../../components/ui';
import { MIXED_FORMAT, type AlbumStats } from './albumModel';
import { NowPlayingMark } from './trackRowParts';

export type AlbumTileSize = 'compact' | 'medium' | 'large';

/** Actions of an album tile. The identity never changes, so tiles are not re-rendered by it. */
export interface AlbumActions {
  open: (album: AlbumRecord) => void;
  play: (album: AlbumRecord) => void;
  queue: (album: AlbumRecord) => void;
  coverPicker: (album: AlbumRecord) => void;
  musicBrainz: (album: AlbumRecord) => void;
}

/** What a tile needs to draw itself; `playback` is only set on the album that is playing or paused. */
export interface AlbumTileProps {
  album: AlbumRecord;
  stats: AlbumStats;
  durText: string;
  playback: 'playing' | 'paused' | null;
  loc: Translations;
  actions: AlbumActions;
}

const TILE_MAX_WIDTH = { compact: 'max-w-50', medium: 'max-w-61.5', large: 'max-w-75' } as const;

/**
 * Hundreds of tiles: the browser skips layout and paint of the ones outside the viewport and keeps
 * the size it measured last (`auto`) so the scrollbar stays steady.
 */
const OFFSCREEN_SKIP = '[content-visibility:auto] [contain-intrinsic-size:auto_18rem]';
const ROW_OFFSCREEN_SKIP = '[content-visibility:auto] [contain-intrinsic-size:auto_4.5rem]';

/** Border and tint of the card of the album that is playing or paused (same look as the queue drawer). */
const PLAYING_CARD =
  'aria-[current=true]:border-accent-pink aria-[current=true]:bg-accent-pink/15 aria-[current=true]:shadow-halo-lg aria-[current=true]:shadow-accent-pink/25';

/** Format of an album as a corner badge: cyan for hi-res, grey otherwise, "Mixed" for several formats. */
function AlbumFormatBadge({ stats, mixedLabel, className }: { stats: AlbumStats; mixedLabel: string; className?: string }) {
  if (stats.trackCount === 0) return null;
  return (
    <Badge tone={stats.hiRes ? 'cyan' : 'neutral'} size="xs" mono className={className}>
      {stats.format === MIXED_FORMAT ? mixedLabel : stats.format}
    </Badge>
  );
}

/** Thin bar of the share of tracks heard at least once; nothing for an album that was never played. */
function AlbumProgress({ stats, label, className }: { stats: AlbumStats; label: string; className?: string }) {
  if (stats.heardCount === 0) return null;
  return <ProgressBar size="sm" tone="pink" value={(stats.heardCount / stats.trackCount) * 100} label={label} className={className} />;
}

/** Album cover as a background, or a disc glyph on a tinted gradient when there is none. */
function AlbumCover({
  album,
  iconSize,
  className,
  children,
}: {
  album: AlbumRecord;
  iconSize: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center border border-line bg-linear-135 from-accent-purple/20 to-accent-cyan/15 bg-cover bg-center',
        className,
      )}
      style={album.cover_path ? { backgroundImage: `url("${album.cover_path}")` } : undefined}
    >
      {!album.cover_path && <Disc size={iconSize} className="text-fg-muted/50" />}
      {children}
    </div>
  );
}

const progressLabelOf = (loc: Translations, stats: AlbumStats) =>
  fmt(loc.library.albumProgressTooltip, String(stats.heardCount), String(stats.trackCount), String(stats.playCount));

/** Compares tiles by value: the stats map is rebuilt on every play count change, its entries are not new data. */
function sameTile(a: AlbumTileProps, b: AlbumTileProps): boolean {
  return (
    a.album === b.album &&
    a.durText === b.durText &&
    a.playback === b.playback &&
    a.loc === b.loc &&
    a.actions === b.actions &&
    a.stats.trackCount === b.stats.trackCount &&
    a.stats.format === b.stats.format &&
    a.stats.hiRes === b.stats.hiRes &&
    a.stats.playCount === b.stats.playCount &&
    a.stats.heardCount === b.stats.heardCount
  );
}

/** Tile of the album grid: cover with format badge and cover matching, details, progress and actions. */
export const AlbumTile = React.memo(function AlbumTile({
  album,
  stats,
  durText,
  playback,
  loc,
  actions,
  size,
}: AlbumTileProps & { size: AlbumTileSize }) {
  const compact = size === 'compact';
  const current = playback !== null;
  return (
    <Card
      interactive={!current}
      padding="none"
      aria-current={current ? 'true' : undefined}
      title={progressLabelOf(loc, stats)}
      className={cn(
        'flex cursor-pointer flex-col rounded-2xl',
        compact ? 'gap-2 p-2.5' : 'gap-2.5 p-3.5',
        TILE_MAX_WIDTH[size],
        OFFSCREEN_SKIP,
        PLAYING_CARD,
      )}
      onClick={() => actions.open(album)}
    >
      <AlbumCover album={album} iconSize={compact ? 36 : 46} className="aspect-square w-full overflow-hidden rounded-xl">
        <AlbumFormatBadge stats={stats} mixedLabel={loc.library.albumFormatMixed} className="absolute top-1.5 left-1.5 bg-black/75" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            actions.coverPicker(album);
          }}
          title={loc.covers.matchCoverTitle}
          className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-sm bg-black/75 px-1.5 py-0.5 text-2xs font-semibold text-accent-pink"
        >
          <Sparkles size={10} /> {loc.covers.matchCover}
        </button>
      </AlbumCover>

      <div className="flex-1">
        <h4 className={cn('line-clamp-2 leading-tight font-bold text-fg', compact ? 'text-ui' : 'text-sm')} title={album.title}>
          {current && <NowPlayingMark playing={playback === 'playing'} />} {album.title}
        </h4>
        <p className="mt-1 truncate text-xs text-fg-secondary">
          {album.album_artist} {album.year ? `(${album.year})` : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="cyan">
            {stats.trackCount} {loc.library.tracks}
          </Badge>
          {durText && <span className="text-xxs text-fg-muted">{durText}</span>}
          {album.release_mbid && (
            <Badge size="xs" mono>
              MBID
            </Badge>
          )}
        </div>
        <AlbumProgress stats={stats} label={progressLabelOf(loc, stats)} className="mt-2" />
      </div>

      {/* Actions; clicks here do not open the album */}
      <div className="mt-auto flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button variant="tinted" tone="pink" size="sm" onClick={() => actions.play(album)} className="min-w-0 flex-1">
          {loc.player.play}
        </Button>
        <IconButton variant="secondary" size="sm" label={loc.library.addToQueue} onClick={() => actions.queue(album)} className="text-accent-cyan">
          <Plus size={13} />
        </IconButton>
        <IconButton variant="secondary" size="sm" label="MusicBrainz" onClick={() => actions.musicBrainz(album)}>
          <Search size={12} />
        </IconButton>
      </div>
    </Card>
  );
}, (a, b) => a.size === b.size && sameTile(a, b));

/** Row of the album list: small cover, title and format, progress, counts and actions. */
export const AlbumRow = React.memo(function AlbumRow({ album, stats, durText, playback, loc, actions }: AlbumTileProps) {
  const current = playback !== null;
  return (
    <Card
      interactive={!current}
      padding="none"
      aria-current={current ? 'true' : undefined}
      className={cn('flex cursor-pointer items-center gap-4 px-4 py-2.5', ROW_OFFSCREEN_SKIP, PLAYING_CARD)}
      onClick={() => actions.open(album)}
    >
      <AlbumCover album={album} iconSize={24} className="size-13 shrink-0 rounded-lg" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {current && <NowPlayingMark playing={playback === 'playing'} />}
          <span className="truncate text-md font-bold text-fg">{album.title}</span>
          {album.year && <span className="text-xs font-semibold text-fg-muted">({album.year})</span>}
          <AlbumFormatBadge stats={stats} mixedLabel={loc.library.albumFormatMixed} />
          {album.release_mbid && (
            <Badge tone="cyan" size="xs" mono>
              MBID
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-ui text-fg-secondary">{album.album_artist}</p>
        <AlbumProgress stats={stats} label={progressLabelOf(loc, stats)} className="mt-1.5 max-w-60" />
      </div>

      <div className="flex shrink-0 items-center gap-2.5" title={progressLabelOf(loc, stats)}>
        <Badge tone="cyan">
          {stats.trackCount} {loc.library.tracks}
        </Badge>
        {durText && (
          <span className="flex items-center gap-1 text-xs text-fg-muted">
            <Clock size={11} /> {durText}
          </span>
        )}
      </div>

      {/* Actions; clicks here do not open the album */}
      <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button variant="tinted" tone="pink" size="sm" onClick={() => actions.play(album)}>
          {loc.player.play}
        </Button>
        <IconButton variant="secondary" size="sm" label={loc.library.addToQueue} onClick={() => actions.queue(album)} className="text-accent-cyan">
          <Plus size={13} />
        </IconButton>
        <IconButton variant="secondary" size="sm" label={loc.covers.matchCover} title={loc.covers.matchCoverTitle} onClick={() => actions.coverPicker(album)} className="text-accent-pink">
          <Sparkles size={12} />
        </IconButton>
        <IconButton variant="secondary" size="sm" label="MusicBrainz" onClick={() => actions.musicBrainz(album)}>
          <Search size={12} />
        </IconButton>
      </div>
    </Card>
  );
}, sameTile);
