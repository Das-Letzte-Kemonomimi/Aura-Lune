import React from 'react';
import { FolderOpen, RefreshCw, X, Check } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

export type LibraryScanPanelProps = Pick<LibraryViewProps, 'loc' | 'setIsScanFolderOpen' | 'scanFolder' | 'setScanFolder' | 'handlePickFolder' | 'handleScanLibrary' | 'isScanning' | 'scanResult'>;

export const LibraryScanPanel: React.FC<LibraryScanPanelProps> = ({
  handlePickFolder,
  handleScanLibrary,
  isScanning,
  loc,
  scanFolder,
  scanResult,
  setIsScanFolderOpen,
  setScanFolder,
}) => (
    <div className="glass-card mb-5 rounded-2xl border border-line-accent bg-black/40 px-4.5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-ui font-semibold text-fg-secondary">
          {loc.library.scanPathLabel}
        </label>
        <button
          onClick={() => setIsScanFolderOpen(false)}
          className="border-0 bg-transparent p-0.5 text-fg-muted"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2.5">
        <input
          type="text"
          value={scanFolder}
          onChange={(e) => setScanFolder(e.target.value)}
          placeholder={loc.library.scanPathPlaceholder}
          className="flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-sm text-fg"
        />
        <button
          onClick={handlePickFolder}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-3.5 py-2 font-semibold text-accent-cyan"
          title={loc.library.browseDolphinTooltip}
        >
          <FolderOpen size={15} /> {loc.library.browseDolphin}
        </button>
        <button
          onClick={handleScanLibrary}
          disabled={isScanning}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border-0 px-4.5 py-2 font-semibold text-fg',
            isScanning ? 'bg-fg-muted' : 'bg-linear-135 from-accent-cyan to-accent-purple',
            isScanning ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} /> {isScanning ? loc.library.scanning : loc.library.runScan}
        </button>
      </div>
      {scanResult && (
        <p className="mx-0 mt-2.5 mb-0 text-ui text-accent-green">
          <Check size={13} className="icon-inline mr-1" />
          {fmt(loc.library.scanSummary, String(scanResult.total_files_found), String(scanResult.new_or_updated_tracks), String(scanResult.skipped_unchanged))}
        </p>
      )}
    </div>
);
