import { useState, useMemo, useRef, useCallback, useLayoutEffect, useDeferredValue } from 'react';
import { invoke } from '../api/ipc';
import type { TrackRecord, AlbumRecord, ScanSummaryDto, SampleTrackDto } from '../types/library';
import type { PlaybackStatus } from '../types/playback';
import type { Translations } from '../i18n';
import { normalizeStr } from '../utils/textNormalize';
import { fmt } from '../utils/fmt';
import { trackComparator, type TrackSortField } from '../views/library/sections/trackModel';
import { parseBoolean, usePersistedState } from './usePersistedState';

export type LibrarySortField = 'default' | TrackSortField;
export type AlbumSortField = 'title' | 'artist' | 'year' | 'tracks' | 'duration';
export type AlbumViewMode = 'grid' | 'list';
export type AlbumGridSize = 'compact' | 'medium' | 'large';
export type SmartPlaylistFilter = 'all' | 'favorites' | 'history' | 'top_played' | 'hires' | 'forgotten' | 'high_bpm' | 'top_rated';

const parseAlbumViewMode = (raw: string): AlbumViewMode | undefined =>
  raw === 'grid' || raw === 'list' ? raw : undefined;
const parseAlbumGridSize = (raw: string): AlbumGridSize | undefined =>
  raw === 'compact' || raw === 'medium' || raw === 'large' ? raw : undefined;

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export interface UseLibraryManagerOptions {
  mainContentRef: React.RefObject<HTMLElement | null>;
  status?: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  setFilePath: (path: string) => void;
  setActiveTrackId: (id: number | null) => void;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useLibraryManager({
  mainContentRef,
  setStatus,
  setFilePath,
  setActiveTrackId,
  showMessage,
  loc,
}: UseLibraryManagerOptions) {
  // 1. Tracks & Albums state
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [librarySubView, setLibrarySubView] = useState<'tracks' | 'albums' | 'artists'>('tracks');

  // 2. Search & Filters state
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFormatFilter, setLibraryFormatFilter] = useState<'all' | 'flac' | 'mp3' | 'opus' | 'wav' | 'lossless'>('all');
  const [isFacetsFilterEnabled, setIsFacetsFilterEnabled] = useState<boolean>(false);
  const [facetSelectedArtist, setFacetSelectedArtist] = useState<string | null>(null);
  const [facetSelectedAlbumId, setFacetSelectedAlbumId] = useState<number | null>(null);
  const [facetSelectedFormat, setFacetSelectedFormat] = useState<string | null>(null);
  const [smartPlaylistFilter, setSmartPlaylistFilter] = useState<SmartPlaylistFilter>('all');
  const [hideDuplicates, setHideDuplicates] = usePersistedState('auralune_hide_duplicates', false, { parse: parseBoolean });

  // 3. Sorting state
  const [sortField, setSortField] = useState<LibrarySortField>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [albumSortField, setAlbumSortField] = useState<AlbumSortField>('title');
  const [albumSortOrder, setAlbumSortOrder] = useState<'asc' | 'desc'>('asc');
  const [albumViewMode, setAlbumViewMode] = usePersistedState<AlbumViewMode>('auralune_album_view_mode', 'grid', { parse: parseAlbumViewMode });
  const [albumGridSize, setAlbumGridSize] = usePersistedState<AlbumGridSize>('auralune_album_grid_size', 'medium', { parse: parseAlbumGridSize });
  const [albumCoverFilter, setAlbumCoverFilter] = useState<'all' | 'with-cover' | 'missing-cover'>('all');

  const handleSort = useCallback((field: LibrarySortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'plays' || field === 'added' ? 'desc' : 'asc');
    }
  }, [sortField]);

  // 4. Scanning state
  const [isScanFolderOpen, setIsScanFolderOpen] = useState(false);
  const [scanFolder, setScanFolder] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanSummaryDto | null>(null);

  // 5. Album detail drilldown
  const [selectedAlbumDetail, setSelectedAlbumDetail] = useState<AlbumRecord | null>(null);
  const albumListScrollPosRef = useRef<number>(0);
  const isRestoringAlbumScrollRef = useRef<boolean>(false);

  const handleOpenAlbumDetail = useCallback((album: AlbumRecord) => {
    if (mainContentRef.current) {
      albumListScrollPosRef.current = mainContentRef.current.scrollTop;
    }
    setSelectedAlbumDetail(album);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [mainContentRef]);

  const handleBackFromAlbumDetail = useCallback(() => {
    isRestoringAlbumScrollRef.current = true;
    setSelectedAlbumDetail(null);
  }, []);

  useLayoutEffect(() => {
    if (!selectedAlbumDetail && isRestoringAlbumScrollRef.current) {
      isRestoringAlbumScrollRef.current = false;
      const targetScroll = albumListScrollPosRef.current;
      if (mainContentRef.current) {
        mainContentRef.current.scrollTop = targetScroll;
      }
      const frameId = requestAnimationFrame(() => {
        if (mainContentRef.current && Math.abs(mainContentRef.current.scrollTop - targetScroll) > 1) {
          mainContentRef.current.scrollTop = targetScroll;
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [mainContentRef, selectedAlbumDetail]);

  // 6. Filtered & Sorted Memos
  const deferredSearch = useDeferredValue(librarySearch);

  const filteredTracks = useMemo(() => {
    const rawQ = deferredSearch.trim();
    const q = normalizeStr(rawQ);
    const seenTrackKeys = new Set<string>();

    return tracks.filter((t) => {
      if (hideDuplicates) {
        const normTitle = (t.title || '').trim().toLowerCase();
        const normArtist = (t.artist || '').trim().toLowerCase();
        const durSec = Math.round((t.duration_ms || 0) / 1000);
        const dupKey = t.path ? `path:${t.path}` : `meta:${normTitle}:${normArtist}:${durSec}`;
        if (seenTrackKeys.has(dupKey)) return false;
        seenTrackKeys.add(dupKey);
      }

      const formatLower = (t.format || '').toLowerCase();

      if (libraryFormatFilter !== 'all') {
        if (libraryFormatFilter === 'lossless') {
          const isLossless =
            formatLower.includes('flac') ||
            formatLower.includes('wav') ||
            formatLower.includes('alac') ||
            (t.bit_depth != null && t.bit_depth >= 16);
          if (!isLossless) return false;
        } else if (!formatLower.includes(libraryFormatFilter)) {
          return false;
        }
      }

      if (smartPlaylistFilter === 'favorites') {
        if (!t.is_favorite) return false;
      } else if (smartPlaylistFilter === 'history') {
        if (!t.last_played_at) return false;
      } else if (smartPlaylistFilter === 'top_played') {
        if (!t.play_count || t.play_count <= 0) return false;
      } else if (smartPlaylistFilter === 'hires') {
        const isHires = (t.bit_depth != null && t.bit_depth >= 24) || (t.sample_rate != null && t.sample_rate > 48000);
        if (!isHires) return false;
      } else if (smartPlaylistFilter === 'forgotten') {
        if (t.play_count != null && t.play_count > 0) return false;
      } else if (smartPlaylistFilter === 'high_bpm') {
        if (!t.bpm || t.bpm < 130) return false;
      } else if (smartPlaylistFilter === 'top_rated') {
        if (!t.rating || t.rating < 4) return false;
      }

      if (!q) return true;

      const album = t.album_id != null ? albums.find((a) => a.id === t.album_id) : null;
      const albumTitle = normalizeStr(album?.title);
      const title = normalizeStr(t.title);
      const artist = normalizeStr(t.artist);
      const albumArtist = normalizeStr(t.album_artist || album?.album_artist);
      const path = normalizeStr(t.path);

      if (rawQ.includes(':')) {
        const tokens = rawQ.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          if (token.startsWith('artist:')) {
            const val = normalizeStr(token.slice(7));
            if (!artist.includes(val) && !albumArtist.includes(val)) return false;
          } else if (token.startsWith('album:')) {
            const val = normalizeStr(token.slice(6));
            if (!albumTitle.includes(val)) return false;
          } else if (token.startsWith('title:')) {
            const val = normalizeStr(token.slice(6));
            if (!title.includes(val)) return false;
          } else if (token.startsWith('format:')) {
            const val = normalizeStr(token.slice(7));
            if (!formatLower.includes(val)) return false;
          } else if (token.startsWith('path:')) {
            const val = normalizeStr(token.slice(5));
            if (!path.includes(val)) return false;
          } else {
            const val = normalizeStr(token);
            if (
              !title.includes(val) &&
              !artist.includes(val) &&
              !albumArtist.includes(val) &&
              !albumTitle.includes(val) &&
              !path.includes(val) &&
              !formatLower.includes(val)
            ) {
              return false;
            }
          }
        }
        return true;
      }

      if (isFacetsFilterEnabled) {
        if (facetSelectedFormat && t.format.toUpperCase() !== facetSelectedFormat) {
          return false;
        }
        if (facetSelectedArtist && t.artist.trim() !== facetSelectedArtist) {
          return false;
        }
        if (facetSelectedAlbumId !== null && t.album_id !== facetSelectedAlbumId) {
          return false;
        }
      }

      return (
        title.includes(q) ||
        artist.includes(q) ||
        albumArtist.includes(q) ||
        albumTitle.includes(q) ||
        path.includes(q) ||
        formatLower.includes(q)
      );
    });
  }, [
    albums,
    deferredSearch,
    facetSelectedAlbumId,
    facetSelectedArtist,
    facetSelectedFormat,
    hideDuplicates,
    isFacetsFilterEnabled,
    libraryFormatFilter,
    smartPlaylistFilter,
    tracks,
  ]);

  const sortedTracks = useMemo(() => {
    if (sortField === 'default') {
      let baseList = filteredTracks;
      if (smartPlaylistFilter === 'history') {
        baseList = [...filteredTracks].sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0));
      } else if (smartPlaylistFilter === 'top_played') {
        baseList = [...filteredTracks].sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
      } else if (smartPlaylistFilter === 'top_rated') {
        baseList = [...filteredTracks].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (smartPlaylistFilter === 'high_bpm') {
        baseList = [...filteredTracks].sort((a, b) => (b.bpm || 0) - (a.bpm || 0));
      }
      return sortOrder === 'asc' ? baseList : [...baseList].reverse();
    }
    const albumYears = new Map<number, number>();
    if (sortField === 'year') {
      for (const a of albums) if (a.year) albumYears.set(a.id, a.year);
    }
    return [...filteredTracks].sort(trackComparator(sortField, sortOrder, albumYears));
  }, [albums, filteredTracks, smartPlaylistFilter, sortField, sortOrder]);

  const filteredAlbums = useMemo(() => {
    const q = normalizeStr(deferredSearch.trim());
    if (!q) return albums;
    return albums.filter((a) => {
      const title = normalizeStr(a.title);
      const artist = normalizeStr(a.album_artist);
      return title.includes(q) || artist.includes(q);
    });
  }, [albums, deferredSearch]);

  const albumsWithCoverCount = useMemo(() => albums.filter((a) => !!a.cover_path).length, [albums]);
  const albumsWithoutCoverCount = useMemo(() => albums.length - albumsWithCoverCount, [albums, albumsWithCoverCount]);

  const sortedAlbums = useMemo(() => {
    const list = albums.filter((a) => {
      if (albumCoverFilter === 'with-cover' && !a.cover_path) return false;
      if (albumCoverFilter === 'missing-cover' && a.cover_path) return false;
      const q = normalizeStr(deferredSearch.trim());
      if (!q) return true;
      const title = normalizeStr(a.title);
      const artist = normalizeStr(a.album_artist);
      return title.includes(q) || artist.includes(q);
    });

    const albumMetaMap = new Map<number, { count: number; duration: number }>();
    if (albumSortField === 'tracks' || albumSortField === 'duration') {
      for (const t of tracks) {
        if (t.album_id != null) {
          const cur = albumMetaMap.get(t.album_id) || { count: 0, duration: 0 };
          cur.count += 1;
          cur.duration += t.duration_ms || 0;
          albumMetaMap.set(t.album_id, cur);
        }
      }
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (albumSortField === 'title') {
        cmp = collator.compare(a.title || '', b.title || '');
      } else if (albumSortField === 'artist') {
        cmp = collator.compare(a.album_artist || '', b.album_artist || '');
      } else if (albumSortField === 'year') {
        cmp = (a.year || 0) - (b.year || 0);
      } else if (albumSortField === 'tracks') {
        const aCount = albumMetaMap.get(a.id)?.count || 0;
        const bCount = albumMetaMap.get(b.id)?.count || 0;
        cmp = aCount - bCount;
      } else if (albumSortField === 'duration') {
        const aDur = albumMetaMap.get(a.id)?.duration || 0;
        const bDur = albumMetaMap.get(b.id)?.duration || 0;
        cmp = aDur - bDur;
      }
      return albumSortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [albumCoverFilter, albumSortField, albumSortOrder, albums, deferredSearch, tracks]);

  const filteredArtists = useMemo(() => {
    const map = new Map<string, {
      name: string;
      tracks: TrackRecord[];
      albumIds: Set<number>;
      totalDurationMs: number;
      totalPlays: number;
      sampleCover: string | null;
    }>();

    tracks.forEach((t) => {
      const name = t.artist || loc.stats.unknownArtist;
      const existing = map.get(name) || {
        name,
        tracks: [],
        albumIds: new Set<number>(),
        totalDurationMs: 0,
        totalPlays: 0,
        sampleCover: null,
      };
      existing.tracks.push(t);
      if (t.album_id) existing.albumIds.add(t.album_id);
      existing.totalDurationMs += t.duration_ms || 0;
      existing.totalPlays += t.play_count || 0;
      if (!existing.sampleCover && t.album_id) {
        const alb = albums.find((a) => a.id === t.album_id);
        if (alb?.cover_path) existing.sampleCover = alb.cover_path;
      }
      map.set(name, existing);
    });

    let list = Array.from(map.values());
    if (deferredSearch.trim()) {
      const q = normalizeStr(deferredSearch);
      list = list.filter((a) => normalizeStr(a.name).includes(q));
    }
    list.sort((a, b) => collator.compare(a.name, b.name));
    return list;
  }, [albums, deferredSearch, loc.stats.unknownArtist, tracks]);

  // 7. Search input ref
  const librarySearchInputRef = useRef<HTMLInputElement>(null);

  // 8. Library Loader & Scanner Handlers
  const loadLibrary = useCallback(async () => {
    try {
      const t = await invoke<TrackRecord[]>('get_library_tracks');
      setTracks(t);
      const a = await invoke<AlbumRecord[]>('get_library_albums');
      setAlbums(a);

      if (t.length === 0) {
        try {
          const sample = await invoke<SampleTrackDto | null>('get_sample_track');
          if (sample) {
            setStatus((prev) => {
              if (prev.current_track?.title && prev.current_track.title !== 'Skrzydła Białe') {
                return prev;
              }
              if (prev.state === 'Playing') return prev;
              return {
                ...prev,
                duration_ms: sample.duration_ms,
                current_track: {
                  id: 'default-sample-track-skrzydla-biale',
                  uri: sample.path,
                  track_id: null,
                  title: sample.title,
                  artist: sample.artist,
                  album: sample.album,
                  duration_ms: sample.duration_ms,
                },
              };
            });
            setFilePath(sample.path);
          }
        } catch (sampleErr) {
          console.warn('Failed to fetch the default test track:', sampleErr);
        }
      } else {
        setStatus((prev) => {
          const isSampleTrack = !prev.current_track?.track_id && (
            prev.current_track?.id === 'default-sample-track-skrzydla-biale' ||
            prev.current_track?.title === 'Skrzydła Białe'
          );
          if (isSampleTrack && prev.state !== 'Playing') {
            const first = t[0];
            setActiveTrackId(first.id);
            setFilePath(first.path);
            invoke('set_active_track', { trackId: first.id }).catch(() => {});
            return {
              ...prev,
              position_ms: 0,
              duration_ms: first.duration_ms,
              current_track: {
                id: `track-${first.id}`,
                uri: first.path,
                track_id: first.id,
                title: first.title,
                artist: first.artist,
                album: null,
                duration_ms: first.duration_ms,
              },
            };
          }
          return prev;
        });
      }
    } catch (e: unknown) {
      console.warn('Failed to load the library:', e);
    }
  }, [setActiveTrackId, setFilePath, setStatus]);

  const handleScanPaths = useCallback(async (
    paths: string[],
    options?: { skipAutoActivate?: boolean },
  ): Promise<{ tracks: TrackRecord[]; albums: AlbumRecord[] } | null> => {
    if (!paths || paths.length === 0) return null;
    setIsScanning(true);
    try {
      const summary = await invoke<ScanSummaryDto>('scan_paths', { paths });
      setScanResult(summary);
      const updatedTracks = await invoke<TrackRecord[]>('get_library_tracks');
      const updatedAlbums = await invoke<AlbumRecord[]>('get_library_albums');
      setTracks(updatedTracks);
      setAlbums(updatedAlbums);

      if (updatedTracks.length > 0 && !options?.skipAutoActivate) {
        setStatus((prev) => {
          const isSampleTrack = !prev.current_track?.track_id && (
            prev.current_track?.id === 'default-sample-track-skrzydla-biale' ||
            prev.current_track?.title === 'Skrzydła Białe'
          );
          if (isSampleTrack && prev.state !== 'Playing') {
            const first = updatedTracks[0];
            setActiveTrackId(first.id);
            setFilePath(first.path);
            invoke('set_active_track', { trackId: first.id }).catch(() => {});
            return {
              ...prev,
              position_ms: 0,
              duration_ms: first.duration_ms,
              current_track: {
                id: `track-${first.id}`,
                uri: first.path,
                track_id: first.id,
                title: first.title,
                artist: first.artist,
                album: null,
                duration_ms: first.duration_ms,
              },
            };
          }
          return prev;
        });
      }

      if (summary.errors > 0) {
        showMessage(
          `Added to the library: ${summary.new_or_updated_tracks} indexed (found: ${summary.total_files_found}, failed: ${summary.errors}).`,
          summary.new_or_updated_tracks === 0,
        );
      } else {
        showMessage(
          `Added to the library: ${summary.new_or_updated_tracks} indexed (found: ${summary.total_files_found}).`,
        );
      }
      return { tracks: updatedTracks, albums: updatedAlbums };
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
      return null;
    } finally {
      setIsScanning(false);
    }
  }, [loc.common.errorPrefix, setActiveTrackId, setFilePath, setStatus, showMessage]);

  const handleScanLibrary = useCallback(async () => {
    setIsScanning(true);
    try {
      const summary = await invoke<ScanSummaryDto>('scan_library', { folderPath: scanFolder });
      setScanResult(summary);
      await loadLibrary();
      showMessage(
        fmt(loc.notifications.scanFinished, String(summary.new_or_updated_tracks), String(summary.skipped_unchanged))
      );
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    } finally {
      setIsScanning(false);
    }
  }, [loadLibrary, loc.common.errorPrefix, loc.notifications.scanFinished, scanFolder, showMessage]);

  const handlePickFolder = useCallback(async () => {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        setScanFolder(selected);
        await handleScanPaths([selected]);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [handleScanPaths, loc.common.errorPrefix, showMessage]);

  return {
    tracks,
    setTracks,
    albums,
    setAlbums,
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
    albumViewMode,
    setAlbumViewMode,
    albumGridSize,
    setAlbumGridSize,
    albumCoverFilter,
    setAlbumCoverFilter,
    albumsWithCoverCount,
    albumsWithoutCoverCount,
    selectedAlbumDetail,
    setSelectedAlbumDetail,
    handleOpenAlbumDetail,
    handleBackFromAlbumDetail,
    filteredTracks,
    sortedTracks,
    filteredAlbums,
    sortedAlbums,
    filteredArtists,
    isScanFolderOpen,
    setIsScanFolderOpen,
    scanFolder,
    setScanFolder,
    isScanning,
    scanResult,
    loadLibrary,
    handleScanLibrary,
    handleScanPaths,
    handlePickFolder,
  };
}
