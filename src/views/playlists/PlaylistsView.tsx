import type { Playlist } from '../../types/playlist';
export type { Playlist } from '../../types/playlist';
import React from 'react';
import { invoke } from '../../api/ipc';
import {
  ArrowLeft,
  ArrowRight,
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
import { Badge, Button, Card, EmptyState, PageHeader, TextField } from '../../components/ui';
import { TrackAction, TrackFormatBadge } from '../library/sections/trackRowParts';

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

const formatDate = (unixSeconds: number) => new Date(unixSeconds * 1000).toLocaleDateString();

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
  const noTracks = playlistTracks.length === 0;

  return (
    <Card variant="panel" padding="none" className="mx-auto p-7" style={{ maxWidth: layoutMaxWidth }}>
      <PageHeader
        className="mb-6"
        icon={<ListMusic size={20} />}
        title={`${loc.playlists.title} (${playlists.length})`}
        description={loc.playlists.subtitle}
        actions={
          <>
            {/* New playlist input */}
            <TextField
              aria-label={loc.playlists.namePlaceholder}
              placeholder={loc.playlists.namePlaceholder}
              value={newPlaylistName}
              onChange={(e) => onNewPlaylistNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCreatePlaylist()}
              className="w-56"
            />
            <Button variant="primary" onClick={onCreatePlaylist}>
              <Plus size={16} /> {loc.playlists.create}
            </Button>
            <Button onClick={onImportPlaylistM3u8}>
              <Upload size={16} className="text-accent-cyan" /> {loc.playlists.importM3u8}
            </Button>
          </>
        }
      />

      {/* Playlist grid or the details of the selected playlist */}
      {selectedPlaylist ? (
        <div>
          <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-col items-start gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 text-accent-cyan hover:text-accent-cyan"
                onClick={() => {
                  onSelectPlaylist(null);
                  onSetPlaylistTracks([]);
                }}
              >
                <ArrowLeft size={14} /> {loc.playlists.backToList}
              </Button>
              <h3 className="text-xl font-bold">{selectedPlaylist.name}</h3>
              <span className="text-ui text-fg-muted">
                {playlistTracks.length} {loc.library.tracks} • {formatDate(selectedPlaylist.created_at)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="primary"
                disabled={noTracks}
                onClick={() => onPlayLibraryTrack(playlistTracks[0], playlistTracks)}
              >
                <Play size={16} /> {loc.player.play}
              </Button>
              <Button
                variant="tinted"
                tone="cyan"
                disabled={noTracks}
                onClick={async () => {
                  await invoke('add_uris_to_queue', { uris: playlistTracks.map((t) => t.path) });
                  await refreshQueue();
                  showMessage(fmt(loc.notifications.loadedTracksToQueueMsg, String(playlistTracks.length)));
                }}
              >
                <Plus size={16} /> {loc.library.addToQueue}
              </Button>
              <Button variant="tinted" tone="pink" onClick={() => onExportPlaylistM3u8(selectedPlaylist)}>
                <Download size={16} /> {loc.playlists.exportM3u8}
              </Button>
              <Button variant="danger" onClick={() => onDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)}>
                <Trash2 size={16} /> {loc.playlists.delete}
              </Button>
            </div>
          </div>

          {/* Track table of the selected playlist */}
          {noTracks ? (
            <EmptyState icon={<ListMusic size={22} />} title={loc.playlists.emptyHint} />
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
                    <tr key={`${item.id}-${idx}`} className="border-b border-white/3 hover:bg-surface-hover">
                      <td className="p-3 font-mono text-fg-muted">{idx + 1}</td>
                      <td className="p-3 font-semibold">{item.title}</td>
                      <td className="p-3 text-fg-secondary">{item.artist}</td>
                      <td className="p-3">
                        <TrackFormatBadge track={item} />
                      </td>
                      <td className="p-3 text-right font-mono">{formatTime(item.duration_ms)}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <TrackAction tone="pink" label={loc.player.play} onClick={() => onPlayLibraryTrack(item, playlistTracks)}>
                            <Play size={15} />
                          </TrackAction>
                          <TrackAction tone="cyan" label={loc.playlists.addToQueue} onClick={(e) => onAddTrackToQueue(item, e)}>
                            <Plus size={15} />
                          </TrackAction>
                          <TrackAction
                            tone="cyan"
                            label={loc.library.openContainingFolder}
                            onClick={(e) => onOpenContainingFolder(item.path, e)}
                          >
                            <FolderOpen size={15} />
                          </TrackAction>
                          <TrackAction
                            tone="neutral"
                            label={loc.playlists.delete}
                            onClick={(e) => onRemoveTrackFromPlaylist(selectedPlaylist.id, item.id, e)}
                          >
                            <Trash2 size={15} />
                          </TrackAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : playlists.length === 0 ? (
        <EmptyState icon={<ListMusic size={22} />} title={loc.playlists.empty} description={loc.playlists.emptyHint} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(65),1fr))] gap-4">
          {playlists.map((pl) => (
            // The title button is stretched over the whole card (`after:inset-0`), so the card opens
            // on click and from the keyboard while the export/delete buttons stay separate buttons.
            <Card key={pl.id} interactive padding="md" className="relative flex flex-col justify-between gap-3.5 rounded-2xl">
              <div>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="text-lg font-bold text-fg">
                    <button
                      type="button"
                      onClick={() => onOpenPlaylist(pl)}
                      className="text-left after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {pl.name}
                    </button>
                  </h4>
                  <Badge tone="purple">
                    {pl.track_count} {loc.library.tracks}
                  </Badge>
                </div>
                <span className="text-xs text-fg-muted">{formatDate(pl.created_at)}</span>
              </div>

              <div className="flex items-center justify-between border-t border-line pt-2.5">
                <span className="flex items-center gap-1 text-ui text-accent-cyan">
                  {loc.playlists.playAll} <ArrowRight size={14} />
                </span>
                <div className="relative flex gap-1.5">
                  <TrackAction tone="pink" label={loc.playlists.exportM3u8} onClick={() => onExportPlaylistM3u8(pl)}>
                    <Download size={15} />
                  </TrackAction>
                  <TrackAction tone="neutral" label={loc.playlists.delete} onClick={() => onDeletePlaylist(pl.id, pl.name)}>
                    <Trash2 size={15} />
                  </TrackAction>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};
