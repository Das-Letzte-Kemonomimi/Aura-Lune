import React from 'react';
import { Copy, Download, FileEdit, FilePlus, FolderOpen, FolderPlus, Globe, Image as ImageIcon, Layers, Loader2, Music, RefreshCw, Shuffle } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { Badge, Button, Chip, PageHeader } from '../../../components/ui';

export type LibraryHeaderProps = Pick<LibraryViewProps, 'loc' | 'filteredTracks' | 'tracks' | 'albumsWithoutCoverCount' | 'coverSyncProgress' | 'handleShuffleAll' | 'setShowDownloadHub' | 'setIsUrlImportModalOpen' | 'handlePickFolder' | 'handlePickFiles' | 'setIsScanFolderOpen' | 'isScanFolderOpen' | 'loadLibrary' | 'handleTriggerBackgroundCoverFetch' | 'setIsFacetsFilterEnabled' | 'isFacetsFilterEnabled' | 'setIsDuplicateFinderOpen' | 'setIsFileRenamerOpen'>;

/** Library title with the track count, and the import, scan and tool actions. */
export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  albumsWithoutCoverCount,
  coverSyncProgress,
  filteredTracks,
  handlePickFiles,
  handlePickFolder,
  handleShuffleAll,
  handleTriggerBackgroundCoverFetch,
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
}) => {
  const isSyncingCovers = coverSyncProgress.running;
  const syncProgressLabel =
    coverSyncProgress.total > 0 ? `${coverSyncProgress.processed}/${coverSyncProgress.total}` : null;

  return (
    <PageHeader
      className="mb-5"
      icon={<Music size={20} />}
      tone="purple"
      title={
        <span className="flex items-center gap-2">
          {loc.library.title}
          <Badge tone="purple">
            {filteredTracks.length !== tracks.length ? `${filteredTracks.length} / ${tracks.length}` : `${tracks.length} ${loc.library.tracks}`}
          </Badge>
        </span>
      }
      description={loc.library.subtitle}
      actions={
        <>
          <Button variant="primary" onClick={() => handleShuffleAll()} title={loc.library.shuffleAllTooltip}>
            <Shuffle size={15} /> {loc.library.shuffleAll}
          </Button>
          <Button variant="tinted" tone="amber" onClick={() => setShowDownloadHub(true)}>
            <Download size={15} /> {loc.settings.downloadHubBtn}
          </Button>
          <Button variant="tinted" tone="purple" onClick={() => setIsUrlImportModalOpen(true)} title={loc.library.importUrlTooltip}>
            <Globe size={15} /> {loc.library.importUrlBtn}
          </Button>
          <Button variant="tinted" tone="pink" onClick={handlePickFolder}>
            <FolderPlus size={15} /> {loc.library.addFolder}
          </Button>
          <Button onClick={handlePickFiles}>
            <FilePlus size={15} className="text-accent-cyan" /> {loc.library.addFiles}
          </Button>
          <Chip tone="cyan" pressed={isScanFolderOpen} onClick={() => setIsScanFolderOpen(!isScanFolderOpen)} className="py-2 text-ui">
            <FolderOpen size={14} /> {loc.library.manualPath}
          </Chip>
          <Button onClick={loadLibrary}>
            <RefreshCw size={14} /> {loc.library.refresh}
          </Button>
          <Button
            variant="tinted"
            tone="pink"
            disabled={isSyncingCovers}
            aria-busy={isSyncingCovers}
            onClick={() => {
              void handleTriggerBackgroundCoverFetch();
            }}
            title={loc.library.syncMissingCoversTooltip}
          >
            {isSyncingCovers ? (
              <>
                <Loader2 size={14} className="animate-spin" /> {loc.library.syncingMissingCovers}
                {syncProgressLabel && (
                  <Badge tone="pink" size="xs" mono>
                    {syncProgressLabel}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <ImageIcon size={14} /> {loc.library.syncMissingCovers}
                {albumsWithoutCoverCount > 0 && (
                  <Badge tone="amber" size="xs" mono>
                    {albumsWithoutCoverCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
          <Chip tone="pink" pressed={isFacetsFilterEnabled} onClick={() => setIsFacetsFilterEnabled((prev) => !prev)} className="py-2 text-ui">
            <Layers size={14} /> {loc.library.facetsToggle}
          </Chip>
          <Button onClick={() => setIsDuplicateFinderOpen(true)}>
            <Copy size={14} className="text-accent-cyan" /> {loc.library.duplicateFinder}
          </Button>
          <Button onClick={() => setIsFileRenamerOpen(true)}>
            <FileEdit size={14} className="text-accent-amber" /> {loc.library.fileRenamer}
          </Button>
        </>
      }
    />
  );
};
