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
  const totalPlaylistDurationMs = playlistTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header panel */}
      <Card variant="panel" padding="md">
        <PageHeader
          icon={<ListMusic size={20} />}
          title={`${loc.playlists.title} (${playlists.length})`}
          description={loc.playlists.subtitle}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-black/20 p-1.5">
                <TextField
                  aria-label={loc.playlists.namePlaceholder}
                  placeholder={loc.playlists.namePlaceholder}
                  value={newPlaylistName}
                  onChange={(e) => onNewPlaylistNameChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onCreatePlaylist()}
                  className="w-44 sm:w-52"
                />
                <Button variant="primary" size="sm" onClick={onCreatePlaylist}>
                  <Plus size={15} /> {loc.playlists.create}
                </Button>
              </div>
              <Button onClick={onImportPlaylistM3u8}>
                <Upload size={15} className="text-accent-cyan" /> {loc.playlists.importM3u8}
              </Button>
            </div>
          }
        />
      </Card>

      {/* Playlist grid or the details of the selected playlist */}
      {selectedPlaylist ? (
        <div className="flex flex-col gap-4">
          <Card variant="panel" padding="md" className="@container">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button
                size="sm"
                onClick={() => {
                  onSelectPlaylist(null);
                  onSetPlaylistTracks([]);
                }}
              >
                <ArrowLeft size={15} className="text-accent-cyan" /> {loc.playlists.backToList}
              </Button>
              <span className="text-xs text-fg-muted">{formatDate(selectedPlaylist.created_at)}</span>
            </div>

            <div className="flex flex-col items-start gap-5 @lg:flex-row @lg:items-center">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl border border-accent-pink/35 bg-linear-135 from-accent-pink/25 to-accent-purple/25 shadow-halo-lg shadow-accent-pink/20 @lg:size-28">
                <ListMusic size={36} className="text-accent-pink" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h3 className="truncate text-2xl font-extrabold text-fg @lg:text-3xl">{selectedPlaylist.name}</h3>
                <div className="flex flex-wrap items-center gap-2.5 text-ui text-fg-muted">
                  <Badge tone="purple">
                    {playlistTracks.length} {loc.library.tracks}
                  </Badge>
                  {totalPlaylistDurationMs > 0 && (
                    <span className="font-mono tabular-nums">{formatTime(totalPlaylistDurationMs)}</span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={noTracks}
                    onClick={() => onPlayLibraryTrack(playlistTracks[0], playlistTracks)}
                  >
                    <Play size={15} fill="currentColor" /> {loc.player.play}
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
                    <Plus size={15} /> {loc.library.addToQueue}
                  </Button>
                  <Button variant="tinted" tone="pink" onClick={() => onExportPlaylistM3u8(selectedPlaylist)}>
                    <Download size={15} /> {loc.playlists.exportM3u8}
                  </Button>
                  <Button variant="danger" onClick={() => onDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)}>
                    <Trash2 size={15} /> {loc.playlists.delete}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Track table of the selected playlist */}
          <Card variant="panel" padding="md">
            {noTracks ? (
              <EmptyState icon={<ListMusic size={22} />} title={loc.playlists.emptyHint} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-fg-muted">
                      <th className="w-11 px-3 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5">{loc.player.track}</th>
                      <th className="hidden px-3 py-2.5 md:table-cell">{loc.player.artist}</th>
                      <th className="hidden px-3 py-2.5 sm:table-cell">{loc.library.format}</th>
                      <th className="px-3 py-2.5 text-right">{loc.queue.duration}</th>
                      <th className="w-32 px-3 py-2.5 text-center">{loc.common.edit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playlistTracks.map((item, idx) => (
                      <tr
                        key={`${item.id}-${idx}`}
                        onClick={() => onPlayLibraryTrack(item, playlistTracks)}
                        className="glass-card h-13 cursor-pointer border-b border-white/3"
                      >
                        <td className="px-3 py-2 text-center font-mono text-fg-muted">{idx + 1}</td>
                        <td className="min-w-0 px-3 py-2 font-semibold text-fg">
                          <div className="truncate">{item.title}</div>
                          <div className="truncate text-xs font-normal text-fg-secondary md:hidden">{item.artist}</div>
                        </td>
                        <td className="hidden max-w-52 truncate px-3 py-2 text-fg-secondary md:table-cell">{item.artist}</td>
                        <td className="hidden px-3 py-2 sm:table-cell">
                          <TrackFormatBadge track={item} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-fg-muted">{formatTime(item.duration_ms)}</td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-1">
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
          </Card>
        </div>
      ) : (
        <Card variant="panel" padding="md">
          {playlists.length === 0 ? (
            <EmptyState icon={<ListMusic size={22} />} title={loc.playlists.empty} description={loc.playlists.emptyHint} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(60),1fr))] gap-4">
              {playlists.map((pl) => (
                // The title button is stretched over the whole card (`after:inset-0`), so the card opens
                // on click and from the keyboard while the export/delete buttons stay separate buttons.
                <Card key={pl.id} interactive padding="md" className="relative flex flex-col justify-between gap-3.5 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent-pink/30 bg-linear-135 from-accent-pink/25 to-accent-purple/20">
                      <ListMusic size={18} className="text-accent-pink" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 truncate text-base font-bold text-fg">
                          <button
                            type="button"
                            onClick={() => onOpenPlaylist(pl)}
                            className="max-w-full truncate text-left after:absolute after:inset-0 after:rounded-2xl"
                          >
                            {pl.name}
                          </button>
                        </h4>
                        <Badge tone="purple" className="shrink-0">
                          {pl.track_count}
                        </Badge>
                      </div>
                      <span className="text-xs text-fg-muted">{formatDate(pl.created_at)}</span>
                    </div>
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
      )}
    </div>
  );
};
