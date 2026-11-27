import React from 'react';
import type { Translations } from '../../../i18n';
import { Play, ListPlus, FolderOpen, CheckCircle2, Music } from '../../ui/icons';
import type { UrlAudioImportModalProps, ImportedItem, UrlImportResult } from '../UrlAudioImportModal';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Callout, Card, IconButton } from '../../ui';
import { iconTileTones } from '../../ui/tones';

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
}) => {
  const isList = result.items && result.items.length > 1;
  // A single download carries its own fields, so the result itself stands in for the item.
  const single: ImportedItem = result.items?.[0] ?? result;

  return (
    <div className="flex flex-col gap-4.5">
      <Callout tone="green" icon={<CheckCircle2 size={24} />}>
        <div className="text-md font-semibold text-fg">
          {isList ? fmt(loc.urlImport.successMultiTitle, String(result.items.length)) : loc.urlImport.successSingleTitle}
        </div>
        <div className="mt-0.5 text-ui text-fg-secondary">{loc.urlImport.successDesc}</div>
      </Callout>

      {isList ? (
        /* A playlist or channel: bulk actions, then the downloaded tracks */
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="primary" size="lg" onClick={handlePlayAll}>
              <Play size={18} fill="currentColor" />
              {loc.urlImport.playAll}
            </Button>
            <Button size="lg" onClick={handleQueueAll}>
              <ListPlus size={18} />
              {loc.urlImport.queueAll}
            </Button>
          </div>

          <Card variant="inset" padding="none" className="flex max-h-65 flex-col gap-1 overflow-y-auto p-1.5">
            {result.items.map((item, idx) => (
              <div
                key={item.file_path || idx}
                className="flex items-center justify-between gap-2.5 rounded-md bg-white/3 px-2.5 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-ui text-fg-secondary">{idx + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-fg" title={item.title}>
                      {item.title}
                    </div>
                    <div className="truncate text-xs text-fg-secondary">
                      {item.artist} {item.album ? `• ${item.album}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-xs text-fg-secondary">{formatDuration(item.duration_ms)}</span>
                  <IconButton size="sm" variant="secondary" label={loc.urlImport.playTrack} onClick={() => handlePlaySingle(item)}>
                    <Play size={13} fill="currentColor" />
                  </IconButton>
                  <IconButton size="sm" variant="secondary" label={loc.urlImport.queueTrack} onClick={() => handleQueueSingle(item)}>
                    <ListPlus size={13} />
                  </IconButton>
                </div>
              </div>
            ))}
          </Card>
        </div>
      ) : (
        /* A single track */
        <>
          <Card variant="inset" padding="sm" className="flex items-center gap-4">
            <div className={cn('flex size-15 shrink-0 items-center justify-center rounded-xl', iconTileTones.purple)}>
              <Music size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="m-0 truncate text-base font-semibold" title={result.title}>
                {result.title}
              </h3>
              <div className="mt-0.5 truncate text-ui text-fg-secondary">
                {result.artist} • {result.album || loc.urlImport.defaultAlbum}
              </div>
              <div className="mt-1.5 flex gap-2">
                <Badge tone="purple">
                  {result.format} {bitrate !== '0' ? `(${bitrate.toUpperCase()})` : ''}
                </Badge>
                {result.duration_ms && <Badge mono>{formatDuration(result.duration_ms)}</Badge>}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="primary" size="lg" onClick={() => handlePlaySingle(single)}>
              <Play size={18} fill="currentColor" />
              {loc.urlImport.playNow}
            </Button>
            <Button size="lg" onClick={() => handleQueueSingle(single)}>
              <ListPlus size={18} />
              {loc.urlImport.addToQueue}
            </Button>
          </div>
        </>
      )}

      {/* After the download: open the folder, download another, or close */}
      <div className="mt-1.5 flex items-center justify-between">
        <Button variant="ghost" className="px-0" onClick={() => handleOpenFolder()}>
          <FolderOpen size={15} />
          {loc.urlImport.showInFolder}
        </Button>
        <div className="flex gap-2.5">
          <Button variant="ghost" className="text-accent-purple" onClick={handleResetForAnother}>
            {loc.urlImport.downloadAnother}
          </Button>
          <Button onClick={onClose}>{loc.urlImport.done}</Button>
        </div>
      </div>
    </div>
  );
};
