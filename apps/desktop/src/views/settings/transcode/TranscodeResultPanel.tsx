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
      className="glass-panel"
      style={{
        marginTop: '16px',
        padding: '16px',
        borderRadius: '12px',
        background: 'rgba(34, 197, 94, 0.08)',
        border: '1px solid rgba(34, 197, 94, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 20px rgba(34, 197, 94, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} color="var(--accent-green)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
            {loc.settings.transcodeCompletedTitle}
          </span>
        </div>
        <button
          onClick={onDismissLastExported}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          <X size={15} />
        </button>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
        {lastExportedTrack.path}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
        <button
          onClick={() => onPlayLibraryTrack(lastExportedTrack)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
          }}
        >
          <Play size={14} fill="#fff" />
          {loc.settings.playRenderedNow}
        </button>
        <button
          onClick={(e) => onAddTrackToQueue(lastExportedTrack, e)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-cyan)',
            fontWeight: 600,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          {loc.settings.addRenderedToQueue}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToPlaylist(lastExportedTrack);
          }}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-purple)',
            fontWeight: 600,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <ListPlus size={14} />
          {loc.settings.addRenderedToPlaylist}
        </button>
        <button
          onClick={(e) => onOpenContainingFolder(lastExportedTrack.path, e)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <FolderOpen size={14} />
          {loc.settings.openRenderedFolder}
        </button>
      </div>
    </div>
);
