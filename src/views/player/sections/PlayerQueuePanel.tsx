import React from 'react';
import { BookmarkPlus, Check, ChevronDown, ChevronUp, Disc, FolderOpen, Image as ImageIcon, Infinity as InfinityIcon, ListMusic, Music, Play, Plus, Repeat, Repeat1, RotateCcw, Search, Settings, Shuffle, SlidersHorizontal, Square, Trash2, X, Zap } from 'lucide-react';
import type { PlaybackStatus } from '../../../types/player';
import { type QueueItem, type QueueColumnConfig, getQueueGridTemplate } from '../../../types/queue';
import type { PlayerViewProps } from '../PlayerView';
import type { QueueTrackMeta } from '../queueTrackMeta';
import { cn } from '../../../utils/cn';

export type PlayerQueuePanelProps = Pick<PlayerViewProps, 'loc' | 'queue' | 'formatTotalDuration' | 'totalQueueDurationMs' | 'handleCycleLoopMode' | 'handleToggleShuffle' | 'handleToggleInfinityQueue' | 'infinityQueue' | 'handleToggleStopAfterCurrent' | 'queueSearchQuery' | 'setQueueSearchQuery' | 'setIsColumnConfigOpen' | 'isColumnConfigOpen' | 'queueColumns' | 'toggleQueueColumn' | 'resetQueueColumns' | 'handlePickFiles' | 'setIsSaveQueueModalOpen' | 'handleClearQueue' | 'setActiveTab' | 'queueListRef' | 'filteredQueueItems' | 'queueTopSpacer' | 'queueStartIndex' | 'queueEndIndex' | 'dragOverQueueIdx' | 'handleQueueDragStart' | 'handleQueueDragOver' | 'handleQueueDrop' | 'handlePlayQueueIndex' | 'draggedQueueIdx' | 'handleOpenCoverPicker' | 'handleUploadCustomCoverDirect' | 'handleOpenContainingFolder' | 'formatTime' | 'handleMoveQueueItem' | 'handleRemoveFromQueue' | 'queueBottomSpacer'> & {
  status: PlaybackStatus;
  t: PlayerViewProps['loc'];
  getQueueTrackMeta: (item: QueueItem) => QueueTrackMeta;
};

// Memo: kolejka nie zależy od pozycji odtwarzania — nie renderuje się w każdej klatce statusu.
export const PlayerQueuePanel: React.FC<PlayerQueuePanelProps> = React.memo(({
  dragOverQueueIdx,
  draggedQueueIdx,
  filteredQueueItems,
  formatTime,
  formatTotalDuration,
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
  queue,
  queueBottomSpacer,
  queueColumns,
  queueEndIndex,
  queueListRef,
  queueSearchQuery,
  queueStartIndex,
  queueTopSpacer,
  resetQueueColumns,
  setActiveTab,
  setIsColumnConfigOpen,
  setIsSaveQueueModalOpen,
  setQueueSearchQuery,
  status,
  t,
  toggleQueueColumn,
  totalQueueDurationMs,
}) => (
    <div className="glass-panel relative flex flex-col gap-4 px-6.5 py-5.5">
      {/* Pasek nagłówkowy kolejki */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9.5 w-9.5 items-center justify-center rounded-xl border border-pink-500/40 bg-linear-135 from-pink-500/25 to-accent-purple/25 shadow-halo-lg shadow-pink-500/20"
          >
            <ListMusic size={20} className="text-accent-pink" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="m-0 text-lg font-bold text-fg">
                {loc.queue.title}
              </h3>
              <span
                className="rounded-xl border border-pink-500/30 bg-pink-500/15 px-2 py-0.5 text-xs font-bold text-accent-pink"
              >
                {queue.items.length}{' '}
                {queue.items.length === 1
                  ? loc.queue.itemSingle
                  : queue.items.length >= 2 && queue.items.length <= 4
                    ? loc.queue.itemFew
                    : loc.queue.itemMany}
              </span>
              {queue.items.length > 0 && (
                <span className="font-mono text-xs text-fg-muted">
                  • {formatTotalDuration(totalQueueDurationMs)}
                </span>
              )}
            </div>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-muted">
              {loc.queue.dragHint}
            </p>
          </div>
        </div>

        {/* Przyciski kontroli i dostosowywania */}
        <div className="relative flex items-center gap-2">
          {/* Tryb Pętli Badge Button */}
          <button
            onClick={handleCycleLoopMode}
            title={`${loc.shortcuts.loop}: ${queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}`}
            className={cn(
              'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
              queue.loop_mode !== 'None' ? 'border-accent-pink text-accent-pink' : 'border-line text-fg-muted',
            )}
          >
            {queue.loop_mode === 'Track' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            <span>{queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}</span>
          </button>

          {/* Shuffle Badge Button */}
          <button
            onClick={handleToggleShuffle}
            title={`${loc.shortcuts.shuffle}: ${queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}`}
            className={cn(
              'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
              queue.shuffle ? 'border-accent-cyan text-accent-cyan' : 'border-line text-fg-muted',
            )}
          >
            <Shuffle size={14} />
            <span>{queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}</span>
          </button>

          {/* Infinity Queue / Auto-DJ Button */}
          <button
            onClick={handleToggleInfinityQueue}
            title={loc.queue.autoDjHint}
            className={cn(
              'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
              infinityQueue ? 'border-accent-pink bg-pink-500/20 text-accent-pink' : 'border-line bg-transparent text-fg-muted',
            )}
          >
            <InfinityIcon size={14} />
            <span>Auto-DJ {infinityQueue ? 'ON' : 'OFF'}</span>
          </button>

          {/* Stop After Current Badge Button (foobar2000 classic) */}
          <button
            onClick={handleToggleStopAfterCurrent}
            title={loc.player.stopAfterCurrentTooltip}
            className={cn(
              'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
              status.stop_after_current ? 'border-yellow-500 bg-yellow-500/20 text-yellow-500 shadow-halo-sm shadow-yellow-500/35' : 'border-line bg-transparent text-fg-muted shadow-none',
            )}
          >
            <Square size={13} style={{ fill: status.stop_after_current ? '#eab308' : 'none' }} />
            <span>Stop After Track {status.stop_after_current ? '(ON)' : ''}</span>
          </button>

          {/* Pole wyszukiwania w kolejce */}
          {queue.items.length > 0 && (
            <div className="relative w-45">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
              />
              <input
                type="text"
                placeholder={loc.queue.search}
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-black/45 pl-7 pr-2 py-1.5 text-xs text-fg outline-none"
              />
              {queueSearchQuery && (
                <button
                  onClick={() => setQueueSearchQuery('')}
                  className="absolute right-2 top-1/2 flex -translate-y-1/2 border-0 bg-transparent p-0 text-fg-muted"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Przycisk Konfiguracji Kolumn */}
          <div className="relative">
            <button
              onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
              className={cn(
                'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
                isColumnConfigOpen ? 'border-accent-purple text-accent-purple' : 'border-line text-fg-secondary',
              )}
              title={loc.queue.customizeView}
            >
              <SlidersHorizontal size={14} />
              <span>{loc.queue.customizeView}</span>
            </button>

            {/* Popover Konfiguracji Kolumn */}
            {isColumnConfigOpen && (
              <div
                className="glass-panel absolute top-full right-0 z-20 mt-2 w-80 rounded-2xl border border-line-accent bg-surface p-4 shadow-2xl shadow-black/75"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Settings size={15} className="text-accent-purple" />
                    <span className="text-sm font-bold text-fg">{t.queue.customizeTitle}</span>
                  </div>
                  <button
                    onClick={() => setIsColumnConfigOpen(false)}
                    className="flex border-0 bg-transparent text-fg-muted"
                  >
                    <X size={15} />
                  </button>
                </div>

                <p className="mx-0 mt-0 mb-3 text-xs leading-snug text-fg-secondary">
                  {t.queue.customizeDesc}
                </p>

                <div className="flex flex-col gap-1.5">
                  {[
                    { key: 'showIndex', label: t.queue.colIndex },
                    { key: 'showCover', label: t.queue.colCover },
                    { key: 'showArtist', label: t.queue.colArtist },
                    { key: 'showAlbum', label: t.queue.colAlbum },
                    { key: 'showFormatBadge', label: t.queue.colFormat },
                    { key: 'showDuration', label: t.queue.colDuration },
                    { key: 'showPath', label: t.queue.colPath },
                    { key: 'compactMode', label: t.queue.compactMode },
                  ].map((col) => {
                    const active = queueColumns[col.key as keyof QueueColumnConfig];
                    return (
                      <div
                        key={col.key}
                        onClick={() => toggleQueueColumn(col.key as keyof QueueColumnConfig)}
                        className={cn(
                          'flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2',
                          active ? 'border-accent-purple/30 bg-accent-purple/10' : 'border-transparent bg-white/2',
                        )}
                      >
                        <span className={cn('text-ui', active ? 'text-fg' : 'text-fg-muted')}>{col.label}</span>
                        <div
                          className={cn(
                            'flex h-4.5 w-4.5 items-center justify-center rounded-sm border',
                            active ? 'border-accent-purple bg-accent-purple' : 'border-line bg-transparent',
                          )}
                        >
                          {active && <Check size={12} className="text-fg" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-line pt-2.5">
                  <button
                    onClick={resetQueueColumns}
                    className="flex items-center gap-1 border-0 bg-transparent text-xs text-fg-muted"
                  >
                    <RotateCcw size={12} /> {t.queue.resetDefaults}
                  </button>
                  <button
                    onClick={() => setIsColumnConfigOpen(false)}
                    className="rounded-md border-0 bg-accent-purple px-3 py-1 text-xs font-semibold text-on-accent"
                  >
                    {t.queue.done}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Przycisk Wybierz i dodaj utwory przez systemowy dialog (Dolphin / zenity) */}
          <button
            onClick={handlePickFiles}
            className="glass-card flex items-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-xs font-semibold text-accent-cyan"
            title={t.queue.addTracksTooltip}
          >
            <Plus size={14} />
            <span>{t.queue.addTracks}</span>
          </button>

          {/* Przycisk Zapisz kolejkę jako playlistę */}
          {queue.items.length > 0 && (
            <button
              onClick={() => setIsSaveQueueModalOpen(true)}
              className="glass-card flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs font-semibold text-accent-purple"
              title={loc.queue.saveAsPlaylistTitle}
            >
              <BookmarkPlus size={14} />
              <span>{loc.queue.saveAsPlaylist}</span>
            </button>
          )}

          {/* Przycisk Wyczyść kolejkę */}
          {queue.items.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="glass-card flex items-center gap-1.5 rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-400"
              title={t.queue.clearTooltip}
            >
              <Trash2 size={14} />
              <span>{t.queue.clear}</span>
            </button>
          )}
        </div>
      </div>

      {/* Zawartość Kolejki: Tabela utworów lub Pusty stan */}
      {queue.items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/8 bg-black/15 px-6 py-12 text-center text-fg-muted"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500/10">
            <ListMusic size={28} className="text-accent-pink opacity-80" />
          </div>
          <div>
            <p className="m-0 text-md font-bold text-fg">
              {t.queue.empty}
            </p>
            <p className="mt-1 text-ui text-fg-secondary">
              {t.queue.emptyHint}
            </p>
          </div>
          <div className="mt-1.5 flex gap-2.5">
            <button
              onClick={() => setActiveTab('library')}
              className="flex items-center gap-2 rounded-lg border-0 bg-accent-gradient px-4 py-2 text-ui font-bold text-on-accent"
            >
              <Music size={15} />
              <span>{t.queue.browseLibrary}</span>
            </button>
            <button
              onClick={handlePickFiles}
              className="glass-card flex items-center gap-2 rounded-lg px-4 py-2 text-ui font-semibold text-fg-secondary"
            >
              <FolderOpen size={15} />
              <span>{t.queue.pickFromDisk}</span>
            </button>
          </div>
        </div>
      ) : (
        <div ref={queueListRef} className="flex flex-col gap-1.5">
          {/* Pasek nagłówków kolumn */}
          <div
            className="sticky top-0 z-10 grid items-center gap-3 border-b border-line px-3.5 py-2 text-xs font-bold tracking-wider text-fg-muted uppercase backdrop-blur-md"
            style={{
              background: 'rgba(20, 16, 32, 0.95)',
              gridTemplateColumns: getQueueGridTemplate(queueColumns),
            }}
          >
            {queueColumns.showIndex && <span className="w-7 text-center">{t.queue.headerIndex}</span>}
            {queueColumns.showCover && (
              <span
                className={cn(
                  'flex items-center justify-center',
                  queueColumns.compactMode ? 'w-8.5' : 'w-11',
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

          {/* Lista wierszy utworów */}
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
                      'glass-card grid cursor-pointer items-center gap-3 rounded-xl transition-all duration-150',
                      queueColumns.compactMode ? 'px-3 py-1.5' : 'px-3.5 py-2.5',
                      isCurrent ? 'shadow-halo-lg shadow-pink-500/25' : 'shadow-none',
                      draggedQueueIdx === idx ? 'opacity-35' : 'opacity-100',
                      isCurrent ? 'bg-linear-to-r from-pink-500/20 to-accent-purple/10' : 'bg-white/2',
                      isCurrent ? 'border border-accent-pink' : isDragOver ? 'border-2 border-accent-purple' : 'border border-white/5',
                    )}
                    style={{ gridTemplateColumns: getQueueGridTemplate(queueColumns) }}
                  >
                    {/* Numer pozycji / Wskaźnik odtwarzania */}
                    {queueColumns.showIndex && (
                      <div
                        className={cn(
                          'w-7 text-center font-mono text-ui',
                          isCurrent ? 'font-bold text-accent-pink' : 'font-normal text-fg-muted',
                        )}
                      >
                        {isPlaying ? (
                          <Zap size={16} className="text-accent-pink" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                    )}

                    {/* Miniaturka okładki (kliknij aby otworzyć wybór okładki) */}
                    {queueColumns.showCover && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (meta.album) {
                            handleOpenCoverPicker(meta.album);
                          } else {
                            handleUploadCustomCoverDirect(null);
                          }
                        }}
                        className={cn(
                          'flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10',
                          queueColumns.compactMode ? 'h-8.5 w-8.5' : 'h-11 w-11',
                        )}
                        style={{
                          background: meta.cover
                            ? `url("${meta.cover}") center/cover no-repeat`
                            : 'linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.3))',
                        }}
                        title={loc.covers.matchCoverTitle}
                      >
                        {!meta.cover && (
                          <Disc size={queueColumns.compactMode ? 16 : 20} className="text-white/40" />
                        )}
                      </div>
                    )}

                    {/* Tytuł i Wykonawca */}
                    <div className="min-w-0 overflow-hidden">
                      <p
                        className={cn(
                          'm-0 truncate text-fg',
                          queueColumns.compactMode ? 'text-ui' : 'text-sm',
                          isCurrent ? 'font-bold' : 'font-semibold',
                        )}
                      >
                        {item.title}
                      </p>
                      {queueColumns.showArtist && (
                        <p
                          className={cn(
                            'mx-0 mt-0.5 mb-0 truncate text-xs',
                            isCurrent ? 'text-accent-cyan' : 'text-fg-muted',
                          )}
                        >
                          {item.artist || 'Nieznany wykonawca'}
                        </p>
                      )}
                    </div>

                    {/* Album */}
                    {queueColumns.showAlbum && (
                      <span className="truncate text-ui text-fg-secondary">
                        {meta.album?.title || item.album || '—'}
                      </span>
                    )}

                    {/* Format & Jakość */}
                    {queueColumns.showFormatBadge && (
                      <div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xxs font-bold',
                            meta.format.includes('FLAC') || meta.format.includes('WAV') ? 'border-accent-cyan/30 bg-accent-cyan/15 text-accent-cyan' : 'border-accent-purple/30 bg-accent-purple/15 text-accent-purple',
                          )}
                        >
                          {meta.format} {meta.bitDepth ? `${meta.bitDepth}b` : ''}
                        </span>
                      </div>
                    )}

                    {/* Ścieżka pliku */}
                    {queueColumns.showPath && (
                      <span
                        title={`${item.uri.replace(/^file:\/\//, '')} • ${loc.queue.openContainingFolder}`}
                        onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                        className="cursor-pointer truncate font-mono text-xs text-fg-muted underline transition-colors duration-150 hover:text-accent-cyan decoration-white/25 decoration-dotted"
                      >
                        {item.uri.replace(/^file:\/\//, '')}
                      </span>
                    )}

                    {/* Czas trwania */}
                    {queueColumns.showDuration && (
                      <span
                        className={cn(
                          'text-right font-mono text-xs',
                          isCurrent ? 'font-bold text-accent-pink' : 'font-normal text-fg-muted',
                        )}
                      >
                        {formatTime(item.duration_ms)}
                      </span>
                    )}

                    {/* Akcje */}
                    <div className="flex min-w-34 items-center justify-end gap-1">
                      {!isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayQueueIndex(idx, item);
                          }}
                          title={loc.queue.playThis}
                          className="flex rounded-md border-0 bg-transparent p-1 text-fg-muted hover:text-fg"
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        disabled={idx === 0}
                        onClick={(e) => handleMoveQueueItem(idx, idx - 1, e)}
                        title={loc.queue.moveUp}
                        className="flex rounded-md border-0 bg-transparent p-1 text-fg-muted hover:text-fg disabled:text-white/10"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        disabled={idx === queue.items.length - 1}
                        onClick={(e) => handleMoveQueueItem(idx, idx + 1, e)}
                        title={loc.queue.moveDown}
                        className="flex rounded-md border-0 bg-transparent p-1 text-fg-muted hover:text-fg disabled:text-white/10"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                        title={loc.queue.openContainingFolder}
                        className="flex rounded-md border-0 bg-transparent p-1 text-fg-muted transition-colors duration-150 hover:text-accent-cyan"
                      >
                        <FolderOpen size={14} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveFromQueue(item.id, e)}
                        title={loc.queue.remove}
                        className="flex rounded-md border-0 bg-transparent p-1 text-rose-400/70 transition-colors duration-150 hover:text-accent-pink"
                      >
                        <Trash2 size={14} />
                      </button>
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
    </div>
));
