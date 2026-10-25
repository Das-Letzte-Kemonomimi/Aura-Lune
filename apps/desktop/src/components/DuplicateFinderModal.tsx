import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Copy, Trash2, FolderOpen, Play, X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface TrackRecordDto {
  id: number;
  path: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album_id: number | null;
  duration_ms: number;
  format: string;
  sample_rate: number;
  channels: number;
  bit_depth: number | null;
  file_size: number;
  play_count?: number | null;
}

export interface DuplicateGroupDto {
  key: string;
  count: number;
  tracks: TrackRecordDto[];
}

interface DuplicateFinderModalProps {
  onClose: () => void;
  onPlayTrack: (path: string) => void;
  onLibraryChanged?: () => void;
}

export const DuplicateFinderModal: React.FC<DuplicateFinderModalProps> = ({
  onClose,
  onPlayTrack,
  onLibraryChanged,
}) => {
  const [groups, setGroups] = useState<DuplicateGroupDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDuplicates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await invoke<DuplicateGroupDto[]>('find_duplicate_tracks');
      setGroups(res);
    } catch (err) {
      console.error('Błąd wyszukiwania duplikatów:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  const handleDelete = async (trackId: number, deleteFile: boolean, title: string) => {
    const confirmText = deleteFile
      ? `Czy na pewno chcesz BEZPOWROTNIE usunąć plik utworu „${title}” z dysku?`
      : `Czy na pewno chcesz usunąć „${title}” z bazy biblioteki Auralune?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      await invoke('delete_track_record', { trackId, deleteFile });
      setSuccessMsg(`Pomyślnie usunięto kopię utworu: ${title}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadDuplicates();
      onLibraryChanged?.();
    } catch (err) {
      setError(`Błąd usuwania utworu: ${err}`);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_containing_folder', { path });
    } catch (err) {
      setError(String(err));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatDuration = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
          maxWidth: '850px',
          background: 'var(--bg-surface, #181824)',
          border: '1px solid var(--border-accent, rgba(236, 72, 153, 0.3))',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7), 0 0 25px rgba(236, 72, 153, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Nagłówek */}
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
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan, #06b6d4)',
              }}
            >
              <Copy size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                Wyszukiwarka Duplikatów Audio (Duplicate Finder)
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                Wykrywa identyczne utwory w różnych formatach (FLAC vs MP3), zdublowane pliki lub kopie zapasowe.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={loadDuplicates}
              disabled={isLoading}
              title="Odśwież wyszukiwanie"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-secondary, #a1a1aa)',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
              }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Odśwież
            </button>
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
        </div>

        {/* Komunikaty */}
        {error && (
          <div
            style={{
              margin: '16px 20px 0',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              margin: '16px 20px 0',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {/* Lista grup duplikatów */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Analizowanie biblioteki pod kątem duplikatów...
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-muted, #71717a)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <span style={{ fontSize: '0.96rem', fontWeight: 600, color: '#fff' }}>
                Brak duplikatów w Twojej bibliotece!
              </span>
              <span style={{ fontSize: '0.82rem', maxWidth: '400px' }}>
                Wszystkie utwory posiadają unikalne tytuły i wykonawców. Biblioteka jest w idealnym porządku.
              </span>
            </div>
          )}

          {!isLoading && groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Wykryto <b>{groups.length}</b> grup potencjalnych duplikatów (łącznie{' '}
                <b>{groups.reduce((acc, g) => acc + g.tracks.length, 0)}</b> plików):
              </div>

              {groups.map((group, idx) => (
                <div
                  key={idx}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-pink, #ec4899)' }}>
                      🎵 {group.key}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(6, 182, 212, 0.2)',
                        color: 'var(--accent-cyan, #06b6d4)',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      {group.count} kopie
                    </span>
                  </div>

                  {/* Wiersze plików w danej grupie */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {group.tracks.map((track) => {
                      const isLossless = ['flac', 'wav', 'alac', 'aiff'].includes(track.format.toLowerCase());
                      return (
                        <div
                          key={track.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isLossless ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.1)',
                                color: isLossless ? '#34d399' : 'var(--text-secondary)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              {track.format.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {track.bit_depth ? `${track.bit_depth}-bit ` : ''}
                              {Math.round(track.sample_rate / 1000)}kHz
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                color: 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={track.path}
                            >
                              {track.path}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Rozmiar: {formatFileSize(track.file_size)} • Długość: {formatDuration(track.duration_ms)} • Odtworzeń: {track.play_count || 0}
                            </span>
                          </div>

                          {/* Akcje dla pliku */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => onPlayTrack(track.path)}
                              title="Odtwórz ten plik"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                background: 'rgba(6, 182, 212, 0.2)',
                                border: '1px solid var(--accent-cyan, #06b6d4)',
                                color: 'var(--accent-cyan, #06b6d4)',
                                cursor: 'pointer',
                                display: 'flex',
                              }}
                            >
                              <Play size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenFolder(track.path)}
                              title="Pokaż w eksploratorze plików"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                              }}
                            >
                              <FolderOpen size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(track.id, false, track.title)}
                              title="Usuń z bazy biblioteki (plik na dysku pozostanie nienaruszony)"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                              }}
                            >
                              Usuń wpis
                            </button>
                            <button
                              onClick={() => handleDelete(track.id, true, track.title)}
                              title="BEZPOWROTNIE usuń plik z dysku"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                cursor: 'pointer',
                                display: 'flex',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stopka */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
              color: 'var(--text-secondary, #a1a1aa)',
              fontSize: '0.82rem',
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
