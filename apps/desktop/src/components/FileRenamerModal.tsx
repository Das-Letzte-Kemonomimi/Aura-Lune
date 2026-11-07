import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileEdit, X, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import type { Language } from '../i18n';

export interface RenamePreviewItemDto {
  track_id: number;
  old_path: string;
  new_path: string;
  will_overwrite: boolean;
  is_valid: boolean;
  error: string | null;
}

export interface TrackMinimalDto {
  id: number;
  title: string;
  artist: string;
  path: string;
}

interface FileRenamerModalProps {
  tracks: TrackMinimalDto[];
  onClose: () => void;
  onRenamedSuccess?: () => void;
  currentLang?: Language;
}

export const FileRenamerModal: React.FC<FileRenamerModalProps> = ({
  tracks,
  onClose,
  onRenamedSuccess,
  currentLang = 'pl',
}) => {
  const isPl = currentLang === 'pl';
  const presetPatterns = [
    { label: isPl ? '01 - Wykonawca - Tytuł' : '01 - Artist - Title', pattern: '%track% - %artist% - %title%' },
    { label: isPl ? 'Wykonawca - Tytuł' : 'Artist - Title', pattern: '%artist% - %title%' },
    { label: isPl ? 'Wykonawca - Album - 01 - Tytuł' : 'Artist - Album - 01 - Title', pattern: '%artist% - %album% - %track% - %title%' },
    { label: isPl ? 'Folder: Wykonawca/Album/01 - Tytuł' : 'Folder: Artist/Album/01 - Title', pattern: '%artist%/%album%/%track% - %title%' },
  ];
  const [pattern, setPattern] = useState('%track% - %artist% - %title%');
  const [previews, setPreviews] = useState<RenamePreviewItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const updatePreview = useCallback(async (currentPattern: string) => {
    if (!currentPattern.trim() || tracks.length === 0) return;
    try {
      setIsLoading(true);
      setError(null);
      const trackIds = tracks.map((t) => t.id);
      const res = await invoke<RenamePreviewItemDto[]>('preview_rename_tracks', {
        pattern: currentPattern,
        trackIds,
      });
      setPreviews(res);
    } catch (err) {
      console.error('Błąd podglądu zmiany nazw:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [tracks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview(pattern);
    }, 250);
    return () => clearTimeout(timer);
  }, [pattern, updatePreview]);

  const handleExecuteRename = async () => {
    const validItems = previews
      .filter((p) => p.is_valid && p.old_path !== p.new_path)
      .map((p) => [p.track_id, p.new_path]);

    if (validItems.length === 0) {
      setError(isPl ? 'Brak plików wymagających zmiany nazwy.' : 'No files require renaming.');
      return;
    }

    const hasOverwrites = previews.some((p) => p.will_overwrite);
    if (
      hasOverwrites &&
      !window.confirm(
        isPl
          ? 'Uwaga: Niektóre pliki docelowe już istnieją i zostaną nadpisane! Czy na pewno chcesz kontynuować?'
          : 'Warning: Some destination files already exist and will be overwritten! Do you want to continue?'
      )
    ) {
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);
      const count = await invoke<number>('execute_rename_tracks', { items: validItems });
      setSuccessCount(count);
      onRenamedSuccess?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const getFilenameFromPath = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
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
                background: 'rgba(236, 72, 153, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-pink, #ec4899)',
              }}
            >
              <FileEdit size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                {isPl ? 'Masowy Auto-Renamer / Organizator Plików (foobar2000 File Ops)' : 'Batch File Renamer (foobar2000 File Ops)'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                {isPl
                  ? 'Zmienia nazwy plików na dysku według wzorca tagów i automatycznie aktualizuje bazę biblioteki.'
                  : 'Renames files on disk according to tag pattern and updates library database.'}
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {successCount !== null && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <CheckCircle2 size={18} />
              {isPl ? (
                <>Pomyślnie zmieniono nazwy <b>{successCount}</b> plików na dysku i zaktualizowano bibliotekę!</>
              ) : (
                <>Successfully renamed <b>{successCount}</b> files on disk and updated library!</>
              )}
            </div>
          )}

          {/* Konfiguracja wzorca */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                {isPl ? 'Wzorzec schematu nazw (Pattern)' : 'Filename Pattern'}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {isPl ? 'Dostępne tagi:' : 'Available tags:'} <code>%artist%</code>, <code>%title%</code>, <code>%album%</code>, <code>%track%</code>, <code>%disc%</code>, <code>%ext%</code>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="%track% - %artist% - %title%"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-accent, rgba(236, 72, 153, 0.4))',
                  background: 'rgba(0,0,0,0.4)',
                  color: '#fff',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.86rem',
                }}
              />
              <button
                type="button"
                onClick={() => updatePreview(pattern)}
                title={isPl ? 'Odśwież podgląd' : 'Refresh Preview'}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Presety */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                {isPl ? 'Presety:' : 'Presets:'}
              </span>
              {presetPatterns.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPattern(p.pattern)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: pattern === p.pattern ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${pattern === p.pattern ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                    color: pattern === p.pattern ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela podglądu zmian */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)' }}>
              {isPl ? `Podgląd operacji (${previews.length} plików do weryfikacji)` : `Operation Preview (${previews.length} files to review)`}
            </span>

            <div
              style={{
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                background: 'rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 24px 1fr 90px',
                  gap: '12px',
                  padding: '8px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                <span>{isPl ? 'OBECNA NAZWA' : 'CURRENT NAME'}</span>
                <span></span>
                <span>{isPl ? 'NOWA PROPONOWANA NAZWA' : 'NEW PROPOSED NAME'}</span>
                <span>STATUS</span>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {previews.map((item) => {
                  const oldName = getFilenameFromPath(item.old_path);
                  const newName = getFilenameFromPath(item.new_path);
                  const isUnchanged = oldName === newName;

                  return (
                    <div
                      key={item.track_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 24px 1fr 90px',
                        gap: '12px',
                        padding: '8px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        alignItems: 'center',
                        fontSize: '0.76rem',
                        background: item.will_overwrite ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontFamily: 'var(--font-mono)',
                        }}
                        title={item.old_path}
                      >
                        {oldName}
                      </span>
                      <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                      <span
                        style={{
                          color: isUnchanged ? 'var(--text-muted)' : 'var(--accent-cyan, #06b6d4)',
                          fontWeight: isUnchanged ? 400 : 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontFamily: 'var(--font-mono)',
                        }}
                        title={item.new_path}
                      >
                        {newName}
                      </span>
                      <div>
                        {item.will_overwrite ? (
                          <span style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 600 }}>
                            {isPl ? '⚠️ Nadpisze' : '⚠️ Overwrite'}
                          </span>
                        ) : isUnchanged ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            {isPl ? 'Bez zmian' : 'Unchanged'}
                          </span>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: '0.7rem', fontWeight: 600 }}>
                            {isPl ? '✓ Zmiana' : '✓ Rename'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Stopka */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>

          <button
            onClick={handleExecuteRename}
            disabled={isExecuting || previews.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'var(--accent-pink, #ec4899)',
              border: 'none',
              color: '#fff',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: isExecuting || previews.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isExecuting || previews.length === 0 ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
            }}
          >
            <CheckCircle2 size={16} />
            {isExecuting
              ? (isPl ? 'Zmienianie nazw...' : 'Renaming...')
              : isPl
              ? `Zmień nazwy (${previews.filter((p) => getFilenameFromPath(p.old_path) !== getFilenameFromPath(p.new_path)).length} plików)`
              : `Rename (${previews.filter((p) => getFilenameFromPath(p.old_path) !== getFilenameFromPath(p.new_path)).length} files)`}
          </button>
        </div>
      </div>
    </div>
  );
};
