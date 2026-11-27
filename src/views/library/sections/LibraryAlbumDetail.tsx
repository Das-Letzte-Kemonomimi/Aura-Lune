import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Disc,
  FolderOpen,
  Heart,
  MoreVertical,
  Music,
  Play,
  Plus,
  Shuffle,
  Sliders,
  Sparkles,
  Tag as TagIcon,
} from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Badge, Button, Card, IconButton, MenuItem, Popover } from '../../../components/ui';
import { NowPlayingMark, TrackAction, TrackFormatBadge, TrackRowMenu, type TrackMenuEntry } from './trackRowParts';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const albumTracks = tracks
    .filter((track) => track.album_id === selectedAlbumDetail.id)
    .sort((a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0));
  const totalDurationMs = albumTracks.reduce((acc, track) => acc + (track.duration_ms || 0), 0);
  const uniqueFormats = Array.from(new Set(albumTracks.map((track) => track.format).filter(Boolean)));
  const hasHiRes = albumTracks.some(isHiRes);
  const empty = albumTracks.length === 0;
  const hasMultiDisc = new Set(albumTracks.map((t) => t.disc_no || 1)).size > 1;

  const menuEntries = (track: (typeof albumTracks)[number]): TrackMenuEntry[] => [
    { label: loc.library.tagEditorTooltip, icon: <TagIcon size={15} className="text-accent-cyan" />, onSelect: () => setTagEditorTrack(track) },
    {
      label: loc.library.createStemProjectTooltip,
      icon: <Sliders size={15} className="text-accent-pink" />,
      onSelect: () => {
        setCreateStemProjectTrack(track);
        setIsCreateStemProjectOpen(true);
      },
    },
    { label: loc.library.openContainingFolder, icon: <FolderOpen size={15} className="text-accent-cyan" />, onSelect: (e) => handleOpenContainingFolder(track.path, e) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Hero header */}
      <Card variant="panel" padding="md" className="@container relative overflow-hidden rounded-3xl">
        {selectedAlbumDetail.cover_path && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-8 bg-cover bg-center opacity-15 blur-3xl"
            style={{ backgroundImage: `url("${selectedAlbumDetail.cover_path}")` }}
          />
        )}

        <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
          <Button size="sm" onClick={handleBackFromAlbumDetail}>
            <ArrowLeft size={15} className="text-accent-cyan" />
            {loc.library.backToAlbums}
          </Button>
          <span className="truncate text-xs font-medium text-fg-muted">{selectedAlbumDetail.album_artist}</span>
        </div>

        <div className="relative z-10 flex flex-col items-start gap-5 @lg:flex-row @lg:items-center">
          <div
            className="relative flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-linear-135 from-accent-purple/30 to-accent-cyan/20 bg-cover bg-center shadow-2xl shadow-black/60 @lg:size-44"
            style={selectedAlbumDetail.cover_path ? { backgroundImage: `url("${selectedAlbumDetail.cover_path}")` } : undefined}
          >
            {!selectedAlbumDetail.cover_path && <Disc size={56} className="text-fg-muted/50" />}
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

            <h2 className="text-2xl leading-tight font-extrabold text-fg text-shadow-soft @lg:text-3xl">{selectedAlbumDetail.title}</h2>

            <p className="text-sm font-semibold text-accent-pink @lg:text-base">
              {selectedAlbumDetail.album_artist}
              {selectedAlbumDetail.year ? ` • ${selectedAlbumDetail.year}` : ''}
            </p>

            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-ui text-fg-muted">
              <span className="flex items-center gap-1.5">
                <Music size={14} className="text-accent-cyan" /> {albumTracks.length} {loc.library.tracks}
              </span>
              <span aria-hidden="true">•</span>
              <span className="flex items-center gap-1.5 font-mono tabular-nums">
                <Clock size={14} /> {formatTime(totalDurationMs)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => handlePlayAlbum(albumTracks, 0)} disabled={empty}>
                <Play size={15} fill="currentColor" /> {loc.library.playFromStart}
              </Button>
              <Button variant="tinted" tone="pink" onClick={() => handleShuffleAll(albumTracks)} disabled={empty} title={loc.library.shuffleAlbumTooltip}>
                <Shuffle size={15} /> {loc.library.shuffleAlbum}
              </Button>
              <Button
                variant="tinted"
                tone="cyan"
                disabled={empty}
                title={loc.library.addToQueue}
                onClick={async () => {
                  await invoke('add_uris_to_queue', { uris: albumTracks.map((track) => track.path) });
                  await refreshQueue();
                  showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(albumTracks.length)));
                }}
              >
                <Plus size={15} /> {loc.library.addAlbumToQueue}
              </Button>
              <Popover
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                side="bottom"
                align="end"
                label={loc.library.moreActions}
                trigger={
                  <IconButton
                    variant="secondary"
                    label={loc.library.moreActions}
                    onClick={() => setMoreOpen((prev) => !prev)}
                  >
                    <MoreVertical size={15} />
                  </IconButton>
                }
              >
                <MenuItem
                  icon={<Sparkles size={15} className="text-accent-pink" />}
                  onClick={() => {
                    setMoreOpen(false);
                    handleOpenCoverPicker(selectedAlbumDetail);
                  }}
                >
                  {loc.covers.matchCover}
                </MenuItem>
                {!empty && (
                  <MenuItem
                    icon={<FolderOpen size={15} className="text-accent-cyan" />}
                    onClick={(e) => {
                      setMoreOpen(false);
                      handleOpenContainingFolder(albumTracks[0].path, e);
                    }}
                  >
                    {loc.library.openContainingFolder}
                  </MenuItem>
                )}
              </Popover>
            </div>
          </div>
        </div>
      </Card>

      {/* Track table */}
      <Card variant="panel" padding="md" className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-fg-muted">
              <th className="w-11 px-3 py-2.5 text-center">#</th>
              <th className="px-3 py-2.5">{loc.library.sortTitle}</th>
              <th className="hidden px-3 py-2.5 md:table-cell">{loc.library.sortArtist}</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">{loc.library.sortFormat}</th>
              <th className="px-3 py-2.5 text-right">{loc.queue.duration}</th>
              <th className="w-32 px-3 py-2.5 text-center">{loc.library.actions}</th>
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
                const disc = track.disc_no || 1;
                const prevDisc = idx > 0 ? albumTracks[idx - 1].disc_no || 1 : null;
                const showDiscHeader = hasMultiDisc && disc !== prevDisc;
                return (
                  <React.Fragment key={track.id}>
                    {showDiscHeader && (
                      <tr>
                        <td colSpan={6} className="border-b border-line bg-black/20 px-3 py-1.5 text-xs font-bold tracking-wider text-accent-cyan uppercase">
                          Disc {disc}
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => handlePlayLibraryTrack(track, albumTracks)}
                      className={cn(
                        'glass-card h-13 cursor-pointer border-b border-white/3',
                        isCurrent && 'bg-linear-to-r from-accent-pink/25 via-accent-purple/10 to-transparent',
                      )}
                    >
                      <td className="px-3 py-2 text-center font-mono whitespace-nowrap text-fg-muted">
                        {isCurrent ? (
                          <NowPlayingMark playing={status.state === 'Playing'} />
                        ) : (
                          track.track_no || idx + 1
                        )}
                      </td>
                      <td className={cn('min-w-0 px-3 py-2 font-semibold', isCurrent ? 'text-accent-pink' : 'text-fg')}>
                        <div className="flex items-center gap-1.5 truncate">
                          {track.is_favorite && <Heart size={13} fill="currentColor" className="shrink-0 text-accent-pink" />}
                          <span className="truncate" title={track.title}>{track.title}</span>
                        </div>
                        <div className="truncate text-xs font-normal text-fg-secondary md:hidden">{track.artist}</div>
                      </td>
                      <td className="hidden max-w-52 truncate px-3 py-2 text-fg-secondary md:table-cell" title={track.artist}>
                        {track.artist}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        <TrackFormatBadge track={track} suffix={track.bit_depth && track.bit_depth >= 24 ? ` ${track.bit_depth}b` : undefined} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-fg-muted">{formatTime(track.duration_ms)}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
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
                          <TrackRowMenu label={loc.library.moreActions} entries={menuEntries(track)} />
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
