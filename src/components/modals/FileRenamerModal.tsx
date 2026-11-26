import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '../../api/ipc';
import { FileEdit, X, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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
  const loc = getTranslations(currentLang);
  const presetPatterns = [
    { label: loc.fileRenamer.presetTrackArtistTitle, pattern: '%track% - %artist% - %title%' },
    { label: loc.fileRenamer.presetArtistTitle, pattern: '%artist% - %title%' },
    { label: loc.fileRenamer.presetArtistAlbumTrackTitle, pattern: '%artist% - %album% - %track% - %title%' },
    { label: loc.fileRenamer.presetFolderHierarchy, pattern: '%artist%/%album%/%track% - %title%' },
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
      console.error('Rename preview failed:', err);
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
      setError(loc.fileRenamer.noFilesToRename);
      return;
    }

    const hasOverwrites = previews.some((p) => p.will_overwrite);
    if (
      hasOverwrites &&
      !window.confirm(loc.fileRenamer.confirmOverwrite)
    ) {
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);
      const count = await invoke<number>('execute_rename_tracks', {
        items: validItems,
        allowOverwrite: hasOverwrites,
      });
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
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[90vh] max-w-212.5 flex-col overflow-hidden rounded-2xl border border-line-accent bg-surface"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-line bg-linear-to-r from-pink-500/15 to-accent-cyan/15 px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-pink-500/25 text-accent-pink">
            <FileEdit size={18} />
          </div>
          <div>
            <h3 className="m-0 text-base font-bold text-fg">
              {loc.fileRenamer.title}
            </h3>
            <p className="m-0 text-ui text-fg-secondary">
              {loc.fileRenamer.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex rounded-lg border-0 bg-transparent p-1.5 text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        {error && (
          <div
            className="flex items-center gap-2 rounded-lg border border-accent-red/40 bg-accent-red/15 px-3.5 py-2.5 text-ui text-red-400"
          >
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {successCount !== null && (
          <div
            className="flex items-center gap-2.5 rounded-xl border border-accent-green/40 bg-accent-green/15 px-4 py-3 text-ui text-emerald-400"
          >
            <CheckCircle2 size={18} />
            <span>{fmt(loc.fileRenamer.renameSuccess, String(successCount))}</span>
          </div>
        )}

        {/* Pattern configuration */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white/3 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-ui font-semibold text-fg">
              {loc.fileRenamer.pattern}
            </span>
            <span className="text-xs text-fg-muted">
              {loc.fileRenamer.availableTags} <code>%artist%</code>, <code>%title%</code>, <code>%album%</code>, <code>%track%</code>, <code>%disc%</code>, <code>%ext%</code>
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="%track% - %artist% - %title%"
              className="flex-1 rounded-lg border border-line-accent bg-black/40 px-3 py-2 font-mono text-sm text-fg"
            />
            <button
              type="button"
              onClick={() => updatePreview(pattern)}
              title={loc.fileRenamer.refreshPreview}
              className="flex items-center rounded-lg border border-line bg-white/8 px-3 py-2 text-fg-secondary"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Presets */}
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <span className="self-center text-xs text-fg-muted">
              {loc.fileRenamer.presets}
            </span>
            {presetPatterns.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPattern(p.pattern)}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs',
                  pattern === p.pattern ? 'bg-pink-500/25' : 'bg-white/5',
                  pattern === p.pattern ? 'border-accent-pink' : 'border-line',
                  pattern === p.pattern ? 'text-fg' : 'text-fg-secondary',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Change preview table */}
        <div className="flex flex-col gap-2">
          <span className="text-ui font-semibold text-fg-secondary">
            {fmt(loc.fileRenamer.previewCount, String(previews.length))}
          </span>

          <div className="overflow-hidden rounded-xl border border-line bg-black/30">
            <div
              className="grid grid-cols-[1fr_--spacing(6)_1fr_--spacing(22.5)] gap-3 border-b border-line bg-white/4 px-3.5 py-2 text-xs font-bold text-fg-muted"
            >
              <span>{loc.fileRenamer.currentName}</span>
              <span></span>
              <span>{loc.fileRenamer.proposedName}</span>
              <span>STATUS</span>
            </div>

            <div className="max-h-70 overflow-y-auto">
              {previews.map((item) => {
                const oldName = getFilenameFromPath(item.old_path);
                const newName = getFilenameFromPath(item.new_path);
                const isUnchanged = oldName === newName;

                return (
                  <div
                    key={item.track_id}
                    className={cn(
                      'grid grid-cols-[1fr_--spacing(6)_1fr_--spacing(22.5)] items-center gap-3 border-b border-white/3 px-3.5 py-2 text-xs',
                      item.will_overwrite ? 'bg-accent-red/8' : 'bg-transparent',
                    )}
                  >
                    <span
                      className="truncate font-mono text-fg-muted"
                      title={item.old_path}
                    >
                      {oldName}
                    </span>
                    <ArrowRight size={13} className="text-fg-muted" />
                    <span
                      className={cn(
                        'truncate font-mono',
                        isUnchanged ? 'text-fg-muted' : 'text-accent-cyan',
                        isUnchanged ? 'font-normal' : 'font-semibold',
                      )}
                      title={item.new_path}
                    >
                      {newName}
                    </span>
                    <div>
                      {item.will_overwrite ? (
                        <span className="text-xxs font-semibold text-red-400">
                          {loc.fileRenamer.statusOverwrite}
                        </span>
                      ) : isUnchanged ? (
                        <span className="text-xxs text-fg-muted">
                          {loc.fileRenamer.statusUnchanged}
                        </span>
                      ) : (
                        <span className="text-xxs font-semibold text-emerald-400">
                          {loc.fileRenamer.statusRename}
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line bg-black/20 px-5 py-3.5">
        <button
          onClick={onClose}
          className="rounded-lg border border-line bg-white/6 px-4 py-2 text-ui text-fg-secondary"
        >
          {loc.common.cancel}
        </button>

        <button
          onClick={handleExecuteRename}
          disabled={isExecuting || previews.length === 0}
          className={cn(
            'flex items-center gap-2 rounded-lg border-0 bg-accent-pink px-4.5 py-2 text-ui font-bold text-fg shadow-lift shadow-pink-500/35',
            isExecuting || previews.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer',
            isExecuting || previews.length === 0 ? 'opacity-60' : 'opacity-100',
          )}
        >
          <CheckCircle2 size={16} />
          {isExecuting
            ? loc.fileRenamer.renamingProgress
            : fmt(loc.fileRenamer.renameBtn, String(previews.filter((p) => getFilenameFromPath(p.old_path) !== getFilenameFromPath(p.new_path)).length))}
        </button>
      </div>
    </ModalShell>
  );
};
