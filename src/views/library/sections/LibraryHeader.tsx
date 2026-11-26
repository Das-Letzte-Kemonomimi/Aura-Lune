import React from 'react';
import { Copy, Download, FileEdit, FilePlus, FolderOpen, FolderPlus, Globe, Layers, Music, RefreshCw, Shuffle } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { cn } from '../../../utils/cn';

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
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-xl font-bold">
          <Music size={22} className="text-accent-purple" /> {loc.library.title}
          <span
            className="rounded-xl border border-accent-purple/30 bg-accent-purple/20 px-2 py-0.5 text-xs font-semibold text-accent-purple"
          >
            {filteredTracks.length !== tracks.length ? `${filteredTracks.length} / ${tracks.length}` : `${tracks.length} ${loc.library.tracks}`}
          </span>
        </h2>
        <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
          {loc.library.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleShuffleAll()}
          className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-4 py-2 text-ui font-bold text-on-accent shadow-lg shadow-pink-500/40 transition-all duration-150"
          title={loc.library.shuffleAllTooltip}
        >
          <Shuffle size={15} /> {loc.library.shuffleAll}
        </button>

        <button
          onClick={() => setShowDownloadHub(true)}
          className="flex items-center gap-1.5 rounded-lg border border-orange-500/60 bg-linear-135 from-orange-500/35 to-accent-pink/25 px-3.5 py-2 text-ui font-semibold text-fg shadow-md shadow-orange-500/25"
          title={loc.settings.downloadHubBtn}
        >
          <Download size={15} className="text-orange-500" /> {loc.settings.downloadHubBtn}
        </button>

        <button
          onClick={() => setIsUrlImportModalOpen(true)}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-purple-400 bg-linear-135 from-accent-purple/40 to-pink-500/30 px-3.5 py-2 text-ui font-semibold text-fg shadow-lg shadow-accent-purple/25"
          title={loc.library.importUrlTooltip}
        >
          <Globe size={15} className="text-purple-300" /> {loc.library.importUrlBtn}
        </button>

        <button
          onClick={handlePickFolder}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-accent-purple bg-linear-135 from-accent-purple/35 to-accent-pink/25 px-3.5 py-2 text-ui font-semibold text-fg shadow-lg shadow-accent-purple/25"
          title={loc.library.addFolder}
        >
          <FolderPlus size={15} className="text-accent-pink" /> {loc.library.addFolder}
        </button>
        <button
          onClick={handlePickFiles}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-line bg-white/6 px-3.5 py-2 text-ui font-semibold text-fg"
          title={loc.library.addFiles}
        >
          <FilePlus size={15} className="text-accent-cyan" /> {loc.library.addFiles}
        </button>
        <button
          onClick={() => setIsScanFolderOpen(!isScanFolderOpen)}
          className={cn(
            'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-2 text-ui',
            isScanFolderOpen ? 'text-accent-cyan' : 'text-fg-secondary',
            isScanFolderOpen ? 'border-accent-cyan' : 'border-line',
            isScanFolderOpen ? 'bg-accent-cyan/15' : 'bg-white/4',
          )}
          title={loc.library.manualPath}
        >
          <FolderOpen size={14} /> {loc.library.manualPath}
        </button>
        <button
          onClick={loadLibrary}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-line bg-white/4 px-3 py-2 text-ui text-fg"
          title={loc.library.refresh}
        >
          <RefreshCw size={14} /> {loc.library.refresh}
        </button>

        <button
          onClick={() => setIsFacetsFilterEnabled((prev) => !prev)}
          className={cn(
            'glass-card flex items-center gap-1.5 rounded-lg border px-3 py-2 text-ui',
            isFacetsFilterEnabled ? 'text-fg' : 'text-fg-secondary',
            isFacetsFilterEnabled ? 'border-accent-pink' : 'border-line',
            isFacetsFilterEnabled ? 'bg-pink-500/25' : 'bg-white/4',
            isFacetsFilterEnabled ? 'font-bold' : 'font-medium',
          )}
          title={loc.library.facetsToggle}
        >
          <Layers size={14} className="text-accent-pink" /> {loc.library.facetsToggle}
        </button>

        <button
          onClick={() => setIsDuplicateFinderOpen(true)}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-line bg-white/4 px-3 py-2 text-ui text-fg-secondary"
          title={loc.library.duplicateFinder}
        >
          <Copy size={14} className="text-accent-cyan" /> {loc.library.duplicateFinder}
        </button>

        <button
          onClick={() => setIsFileRenamerOpen(true)}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-line bg-white/4 px-3 py-2 text-ui text-fg-secondary"
          title={loc.library.fileRenamer}
        >
          <FileEdit size={14} className="text-amber-400" /> {loc.library.fileRenamer}
        </button>
      </div>
    </div>
);
