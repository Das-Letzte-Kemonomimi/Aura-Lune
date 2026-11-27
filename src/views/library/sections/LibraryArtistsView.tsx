import React, { useMemo } from 'react';
import { ArrowLeft, Clock, Disc, Flame, Heart, Mic2, Play, Plus, Shuffle } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import type { TrackRecord } from '../../../types/library';
import { Badge, Button, Card, EmptyState, IconButton } from '../../../components/ui';
import type { ArtistSortField } from './LibraryToolbar';
import { NowPlayingMark, TrackAction, TrackCover, TrackFormatBadge } from './trackRowParts';

export type LibraryArtistsViewProps = Pick<
  LibraryViewProps,
  | 'albums'
  | 'activeTrackId'
  | 'currentPlayingTrack'
  | 'filteredArtists'
  | 'formatTime'
  | 'handleAddTrackToQueue'
  | 'handleOpenAlbumDetail'
  | 'handlePlayLibraryTrack'
  | 'handleShuffleAll'
  | 'handleToggleFavorite'
  | 'librarySearch'
  | 'loc'
  | 'refreshQueue'
  | 'setLibrarySearch'
  | 'setLibrarySubView'
  | 'showMessage'
  | 'status'
> & {
  t: LibraryViewProps['loc'];
  artistSortField: ArtistSortField;
  artistSortOrder: 'asc' | 'desc';
  selectedArtistName: string | null;
  setSelectedArtistName: (name: string | null) => void;
};

/** Album order: disc, then track number. */
const byDiscAndTrack = (tracks: TrackRecord[]) =>
  [...tracks].sort((a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0));

/** Artist cards with sorting and inline Artist Detail view (albums + tracks). */
export const LibraryArtistsView: React.FC<LibraryArtistsViewProps> = ({
  activeTrackId,
  albums,
  artistSortField,
  artistSortOrder,
  currentPlayingTrack,
  filteredArtists,
  formatTime,
  handleAddTrackToQueue,
  handleOpenAlbumDetail,
  handlePlayLibraryTrack,
  handleShuffleAll,
  handleToggleFavorite,
  librarySearch,
  loc,
  refreshQueue,
  selectedArtistName,
  setLibrarySearch,
  setLibrarySubView,
  setSelectedArtistName,
  showMessage,
  status,
  t,
}) => {
  const sortedArtists = useMemo(() => {
    const dir = artistSortOrder === 'asc' ? 1 : -1;
    return [...filteredArtists].sort((a, b) => {
      if (artistSortField === 'tracks') return (a.tracks.length - b.tracks.length) * dir;
      if (artistSortField === 'albums') return (a.albumIds.size - b.albumIds.size) * dir;
      if (artistSortField === 'plays') return (a.totalPlays - b.totalPlays) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [artistSortField, artistSortOrder, filteredArtists]);

  const selectedArtist = useMemo(
    () => (selectedArtistName ? sortedArtists.find((a) => a.name === selectedArtistName) ?? null : null),
    [selectedArtistName, sortedArtists],
  );

  const albumById = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums]);

  if (selectedArtist) {
    const artistTracks = byDiscAndTrack(selectedArtist.tracks);
    const artistAlbums = albums.filter((a) => selectedArtist.albumIds.has(a.id));

    return (
      <div className="flex flex-col gap-4">
        <Card variant="panel" padding="md" className="@container relative overflow-hidden rounded-3xl">
          {selectedArtist.sampleCover && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-8 bg-cover bg-center opacity-15 blur-3xl"
              style={{ backgroundImage: `url("${selectedArtist.sampleCover}")` }}
            />
          )}

          <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
            <Button size="sm" onClick={() => setSelectedArtistName(null)}>
              <ArrowLeft size={15} className="text-accent-cyan" />
              {loc.library.artists}
            </Button>
          </div>

          <div className="relative z-10 flex flex-col items-start gap-5 @lg:flex-row @lg:items-center">
            <div
              className="flex size-28 shrink-0 items-center justify-center rounded-2xl border-2 border-accent-pink/40 bg-linear-135 from-accent-pink/25 to-accent-purple/25 bg-cover bg-center shadow-halo-lg shadow-accent-pink/20 @lg:size-36"
              style={selectedArtist.sampleCover ? { backgroundImage: `url("${selectedArtist.sampleCover}")` } : undefined}
            >
              {!selectedArtist.sampleCover && <Mic2 size={44} className="text-accent-pink" />}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="pink" className="tracking-wider uppercase">{loc.library.artists}</Badge>
                {selectedArtist.totalPlays > 0 && (
                  <Badge tone="amber" mono>
                    <Flame size={11} /> {selectedArtist.totalPlays}
                  </Badge>
                )}
              </div>

              <h2 className="truncate text-2xl font-extrabold text-fg text-shadow-soft @lg:text-3xl">{selectedArtist.name}</h2>

              <div className="flex flex-wrap items-center gap-3 text-ui text-fg-muted">
                <span>{fmt(loc.library.artistTracksCount, String(artistTracks.length))}</span>
                {artistAlbums.length > 0 && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{fmt(loc.library.artistAlbumsCount, String(artistAlbums.length))}</span>
                  </>
                )}
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <Clock size={14} /> {formatTime(selectedArtist.totalDurationMs)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => artistTracks.length > 0 && handlePlayLibraryTrack(artistTracks[0], artistTracks)}>
                  <Play size={15} fill="currentColor" /> {loc.player.play}
                </Button>
                <Button variant="tinted" tone="pink" onClick={() => handleShuffleAll(artistTracks)}>
                  <Shuffle size={15} /> {loc.library.shuffleAlbum}
                </Button>
                <Button
                  variant="tinted"
                  tone="cyan"
                  onClick={async () => {
                    if (artistTracks.length === 0) return;
                    await invoke('add_uris_to_queue', { uris: artistTracks.map((track) => track.path) });
                    await refreshQueue();
                    showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(artistTracks.length)));
                  }}
                >
                  <Plus size={15} /> {loc.library.addToQueue}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {artistAlbums.length > 0 && (
          <Card variant="panel" padding="md">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
              <Disc size={16} className="text-accent-purple" /> {loc.library.albums} ({artistAlbums.length})
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))] gap-3">
              {artistAlbums.map((album) => (
                <Card
                  key={album.id}
                  interactive
                  padding="sm"
                  onClick={() => {
                    setLibrarySubView('albums');
                    handleOpenAlbumDetail(album);
                  }}
                  className="flex cursor-pointer flex-col gap-2"
                >
                  <div
                    className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-linear-135 from-accent-purple/20 to-accent-cyan/15 bg-cover bg-center"
                    style={album.cover_path ? { backgroundImage: `url("${album.cover_path}")` } : undefined}
                  >
                    {!album.cover_path && <Disc size={32} className="text-fg-muted/50" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-ui font-bold text-fg" title={album.title}>{album.title}</div>
                    {album.year && <div className="text-xs text-fg-muted">{album.year}</div>}
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        <Card variant="panel" padding="md" className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-fg-muted">
                <th className="w-11 px-3 py-2 text-center">#</th>
                <th className="px-3 py-2">{loc.library.sortTitle}</th>
                <th className="hidden px-3 py-2 sm:table-cell">{loc.library.sortFormat}</th>
                <th className="px-3 py-2 text-right">{loc.queue.duration}</th>
                <th className="w-28 px-3 py-2 text-center">{loc.library.actions}</th>
              </tr>
            </thead>
            <tbody>
              {artistTracks.map((track, idx) => {
                const isCurrent = (activeTrackId != null && activeTrackId === track.id) || (currentPlayingTrack != null && currentPlayingTrack.id === track.id);
                const album = track.album_id != null ? albumById.get(track.album_id) : undefined;
                return (
                  <tr
                    key={track.id}
                    onClick={() => handlePlayLibraryTrack(track, artistTracks)}
                    className={cn(
                      'glass-card h-13 cursor-pointer border-b border-white/3',
                      isCurrent && 'bg-linear-to-r from-accent-pink/25 via-accent-purple/10 to-transparent',
                    )}
                  >
                    <td className="px-3 py-2 text-center font-mono text-fg-muted">
                      {isCurrent ? <NowPlayingMark playing={status.state === 'Playing'} /> : idx + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <TrackCover src={album?.cover_path} />
                        <div className="min-w-0">
                          <div className={cn('truncate font-semibold', isCurrent ? 'text-accent-pink' : 'text-fg')}>{track.title}</div>
                          <div className="truncate text-xs text-fg-muted">{album?.title ?? loc.library.unknownAlbum}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <TrackFormatBadge track={track} />
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
                        <TrackAction label={loc.player.play} tone="pink" onClick={() => handlePlayLibraryTrack(track, artistTracks)}>
                          <Play size={15} />
                        </TrackAction>
                        <TrackAction label={loc.library.addToQueue} tone="cyan" onClick={(e) => handleAddTrackToQueue(track, e)}>
                          <Plus size={15} />
                        </TrackAction>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  return (
    <Card variant="panel" padding="md">
      {sortedArtists.length === 0 ? (
        <EmptyState
          icon={<Mic2 size={28} />}
          title={fmt(loc.library.emptySearchArtists, librarySearch)}
          action={librarySearch && <Button onClick={() => setLibrarySearch('')}>{loc.library.clearSearch}</Button>}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(64),1fr))] gap-4">
          {sortedArtists.map((artist) => (
            <Card
              key={artist.name}
              interactive
              padding="sm"
              onClick={() => setSelectedArtistName(artist.name)}
              className="flex cursor-pointer flex-col gap-3 rounded-2xl"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-accent-pink/40 bg-linear-135 from-accent-pink/25 to-accent-purple/25 bg-cover bg-center shadow-lift shadow-accent-pink/20"
                  style={artist.sampleCover ? { backgroundImage: `url("${artist.sampleCover}")` } : undefined}
                >
                  {!artist.sampleCover && <Mic2 size={26} className="text-accent-pink" />}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-base font-bold text-fg" title={artist.name}>
                    {artist.name}
                  </h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge>{fmt(loc.library.artistTracksCount, String(artist.tracks.length))}</Badge>
                    {artist.albumIds.size > 0 && (
                      <Badge tone="purple">{fmt(loc.library.artistAlbumsCount, String(artist.albumIds.size))}</Badge>
                    )}
                    {artist.totalPlays > 0 && (
                      <Badge tone="pink">
                        <Flame size={10} /> {artist.totalPlays}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="tinted"
                  tone="pink"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const sorted = byDiscAndTrack(artist.tracks);
                    if (sorted.length > 0) handlePlayLibraryTrack(sorted[0], sorted);
                  }}
                >
                  <Play size={13} fill="currentColor" /> {loc.player.play}
                </Button>
                <IconButton
                  variant="secondary"
                  size="sm"
                  label={loc.library.addToQueue}
                  className="text-accent-cyan"
                  onClick={async () => {
                    const sorted = byDiscAndTrack(artist.tracks);
                    if (sorted.length === 0) return;
                    await invoke('add_uris_to_queue', { uris: sorted.map((track) => track.path) });
                    await refreshQueue();
                    showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(sorted.length)));
                  }}
                >
                  <Plus size={14} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};
