import React, { useId } from 'react';
import { FolderPlus } from '../ui/icons';
import { type Translations } from '../../i18n';
import { type TrackRecord } from '../../types/player';
import { Button, EmptyState, ModalBody, ModalHeader, ModalShell } from '../ui';

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
  const id = useId();
  if (!isOpen || !track) return null;

  return (
    <ModalShell onClose={onClose} layer="nested" size="sm" labelledBy={`${id}-title`}>
      <ModalHeader
        titleId={`${id}-title`}
        title={loc.playlists.title}
        subtitle={
          <>
            {loc.playlists.title}: <strong className="text-accent-pink">{track.title}</strong>
          </>
        }
        icon={<FolderPlus size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody>
        {playlists.length === 0 ? (
          <EmptyState title={loc.playlists.empty} description={loc.playlists.emptyHint} />
        ) : (
          <div className="flex max-h-62.5 flex-col gap-2 overflow-y-auto">
            {playlists.map((pl) => (
              <Button
                key={pl.id}
                onClick={() => onSelectPlaylist(pl.id, track.id)}
                className="justify-between px-4 py-3 text-left"
              >
                <span className="truncate">{pl.name}</span>
                <span className="text-xs font-normal text-fg-muted">
                  {pl.track_count} {loc.library.tracks}
                </span>
              </Button>
            ))}
          </div>
        )}
      </ModalBody>
    </ModalShell>
  );
};
