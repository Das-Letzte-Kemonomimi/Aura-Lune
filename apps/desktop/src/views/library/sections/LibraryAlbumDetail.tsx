import React from 'react';
import { ArrowLeft, Clock, Disc, FolderOpen, Heart, Music, Play, Plus, Shuffle, Sliders, Sparkles, Tag as TagIcon, Zap } from 'lucide-react';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Pasek nawigacyjny powrotu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={handleBackFromAlbumDetail}
          className="glass-card"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-cyan)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <ArrowLeft size={16} />
          {loc.library.backToAlbums}
        </button>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {selectedAlbumDetail.title}
        </span>
      </div>

      {/* Szczegóły wybranego albumu (Hero Header + Lista utworów) */}
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
              className="glass-card"
              style={{
                padding: '24px',
                borderRadius: '20px',
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                background: 'linear-gradient(135deg, rgba(30, 20, 50, 0.75), rgba(15, 20, 35, 0.75))',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Duża okładka albumu */}
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  minWidth: '180px',
                  borderRadius: '16px',
                  background: selectedAlbumDetail.cover_path
                    ? `url("${selectedAlbumDetail.cover_path}") center/cover no-repeat`
                    : 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(6,182,212,0.2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {!selectedAlbumDetail.cover_path && <Disc size={64} color="rgba(255,255,255,0.3)" />}
                <button
                  onClick={() => handleOpenCoverPicker(selectedAlbumDetail)}
                  title={loc.covers.matchCover}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.75)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: 'var(--accent-pink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={12} /> {loc.covers.matchCover}
                </button>
              </div>

              {/* Metadane albumu */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    ALBUM
                  </span>
                  {hasHiRes && (
                    <span
                      style={{
                        background: 'rgba(6, 182, 212, 0.2)',
                        border: '1px solid var(--accent-cyan)',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      HI-RES AUDIO
                    </span>
                  )}
                  {uniqueFormats.map((fmt) => (
                    <span
                      key={fmt}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {fmt}
                    </span>
                  ))}
                  {selectedAlbumDetail.release_mbid && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-cyan)',
                        background: 'rgba(6,182,212,0.12)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      MBID: {selectedAlbumDetail.release_mbid.slice(0, 8)}...
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1.2,
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  }}
                >
                  {selectedAlbumDetail.title}
                </h2>

                <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--accent-pink)' }}>
                  {selectedAlbumDetail.album_artist}
                  {selectedAlbumDetail.year ? ` • ${selectedAlbumDetail.year}` : ''}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Music size={14} color="var(--accent-cyan)" /> {albumTracks.length} {loc.library.tracks}
                  </span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={14} color="var(--text-muted)" /> {formatTime(totalDurationMs)}
                  </span>
                </div>

                {/* Przyciski akcji na albumie */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      if (albumTracks.length > 0) {
                        handlePlayAlbum(albumTracks, 0);
                      }
                    }}
                    disabled={albumTracks.length === 0}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: albumTracks.length === 0 ? 'default' : 'pointer',
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
                    }}
                  >
                    <Play size={16} fill="#fff" /> {loc.library.playFromStart}
                  </button>
                  <button
                    onClick={() => handleShuffleAll(albumTracks)}
                    disabled={albumTracks.length === 0}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '10px',
                      background: 'rgba(236, 72, 153, 0.2)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: albumTracks.length === 0 ? 'default' : 'pointer',
                      border: '1px solid rgba(236, 72, 153, 0.45)',
                    }}
                    title={loc.library.shuffleAlbumTooltip}
                  >
                    <Shuffle size={15} color="var(--accent-pink)" /> {loc.library.shuffleAlbum}
                  </button>
                  <button
                    onClick={async () => {
                      if (albumTracks.length > 0) {
                        await invoke('add_uris_to_queue', { uris: albumTracks.map((t) => t.path) });
                        await refreshQueue();
                        showMessage(t.notifications.loadedTracksToQueueMsg.replace('{0}', String(albumTracks.length)));
                      }
                    }}
                    disabled={albumTracks.length === 0}
                    className="glass-card"
                    style={{
                      padding: '9px 16px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.08)',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: albumTracks.length === 0 ? 'default' : 'pointer',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    title={loc.library.addToQueue}
                  >
                    <Plus size={16} /> {loc.library.addAlbumToQueue}
                  </button>
                  <button
                    onClick={() => handleOpenCoverPicker(selectedAlbumDetail)}
                    className="glass-card"
                    style={{
                      padding: '9px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Sparkles size={15} color="var(--accent-pink)" /> {loc.covers.matchCover}
                  </button>
                  {albumTracks.length > 0 && (
                    <button
                      onClick={(e) => handleOpenContainingFolder(albumTracks[0].path, e)}
                      className="glass-card"
                      style={{
                        padding: '9px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      title={loc.library.openContainingFolder}
                    >
                      <FolderOpen size={15} color="var(--accent-cyan)" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabela utworów wybranego albumu */}
            <div style={{ overflowX: 'auto', marginTop: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px', width: '45px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>{loc.library.sortTitle}</th>
                    <th style={{ padding: '10px 12px' }}>{loc.library.sortArtist}</th>
                    <th style={{ padding: '10px 12px' }}>{loc.library.sortFormat}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{loc.queue.duration}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '160px' }}>{loc.library.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {albumTracks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                          className="glass-card"
                          style={{
                            cursor: 'pointer',
                            background: isCurrent ? 'rgba(168, 85, 247, 0.22)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            height: '48px',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {isCurrent ? (
                              status.state === 'Playing' ? (
                                <Zap size={14} color="var(--accent-pink)" />
                              ) : (
                                <Play size={13} color="var(--accent-pink)" fill="var(--accent-pink)" />
                              )
                            ) : (
                              t.track_no ? (t.disc_no && t.disc_no > 1 ? `${t.disc_no}.${t.track_no}` : t.track_no) : idx + 1
                            )}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600, color: isCurrent ? 'var(--accent-pink)' : '#fff', maxWidth: '340px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.is_favorite && <Heart size={13} fill="var(--accent-pink)" color="var(--accent-pink)" style={{ flexShrink: 0 }} />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.artist}>
                            {t.artist}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                background: (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.08)',
                                color: (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? 'var(--accent-cyan)' : 'inherit',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                border: (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? '1px solid rgba(6, 182, 212, 0.4)' : 'none',
                              }}
                            >
                              {t.format}
                              {t.bit_depth && t.bit_depth >= 24 ? ` ${t.bit_depth}b` : ''}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {formatTime(t.duration_ms)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                onClick={(e) => handleToggleFavorite(t.id, e)}
                                title={t.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                                style={{ background: 'transparent', border: 'none', color: t.is_favorite ? 'var(--accent-pink)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                              >
                                <Heart size={15} fill={t.is_favorite ? 'var(--accent-pink)' : 'none'} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePlayLibraryTrack(t, albumTracks); }}
                                title={loc.player.play}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink)', cursor: 'pointer', padding: '4px' }}
                              >
                                <Play size={15} />
                              </button>
                              <button
                                onClick={(e) => handleAddTrackToQueue(t, e)}
                                title={loc.library.addToQueue}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                              >
                                <Plus size={15} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setTagEditorTrack(t); }}
                                title={loc.library.tagEditorTooltip}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
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
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-pink, #f43f5e)', cursor: 'pointer', padding: '4px' }}
                              >
                                <Sliders size={15} />
                              </button>
                              <button
                                onClick={(e) => handleOpenContainingFolder(t.path, e)}
                                title={loc.library.openContainingFolder}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
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
