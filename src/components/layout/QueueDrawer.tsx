import React, { useMemo } from 'react';
import {
  ListMusic,
  Infinity as InfinityIcon,
  Trash2,
  X,
  Music,
  Zap,
  Play,
  Disc,
  ChevronUp,
  ChevronDown,
} from '../ui/icons';
import { type Translations } from '../../i18n';
import { type PlaybackQueue, type QueueItem } from '../../types/queue';
import { type AlbumRecord, type PlaybackStatus, type TrackRecord } from '../../types/player';
import { resolveQueueTrackMeta } from '../../views/player/queueTrackMeta';
import { cn } from '../../utils/cn';
import { Badge, Button, Chip, EmptyState, IconButton } from '../ui';

export interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: PlaybackQueue;
  status: PlaybackStatus;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  infinityQueue: boolean;
  onToggleInfinityQueue: () => void;
  onClearQueue: () => void;
  onPlayQueueIndex: (index: number, item: QueueItem) => void;
  onMoveQueueItem: (fromIndex: number, toIndex: number, e: React.MouseEvent) => void;
  onRemoveFromQueue: (itemId: string, e: React.MouseEvent) => void;
  formatTime: (ms: number) => string;
  loc: Translations;
}

/** Library data (cover, format) of every queue item; only the queued tracks are searched, so it stays cheap for big libraries. */
function useQueueMetas(queue: PlaybackQueue, tracks: TrackRecord[], albums: AlbumRecord[], enabled: boolean) {
  return useMemo(() => {
    if (!enabled) return [];
    const ids = new Set<number>();
    const uris = new Set<string>();
    for (const item of queue.items) {
      if (item.track_id != null) ids.add(item.track_id);
      uris.add(item.uri);
    }
    const queued = tracks.filter((t) => ids.has(t.id) || uris.has(t.path));
    return queue.items.map((item) => resolveQueueTrackMeta(item, queued, albums));
  }, [enabled, queue.items, tracks, albums]);
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  status,
  tracks,
  albums,
  infinityQueue,
  onToggleInfinityQueue,
  onClearQueue,
  onPlayQueueIndex,
  onMoveQueueItem,
  onRemoveFromQueue,
  formatTime,
  loc,
}) => {
  const metas = useQueueMetas(queue, tracks, albums, isOpen);
  if (!isOpen) return null;

  const totalMs = queue.items.reduce((sum, item) => sum + (item.duration_ms || 0), 0);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-105 max-w-[90vw] flex-col border-l border-line-accent bg-modal shadow-drawer">
      {/* Drawer header */}
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-accent-pink/30 bg-linear-135 from-accent-pink/25 to-accent-purple/20 text-accent-pink">
              <ListMusic size={22} />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg leading-tight font-extrabold">{loc.queue.title}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                <Badge tone="pink">
                  {queue.items.length} {loc.library.tracks}
                </Badge>
                {queue.items.length > 0 && <span className="font-mono">{formatTime(totalMs)}</span>}
                <span>• {queue.loop_mode !== 'None' ? `${loc.shortcuts.loop}: ${queue.loop_mode}` : loc.player.loopOff}</span>
              </p>
            </div>
          </div>
          <IconButton label={loc.common.close} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-line bg-black/20 p-1.5">
          <Chip className="rounded-xl" pressed={infinityQueue} onClick={onToggleInfinityQueue} title={loc.queue.autoDjHint}>
            <InfinityIcon size={14} />
            {loc.queue.autoDj}
          </Chip>
          {queue.items.length > 0 && (
            <Button variant="danger" size="sm" onClick={onClearQueue} className="ml-auto rounded-xl">
              <Trash2 size={14} /> {loc.queue.clear}
            </Button>
          )}
        </div>
      </div>

      {/* Queue item list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {queue.items.length === 0 ? (
          <EmptyState icon={<Music size={24} />} title={loc.queue.empty} description={loc.queue.emptyHint} className="py-15" />
        ) : (
          queue.items.map((item, idx) => {
            const isCurrent = idx === queue.current_index;
            const isPlaying = isCurrent && status.state === 'Playing';
            const meta = metas[idx];
            return (
              <div
                key={item.id}
                onClick={() => onPlayQueueIndex(idx, item)}
                aria-current={isCurrent ? 'true' : undefined}
                className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white/5 p-2.5 not-aria-[current=true]:hover:border-line-accent aria-[current=true]:border-accent-pink aria-[current=true]:bg-linear-to-r aria-[current=true]:from-accent-pink/25 aria-[current=true]:via-accent-purple/10 aria-[current=true]:to-transparent aria-[current=true]:shadow-halo-lg aria-[current=true]:shadow-accent-pink/25"
              >
                {/* Cover with position; the current track shows its play state over the art */}
                <div
                  className={cn(
                    'relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-linear-135 from-accent-pink/30 to-accent-purple/30',
                    isCurrent ? 'border-accent-pink/60' : 'border-line',
                  )}
                  style={meta?.cover ? { background: `url("${meta.cover}") center/cover no-repeat` } : undefined}
                >
                  {!meta?.cover && <Disc size={24} className="text-fg-muted" />}
                  {isCurrent ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/55 text-accent-pink">
                      {isPlaying ? <Zap size={20} /> : <Play size={18} />}
                    </span>
                  ) : (
                    <span className="absolute top-0.5 left-0.5 rounded-md bg-black/85 px-1.5 py-px font-mono text-xs font-bold text-fg shadow-sm ring-1 ring-white/15">{idx + 1}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm text-fg', isCurrent ? 'font-bold' : 'font-semibold')}>{item.title}</p>
                  <p className="truncate text-xs text-fg-muted group-aria-[current=true]:text-accent-cyan">
                    {item.artist || loc.player.unknownArtist} {item.album ? `• ${item.album}` : ''}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {meta && (
                      <Badge mono size="xs" tone={/FLAC|WAV/i.test(meta.format) ? 'cyan' : 'purple'}>
                        {meta.format}
                        {meta.bitDepth ? ` ${meta.bitDepth}b` : ''}
                      </Badge>
                    )}
                    <span className="font-mono text-xs text-fg-muted group-aria-[current=true]:text-accent-pink">{formatTime(item.duration_ms || 0)}</span>
                  </div>
                </div>

                {/* Actions: stacked reorder arrows and remove; dimmed until hover or focus */}
                <div className="flex shrink-0 items-center gap-0.5 opacity-55 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <div className="flex flex-col">
                    <IconButton size="sm" label={loc.queue.moveUp} disabled={idx === 0} onClick={(e) => onMoveQueueItem(idx, idx - 1, e)}>
                      <ChevronUp size={16} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      label={loc.queue.moveDown}
                      disabled={idx === queue.items.length - 1}
                      onClick={(e) => onMoveQueueItem(idx, idx + 1, e)}
                    >
                      <ChevronDown size={16} />
                    </IconButton>
                  </div>
                  <IconButton size="sm" label={loc.queue.remove} onClick={(e) => onRemoveFromQueue(item.id, e)} className="hover:text-accent-red">
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
