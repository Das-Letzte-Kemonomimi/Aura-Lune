import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { UrlImportResultView } from './url-import/UrlImportResultView';
import { UrlImportForm } from './url-import/UrlImportForm';
import { formatDuration } from '../../utils/timeFormat';

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

export interface UrlAudioImportModalProps {
  isOpen: boolean;
  currentLang?: Language;
  onClose: () => void;
  onPlayTrack?: (track: any) => void;
  onAddToQueue?: (track: any) => void;
  onLibraryUpdated?: () => void;
}

export const UrlAudioImportModal: React.FC<UrlAudioImportModalProps> = (props) => {
  const {
    isOpen,
    currentLang = 'pl',
    onClose,
    onPlayTrack,
    onAddToQueue,
    onLibraryUpdated,
  } = props;
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

  const loc = getTranslations(currentLang);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      queueMicrotask(() => {
        if (active) {
          setErrorMessage(null);
          setResult(null);
        }
      });
      // Pobierz domyślny folder muzyki
      invoke<string>('get_default_music_dir')
        .then((dir) => {
          if (active) setTargetDir(dir);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
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
    } catch (e: unknown) {
      setErrorMessage(String(e));
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setErrorMessage(loc.urlImport.errorInvalidUrl);
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage(loc.urlImport.errorInvalidUrl);
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
    } catch (err: unknown) {
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
                {loc.urlImport.title}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary, #a0a0b5)' }}>
                {loc.urlImport.subtitle}
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
            title={loc.urlImport.closeEsc}
          >
            <X size={20} />
          </button>
        </div>

        {/* Treść formularza lub widok sukcesu */}
        {!result ? (
          <UrlImportForm {...props} handleImport={handleImport} loc={loc} url={url} setUrl={setUrl} isLoading={isLoading} handlePasteClipboard={handlePasteClipboard} handleFormatChange={handleFormatChange} format={format} setBitrate={setBitrate} bitrate={bitrate} downloadPlaylist={downloadPlaylist} setDownloadPlaylist={setDownloadPlaylist} maxItems={maxItems} setMaxItems={setMaxItems} folderStructure={folderStructure} setFolderStructure={setFolderStructure} targetDir={targetDir} setTargetDir={setTargetDir} handlePickDirectory={handlePickDirectory} errorMessage={errorMessage} />
        ) : (
          /* Widok sukcesu (Single item lub Multi-track playlist review) */
          <UrlImportResultView {...props} result={result} loc={loc} bitrate={bitrate} formatDuration={formatDuration} handlePlayAll={handlePlayAll} handleQueueAll={handleQueueAll} handlePlaySingle={handlePlaySingle} handleQueueSingle={handleQueueSingle} handleOpenFolder={handleOpenFolder} handleResetForAnother={handleResetForAnother} />
        )}
      </div>
    </div>
  );
};
