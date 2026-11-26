import React from 'react';
import { FolderOpen, CheckCircle, X, Play, Plus, ListPlus } from 'lucide-react';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';

export type TranscodeResultPanelProps = Pick<TranscodeSettingsViewProps, 'loc' | 'onDismissLastExported' | 'onPlayLibraryTrack' | 'onAddTrackToQueue' | 'onAddToPlaylist' | 'onOpenContainingFolder'> & {
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
    <div
      className="glass-panel mt-4 flex flex-col gap-2.5 rounded-xl border border-green-500/40 bg-green-500/8 p-4 shadow-xl shadow-green-500/10"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className="text-accent-green" />
          <span className="text-sm font-bold text-fg">
            {loc.settings.transcodeCompletedTitle}
          </span>
        </div>
        <button
          onClick={onDismissLastExported}
          className="border-0 bg-transparent p-1 text-fg-muted"
        >
          <X size={15} />
        </button>
      </div>
      <div className="font-mono text-ui break-all text-fg-secondary">
        {lastExportedTrack.path}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          onClick={() => onPlayLibraryTrack(lastExportedTrack)}
          className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-3.5 py-2 text-ui font-semibold text-on-accent shadow-md shadow-accent-pink/30"
        >
          <Play size={14} fill="#fff" />
          {loc.settings.playRenderedNow}
        </button>
        <button
          onClick={(e) => onAddTrackToQueue(lastExportedTrack, e)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-3.5 py-2 text-ui font-semibold text-accent-cyan"
        >
          <Plus size={14} />
          {loc.settings.addRenderedToQueue}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToPlaylist(lastExportedTrack);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-3.5 py-2 text-ui font-semibold text-accent-purple"
        >
          <ListPlus size={14} />
          {loc.settings.addRenderedToPlaylist}
        </button>
        <button
          onClick={(e) => onOpenContainingFolder(lastExportedTrack.path, e)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-3.5 py-2 text-ui font-semibold text-fg-secondary"
        >
          <FolderOpen size={14} />
          {loc.settings.openRenderedFolder}
        </button>
      </div>
    </div>
);
