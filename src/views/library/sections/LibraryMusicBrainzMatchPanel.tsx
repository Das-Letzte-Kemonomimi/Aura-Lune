import React from 'react';
import { CheckCircle, Globe, Search, X } from 'lucide-react';
import type { LibraryViewProps } from '../LibraryView';
import { cn } from '../../../utils/cn';

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
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm motion-safe:animate-fade-in"
    >
      <div
        className="glass-panel flex max-h-[85vh] w-full max-w-170 flex-col rounded-3xl border border-line-accent p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe size={22} className="text-accent-cyan" />
            <h3 className="text-lg font-bold">
              Dopasowanie wydania w MusicBrainz
            </h3>
          </div>
          <button
            onClick={() => setSelectedAlbumForMb(null)}
            className="bg-transparent text-fg-muted"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-ui text-fg-secondary">
          {loc.covers.mbSubtitle}
        </p>

        <div className="mb-4 grid grid-cols-[1fr_1fr_auto] gap-2.5">
          <input
            type="text"
            value={mbSearchTitle}
            onChange={(e) => setMbSearchTitle(e.target.value)}
            placeholder={loc.covers.searchAlbumPlaceholder}
            className="rounded-xl border border-line bg-black/30 px-3.5 py-2.5 text-sm text-fg"
          />
          <input
            type="text"
            value={mbSearchArtist}
            onChange={(e) => setMbSearchArtist(e.target.value)}
            placeholder={loc.covers.searchArtistPlaceholder}
            className="rounded-xl border border-line bg-black/30 px-3.5 py-2.5 text-sm text-fg"
          />
          <button
            onClick={handleSearchMusicBrainz}
            disabled={isSearchingMb}
            className="flex items-center gap-1.5 rounded-xl bg-accent-gradient px-4.5 py-2.5 text-sm font-semibold text-on-accent"
          >
            <Search size={15} />
            {isSearchingMb ? loc.covers.searching : loc.covers.searchBtn}
          </button>
        </div>

        {/* Lista kandydatów */}
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
          {mbCandidates.length === 0 && !isSearchingMb && (
            <p className="p-6 text-center text-sm text-fg-muted">
              {loc.covers.mbSearchHint}
            </p>
          )}

          {mbCandidates.map((cand) => (
            <div
              key={cand.mbid}
              className="glass-card flex items-center justify-between gap-3 p-3.5"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <strong className="text-sm text-fg">
                    {cand.title}
                  </strong>
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 text-xxs font-bold',
                      cand.score >= 90 ? 'bg-accent-green/20' : 'bg-accent-amber/20',
                      cand.score >= 90 ? 'text-accent-green' : 'text-accent-amber',
                    )}
                  >
                    {cand.score}% {loc.covers.mbMatchScore}
                  </span>
                </div>
                <p className="mt-0.5 text-ui text-fg-secondary">
                  {loc.player.artist}: {cand.artist} {cand.date ? `| ${cand.date}` : ''} {cand.country ? `(${cand.country})` : ''} {cand.track_count ? `| ${loc.library.tracks}: ${cand.track_count}` : ''}
                </p>
                <p className="font-mono text-xxs text-fg-muted">
                  MBID: {cand.mbid}
                </p>
              </div>

              <button
                onClick={() => handleSelectCandidateAndFetchCover(cand)}
                disabled={isFetchingCover}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-accent-cyan px-3.5 py-2 text-ui font-bold text-black',
                  isFetchingCover ? 'cursor-not-allowed' : 'cursor-pointer',
                )}
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
