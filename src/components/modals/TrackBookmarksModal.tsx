import React, { useState, useEffect, useCallback, useId } from 'react';
import { invoke } from '../../api/ipc';
import { Bookmark, Plus, Trash2, Edit2, Play, Check, X, Clock, Scissors } from '../ui/icons';
import { formatTimeMs } from '../../utils/timeFormat';
import { type Language, getTranslations } from '../../i18n';
import { type TrackBookmarkDto } from '../../types/player';
import { useLivePositionMs } from '../../state/livePlayback';
import { fmt } from '../../utils/fmt';
import { Button, Callout, Card, EmptyState, IconButton, ModalBody, ModalFooter, ModalHeader, ModalShell, Spinner, TextField } from '../ui';
import { iconTileTones } from '../ui/tones';

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
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const currentPositionMs = useLivePositionMs(currentPositionMsProp);
  const loc = getTranslations(currentLang);
  const [bookmarks, setBookmarks] = useState<TrackBookmarkDto[]>([]);
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [newBookmarkTime, setNewBookmarkTime] = useState(`${currentPositionMs}ms`);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const titleId = useId();

  const loadBookmarks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const bms = await invoke<TrackBookmarkDto[]>('get_track_bookmarks', { trackId });
      setBookmarks(bms);
    } catch (err) {
      console.error('Failed to fetch the track bookmarks:', err);
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

  const handleDeleteAll = async () => {
    try {
      await invoke('delete_all_track_bookmarks', { trackId });
      setConfirmingDeleteAll(false);
      await loadBookmarks();
      onBookmarksUpdated?.();
    } catch (err) {
      setConfirmingDeleteAll(false);
      setError(String(err));
    }
  };

  return (
    <ModalShell onClose={onClose} layer="studio" size="md" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.trackBookmarks.title}
        subtitle={<span className="block truncate">{trackTitle}</span>}
        icon={<Bookmark size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-4">
        {error && <Callout tone="danger" className="text-ui text-accent-red">{error}</Callout>}

        {/* Form for adding a new marker */}
        <Card variant="inset" padding="sm" className="flex flex-col gap-2.5">
          <span className="text-ui font-semibold text-fg">{loc.trackBookmarks.addNewBookmark}</span>
          <div className="grid grid-cols-[1fr_--spacing(35)] gap-2">
            <TextField
              aria-label={loc.trackBookmarks.namePlaceholder}
              placeholder={loc.trackBookmarks.namePlaceholder}
              value={newBookmarkName}
              onChange={(e) => setNewBookmarkName(e.target.value)}
            />
            <div className="flex gap-1">
              <TextField
                mono
                aria-label={loc.trackBookmarks.timePlaceholder}
                placeholder={loc.trackBookmarks.timePlaceholder}
                value={newBookmarkTime}
                onChange={(e) => setNewBookmarkTime(e.target.value)}
                className="px-2"
              />
              <IconButton
                variant="secondary"
                label={loc.trackBookmarks.insertCurrentPos}
                onClick={() => setNewBookmarkTime(`${currentPositionMs}ms`)}
                className="text-accent-cyan"
              >
                <Clock size={15} />
              </IconButton>
            </div>
          </div>

          <div className="mt-1 flex justify-end">
            <Button variant="primary" onClick={handleAddBookmark}>
              <Plus size={15} />
              {loc.trackBookmarks.addBookmark}
            </Button>
          </div>
        </Card>

        {/* Bookmark list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui font-semibold text-fg-secondary">
              {loc.trackBookmarks.savedBookmarks} ({bookmarks.length})
            </span>
            {bookmarks.length > 0 && !confirmingDeleteAll && (
              <Button variant="danger" size="sm" onClick={() => setConfirmingDeleteAll(true)}>
                <Trash2 size={13} />
                {loc.trackBookmarks.deleteAll}
              </Button>
            )}
          </div>

          {confirmingDeleteAll && (
            <Callout tone="danger" className="flex items-center justify-between gap-3">
              <span className="text-ui text-accent-red">{fmt(loc.trackBookmarks.deleteAllConfirm, String(bookmarks.length))}</span>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" onClick={() => setConfirmingDeleteAll(false)}>
                  {loc.common.cancel}
                </Button>
                <Button variant="danger" size="sm" onClick={handleDeleteAll}>
                  {loc.trackBookmarks.deleteAllConfirmYes}
                </Button>
              </div>
            </Callout>
          )}

          {bookmarks.length >= 2 && onExportRange && (
            <Callout tone="cyan" className="mb-1 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-ui font-bold text-accent-cyan">{loc.trackBookmarks.exportRangeWithBookmarks}</span>
                <span className="text-xs text-fg-muted">
                  {fmt(loc.trackBookmarks.rangeFirstToLast, bookmarks[0].name, bookmarks[bookmarks.length - 1].name)}
                </span>
              </div>
              <div className="flex gap-2">
                {onSetAsLoop && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onSetAsLoop(bookmarks[0].position_ms, bookmarks[bookmarks.length - 1].position_ms);
                      onClose();
                    }}
                  >
                    {loc.trackBookmarks.abLoop}
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onExportRange(bookmarks[0].position_ms, bookmarks[bookmarks.length - 1].position_ms);
                    onClose();
                  }}
                >
                  <Scissors size={13} /> {loc.trackBookmarks.export}
                </Button>
              </div>
            </Callout>
          )}

          {isLoading && <Spinner label={loc.trackBookmarks.loading} className="mx-auto my-4" />}

          {!isLoading && bookmarks.length === 0 && <EmptyState title={loc.trackBookmarks.noBookmarksFound} />}

          {bookmarks.map((bm, idx) => (
            <Card key={bm.id} padding="none" className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <IconButton
                  size="sm"
                  label={loc.trackBookmarks.seekAndPlay}
                  onClick={() => onSeek(bm.position_ms)}
                  className={iconTileTones.cyan}
                >
                  <Play size={14} />
                </IconButton>

                {editingId === bm.id ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <TextField
                      size="sm"
                      aria-label={loc.trackBookmarks.rename}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      className="flex-1"
                    />
                    <IconButton
                      size="sm"
                      label={loc.common.save}
                      onClick={() => handleUpdateName(bm.id)}
                      className="text-accent-pink"
                    >
                      <Check size={14} />
                    </IconButton>
                    <IconButton size="sm" label={loc.common.cancel} onClick={() => setEditingId(null)}>
                      <X size={14} />
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-fg">{bm.name}</span>
                    <span className="font-mono text-xs text-accent-cyan">{formatTimeMs(bm.position_ms)}</span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {onSetAsLoop && (
                  <Button
                    variant="tinted"
                    tone="cyan"
                    size="sm"
                    onClick={() => onSetAsLoop(bm.position_ms, null)}
                    title={loc.trackBookmarks.setLoopA}
                  >
                    A
                  </Button>
                )}
                {onSetAsLoop && (
                  <Button
                    variant="tinted"
                    tone="pink"
                    size="sm"
                    onClick={() => onSetAsLoop(null, bm.position_ms)}
                    title={loc.trackBookmarks.setLoopB}
                  >
                    B
                  </Button>
                )}
                {onExportRange && idx < bookmarks.length - 1 && (
                  <IconButton
                    size="sm"
                    label={fmt(loc.trackBookmarks.exportSection, bm.name, bookmarks[idx + 1].name)}
                    onClick={() => {
                      onExportRange(bm.position_ms, bookmarks[idx + 1].position_ms);
                      onClose();
                    }}
                    className="text-accent-cyan"
                  >
                    <Scissors size={13} />
                  </IconButton>
                )}
                {editingId !== bm.id && (
                  <IconButton
                    size="sm"
                    label={loc.trackBookmarks.rename}
                    onClick={() => {
                      setEditingId(bm.id);
                      setEditingName(bm.name);
                    }}
                  >
                    <Edit2 size={14} />
                  </IconButton>
                )}
                <IconButton
                  size="sm"
                  label={loc.trackBookmarks.deleteBookmark}
                  onClick={() => handleDeleteBookmark(bm.id)}
                  className="text-accent-red hover:text-accent-red"
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      </ModalBody>

      <ModalFooter className="justify-between">
        <span className="text-xs text-fg-muted">{loc.trackBookmarks.quickAddTip}</span>
        <Button onClick={onClose}>{loc.common.close}</Button>
      </ModalFooter>
    </ModalShell>
  );
};
