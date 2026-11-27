import React, { useId } from 'react';
import { FolderOpen, RefreshCw, X, Check } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { Button, Card, FieldLabel, IconButton, TextField } from '../../../components/ui';

export type LibraryScanPanelProps = Pick<LibraryViewProps, 'loc' | 'setIsScanFolderOpen' | 'scanFolder' | 'setScanFolder' | 'handlePickFolder' | 'handleScanLibrary' | 'isScanning' | 'scanResult'>;

/** Scan a folder typed by hand (or picked) into the library. */
export const LibraryScanPanel: React.FC<LibraryScanPanelProps> = ({
  handlePickFolder,
  handleScanLibrary,
  isScanning,
  loc,
  scanFolder,
  scanResult,
  setIsScanFolderOpen,
  setScanFolder,
}) => {
  const fieldId = useId();
  return (
    <Card highlight="cyan">
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel htmlFor={fieldId} className="mb-0">{loc.library.scanPathLabel}</FieldLabel>
        <IconButton size="sm" label={loc.common.close} onClick={() => setIsScanFolderOpen(false)}>
          <X size={14} />
        </IconButton>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <TextField
          id={fieldId}
          mono
          value={scanFolder}
          onChange={(e) => setScanFolder(e.target.value)}
          placeholder={loc.library.scanPathPlaceholder}
          className="min-w-52 flex-1"
        />
        <Button onClick={handlePickFolder} title={loc.library.browseDolphinTooltip}>
          <FolderOpen size={15} className="text-accent-cyan" /> {loc.library.browseDolphin}
        </Button>
        <Button variant="primary" onClick={handleScanLibrary} disabled={isScanning}>
          <RefreshCw size={15} className={isScanning ? 'animate-spin' : undefined} />
          {isScanning ? loc.library.scanning : loc.library.runScan}
        </Button>
      </div>
      {scanResult && (
        <p className="mt-2.5 text-ui text-accent-green">
          <Check size={13} className="icon-inline mr-1" />
          {fmt(loc.library.scanSummary, String(scanResult.total_files_found), String(scanResult.new_or_updated_tracks), String(scanResult.skipped_unchanged))}
        </p>
      )}
    </Card>
  );
};
