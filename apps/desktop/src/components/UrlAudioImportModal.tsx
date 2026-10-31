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
  ListMusic,
  SlidersHorizontal,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Language } from '../i18n';

export interface ImportedItem {
  file_path: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number | null;
  format: string;
  track: any | null;
}

export interface UrlImportResult {
  total_downloaded: number;
  items: ImportedItem[];
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
  const [bitrate, setBitrate] = useState<string>('0');
  const [downloadPlaylist, setDownloadPlaylist] = useState<boolean>(false);
  const [maxItems, setMaxItems] = useState<number>(0); // 0 = all
  const [folderStructure, setFolderStructure] = useState<string>('playlist');
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

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    if (newFormat === 'mp3') {
      setBitrate('320k');
    } else if (newFormat === 'opus') {
      setBitrate('160k');
    } else if (newFormat === 'm4a') {
      setBitrate('256k');
    } else {
      setBitrate('0');
    }
  };

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
      setErrorMessage(isPl ? 'Wprowadź poprawny adres URL.' : 'Please enter a valid URL.');
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage(
        isPl
          ? 'Adres URL musi rozpoczynać się od http:// lub https://'
          : 'URL must start with http:// or https://'
      );
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
        bitrate,
        downloadPlaylist,
        maxItems: maxItems > 0 ? maxItems : null,
        folderStructure,
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

  const handlePlaySingle = (item: ImportedItem) => {
    if (item.track && onPlayTrack) {
      onPlayTrack(item.track);
    } else {
      invoke('load_file', { path: item.file_path }).then(() => {
        invoke('play').catch(() => {});
      });
    }
    onClose();
  };

  const handleQueueSingle = (item: ImportedItem) => {
    if (item.track && onAddToQueue) {
      onAddToQueue(item.track);
    } else {
      invoke('add_to_queue', { path: item.file_path }).catch(() => {});
    }
  };

  const handlePlayAll = async () => {
    if (!result || !result.items || result.items.length === 0) return;
    const first = result.items[0];
    if (first.track && onPlayTrack) {
      onPlayTrack(first.track);
    } else {
      await invoke('load_file', { path: first.file_path }).catch(() => {});
      await invoke('play').catch(() => {});
    }

    // Dodaj pozostałe do kolejki
    for (let i = 1; i < result.items.length; i++) {
      const it = result.items[i];
      if (it.track && onAddToQueue) {
        onAddToQueue(it.track);
      } else {
        await invoke('add_to_queue', { path: it.file_path }).catch(() => {});
      }
    }
    onClose();
  };

  const handleQueueAll = async () => {
    if (!result || !result.items || result.items.length === 0) return;
    for (const it of result.items) {
      if (it.track && onAddToQueue) {
        onAddToQueue(it.track);
      } else {
        await invoke('add_to_queue', { path: it.file_path }).catch(() => {});
      }
    }
    onClose();
  };

  const handleOpenFolder = (pathToShow?: string) => {
    const target = pathToShow || (result ? result.file_path : targetDir);
    if (target) {
      invoke('open_containing_folder', { path: target }).catch(() => {});
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
          width: result && result.items && result.items.length > 1 ? '680px' : '580px',
          maxWidth: '94vw',
          maxHeight: '92vh',
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
          transition: 'width 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(236, 72, 153, 0.35))',
                border: '1px solid rgba(168, 85, 247, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d8b4fe',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)',
              }}
            >
              <Download size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.3px' }}>
                {isPl ? 'Importer audio URL (foobar2000 / Poweramp)' : 'URL Audio Importer (foobar2000 / Poweramp)'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary, #a0a0b5)' }}>
                {isPl
                  ? 'Pobieranie ścieżek, playlist i kanałów z filtrami bitratu oraz strukturą katalogów'
                  : 'Download tracks, playlists & channels with bitrate filters and directory hierarchies'}
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
            title={isPl ? 'Zamknij (Esc)' : 'Close (Esc)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Treść formularza lub widok sukcesu */}
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
                {isPl ? 'Adres URL utworu, playlisty lub kanału' : 'URL of track, playlist or artist channel'}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="np. https://soundcloud.com/... lub YouTube, Bandcamp, Mixcloud"
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
                  title={isPl ? 'Wklej ze schowka' : 'Paste from clipboard'}
                >
                  <Clipboard size={15} />
                  {isPl ? 'Wklej' : 'Paste'}
                </button>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                {isPl
                  ? 'Wspiera YouTube, SoundCloud (utwory, sety, profile i playlisty), Bandcamp oraz linki HTTP/HTTPS.'
                  : 'Supports YouTube, SoundCloud (tracks, sets, channels & playlists), Bandcamp and HTTP/HTTPS links.'}
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
                {isPl ? 'Format audio do wyodrębnienia' : 'Target audio format'}
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                }}
              >
                {[
                  { id: 'flac', name: 'FLAC', desc: isPl ? 'Bezstratny (Bit-perfect)' : 'Lossless' },
                  { id: 'mp3', name: 'MP3', desc: isPl ? 'MPEG Audio Layer 3' : 'MPEG-3' },
                  { id: 'opus', name: 'OPUS', desc: isPl ? 'Nowoczesny i przejrzysty' : 'Modern Hi-Fi' },
                  { id: 'm4a', name: 'M4A', desc: isPl ? 'Apple AAC / iTunes' : 'Apple AAC' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => handleFormatChange(fmt.id)}
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

            {/* Wybór bitratu / jakości audio */}
            {format !== 'flac' ? (
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <SlidersHorizontal size={15} style={{ color: '#c084fc' }} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#f0f0f5' }}>
                    {isPl ? 'Jakość kodowania i bitrate (FFmpeg)' : 'Encoding quality & bitrate (FFmpeg)'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {format === 'mp3' && (
                    <>
                      {[
                        { id: '320k', label: '320 kbps (CBR)', desc: 'Studio' },
                        { id: '256k', label: '256 kbps (CBR)', desc: 'Wysoka' },
                        { id: '192k', label: '192 kbps (CBR)', desc: 'Standard' },
                        { id: '0', label: 'V0 VBR (~245k)', desc: 'Zmienna' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBitrate(b.id)}
                          disabled={isLoading}
                          style={{
                            background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                            border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: bitrate === b.id ? '#fff' : '#cbd5e1',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{b.label}</span>
                          <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {format === 'opus' && (
                    <>
                      {[
                        { id: '160k', label: '160 kbps (Studio)', desc: 'Transparentny Hi-Fi' },
                        { id: '128k', label: '128 kbps (Standard)', desc: 'Optymalny' },
                        { id: '96k', label: '96 kbps (Kompakt)', desc: 'Lekki' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBitrate(b.id)}
                          disabled={isLoading}
                          style={{
                            background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                            border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: bitrate === b.id ? '#fff' : '#cbd5e1',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{b.label}</span>
                          <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {format === 'm4a' && (
                    <>
                      {[
                        { id: '256k', label: '256 kbps (AAC)', desc: 'iTunes Plus' },
                        { id: '192k', label: '192 kbps (AAC)', desc: 'Standard' },
                        { id: '128k', label: '128 kbps (AAC)', desc: 'Kompakt' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBitrate(b.id)}
                          disabled={isLoading}
                          style={{
                            background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                            border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: bitrate === b.id ? '#fff' : '#cbd5e1',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{b.label}</span>
                          <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: '#bae6fd',
                }}
              >
                <Sparkles size={16} style={{ flexShrink: 0, color: '#38bdf8' }} />
                <span>
                  {isPl
                    ? 'Format FLAC koduje dźwięk bezstratnie (bit-perfect) z zachowaniem pełnego pasma źródłowego.'
                    : 'FLAC format encodes lossless bit-perfect audio preserving all original frequency spectrum.'}
                </span>
              </div>
            )}

            {/* Opcja pobierania całej playlisty / albumu / kanału SoundCloud */}
            <div
              style={{
                backgroundColor: downloadPlaylist ? 'rgba(168, 85, 247, 0.14)' : 'rgba(0, 0, 0, 0.22)',
                border: downloadPlaylist ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={downloadPlaylist}
                    onChange={(e) => setDownloadPlaylist(e.target.checked)}
                    disabled={isLoading}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#a855f7',
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                      {isPl
                        ? 'Pobierz całą playlistę / album / kanał SoundCloud'
                        : 'Download full playlist / album / SoundCloud channel'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '1px' }}>
                      {isPl
                        ? 'Wyodrębnia wszystkie utwory z linku zbiorczego i kolejkuje je w bibliotece'
                        : 'Extracts all tracks from collection URL and indexes them in library'}
                    </div>
                  </div>
                </label>
                {downloadPlaylist && (
                  <span
                    style={{
                      background: 'rgba(168, 85, 247, 0.3)',
                      color: '#d8b4fe',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ListMusic size={13} />
                    {isPl ? 'Tryb zbiorczy' : 'Batch mode'}
                  </span>
                )}
              </div>

              {/* Dodatkowe opcje przy włączonej playliście */}
              {downloadPlaylist && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {/* Limit pobieranych utworów */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.76rem',
                        fontWeight: 500,
                        color: '#cbd5e1',
                        marginBottom: '4px',
                      }}
                    >
                      {isPl ? 'Limit pobieranych utworów:' : 'Track download limit:'}
                    </label>
                    <select
                      value={maxItems}
                      onChange={(e) => setMaxItems(Number(e.target.value))}
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        color: '#f8fafc',
                        fontSize: '0.82rem',
                        outline: 'none',
                      }}
                    >
                      <option value={0}>{isPl ? 'Bez limitu (Wszystkie utwory)' : 'No limit (All tracks)'}</option>
                      <option value={5}>{isPl ? 'Maksymalnie 5 utworów' : 'Max 5 tracks'}</option>
                      <option value={10}>{isPl ? 'Maksymalnie 10 utworów' : 'Max 10 tracks'}</option>
                      <option value={25}>{isPl ? 'Maksymalnie 25 utworów' : 'Max 25 tracks'}</option>
                      <option value={50}>{isPl ? 'Maksymalnie 50 utworów' : 'Max 50 tracks'}</option>
                      <option value={100}>{isPl ? 'Maksymalnie 100 utworów' : 'Max 100 tracks'}</option>
                    </select>
                  </div>

                  {/* Struktura folderów */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.76rem',
                        fontWeight: 500,
                        color: '#cbd5e1',
                        marginBottom: '4px',
                      }}
                    >
                      {isPl ? 'Układ katalogów (foobar2000):' : 'Folder hierarchy (foobar2000):'}
                    </label>
                    <select
                      value={folderStructure}
                      onChange={(e) => setFolderStructure(e.target.value)}
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        color: '#f8fafc',
                        fontSize: '0.82rem',
                        outline: 'none',
                      }}
                    >
                      <option value="playlist">
                        {isPl ? 'Podfolder playlisty / albumu (Katalog / 01 - Tytuł)' : 'Playlist / Album folder'}
                      </option>
                      <option value="artist_album">
                        {isPl ? 'Hierarchia Wykonawca / Album (Artysta / Album / 01)' : 'Artist / Album hierarchy'}
                      </option>
                      <option value="flat">
                        {isPl ? 'Płaski katalog (wszystkie bezpośrednio w folderze)' : 'Flat (all in one folder)'}
                      </option>
                    </select>
                  </div>
                </div>
              )}
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
                {isPl ? 'Katalog docelowy pobierania' : 'Destination folder'}
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
                  {isPl ? 'Zmień...' : 'Browse...'}
                </button>
              </div>
            </div>

            {/* Informacje o silniku yt-dlp */}
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
                {isPl
                  ? 'Auralune automatycznie pobiera okładki, metadane wykonawcy i albumu oraz bezzwłocznie indeksuje nowe pliki w lokalnej bazie SQLite.'
                  : 'Auralune automatically embeds cover art and artist metadata, and immediately indexes new tracks into the local SQLite database.'}
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
                {isPl ? 'Anuluj' : 'Cancel'}
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
                    {downloadPlaylist
                      ? isPl
                        ? 'Pobieranie i indeksowanie playlisty...'
                        : 'Harvesting & indexing playlist...'
                      : isPl
                        ? 'Pobieranie i indeksowanie...'
                        : 'Downloading & indexing...'}
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    {downloadPlaylist
                      ? isPl
                        ? 'Pobierz całą playlistę / kanał'
                        : 'Download full playlist / channel'
                      : isPl
                        ? 'Pobierz i dodaj do biblioteki'
                        : 'Download & add to library'}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Widok sukcesu (Single item lub Multi-track playlist review) */
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
                  {result.items && result.items.length > 1
                    ? isPl
                      ? `Pomyślnie pobrano i zindeksowano ${result.items.length} utworów!`
                      : `Successfully downloaded & indexed ${result.items.length} tracks!`
                    : isPl
                      ? 'Utwór został pomyślnie pobrany i zindeksowany!'
                      : 'Audio track successfully downloaded & indexed!'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#bbf7d0', marginTop: '2px' }}>
                  {isPl
                    ? 'Wszystkie pliki zostały natychmiast zindeksowane w bibliotece Auralune i są gotowe do odtworzenia.'
                    : 'All audio files are indexed in Auralune database and ready for immediate playback.'}
                </div>
              </div>
            </div>

            {/* Wariant A: Pojedynczy utwór */}
            {(!result.items || result.items.length <= 1) && (
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
                    {result.artist} • {result.album || (isPl ? 'Import z URL' : 'URL Import')}
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
                      {result.format} {bitrate !== '0' ? `(${bitrate.toUpperCase()})` : ''}
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
            )}

            {/* Wariant B: Lista pobranych utworów (Playlista / Kanał) */}
            {result.items && result.items.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Przyciski zbiorcze na górze listy */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handlePlayAll}
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
                    {isPl ? 'Odtwórz wszystkie utwory' : 'Play all tracks'}
                  </button>
                  <button
                    type="button"
                    onClick={handleQueueAll}
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
                    {isPl ? 'Dodaj wszystkie do kolejki' : 'Queue all tracks'}
                  </button>
                </div>

                {/* Przewijana lista pobranych utworów */}
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {result.items.map((item, idx) => (
                    <div
                      key={item.file_path || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: '#94a3b8',
                            width: '24px',
                            textAlign: 'right',
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}.
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#f8fafc',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              color: '#cbd5e1',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.artist} {item.album ? `• ${item.album}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#94a3b8',
                            fontFamily: 'monospace',
                          }}
                        >
                          {formatDuration(item.duration_ms)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePlaySingle(item)}
                          style={{
                            background: 'rgba(168, 85, 247, 0.2)',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            color: '#d8b4fe',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={isPl ? 'Odtwórz ten utwór' : 'Play this track'}
                        >
                          <Play size={13} fill="#d8b4fe" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQueueSingle(item)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={isPl ? 'Dodaj do kolejki' : 'Add to queue'}
                        >
                          <ListPlus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Przyciski po sukcesie (pojedynczy utwór) */}
            {(!result.items || result.items.length <= 1) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handlePlaySingle(result.items && result.items[0] ? result.items[0] : (result as any))}
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
                  {isPl ? 'Odtwórz teraz' : 'Play now'}
                </button>
                <button
                  type="button"
                  onClick={() => handleQueueSingle(result.items && result.items[0] ? result.items[0] : (result as any))}
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
                  {isPl ? 'Dodaj do kolejki' : 'Add to queue'}
                </button>
              </div>
            )}

            {/* Dolny pasek nawigacyjny po pobraniu */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => handleOpenFolder()}
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
                {isPl ? 'Pokaż w folderze' : 'Show in folder'}
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
                  {isPl ? '+ Pobierz kolejny link' : '+ Download another link'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                  }}
                >
                  {isPl ? 'Gotowe' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
