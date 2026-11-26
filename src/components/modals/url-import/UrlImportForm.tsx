import React, { useId } from 'react';
import type { Translations } from '../../../i18n';
import type { FormEvent } from 'react';
import { Download, FolderOpen, AlertCircle, Clipboard, Sparkles, ListMusic, SlidersHorizontal } from '../../ui/icons';
import type { UrlAudioImportModalProps } from '../UrlAudioImportModal';
import type { Dispatch, SetStateAction } from 'react';
import { Badge, Button, Callout, Card, Chip, FieldLabel, OptionCard, Select, Spinner, TextField, ToggleCard } from '../../ui';

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

/** Encoder settings offered per lossy format (FLAC has none). `0` is MP3 V0 VBR. */
const BITRATES: Record<string, readonly { id: string; label: string; desc: string }[]> = {
  mp3: [
    { id: '320k', label: '320 kbps (CBR)', desc: 'Studio' },
    { id: '256k', label: '256 kbps (CBR)', desc: 'High' },
    { id: '192k', label: '192 kbps (CBR)', desc: 'Standard' },
    { id: '0', label: 'V0 VBR (~245k)', desc: 'Variable' },
  ],
  opus: [
    { id: '160k', label: '160 kbps (Studio)', desc: 'Transparent Hi-Fi' },
    { id: '128k', label: '128 kbps (Standard)', desc: 'Optimal' },
    { id: '96k', label: '96 kbps (Compact)', desc: 'Light' },
  ],
  m4a: [
    { id: '256k', label: '256 kbps (AAC)', desc: 'iTunes Plus' },
    { id: '192k', label: '192 kbps (AAC)', desc: 'Standard' },
    { id: '128k', label: '128 kbps (AAC)', desc: 'Compact' },
  ],
};

const TRACK_LIMITS = [
  [0, 'limitUnlimited'],
  [5, 'limit5'],
  [10, 'limit10'],
  [25, 'limit25'],
  [50, 'limit50'],
  [100, 'limit100'],
] as const satisfies readonly (readonly [number, keyof Translations['urlImport']])[];

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
}) => {
  const id = useId();
  const formats = [
    { id: 'flac', name: 'FLAC', desc: loc.urlImport.formatFlacDesc },
    { id: 'mp3', name: 'MP3', desc: loc.urlImport.formatMp3Desc },
    { id: 'opus', name: 'OPUS', desc: loc.urlImport.formatOpusDesc },
    { id: 'm4a', name: 'M4A', desc: loc.urlImport.formatM4aDesc },
  ];
  const bitrates = BITRATES[format] ?? [];

  return (
    <form onSubmit={handleImport} className="flex flex-col gap-4.5">
      {/* Source URL */}
      <div>
        <FieldLabel htmlFor={`${id}-url`}>{loc.urlImport.urlLabel}</FieldLabel>
        <div className="flex gap-2">
          <TextField
            id={`${id}-url`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://soundcloud.com/... or YouTube, Bandcamp, Mixcloud"
            disabled={isLoading}
            autoFocus
            aria-describedby={`${id}-url-hint`}
            className="flex-1"
          />
          <Button onClick={handlePasteClipboard} disabled={isLoading} title={loc.urlImport.pasteTooltip}>
            <Clipboard size={15} />
            {loc.urlImport.paste}
          </Button>
        </div>
        <span id={`${id}-url-hint`} className="mt-1 block text-xs text-fg-secondary">
          {loc.urlImport.urlHint}
        </span>
      </div>

      {/* Target format */}
      <div role="group" aria-labelledby={`${id}-format`}>
        <span id={`${id}-format`} className="label-caps mb-1.5 block">
          {loc.urlImport.targetFormat}
        </span>
        <div className="grid grid-cols-4 gap-2">
          {formats.map((f) => (
            <OptionCard
              key={f.id}
              tone="purple"
              pressed={format === f.id}
              onClick={() => handleFormatChange(f.id)}
              disabled={isLoading}
              className="items-center gap-0.5 px-1.5 py-2 text-center"
            >
              <span className="text-sm font-semibold">{f.name}</span>
              <span className="text-xxs text-fg-secondary">{f.desc}</span>
            </OptionCard>
          ))}
        </div>
      </div>

      {/* Encoder quality (lossy formats only) */}
      {bitrates.length > 0 ? (
        <Card variant="inset" padding="none" className="p-3" role="group" aria-labelledby={`${id}-quality`}>
          <div className="mb-2 flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-accent-purple" />
            <span id={`${id}-quality`} className="text-ui font-medium text-fg">
              {loc.urlImport.encodingQuality}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bitrates.map((b) => (
              <Chip key={b.id} tone="purple" pressed={bitrate === b.id} onClick={() => setBitrate(b.id)} disabled={isLoading}>
                <span className="font-semibold">{b.label}</span>
                <span className="text-xxs opacity-60">• {b.desc}</span>
              </Chip>
            ))}
          </div>
        </Card>
      ) : (
        <Callout tone="cyan" icon={<Sparkles size={16} />} className="py-2.5 text-ui text-fg">
          {loc.urlImport.flacLosslessNotice}
        </Callout>
      )}

      {/* Download a whole playlist, album or channel */}
      <ToggleCard
        icon={<ListMusic size={18} />}
        tone="purple"
        title={loc.urlImport.downloadPlaylistLabel}
        description={loc.urlImport.downloadPlaylistDesc}
        badges={downloadPlaylist && <Badge tone="purple">{loc.urlImport.batchMode}</Badge>}
        checked={downloadPlaylist}
        onChange={setDownloadPlaylist}
        disabled={isLoading}
      >
        {downloadPlaylist && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor={`${id}-limit`}>{loc.urlImport.trackLimit}</FieldLabel>
              <Select
                id={`${id}-limit`}
                size="sm"
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
                disabled={isLoading}
              >
                {TRACK_LIMITS.map(([value, key]) => (
                  <option key={value} value={value}>
                    {loc.urlImport[key]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor={`${id}-folders`}>{loc.urlImport.folderHierarchy}</FieldLabel>
              <Select
                id={`${id}-folders`}
                size="sm"
                value={folderStructure}
                onChange={(e) => setFolderStructure(e.target.value)}
                disabled={isLoading}
              >
                <option value="playlist">{loc.urlImport.hierarchyAlbum}</option>
                <option value="artist_album">{loc.urlImport.hierarchyArtistAlbum}</option>
                <option value="flat">{loc.urlImport.hierarchyFlat}</option>
              </Select>
            </div>
          </div>
        )}
      </ToggleCard>

      {/* Target folder */}
      <div>
        <FieldLabel htmlFor={`${id}-dir`}>{loc.urlImport.destFolder}</FieldLabel>
        <div className="flex items-center gap-2">
          <TextField
            id={`${id}-dir`}
            mono
            value={targetDir}
            onChange={(e) => setTargetDir(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handlePickDirectory} disabled={isLoading}>
            <FolderOpen size={15} />
            {loc.urlImport.browse}
          </Button>
        </div>
      </div>

      {/* Library indexing note */}
      <Callout tone="purple" icon={<Sparkles size={16} />} className="py-2.5 text-ui text-fg">
        {loc.urlImport.sqliteIndexingHint}
      </Callout>

      {errorMessage && (
        <Callout tone="danger" icon={<AlertCircle size={18} />} role="alert" className="text-ui whitespace-pre-line text-fg">
          {errorMessage}
        </Callout>
      )}

      <div className="mt-1.5 flex justify-end gap-2.5">
        <Button variant="ghost" size="lg" onClick={onClose} disabled={isLoading}>
          {loc.common.cancel}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={isLoading || !url.trim()}>
          {isLoading ? <Spinner size="sm" className="text-current" /> : <Download size={16} />}
          {isLoading
            ? downloadPlaylist
              ? loc.urlImport.loadingPlaylist
              : loc.urlImport.loadingTrack
            : downloadPlaylist
              ? loc.urlImport.btnDownloadPlaylist
              : loc.urlImport.btnDownloadTrack}
        </Button>
      </div>
    </form>
  );
};
