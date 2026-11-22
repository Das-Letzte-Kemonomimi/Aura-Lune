import React, { useCallback } from "react";
import {
  Clock,
  Disc,
  Music,
} from "lucide-react";
import { FacetsFilterPane } from '../../components/library/FacetsFilterPane';
import type { AlbumRecord, TrackRecord, PlaybackStatus, ReleaseCandidateDto } from '../../types/player';
import { type Language, getTranslations } from '../../i18n';
import { LibraryMusicBrainzMatchPanel } from './sections/LibraryMusicBrainzMatchPanel';
import { LibraryArtistsView } from './sections/LibraryArtistsView';
import { LibraryAlbumGrid } from './sections/LibraryAlbumGrid';
import { LibraryAlbumDetail } from './sections/LibraryAlbumDetail';
import { LibraryTracksView } from './sections/LibraryTracksView';
import { LibraryToolbar } from './sections/LibraryToolbar';
import { LibraryScanPanel } from './sections/LibraryScanPanel';
import { LibraryHeader } from './sections/LibraryHeader';

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
  filteredArtists: ArtistLibraryItem[];
  activeTrackId?: number | null;
  currentPlayingTrack?: TrackRecord | null;
  status: PlaybackStatus;
  librarySubView: "tracks" | "albums" | "artists";
  setLibrarySubView: (v: "tracks" | "albums" | "artists") => void;
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  librarySearchInputRef: React.RefObject<HTMLInputElement | null>;
  libraryFormatFilter: string;
  setLibraryFormatFilter: (v: any) => void;
  isFacetsFilterEnabled: boolean;
  setIsFacetsFilterEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
  facetSelectedArtist: string | null;
  setFacetSelectedArtist: (v: string | null) => void;
  facetSelectedAlbumId: number | null;
  setFacetSelectedAlbumId: (v: number | null) => void;
  facetSelectedFormat: string | null;
  setFacetSelectedFormat: (v: string | null) => void;
  smartPlaylistFilter: string | null;
  setSmartPlaylistFilter: (v: any) => void;
  hideDuplicates: boolean;
  setHideDuplicates: (v: boolean) => void;
  sortField: "default" | "title" | "artist" | "duration" | "format" | "date" | "plays";
  setSortField: React.Dispatch<React.SetStateAction<any>>;
  sortOrder: "asc" | "desc";
  setSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  handleSort: (field: any) => void;
  albumSortField: "tracks" | "title" | "artist" | "year" | "duration";
  setAlbumSortField: (v: any) => void;
  albumSortOrder: "asc" | "desc";
  setAlbumSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  albumGridSize: "compact" | "medium" | "large";
  setAlbumGridSize: (v: any) => void;
  albumViewMode: "grid" | "list";
  setAlbumViewMode: (v: any) => void;
  albumCoverFilter: "all" | "with-cover" | "missing-cover";
  setAlbumCoverFilter: (v: any) => void;
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
  scanResult: any;
  refreshQueue: () => Promise<void>;
  loadLibrary: () => Promise<void>;
  showMessage: (msg: string, isError?: boolean) => void;
  libraryTableRef: React.RefObject<HTMLTableElement | null>;
  trackStartIndex: number;
  trackEndIndex: number;
  trackTopSpacer: number;
  trackBottomSpacer: number;
  formatTime: (ms: number) => string;
}

export const LibraryView: React.FC<LibraryViewProps> = React.memo((props) => {
  const {
    layoutMaxWidth,
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
            <div className="glass-panel" style={{ padding: '28px', maxWidth: layoutMaxWidth, margin: '0 auto' }}>
              {/* Nagłówek biblioteki: tytuł, statystyka i przyciski akcji */}
              <LibraryHeader {...props} />

              {/* Rozwijany panel skanera katalogu (niewidoczny domyślnie, nie marnuje miejsca) */}
              {isScanFolderOpen && (
                <LibraryScanPanel {...props} />
              )}

              {/* Kompaktowe statystyki biblioteki */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
                <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Music size={22} color="var(--accent-pink)" />
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.library.tracks}</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{tracks.length}</p>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Disc size={22} color="var(--accent-purple)" />
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.library.albums}</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{albums.length}</p>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Clock size={22} color="var(--accent-cyan)" />
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.library.totalDuration}</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      {formatTime(tracks.reduce((acc, t) => acc + t.duration_ms, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3-Kolumnowy panel filtrów fasetowych (foobar2000 Facets) */}
              {isFacetsFilterEnabled && (
                <div style={{ marginBottom: '18px' }}>
                  <FacetsFilterPane
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
                </div>
              )}

              {/* Pasek narzędziowy: widoki Utwory/Albumy, Live Search i filtry formatów */}
              <LibraryToolbar {...props} />

              {/* Widok 1: Tabela utworów */}
              {librarySubView === 'tracks' && (
                <LibraryTracksView {...props} t={t} />
              )}

              {/* Widok 2: Siatka albumów i okładek (Etap 6) lub widok szczegółowy wybranego albumu */}
              {librarySubView === 'albums' && (
                selectedAlbumDetail ? (
                  <LibraryAlbumDetail {...props} selectedAlbumDetail={selectedAlbumDetail} t={t} />
                ) : (
                  <LibraryAlbumGrid {...props} formatAlbumDuration={formatAlbumDuration} />
                )
              )}

              {/* Widok 3: Wykonawcy / Artyści */}
              {librarySubView === 'artists' && (
                <LibraryArtistsView {...props} t={t} />
              )}

              {/* Modal dopasowywania wydań MusicBrainz (Etap 6) */}
              {selectedAlbumForMb && (
                <LibraryMusicBrainzMatchPanel {...props} />
              )}
            </div>
  );
});
