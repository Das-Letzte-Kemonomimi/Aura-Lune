import React from 'react';
import { FolderOpen, CheckCircle, X, Play, Plus, ListPlus } from '../../../components/ui/icons';
import { Button, Card, IconButton, SectionHeader } from '../../../components/ui';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';

export type TranscodeResultPanelProps = Pick<
  TranscodeSettingsViewProps,
  'loc' | 'onDismissLastExported' | 'onPlayLibraryTrack' | 'onAddTrackToQueue' | 'onAddToPlaylist' | 'onOpenContainingFolder'
> & {
  lastExportedTrack: NonNullable<TranscodeSettingsViewProps['lastExportedTrack']>;
};

export const TranscodeResultPanel: React.FC<TranscodeResultPanelProps> = ({
  lastExportedTrack,
  loc,
  onAddToPlaylist,
  onAddTrackToQueue,
  onDismissLastExported,
  onOpenContainingFolder,
  onPlayLibraryTrack,
}) => (
  <Card highlight="green" className="flex flex-col gap-3">
    <SectionHeader
      icon={<CheckCircle size={20} />}
      tone="green"
      title={loc.settings.transcodeCompletedTitle}
      description={<span className="font-mono break-all">{lastExportedTrack.path}</span>}
      actions={
        <IconButton label={loc.common.close} size="sm" onClick={onDismissLastExported}>
          <X size={16} />
        </IconButton>
      }
    />
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={() => onPlayLibraryTrack(lastExportedTrack)}>
        <Play size={16} fill="currentColor" />
        {loc.settings.playRenderedNow}
      </Button>
      <Button onClick={(e) => onAddTrackToQueue(lastExportedTrack, e)}>
        <Plus size={16} />
        {loc.settings.addRenderedToQueue}
      </Button>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          onAddToPlaylist(lastExportedTrack);
        }}
      >
        <ListPlus size={16} />
        {loc.settings.addRenderedToPlaylist}
      </Button>
      <Button onClick={(e) => onOpenContainingFolder(lastExportedTrack.path, e)}>
        <FolderOpen size={16} />
        {loc.settings.openRenderedFolder}
      </Button>
    </div>
  </Card>
);
