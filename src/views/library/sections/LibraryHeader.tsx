import React, { useState } from 'react';
import {
  Copy,
  Download,
  FileEdit,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Music,
  RefreshCw,
  Shuffle,
  SlidersHorizontal,
} from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { Badge, Button, Chip, MenuItem, PageHeader, Popover } from '../../../components/ui';

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const isSyncingCovers = coverSyncProgress.running;
  const syncProgressLabel =
    coverSyncProgress.total > 0 ? `${coverSyncProgress.processed}/${coverSyncProgress.total}` : null;

  return (
    <PageHeader
      icon={<Music size={20} />}
      tone="purple"
      title={
        <span className="flex flex-wrap items-center gap-2">
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
          <Button variant="tinted" tone="pink" onClick={handlePickFolder}>
            <FolderPlus size={15} /> {loc.library.addFolder}
          </Button>
          <Chip tone="pink" pressed={isFacetsFilterEnabled} onClick={() => setIsFacetsFilterEnabled((prev) => !prev)} className="py-2 text-ui">
            <Layers size={14} /> {loc.library.facetsToggle}
          </Chip>
          <Popover
            open={toolsOpen}
            onClose={() => setToolsOpen(false)}
            side="bottom"
            align="end"
            label={loc.library.moreActions}
            className="min-w-60"
            trigger={
              <Button
                variant={isSyncingCovers || isScanFolderOpen ? 'tinted' : 'secondary'}
                tone={isSyncingCovers ? 'pink' : 'cyan'}
                onClick={() => setToolsOpen((prev) => !prev)}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
              >
                {isSyncingCovers ? <Loader2 size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
                <span>{loc.library.moreActions}</span>
                {albumsWithoutCoverCount > 0 && !isSyncingCovers && (
                  <Badge tone="amber" size="xs" mono>
                    {albumsWithoutCoverCount}
                  </Badge>
                )}
              </Button>
            }
          >
            <MenuItem
              icon={<FilePlus size={15} className="text-accent-cyan" />}
              onClick={() => {
                setToolsOpen(false);
                void handlePickFiles();
              }}
            >
              {loc.library.addFiles}
            </MenuItem>
            <MenuItem
              selected={isScanFolderOpen}
              icon={<FolderOpen size={15} className="text-accent-cyan" />}
              onClick={() => {
                setToolsOpen(false);
                setIsScanFolderOpen(!isScanFolderOpen);
              }}
            >
              {loc.library.manualPath}
            </MenuItem>
            <MenuItem
              icon={<Download size={15} className="text-accent-amber" />}
              onClick={() => {
                setToolsOpen(false);
                setShowDownloadHub(true);
              }}
            >
              {loc.settings.downloadHubBtn}
            </MenuItem>
            <MenuItem
              icon={<Globe size={15} className="text-accent-purple" />}
              onClick={() => {
                setToolsOpen(false);
                setIsUrlImportModalOpen(true);
              }}
            >
              {loc.library.importUrlBtn}
            </MenuItem>
            <MenuItem
              disabled={isSyncingCovers}
              icon={isSyncingCovers ? <Loader2 size={15} className="animate-spin text-accent-pink" /> : <ImageIcon size={15} className="text-accent-pink" />}
              onClick={() => {
                setToolsOpen(false);
                void handleTriggerBackgroundCoverFetch();
              }}
            >
              <span className="flex flex-1 items-center justify-between gap-2">
                <span>{isSyncingCovers ? loc.library.syncingMissingCovers : loc.library.syncMissingCovers}</span>
                {isSyncingCovers && syncProgressLabel ? (
                  <Badge tone="pink" size="xs" mono>{syncProgressLabel}</Badge>
                ) : albumsWithoutCoverCount > 0 ? (
                  <Badge tone="amber" size="xs" mono>{albumsWithoutCoverCount}</Badge>
                ) : null}
              </span>
            </MenuItem>
            <MenuItem
              icon={<Copy size={15} className="text-accent-cyan" />}
              onClick={() => {
                setToolsOpen(false);
                setIsDuplicateFinderOpen(true);
              }}
            >
              {loc.library.duplicateFinder}
            </MenuItem>
            <MenuItem
              icon={<FileEdit size={15} className="text-accent-amber" />}
              onClick={() => {
                setToolsOpen(false);
                setIsFileRenamerOpen(true);
              }}
            >
              {loc.library.fileRenamer}
            </MenuItem>
            <MenuItem
              icon={<RefreshCw size={15} className="text-fg-secondary" />}
              onClick={() => {
                setToolsOpen(false);
                void loadLibrary();
              }}
            >
              {loc.library.refresh}
            </MenuItem>
          </Popover>
        </>
      }
    />
  );
};
