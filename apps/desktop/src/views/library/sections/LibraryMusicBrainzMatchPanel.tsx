import React from 'react';
import { CheckCircle, Globe, Search, X } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';

export type LibraryMusicBrainzMatchPanelProps = Pick<LibraryViewProps, 'setSelectedAlbumForMb' | 'loc' | 'mbSearchTitle' | 'setMbSearchTitle' | 'mbSearchArtist' | 'setMbSearchArtist' | 'handleSearchMusicBrainz' | 'isSearchingMb' | 'mbCandidates' | 'handleSelectCandidateAndFetchCover' | 'isFetchingCover'>;

export const LibraryMusicBrainzMatchPanel: React.FC<LibraryMusicBrainzMatchPanelProps> = ({
  handleSearchMusicBrainz,
  handleSelectCandidateAndFetchCover,
  isFetchingCover,
  isSearchingMb,
  loc,
  mbCandidates,
  mbSearchArtist,
  mbSearchTitle,
  setMbSearchArtist,
  setMbSearchTitle,
  setSelectedAlbumForMb,
}) => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--border-accent)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Dopasowanie wydania w MusicBrainz
            </h3>
          </div>
          <button
            onClick={() => setSelectedAlbumForMb(null)}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {loc.covers.mbSubtitle}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '16px' }}>
          <input
            type="text"
            value={mbSearchTitle}
            onChange={(e) => setMbSearchTitle(e.target.value)}
            placeholder={loc.covers.searchAlbumPlaceholder}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          />
          <input
            type="text"
            value={mbSearchArtist}
            onChange={(e) => setMbSearchArtist(e.target.value)}
            placeholder={loc.covers.searchArtistPlaceholder}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          />
          <button
            onClick={handleSearchMusicBrainz}
            disabled={isSearchingMb}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Search size={15} />
            {isSearchingMb ? loc.covers.searching : loc.covers.searchBtn}
          </button>
        </div>

        {/* Lista kandydatów */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mbCandidates.length === 0 && !isSearchingMb && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px' }}>
              {loc.covers.mbSearchHint}
            </p>
          )}

          {mbCandidates.map((cand) => (
            <div
              key={cand.mbid}
              className="glass-card"
              style={{
                padding: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {cand.title}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: cand.score >= 90 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: cand.score >= 90 ? 'var(--accent-green)' : 'var(--accent-amber)',
                    }}
                  >
                    {cand.score}% {loc.covers.mbMatchScore}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {loc.player.artist}: {cand.artist} {cand.date ? `| ${cand.date}` : ''} {cand.country ? `(${cand.country})` : ''} {cand.track_count ? `| ${loc.library.tracks}: ${cand.track_count}` : ''}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  MBID: {cand.mbid}
                </p>
              </div>

              <button
                onClick={() => handleSelectCandidateAndFetchCover(cand)}
                disabled={isFetchingCover}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  cursor: isFetchingCover ? 'not-allowed' : 'pointer',
                }}
              >
                <CheckCircle size={14} />
                {isFetchingCover ? loc.covers.downloading : loc.covers.applyCover}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
);
