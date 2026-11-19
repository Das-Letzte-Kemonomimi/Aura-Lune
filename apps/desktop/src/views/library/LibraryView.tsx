import React, { useCallback } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  CheckCircle,
  Clock,
  Copy,
  Disc,
  Download,
  FileCode,
  FileEdit,
  FilePlus,
  Flame,
  FolderOpen,
  FolderPlus,
  Globe,
  Heart,
  Layers,
  LayoutGrid,
  List,
  ListMusic,
  ListPlus,
  Mic2,
  Moon,
  Music,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  Sliders,
  Sparkles,
  Star,
  Tag as TagIcon,
  X,
  Zap,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { FacetsFilterPane } from '../../components/library/FacetsFilterPane';
import type { AlbumRecord, TrackRecord, PlaybackStatus, ReleaseCandidateDto } from '../../types/player';
import { type Language, getTranslations } from '../../i18n';

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

export const LibraryView: React.FC<LibraryViewProps> = React.memo(({
  layoutMaxWidth,
  currentLang: _currentLang,
  language: _language = _currentLang,
  loc,
  tracks,
  albums,
  filteredTracks,
  sortedTracks,
  filteredAlbums,
  sortedAlbums,
  filteredArtists,
  activeTrackId,
  currentPlayingTrack,
  status,
  librarySubView,
  setLibrarySubView,
  librarySearch,
  setLibrarySearch,
  librarySearchInputRef,
  libraryFormatFilter,
  setLibraryFormatFilter,
  isFacetsFilterEnabled,
  setIsFacetsFilterEnabled,
  facetSelectedArtist,
  setFacetSelectedArtist,
  facetSelectedAlbumId,
  setFacetSelectedAlbumId,
  facetSelectedFormat,
  setFacetSelectedFormat,
  smartPlaylistFilter,
  setSmartPlaylistFilter,
  hideDuplicates,
  setHideDuplicates,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  handleSort,
  albumSortField,
  setAlbumSortField,
  albumSortOrder,
  setAlbumSortOrder,
  albumGridSize,
  setAlbumGridSize,
  albumViewMode,
  setAlbumViewMode,
  albumCoverFilter,
  setAlbumCoverFilter,
  albumsWithCoverCount,
  albumsWithoutCoverCount,
  selectedAlbumDetail,
  handleOpenAlbumDetail,
  handleBackFromAlbumDetail,
  selectedAlbumForMb,
  setSelectedAlbumForMb,
  handleOpenMbModal,
  mbSearchTitle,
  setMbSearchTitle,
  mbSearchArtist,
  setMbSearchArtist,
  mbCandidates,
  isSearchingMb,
  isFetchingCover,
  handleSearchMusicBrainz,
  handleSelectCandidateAndFetchCover,
  handleOpenCoverPicker,
  handlePlayLibraryTrack,
  handleAddTrackToQueue,
  handleAddTrackNextToQueue,
  handlePlayAlbum,
  handleAddAlbumToQueue,
  handleToggleFavorite,
  handleSetTrackRating,
  handleScanTrackReplayGain,
  handleOpenContainingFolder,
  handleShuffleAll,
  setTagEditorTrack,
  setStatsModalTrack,
  setTrackToAddToPlaylist,
  setShowPlaylistModal,
  setCreateStemProjectTrack,
  setIsCreateStemProjectOpen,
  setIsCueModalOpen,
  setIsDuplicateFinderOpen,
  setIsFileRenamerOpen,
  setIsUrlImportModalOpen,
  setShowDownloadHub,
  isScanFolderOpen,
  setIsScanFolderOpen,
  scanFolder,
  setScanFolder,
  handlePickFolder,
  handlePickFiles,
  handleScanLibrary,
  isScanning,
  scanResult,
  refreshQueue,
  loadLibrary,
  showMessage,
  libraryTableRef,
  trackStartIndex,
  trackEndIndex,
  trackTopSpacer,
  trackBottomSpacer,
  formatTime,
}) => {
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontWeight: 700 }}>
                    <Music size={22} color="var(--accent-purple)" /> {loc.library.title}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: 'var(--accent-purple)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                      }}
                    >
                      {filteredTracks.length !== tracks.length ? `${filteredTracks.length} / ${tracks.length}` : `${tracks.length} ${loc.library.tracks}`}
                    </span>
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {loc.library.subtitle}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleShuffleAll()}
                    style={{
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#fff',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: '0 2px 12px rgba(236, 72, 153, 0.4)',
                      transition: 'all 0.15s ease',
                    }}
                    title={loc.library.shuffleAllTooltip}
                  >
                    <Shuffle size={15} /> {loc.library.shuffleAll}
                  </button>

                  <button
                    onClick={() => setShowDownloadHub(true)}
                    className="glass-card"
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#fff',
                      background: 'linear-gradient(135deg, rgba(235, 116, 34, 0.35), rgba(255, 77, 148, 0.25))',
                      border: '1px solid rgba(235, 116, 34, 0.6)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: '0 2px 10px rgba(235, 116, 34, 0.25)',
                    }}
                    title={loc.settings.downloadHubBtn}
                  >
                    <Download size={15} color="#eb7422" /> {loc.settings.downloadHubBtn}
                  </button>

                  <button
                    onClick={() => setIsUrlImportModalOpen(true)}
                    className="glass-card"
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#fff',
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3))',
                      border: '1px solid #c084fc',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
                    }}
                    title={loc.library.importUrlTooltip}
                  >
                    <Globe size={15} color="#d8b4fe" /> {loc.library.importUrlBtn}
                  </button>

                  <button
                    onClick={handlePickFolder}
                    className="glass-card"
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#fff',
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(244, 63, 94, 0.25))',
                      border: '1px solid var(--accent-purple)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
                    }}
                    title={loc.library.addFolder}
                  >
                    <FolderPlus size={15} color="var(--accent-pink)" /> {loc.library.addFolder}
                  </button>
                  <button
                    onClick={handlePickFiles}
                    className="glass-card"
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#fff',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '8px',
                    }}
                    title={loc.library.addFiles}
                  >
                    <FilePlus size={15} color="var(--accent-cyan)" /> {loc.library.addFiles}
                  </button>
                  <button
                    onClick={() => setIsScanFolderOpen(!isScanFolderOpen)}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: isScanFolderOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      border: isScanFolderOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      background: isScanFolderOpen ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      borderRadius: '8px',
                    }}
                    title={loc.library.manualPath}
                  >
                    <FolderOpen size={14} /> {loc.library.manualPath}
                  </button>
                  <button
                    onClick={loadLibrary}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255, 255, 255, 0.04)',
                    }}
                    title={loc.library.refresh}
                  >
                    <RefreshCw size={14} /> {loc.library.refresh}
                  </button>

                  <button
                    onClick={() => setIsFacetsFilterEnabled((prev) => !prev)}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: isFacetsFilterEnabled ? '#fff' : 'var(--text-secondary)',
                      border: isFacetsFilterEnabled ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                      background: isFacetsFilterEnabled ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      fontSize: '0.8rem',
                      fontWeight: isFacetsFilterEnabled ? 700 : 500,
                      cursor: 'pointer',
                      borderRadius: '8px',
                    }}
                    title={loc.library.facetsToggle}
                  >
                    <Layers size={14} color="var(--accent-pink)" /> {loc.library.facetsToggle}
                  </button>

                  <button
                    onClick={() => setIsDuplicateFinderOpen(true)}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      borderRadius: '8px',
                    }}
                    title={loc.library.duplicateFinder}
                  >
                    <Copy size={14} color="var(--accent-cyan)" /> {loc.library.duplicateFinder}
                  </button>

                  <button
                    onClick={() => setIsFileRenamerOpen(true)}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      borderRadius: '8px',
                    }}
                    title={loc.library.fileRenamer}
                  >
                    <FileEdit size={14} color="#fbbf24" /> {loc.library.fileRenamer}
                  </button>
                </div>
              </div>

              {/* Rozwijany panel skanera katalogu (niewidoczny domyślnie, nie marnuje miejsca) */}
              {isScanFolderOpen && (
                <div
                  className="glass-card"
                  style={{
                    padding: '16px 18px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-accent)',
                    marginBottom: '20px',
                    background: 'rgba(0,0,0,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {loc.library.scanPathLabel}
                    </label>
                    <button
                      onClick={() => setIsScanFolderOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={scanFolder}
                      onChange={(e) => setScanFolder(e.target.value)}
                      placeholder={loc.library.scanPathPlaceholder}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                      }}
                    />
                    <button
                      onClick={handlePickFolder}
                      className="glass-card"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--accent-cyan)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                      title={loc.library.browseDolphinTooltip}
                    >
                      <FolderOpen size={15} /> {loc.library.browseDolphin}
                    </button>
                    <button
                      onClick={handleScanLibrary}
                      disabled={isScanning}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        background: isScanning ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                        color: '#fff',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: isScanning ? 'default' : 'pointer',
                        border: 'none',
                      }}
                    >
                      <RefreshCw size={15} className={isScanning ? 'spin' : ''} /> {isScanning ? loc.library.scanning : loc.library.runScan}
                    </button>
                  </div>
                  {scanResult && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-green)' }}>
                      ✓ {loc.library.scanSummary
                        .replace('{0}', String(scanResult.total_files_found))
                        .replace('{1}', String(scanResult.new_or_updated_tracks))
                        .replace('{2}', String(scanResult.skipped_unchanged))}
                    </p>
                  )}
                </div>
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
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: '18px',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Przełącznik widoku: Utwory vs Albumy */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setLibrarySubView('tracks')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: librarySubView === 'tracks' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Music size={14} /> {loc.library.tracks} ({filteredTracks.length})
                  </button>
                  <button
                    onClick={() => {
                      setLibrarySubView('albums');
                      handleBackFromAlbumDetail();
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: librarySubView === 'albums' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Disc size={14} /> {loc.library.albums} ({filteredAlbums.length})
                  </button>
                  <button
                    onClick={() => setLibrarySubView('artists')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: librarySubView === 'artists' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Mic2 size={14} /> {loc.library.artists || 'Wykonawcy'} ({filteredArtists.length})
                  </button>
                </div>

                {/* Pole wyszukiwania Live Search */}
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    ref={librarySearchInputRef}
                    type="text"
                    placeholder={loc.library.searchPlaceholder}
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (librarySubView === 'tracks' && sortedTracks.length > 0) {
                          handlePlayLibraryTrack(sortedTracks[0]);
                          showMessage(`Odtwarzanie ${sortedTracks[0].title}`);
                        } else if (librarySubView === 'albums' && sortedAlbums.length > 0) {
                          const albumTracks = tracks.filter((t) => t.album_id === sortedAlbums[0].id);
                          if (albumTracks.length > 0) {
                            handlePlayLibraryTrack(albumTracks[0], albumTracks);
                            showMessage(`Odtwarzanie albumu ${sortedAlbums[0].title}`);
                          }
                        }
                      } else if (e.key === 'Escape') {
                        setLibrarySearch('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 30px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontSize: '0.8rem',
                    }}
                  />
                  {librarySearch && (
                    <button
                      onClick={() => setLibrarySearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filtry formatów audio */}
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {(['all', 'flac', 'mp3', 'opus', 'wav', 'lossless'] as const).map((fmt) => {
                    const label =
                      fmt === 'all'
                        ? loc.library.all
                        : fmt === 'lossless'
                          ? loc.library.lossless
                          : fmt.toUpperCase();
                    const isSelected = libraryFormatFilter === fmt;
                    return (
                      <button
                        key={fmt}
                        onClick={() => setLibraryFormatFilter(fmt)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: isSelected ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          border: isSelected ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Przełącznik ukrywania duplikatów */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !hideDuplicates;
                    setHideDuplicates(next);
                    try {
                      localStorage.setItem('auralune_hide_duplicates', String(next));
                    } catch { }
                    showMessage(
                      next ? loc.library.hideDuplicatesFilterOn : loc.library.hideDuplicatesFilterOff
                    );
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: hideDuplicates ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: hideDuplicates ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                    color: hideDuplicates ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={loc.library.hideDuplicatesTooltip}
                >
                  <Copy size={12} />
                  {hideDuplicates ? loc.library.duplicatesHidden : loc.library.duplicates}
                </button>

                {/* Kontrola sortowania */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <ArrowUpDown size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.library.sortBy}</span>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as any)}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      padding: '5px 28px 5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(20, 24, 44, 0.95)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    <option value="default" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortDefault}</option>
                    <option value="title" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortTitle}</option>
                    <option value="artist" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortArtist}</option>
                    <option value="duration" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortDuration}</option>
                    <option value="format" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortFormat}</option>
                    <option value="date" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortDate}</option>
                    <option value="plays" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortPlays}</option>
                  </select>
                  <button
                    onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title={sortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
                  >
                    {sortOrder === 'asc' ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {/* Widok 1: Tabela utworów */}
              {librarySubView === 'tracks' && (
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
                        ? loc.library.resultsCount.replace('{0}', String(sortedTracks.length)).replace('{1}', String(tracks.length))
                        : loc.library.totalTracksCount.replace('{0}', String(tracks.length))}
                      {(sortField !== 'default' || sortOrder !== 'asc') && ` • ${loc.library.sortedBy.replace('{0}', sortField === 'default' ? '#' : sortField).replace('{1}', sortOrder === 'asc' ? loc.library.sortedAsc : loc.library.sortedDesc)}`}
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
                              showMessage(t.notifications.loadedTracksToQueueMsg.replace('{0}', String(sortedTracks.length)));
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
                                  <span>{loc.library.emptySearchTracks.replace("{0}", librarySearch)}</span>
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
                                  <td className="library-track-cell" style={{ padding: '0 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                    {isCurrent ? (
                                      status.state === 'Playing' ? (
                                        <Zap size={14} color="var(--accent-pink)" />
                                      ) : (
                                        <Play size={13} color="var(--accent-pink)" fill="var(--accent-pink)" />
                                      )
                                    ) : (
                                      t.track_no || idx + 1
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
                                            title={loc.library.ratingTooltip.replace('{0}', String(star))}
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
              )}

              {/* Widok 2: Siatka albumów i okładek (Etap 6) lub widok szczegółowy wybranego albumu */}
              {librarySubView === 'albums' && (
                selectedAlbumDetail ? (
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
                ) : (
                  <div>
                    <div>
                      {/* Pasek narzędziowy widoku albumów: Filtry, Sortowanie, Rozmiar kafelków, Przełącznik Kafelki/Lista */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                          flexWrap: 'wrap',
                          gap: '12px',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.025)',
                          borderRadius: '12px',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {/* Lewa strona: Licznik albumów + szybki filtr okładek */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 700 }}>
                            {sortedAlbums.length !== albums.length
                              ? loc.library.resultsAlbums.replace('{0}', String(sortedAlbums.length)).replace('{1}', String(albums.length))
                              : loc.library.totalAlbums.replace('{0}', String(albums.length))}
                          </span>

                          {/* Filtr okładek */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              padding: '3px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {[
                              { id: 'all', label: loc.library.albumFilterAll.replace('{0}', String(albums.length)) },
                              { id: 'with-cover', label: loc.library.albumFilterWithCover.replace('{0}', String(albumsWithCoverCount)) },
                              { id: 'missing-cover', label: loc.library.albumFilterMissingCover.replace('{0}', String(albumsWithoutCoverCount)) },
                            ].map((f) => {
                              const isActive = albumCoverFilter === f.id;
                              return (
                                <button
                                  key={f.id}
                                  onClick={() => setAlbumCoverFilter(f.id as any)}
                                  style={{
                                    padding: '3px 9px',
                                    borderRadius: '6px',
                                    fontSize: '0.70rem',
                                    fontWeight: isActive ? 700 : 500,
                                    background: isActive ? 'rgba(236, 72, 153, 0.22)' : 'transparent',
                                    border: isActive ? '1px solid var(--accent-pink)' : '1px solid transparent',
                                    color: isActive ? 'var(--accent-pink)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {f.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Prawa strona: Sortowanie + Rozmiar kafelków + Wybór Kafelki / Lista */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Sortowanie */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ArrowUpDown size={13} color="var(--text-muted)" />
                            <select
                              value={albumSortField}
                              onChange={(e) => setAlbumSortField(e.target.value as any)}
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                padding: '5px 28px 5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(20, 24, 44, 0.95)',
                                border: '1px solid var(--border-subtle)',
                                color: '#ffffff',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 8px center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              }}
                            >
                              <option value="title" style={{ background: '#121424', color: '#fff' }}>{loc.library.albumSortTitle}</option>
                              <option value="artist" style={{ background: '#121424', color: '#fff' }}>{loc.library.albumSortArtist}</option>
                              <option value="year" style={{ background: '#121424', color: '#fff' }}>{loc.library.albumSortYear}</option>
                              <option value="tracks" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortTrackCount}</option>
                              <option value="duration" style={{ background: '#121424', color: '#fff' }}>{loc.library.sortTotalDuration}</option>
                            </select>
                            <button
                              onClick={() => setAlbumSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                color: 'var(--accent-cyan)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title={albumSortOrder === 'asc' ? loc.library.sortAscTooltip : loc.library.sortDescTooltip}
                            >
                              {albumSortOrder === 'asc' ? '▲' : '▼'}
                            </button>
                          </div>

                          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

                          {/* Rozmiar kafelków (widoczny w trybie kafelków) */}
                          {albumViewMode === 'grid' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '2px 4px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '2px', paddingLeft: '4px' }}>
                                {loc.library.albumGridSize}
                              </span>
                              {[
                                { id: 'compact', label: 'S (160px)', title: loc.library.albumTileSmall },
                                { id: 'medium', label: 'M (210px)', title: loc.library.albumTileMedium },
                                { id: 'large', label: 'L (270px)', title: loc.library.albumTileLarge },
                              ].map((s) => {
                                const isCur = albumGridSize === s.id;
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      setAlbumGridSize(s.id as any);
                                      localStorage.setItem('auralune_album_grid_size', s.id);
                                    }}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '5px',
                                      fontSize: '0.70rem',
                                      fontWeight: isCur ? 700 : 500,
                                      background: isCur ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                                      border: isCur ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                                      color: isCur ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                    }}
                                    title={s.title}
                                  >
                                    {s.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Przełącznik widoku: Kafelki vs Lista */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <button
                              onClick={() => {
                                setAlbumViewMode('grid');
                                localStorage.setItem('auralune_album_view_mode', 'grid');
                              }}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.72rem',
                                fontWeight: albumViewMode === 'grid' ? 700 : 500,
                                background: albumViewMode === 'grid' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                                border: albumViewMode === 'grid' ? '1px solid var(--accent-pink)' : '1px solid transparent',
                                color: albumViewMode === 'grid' ? 'var(--accent-pink)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                              title={loc.library.viewGridView}
                            >
                              <LayoutGrid size={13} />
                              <span>{loc.library.viewGrid}</span>
                            </button>

                            <button
                              onClick={() => {
                                setAlbumViewMode('list');
                                localStorage.setItem('auralune_album_view_mode', 'list');
                              }}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.72rem',
                                fontWeight: albumViewMode === 'list' ? 700 : 500,
                                background: albumViewMode === 'list' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                                border: albumViewMode === 'list' ? '1px solid var(--accent-pink)' : '1px solid transparent',
                                color: albumViewMode === 'list' ? 'var(--accent-pink)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                              title={loc.library.viewListView}
                            >
                              <List size={13} />
                              <span>{loc.library.viewList}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Zawartość: Pusta lista lub Kafelki lub Lista */}
                      {sortedAlbums.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                          {albums.length === 0 ? (
                            <span>{loc.library.emptyAlbums}</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              <span>{loc.library.emptySearchAlbums.replace('{0}', librarySearch)}</span>
                              <button
                                onClick={() => {
                                  setLibrarySearch('');
                                  setAlbumCoverFilter('all');
                                }}
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
                        </div>
                      ) : albumViewMode === 'list' ? (
                        /* WIDOK LISTY ALBUMÓW */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sortedAlbums.map((album) => {
                            const albumTracks = tracks.filter((t) => t.album_id === album.id);
                            const totalDurMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
                            const durText = formatAlbumDuration(totalDurMs);

                            return (
                              <div
                                key={album.id}
                                className="glass-card"
                                onClick={() => handleOpenAlbumDetail(album)}
                                style={{
                                  padding: '10px 16px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '16px',
                                  cursor: 'pointer',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  transition: 'all 0.18s ease',
                                }}
                              >
                                {/* Miniaturka okładki */}
                                <div
                                  style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: '8px',
                                    background: album.cover_path
                                      ? `url("${album.cover_path}") center/cover no-repeat`
                                      : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-subtle)',
                                    flexShrink: 0,
                                    position: 'relative',
                                  }}
                                  title={loc.covers.matchCoverTitle}
                                >
                                  {!album.cover_path && <Disc size={24} color="rgba(255,255,255,0.25)" />}
                                </div>

                                {/* Informacje o albumie */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {album.title}
                                    </span>
                                    {album.year && (
                                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                        ({album.year})
                                      </span>
                                    )}
                                    {album.release_mbid && (
                                      <span
                                        style={{
                                          fontSize: '0.64rem',
                                          fontFamily: 'var(--font-mono)',
                                          color: 'var(--accent-cyan)',
                                          background: 'rgba(6,182,212,0.12)',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                        }}
                                      >
                                        MBID
                                      </span>
                                    )}
                                  </div>
                                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {album.album_artist}
                                  </p>
                                </div>

                                {/* Liczba utworów i czas */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      color: 'var(--accent-cyan)',
                                      background: 'rgba(6,182,212,0.12)',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {albumTracks.length} {loc.library.tracks}
                                  </span>
                                  {durText && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={11} /> {durText}
                                    </span>
                                  )}
                                </div>

                                {/* Przyciski akcji */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handlePlayAlbum(albumTracks)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.08)',
                                      color: 'var(--accent-pink)',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.player.play}
                                  >
                                    <Play size={12} /> {loc.player.play}
                                  </button>
                                  <button
                                    onClick={() => handleAddAlbumToQueue(albumTracks)}
                                    style={{
                                      padding: '6px 9px',
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.05)',
                                      color: 'var(--accent-cyan)',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.library.addToQueue}
                                  >
                                    <Plus size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenCoverPicker(album)}
                                    style={{
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                                      color: '#fff',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.covers.matchCoverTitle}
                                  >
                                    <Sparkles size={11} /> {loc.covers.matchCover}
                                  </button>
                                  <button
                                    onClick={() => handleOpenMbModal(album)}
                                    style={{
                                      padding: '6px 9px',
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.06)',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.covers.matchCoverTitle}
                                  >
                                    <Search size={11} /> MBID
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* WIDOK KAFELKÓW (Zabezpieczony przed rozciąganiem - auto-fill z limitem max-width) */
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              albumGridSize === 'compact'
                                ? 'repeat(auto-fill, minmax(155px, 190px))'
                                : albumGridSize === 'large'
                                  ? 'repeat(auto-fill, minmax(240px, 290px))'
                                  : 'repeat(auto-fill, minmax(190px, 235px))',
                            gap: albumGridSize === 'compact' ? '12px' : albumGridSize === 'large' ? '18px' : '14px',
                          }}
                        >
                          {sortedAlbums.map((album) => {
                            const albumTracks = tracks.filter((t) => t.album_id === album.id);
                            const totalDurMs = albumTracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
                            const durText = formatAlbumDuration(totalDurMs);

                            return (
                              <div
                                key={album.id}
                                className="glass-card"
                                onClick={() => handleOpenAlbumDetail(album)}
                                style={{
                                  padding: albumGridSize === 'compact' ? '10px' : '14px',
                                  borderRadius: '14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: albumGridSize === 'compact' ? '8px' : '10px',
                                  cursor: 'pointer',
                                  transition: 'transform 0.18s ease, border-color 0.18s ease',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  maxWidth: albumGridSize === 'compact' ? '200px' : albumGridSize === 'large' ? '300px' : '245px',
                                }}
                              >
                                {/* Podgląd okładki (z przyciskiem dopasowania w rogu) */}
                                <div
                                  style={{
                                    width: '100%',
                                    aspectRatio: '1/1',
                                    borderRadius: '10px',
                                    background: album.cover_path
                                      ? `url("${album.cover_path}") center/cover no-repeat`
                                      : 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(6,182,212,0.15))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-subtle)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                  }}
                                  title={loc.library.albumViewTracksTooltip}
                                >
                                  {!album.cover_path && <Disc size={albumGridSize === 'compact' ? 36 : 46} color="rgba(255,255,255,0.25)" />}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenCoverPicker(album);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      bottom: '5px',
                                      right: '5px',
                                      background: 'rgba(0,0,0,0.7)',
                                      backdropFilter: 'blur(4px)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.64rem',
                                      color: 'var(--accent-pink)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                    title={loc.covers.matchCoverTitle}
                                  >
                                    <Sparkles size={10} /> {loc.covers.matchCover}
                                  </div>
                                </div>

                                {/* Tytuł i wykonawca */}
                                <div style={{ flex: 1 }}>
                                  <h4
                                    style={{
                                      fontSize: albumGridSize === 'compact' ? '0.84rem' : '0.90rem',
                                      fontWeight: 700,
                                      color: 'var(--text-primary)',
                                      margin: 0,
                                      lineHeight: 1.3,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                    title={album.title}
                                  >
                                    {album.title}
                                  </h4>
                                  <p
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--text-secondary)',
                                      margin: '3px 0 0 0',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {album.album_artist} {album.year ? `(${album.year})` : ''}
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        fontSize: '0.66rem',
                                        color: 'var(--accent-cyan)',
                                        background: 'rgba(6,182,212,0.12)',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {albumTracks.length} {loc.library.tracks}
                                    </span>
                                    {durText && (
                                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                        {durText}
                                      </span>
                                    )}
                                    {album.release_mbid && (
                                      <span
                                        style={{
                                          fontSize: '0.62rem',
                                          fontFamily: 'var(--font-mono)',
                                          color: 'var(--text-muted)',
                                          background: 'rgba(255,255,255,0.06)',
                                          padding: '1px 4px',
                                          borderRadius: '4px',
                                        }}
                                      >
                                        MBID
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Przyciski akcji na kafelku */}
                                <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handlePlayAlbum(albumTracks)}
                                    style={{
                                      padding: albumGridSize === 'compact' ? '6px 8px' : '7px 9px',
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.08)',
                                      color: 'var(--accent-pink)',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.player.play}
                                  >
                                    <Play size={11} /> {loc.player.play}
                                  </button>
                                  <button
                                    onClick={() => handleAddAlbumToQueue(albumTracks)}
                                    style={{
                                      padding: albumGridSize === 'compact' ? '6px 7px' : '7px 8px',
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.05)',
                                      color: 'var(--accent-cyan)',
                                      fontSize: '0.72rem',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.library.addToQueue}
                                  >
                                    <Plus size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenCoverPicker(album)}
                                    style={{
                                      flex: 1,
                                      padding: albumGridSize === 'compact' ? '6px 6px' : '7px 8px',
                                      borderRadius: '6px',
                                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                                      color: '#fff',
                                      fontSize: '0.70rem',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '3px',
                                      border: 'none',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                    }}
                                    title={loc.covers.matchCoverTitle}
                                  >
                                    <Sparkles size={11} />
                                    {albumGridSize !== 'compact' && <span>{loc.covers.matchCover}</span>}
                                  </button>
                                  <button
                                    onClick={() => handleOpenMbModal(album)}
                                    style={{
                                      padding: albumGridSize === 'compact' ? '6px 7px' : '7px 8px',
                                      borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.07)',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.70rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '2px',
                                      cursor: 'pointer',
                                    }}
                                    title={loc.covers.matchCoverTitle}
                                  >
                                    <Search size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Widok 3: Wykonawcy / Artyści */}
              {librarySubView === 'artists' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {filteredArtists.length !== new Set(tracks.map((t) => t.artist || loc.stats.unknownArtist)).size
                        ? loc.library.resultsArtists.replace('{0}', String(filteredArtists.length))
                        : loc.library.totalArtists.replace('{0}', String(filteredArtists.length))}
                    </span>
                  </div>

                  {filteredArtists.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <span>{loc.library.emptySearchArtists.replace("{0}", librarySearch)}</span>
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
                                  {loc.library.artistTracksCount.replace('{0}', String(artist.tracks.length))}
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
                                    {loc.library.artistAlbumsCount.replace('{0}', String(artist.albumIds.size))}
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
                                  showMessage(t.notifications.loadedTracksToQueueMsg.replace('{0}', String(sorted.length)));
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
              )}

              {/* Modal dopasowywania wydań MusicBrainz (Etap 6) */}
              {selectedAlbumForMb && (
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
              )}
            </div>
  );
});
