import React from 'react';
import { FolderPlus, X } from 'lucide-react';
import { type Translations } from '../../i18n';
import { type TrackRecord } from '../../types/player';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          padding: '28px',
          width: '450px',
          maxWidth: '90vw',
          borderRadius: '16px',
          border: '1px solid var(--border-accent)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={18} color="var(--accent-purple)" /> {loc.playlists.title}
          </h3>
          <button
            onClick={onClose}
            title={loc.common.close}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {loc.playlists.title}: <strong style={{ color: 'var(--accent-pink)' }}>{track.title}</strong>
        </p>

        {playlists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {loc.playlists.empty}. {loc.playlists.emptyHint}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => onSelectPlaylist(pl.id, track.id)}
                className="glass-card"
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#fff',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                <span>{pl.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {pl.track_count} {loc.library.tracks}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
