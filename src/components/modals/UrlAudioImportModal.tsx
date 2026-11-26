import React, { useEffect, useId, useState } from 'react';
import {
  Download,
} from '../ui/icons';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { UrlImportResultView } from './url-import/UrlImportResultView';
import { UrlImportForm } from './url-import/UrlImportForm';
import { formatDuration } from '../../utils/timeFormat';
import { ModalBody, ModalHeader, ModalShell } from '../ui';

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
  const titleId = useId();
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
      // Fetch the default music folder
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
      // Ignore clipboard access errors
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

    // Add the rest to the queue
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
    <ModalShell
      onClose={onClose}
      layer="nested"
      size={result && result.items && result.items.length > 1 ? 'lg' : 'md'}
      labelledBy={titleId}
    >
      <ModalHeader
        titleId={titleId}
        title={loc.urlImport.title}
        subtitle={loc.urlImport.subtitle}
        icon={<Download size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.urlImport.closeEsc}
      />

      {/* Form content or the success view */}
      <ModalBody className="flex flex-col gap-5">
        {!result ? (
          <UrlImportForm {...props} handleImport={handleImport} loc={loc} url={url} setUrl={setUrl} isLoading={isLoading} handlePasteClipboard={handlePasteClipboard} handleFormatChange={handleFormatChange} format={format} setBitrate={setBitrate} bitrate={bitrate} downloadPlaylist={downloadPlaylist} setDownloadPlaylist={setDownloadPlaylist} maxItems={maxItems} setMaxItems={setMaxItems} folderStructure={folderStructure} setFolderStructure={setFolderStructure} targetDir={targetDir} setTargetDir={setTargetDir} handlePickDirectory={handlePickDirectory} errorMessage={errorMessage} />
        ) : (
          /* Success view (single item or multi-track playlist review) */
          <UrlImportResultView {...props} result={result} loc={loc} bitrate={bitrate} formatDuration={formatDuration} handlePlayAll={handlePlayAll} handleQueueAll={handleQueueAll} handlePlaySingle={handlePlaySingle} handleQueueSingle={handleQueueSingle} handleOpenFolder={handleOpenFolder} handleResetForAnother={handleResetForAnother} />
        )}
      </ModalBody>
    </ModalShell>
  );
};
