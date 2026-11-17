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
} from 'lucide-react';
import { type Translations } from '../../i18n';
import { type PlaybackQueue, type QueueItem } from '../../types/queue';
import { type PlaybackStatus } from '../../types/player';

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '90vw',
        background: 'rgba(15, 12, 28, 0.98)',
        borderLeft: '1px solid var(--border-accent)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Nagłówek szuflady */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ListMusic size={22} color="var(--accent-pink)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{loc.queue.title}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {queue.items.length} {loc.library.tracks} •{' '}
              {queue.loop_mode !== 'None' ? `${loc.shortcuts.loop}: ${queue.loop_mode}` : loc.player.loopOff}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onToggleInfinityQueue}
            title={loc.queue.autoDjHint}
            className="glass-card"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: infinityQueue ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${infinityQueue ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
              color: infinityQueue ? 'var(--accent-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: '8px',
            }}
          >
            <InfinityIcon size={14} />
            <span>Auto-DJ</span>
          </button>

          {queue.items.length > 0 && (
            <button
              onClick={onClearQueue}
              title={loc.queue.clear}
              className="glass-card"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                color: '#ff6b81',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Trash2 size={14} /> {loc.queue.clear}
            </button>
          )}
          <button
            onClick={onClose}
            title={loc.common.close}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Lista pozycji w kolejce */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {queue.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Music size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '0.9rem', margin: 0 }}>{loc.queue.empty}</p>
            <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.7 }}>
              {loc.queue.emptyHint}
            </p>
          </div>
        ) : (
          queue.items.map((item, idx) => {
            const isCurrent = idx === queue.current_index;
            return (
              <div
                key={item.id}
                onClick={() => onPlayQueueIndex(idx, item)}
                className="glass-card"
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  background: isCurrent ? 'rgba(255, 77, 148, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: isCurrent
                    ? '1px solid var(--accent-pink)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isCurrent ? '0 0 16px rgba(255, 77, 148, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    textAlign: 'center',
                    color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {isCurrent && status.state === 'Playing' ? (
                    <Zap size={16} color="var(--accent-pink)" />
                  ) : (
                    idx + 1
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: isCurrent ? '#fff' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.75rem',
                      color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.artist} {item.album ? `• ${item.album}` : ''}
                  </p>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {formatTime(item.duration_ms || 0)}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    disabled={idx === 0}
                    onClick={(e) => onMoveQueueItem(idx, idx - 1, e)}
                    title={loc.queue.moveUp}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                      cursor: idx === 0 ? 'default' : 'pointer',
                      padding: '4px',
                    }}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    disabled={idx === queue.items.length - 1}
                    onClick={(e) => onMoveQueueItem(idx, idx + 1, e)}
                    title={loc.queue.moveDown}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color:
                        idx === queue.items.length - 1
                          ? 'rgba(255,255,255,0.1)'
                          : 'var(--text-muted)',
                      cursor: idx === queue.items.length - 1 ? 'default' : 'pointer',
                      padding: '4px',
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={(e) => onRemoveFromQueue(item.id, e)}
                    title={loc.queue.remove}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
