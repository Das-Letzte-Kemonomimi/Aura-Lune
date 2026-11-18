import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ListMusic,
  Plus,
  Upload,
  Play,
  Download,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { type Translations } from '../../i18n';
import { type TrackRecord } from '../../types/player';

export interface Playlist {
  id: number;
  name: string;
  created_at: number;
  track_count: number;
}

export interface PlaylistsViewProps {
  layoutMaxWidth: string;
  loc: Translations;
  playlists: Playlist[];
  newPlaylistName: string;
  onNewPlaylistNameChange: (name: string) => void;
  onCreatePlaylist: () => void;
  onImportPlaylistM3u8: () => void;
  selectedPlaylist: Playlist | null;
  onSelectPlaylist: (playlist: Playlist | null) => void;
  playlistTracks: TrackRecord[];
  onSetPlaylistTracks: (tracks: TrackRecord[]) => void;
  onPlayLibraryTrack: (track: TrackRecord, playlist?: TrackRecord[]) => void;
  refreshQueue: () => Promise<void>;
  showMessage: (msg: string, isError?: boolean) => void;
  onExportPlaylistM3u8: (playlist: Playlist) => void;
  onDeletePlaylist: (id: number, name: string) => void;
  formatTime: (ms: number) => string;
  onAddTrackToQueue: (track: TrackRecord, e: React.MouseEvent) => void;
  onOpenContainingFolder: (path: string, e: React.MouseEvent) => void;
  onRemoveTrackFromPlaylist: (playlistId: number, trackId: number, e: React.MouseEvent) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  layoutMaxWidth,
  loc,
  playlists,
  newPlaylistName,
  onNewPlaylistNameChange,
  onCreatePlaylist,
  onImportPlaylistM3u8,
  selectedPlaylist,
  onSelectPlaylist,
  playlistTracks,
  onSetPlaylistTracks,
  onPlayLibraryTrack,
  refreshQueue,
  showMessage,
  onExportPlaylistM3u8,
  onDeletePlaylist,
  formatTime,
  onAddTrackToQueue,
  onOpenContainingFolder,
  onRemoveTrackFromPlaylist,
  onOpenPlaylist,
}) => {
  return (
    <div className="glass-panel" style={{ padding: '28px', maxWidth: layoutMaxWidth, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ListMusic size={20} color="var(--accent-pink)" /> {loc.playlists.title} ({playlists.length})
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {loc.playlists.subtitle}
          </p>
        </div>

        {/* Nowa playlista input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder={loc.playlists.namePlaceholder}
            value={newPlaylistName}
            onChange={(e) => onNewPlaylistNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreatePlaylist()}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(0,0,0,0.3)',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          />
          <button
            onClick={onCreatePlaylist}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <Plus size={16} /> {loc.playlists.create}
          </button>
          <button
            onClick={onImportPlaylistM3u8}
            className="glass-card"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title={loc.playlists.importM3u8}
          >
            <Upload size={16} color="var(--accent-cyan)" /> {loc.playlists.importM3u8}
          </button>
        </div>
      </div>

      {/* Siatka playlist lub szczegóły wybranej playlisty */}
      {selectedPlaylist ? (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <button
                onClick={() => {
                  onSelectPlaylist(null);
                  onSetPlaylistTracks([]);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: 0,
                  marginBottom: '6px',
                }}
              >
                {loc.playlists.backToList}
              </button>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{selectedPlaylist.name}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {playlistTracks.length} {loc.library.tracks} •{' '}
                {new Date(selectedPlaylist.created_at * 1000).toLocaleDateString()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  if (playlistTracks.length > 0) {
                    onPlayLibraryTrack(playlistTracks[0], playlistTracks);
                  }
                }}
                disabled={playlistTracks.length === 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: playlistTracks.length === 0 ? 'default' : 'pointer',
                  opacity: playlistTracks.length === 0 ? 0.5 : 1,
                  border: 'none',
                }}
              >
                <Play size={16} /> {loc.player.play}
              </button>
              <button
                onClick={async () => {
                  if (playlistTracks.length > 0) {
                    await invoke('add_uris_to_queue', { uris: playlistTracks.map((t) => t.path) });
                    await refreshQueue();
                    showMessage(
                      loc.notifications.loadedTracksToQueueMsg.replace('{0}', String(playlistTracks.length))
                    );
                  }
                }}
                disabled={playlistTracks.length === 0}
                className="glass-card"
                style={{
                  padding: '8px 14px',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: playlistTracks.length === 0 ? 'default' : 'pointer',
                  opacity: playlistTracks.length === 0 ? 0.5 : 1,
                }}
                title={loc.library.addToQueue}
              >
                <Plus size={16} /> {loc.library.addToQueue}
              </button>
              <button
                onClick={() => onExportPlaylistM3u8(selectedPlaylist)}
                className="glass-card"
                style={{
                  padding: '8px 14px',
                  color: 'var(--accent-pink)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
                title={loc.playlists.exportM3u8}
              >
                <Download size={16} /> {loc.playlists.exportM3u8}
              </button>
              <button
                onClick={() => onDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)}
                className="glass-card"
                style={{
                  padding: '8px 14px',
                  color: '#ff6b81',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={16} /> {loc.playlists.delete}
              </button>
            </div>
          </div>

          {/* Tabela utworów w wybranej playliście */}
          {playlistTracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              {loc.playlists.emptyHint}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>{loc.player.track}</th>
                    <th style={{ padding: '10px 12px' }}>{loc.player.artist}</th>
                    <th style={{ padding: '10px 12px' }}>{loc.library.format}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{loc.queue.duration}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>{loc.common.edit}</th>
                  </tr>
                </thead>
                <tbody>
                  {playlistTracks.map((item, idx) => (
                    <tr
                      key={`${item.id}-${idx}`}
                      className="glass-card"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{item.title}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.artist}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {item.format}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatTime(item.duration_ms)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={() => onPlayLibraryTrack(item, playlistTracks)}
                            title={loc.player.play}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer' }}
                          >
                            <Play size={16} />
                          </button>
                          <button
                            onClick={(e) => onAddTrackToQueue(item, e)}
                            title={loc.playlists.addToQueue}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={(e) => onOpenContainingFolder(item.path, e)}
                            title={loc.library.openContainingFolder}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}
                          >
                            <FolderOpen size={15} />
                          </button>
                          <button
                            onClick={(e) => onRemoveTrackFromPlaylist(selectedPlaylist.id, item.id, e)}
                            title={loc.playlists.delete}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {playlists.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
              <ListMusic size={44} style={{ opacity: 0.3, marginBottom: '14px' }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>{loc.playlists.empty}</p>
              <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.7 }}>{loc.playlists.emptyHint}</p>
            </div>
          ) : (
            playlists.map((pl) => (
              <div
                key={pl.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => onOpenPlaylist(pl)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{pl.name}</h4>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: 'var(--accent-purple)',
                      }}
                    >
                      {pl.track_count} {loc.library.tracks}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(pl.created_at * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{loc.playlists.playAll} →</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportPlaylistM3u8(pl);
                      }}
                      title={loc.playlists.exportM3u8}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlaylist(pl.id, pl.name);
                      }}
                      title={loc.playlists.delete}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
