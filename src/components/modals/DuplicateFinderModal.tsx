import React, { useCallback, useEffect, useId, useState } from 'react';
import { invoke } from '../../api/ipc';
import { Copy, Trash2, FolderOpen, Play, RefreshCw, AlertTriangle, CheckCircle2 } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { formatBytes } from '../../utils/fileSizeFormat';
import { formatTime } from '../../utils/timeFormat';
import { cn } from '../../utils/cn';
import { Button, Callout, ModalBody, ModalFooter, ModalHeader, ModalShell } from '../ui';

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
  currentLang?: Language;
}

export const DuplicateFinderModal: React.FC<DuplicateFinderModalProps> = ({
  onClose,
  onPlayTrack,
  onLibraryChanged,
  currentLang = 'pl',
}) => {
  const loc = getTranslations(currentLang);
  const titleId = useId();
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
      console.error('Duplicate search failed:', err);
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
      ? loc.duplicateFinder.confirmDelete
      : loc.duplicateFinder.confirmRemoveDb;

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      await invoke('delete_track_record', { trackId, deleteFile });
      setSuccessMsg(fmt(loc.duplicateFinder.removeSuccess, title));
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadDuplicates();
      onLibraryChanged?.();
    } catch (err) {
      setError(fmt(loc.duplicateFinder.removeError, String(err)));
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_containing_folder', { path });
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <ModalShell onClose={onClose} layer="studio" size="xl" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.duplicateFinder.title}
        subtitle={loc.duplicateFinder.subtitle}
        icon={<Copy size={20} />}
        tone="cyan"
        onClose={onClose}
        closeLabel={loc.common.close}
        actions={
          <Button size="sm" onClick={loadDuplicates} disabled={isLoading} title={loc.duplicateFinder.refreshSearch}>
            <RefreshCw size={14} className={cn(isLoading && 'motion-safe:animate-spin')} />
            {loc.duplicateFinder.refresh}
          </Button>
        }
      />

      <ModalBody className="flex flex-col gap-4">
        {error && (
          <Callout tone="danger" icon={<AlertTriangle size={16} />} className="text-ui text-accent-red">
            {error}
          </Callout>
        )}
        {successMsg && (
          <Callout tone="green" icon={<CheckCircle2 size={16} />} className="text-ui text-accent-green">
            {successMsg}
          </Callout>
        )}

        {isLoading && (
          <div className="p-10 text-center text-fg-muted">
            {loc.duplicateFinder.scanning}
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div
            className="flex flex-col items-center gap-2.5 rounded-xl bg-white/2 px-5 py-10 text-center text-fg-muted"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-green/15 text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-md font-semibold text-fg">
              {loc.duplicateFinder.noDuplicates}
            </span>
            <span className="max-w-100 text-ui">
              {loc.duplicateFinder.noDuplicatesDesc}
            </span>
          </div>
        )}

        {!isLoading && groups.length > 0 && (
          <div className="flex flex-col gap-3.5">
            <div className="text-ui text-fg-secondary">
              {fmt(loc.duplicateFinder.detectedGroups, String(groups.length), String(groups.reduce((acc, g) => acc + g.tracks.length, 0)))}
            </div>

            {groups.map((group, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2.5 rounded-xl border border-line bg-white/3 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-md font-bold text-accent-pink">
                    🎵 {group.key}
                  </span>
                  <span className="rounded-md bg-accent-cyan/20 px-2 py-0.5 text-xs font-semibold text-accent-cyan">
                    {group.count} {loc.duplicateFinder.copies}
                  </span>
                </div>

                {/* File rows in the group */}
                <div className="flex flex-col gap-1.5">
                  {group.tracks.map((track) => {
                    const isLossless = ['flac', 'wav', 'alac', 'aiff'].includes(track.format.toLowerCase());
                    return (
                      <div
                        key={track.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line bg-black/30 px-3 py-2"
                      >
                        <div className="flex min-w-30 items-center gap-2">
                          <span
                            className={cn(
                              'rounded-sm px-1.5 py-0.5 text-xs font-bold',
                              isLossless ? 'bg-accent-green/25' : 'bg-white/10',
                              isLossless ? 'text-emerald-400' : 'text-fg-secondary',
                            )}
                          >
                            {track.format.toUpperCase()}
                          </span>
                          <span className="font-mono text-xs text-fg-muted">
                            {track.bit_depth ? `${track.bit_depth}-bit ` : ''}
                            {Math.round(track.sample_rate / 1000)}kHz
                          </span>
                        </div>

                        <div className="flex flex-1 flex-col overflow-hidden">
                          <span
                            className="truncate text-xs text-fg-secondary"
                            title={track.path}
                          >
                            {track.path}
                          </span>
                          <span className="text-xs text-fg-muted">
                            {loc.duplicateFinder.size} {formatBytes(track.file_size)} • {loc.duplicateFinder.duration} {formatTime(track.duration_ms)} • {loc.duplicateFinder.plays} {track.play_count || 0}
                          </span>
                        </div>

                        {/* File actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onPlayTrack(track.path)}
                            title={loc.duplicateFinder.playFile}
                            className="flex rounded-md border border-accent-cyan bg-accent-cyan/20 p-1.5 text-accent-cyan"
                          >
                            <Play size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenFolder(track.path)}
                            title={loc.duplicateFinder.showInFolder}
                            className="flex rounded-md border border-line bg-white/6 p-1.5 text-fg-secondary"
                          >
                            <FolderOpen size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(track.id, false, track.title)}
                            title={loc.duplicateFinder.removeFromDb}
                            className="rounded-md border border-line bg-white/6 p-1.5 text-xs text-fg-muted"
                          >
                            {loc.duplicateFinder.removeEntry}
                          </button>
                          <button
                            onClick={() => handleDelete(track.id, true, track.title)}
                            title={loc.duplicateFinder.deleteFromDisk}
                            className="flex rounded-md border border-accent-red/30 bg-accent-red/15 p-1.5 text-red-400"
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
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>{loc.common.close}</Button>
      </ModalFooter>
    </ModalShell>
  );
};
