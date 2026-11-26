import React from 'react';
import type { Translations } from '../../../i18n';
import type { FormEvent } from 'react';
import { Download, FolderOpen, AlertCircle, Loader2, Clipboard, Sparkles, ListMusic, SlidersHorizontal } from '../../ui/icons';
import type { UrlAudioImportModalProps } from '../UrlAudioImportModal';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

export type UrlImportFormProps = Pick<UrlAudioImportModalProps, 'onClose'> & {
  handleImport: (e: FormEvent<Element>) => Promise<void>;
  loc: Translations;
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  handlePasteClipboard: () => Promise<void>;
  handleFormatChange: (newFormat: string) => void;
  format: string;
  setBitrate: Dispatch<SetStateAction<string>>;
  bitrate: string;
  downloadPlaylist: boolean;
  setDownloadPlaylist: Dispatch<SetStateAction<boolean>>;
  maxItems: number;
  setMaxItems: Dispatch<SetStateAction<number>>;
  folderStructure: string;
  setFolderStructure: Dispatch<SetStateAction<string>>;
  targetDir: string;
  setTargetDir: Dispatch<SetStateAction<string>>;
  handlePickDirectory: () => Promise<void>;
  errorMessage: string | null;
};

export const UrlImportForm: React.FC<UrlImportFormProps> = ({
  bitrate,
  downloadPlaylist,
  errorMessage,
  folderStructure,
  format,
  handleFormatChange,
  handleImport,
  handlePasteClipboard,
  handlePickDirectory,
  isLoading,
  loc,
  maxItems,
  onClose,
  setBitrate,
  setDownloadPlaylist,
  setFolderStructure,
  setMaxItems,
  setTargetDir,
  setUrl,
  targetDir,
  url,
}) => (
    <form onSubmit={handleImport} className="flex flex-col gap-4.5">
      {/* Input URL */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-fg">
          {loc.urlImport.urlLabel}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://soundcloud.com/... or YouTube, Bandcamp, Mixcloud"
            disabled={isLoading}
            autoFocus
            className="flex-1 rounded-lg border border-line bg-black/35 px-3.5 py-2.5 text-sm text-fg outline-none transition-[border-color] duration-200"
          />
          <button
            type="button"
            onClick={handlePasteClipboard}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-0 text-ui whitespace-nowrap text-slate-200"
            title={loc.urlImport.pasteTooltip}
          >
            <Clipboard size={15} />
            {loc.urlImport.paste}
          </button>
        </div>
        <span className="mt-1 block text-xs text-fg-secondary">
          {loc.urlImport.urlHint}
        </span>
      </div>

      {/* Audio format choice */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {loc.urlImport.targetFormat}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'flac', name: 'FLAC', desc: loc.urlImport.formatFlacDesc },
            { id: 'mp3', name: 'MP3', desc: loc.urlImport.formatMp3Desc },
            { id: 'opus', name: 'OPUS', desc: loc.urlImport.formatOpusDesc },
            { id: 'm4a', name: 'M4A', desc: loc.urlImport.formatM4aDesc },
          ].map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => handleFormatChange(fmt.id)}
              disabled={isLoading}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 transition-all duration-150',
                format === fmt.id ? 'bg-linear-135 from-accent-purple/40 to-pink-500/30' : 'bg-black/25',
                format === fmt.id ? 'border-purple-400' : 'border-white/10',
              )}
            >
              <span className="text-sm font-semibold text-fg">
                {fmt.name}
              </span>
              <span className="text-xxs text-slate-300">
                {fmt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Audio bitrate / quality choice */}
      {format !== 'flac' ? (
        <div className="rounded-xl border border-white/8 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-purple-400" />
            <span className="text-ui font-medium text-fg">
              {loc.urlImport.encodingQuality}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {format === 'mp3' && (
              <>
                {[
                  { id: '320k', label: '320 kbps (CBR)', desc: 'Studio' },
                  { id: '256k', label: '256 kbps (CBR)', desc: 'High' },
                  { id: '192k', label: '192 kbps (CBR)', desc: 'Standard' },
                  { id: '0', label: 'V0 VBR (~245k)', desc: 'Variable' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-ui',
                      bitrate === b.id ? 'bg-accent-purple/35' : 'bg-white/5',
                      bitrate === b.id ? 'border-purple-400' : 'border-white/10',
                      bitrate === b.id ? 'text-fg' : 'text-slate-300',
                    )}
                  >
                    <span className="font-semibold">{b.label}</span>
                    <span className="text-xxs opacity-60">• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
            {format === 'opus' && (
              <>
                {[
                  { id: '160k', label: '160 kbps (Studio)', desc: 'Transparent Hi-Fi' },
                  { id: '128k', label: '128 kbps (Standard)', desc: 'Optimal' },
                  { id: '96k', label: '96 kbps (Compact)', desc: 'Light' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-ui',
                      bitrate === b.id ? 'bg-accent-purple/35' : 'bg-white/5',
                      bitrate === b.id ? 'border-purple-400' : 'border-white/10',
                      bitrate === b.id ? 'text-fg' : 'text-slate-300',
                    )}
                  >
                    <span className="font-semibold">{b.label}</span>
                    <span className="text-xxs opacity-60">• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
            {format === 'm4a' && (
              <>
                {[
                  { id: '256k', label: '256 kbps (AAC)', desc: 'iTunes Plus' },
                  { id: '192k', label: '192 kbps (AAC)', desc: 'Standard' },
                  { id: '128k', label: '128 kbps (AAC)', desc: 'Compact' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-ui',
                      bitrate === b.id ? 'bg-accent-purple/35' : 'bg-white/5',
                      bitrate === b.id ? 'border-purple-400' : 'border-white/10',
                      bitrate === b.id ? 'text-fg' : 'text-slate-300',
                    )}
                  >
                    <span className="font-semibold">{b.label}</span>
                    <span className="text-xxs opacity-60">• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/8 px-3 py-2.5 text-ui text-sky-200"
        >
          <Sparkles size={16} className="shrink-0 text-sky-400" />
          <span>
            {loc.urlImport.flacLosslessNotice}
          </span>
        </div>
      )}

      {/* Download a whole playlist / album / SoundCloud channel */}
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border p-3.5 transition-all duration-200',
          downloadPlaylist ? 'bg-accent-purple/15' : 'bg-black/20',
          downloadPlaylist ? 'border-accent-purple/45' : 'border-white/8',
        )}
      >
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer select-none items-center gap-2.5">
            <input
              type="checkbox"
              checked={downloadPlaylist}
              onChange={(e) => setDownloadPlaylist(e.target.checked)}
              disabled={isLoading}
              className="h-4.5 w-4.5 cursor-pointer accent-accent-purple"
            />
            <div>
              <div className="text-sm font-semibold text-fg">
                {loc.urlImport.downloadPlaylistLabel}
              </div>
              <div className="mt-px text-xs text-slate-300">
                {loc.urlImport.downloadPlaylistDesc}
              </div>
            </div>
          </label>
          {downloadPlaylist && (
            <span
              className="flex items-center gap-1 rounded-md bg-accent-purple/30 px-2 py-1 text-xs font-semibold text-purple-300"
            >
              <ListMusic size={13} />
              {loc.urlImport.batchMode}
            </span>
          )}
        </div>

        {/* Extra options when the playlist option is on */}
        {downloadPlaylist && (
          <div className="grid grid-cols-2 gap-3 border-t border-white/8 pt-2">
            {/* Downloaded track limit */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                {loc.urlImport.trackLimit}
              </label>
              <select
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
                disabled={isLoading}
                className="w-full rounded-md border border-white/15 bg-black/35 px-2 py-1.5 text-ui text-fg outline-none"
              >
                <option value={0}>{loc.urlImport.limitUnlimited}</option>
                <option value={5}>{loc.urlImport.limit5}</option>
                <option value={10}>{loc.urlImport.limit10}</option>
                <option value={25}>{loc.urlImport.limit25}</option>
                <option value={50}>{loc.urlImport.limit50}</option>
                <option value={100}>{loc.urlImport.limit100}</option>
              </select>
            </div>

            {/* Folder structure */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                {loc.urlImport.folderHierarchy}
              </label>
              <select
                value={folderStructure}
                onChange={(e) => setFolderStructure(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-md border border-white/15 bg-black/35 px-2 py-1.5 text-ui text-fg outline-none"
              >
                <option value="playlist">
                  {loc.urlImport.hierarchyAlbum}
                </option>
                <option value="artist_album">
                  {loc.urlImport.hierarchyArtistAlbum}
                </option>
                <option value="flat">
                  {loc.urlImport.hierarchyFlat}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Target folder */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {loc.urlImport.destFolder}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={targetDir}
            onChange={(e) => setTargetDir(e.target.value)}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-mono text-ui text-slate-300"
          />
          <button
            type="button"
            onClick={handlePickDirectory}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-ui whitespace-nowrap text-slate-200"
          >
            <FolderOpen size={15} />
            {loc.urlImport.browse}
          </button>
        </div>
      </div>

      {/* yt-dlp engine info */}
      <div
        className="flex items-center gap-2 rounded-lg border border-accent-purple/20 bg-accent-purple/8 px-3 py-2.5 text-ui text-purple-200"
      >
        <Sparkles size={16} className="shrink-0 text-purple-400" />
        <span>
          {loc.urlImport.sqliteIndexingHint}
        </span>
      </div>

      {/* Error */}
      {errorMessage && (
        <div
          className="flex gap-2.5 rounded-lg border border-accent-red/40 bg-accent-red/15 p-3 text-ui whitespace-pre-line text-red-300"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Action button */}
      <div className="mt-1.5 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-lg border border-white/15 bg-transparent px-4 py-2.5 text-sm text-slate-300"
        >
          {loc.common.cancel}
        </button>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className={cn(
            'flex items-center gap-2 rounded-lg border-0 bg-linear-135 from-accent-purple to-pink-500 px-5 py-2.5 text-sm font-semibold text-fg shadow-lift shadow-accent-purple/40',
            isLoading || !url.trim() ? 'cursor-not-allowed' : 'cursor-pointer',
            isLoading || !url.trim() ? 'opacity-60' : 'opacity-100',
          )}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {downloadPlaylist
                ? loc.urlImport.loadingPlaylist
                : loc.urlImport.loadingTrack}
            </>
          ) : (
            <>
              <Download size={16} />
              {downloadPlaylist
                ? loc.urlImport.btnDownloadPlaylist
                : loc.urlImport.btnDownloadTrack}
            </>
          )}
        </button>
      </div>
    </form>
);
