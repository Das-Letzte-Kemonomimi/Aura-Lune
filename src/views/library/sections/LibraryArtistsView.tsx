import React from 'react';
import { Flame, ListMusic, Mic2, Play, Plus } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import type { TrackRecord } from '../../../types/library';
import { Badge, Button, Card, EmptyState, IconButton } from '../../../components/ui';

export type LibraryArtistsViewProps = Pick<LibraryViewProps, 'filteredArtists' | 'tracks' | 'loc' | 'librarySearch' | 'setLibrarySearch' | 'handlePlayLibraryTrack' | 'refreshQueue' | 'showMessage' | 'setLibrarySubView'> & {
  t: LibraryViewProps['loc'];
};

/** Album order: disc, then track number. */
const byDiscAndTrack = (tracks: TrackRecord[]) =>
  [...tracks].sort((a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0));

/** Artist cards with their track, album and play counts and quick play / queue / filter actions. */
export const LibraryArtistsView: React.FC<LibraryArtistsViewProps> = ({
  filteredArtists,
  handlePlayLibraryTrack,
  librarySearch,
  loc,
  refreshQueue,
  setLibrarySearch,
  setLibrarySubView,
  showMessage,
  t,
  tracks,
}) => (
  <div>
    <p className="mb-4 text-ui text-fg-muted">
      {filteredArtists.length !== new Set(tracks.map((track) => track.artist || loc.stats.unknownArtist)).size
        ? fmt(loc.library.resultsArtists, String(filteredArtists.length))
        : fmt(loc.library.totalArtists, String(filteredArtists.length))}
    </p>

    {filteredArtists.length === 0 ? (
      <EmptyState
        icon={<Mic2 size={28} />}
        title={fmt(loc.library.emptySearchArtists, librarySearch)}
        action={librarySearch && <Button onClick={() => setLibrarySearch('')}>{loc.library.clearSearch}</Button>}
      />
    ) : (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-4">
        {filteredArtists.map((artist) => (
          <Card key={artist.name} interactive padding="sm" className="flex flex-col gap-3">
            <div className="flex items-center gap-3.5">
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-accent-pink/40 bg-linear-135 from-accent-pink/25 to-accent-purple/25 bg-cover bg-center shadow-lift shadow-accent-pink/20"
                style={artist.sampleCover ? { backgroundImage: `url("${artist.sampleCover}")` } : undefined}
              >
                {!artist.sampleCover && <Mic2 size={26} className="text-accent-pink" />}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="truncate text-base font-bold text-fg" title={artist.name}>
                  {artist.name}
                </h4>
                <div className="mt-1.5 flex flex-wrap gap-2">
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

            <div className="mt-auto flex gap-2">
              <Button
                variant="primary"
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
              <Button
                onClick={() => {
                  setLibrarySearch(artist.name);
                  setLibrarySubView('tracks');
                }}
                title={loc.library.filterArtistTracksTooltip}
              >
                <ListMusic size={13} className="text-accent-cyan" /> {loc.library.artistTracksBtn}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
);
