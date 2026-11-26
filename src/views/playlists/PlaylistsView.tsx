import type { Playlist } from '../../types/playlist';
export type { Playlist } from '../../types/playlist';
import React from 'react';
import { invoke } from '../../api/ipc';
import {
  ListMusic,
  Plus,
  Upload,
  Play,
  Download,
  Trash2,
  FolderOpen,
} from '../../components/ui/icons';
import { type Translations } from '../../i18n';
import { type TrackRecord } from '../../types/player';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';


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
    <div className="glass-panel mx-auto my-0 p-7" style={{ maxWidth: layoutMaxWidth }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-xl">
            <ListMusic size={20} className="text-accent-pink" /> {loc.playlists.title} ({playlists.length})
          </h2>
          <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
            {loc.playlists.subtitle}
          </p>
        </div>

        {/* New playlist input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={loc.playlists.namePlaceholder}
            value={newPlaylistName}
            onChange={(e) => onNewPlaylistNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreatePlaylist()}
            className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm text-fg"
          />
          <button
            onClick={onCreatePlaylist}
            className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-3.5 py-2 text-sm font-semibold text-on-accent"
          >
            <Plus size={16} /> {loc.playlists.create}
          </button>
          <button
            onClick={onImportPlaylistM3u8}
            className="glass-card flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-fg"
            title={loc.playlists.importM3u8}
          >
            <Upload size={16} className="text-accent-cyan" /> {loc.playlists.importM3u8}
          </button>
        </div>
      </div>

      {/* Playlist grid or the details of the selected playlist */}
      {selectedPlaylist ? (
        <div>
          <div className="mb-4.5 flex items-center justify-between border-b border-line pb-3">
            <div>
              <button
                onClick={() => {
                  onSelectPlaylist(null);
                  onSetPlaylistTracks([]);
                }}
                className="mb-1.5 border-0 bg-transparent p-0 text-ui text-accent-cyan"
              >
                {loc.playlists.backToList}
              </button>
              <h3 className="m-0 text-xl font-bold">{selectedPlaylist.name}</h3>
              <span className="text-ui text-fg-muted">
                {playlistTracks.length} {loc.library.tracks} •{' '}
                {new Date(selectedPlaylist.created_at * 1000).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  if (playlistTracks.length > 0) {
                    onPlayLibraryTrack(playlistTracks[0], playlistTracks);
                  }
                }}
                disabled={playlistTracks.length === 0}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-4 py-2 text-sm font-semibold text-on-accent',
                  playlistTracks.length === 0 ? 'cursor-default' : 'cursor-pointer',
                  playlistTracks.length === 0 ? 'opacity-50' : 'opacity-100',
                )}
              >
                <Play size={16} /> {loc.player.play}
              </button>
              <button
                onClick={async () => {
                  if (playlistTracks.length > 0) {
                    await invoke('add_uris_to_queue', { uris: playlistTracks.map((t) => t.path) });
                    await refreshQueue();
                    showMessage(
                      fmt(loc.notifications.loadedTracksToQueueMsg, String(playlistTracks.length))
                    );
                  }
                }}
                disabled={playlistTracks.length === 0}
                className={cn(
                  'glass-card flex items-center gap-1.5 px-3.5 py-2 text-sm text-accent-cyan',
                  playlistTracks.length === 0 ? 'cursor-default' : 'cursor-pointer',
                  playlistTracks.length === 0 ? 'opacity-50' : 'opacity-100',
                )}
                title={loc.library.addToQueue}
              >
                <Plus size={16} /> {loc.library.addToQueue}
              </button>
              <button
                onClick={() => onExportPlaylistM3u8(selectedPlaylist)}
                className="glass-card flex items-center gap-1.5 px-3.5 py-2 text-sm text-accent-pink"
                title={loc.playlists.exportM3u8}
              >
                <Download size={16} /> {loc.playlists.exportM3u8}
              </button>
              <button
                onClick={() => onDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)}
                className="glass-card flex items-center gap-1.5 px-3.5 py-2 text-sm text-rose-400"
              >
                <Trash2 size={16} /> {loc.playlists.delete}
              </button>
            </div>
          </div>

          {/* Track table of the selected playlist */}
          {playlistTracks.length === 0 ? (
            <div className="p-10 text-center text-fg-muted">
              {loc.playlists.emptyHint}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-fg-muted">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">{loc.player.track}</th>
                    <th className="px-3 py-2.5">{loc.player.artist}</th>
                    <th className="px-3 py-2.5">{loc.library.format}</th>
                    <th className="px-3 py-2.5 text-right">{loc.queue.duration}</th>
                    <th className="px-3 py-2.5 text-center">{loc.common.edit}</th>
                  </tr>
                </thead>
                <tbody>
                  {playlistTracks.map((item, idx) => (
                    <tr
                      key={`${item.id}-${idx}`}
                      className="glass-card border-b border-white/3"
                    >
                      <td className="p-3 font-mono text-fg-muted">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-semibold">{item.title}</td>
                      <td className="p-3 text-fg-secondary">{item.artist}</td>
                      <td className="p-3">
                        <span className="rounded-sm bg-white/8 px-1.5 py-0.5 font-mono text-xxs">
                          {item.format}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatTime(item.duration_ms)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => onPlayLibraryTrack(item, playlistTracks)}
                            title={loc.player.play}
                            className="border-0 bg-transparent text-accent-pink"
                          >
                            <Play size={16} />
                          </button>
                          <button
                            onClick={(e) => onAddTrackToQueue(item, e)}
                            title={loc.playlists.addToQueue}
                            className="border-0 bg-transparent text-accent-cyan"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={(e) => onOpenContainingFolder(item.path, e)}
                            title={loc.library.openContainingFolder}
                            className="border-0 bg-transparent text-accent-cyan"
                          >
                            <FolderOpen size={15} />
                          </button>
                          <button
                            onClick={(e) => onRemoveTrackFromPlaylist(selectedPlaylist.id, item.id, e)}
                            title={loc.playlists.delete}
                            className="border-0 bg-transparent text-fg-muted"
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(65),1fr))] gap-4">
          {playlists.length === 0 ? (
            <div className="col-span-full p-12.5 text-center text-fg-muted">
              <ListMusic size={44} className="mb-3.5 opacity-30" />
              <p className="m-0 text-md">{loc.playlists.empty}</p>
              <p className="mt-1.5 text-ui opacity-70">{loc.playlists.emptyHint}</p>
            </div>
          ) : (
            playlists.map((pl) => (
              <div
                key={pl.id}
                className="glass-card flex cursor-pointer flex-col justify-between gap-3.5 rounded-2xl p-5 transition-all duration-200"
                onClick={() => onOpenPlaylist(pl)}
              >
                <div>
                  <div className="mb-2 flex items-start justify-between">
                    <h4 className="m-0 text-lg font-bold text-fg">{pl.name}</h4>
                    <span className="rounded-xl bg-accent-purple/20 px-2 py-1 text-xs text-accent-purple">
                      {pl.track_count} {loc.library.tracks}
                    </span>
                  </div>
                  <span className="text-xs text-fg-muted">
                    {new Date(pl.created_at * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                  <span className="text-ui text-accent-cyan">{loc.playlists.playAll} →</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportPlaylistM3u8(pl);
                      }}
                      title={loc.playlists.exportM3u8}
                      className="border-0 bg-transparent p-1 text-accent-pink"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlaylist(pl.id, pl.name);
                      }}
                      title={loc.playlists.delete}
                      className="border-0 bg-transparent p-1 text-fg-muted"
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
