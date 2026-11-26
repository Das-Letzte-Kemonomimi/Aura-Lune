import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '../../api/ipc';
import { Bookmark, Plus, Trash2, Edit2, Play, Check, X, Clock, Scissors } from 'lucide-react';
import { formatTimeMs } from '../../utils/timeFormat';
import { type Language, getTranslations } from '../../i18n';
import { type TrackBookmarkDto } from '../../types/player';
import { useLivePositionMs } from '../../state/livePlayback';
import { fmt } from '../../utils/fmt';
import { ModalShell } from '../ui';

export type { TrackBookmarkDto };

interface TrackBookmarksModalProps {
  trackId: number;
  trackTitle: string;
  currentPositionMs: number;
  durationMs: number | null;
  onSeek: (positionMs: number) => void;
  onClose: () => void;
  onBookmarksUpdated?: () => void;
  onExportRange?: (startMs: number, endMs: number | null) => void;
  onSetAsLoop?: (startMs: number | null, endMs: number | null) => void;
  currentLang?: Language;
}

export const TrackBookmarksModal: React.FC<TrackBookmarksModalProps> = ({
  trackId,
  trackTitle,
  currentPositionMs: currentPositionMsProp,
  durationMs,
  onSeek,
  onClose,
  onBookmarksUpdated,
  onExportRange,
  onSetAsLoop,
  currentLang = 'pl',
}) => {
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const currentPositionMs = useLivePositionMs(currentPositionMsProp);
  const loc = getTranslations(currentLang);
  const [bookmarks, setBookmarks] = useState<TrackBookmarkDto[]>([]);
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [newBookmarkTime, setNewBookmarkTime] = useState(`${currentPositionMs}ms`);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const bms = await invoke<TrackBookmarkDto[]>('get_track_bookmarks', { trackId });
      setBookmarks(bms);
    } catch (err) {
      console.error('Błąd pobierania zakładek utworu:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadBookmarks();
      }
    });
    return () => {
      active = false;
    };
  }, [loadBookmarks]);

  const handleAddBookmark = async () => {
    const name = newBookmarkName.trim() || `Punkt ${bookmarks.length + 1}`;
    let posMs = currentPositionMs;

    const rawTime = newBookmarkTime.trim();
    if (rawTime.endsWith('ms')) {
      const parsed = parseInt(rawTime.slice(0, -2), 10);
      if (!isNaN(parsed) && parsed >= 0) posMs = parsed;
    } else if (rawTime.includes(':')) {
      const parts = rawTime.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10);
        const secs = parseFloat(parts[1]);
        if (!isNaN(mins) && !isNaN(secs)) {
          posMs = Math.round((mins * 60 + secs) * 1000);
        }
      }
    } else {
      const parsed = parseInt(rawTime, 10);
      if (!isNaN(parsed) && parsed >= 0) posMs = parsed;
    }

    if (durationMs && posMs > durationMs) {
      posMs = durationMs;
    }

    try {
      await invoke('add_track_bookmark', {
        trackId,
        name,
        positionMs: posMs,
      });
      setNewBookmarkName('');
      setNewBookmarkTime(`${currentPositionMs}ms`);
      await loadBookmarks();
      onBookmarksUpdated?.();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleUpdateName = async (bookmarkId: number) => {
    if (!editingName.trim()) return;
    try {
      await invoke('update_track_bookmark', {
        bookmarkId,
        name: editingName.trim(),
      });
      setEditingId(null);
      await loadBookmarks();
      onBookmarksUpdated?.();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeleteBookmark = async (bookmarkId: number) => {
    try {
      await invoke('delete_track_bookmark', { bookmarkId });
      await loadBookmarks();
      onBookmarksUpdated?.();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[90vh] max-w-140 flex-col overflow-hidden rounded-2xl border border-line-accent bg-surface"
    >
      {/* Nagłówek modala */}
      <div
        className="flex items-center justify-between border-b border-line bg-linear-to-r from-pink-500/15 to-accent-cyan/15 px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/25 text-accent-pink">
            <Bookmark size={18} />
          </div>
          <div>
            <h3 className="m-0 text-base font-bold text-fg">
              {loc.trackBookmarks.title}
            </h3>
            <p className="m-0 max-w-95 truncate text-ui text-fg-secondary">
              {trackTitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex rounded-lg border-0 bg-transparent p-1.5 text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Zawartość */}
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        {error && (
          <div className="rounded-lg border border-accent-red/40 bg-accent-red/15 px-3.5 py-2.5 text-ui text-red-400">
            {error}
          </div>
        )}

        {/* Formularz dodania nowego znacznika */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white/3 p-3.5">
          <span className="text-ui font-semibold text-fg">
            {loc.trackBookmarks.addNewBookmark}
          </span>
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <input
              type="text"
              placeholder={loc.trackBookmarks.namePlaceholder}
              value={newBookmarkName}
              onChange={(e) => setNewBookmarkName(e.target.value)}
              className="rounded-lg border border-line bg-black/30 px-3 py-2 text-ui text-fg"
            />
            <div className="flex gap-1">
              <input
                type="text"
                placeholder={loc.trackBookmarks.timePlaceholder}
                value={newBookmarkTime}
                onChange={(e) => setNewBookmarkTime(e.target.value)}
                className="w-full rounded-lg border border-line bg-black/30 p-2 font-mono text-ui text-fg"
              />
              <button
                type="button"
                onClick={() => setNewBookmarkTime(`${currentPositionMs}ms`)}
                title={loc.trackBookmarks.insertCurrentPos}
                className="flex items-center justify-center rounded-lg border border-line bg-white/8 p-2 text-accent-cyan"
              >
                <Clock size={15} />
              </button>
            </div>
          </div>

          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={handleAddBookmark}
              className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-pink px-3.5 py-2 text-ui font-semibold text-fg shadow-lift shadow-pink-500/30"
            >
              <Plus size={15} />
              {loc.trackBookmarks.addBookmark}
            </button>
          </div>
        </div>

        {/* Lista zakładek */}
        <div className="flex flex-col gap-2">
          <span className="text-ui font-semibold text-fg-secondary">
            {loc.trackBookmarks.savedBookmarks} ({bookmarks.length})
          </span>

          {bookmarks.length >= 2 && onExportRange && (
            <div
              className="mb-1 flex items-center justify-between rounded-xl border border-accent-cyan/30 bg-accent-cyan/10 px-3.5 py-2.5"
            >
              <div className="flex flex-col">
                <span className="text-ui font-bold text-accent-cyan">
                  {loc.trackBookmarks.exportRangeWithBookmarks}
                </span>
                <span className="text-xs text-fg-muted">
                  {fmt(loc.trackBookmarks.rangeFirstToLast, bookmarks[0].name, bookmarks[bookmarks.length - 1].name)}
                </span>
              </div>
              <div className="flex gap-2">
                {onSetAsLoop && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetAsLoop(bookmarks[0].position_ms, bookmarks[bookmarks.length - 1].position_ms);
                      onClose();
                    }}
                    className="glass-card rounded-md border border-line bg-white/8 px-2.5 py-1.5 text-xs font-semibold text-fg"
                  >
                    {loc.trackBookmarks.abLoop}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onExportRange(bookmarks[0].position_ms, bookmarks[bookmarks.length - 1].position_ms);
                    onClose();
                  }}
                  className="flex items-center gap-1 rounded-md border-0 bg-linear-135 from-accent-cyan to-accent-pink px-3 py-1.5 text-xs font-bold text-on-accent"
                >
                  <Scissors size={13} /> {loc.trackBookmarks.export}
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="p-4 text-center text-fg-muted">
              {loc.trackBookmarks.loading}
            </div>
          )}

          {!isLoading && bookmarks.length === 0 && (
            <div className="rounded-xl bg-white/2 p-6 text-center text-ui text-fg-muted">
              {loc.trackBookmarks.noBookmarksFound}
            </div>
          )}

          {bookmarks.map((bm, idx) => (
            <div
              key={bm.id}
              className="flex items-center justify-between rounded-xl border border-line bg-white/4 px-3.5 py-2.5 transition-all duration-150"
            >
              <div className="flex flex-1 items-center gap-2.5">
                <button
                  onClick={() => onSeek(bm.position_ms)}
                  title={loc.trackBookmarks.seekAndPlay}
                  className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                >
                  <Play size={14} className="ml-0.5" />
                </button>

                {editingId === bm.id ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      className="flex-1 rounded-md border border-accent-pink bg-black/50 px-2 py-1 text-ui text-fg"
                    />
                    <button
                      onClick={() => handleUpdateName(bm.id)}
                      className="rounded-md border-0 bg-accent-pink px-2 py-1 text-on-accent"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md border-0 bg-white/10 px-2 py-1 text-fg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-fg">
                      {bm.name}
                    </span>
                    <span className="font-mono text-xs text-accent-cyan">
                      {formatTimeMs(bm.position_ms)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {onSetAsLoop && (
                  <button
                    onClick={() => onSetAsLoop(bm.position_ms, null)}
                    title={loc.trackBookmarks.setLoopA}
                    className="rounded-md border border-accent-cyan/35 bg-accent-cyan/15 px-2 py-1 text-xs font-bold text-accent-cyan"
                  >
                    A
                  </button>
                )}
                {onSetAsLoop && (
                  <button
                    onClick={() => onSetAsLoop(null, bm.position_ms)}
                    title={loc.trackBookmarks.setLoopB}
                    className="rounded-md border border-pink-500/35 bg-pink-500/15 px-2 py-1 text-xs font-bold text-accent-pink"
                  >
                    B
                  </button>
                )}
                {onExportRange && idx < bookmarks.length - 1 && (
                  <button
                    onClick={() => {
                      onExportRange(bm.position_ms, bookmarks[idx + 1].position_ms);
                      onClose();
                    }}
                    title={fmt(loc.trackBookmarks.exportSection, bm.name, bookmarks[idx + 1].name)}
                    className="flex items-center gap-1 rounded-md border border-line bg-white/8 px-2 py-1.5 text-xs text-accent-cyan"
                  >
                    <Scissors size={12} />
                  </button>
                )}
                {editingId !== bm.id && (
                  <button
                    onClick={() => {
                      setEditingId(bm.id);
                      setEditingName(bm.name);
                    }}
                    title={loc.trackBookmarks.rename}
                    className="rounded-md border-0 bg-transparent p-1.5 text-fg-muted"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteBookmark(bm.id)}
                  title={loc.trackBookmarks.deleteBookmark}
                  className="rounded-md border-0 bg-transparent p-1.5 text-accent-pink/70"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stopka modala */}
      <div className="flex items-center justify-between border-t border-line bg-black/20 px-5 py-3">
        <span className="text-xs text-fg-muted">
          {loc.trackBookmarks.quickAddTip}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg border border-line bg-white/8 px-3.5 py-1.5 text-ui text-fg-secondary"
        >
          {loc.common.close}
        </button>
      </div>
    </ModalShell>
  );
};
