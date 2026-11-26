import React from 'react';
import type { Translations } from '../../../i18n';
import { Play, ListPlus, FolderOpen, CheckCircle2, Music } from '../../ui/icons';
import type { UrlAudioImportModalProps, ImportedItem, UrlImportResult } from '../UrlAudioImportModal';
import { fmt } from '../../../utils/fmt';

export type UrlImportResultViewProps = Pick<UrlAudioImportModalProps, 'onClose'> & {
  result: UrlImportResult;
  loc: Translations;
  bitrate: string;
  formatDuration: (ms: number | null) => string;
  handlePlayAll: () => Promise<void>;
  handleQueueAll: () => Promise<void>;
  handlePlaySingle: (item: ImportedItem) => void;
  handleQueueSingle: (item: ImportedItem) => void;
  handleOpenFolder: (pathToShow?: string | undefined) => void;
  handleResetForAnother: () => void;
};

export const UrlImportResultView: React.FC<UrlImportResultViewProps> = ({
  bitrate,
  formatDuration,
  handleOpenFolder,
  handlePlayAll,
  handlePlaySingle,
  handleQueueAll,
  handleQueueSingle,
  handleResetForAnother,
  loc,
  onClose,
  result,
}) => (
    <div className="flex flex-col gap-4.5">
      <div
        className="flex items-center gap-3 rounded-xl border border-green-500/35 bg-green-500/10 p-3.5 text-green-300"
      >
        <CheckCircle2 size={24} className="shrink-0" />
        <div>
          <div className="text-md font-semibold">
            {result.items && result.items.length > 1
              ? fmt(loc.urlImport.successMultiTitle, String(result.items.length))
              : loc.urlImport.successSingleTitle}
          </div>
          <div className="mt-0.5 text-ui text-green-200">
            {loc.urlImport.successDesc}
          </div>
        </div>
      </div>

      {/* Variant A: single track */}
      {(!result.items || result.items.length <= 1) && (
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/35 p-4">
          <div
            className="flex h-15 w-15 shrink-0 items-center justify-center rounded-xl border border-accent-purple/30 bg-accent-purple/20 text-purple-300"
          >
            <Music size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="m-0 truncate text-base font-semibold"
              title={result.title}
            >
              {result.title}
            </h3>
            <div className="mt-0.5 truncate text-ui text-slate-300">
              {result.artist} • {result.album || loc.urlImport.defaultAlbum}
            </div>
            <div className="mt-1.5 flex gap-2 text-xs">
              <span className="rounded-sm bg-accent-purple/25 px-1.5 py-0.5 font-semibold text-purple-300">
                {result.format} {bitrate !== '0' ? `(${bitrate.toUpperCase()})` : ''}
              </span>
              {result.duration_ms && (
                <span className="rounded-sm bg-white/10 px-1.5 py-0.5 text-fg-secondary">
                  {formatDuration(result.duration_ms)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Variant B: list of downloaded tracks (playlist / channel) */}
      {result.items && result.items.length > 1 && (
        <div className="flex flex-col gap-2">
          {/* Bulk buttons at the top of the list */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handlePlayAll}
              className="flex items-center justify-center gap-2 rounded-lg border-0 bg-linear-135 from-accent-purple to-pink-500 p-3 text-sm font-semibold text-fg shadow-lift shadow-accent-purple/40"
            >
              <Play size={18} fill="#fff" />
              {loc.urlImport.playAll}
            </button>
            <button
              type="button"
              onClick={handleQueueAll}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/8 p-3 text-sm font-medium text-slate-200"
            >
              <ListPlus size={18} />
              {loc.urlImport.queueAll}
            </button>
          </div>

          {/* Scrollable list of downloaded tracks */}
          <div
            className="flex max-h-65 flex-col gap-1 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-1.5"
          >
            {result.items.map((item, idx) => (
              <div
                key={item.file_path || idx}
                className="flex items-center justify-between gap-2.5 rounded-md bg-white/3 px-2.5 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-ui text-fg-secondary">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-sm font-semibold text-fg"
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    <div className="truncate text-xs text-slate-300">
                      {item.artist} {item.album ? `• ${item.album}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-fg-secondary">
                    {formatDuration(item.duration_ms)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePlaySingle(item)}
                    className="flex items-center justify-center rounded-md border border-accent-purple/30 bg-accent-purple/20 px-1.5 py-1 text-purple-300"
                    title={loc.urlImport.playTrack}
                  >
                    <Play size={13} fill="#d8b4fe" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueSingle(item)}
                    className="flex items-center justify-center rounded-md border border-white/15 bg-white/8 px-1.5 py-1 text-slate-200"
                    title={loc.urlImport.queueTrack}
                  >
                    <ListPlus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buttons after success (single track) */}
      {(!result.items || result.items.length <= 1) && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handlePlaySingle(result.items && result.items[0] ? result.items[0] : (result as any))}
            className="flex items-center justify-center gap-2 rounded-lg border-0 bg-linear-135 from-accent-purple to-pink-500 p-3 text-sm font-semibold text-fg shadow-lift shadow-accent-purple/40"
          >
            <Play size={18} fill="#fff" />
            {loc.urlImport.playNow}
          </button>
          <button
            type="button"
            onClick={() => handleQueueSingle(result.items && result.items[0] ? result.items[0] : (result as any))}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/8 p-3 text-sm font-medium text-slate-200"
          >
            <ListPlus size={18} />
            {loc.urlImport.addToQueue}
          </button>
        </div>
      )}

      {/* Bottom navigation bar after the download */}
      <div className="mt-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleOpenFolder()}
          className="flex items-center gap-1.5 border-0 bg-transparent px-0 py-1.5 text-ui text-fg-secondary"
        >
          <FolderOpen size={15} />
          {loc.urlImport.showInFolder}
        </button>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleResetForAnother}
            className="border-0 bg-transparent text-ui font-medium text-purple-400"
          >
            {loc.urlImport.downloadAnother}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 bg-white/8 px-3.5 py-1.5 text-ui font-medium text-slate-300"
          >
            {loc.urlImport.done}
          </button>
        </div>
      </div>
    </div>
);
