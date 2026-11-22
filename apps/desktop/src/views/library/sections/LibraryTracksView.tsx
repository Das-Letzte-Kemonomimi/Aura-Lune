import React from 'react';
import { Activity, BarChart3, Clock, FileCode, FilePlus, Flame, FolderOpen, FolderPlus, Heart, ListPlus, Moon, Music, Play, Plus, Sliders, Sparkles, Star, Tag as TagIcon, Zap } from 'lucide-react';
import { invoke } from '../../../api/ipc';
import type { LibraryViewProps } from '../LibraryView';
import { fmt } from '../../../utils/fmt';

export type LibraryTracksViewProps = Pick<LibraryViewProps, 'loc' | 'smartPlaylistFilter' | 'setSmartPlaylistFilter' | 'setIsCueModalOpen' | 'sortedTracks' | 'tracks' | 'sortField' | 'sortOrder' | 'librarySearch' | 'handlePlayLibraryTrack' | 'refreshQueue' | 'showMessage' | 'libraryTableRef' | 'handleSort' | 'handlePickFolder' | 'handlePickFiles' | 'setLibrarySearch' | 'trackTopSpacer' | 'trackStartIndex' | 'trackEndIndex' | 'activeTrackId' | 'currentPlayingTrack' | 'status' | 'formatTime' | 'setStatsModalTrack' | 'handleSetTrackRating' | 'handleToggleFavorite' | 'handleAddTrackToQueue' | 'setTagEditorTrack' | 'handleScanTrackReplayGain' | 'setCreateStemProjectTrack' | 'setIsCreateStemProjectOpen' | 'handleAddTrackNextToQueue' | 'setTrackToAddToPlaylist' | 'setShowPlaylistModal' | 'handleOpenContainingFolder' | 'trackBottomSpacer'> & {
  t: LibraryViewProps['loc'];
};

export const LibraryTracksView: React.FC<LibraryTracksViewProps> = ({
  activeTrackId,
  currentPlayingTrack,
  formatTime,
  handleAddTrackNextToQueue,
  handleAddTrackToQueue,
  handleOpenContainingFolder,
  handlePickFiles,
  handlePickFolder,
  handlePlayLibraryTrack,
  handleScanTrackReplayGain,
  handleSetTrackRating,
  handleSort,
  handleToggleFavorite,
  librarySearch,
  libraryTableRef,
  loc,
  refreshQueue,
  setCreateStemProjectTrack,
  setIsCreateStemProjectOpen,
  setIsCueModalOpen,
  setLibrarySearch,
  setShowPlaylistModal,
  setSmartPlaylistFilter,
  setStatsModalTrack,
  setTagEditorTrack,
  setTrackToAddToPlaylist,
  showMessage,
  smartPlaylistFilter,
  sortField,
  sortOrder,
  sortedTracks,
  status,
  t,
  trackBottomSpacer,
  trackEndIndex,
  trackStartIndex,
  trackTopSpacer,
  tracks,
}) => (
    <div>
      {/* Inteligentne Playlisty (Smart Playlists) */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>{loc.library.collection}</span>
        {[
          { id: 'all', label: loc.library.smartAll, icon: Music, color: 'var(--accent-purple)' },
          { id: 'favorites', label: loc.library.smartFavorites, icon: Heart, color: 'var(--accent-pink)' },
          { id: 'top_rated', label: loc.library.quickVibeTopRated, icon: Star, color: 'var(--accent-amber)' },
          { id: 'history', label: loc.library.smartHistory, icon: Clock, color: 'var(--accent-cyan)' },
          { id: 'top_played', label: loc.library.smartTopPlayed, icon: Flame, color: 'var(--accent-amber)' },
          { id: 'hires', label: loc.library.smartHiRes, icon: Sparkles, color: 'var(--accent-purple)' },
          { id: 'high_bpm', label: loc.library.quickVibeFastBpm, icon: Zap, color: 'var(--accent-pink)' },
          { id: 'forgotten', label: loc.library.quickVibeForgotten, icon: Moon, color: 'var(--accent-cyan)' },
        ].map((item) => {
          const isSelected = smartPlaylistFilter === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSmartPlaylistFilter(item.id as any)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.74rem',
                fontWeight: 600,
                background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                border: isSelected ? `1px solid ${item.color}` : '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? `0 0 10px ${item.color}40` : 'none',
              }}
            >
              <Icon size={13} color={isSelected ? item.color : 'var(--text-muted)'} fill={item.id === 'favorites' && isSelected ? item.color : 'none'} />
              {item.label}
            </button>
          );
        })}

        <button
          onClick={() => setIsCueModalOpen(true)}
          style={{
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.74rem',
            fontWeight: 600,
            background: 'rgba(168, 85, 247, 0.12)',
            color: 'var(--accent-purple, #c084fc)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
          title={loc.library.cueSheetOpenTooltip}
        >
          <FileCode size={13} />
          {loc.library.cueSheetBtn}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {sortedTracks.length !== tracks.length
            ? fmt(loc.library.resultsCount, String(sortedTracks.length), String(tracks.length))
            : fmt(loc.library.totalTracksCount, String(tracks.length))}
          {(sortField !== 'default' || sortOrder !== 'asc') && ` • ${fmt(loc.library.sortedBy, sortField === 'default' ? '#' : sortField, sortOrder === 'asc' ? loc.library.sortedAsc : loc.library.sortedDesc)}`}
          {smartPlaylistFilter === 'history' && ` • ${loc.library.sortedNewest}`}
          {smartPlaylistFilter === 'top_played' && ` • ${loc.library.sortedPlays}`}
        </span>
        {sortedTracks.length > 0 && (sortField !== 'default' || sortOrder !== 'asc' || librarySearch.trim() !== '' || smartPlaylistFilter !== 'all') && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                if (sortedTracks.length > 0) {
                  handlePlayLibraryTrack(sortedTracks[0], sortedTracks);
                }
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <Play size={14} /> {loc.library.playSorted}
            </button>
            <button
              onClick={async () => {
                if (sortedTracks.length > 0) {
                  await invoke('add_uris_to_queue', { uris: sortedTracks.map((t) => t.path) });
                  await refreshQueue();
                  showMessage(fmt(t.notifications.loadedTracksToQueueMsg, String(sortedTracks.length)));
                }
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--accent-cyan)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                border: 'none',
              }}
              title={loc.library.addToQueue}
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table ref={libraryTableRef} className="library-track-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(20, 16, 32, 0.95)', backdropFilter: 'blur(12px)' }}>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', height: '42px' }}>
              <th
                onClick={() => handleSort('default')}
                style={{ width: '46px', padding: '10px 6px', cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}
                title={loc.library.sortDefaultTooltip}
              >
                # {sortField === 'default' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('title')}
                style={{ width: '28%', padding: '10px 10px', cursor: 'pointer', userSelect: 'none' }}
                title={loc.library.sortTitleTooltip}
              >
                {loc.library.sortTitle} {sortField === 'title' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('artist')}
                style={{ width: '20%', padding: '10px 10px', cursor: 'pointer', userSelect: 'none' }}
                title={loc.library.sortArtistTooltip}
              >
                {loc.library.sortArtist} {sortField === 'artist' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('format')}
                style={{ width: '110px', padding: '10px 8px', cursor: 'pointer', userSelect: 'none' }}
                title={loc.library.sortFormatTooltip}
              >
                {loc.library.sortFormat} {sortField === 'format' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ width: '115px', padding: '10px 8px' }}>{loc.library.quality}</th>
              <th
                onClick={() => handleSort('duration')}
                style={{ width: '75px', padding: '10px 8px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                title={loc.library.sortDurationTooltip}
              >
                {loc.queue.duration} {sortField === 'duration' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => handleSort('plays')}
                style={{ width: '75px', padding: '10px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                title={loc.library.sortPlaysTooltip}
              >
                {loc.library.playsCol} {sortField === 'plays' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ width: '95px', padding: '10px 6px', textAlign: 'center' }}>
                {loc.library.rating}
              </th>
              <th style={{ width: '135px', padding: '10px 6px', textAlign: 'center' }}>{loc.library.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedTracks.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {tracks.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '24px 12px',
                      }}
                    >
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: 'rgba(168, 85, 247, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--accent-purple)',
                        }}
                      >
                        <FolderPlus size={28} color="var(--accent-purple)" />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
                          {loc.library.empty}
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {loc.library.emptyHint}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                          onClick={handlePickFolder}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <FolderPlus size={14} /> {loc.library.addFolder}...
                        </button>
                        <button
                          onClick={handlePickFiles}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid var(--border-accent)',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <FilePlus size={14} color="var(--accent-cyan)" /> {loc.library.addFiles}...
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <span>{fmt(loc.library.emptySearchTracks, librarySearch)}</span>
                      <button
                        onClick={() => setLibrarySearch('')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {loc.library.clearSearch}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              <>
                {trackTopSpacer > 0 && (
                  <tr style={{ height: `${trackTopSpacer}px`, pointerEvents: 'none' }}>
                    <td colSpan={9} style={{ height: `${trackTopSpacer}px`, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {sortedTracks.slice(trackStartIndex, trackEndIndex).map((t, localIdx) => {
                  const idx = trackStartIndex + localIdx;
                  const isCurrent = (activeTrackId != null && activeTrackId === t.id) || (currentPlayingTrack != null && currentPlayingTrack.id === t.id);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => handlePlayLibraryTrack(t)}
                      className="library-track-row glass-card"
                      style={{
                        cursor: 'pointer',
                        background: isCurrent ? 'rgba(168, 85, 247, 0.22)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        height: '48px',
                        maxHeight: '48px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <td
                        className="library-track-cell"
                        style={{ padding: '0 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                        title={t.track_no ? `#${idx + 1} (Track ${t.track_no})` : `#${idx + 1}`}
                      >
                        {isCurrent ? (
                          status.state === 'Playing' ? (
                            <Zap size={14} color="var(--accent-pink)" />
                          ) : (
                            <Play size={13} color="var(--accent-pink)" fill="var(--accent-pink)" />
                          )
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="library-track-cell" style={{ padding: '0 10px', fontWeight: 600, color: isCurrent ? 'var(--accent-pink)' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.is_favorite && <Heart size={13} fill="var(--accent-pink)" color="var(--accent-pink)" style={{ flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</span>
                        </div>
                      </td>
                      <td className="library-track-cell" style={{ padding: '0 10px', color: 'var(--text-secondary)' }} title={t.artist}>
                        {t.artist}
                      </td>
                      <td className="library-track-cell" style={{ padding: '0 8px' }}>
                        <span
                          style={{
                            background:
                              (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200
                                ? 'rgba(6, 182, 212, 0.2)'
                                : 'rgba(255,255,255,0.08)',
                            color:
                              (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200
                                ? 'var(--accent-cyan)'
                                : 'inherit',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            border:
                              (t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200
                                ? '1px solid rgba(6, 182, 212, 0.35)'
                                : 'none',
                          }}
                        >
                          {t.format}
                          {(t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200 ? ' Hi-Res' : ''}
                        </span>
                        {t.replaygain_track_gain !== null && t.replaygain_track_gain !== undefined && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.66rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              background: 'rgba(168, 85, 247, 0.2)',
                              color: 'var(--accent-purple, #c084fc)',
                              border: '1px solid rgba(168, 85, 247, 0.4)',
                            }}
                            title={`ReplayGain: ${t.replaygain_track_gain >= 0 ? '+' : ''}${t.replaygain_track_gain.toFixed(1)} dB (Peak: ${t.replaygain_track_peak ? t.replaygain_track_peak.toFixed(3) : '1.0'})`}
                          >
                            RG {t.replaygain_track_gain >= 0 ? `+${t.replaygain_track_gain.toFixed(1)}` : t.replaygain_track_gain.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="library-track-cell" style={{ padding: '0 8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                        {Math.round(t.sample_rate / 1000)} kHz {t.bit_depth ? `/ ${t.bit_depth}-bit` : ''}
                      </td>
                      <td className="library-track-cell" style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatTime(t.duration_ms)}
                      </td>
                      <td
                        className="library-track-cell"
                        style={{ padding: '0 6px', textAlign: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatsModalTrack(t);
                        }}
                        title={loc.player.trackStats}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: t.play_count ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            color: t.play_count ? 'var(--accent-amber)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            border: t.play_count ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Flame size={12} color={t.play_count ? 'var(--accent-amber)' : 'var(--text-muted)'} />
                          {t.play_count || 0}
                        </span>
                      </td>
                      <td
                        className="library-track-cell"
                        style={{ padding: '0 4px', textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const active = (t.rating || 0) >= star;
                            return (
                              <button
                                key={star}
                                onClick={() => handleSetTrackRating(t.id, t.rating === star ? 0 : star)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '1px',
                                  cursor: 'pointer',
                                  color: active ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'transform 0.1s ease',
                                }}
                                title={fmt(loc.library.ratingTooltip, String(star))}
                              >
                                <Star size={12} fill={active ? '#f59e0b' : 'none'} />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="library-track-cell" style={{ padding: '0 6px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={(e) => handleToggleFavorite(t.id, e)}
                            title={t.is_favorite ? loc.library.removeFromFavorites : loc.library.addToFavorites}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: t.is_favorite ? 'var(--accent-pink)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <Heart size={15} fill={t.is_favorite ? 'var(--accent-pink)' : 'none'} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePlayLibraryTrack(t); }}
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
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan, #06b6d4)', cursor: 'pointer', padding: '4px' }}
                          >
                            <TagIcon size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleScanTrackReplayGain(t); }}
                            title={loc.settings.scanReplayGainTrack}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-purple, #c084fc)', cursor: 'pointer', padding: '4px' }}
                          >
                            <Activity size={15} />
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
                            onClick={(e) => handleAddTrackNextToQueue(t, e)}
                            title={loc.library.playNext}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', padding: '4px' }}
                          >
                            <ListPlus size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTrackToAddToPlaylist(t); setShowPlaylistModal(true); }}
                            title={loc.library.addToPlaylist}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: '4px' }}
                          >
                            <FolderPlus size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setStatsModalTrack(t); }}
                            title={loc.player.trackStats}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-amber)', cursor: 'pointer', padding: '4px' }}
                          >
                            <BarChart3 size={15} />
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
                })}
                {trackBottomSpacer > 0 && (
                  <tr style={{ height: `${trackBottomSpacer}px`, pointerEvents: 'none' }}>
                    <td colSpan={9} style={{ height: `${trackBottomSpacer}px`, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
);
