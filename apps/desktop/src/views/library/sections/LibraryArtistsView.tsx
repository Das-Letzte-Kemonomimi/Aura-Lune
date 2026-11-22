import React from 'react';
import { Flame, ListMusic, Mic2, Play, Plus } from 'lucide-react';
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filteredArtists.length !== new Set(tracks.map((t) => t.artist || loc.stats.unknownArtist)).size
            ? fmt(loc.library.resultsArtists, String(filteredArtists.length))
            : fmt(loc.library.totalArtists, String(filteredArtists.length))}
        </span>
      </div>

      {filteredArtists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <span>{fmt(loc.library.emptySearchArtists, librarySearch)}</span>
          {librarySearch && (
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => setLibrarySearch('')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {loc.library.clearSearch}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredArtists.map((artist) => (
            <div
              key={artist.name}
              className="glass-card"
              style={{
                padding: '16px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: artist.sampleCover
                      ? `url("${artist.sampleCover}") center/cover no-repeat`
                      : 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
                    border: '2px solid rgba(236, 72, 153, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(236, 72, 153, 0.2)',
                  }}
                >
                  {!artist.sampleCover && <Mic2 size={26} color="var(--accent-pink)" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#fff',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={artist.name}
                  >
                    {artist.name}
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {fmt(loc.library.artistTracksCount, String(artist.tracks.length))}
                    </span>
                    {artist.albumIds.size > 0 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: 'var(--accent-purple)',
                        }}
                      >
                        {fmt(loc.library.artistAlbumsCount, String(artist.albumIds.size))}
                      </span>
                    )}
                    {artist.totalPlays > 0 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: 'rgba(236, 72, 153, 0.15)',
                          color: 'var(--accent-pink)',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Flame size={10} /> {artist.totalPlays}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    const sorted = [...artist.tracks].sort(
                      (a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0)
                    );
                    if (sorted.length > 0) {
                      handlePlayLibraryTrack(sorted[0], sorted);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                  }}
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
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                  title={loc.library.addToQueue}
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => {
                    setLibrarySearch(artist.name);
                    setLibrarySubView('tracks');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
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
