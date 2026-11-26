import React from 'react';
import { ArrowLeft, Clock, Disc, FolderOpen, Heart, Music, Play, Plus, Shuffle, Sliders, Sparkles, Tag as TagIcon } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Card, IconButton } from '../../../components/ui';
import { NowPlayingMark, TrackAction, TrackFormatBadge } from './trackRowParts';
import { isHiRes } from './trackModel';

export type LibraryAlbumDetailProps = Pick<LibraryViewProps, 'handleBackFromAlbumDetail' | 'loc' | 'tracks' | 'handleOpenCoverPicker' | 'formatTime' | 'handlePlayAlbum' | 'handleShuffleAll' | 'refreshQueue' | 'showMessage' | 'handleOpenContainingFolder' | 'activeTrackId' | 'currentPlayingTrack' | 'handlePlayLibraryTrack' | 'status' | 'handleToggleFavorite' | 'handleAddTrackToQueue' | 'setTagEditorTrack' | 'setCreateStemProjectTrack' | 'setIsCreateStemProjectOpen'> & {
  selectedAlbumDetail: NonNullable<LibraryViewProps['selectedAlbumDetail']>;
  t: LibraryViewProps['loc'];
};

/** One album: hero header with cover, badges and album actions, then its track table. */
export const LibraryAlbumDetail: React.FC<LibraryAlbumDetailProps> = ({
  activeTrackId,
  currentPlayingTrack,
  formatTime,
  handleAddTrackToQueue,
  handleBackFromAlbumDetail,
  handleOpenContainingFolder,
  handleOpenCoverPicker,
  handlePlayAlbum,
  handlePlayLibraryTrack,
  handleShuffleAll,
  handleToggleFavorite,
  loc,
  refreshQueue,
  selectedAlbumDetail,
  setCreateStemProjectTrack,
  setIsCreateStemProjectOpen,
  setTagEditorTrack,
  showMessage,
  status,
  t,
  tracks,
}) => {
  const albumTracks = tracks
    .filter((track) => track.album_id === selectedAlbumDetail.id)
    .sort((a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0));
  const totalDurationMs = albumTracks.reduce((acc, track) => acc + (track.duration_ms || 0), 0);
  const uniqueFormats = Array.from(new Set(albumTracks.map((track) => track.format).filter(Boolean)));
  const hasHiRes = albumTracks.some(isHiRes);
  const empty = albumTracks.length === 0;

  return (
    <div className="flex flex-col gap-4.5">
      {/* Back navigation bar */}
      <div className="flex items-center justify-between">
        <Button onClick={handleBackFromAlbumDetail}>
          <ArrowLeft size={16} className="text-accent-cyan" />
          {loc.library.backToAlbums}
        </Button>
        <span className="text-ui text-fg-muted">{selectedAlbumDetail.title}</span>
      </div>

      {/* Hero header */}
      <Card variant="panel" padding="lg" className="relative flex items-center gap-6 overflow-hidden rounded-3xl">
        <div
          className="relative flex size-45 min-w-45 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-linear-135 from-accent-purple/30 to-accent-cyan/20 bg-cover bg-center shadow-2xl shadow-black/60"
          style={selectedAlbumDetail.cover_path ? { backgroundImage: `url("${selectedAlbumDetail.cover_path}")` } : undefined}
        >
          {!selectedAlbumDetail.cover_path && <Disc size={64} className="text-fg-muted/50" />}
          <button
            type="button"
            onClick={() => handleOpenCoverPicker(selectedAlbumDetail)}
            title={loc.covers.matchCover}
            className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md border border-white/20 bg-black/75 px-2 py-1 text-xxs text-accent-pink"
          >
            <Sparkles size={12} /> {loc.covers.matchCover}
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="pink" className="tracking-wider uppercase">ALBUM</Badge>
            {hasHiRes && <Badge tone="cyan" className="font-bold">HI-RES AUDIO</Badge>}
            {uniqueFormats.map((format) => (
              <Badge key={format} mono>{format}</Badge>
            ))}
            {selectedAlbumDetail.release_mbid && (
              <Badge tone="cyan" mono>MBID: {selectedAlbumDetail.release_mbid.slice(0, 8)}...</Badge>
            )}
          </div>

          <h2 className="text-3xl leading-tight font-extrabold text-fg text-shadow-soft">{selectedAlbumDetail.title}</h2>

          <p className="text-base font-semibold text-accent-pink">
            {selectedAlbumDetail.album_artist}
            {selectedAlbumDetail.year ? ` • ${selectedAlbumDetail.year}` : ''}
          </p>

          <div className="mt-0.5 flex items-center gap-3.5 text-ui text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Music size={14} className="text-accent-cyan" /> {albumTracks.length} {loc.library.tracks}
            </span>
            <span aria-hidden="true">•</span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {formatTime(totalDurationMs)}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <Button variant="primary" size="lg" onClick={() => handlePlayAlbum(albumTracks, 0)} disabled={empty}>
              <Play size={16} fill="currentColor" /> {loc.library.playFromStart}
            </Button>
            <Button variant="tinted" tone="pink" size="lg" onClick={() => handleShuffleAll(albumTracks)} disabled={empty} title={loc.library.shuffleAlbumTooltip}>
              <Shuffle size={15} /> {loc.library.shuffleAlbum}
            </Button>
            <Button
              size="lg"
              disabled={empty}
              title={loc.library.addToQueue}
              onClick={async () => {
                await invoke('add_uris_to_queue', { uris: albumTracks.map((track) => track.path) });
                await refreshQueue();
                showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(albumTracks.length)));
              }}
            >
              <Plus size={16} className="text-accent-cyan" /> {loc.library.addAlbumToQueue}
            </Button>
            <Button size="lg" onClick={() => handleOpenCoverPicker(selectedAlbumDetail)}>
              <Sparkles size={15} className="text-accent-pink" /> {loc.covers.matchCover}
            </Button>
            {!empty && (
              <IconButton
                variant="secondary"
                label={loc.library.openContainingFolder}
                onClick={(e) => handleOpenContainingFolder(albumTracks[0].path, e)}
                className="size-auto px-3.5 text-accent-cyan"
              >
                <FolderOpen size={15} />
              </IconButton>
            )}
          </div>
        </div>
      </Card>

      {/* Track table */}
      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-fg-muted">
              <th className="w-11.5 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">{loc.library.sortTitle}</th>
              <th className="px-3 py-2.5">{loc.library.sortArtist}</th>
              <th className="px-3 py-2.5">{loc.library.sortFormat}</th>
              <th className="px-3 py-2.5 text-right">{loc.queue.duration}</th>
              <th className="w-40 px-3 py-2.5 text-center">{loc.library.actions}</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={6} className="p-9 text-center text-fg-muted">
                  {loc.library.noAlbumTracks}
                </td>
              </tr>
            ) : (
              albumTracks.map((track, idx) => {
                const isCurrent = (activeTrackId != null && activeTrackId === track.id) || (currentPlayingTrack != null && currentPlayingTrack.id === track.id);
                return (
                  <tr
                    key={track.id}
                    onClick={() => handlePlayLibraryTrack(track, albumTracks)}
                    className={cn('glass-card h-12 cursor-pointer border-b border-white/3', isCurrent && 'bg-accent-purple/20')}
                  >
                    <td className="p-3 font-mono whitespace-nowrap text-fg-muted">
                      {isCurrent ? (
                        <NowPlayingMark playing={status.state === 'Playing'} />
                      ) : track.track_no ? (
                        track.disc_no && track.disc_no > 1 ? `${track.disc_no}.${track.track_no}` : track.track_no
                      ) : (
                        idx + 1
                      )}
                    </td>
                    <td className={cn('max-w-85 p-3 font-semibold', isCurrent ? 'text-accent-pink' : 'text-fg')}>
                      <div className="flex items-center gap-1.5 truncate">
                        {track.is_favorite && <Heart size={13} fill="currentColor" className="shrink-0 text-accent-pink" />}
                        <span className="truncate" title={track.title}>{track.title}</span>
                      </div>
                    </td>
                    <td className="max-w-55 truncate p-3 text-fg-secondary" title={track.artist}>
                      {track.artist}
                    </td>
                    <td className="p-3">
                      <TrackFormatBadge track={track} suffix={track.bit_depth && track.bit_depth >= 24 ? ` ${track.bit_depth}b` : undefined} />
                    </td>
                    <td className="p-3 text-right font-mono text-fg-muted">{formatTime(track.duration_ms)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <TrackAction
                          label={track.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                          tone={track.is_favorite ? 'pink' : 'neutral'}
                          onClick={(e) => handleToggleFavorite(track.id, e)}
                        >
                          <Heart size={15} fill={track.is_favorite ? 'currentColor' : 'none'} />
                        </TrackAction>
                        <TrackAction label={loc.player.play} tone="pink" onClick={() => handlePlayLibraryTrack(track, albumTracks)}>
                          <Play size={15} />
                        </TrackAction>
                        <TrackAction label={loc.library.addToQueue} tone="cyan" onClick={(e) => handleAddTrackToQueue(track, e)}>
                          <Plus size={15} />
                        </TrackAction>
                        <TrackAction label={loc.library.tagEditorTooltip} tone="cyan" onClick={() => setTagEditorTrack(track)}>
                          <TagIcon size={15} />
                        </TrackAction>
                        <TrackAction
                          label={loc.library.createStemProjectTooltip}
                          tone="pink"
                          onClick={() => {
                            setCreateStemProjectTrack(track);
                            setIsCreateStemProjectOpen(true);
                          }}
                        >
                          <Sliders size={15} />
                        </TrackAction>
                        <TrackAction label={loc.library.openContainingFolder} tone="cyan" onClick={(e) => handleOpenContainingFolder(track.path, e)}>
                          <FolderOpen size={15} />
                        </TrackAction>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
