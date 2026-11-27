import type { useLibraryManager } from '../../hooks/useLibraryManager';
import { useArtistsIndex } from '../../hooks/useArtistsIndex';
import React, { Suspense, useCallback, useMemo, useState } from "react";
import {
  Clock,
  Disc,
  Loader2,
  Music,
} from "../../components/ui/icons";
import { FacetsFilterPane } from '../../components/library/FacetsFilterPane';
import type { AlbumRecord, TrackRecord, PlaybackStatus, ReleaseCandidateDto } from '../../types/player';
import type { CoverSyncProgress } from '../../types/library';
import { type Language, getTranslations } from '../../i18n';
import { LibraryMusicBrainzMatchPanel } from './sections/LibraryMusicBrainzMatchPanel';
import { LibraryToolbar } from './sections/LibraryToolbar';
import { LibraryScanPanel } from './sections/LibraryScanPanel';
import { LibraryHeader } from './sections/LibraryHeader';
import { Card } from '../../components/ui';
import { LibraryContentSkeleton } from '../../components/layout/ViewLoadingSkeleton';

const LibraryTracksView = React.lazy(() => import('./sections/LibraryTracksView').then((m) => ({ default: m.LibraryTracksView })));
const LibraryAlbumGrid = React.lazy(() => import('./sections/LibraryAlbumGrid').then((m) => ({ default: m.LibraryAlbumGrid })));
const LibraryAlbumDetail = React.lazy(() => import('./sections/LibraryAlbumDetail').then((m) => ({ default: m.LibraryAlbumDetail })));
const LibraryArtistsView = React.lazy(() => import('./sections/LibraryArtistsView').then((m) => ({ default: m.LibraryArtistsView })));

/** The library setter and state types come straight from the `useLibraryManager` hook. */
type LibraryManager = ReturnType<typeof useLibraryManager>;

export interface ArtistLibraryItem {
  name: string;
  tracks: TrackRecord[];
  albumIds: Set<number>;
  totalDurationMs: number;
  totalPlays: number;
  sampleCover: string | null;
}

export interface LibraryViewProps {
  layoutMaxWidth: string;
  currentLang: Language;
  language: Language;
  loc: ReturnType<typeof getTranslations>;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  filteredTracks: TrackRecord[];
  sortedTracks: TrackRecord[];
  filteredAlbums: AlbumRecord[];
  sortedAlbums: AlbumRecord[];
  activeTrackId?: number | null;
  currentPlayingTrack?: TrackRecord | null;
  status: PlaybackStatus;
  librarySubView: "tracks" | "albums" | "artists";
  setLibrarySubView: (v: "tracks" | "albums" | "artists") => void;
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  librarySearchInputRef: React.RefObject<HTMLInputElement | null>;
  libraryFormatFilter: LibraryManager['libraryFormatFilter'];
  setLibraryFormatFilter: LibraryManager['setLibraryFormatFilter'];
  isFacetsFilterEnabled: boolean;
  setIsFacetsFilterEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
  facetSelectedArtist: string | null;
  setFacetSelectedArtist: (v: string | null) => void;
  facetSelectedAlbumId: number | null;
  setFacetSelectedAlbumId: (v: number | null) => void;
  facetSelectedFormat: string | null;
  setFacetSelectedFormat: (v: string | null) => void;
  smartPlaylistFilter: LibraryManager['smartPlaylistFilter'];
  setSmartPlaylistFilter: LibraryManager['setSmartPlaylistFilter'];
  hideDuplicates: boolean;
  setHideDuplicates: (v: boolean) => void;
  sortField: LibraryManager['sortField'];
  setSortField: LibraryManager['setSortField'];
  sortOrder: "asc" | "desc";
  setSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  handleSort: LibraryManager['handleSort'];
  albumSortField: LibraryManager['albumSortField'];
  setAlbumSortField: LibraryManager['setAlbumSortField'];
  albumSortOrder: "asc" | "desc";
  setAlbumSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  albumGridSize: LibraryManager['albumGridSize'];
  setAlbumGridSize: LibraryManager['setAlbumGridSize'];
  albumViewMode: LibraryManager['albumViewMode'];
  setAlbumViewMode: LibraryManager['setAlbumViewMode'];
  albumCoverFilter: "all" | "with-cover" | "missing-cover";
  setAlbumCoverFilter: LibraryManager['setAlbumCoverFilter'];
  albumsWithCoverCount: number;
  albumsWithoutCoverCount: number;
  selectedAlbumDetail: AlbumRecord | null;
  handleOpenAlbumDetail: (album: AlbumRecord) => void;
  handleBackFromAlbumDetail: () => void;
  selectedAlbumForMb: AlbumRecord | null;
  setSelectedAlbumForMb: (album: AlbumRecord | null) => void;
  handleOpenMbModal: (album: AlbumRecord) => void;
  mbSearchTitle: string;
  setMbSearchTitle: (v: string) => void;
  mbSearchArtist: string;
  setMbSearchArtist: (v: string) => void;
  mbCandidates: ReleaseCandidateDto[];
  isSearchingMb: boolean;
  isFetchingCover: boolean;
  handleSearchMusicBrainz: () => Promise<void>;
  handleSelectCandidateAndFetchCover: (cand: ReleaseCandidateDto) => Promise<void>;
  handleOpenCoverPicker: (album: AlbumRecord) => void;
  handlePlayLibraryTrack: (t: TrackRecord, contextQueue?: TrackRecord[]) => void | Promise<void>;
  handleAddTrackToQueue: (track: TrackRecord, e?: React.MouseEvent) => void;
  handleAddTrackNextToQueue: (track: TrackRecord, e?: React.MouseEvent) => void;
  handlePlayAlbum: (albumTracks: TrackRecord[], startIndex?: number) => void;
  handleAddAlbumToQueue: (albumTracks: TrackRecord[]) => void;
  handleToggleFavorite: (trackId: number, e?: React.MouseEvent) => void;
  handleSetTrackRating: (trackId: number, rating: number) => void;
  handleScanTrackReplayGain: (t: TrackRecord) => void;
  handleOpenContainingFolder: (path: string, e?: React.MouseEvent) => void;
  handleShuffleAll: (sourceTracks?: TrackRecord[]) => void;
  setTagEditorTrack: (t: TrackRecord | null) => void;
  setStatsModalTrack: (t: TrackRecord | null) => void;
  setTrackToAddToPlaylist: (t: TrackRecord | null) => void;
  setShowPlaylistModal: (v: boolean) => void;
  setCreateStemProjectTrack: (t: TrackRecord | null) => void;
  setIsCreateStemProjectOpen: (v: boolean) => void;
  setIsCueModalOpen: (v: boolean) => void;
  setIsDuplicateFinderOpen: (v: boolean) => void;
  setIsFileRenamerOpen: (v: boolean) => void;
  setIsUrlImportModalOpen: (v: boolean) => void;
  setShowDownloadHub: (v: boolean) => void;
  isScanFolderOpen: boolean;
  setIsScanFolderOpen: (v: boolean) => void;
  scanFolder: string;
  setScanFolder: (v: string) => void;
  handlePickFolder: () => Promise<void>;
  handlePickFiles: () => Promise<void>;
  handleScanLibrary: () => Promise<void>;
  isScanning: boolean;
  scanResult: LibraryManager['scanResult'];
  refreshQueue: () => Promise<void>;
  loadLibrary: () => Promise<void>;
  handleTriggerBackgroundCoverFetch: () => Promise<void>;
  coverSyncProgress: CoverSyncProgress;
  showMessage: (msg: string, isError?: boolean) => void;
  formatTime: (ms: number) => string;
}

/** One figure of the stats row under the library header. */
function LibraryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card padding="none" className="flex items-center gap-3 px-4 py-3">
      {icon}
      <div>
        <span className="text-xs text-fg-muted">{label}</span>
        <p className="text-base font-bold">{value}</p>
      </div>
    </Card>
  );
}

export const LibraryView: React.FC<LibraryViewProps> = React.memo((props) => {
  const {
    currentLang: _currentLang,
    language: _language = _currentLang,
    loc,
    tracks,
    albums,
    librarySubView,
    isFacetsFilterEnabled,
    facetSelectedArtist,
    setFacetSelectedArtist,
    facetSelectedAlbumId,
    setFacetSelectedAlbumId,
    facetSelectedFormat,
    setFacetSelectedFormat,
    selectedAlbumDetail,
    selectedAlbumForMb,
    isScanFolderOpen,
    formatTime,
  } = props;
  const t = loc;
  const [artistSortField, setArtistSortField] = useState<'name' | 'tracks' | 'albums' | 'plays'>('name');
  const [artistSortOrder, setArtistSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);

  const filteredArtists = useArtistsIndex({
    tracks,
    albums,
    search: props.librarySearch,
    unknownArtist: loc.stats.unknownArtist,
    enabled: librarySubView === 'artists',
  });

  const totalArtistCount = useMemo(
    () => new Set(tracks.map((track) => track.artist || loc.stats.unknownArtist)).size,
    [tracks, loc.stats.unknownArtist],
  );

  const totalDurationMs = useMemo(
    () => tracks.reduce((acc, track) => acc + track.duration_ms, 0),
    [tracks],
  );

  const formatAlbumDuration = useCallback((ms: number) => {
    if (!ms || ms <= 0) return "";
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Card variant="panel" padding="md" className="relative flex flex-col gap-4">
        {props.coverSyncProgress.running && (
          <div role="status" aria-live="polite" className="flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-pink/40 bg-accent-pink/12 px-3 py-1 text-xs font-semibold text-accent-pink">
              <Loader2 size={13} className="shrink-0 animate-spin" />
              <span>{loc.library.syncingMissingCovers}</span>
              {props.coverSyncProgress.total > 0 && (
                <span className="font-mono font-bold tabular-nums">
                  {props.coverSyncProgress.processed}/{props.coverSyncProgress.total}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Library header: title and consolidated action buttons */}
        <LibraryHeader {...props} />

        {/* Collapsible folder scanner panel (hidden by default, so it takes no space) */}
        {isScanFolderOpen && <LibraryScanPanel {...props} />}

        {/* Compact library stats */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <LibraryStat icon={<Music size={20} className="text-accent-pink" />} label={loc.library.tracks} value={tracks.length} />
          <LibraryStat icon={<Disc size={20} className="text-accent-purple" />} label={loc.library.albums} value={albums.length} />
          <LibraryStat
            icon={<Clock size={20} className="text-accent-cyan" />}
            label={loc.library.totalDuration}
            value={formatTime(totalDurationMs)}
          />
        </div>

        {/* 3-column faceted filter panel (foobar2000 Facets) */}
        {isFacetsFilterEnabled && (
          <FacetsFilterPane
            loc={loc}
            tracks={tracks}
            albums={albums}
            selectedFormat={facetSelectedFormat}
            selectedArtist={facetSelectedArtist}
            selectedAlbumId={facetSelectedAlbumId}
            onSelectFormat={setFacetSelectedFormat}
            onSelectArtist={setFacetSelectedArtist}
            onSelectAlbumId={setFacetSelectedAlbumId}
            onResetAll={() => {
              setFacetSelectedFormat(null);
              setFacetSelectedArtist(null);
              setFacetSelectedAlbumId(null);
            }}
          />
        )}
      </Card>

      {/* Toolbar: Tracks/Albums/Artists views, live search and context-aware filters */}
      <LibraryToolbar
        {...props}
        filteredArtists={filteredArtists}
        totalArtistCount={totalArtistCount}
        artistSortField={artistSortField}
        setArtistSortField={setArtistSortField}
        artistSortOrder={artistSortOrder}
        setArtistSortOrder={setArtistSortOrder}
        onBackFromArtistDetail={() => setSelectedArtistName(null)}
      />

      <Suspense
        key={`${librarySubView}-${selectedAlbumDetail ? 'detail' : 'list'}`}
        fallback={
          <LibraryContentSkeleton
            subView={librarySubView}
            albumViewMode={props.albumViewMode}
            albumGridSize={props.albumGridSize}
            hasSelectedAlbumDetail={Boolean(selectedAlbumDetail)}
            label={loc.common.loading}
          />
        }
      >
        {/* View 1: track table */}
        {librarySubView === 'tracks' && (
          <Card variant="panel" padding="md">
            <LibraryTracksView {...props} t={t} />
          </Card>
        )}

        {/* View 2: album and cover grid, or the detail view of the selected album */}
        {librarySubView === 'albums' && (
          selectedAlbumDetail ? (
            <LibraryAlbumDetail {...props} selectedAlbumDetail={selectedAlbumDetail} t={t} />
          ) : (
            <Card variant="panel" padding="md">
              <LibraryAlbumGrid {...props} formatAlbumDuration={formatAlbumDuration} />
            </Card>
          )
        )}

        {/* View 3: artists */}
        {librarySubView === 'artists' && (
          <LibraryArtistsView
            {...props}
            filteredArtists={filteredArtists}
            t={t}
            artistSortField={artistSortField}
            artistSortOrder={artistSortOrder}
            selectedArtistName={selectedArtistName}
            setSelectedArtistName={setSelectedArtistName}
          />
        )}
      </Suspense>

      {/* MusicBrainz release matching modal */}
      {selectedAlbumForMb && <LibraryMusicBrainzMatchPanel {...props} />}
    </div>
  );
});
