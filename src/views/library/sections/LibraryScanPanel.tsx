import React from 'react';
import { FolderOpen, RefreshCw, X } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';

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
    <div
      className="glass-card"
      style={{
        padding: '16px 18px',
        borderRadius: '14px',
        border: '1px solid var(--border-accent)',
        marginBottom: '20px',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {loc.library.scanPathLabel}
        </label>
        <button
          onClick={() => setIsScanFolderOpen(false)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={scanFolder}
          onChange={(e) => setScanFolder(e.target.value)}
          placeholder={loc.library.scanPathPlaceholder}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.3)',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
        />
        <button
          onClick={handlePickFolder}
          className="glass-card"
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-cyan)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
          title={loc.library.browseDolphinTooltip}
        >
          <FolderOpen size={15} /> {loc.library.browseDolphin}
        </button>
        <button
          onClick={handleScanLibrary}
          disabled={isScanning}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            background: isScanning ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            color: '#fff',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: isScanning ? 'default' : 'pointer',
            border: 'none',
          }}
        >
          <RefreshCw size={15} className={isScanning ? 'spin' : ''} /> {isScanning ? loc.library.scanning : loc.library.runScan}
        </button>
      </div>
      {scanResult && (
        <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-green)' }}>
          ✓ {fmt(loc.library.scanSummary, String(scanResult.total_files_found), String(scanResult.new_or_updated_tracks), String(scanResult.skipped_unchanged))}
        </p>
      )}
    </div>
);
