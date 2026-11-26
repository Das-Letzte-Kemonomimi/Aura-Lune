import React from 'react';
import { CheckCircle, Globe, Search } from '../../../components/ui/icons';
import type { LibraryViewProps } from '../LibraryView';
import { Badge, Button, Card, EmptyState, ModalBody, ModalHeader, ModalShell, TextField } from '../../../components/ui';

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
}) => {
  const close = () => setSelectedAlbumForMb(null);
  return (
    <ModalShell onClose={close} size="lg" labelledBy="mb-match-title">
      <ModalHeader
        titleId="mb-match-title"
        title="MusicBrainz release match"
        subtitle={loc.covers.mbSubtitle}
        icon={<Globe size={20} />}
        tone="cyan"
        onClose={close}
        closeLabel={loc.common.close}
      />

      <div className="grid shrink-0 grid-cols-[1fr_1fr_auto] gap-2.5 border-b border-line px-6 py-4">
        <TextField
          aria-label={loc.covers.searchAlbumPlaceholder}
          value={mbSearchTitle}
          onChange={(e) => setMbSearchTitle(e.target.value)}
          placeholder={loc.covers.searchAlbumPlaceholder}
        />
        <TextField
          aria-label={loc.covers.searchArtistPlaceholder}
          value={mbSearchArtist}
          onChange={(e) => setMbSearchArtist(e.target.value)}
          placeholder={loc.covers.searchArtistPlaceholder}
        />
        <Button variant="primary" onClick={handleSearchMusicBrainz} disabled={isSearchingMb}>
          <Search size={15} />
          {isSearchingMb ? loc.covers.searching : loc.covers.searchBtn}
        </Button>
      </div>

      {/* Candidate list */}
      <ModalBody className="flex flex-col gap-2.5">
        {mbCandidates.length === 0 && !isSearchingMb && <EmptyState title={loc.covers.mbSearchHint} />}

        {mbCandidates.map((cand) => (
          <Card key={cand.mbid} padding="none" className="flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <strong className="text-sm text-fg">{cand.title}</strong>
                <Badge tone={cand.score >= 90 ? 'green' : 'amber'}>
                  {cand.score}% {loc.covers.mbMatchScore}
                </Badge>
              </div>
              <p className="mt-0.5 text-ui text-fg-secondary">
                {loc.player.artist}: {cand.artist} {cand.date ? `| ${cand.date}` : ''} {cand.country ? `(${cand.country})` : ''} {cand.track_count ? `| ${loc.library.tracks}: ${cand.track_count}` : ''}
              </p>
              <p className="font-mono text-xxs text-fg-muted">MBID: {cand.mbid}</p>
            </div>

            <Button
              variant="tinted"
              tone="cyan"
              onClick={() => handleSelectCandidateAndFetchCover(cand)}
              disabled={isFetchingCover}
            >
              <CheckCircle size={14} />
              {isFetchingCover ? loc.covers.downloading : loc.covers.applyCover}
            </Button>
          </Card>
        ))}
      </ModalBody>
    </ModalShell>
  );
};
