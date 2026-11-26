import React from 'react';
import { BookmarkPlus, Check, ChevronDown, ChevronUp, Disc, FolderOpen, Image as ImageIcon, Infinity as InfinityIcon, ListMusic, Music, Play, Plus, Repeat, Repeat1, RotateCcw, Search, Settings, Shuffle, SlidersHorizontal, Square, Trash2, X, Zap } from 'lucide-react';
import type { PlaybackStatus } from '../../../types/player';
import { type QueueItem, type QueueColumnConfig, getQueueGridTemplate } from '../../../types/queue';
import type { PlayerViewProps } from '../PlayerView';
import type { QueueTrackMeta } from '../queueTrackMeta';

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
    <div
      className="glass-panel"
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
      }}
    >
      {/* Pasek nagłówkowy kolejki */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
              border: '1px solid rgba(236, 72, 153, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(236, 72, 153, 0.2)',
            }}
          >
            <ListMusic size={20} color="var(--accent-pink)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                {loc.queue.title}
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(236, 72, 153, 0.15)',
                  color: 'var(--accent-pink)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                }}
              >
                {queue.items.length}{' '}
                {queue.items.length === 1
                  ? loc.queue.itemSingle
                  : queue.items.length >= 2 && queue.items.length <= 4
                    ? loc.queue.itemFew
                    : loc.queue.itemMany}
              </span>
              {queue.items.length > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  • {formatTotalDuration(totalQueueDurationMs)}
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {loc.queue.dragHint}
            </p>
          </div>
        </div>

        {/* Przyciski kontroli i dostosowywania */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          {/* Tryb Pętli Badge Button */}
          <button
            onClick={handleCycleLoopMode}
            title={`${loc.shortcuts.loop}: ${queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}`}
            className="glass-card"
            style={{
              padding: '6px 11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
              border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {queue.loop_mode === 'Track' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            <span>{queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}</span>
          </button>

          {/* Shuffle Badge Button */}
          <button
            onClick={handleToggleShuffle}
            title={`${loc.shortcuts.shuffle}: ${queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}`}
            className="glass-card"
            style={{
              padding: '6px 11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
              border: queue.shuffle ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <Shuffle size={14} />
            <span>{queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}</span>
          </button>

          {/* Infinity Queue / Auto-DJ Button */}
          <button
            onClick={handleToggleInfinityQueue}
            title={loc.queue.autoDjHint}
            className="glass-card"
            style={{
              padding: '6px 11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: infinityQueue ? 'var(--accent-pink)' : 'var(--text-muted)',
              border: infinityQueue ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
              background: infinityQueue ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <InfinityIcon size={14} />
            <span>Auto-DJ {infinityQueue ? 'ON' : 'OFF'}</span>
          </button>

          {/* Stop After Current Badge Button (foobar2000 classic) */}
          <button
            onClick={handleToggleStopAfterCurrent}
            title={loc.player.stopAfterCurrentTooltip}
            className="glass-card"
            style={{
              padding: '6px 11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: status.stop_after_current ? '#eab308' : 'var(--text-muted)',
              border: status.stop_after_current ? '1px solid #eab308' : '1px solid var(--border-subtle)',
              borderRadius: '8px',
              cursor: 'pointer',
              background: status.stop_after_current ? 'rgba(234, 179, 8, 0.22)' : 'transparent',
              boxShadow: status.stop_after_current ? '0 0 10px rgba(234, 179, 8, 0.35)' : 'none',
            }}
          >
            <Square size={13} style={{ fill: status.stop_after_current ? '#eab308' : 'none' }} />
            <span>Stop After Track {status.stop_after_current ? '(ON)' : ''}</span>
          </button>

          {/* Pole wyszukiwania w kolejce */}
          {queue.items.length > 0 && (
            <div style={{ position: 'relative', width: '180px' }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: '9px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder={loc.queue.search}
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 28px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  outline: 'none',
                }}
              />
              {queueSearchQuery && (
                <button
                  onClick={() => setQueueSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '7px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Przycisk Konfiguracji Kolumn */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
              className="glass-card"
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: isColumnConfigOpen ? 'var(--accent-purple)' : 'var(--text-secondary)',
                border: isColumnConfigOpen ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              title={loc.queue.customizeView}
            >
              <SlidersHorizontal size={14} />
              <span>{loc.queue.customizeView}</span>
            </button>

            {/* Popover Konfiguracji Kolumn */}
            {isColumnConfigOpen && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '8px',
                  width: '320px',
                  padding: '16px',
                  zIndex: 70,
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)',
                  border: '1px solid var(--border-accent)',
                  borderRadius: '14px',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Settings size={15} color="var(--accent-purple)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{t.queue.customizeTitle}</span>
                  </div>
                  <button
                    onClick={() => setIsColumnConfigOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={15} />
                  </button>
                </div>

                <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {t.queue.customizeDesc}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: active ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255,255,255,0.02)',
                          border: active ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', color: active ? '#fff' : 'var(--text-muted)' }}>{col.label}</span>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: active ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                            background: active ? 'var(--accent-purple)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {active && <Check size={12} color="#fff" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={resetQueueColumns}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RotateCcw size={12} /> {t.queue.resetDefaults}
                  </button>
                  <button
                    onClick={() => setIsColumnConfigOpen(false)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      background: 'var(--accent-purple)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
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
            className="glass-card"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              background: 'rgba(6, 182, 212, 0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            title={t.queue.addTracksTooltip}
          >
            <Plus size={14} />
            <span>{t.queue.addTracks}</span>
          </button>

          {/* Przycisk Zapisz kolejkę jako playlistę */}
          {queue.items.length > 0 && (
            <button
              onClick={() => setIsSaveQueueModalOpen(true)}
              className="glass-card"
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent-purple)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                background: 'rgba(168, 85, 247, 0.12)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
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
              className="glass-card"
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#ff6b81',
                border: '1px solid rgba(255, 107, 129, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
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
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            border: '2px dashed rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(236, 72, 153, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ListMusic size={28} color="var(--accent-pink)" style={{ opacity: 0.8 }} />
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff' }}>
              {t.queue.empty}
            </p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
              {t.queue.emptyHint}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              onClick={() => setActiveTab('library')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Music size={15} />
              <span>{t.queue.browseLibrary}</span>
            </button>
            <button
              onClick={handlePickFiles}
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 16px',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FolderOpen size={15} />
              <span>{t.queue.pickFromDisk}</span>
            </button>
          </div>
        </div>
      ) : (
        <div ref={queueListRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Pasek nagłówków kolumn */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'rgba(20, 16, 32, 0.95)',
              backdropFilter: 'blur(12px)',
              display: 'grid',
              gridTemplateColumns: getQueueGridTemplate(queueColumns),
              padding: '8px 14px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {queueColumns.showIndex && <span style={{ width: '28px', textAlign: 'center' }}>{t.queue.headerIndex}</span>}
            {queueColumns.showCover && (
              <span
                style={{
                  width: queueColumns.compactMode ? '34px' : '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={t.queue.headerCover}
              >
                <ImageIcon size={14} style={{ opacity: 0.7 }} />
              </span>
            )}
            <span>{t.queue.headerTitleArtist}</span>
            {queueColumns.showAlbum && <span>{t.queue.headerAlbum}</span>}
            {queueColumns.showFormatBadge && <span>{t.queue.headerQuality}</span>}
            {queueColumns.showPath && <span>{t.queue.headerPath}</span>}
            {queueColumns.showDuration && <span style={{ textAlign: 'right' }}>{t.queue.headerTime}</span>}
            <span style={{ textAlign: 'right', paddingRight: '6px' }}>{t.queue.headerActions}</span>
          </div>

          {/* Lista wierszy utworów */}
          {filteredQueueItems.length === 0 && queueSearchQuery ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t.queue.noMatch.replace('{q}', queueSearchQuery)}
            </div>
          ) : (
            <>
              {queueTopSpacer > 0 && <div style={{ height: `${queueTopSpacer}px`, pointerEvents: 'none' }} />}
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
                    className="glass-card"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: getQueueGridTemplate(queueColumns),
                      alignItems: 'center',
                      padding: queueColumns.compactMode ? '6px 12px' : '10px 14px',
                      gap: '12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isCurrent
                        ? 'linear-gradient(90deg, rgba(236, 72, 153, 0.18), rgba(168, 85, 247, 0.1))'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: isCurrent
                        ? '1px solid var(--accent-pink)'
                        : isDragOver
                          ? '2px solid var(--accent-purple)'
                          : '1px solid rgba(255, 255, 255, 0.05)',
                      boxShadow: isCurrent ? '0 0 20px rgba(236, 72, 153, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                      opacity: draggedQueueIdx === idx ? 0.35 : 1,
                    }}
                  >
                    {/* Numer pozycji / Wskaźnik odtwarzania */}
                    {queueColumns.showIndex && (
                      <div
                        style={{
                          width: '28px',
                          textAlign: 'center',
                          color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: isCurrent ? 700 : 400,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {isPlaying ? (
                          <Zap size={16} color="var(--accent-pink)" />
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
                        style={{
                          width: queueColumns.compactMode ? '34px' : '44px',
                          height: queueColumns.compactMode ? '34px' : '44px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: meta.cover
                            ? `url("${meta.cover}") center/cover no-repeat`
                            : 'linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.3))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.1)',
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                        title={loc.covers.matchCoverTitle}
                      >
                        {!meta.cover && (
                          <Disc size={queueColumns.compactMode ? 16 : 20} color="rgba(255,255,255,0.4)" />
                        )}
                      </div>
                    )}

                    {/* Tytuł i Wykonawca */}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: queueColumns.compactMode ? '0.82rem' : '0.88rem',
                          fontWeight: isCurrent ? 700 : 600,
                          color: isCurrent ? '#fff' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </p>
                      {queueColumns.showArtist && (
                        <p
                          style={{
                            margin: '2px 0 0 0',
                            fontSize: '0.74rem',
                            color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.artist || 'Nieznany wykonawca'}
                        </p>
                      )}
                    </div>

                    {/* Album */}
                    {queueColumns.showAlbum && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {meta.album?.title || item.album || '—'}
                      </span>
                    )}

                    {/* Format & Jakość */}
                    {queueColumns.showFormatBadge && (
                      <div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontSize: '0.67rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            background:
                              meta.format.includes('FLAC') || meta.format.includes('WAV')
                                ? 'rgba(6, 182, 212, 0.15)'
                                : 'rgba(168, 85, 247, 0.15)',
                            color:
                              meta.format.includes('FLAC') || meta.format.includes('WAV')
                                ? 'var(--accent-cyan)'
                                : 'var(--accent-purple)',
                            border:
                              meta.format.includes('FLAC') || meta.format.includes('WAV')
                                ? '1px solid rgba(6, 182, 212, 0.3)'
                                : '1px solid rgba(168, 85, 247, 0.3)',
                          }}
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
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer',
                          textDecoration: 'underline dotted rgba(255, 255, 255, 0.25)',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        {item.uri.replace(/^file:\/\//, '')}
                      </span>
                    )}

                    {/* Czas trwania */}
                    {queueColumns.showDuration && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                          fontWeight: isCurrent ? 700 : 400,
                          textAlign: 'right',
                        }}
                      >
                        {formatTime(item.duration_ms)}
                      </span>
                    )}

                    {/* Akcje */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', minWidth: '136px' }}>
                      {!isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayQueueIndex(idx, item);
                          }}
                          title={loc.queue.playThis}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            display: 'flex',
                          }}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        disabled={idx === 0}
                        onClick={(e) => handleMoveQueueItem(idx, idx - 1, e)}
                        title={loc.queue.moveUp}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                          cursor: idx === 0 ? 'default' : 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          display: 'flex',
                        }}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        disabled={idx === queue.items.length - 1}
                        onClick={(e) => handleMoveQueueItem(idx, idx + 1, e)}
                        title={loc.queue.moveDown}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: idx === queue.items.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                          cursor: idx === queue.items.length - 1 ? 'default' : 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          display: 'flex',
                        }}
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                        title={loc.queue.openContainingFolder}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          display: 'flex',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <FolderOpen size={14} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveFromQueue(item.id, e)}
                        title={loc.queue.remove}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255, 107, 129, 0.7)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          display: 'flex',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-pink)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 107, 129, 0.7)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {queueBottomSpacer > 0 && <div style={{ height: `${queueBottomSpacer}px`, pointerEvents: 'none' }} />}
            </>
          )}
        </div>
      )}
    </div>
));
