import React from 'react';
import { FolderPlus, X } from '../ui/icons';
import { type Translations } from '../../i18n';
import { type TrackRecord } from '../../types/player';
import { ModalShell } from '../ui';

export interface PlaylistSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackRecord | null;
  playlists: Array<{ id: number; name: string; track_count: number; created_at?: number }>;
  onSelectPlaylist: (playlistId: number, trackId: number) => void;
  loc: Translations;
}

export const PlaylistSelectModal: React.FC<PlaylistSelectModalProps> = ({
  isOpen,
  onClose,
  track,
  playlists,
  onSelectPlaylist,
  loc,
}) => {
  if (!isOpen || !track) return null;

  return (
    <ModalShell
      onClose={onClose}
      layer="nested"
      className="w-112.5 max-w-[90vw] rounded-2xl border border-line-accent p-7"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="m-0 flex items-center gap-2 text-lg">
          <FolderPlus size={18} className="text-accent-purple" /> {loc.playlists.title}
        </h3>
        <button
          onClick={onClose}
          title={loc.common.close}
          className="border-0 bg-transparent text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>
      <p className="mb-4 text-sm text-fg-secondary">
        {loc.playlists.title}: <strong className="text-accent-pink">{track.title}</strong>
      </p>

      {playlists.length === 0 ? (
        <div className="p-5 text-center text-sm text-fg-muted">
          {loc.playlists.empty}. {loc.playlists.emptyHint}
        </div>
      ) : (
        <div className="flex max-h-62.5 flex-col gap-2 overflow-y-auto">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id, track.id)}
              className="glass-card flex items-center justify-between px-4 py-3 text-left text-sm text-fg"
            >
              <span>{pl.name}</span>
              <span className="text-xs text-fg-muted">
                {pl.track_count} {loc.library.tracks}
              </span>
            </button>
          ))}
        </div>
      )}
    </ModalShell>
  );
};
