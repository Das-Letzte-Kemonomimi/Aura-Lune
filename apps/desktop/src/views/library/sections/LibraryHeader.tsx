import React from 'react';
import { Copy, Download, FileEdit, FilePlus, FolderOpen, FolderPlus, Globe, Layers, Music, RefreshCw, Shuffle } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';

export type LibraryHeaderProps = Pick<LibraryViewProps, 'loc' | 'filteredTracks' | 'tracks' | 'handleShuffleAll' | 'setShowDownloadHub' | 'setIsUrlImportModalOpen' | 'handlePickFolder' | 'handlePickFiles' | 'setIsScanFolderOpen' | 'isScanFolderOpen' | 'loadLibrary' | 'setIsFacetsFilterEnabled' | 'isFacetsFilterEnabled' | 'setIsDuplicateFinderOpen' | 'setIsFileRenamerOpen'>;

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  filteredTracks,
  handlePickFiles,
  handlePickFolder,
  handleShuffleAll,
  isFacetsFilterEnabled,
  isScanFolderOpen,
  loadLibrary,
  loc,
  setIsDuplicateFinderOpen,
  setIsFacetsFilterEnabled,
  setIsFileRenamerOpen,
  setIsScanFolderOpen,
  setIsUrlImportModalOpen,
  setShowDownloadHub,
  tracks,
}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontWeight: 700 }}>
          <Music size={22} color="var(--accent-purple)" /> {loc.library.title}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.2)',
              color: 'var(--accent-purple)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}
          >
            {filteredTracks.length !== tracks.length ? `${filteredTracks.length} / ${tracks.length}` : `${tracks.length} ${loc.library.tracks}`}
          </span>
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {loc.library.subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleShuffleAll()}
          style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(236, 72, 153, 0.4)',
            transition: 'all 0.15s ease',
          }}
          title={loc.library.shuffleAllTooltip}
        >
          <Shuffle size={15} /> {loc.library.shuffleAll}
        </button>

        <button
          onClick={() => setShowDownloadHub(true)}
          className="glass-card"
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            background: 'linear-gradient(135deg, rgba(235, 116, 34, 0.35), rgba(255, 77, 148, 0.25))',
            border: '1px solid rgba(235, 116, 34, 0.6)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(235, 116, 34, 0.25)',
          }}
          title={loc.settings.downloadHubBtn}
        >
          <Download size={15} color="#eb7422" /> {loc.settings.downloadHubBtn}
        </button>

        <button
          onClick={() => setIsUrlImportModalOpen(true)}
          className="glass-card"
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3))',
            border: '1px solid #c084fc',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
          }}
          title={loc.library.importUrlTooltip}
        >
          <Globe size={15} color="#d8b4fe" /> {loc.library.importUrlBtn}
        </button>

        <button
          onClick={handlePickFolder}
          className="glass-card"
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(244, 63, 94, 0.25))',
            border: '1px solid var(--accent-purple)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
          }}
          title={loc.library.addFolder}
        >
          <FolderPlus size={15} color="var(--accent-pink)" /> {loc.library.addFolder}
        </button>
        <button
          onClick={handlePickFiles}
          className="glass-card"
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          title={loc.library.addFiles}
        >
          <FilePlus size={15} color="var(--accent-cyan)" /> {loc.library.addFiles}
        </button>
        <button
          onClick={() => setIsScanFolderOpen(!isScanFolderOpen)}
          className="glass-card"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: isScanFolderOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            border: isScanFolderOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            background: isScanFolderOpen ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          title={loc.library.manualPath}
        >
          <FolderOpen size={14} /> {loc.library.manualPath}
        </button>
        <button
          onClick={loadLibrary}
          className="glass-card"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#fff',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.04)',
          }}
          title={loc.library.refresh}
        >
          <RefreshCw size={14} /> {loc.library.refresh}
        </button>

        <button
          onClick={() => setIsFacetsFilterEnabled((prev) => !prev)}
          className="glass-card"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: isFacetsFilterEnabled ? '#fff' : 'var(--text-secondary)',
            border: isFacetsFilterEnabled ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            background: isFacetsFilterEnabled ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            fontSize: '0.8rem',
            fontWeight: isFacetsFilterEnabled ? 700 : 500,
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          title={loc.library.facetsToggle}
        >
          <Layers size={14} color="var(--accent-pink)" /> {loc.library.facetsToggle}
        </button>

        <button
          onClick={() => setIsDuplicateFinderOpen(true)}
          className="glass-card"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.04)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          title={loc.library.duplicateFinder}
        >
          <Copy size={14} color="var(--accent-cyan)" /> {loc.library.duplicateFinder}
        </button>

        <button
          onClick={() => setIsFileRenamerOpen(true)}
          className="glass-card"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.04)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          title={loc.library.fileRenamer}
        >
          <FileEdit size={14} color="#fbbf24" /> {loc.library.fileRenamer}
        </button>
      </div>
    </div>
);
