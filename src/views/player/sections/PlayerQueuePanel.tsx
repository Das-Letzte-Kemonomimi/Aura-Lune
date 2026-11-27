import React from 'react';
import { BookmarkPlus, ChevronDown, ChevronUp, Disc, FolderOpen, Image as ImageIcon, Infinity as InfinityIcon, ListMusic, Music, Play, Plus, Repeat, Repeat1, RotateCcw, Search, Settings, Shuffle, SlidersHorizontal, Square, Trash2, X, Zap } from '../../../components/ui/icons';
import type { PlaybackStatus } from '../../../types/player';
import { type QueueItem, type QueueColumnConfig, getQueueGridTemplate } from '../../../types/queue';
import type { PlayerViewProps } from '../PlayerView';
import type { QueueTrackMeta } from '../queueTrackMeta';
import { cn } from '../../../utils/cn';
import { useQueueVirtualScroll } from '../../../hooks/useQueueVirtualScroll';
import { Badge, Button, Card, Chip, EmptyState, IconButton, Popover, SectionHeader, TextField } from '../../../components/ui';
export type PlayerQueuePanelProps = Pick<PlayerViewProps, 'loc' | 'queue' | 'handleCycleLoopMode' | 'handleToggleShuffle' | 'handleToggleInfinityQueue' | 'infinityQueue' | 'handleToggleStopAfterCurrent' | 'queueSearchQuery' | 'setQueueSearchQuery' | 'setIsColumnConfigOpen' | 'isColumnConfigOpen' | 'queueColumns' | 'toggleQueueColumn' | 'resetQueueColumns' | 'handlePickFiles' | 'setIsSaveQueueModalOpen' | 'handleClearQueue' | 'setActiveTab' | 'dragOverQueueIdx' | 'handleQueueDragStart' | 'handleQueueDragOver' | 'handleQueueDrop' | 'handlePlayQueueIndex' | 'draggedQueueIdx' | 'handleOpenCoverPicker' | 'handleUploadCustomCoverDirect' | 'handleOpenContainingFolder' | 'formatTime' | 'handleMoveQueueItem' | 'handleRemoveFromQueue' | 'mainContentRef'> & {
  status: PlaybackStatus;
  t: PlayerViewProps['loc'];
  getQueueTrackMeta: (item: QueueItem) => QueueTrackMeta;
};

type Loc = PlayerViewProps['loc'];

/** The toggles of the column popover, in display order. */
const QUEUE_COLUMN_OPTIONS: readonly { key: keyof QueueColumnConfig; label: (t: Loc) => string }[] = [
  { key: 'showIndex', label: (t) => t.queue.colIndex },
  { key: 'showCover', label: (t) => t.queue.colCover },
  { key: 'showArtist', label: (t) => t.queue.colArtist },
  { key: 'showAlbum', label: (t) => t.queue.colAlbum },
  { key: 'showFormatBadge', label: (t) => t.queue.colFormat },
  { key: 'showDuration', label: (t) => t.queue.colDuration },
  { key: 'showPath', label: (t) => t.queue.colPath },
  { key: 'compactMode', label: (t) => t.queue.compactMode },
];

// Memo: the queue does not depend on the playback position, so it does not render on every status frame.
export const PlayerQueuePanel: React.FC<PlayerQueuePanelProps> = React.memo(({
  dragOverQueueIdx,
  draggedQueueIdx,
  formatTime,
  getQueueTrackMeta,
  handleClearQueue,
  handleCycleLoopMode,
  handleMoveQueueItem,
  handleOpenContainingFolder,
  handleOpenCoverPicker,
  handlePickFiles,
  handlePlayQueueIndex,
  handleQueueDragOver,
  handleQueueDragStart,
  handleQueueDrop,
  handleRemoveFromQueue,
  handleToggleInfinityQueue,
  handleToggleShuffle,
  handleToggleStopAfterCurrent,
  handleUploadCustomCoverDirect,
  infinityQueue,
  isColumnConfigOpen,
  loc,
  mainContentRef,
  queue,
  queueColumns,
  queueSearchQuery,
  resetQueueColumns,
  setActiveTab,
  setIsColumnConfigOpen,
  setIsSaveQueueModalOpen,
  setQueueSearchQuery,
  status,
  t,
  toggleQueueColumn,
}) => {
  const {
    queueListRef,
    totalQueueDurationMs,
    formatTotalDuration,
    filteredQueueItems,
    queueStartIndex,
    queueEndIndex,
    queueTopSpacer,
    queueBottomSpacer,
  } = useQueueVirtualScroll({
    items: queue.items,
    searchQuery: queueSearchQuery,
    compactMode: queueColumns.compactMode,
    containerRef: mainContentRef,
    loc,
  });

  const closeColumnConfig = () => setIsColumnConfigOpen(false);
  const loopLabel = queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue;
  const countLabel = queue.items.length === 1
    ? loc.queue.itemSingle
    : queue.items.length >= 2 && queue.items.length <= 4
      ? loc.queue.itemFew
      : loc.queue.itemMany;
  return (
    <Card variant="panel" className="relative flex flex-col gap-4">
      {/* Queue header: title and totals, then the play-mode rail with search and view options */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-accent-pink/30 bg-linear-135 from-accent-pink/25 to-accent-purple/20 text-accent-pink">
            <ListMusic size={22} />
          </span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg leading-tight font-extrabold text-fg">
              {loc.queue.title}
              <Badge tone="pink">{queue.items.length} {countLabel}</Badge>
              {queue.items.length > 0 && (
                <span className="rounded-full border border-line bg-black/25 px-2 py-0.5 font-mono text-xs font-semibold text-fg-secondary">
                  {formatTotalDuration(totalQueueDurationMs)}
                </span>
              )}
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted">{loc.queue.dragHint}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pick and add tracks through the system dialog (Dolphin / zenity) */}
          <Button variant="tinted" tone="cyan" size="sm" onClick={handlePickFiles} title={t.queue.addTracksTooltip} className="rounded-xl">
            <Plus size={14} />
            {t.queue.addTracks}
          </Button>
          {queue.items.length > 0 && (
            <>
              <Button variant="tinted" tone="purple" size="sm" onClick={() => setIsSaveQueueModalOpen(true)} title={loc.queue.saveAsPlaylistTitle} className="rounded-xl">
                <BookmarkPlus size={14} />
                {loc.queue.saveAsPlaylist}
              </Button>
              <Button variant="danger" size="sm" onClick={handleClearQueue} title={t.queue.clearTooltip} className="rounded-xl">
                <Trash2 size={14} />
                {t.queue.clear}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-black/20 p-1.5">
        <div role="group" aria-label={loc.shortcuts.loop} className="flex flex-wrap items-center gap-1">
          <Chip className="rounded-xl" pressed={queue.loop_mode !== 'None'} onClick={handleCycleLoopMode} title={`${loc.shortcuts.loop}: ${loopLabel}`}>
            {queue.loop_mode === 'Track' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            {loopLabel}
          </Chip>
          <Chip
            className="rounded-xl"
            tone="cyan"
            pressed={queue.shuffle}
            onClick={handleToggleShuffle}
            title={`${loc.shortcuts.shuffle}: ${queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}`}
          >
            <Shuffle size={14} />
            {queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}
          </Chip>
          <Chip className="rounded-xl" pressed={infinityQueue} onClick={handleToggleInfinityQueue} title={loc.queue.autoDjHint}>
            <InfinityIcon size={14} />
            {loc.queue.autoDj}
          </Chip>
          <Chip
            className="rounded-xl"
            tone="amber"
            pressed={Boolean(status.stop_after_current)}
            onClick={handleToggleStopAfterCurrent}
            title={loc.player.stopAfterCurrentTooltip}
          >
            <Square size={13} fill={status.stop_after_current ? 'currentColor' : 'none'} />
            {loc.queue.stopAfterTrack}
          </Chip>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {queue.items.length > 0 && (
            <div className="relative w-52">
              <TextField
                size="sm"
                icon={<Search size={13} />}
                aria-label={loc.queue.search}
                placeholder={loc.queue.search}
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                className="pr-7"
              />
              {queueSearchQuery && (
                <IconButton
                  size="sm"
                  label={loc.common.clear}
                  onClick={() => setQueueSearchQuery('')}
                  className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2"
                >
                  <X size={12} />
                </IconButton>
              )}
            </div>
          )}

          {/* Column configuration */}
          <Popover
            open={isColumnConfigOpen}
            onClose={closeColumnConfig}
            role="dialog"
            label={t.queue.customizeTitle}
            align="end"
            className="w-80 gap-3 p-4"
            trigger={
              <Chip
                className="rounded-xl"
                tone="purple"
                pressed={isColumnConfigOpen}
                onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal size={14} />
                {loc.queue.customizeView}
              </Chip>
            }
          >
            <SectionHeader
              icon={<Settings size={15} />}
              title={t.queue.customizeTitle}
              description={t.queue.customizeDesc}
              actions={
                <IconButton size="sm" label={loc.common.close} onClick={closeColumnConfig}>
                  <X size={15} />
                </IconButton>
              }
            />
            <div className="flex flex-col gap-1">
              {QUEUE_COLUMN_OPTIONS.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent px-2.5 py-2 text-ui text-fg-muted hover:bg-white/5 has-checked:border-accent-purple/35 has-checked:bg-accent-purple/15 has-checked:text-fg"
                >
                  {col.label(t)}
                  <input
                    type="checkbox"
                    checked={queueColumns[col.key]}
                    onChange={() => toggleQueueColumn(col.key)}
                    className="accent-accent-purple"
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <Button variant="ghost" size="sm" onClick={resetQueueColumns}>
                <RotateCcw size={12} /> {t.queue.resetDefaults}
              </Button>
              <Button variant="tinted" tone="purple" size="sm" onClick={closeColumnConfig}>
                {t.queue.done}
              </Button>
            </div>
          </Popover>
        </div>
      </div>

      {/* Queue content: track table or empty state */}
      {queue.items.length === 0 ? (
        <EmptyState
          icon={<ListMusic size={26} className="text-accent-pink" />}
          title={t.queue.empty}
          description={t.queue.emptyHint}
          className="rounded-2xl border-2 border-dashed border-line bg-black/15 py-12"
          action={
            <div className="mt-1.5 flex gap-2.5">
              <Button variant="primary" onClick={() => setActiveTab('library')}>
                <Music size={15} />
                {t.queue.browseLibrary}
              </Button>
              <Button onClick={handlePickFiles}>
                <FolderOpen size={15} />
                {t.queue.pickFromDisk}
              </Button>
            </div>
          }
        />
      ) : (
        <div ref={queueListRef} className="flex flex-col gap-1.5">
          {/* Column header bar */}
          <div
            className="sticky top-0 z-10 grid items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold tracking-wider text-fg-muted uppercase"
            style={{ gridTemplateColumns: getQueueGridTemplate(queueColumns) }}
          >
            {queueColumns.showIndex && <span className="w-7 text-center">{t.queue.headerIndex}</span>}
            {queueColumns.showCover && (
              <span
                className={cn(
                  'flex items-center justify-center',
                  queueColumns.compactMode ? 'w-9.5' : 'w-14',
                )}
                title={t.queue.headerCover}
              >
                <ImageIcon size={14} className="opacity-70" />
              </span>
            )}
            <span>{t.queue.headerTitleArtist}</span>
            {queueColumns.showAlbum && <span>{t.queue.headerAlbum}</span>}
            {queueColumns.showFormatBadge && <span>{t.queue.headerQuality}</span>}
            {queueColumns.showPath && <span>{t.queue.headerPath}</span>}
            {queueColumns.showDuration && <span className="text-right">{t.queue.headerTime}</span>}
            <span className="pr-1.5 text-right">{t.queue.headerActions}</span>
          </div>

          {/* Track rows */}
          {filteredQueueItems.length === 0 && queueSearchQuery ? (
            <div className="p-9 text-center text-sm text-fg-muted">
              {t.queue.noMatch.replace('{q}', queueSearchQuery)}
            </div>
          ) : (
            <>
              {queueTopSpacer > 0 && <div className="pointer-events-none"
              style={{ height: `${queueTopSpacer}px` }} />}
              {filteredQueueItems.slice(queueStartIndex, queueEndIndex).map(({ it: item, originalIdx: idx }) => {
                const isCurrent = idx === queue.current_index;
                const isPlaying = isCurrent && status.state === 'Playing';
                const meta = getQueueTrackMeta(item);
                const isDragOver = dragOverQueueIdx === idx;

                const path = item.uri.replace(/^file:\/\//, '');

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleQueueDragStart(idx, e)}
                    onDragOver={(e) => handleQueueDragOver(idx, e)}
                    onDrop={(e) => handleQueueDrop(idx, e)}
                    onClick={() => handlePlayQueueIndex(idx, item)}
                    onDoubleClick={() => handlePlayQueueIndex(idx, item)}
                    className={cn(
                      'group grid cursor-pointer items-center gap-3 rounded-2xl border hover:border-line-accent hover:bg-surface-hover',
                      queueColumns.compactMode ? 'px-3 py-1.5' : 'px-3.5 py-2',
                      draggedQueueIdx === idx && 'opacity-35',
                      isCurrent
                        ? 'border-accent-pink bg-linear-to-r from-accent-pink/25 via-accent-purple/10 to-transparent shadow-halo-lg shadow-accent-pink/25'
                        : isDragOver
                          ? 'border-accent-purple bg-accent-purple/10'
                          : 'border-line bg-white/2',
                    )}
                    style={{ gridTemplateColumns: getQueueGridTemplate(queueColumns) }}
                  >
                    {/* Position number / playing indicator */}
                    {queueColumns.showIndex && (
                      <div className={cn('w-7 text-center font-mono text-ui', isCurrent ? 'font-bold text-accent-pink' : 'font-semibold text-fg-secondary')}>
                        {isPlaying ? <Zap size={16} className="text-accent-pink" /> : idx + 1}
                      </div>
                    )}

                    {/* Cover thumbnail (click to open the cover picker) */}
                    {queueColumns.showCover && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (meta.album) {
                            handleOpenCoverPicker(meta.album);
                          } else {
                            handleUploadCustomCoverDirect(null);
                          }
                        }}
                        aria-label={loc.covers.matchCoverTitle}
                        title={loc.covers.matchCoverTitle}
                        className={cn(
                          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-linear-135 from-accent-pink/30 to-accent-purple/30 p-0',
                          isCurrent ? 'border-accent-pink/60' : 'border-line',
                          queueColumns.compactMode ? 'size-9.5' : 'size-14',
                        )}
                        style={meta.cover ? { background: `url("${meta.cover}") center/cover no-repeat` } : undefined}
                      >
                        {!meta.cover && <Disc size={queueColumns.compactMode ? 16 : 24} className="text-fg-muted" />}
                        {isCurrent && (
                          <span className="absolute inset-0 grid place-items-center bg-black/55 text-accent-pink">
                            {isPlaying ? <Zap size={queueColumns.compactMode ? 14 : 20} /> : <Play size={queueColumns.compactMode ? 13 : 18} />}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Title and artist */}
                    <div className="min-w-0 overflow-hidden">
                      <p className={cn('truncate text-fg', queueColumns.compactMode ? 'text-ui' : 'text-sm', isCurrent ? 'font-bold' : 'font-semibold')}>
                        {item.title}
                      </p>
                      {queueColumns.showArtist && (
                        <p className={cn('mt-0.5 truncate text-xs', isCurrent ? 'text-accent-cyan' : 'text-fg-muted')}>
                          {item.artist || t.player.unknownArtist}
                        </p>
                      )}
                    </div>

                    {queueColumns.showAlbum && (
                      <span className="truncate text-ui text-fg-secondary">{meta.album?.title || item.album || '—'}</span>
                    )}

                    {queueColumns.showFormatBadge && (
                      <div>
                        <Badge mono size="xs" tone={meta.format.includes('FLAC') || meta.format.includes('WAV') ? 'cyan' : 'purple'}>
                          {meta.format} {meta.bitDepth ? `${meta.bitDepth}b` : ''}
                        </Badge>
                      </div>
                    )}

                    {/* File path (click to open the folder) */}
                    {queueColumns.showPath && (
                      <span
                        title={`${path} • ${loc.queue.openContainingFolder}`}
                        onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                        className="cursor-pointer truncate font-mono text-xs text-fg-muted underline decoration-line decoration-dotted hover:text-accent-cyan"
                      >
                        {path}
                      </span>
                    )}

                    {queueColumns.showDuration && (
                      <span className={cn('text-right font-mono text-xs', isCurrent ? 'font-bold text-accent-pink' : 'font-semibold text-fg-secondary')}>
                        {formatTime(item.duration_ms)}
                      </span>
                    )}

                    {/* Actions */}
                    <div className={cn('flex min-w-34 items-center justify-end gap-1 transition-opacity focus-within:opacity-100 group-hover:opacity-100', !isCurrent && 'opacity-55')}>
                      {!isCurrent && (
                        <IconButton
                          size="sm"
                          label={loc.queue.playThis}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayQueueIndex(idx, item);
                          }}
                        >
                          <Play size={14} />
                        </IconButton>
                      )}
                      <IconButton size="sm" label={loc.queue.moveUp} disabled={idx === 0} onClick={(e) => handleMoveQueueItem(idx, idx - 1, e)}>
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={loc.queue.moveDown}
                        disabled={idx === queue.items.length - 1}
                        onClick={(e) => handleMoveQueueItem(idx, idx + 1, e)}
                      >
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton size="sm" label={loc.queue.openContainingFolder} onClick={(e) => handleOpenContainingFolder(item.uri, e)} className="hover:text-accent-cyan">
                        <FolderOpen size={14} />
                      </IconButton>
                      <IconButton size="sm" label={loc.queue.remove} onClick={(e) => handleRemoveFromQueue(item.id, e)} className="text-accent-red/70 hover:text-accent-red">
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
              {queueBottomSpacer > 0 && <div className="pointer-events-none"
              style={{ height: `${queueBottomSpacer}px` }} />}
            </>
          )}
        </div>
      )}
    </Card>
  );
});
