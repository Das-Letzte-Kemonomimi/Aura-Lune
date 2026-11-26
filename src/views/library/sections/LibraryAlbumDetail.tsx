import React from 'react';
import { ArrowLeft, Clock, Disc, FolderOpen, Heart, Music, Play, Plus, Shuffle, Sliders, Sparkles, Tag as TagIcon, Zap } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

export type LibraryAlbumDetailProps = Pick<LibraryViewProps, 'handleBackFromAlbumDetail' | 'loc' | 'tracks' | 'handleOpenCoverPicker' | 'formatTime' | 'handlePlayAlbum' | 'handleShuffleAll' | 'refreshQueue' | 'showMessage' | 'handleOpenContainingFolder' | 'activeTrackId' | 'currentPlayingTrack' | 'handlePlayLibraryTrack' | 'status' | 'handleToggleFavorite' | 'handleAddTrackToQueue' | 'setTagEditorTrack' | 'setCreateStemProjectTrack' | 'setIsCreateStemProjectOpen'> & {
  selectedAlbumDetail: NonNullable<LibraryViewProps['selectedAlbumDetail']>;
  t: LibraryViewProps['loc'];
};

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
}) => (
    <div className="flex flex-col gap-4.5">
      {/* Back navigation bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBackFromAlbumDetail}
          className="glass-card flex items-center gap-2 rounded-lg border border-line bg-white/6 px-4 py-2 text-ui font-semibold text-accent-cyan transition-all duration-200"
        >
          <ArrowLeft size={16} />
          {loc.library.backToAlbums}
        </button>

        <span className="text-ui text-fg-muted">
          {selectedAlbumDetail.title}
        </span>
      </div>

      {/* Selected album details (hero header + track list) */}
      {(() => {
        const albumTracks = tracks
          .filter((t) => t.album_id === selectedAlbumDetail.id)
          .sort((a, b) => (a.disc_no || 1) - (b.disc_no || 1) || (a.track_no || 0) - (b.track_no || 0));
        const totalDurationMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
        const uniqueFormats = Array.from(new Set(albumTracks.map((t) => t.format).filter(Boolean)));
        const hasHiRes = albumTracks.some((t) => (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200);

        return (
          <>
            <div
              className="glass-card relative flex items-center gap-6 overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl shadow-black/40"
              style={{
                background: 'linear-gradient(135deg, rgba(30, 20, 50, 0.75), rgba(15, 20, 35, 0.75))',
              }}
            >
              {/* Large album cover */}
              <div
                className="relative flex h-45 w-45 min-w-45 items-center justify-center overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/60"
                style={{
                  background: selectedAlbumDetail.cover_path
                    ? `url("${selectedAlbumDetail.cover_path}") center/cover no-repeat`
                    : 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(6,182,212,0.2))',
                }}
              >
                {!selectedAlbumDetail.cover_path && <Disc size={64} className="text-white/30" />}
                <button
                  onClick={() => handleOpenCoverPicker(selectedAlbumDetail)}
                  title={loc.covers.matchCover}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-white/20 bg-black/75 px-2 py-1 text-xxs text-accent-pink"
                >
                  <Sparkles size={12} /> {loc.covers.matchCover}
                </button>
              </div>

              {/* Album metadata */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-sm bg-accent-gradient px-2 py-0.5 text-xxs font-bold tracking-wider text-on-accent uppercase"
                  >
                    ALBUM
                  </span>
                  {hasHiRes && (
                    <span
                      className="rounded-sm border border-accent-cyan bg-accent-cyan/20 px-2 py-0.5 text-xxs font-bold text-accent-cyan"
                    >
                      HI-RES AUDIO
                    </span>
                  )}
                  {uniqueFormats.map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-sm bg-white/8 px-1.5 py-0.5 font-mono text-xxs text-fg-muted"
                    >
                      {fmt}
                    </span>
                  ))}
                  {selectedAlbumDetail.release_mbid && (
                    <span className="rounded-sm bg-accent-cyan/10 px-1.5 py-0.5 font-mono text-xxs text-accent-cyan">
                      MBID: {selectedAlbumDetail.release_mbid.slice(0, 8)}...
                    </span>
                  )}
                </div>

                <h2 className="m-0 text-3xl leading-tight font-extrabold text-fg text-shadow-soft">
                  {selectedAlbumDetail.title}
                </h2>

                <p className="m-0 text-base font-semibold text-accent-pink">
                  {selectedAlbumDetail.album_artist}
                  {selectedAlbumDetail.year ? ` • ${selectedAlbumDetail.year}` : ''}
                </p>

                <div className="mt-0.5 flex items-center gap-3.5 text-ui text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <Music size={14} className="text-accent-cyan" /> {albumTracks.length} {loc.library.tracks}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-fg-muted" /> {formatTime(totalDurationMs)}
                  </span>
                </div>

                {/* Album action buttons */}
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => {
                      if (albumTracks.length > 0) {
                        handlePlayAlbum(albumTracks, 0);
                      }
                    }}
                    disabled={albumTracks.length === 0}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border-0 bg-accent-gradient px-4.5 py-2.5 text-sm font-bold text-on-accent shadow-lift shadow-pink-500/40',
                      albumTracks.length === 0 ? 'cursor-default' : 'cursor-pointer',
                    )}
                  >
                    <Play size={16} fill="#fff" /> {loc.library.playFromStart}
                  </button>
                  <button
                    onClick={() => handleShuffleAll(albumTracks)}
                    disabled={albumTracks.length === 0}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border border-pink-500/45 bg-pink-500/20 px-4 py-2.5 text-sm font-bold text-fg',
                      albumTracks.length === 0 ? 'cursor-default' : 'cursor-pointer',
                    )}
                    title={loc.library.shuffleAlbumTooltip}
                  >
                    <Shuffle size={15} className="text-accent-pink" /> {loc.library.shuffleAlbum}
                  </button>
                  <button
                    onClick={async () => {
                      if (albumTracks.length > 0) {
                        await invoke('add_uris_to_queue', { uris: albumTracks.map((t) => t.path) });
                        await refreshQueue();
                        showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(albumTracks.length)));
                      }
                    }}
                    disabled={albumTracks.length === 0}
                    className={cn(
                      'glass-card flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-semibold text-accent-cyan',
                      albumTracks.length === 0 ? 'cursor-default' : 'cursor-pointer',
                    )}
                    title={loc.library.addToQueue}
                  >
                    <Plus size={16} /> {loc.library.addAlbumToQueue}
                  </button>
                  <button
                    onClick={() => handleOpenCoverPicker(selectedAlbumDetail)}
                    className="glass-card flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/5 px-3.5 py-2.5 text-ui text-fg"
                  >
                    <Sparkles size={15} className="text-accent-pink" /> {loc.covers.matchCover}
                  </button>
                  {albumTracks.length > 0 && (
                    <button
                      onClick={(e) => handleOpenContainingFolder(albumTracks[0].path, e)}
                      className="glass-card flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/5 px-3.5 py-2.5 text-ui text-fg-muted"
                      title={loc.library.openContainingFolder}
                    >
                      <FolderOpen size={15} className="text-accent-cyan" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Track table of the selected album */}
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
                  {albumTracks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-9 text-center text-fg-muted">
                        {loc.library.noAlbumTracks}
                      </td>
                    </tr>
                  ) : (
                    albumTracks.map((t, idx) => {
                      const isCurrent = (activeTrackId != null && activeTrackId === t.id) || (currentPlayingTrack != null && currentPlayingTrack.id === t.id);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => handlePlayLibraryTrack(t, albumTracks)}
                          className={cn(
                            'glass-card h-12 cursor-pointer border-b border-white/3 transition-colors duration-150',
                            isCurrent ? 'bg-accent-purple/20' : 'bg-transparent',
                          )}
                        >
                          <td className="p-3 font-mono whitespace-nowrap text-fg-muted">
                            {isCurrent ? (
                              status.state === 'Playing' ? (
                                <Zap size={14} className="text-accent-pink" />
                              ) : (
                                <Play size={13} className="text-accent-pink fill-accent-pink" />
                              )
                            ) : (
                              t.track_no ? (t.disc_no && t.disc_no > 1 ? `${t.disc_no}.${t.track_no}` : t.track_no) : idx + 1
                            )}
                          </td>
                          <td className={cn(
                            'max-w-85 p-3 font-semibold',
                            isCurrent ? 'text-accent-pink' : 'text-fg',
                          )}>
                            <div className="flex items-center gap-1.5 truncate">
                              {t.is_favorite && <Heart size={13} className="shrink-0 text-accent-pink fill-accent-pink" />}
                              <span className="truncate" title={t.title}>{t.title}</span>
                            </div>
                          </td>
                          <td className="max-w-55 truncate p-3 text-fg-secondary" title={t.artist}>
                            {t.artist}
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                'rounded-md px-2 py-0.5 font-mono text-xxs font-semibold',
                                (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'bg-accent-cyan/20' : 'bg-white/8',
                                (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'text-accent-cyan' : 'text-inherit',
                                (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'border border-accent-cyan/40' : 'border-0',
                              )}
                            >
                              {t.format}
                              {t.bit_depth && t.bit_depth >= 24 ? ` ${t.bit_depth}b` : ''}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-fg-muted">
                            {formatTime(t.duration_ms)}
                          </td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={(e) => handleToggleFavorite(t.id, e)}
                                title={t.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                                className={cn(
                                  'border-0 bg-transparent p-1',
                                  t.is_favorite ? 'text-accent-pink' : 'text-fg-muted',
                                )}
                              >
                                <Heart className={cn(t.is_favorite && 'fill-accent-pink')} size={15} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePlayLibraryTrack(t, albumTracks); }}
                                title={loc.player.play}
                                className="border-0 bg-transparent p-1 text-accent-pink"
                              >
                                <Play size={15} />
                              </button>
                              <button
                                onClick={(e) => handleAddTrackToQueue(t, e)}
                                title={loc.library.addToQueue}
                                className="border-0 bg-transparent p-1 text-accent-cyan"
                              >
                                <Plus size={15} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setTagEditorTrack(t); }}
                                title={loc.library.tagEditorTooltip}
                                className="border-0 bg-transparent p-1 text-accent-cyan"
                              >
                                <TagIcon size={15} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreateStemProjectTrack(t);
                                  setIsCreateStemProjectOpen(true);
                                }}
                                title={loc.library.createStemProjectTooltip}
                                className="border-0 bg-transparent p-1 text-accent-pink"
                              >
                                <Sliders size={15} />
                              </button>
                              <button
                                onClick={(e) => handleOpenContainingFolder(t.path, e)}
                                title={loc.library.openContainingFolder}
                                className="border-0 bg-transparent p-1 text-accent-cyan"
                              >
                                <FolderOpen size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </div>
);
