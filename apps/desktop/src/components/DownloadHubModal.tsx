import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Folder,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileAudio,
  Play,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface DownloadJobDto {
  id: string;
  provider: string;
  remote_url: string;
  destination_path: string;
  state: 'Pending' | 'Downloading' | 'Paused' | 'Completed' | 'Failed' | 'Cancelled';
  downloaded_bytes: number;
  total_bytes: number | null;
  expected_sha256: string | null;
  actual_sha256: string | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

interface DownloadHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshLibrary: () => void;
  onPlayPath?: (path: string) => void;
}

export const DownloadHubModal: React.FC<DownloadHubModalProps> = ({
  isOpen,
  onClose,
  onRefreshLibrary,
  onPlayPath,
}) => {
  const [remoteUrl, setRemoteUrl] = useState('');
  const [destinationFolder, setDestinationFolder] = useState('');
  const [filename, setFilename] = useState('');
  const [expectedSha, setExpectedSha] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DownloadJobDto[]>([]);
  const pollTimerRef = useRef<number | null>(null);

  // Pobierz domyślny katalog muzyki przy pierwszym otwarciu
  useEffect(() => {
    if (isOpen) {
      invoke<string>('get_default_music_dir')
        .then((dir) => {
          if (!destinationFolder) setDestinationFolder(dir);
        })
        .catch(() => {});
      fetchJobs();
    }
  }, [isOpen]);

  // Automatycznie zaproponuj nazwę pliku na podstawie wpisywanego URL
  useEffect(() => {
    if (!remoteUrl) return;
    try {
      const urlObj = new URL(remoteUrl);
      const pathname = urlObj.pathname;
      const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastSegment && (lastSegment.endsWith('.mp3') || lastSegment.endsWith('.flac') || lastSegment.endsWith('.ogg') || lastSegment.endsWith('.wav') || lastSegment.endsWith('.m4a') || lastSegment.endsWith('.opus'))) {
        setFilename(decodeURIComponent(lastSegment));
      } else if (!filename) {
        setFilename('audio_download.mp3');
      }
    } catch {
      // Ignoruj niepełny URL podczas pisania
    }
  }, [remoteUrl]);

  // Cykliczne odpytywanie o stan pobierania (co 1s, gdy modal otwarty)
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    fetchJobs();
    pollTimerRef.current = window.setInterval(fetchJobs, 1000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  const fetchJobs = async () => {
    try {
      const list = await invoke<DownloadJobDto[]>('list_download_jobs');
      setJobs(list);
    } catch (err) {
      console.warn('Błąd pobierania listy zadań:', err);
    }
  };

  const handlePickFolder = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        setDestinationFolder(selected);
      }
    } catch (err) {
      setErrorMessage(`Błąd wyboru folderu: ${String(err)}`);
    }
  };

  const handleStartDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedUrl = remoteUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Wprowadź prawidłowy adres URL audio.');
      return;
    }
    if (!destinationFolder.trim()) {
      setErrorMessage('Wskaż katalog docelowy zapisu.');
      return;
    }

    const cleanFilename = filename.trim() || 'audio_track.mp3';
    // Konstrukcja pełnej ścieżki
    const sep = destinationFolder.endsWith('/') ? '' : '/';
    const fullDestinationPath = `${destinationFolder}${sep}${cleanFilename}`;

    setIsSubmitting(true);
    try {
      await invoke('add_download_job', {
        remoteUrl: trimmedUrl,
        destinationPath: fullDestinationPath,
        expectedSha256: expectedSha.trim() || null,
      });

      setSuccessMessage('Zadanie pobierania dodane do kolejki!');
      setRemoteUrl('');
      setFilename('');
      setExpectedSha('');
      await fetchJobs();
    } catch (err) {
      setErrorMessage(`Błąd uruchamiania pobierania: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await invoke('cancel_download_job', { jobId });
      await fetchJobs();
    } catch (err) {
      console.error('Błąd anulowania zadania:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(22, 24, 38, 0.95), rgba(14, 15, 25, 0.98))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(255, 77, 148, 0.15)',
          overflow: 'hidden',
          color: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 77, 148, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--accent-pink, #ff4d94), #9d4edd)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(255, 77, 148, 0.35)',
              }}
            >
              <Download size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Legal Download Hub
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                Bezpieczne pobieranie ze zweryfikowanych źródeł (Archive.org, Podcasty, Creative Commons, URL)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* TREŚĆ MODALA */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* BANER BEZPIECZEŃSTWA AGENTS.md */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.8rem',
              color: '#bae6fd',
            }}
          >
            <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
            <span>
              Auralune pobiera pliki do chronionego bufora tymczasowego (<code>.tmp</code>), weryfikuje sumę SHA-256 i
              dokonuje atomowego przeniesienia do biblioteki. Brak obchodzenia DRM.
            </span>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#86efac',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              {successMessage}
            </div>
          )}

          {/* FORMULARZ NOWEGO POBIERANIA */}
          <form onSubmit={handleStartDownload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                Bezpośredni URL pliku audio (HTTP / HTTPS)
              </label>
              <input
                type="url"
                required
                placeholder="https://archive.org/download/.../track.flac"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Katalog zapisu
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Wybierz katalog..."
                    value={destinationFolder}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(0, 0, 0, 0.25)',
                      color: '#cbd5e1',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    style={{
                      padding: '0 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Folder size={16} /> Przeglądaj
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Nazwa pliku
                </label>
                <input
                  type="text"
                  required
                  placeholder="nazwa_utworu.flac"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                Oczekiwana suma SHA-256 <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400 }}>(opcjonalnie dla weryfikacji integralności)</span>
              </label>
              <input
                type="text"
                placeholder="np. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                value={expectedSha}
                onChange={(e) => setExpectedSha(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '6px',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--accent-pink, #ff4d94), #9d4edd)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(255, 77, 148, 0.3)',
                transition: 'opacity 0.2s',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <Download size={18} />
              {isSubmitting ? 'Rozpoczynanie...' : 'Rozpocznij bezpieczne pobieranie'}
            </button>
          </form>

          {/* LISTA ZADAŃ W KOLEJCE */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileAudio size={18} color="var(--accent-pink, #ff4d94)" /> Kolejka zadań pobierania ({jobs.length})
              </h3>
              <button
                onClick={fetchJobs}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={12} /> Odśwież listę
              </button>
            </div>

            {jobs.length === 0 ? (
              <div
                style={{
                  padding: '28px',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: '0.85rem',
                }}
              >
                Brak zadań w kolejce. Wprowadź legalny adres URL powyżej, aby rozpocząć pobieranie.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {jobs.map((job) => {
                  const percent =
                    job.total_bytes && job.total_bytes > 0
                      ? Math.min(100, Math.round((job.downloaded_bytes / job.total_bytes) * 100))
                      : null;

                  return (
                    <div
                      key={job.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background:
                                job.state === 'Completed'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : job.state === 'Downloading'
                                  ? 'rgba(56, 189, 248, 0.2)'
                                  : job.state === 'Failed'
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(255, 255, 255, 0.1)',
                              color:
                                job.state === 'Completed'
                                  ? '#4ade80'
                                  : job.state === 'Downloading'
                                  ? '#38bdf8'
                                  : job.state === 'Failed'
                                  ? '#f87171'
                                  : '#cbd5e1',
                            }}
                          >
                            {job.state === 'Downloading' ? 'Pobieranie...' : job.state}
                          </span>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '450px',
                            }}
                            title={job.destination_path}
                          >
                            {job.destination_path.split('/').pop()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {job.state === 'Downloading' && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Anuluj
                            </button>
                          )}
                          {job.state === 'Completed' && (
                            <button
                              onClick={() => {
                                onRefreshLibrary();
                                if (onPlayPath) onPlayPath(job.destination_path);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'rgba(34, 197, 94, 0.2)',
                                border: '1px solid rgba(34, 197, 94, 0.4)',
                                color: '#4ade80',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Play size={12} /> Odtwórz w Auralune
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PASEK POSTĘPU */}
                      {job.state === 'Downloading' && (
                        <div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              background: 'rgba(0,0,0,0.4)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                              marginTop: '4px',
                            }}
                          >
                            <div
                              style={{
                                width: percent !== null ? `${percent}%` : '60%',
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--accent-pink, #ff4d94), #38bdf8)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted, #94a3b8)',
                              marginTop: '4px',
                            }}
                          >
                            <span>
                              {formatBytes(job.downloaded_bytes)}
                              {job.total_bytes ? ` / ${formatBytes(job.total_bytes)}` : ''}
                            </span>
                            <span>{percent !== null ? `${percent}%` : 'Pobieranie strumieniowe...'}</span>
                          </div>
                        </div>
                      )}

                      {job.error && (
                        <div style={{ fontSize: '0.75rem', color: '#f87171' }}>
                          Błąd: {job.error}
                        </div>
                      )}

                      {job.state === 'Completed' && job.actual_sha256 && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                          SHA-256: {job.actual_sha256.substring(0, 16)}...
                          {job.expected_sha256 && ' (Zweryfikowano ✓)'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* STOPKA */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
            Zgodność ze standardem Arch Linux & AGENTS.md Etap 7
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
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
