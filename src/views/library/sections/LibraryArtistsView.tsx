import React from 'react';
import { Flame, ListMusic, Mic2, Play, Plus } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';

export type LibraryArtistsViewProps = Pick<LibraryViewProps, 'filteredArtists' | 'tracks' | 'loc' | 'librarySearch' | 'setLibrarySearch' | 'handlePlayLibraryTrack' | 'refreshQueue' | 'showMessage' | 'setLibrarySubView'> & {
  t: LibraryViewProps['loc'];
};

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
      <div className="mb-4 flex items-center justify-between">
        <span className="text-ui text-fg-muted">
          {filteredArtists.length !== new Set(tracks.map((t) => t.artist || loc.stats.unknownArtist)).size
            ? fmt(loc.library.resultsArtists, String(filteredArtists.length))
            : fmt(loc.library.totalArtists, String(filteredArtists.length))}
        </span>
      </div>

      {filteredArtists.length === 0 ? (
        <div className="p-12 text-center text-fg-muted">
          <span>{fmt(loc.library.emptySearchArtists, librarySearch)}</span>
          {librarySearch && (
            <div className="mt-3">
              <button
                onClick={() => setLibrarySearch('')}
                className="rounded-lg border border-line bg-white/8 px-3.5 py-1.5 text-ui text-accent-cyan"
              >
                {loc.library.clearSearch}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-4">
          {filteredArtists.map((artist) => (
            <div
              key={artist.name}
              className="glass-card relative flex flex-col gap-3 rounded-2xl p-4 transition-[transform,border-color] duration-200"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-pink-500/40 shadow-lift shadow-pink-500/20"
                  style={{
                    background: artist.sampleCover
                      ? `url("${artist.sampleCover}") center/cover no-repeat`
                      : 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
                  }}
                >
                  {!artist.sampleCover && <Mic2 size={26} className="text-accent-pink" />}
                </div>

                <div className="min-w-0 flex-1">
                  <h4
                    className="m-0 truncate text-base font-bold text-fg"
                    title={artist.name}
                  >
                    {artist.name}
                  </h4>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <span className="rounded-md bg-white/6 px-2 py-0.5 text-xxs text-fg-secondary">
                      {fmt(loc.library.artistTracksCount, String(artist.tracks.length))}
                    </span>
                    {artist.albumIds.size > 0 && (
                      <span className="rounded-md bg-accent-purple/10 px-2 py-0.5 text-xxs text-accent-purple">
                        {fmt(loc.library.artistAlbumsCount, String(artist.albumIds.size))}
                      </span>
                    )}
                    {artist.totalPlays > 0 && (
                      <span
                        className="flex items-center gap-1 rounded-md bg-pink-500/15 px-2 py-0.5 text-xxs font-semibold text-accent-pink"
                      >
                        <Flame size={10} /> {artist.totalPlays}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto flex gap-2">
                <button
                  onClick={() => {
                    const sorted = [...artist.tracks].sort(
                      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
                    );
                    if (sorted.length > 0) {
                      handlePlayLibraryTrack(sorted[0], sorted);
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-3 py-2 text-ui font-bold text-on-accent shadow-md shadow-pink-500/30"
                >
                  <Play size={13} fill="#fff" /> {loc.player.play}
                </button>
                <button
                  onClick={async () => {
                    const sorted = [...artist.tracks].sort(
                      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
                    );
                    if (sorted.length > 0) {
                      await invoke('add_uris_to_queue', { uris: sorted.map((t) => t.path) });
                      await refreshQueue();
                      showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(sorted.length)));
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg border-0 bg-white/8 px-3 py-2 text-ui font-semibold text-accent-cyan"
                  title={loc.library.addToQueue}
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => {
                    setLibrarySearch(artist.name);
                    setLibrarySubView('tracks');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-3 py-2 text-ui font-semibold text-accent-cyan"
                  title={loc.library.filterArtistTracksTooltip}
                >
                  <ListMusic size={13} /> {loc.library.artistTracksBtn}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
);
