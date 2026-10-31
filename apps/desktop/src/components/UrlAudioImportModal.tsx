import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  Play,
  ListPlus,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clipboard,
  Music,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Language } from '../i18n';

export interface UrlImportResult {
  file_path: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number | null;
  format: string;
  track: any | null;
}

interface UrlAudioImportModalProps {
  isOpen: boolean;
  currentLang?: Language;
  onClose: () => void;
  onPlayTrack?: (track: any) => void;
  onAddToQueue?: (track: any) => void;
  onLibraryUpdated?: () => void;
}

export const UrlAudioImportModal: React.FC<UrlAudioImportModalProps> = ({
  isOpen,
  currentLang = 'pl',
  onClose,
  onPlayTrack,
  onAddToQueue,
  onLibraryUpdated,
}) => {
  const [url, setUrl] = useState<string>('');
  const [format, setFormat] = useState<string>('flac');
  const [targetDir, setTargetDir] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UrlImportResult | null>(null);

  const isPl = currentLang === 'pl';

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setResult(null);
      // Pobierz domyślny folder muzyki
      invoke<string>('get_default_music_dir')
        .then((dir) => setTargetDir(dir))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setUrl(text.trim());
        setErrorMessage(null);
      }
    } catch {
      // Ignoruj błąd dostępu do schowka
    }
  };

  const handlePickDirectory = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        setTargetDir(selected);
      }
    } catch (e: any) {
      setErrorMessage(String(e));
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setErrorMessage('Wprowadź poprawny adres URL.');
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage('Adres URL musi rozpoczynać się od http:// lub https://');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await invoke<UrlImportResult>('import_audio_from_url', {
        url: cleanUrl,
        targetDir: targetDir.trim() || null,
        format,
      });

      setResult(res);
      if (onLibraryUpdated) {
        onLibraryUpdated();
      }
    } catch (err: any) {
      setErrorMessage(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayNow = () => {
    if (result) {
      if (result.track && onPlayTrack) {
        onPlayTrack(result.track);
      } else {
        invoke('load_file', { path: result.file_path }).then(() => {
          invoke('play').catch(() => {});
        });
      }
      onClose();
    }
  };

  const handleAddToQueue = () => {
    if (result) {
      if (result.track && onAddToQueue) {
        onAddToQueue(result.track);
      } else {
        invoke('add_to_queue', { path: result.file_path }).catch(() => {});
      }
      onClose();
    }
  };

  const handleOpenFolder = () => {
    if (result) {
      invoke('open_containing_folder', { path: result.file_path }).catch(() => {});
    }
  };

  const handleResetForAnother = () => {
    setUrl('');
    setResult(null);
    setErrorMessage(null);
  };

  const formatDuration = (ms: number | null): string => {
    if (!ms || ms <= 0) return '--:--';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '540px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-bg-surface, rgba(20, 20, 30, 0.94))',
          borderRadius: '16px',
          border: '1px solid var(--color-border-accent, rgba(160, 100, 255, 0.3))',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(160, 100, 255, 0.2)',
          padding: '24px',
          color: 'var(--color-text-main, #f0f0f5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(236, 72, 153, 0.3))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d8b4fe',
              }}
            >
              <Download size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.3px' }}>
                {isPl ? 'Wbudowany importer audio z URL' : 'Built-in URL Audio Importer'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary, #a0a0b5)' }}>
                {isPl
                  ? 'Pobieranie ścieżki dźwiękowej z okładką i natychmiastowe indeksowanie'
                  : 'Download audio track with cover art and instant library indexing'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary, #8e8ea0)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Zamknij (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Treść */}
        {!result ? (
          <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Input URL */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: 'var(--color-text-main, #f0f0f5)',
                }}
              >
                Adres URL utworu lub wideo
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="np. https://www.youtube.com/watch?v=... lub SoundCloud, Bandcamp"
                  disabled={isLoading}
                  autoFocus
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.15))',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  disabled={isLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0 12px',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    whiteSpace: 'nowrap',
                  }}
                  title="Wklej ze schowka"
                >
                  <Clipboard size={15} />
                  Wklej
                </button>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Wspiera YouTube, SoundCloud, Bandcamp, Mixcloud oraz bezpośrednie pliki audio HTTP/HTTPS.
              </span>
            </div>

            {/* Wybór formatu audio */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '8px',
                }}
              >
                Format audio do wyodrębnienia
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                }}
              >
                {[
                  { id: 'flac', name: 'FLAC', desc: 'Bezstratny' },
                  { id: 'mp3', name: 'MP3', desc: '320 kbps' },
                  { id: 'opus', name: 'OPUS', desc: 'Nowoczesny' },
                  { id: 'm4a', name: 'M4A', desc: 'Apple/AAC' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id)}
                    disabled={isLoading}
                    style={{
                      background:
                        format === fmt.id
                          ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3))'
                          : 'rgba(0, 0, 0, 0.25)',
                      border:
                        format === fmt.id
                          ? '1px solid #c084fc'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '8px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                      {fmt.name}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                      {fmt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Folder docelowy */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '6px',
                }}
              >
                Katalog docelowy
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={targetDir}
                  onChange={(e) => setTargetDir(e.target.value)}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={handlePickDirectory}
                  disabled={isLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <FolderOpen size={15} />
                  Zmień...
                </button>
              </div>
            </div>

            {/* Informacje o yt-dlp */}
            <div
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: '#e9d5ff',
              }}
            >
              <Sparkles size={16} style={{ flexShrink: 0, color: '#c084fc' }} />
              <span>
                Pobieranie korzysta z systemowego silnika <code>yt-dlp</code> i automatycznie osadza miniaturę jako okładkę utworu oraz tagi wykonawcy.
              </span>
            </div>

            {/* Błąd */}
            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  gap: '10px',
                  color: '#fca5a5',
                  fontSize: '0.82rem',
                  whiteSpace: 'pre-line',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Przycisk akcji */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !url.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Pobieranie i indeksowanie...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Pobierz i dodaj do biblioteki
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Widok sukcesu */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#86efac',
              }}
            >
              <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Utwór został pomyślnie pobrany i zindeksowany!
                </div>
                <div style={{ fontSize: '0.78rem', color: '#bbf7d0', marginTop: '2px' }}>
                  Plik został dodany do biblioteki Auralune i jest gotowy do natychmiastowego odtworzenia.
                </div>
              </div>
            </div>

            {/* Karta utworu */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d8b4fe',
                  flexShrink: 0,
                }}
              >
                <Music size={28} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={result.title}
                >
                  {result.title}
                </h3>
                <div
                  style={{
                    fontSize: '0.84rem',
                    color: '#cbd5e1',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {result.artist} • {result.album || 'Import z URL'}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.72rem' }}>
                  <span
                    style={{
                      background: 'rgba(168, 85, 247, 0.25)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: '#d8b4fe',
                      fontWeight: 600,
                    }}
                  >
                    {result.format}
                  </span>
                  {result.duration_ms && (
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: '#94a3b8',
                      }}
                    >
                      {formatDuration(result.duration_ms)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Przyciski po sukcesie */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handlePlayNow}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
                  }}
                >
                  <Play size={18} fill="#fff" />
                  Odtwórz teraz
                </button>
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#e2e8f0',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <ListPlus size={18} />
                  Dodaj do kolejki
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    padding: '6px 0',
                  }}
                >
                  <FolderOpen size={15} />
                  Pokaż w folderze
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleResetForAnother}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#c084fc',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      fontWeight: 500,
                    }}
                  >
                    + Pobierz kolejny link
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    Gotowe
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
