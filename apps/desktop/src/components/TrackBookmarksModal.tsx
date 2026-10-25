import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bookmark, Plus, Trash2, Edit2, Play, Check, X, Clock } from 'lucide-react';
import { formatTimeMs } from './LoopEditorModal';

export interface TrackBookmarkDto {
  id: number;
  track_id: number;
  name: string;
  position_ms: number;
  created_at: number;
}

interface TrackBookmarksModalProps {
  trackId: number;
  trackTitle: string;
  currentPositionMs: number;
  durationMs: number | null;
  onSeek: (positionMs: number) => void;
  onClose: () => void;
  onBookmarksUpdated?: () => void;
}

export const TrackBookmarksModal: React.FC<TrackBookmarksModalProps> = ({
  trackId,
  trackTitle,
  currentPositionMs,
  durationMs,
  onSeek,
  onClose,
  onBookmarksUpdated,
}) => {
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
    loadBookmarks();
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-surface, #181824)',
          border: '1px solid var(--border-accent, rgba(236, 72, 153, 0.3))',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 25px rgba(236, 72, 153, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Nagłówek modala */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.15), rgba(6, 182, 212, 0.15))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(236, 72, 153, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-pink, #ec4899)',
              }}
            >
              <Bookmark size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                Znaczniki i Zakładki (Cue Points)
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary, #a1a1aa)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '380px',
                }}
              >
                {trackTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #71717a)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Zawartość */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '0.82rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Formularz dodania nowego znacznika */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
              ➕ Dodaj nowy znacznik na osi utworu
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px' }}>
              <input
                type="text"
                placeholder="Nazwa znacznika (np. Drop, Refren, Solo)"
                value={newBookmarkName}
                onChange={(e) => setNewBookmarkName(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: '0.82rem',
                }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  placeholder="Czas (np. 1:24)"
                  value={newBookmarkTime}
                  onChange={(e) => setNewBookmarkTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.8rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setNewBookmarkTime(`${currentPositionMs}ms`)}
                  title="Wstaw aktualną pozycję odtwarzacza"
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    color: 'var(--accent-cyan, #06b6d4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Clock size={15} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleAddBookmark}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'var(--accent-pink, #ec4899)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
                }}
              >
                <Plus size={15} />
                Dodaj znacznik
              </button>
            </div>
          </div>

          {/* Lista zakładek */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)' }}>
              Lista zapisanych punktów ({bookmarks.length})
            </span>

            {isLoading && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                Ładowanie zakładek...
              </div>
            )}

            {!isLoading && bookmarks.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'var(--text-muted, #71717a)',
                  fontSize: '0.84rem',
                }}
              >
                Ten utwór nie ma jeszcze żadnych znaczników. Dodaj swój pierwszy znacznik powyżej lub skrótem klawiszowym <b>Shift+B</b>!
              </div>
            )}

            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <button
                    onClick={() => onSeek(bm.position_ms)}
                    title="Przejdź do tego znacznika i odtwórz"
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'rgba(6, 182, 212, 0.2)',
                      border: '1px solid var(--accent-cyan, #06b6d4)',
                      color: 'var(--accent-cyan, #06b6d4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={14} style={{ marginLeft: '2px' }} />
                  </button>

                  {editingId === bm.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--accent-pink)',
                          background: 'rgba(0,0,0,0.5)',
                          color: '#fff',
                          fontSize: '0.82rem',
                          flex: 1,
                        }}
                      />
                      <button
                        onClick={() => handleUpdateName(bm.id)}
                        style={{
                          background: 'var(--accent-pink)',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff' }}>
                        {bm.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--accent-cyan, #06b6d4)',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {formatTimeMs(bm.position_ms)}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {editingId !== bm.id && (
                    <button
                      onClick={() => {
                        setEditingId(bm.id);
                        setEditingName(bm.name);
                      }}
                      title="Zmień nazwę"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted, #71717a)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteBookmark(bm.id)}
                    title="Usuń znacznik"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(244, 63, 94, 0.7)',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stopka modala */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Wskazówka: Naciśnij <b>Shift+B</b> w odtwarzaczu, aby szybko dodać punkt.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
              color: 'var(--text-secondary, #a1a1aa)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
