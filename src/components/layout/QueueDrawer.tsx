import React from 'react';
import {
  ListMusic,
  Infinity as InfinityIcon,
  Trash2,
  X,
  Music,
  Zap,
  ChevronUp,
  ChevronDown,
} from '../ui/icons';
import { type Translations } from '../../i18n';
import { type PlaybackQueue, type QueueItem } from '../../types/queue';
import { type PlaybackStatus } from '../../types/player';
import { Button, Chip, EmptyState, IconButton } from '../ui';

export interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: PlaybackQueue;
  status: PlaybackStatus;
  infinityQueue: boolean;
  onToggleInfinityQueue: () => void;
  onClearQueue: () => void;
  onPlayQueueIndex: (index: number, item: QueueItem) => void;
  onMoveQueueItem: (fromIndex: number, toIndex: number, e: React.MouseEvent) => void;
  onRemoveFromQueue: (itemId: string, e: React.MouseEvent) => void;
  formatTime: (ms: number) => string;
  loc: Translations;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  status,
  infinityQueue,
  onToggleInfinityQueue,
  onClearQueue,
  onPlayQueueIndex,
  onMoveQueueItem,
  onRemoveFromQueue,
  formatTime,
  loc,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-105 max-w-[90vw] flex-col border-l border-line-accent bg-modal shadow-drawer">
      {/* Drawer header */}
      <div className="flex items-center justify-between border-b border-line p-5">
        <div className="flex items-center gap-2.5">
          <ListMusic size={22} className="text-accent-pink" />
          <div>
            <h3 className="text-lg font-bold">{loc.queue.title}</h3>
            <span className="text-xs text-fg-muted">
              {queue.items.length} {loc.library.tracks} •{' '}
              {queue.loop_mode !== 'None' ? `${loc.shortcuts.loop}: ${queue.loop_mode}` : loc.player.loopOff}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip pressed={infinityQueue} onClick={onToggleInfinityQueue} title={loc.queue.autoDjHint}>
            <InfinityIcon size={14} />
            {loc.queue.autoDj}
          </Chip>
          {queue.items.length > 0 && (
            <Button variant="danger" size="sm" onClick={onClearQueue}>
              <Trash2 size={14} /> {loc.queue.clear}
            </Button>
          )}
          <IconButton label={loc.common.close} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
      </div>

      {/* Queue item list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {queue.items.length === 0 ? (
          <EmptyState icon={<Music size={24} />} title={loc.queue.empty} description={loc.queue.emptyHint} className="py-15" />
        ) : (
          queue.items.map((item, idx) => {
            const isCurrent = idx === queue.current_index;
            return (
              <div
                key={item.id}
                onClick={() => onPlayQueueIndex(idx, item)}
                aria-current={isCurrent ? 'true' : undefined}
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white/5 px-3.5 py-3 not-aria-[current=true]:hover:border-line-accent aria-[current=true]:border-accent-pink aria-[current=true]:bg-accent-pink/15 aria-[current=true]:shadow-halo-lg aria-[current=true]:shadow-accent-pink/25"
              >
                <div className="w-6 text-center text-ui text-fg-muted group-aria-[current=true]:font-bold group-aria-[current=true]:text-accent-pink">
                  {isCurrent && status.state === 'Playing' ? <Zap size={16} /> : idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{item.title}</p>
                  <p className="truncate text-xs text-fg-muted group-aria-[current=true]:text-accent-cyan">
                    {item.artist} {item.album ? `• ${item.album}` : ''}
                  </p>
                </div>

                <span className="font-mono text-xs text-fg-muted">{formatTime(item.duration_ms || 0)}</span>

                <div className="flex items-center gap-1">
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
