import { useMemo, useEffect, useRef, useState } from 'react';
import { invoke } from '../api/ipc';
import type { TrackRecord, AlbumRecord, PlaybackStatus } from '../types/player';
import type { SpectralBandTriple, TrackWaveformData } from '../types/analysis';
import type { Translations } from '../i18n';
import { getTransposedKey } from '../utils/harmonicMixing';

export interface UseCurrentTrackInfoOptions {
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  status: PlaybackStatus;
  filePath: string;
  activeTrackId: number | null;
  trackDirectCover: string | null;
  setTrackDirectCover: React.Dispatch<React.SetStateAction<string | null>>;
  currentRadioStation?: { name: string; url: string; genre: string } | null;
  loc: Translations;
}

export function useCurrentTrackInfo({
  tracks,
  albums,
  status,
  filePath,
  activeTrackId,
  trackDirectCover,
  setTrackDirectCover,
  currentRadioStation,
  loc,
}: UseCurrentTrackInfoOptions) {
  // 1. Resolve matching TrackRecord for current playback
  const currentPlayingTrack = useMemo(() => {
    // A. Match by track_id from active playback status
    if (status.current_track?.track_id) {
      const match = tracks.find((t) => t.id === status.current_track!.track_id);
      if (match) return match;
    }
    // B. Match by file path URI
    if (status.current_track?.uri) {
      const uri = status.current_track.uri;
      const match = tracks.find((t) => t.path === uri || uri.endsWith(t.path) || t.path.endsWith(uri));
      if (match) return match;
    }
    // C. Match by active filePath
    if (filePath) {
      const match = tracks.find((t) => t.path === filePath || filePath.endsWith(t.path) || t.path.endsWith(filePath));
      if (match) return match;
    }
    // D. Fallback to activeTrackId from library selection
    if (activeTrackId) {
      const match = tracks.find((t) => t.id === activeTrackId);
      if (match) return match;
    }
    return null;
  }, [tracks, status.current_track?.track_id, status.current_track?.uri, filePath, activeTrackId]);

  // 2. Resolve matching AlbumRecord (never fall back to title-only matching across different artists)
  const currentAlbum = useMemo(() => {
    if (currentPlayingTrack?.album_id) {
      const found = albums.find((a) => a.id === currentPlayingTrack.album_id);
      if (found) return found;
    }
    const albTitle = (status.current_track?.album || '').trim().toLowerCase();
    const albArtist = (
      currentPlayingTrack?.album_artist ||
      currentPlayingTrack?.artist ||
      status.current_track?.artist ||
      ''
    )
      .trim()
      .toLowerCase();
    if (albTitle && albArtist) {
      const foundExact = albums.find(
        (a) => a.title.trim().toLowerCase() === albTitle && a.album_artist.trim().toLowerCase() === albArtist
      );
      if (foundExact) return foundExact;
    }
    return null;
  }, [
    albums,
    currentPlayingTrack,
    status.current_track?.album,
    status.current_track?.artist,
  ]);

  // 3. Dynamic Key & BPM with localStorage caching
  const activeTrackKeyBpm = useMemo(() => {
    let key = currentPlayingTrack?.initial_key || tracks.find((t) => t.path === status.current_track?.uri)?.initial_key || null;
    let bpm = currentPlayingTrack?.bpm || tracks.find((t) => t.path === status.current_track?.uri)?.bpm || null;

    if (!key || !bpm) {
      const cacheId = currentPlayingTrack?.id ? `auralune_track_key_bpm_${currentPlayingTrack.id}` : null;
      const cacheUri = currentPlayingTrack?.path
        ? `auralune_track_key_bpm_${currentPlayingTrack.path}`
        : (status.current_track?.uri ? `auralune_track_key_bpm_${status.current_track.uri}` : null);
      const stored = (cacheId && localStorage.getItem(cacheId)) || (cacheUri && localStorage.getItem(cacheUri));
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (!key && typeof parsed.baseKeyIndex === 'number') {
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const note = notes[parsed.baseKeyIndex] || 'C';
            key = parsed.isMinor ? `${note}m` : `${note} Maj`;
          }
          if (!bpm && typeof parsed.baseBpm === 'number') {
            bpm = parsed.baseBpm;
          }
        } catch {}
      }
    }
    return { key, bpm };
  }, [currentPlayingTrack, tracks, status.current_track?.uri]);

  // 4. Combined DSP calculations
  const dspCombination = useMemo(() => {
    const pitchSt = status.pitch_semitones ?? 0.0;
    const tempoRatio = status.tempo_ratio ?? 1.0;
    const rateRatio = status.rate_ratio ?? 1.0;
    const engine = status.engine || 'RubberBand';

    const rateSemitones = 12 * Math.log2(Math.max(0.01, rateRatio));
    const totalPitchSemitones = Math.round((pitchSt + rateSemitones) * 100) / 100;
    const totalSpeedRatio = Math.round(tempoRatio * rateRatio * 1000) / 1000;

    const totalKey = activeTrackKeyBpm.key
      ? getTransposedKey(activeTrackKeyBpm.key, totalPitchSemitones)
      : null;

    const totalBpm = activeTrackKeyBpm.bpm
      ? Math.round(activeTrackKeyBpm.bpm * totalSpeedRatio * 10) / 10
      : null;

    const hasPitch = Math.abs(pitchSt) > 0.005;
    const hasTempo = Math.abs(tempoRatio - 1.0) > 0.005;
    const hasRate = Math.abs(rateRatio - 1.0) > 0.005;
    const isCombined = (hasPitch ? 1 : 0) + (hasTempo ? 1 : 0) + (hasRate ? 1 : 0) > 1;

    return {
      pitchSt,
      tempoRatio,
      rateRatio,
      rateSemitones,
      totalPitchSemitones,
      totalSpeedRatio,
      totalKey,
      totalBpm,
      hasPitch,
      hasTempo,
      hasRate,
      isCombined,
      engine,
    };
  }, [status.pitch_semitones, status.tempo_ratio, status.rate_ratio, status.engine, activeTrackKeyBpm]);

  // 5. DSP Badge text & title
  const dspBadgeText = useMemo(() => {
    if (status.engine === 'Bypass') return 'Bypass';
    const { engine, hasPitch, hasTempo, hasRate, totalSpeedRatio, totalPitchSemitones, tempoRatio, pitchSt, rateRatio, rateSemitones } = dspCombination;

    if (!hasPitch && !hasTempo && !hasRate) {
      return `${engine} 1.00x`;
    }
    if (hasTempo && !hasPitch && !hasRate) {
      return `${engine} ${tempoRatio.toFixed(2)}x`;
    }
    if (hasPitch && !hasTempo && !hasRate) {
      return `${engine} ${pitchSt > 0 ? `+${pitchSt.toFixed(2)}` : pitchSt.toFixed(2)}st`;
    }
    if (hasRate && !hasTempo && !hasPitch) {
      return `Rate ${rateRatio.toFixed(2)}x (${rateSemitones > 0 ? `+${rateSemitones.toFixed(2)}` : rateSemitones.toFixed(2)}st)`;
    }
    const pitchStr = Math.abs(totalPitchSemitones) > 0.005 ? `${totalPitchSemitones > 0 ? `+${totalPitchSemitones.toFixed(2)}` : totalPitchSemitones.toFixed(2)}st` : '';
    const speedStr = `${totalSpeedRatio.toFixed(2)}x`;
    if (pitchStr) {
      return `${engine} Σ ${speedStr}, ${pitchStr}`;
    }
    return `${engine} Σ ${speedStr}`;
  }, [status.engine, dspCombination]);

  const dspBadgeTitle = useMemo(() => {
    if (status.engine === 'Bypass') return 'DSP Bypass';
    const { engine, tempoRatio, pitchSt, rateRatio, rateSemitones, totalSpeedRatio, totalPitchSemitones, totalKey, totalBpm } = dspCombination;
    let text = `${engine} [T: ${tempoRatio.toFixed(2)}x, P: ${pitchSt >= 0 ? `+${pitchSt.toFixed(2)}` : pitchSt.toFixed(2)}st, R: ${rateRatio.toFixed(2)}x (${rateSemitones >= 0 ? `+${rateSemitones.toFixed(2)}` : rateSemitones.toFixed(2)}st)] → Σ Speed: ${totalSpeedRatio.toFixed(2)}x, Σ Pitch: ${totalPitchSemitones >= 0 ? `+${totalPitchSemitones.toFixed(2)}` : totalPitchSemitones.toFixed(2)}st`;
    if (totalKey) {
      text += ` • Key: ${totalKey.camelot} (${totalKey.keyName})`;
    }
    if (totalBpm) {
      text += ` • Tempo: ${totalBpm} BPM`;
    }
    return text;
  }, [status.engine, dspCombination]);

  // 6. Direct track cover fetching
  useEffect(() => {
    let isCancelled = false;
    const activePath = currentPlayingTrack?.path || filePath || status.current_track?.uri;
    if (activePath && !currentAlbum?.cover_path) {
      invoke<string | null>('get_track_cover', { trackPath: activePath })
        .then((cov) => {
          if (!isCancelled) {
            setTrackDirectCover(cov ?? null);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setTrackDirectCover(null);
          }
        });
    } else {
      setTrackDirectCover(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [currentPlayingTrack?.path, filePath, status.current_track?.uri, currentAlbum?.cover_path, setTrackDirectCover]);

  // 7. Radio check and current cover resolution
  const isPlayingRadio = Boolean(
    currentRadioStation ||
    (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) ||
    (status.current_track?.uri && (status.current_track.uri.startsWith('http://') || status.current_track.uri.startsWith('https://')))
  );

  const currentCover = isPlayingRadio ? null : (currentAlbum?.cover_path || trackDirectCover || null);

  // 8. MPRIS metadata synchronization
  const lastMprisSyncRef = useRef<string>('');
  useEffect(() => {
    const title = currentPlayingTrack?.title || status.current_track?.title;
    if (!title) return;
    const artist = currentPlayingTrack?.artist || status.current_track?.artist || 'Unknown Artist';
    const album = currentAlbum?.title || status.current_track?.album || 'Auralune Player';
    const durationMs = currentPlayingTrack?.duration_ms || status.current_track?.duration_ms || status.duration_ms || 0;
    const artUrl = currentAlbum?.release_mbid
      ? `https://coverartarchive.org/release/${currentAlbum.release_mbid}/front-500`
      : currentCover;

    const syncKey = `${title}|${artist}|${album}|${durationMs}|${artUrl || ''}`;
    if (lastMprisSyncRef.current === syncKey) return;
    lastMprisSyncRef.current = syncKey;

    invoke('update_mpris_metadata', {
      title,
      artist,
      album,
      durationMs,
      artUrl: artUrl || null,
    }).catch(() => {});
  }, [
    currentPlayingTrack?.title,
    currentPlayingTrack?.artist,
    currentPlayingTrack?.duration_ms,
    status.current_track?.title,
    status.current_track?.artist,
    status.current_track?.album,
    status.current_track?.duration_ms,
    status.duration_ms,
    currentAlbum?.title,
    currentAlbum?.release_mbid,
    currentCover,
  ]);

  // 9. Effective display title and artist
  const cleanLiveTitle = status.live_stream_title && status.live_stream_title.trim() !== '-' && status.live_stream_title.trim() !== ''
    ? status.live_stream_title.trim()
    : null;

  const effectiveDisplayTitle = useMemo(() => {
    if (cleanLiveTitle) {
      return cleanLiveTitle;
    }
    if (currentRadioStation?.name) {
      return currentRadioStation.name;
    }
    if (currentPlayingTrack?.title) {
      return currentPlayingTrack.title;
    }
    if (status.current_track?.title && !status.current_track.title.startsWith('http://') && !status.current_track.title.startsWith('https://')) {
      return status.current_track.title;
    }
    if (filePath) {
      const candidate = filePath.split('/').pop() || '';
      if (!candidate.startsWith('http')) return candidate;
    }
    if (tracks.length === 0) {
      return 'Skrzydła Białe';
    }
    return loc.player.noTrack;
  }, [cleanLiveTitle, currentRadioStation?.name, currentPlayingTrack?.title, status.current_track?.title, filePath, tracks.length, loc.player.noTrack]);

  const effectiveDisplayArtist = useMemo(() => {
    if (currentRadioStation?.name) {
      if (cleanLiveTitle) {
        return currentRadioStation.name;
      }
      return currentRadioStation.genre || 'Anime & Internet Radio';
    }
    if (currentPlayingTrack?.artist) {
      return currentPlayingTrack.artist;
    }
    if (status.current_track?.artist && status.current_track.artist !== 'Unknown Artist') {
      return status.current_track.artist;
    }
    if (tracks.length === 0 && (!status.current_track?.title || status.current_track.title === 'Skrzydła Białe')) {
      return 'Das Letzte Kemonomimi';
    }
    return isPlayingRadio ? 'Anime Radio' : loc.player.unknownArtist;
  }, [currentRadioStation, cleanLiveTitle, currentPlayingTrack?.artist, status.current_track?.artist, status.current_track?.title, tracks.length, isPlayingRadio, loc.player.unknownArtist]);

  // 10. Real FFT Spectral Waveform Profile (extracted via Rust/GStreamer + SQLite cache)
  const WAVEFORM_BUCKETS = 160;
  const WAVEFORM_SESSION_CACHE_CAP = 64;
  const waveformCacheRef = useRef<Map<string, { peaks: number[]; bands: SpectralBandTriple[] }>>(new Map());
  const [waveformState, setWaveformState] = useState<{
    key: string | null;
    peaks: number[];
    bands: SpectralBandTriple[];
    isLoading: boolean;
  }>({ key: null, peaks: [], bands: [], isLoading: false });

  const waveformSourcePath = currentPlayingTrack?.path || status.current_track?.uri || filePath || '';
  const waveformTrackId = currentPlayingTrack?.id ?? status.current_track?.track_id ?? null;

  useEffect(() => {
    const isHttp =
      waveformSourcePath.startsWith('http://') ||
      waveformSourcePath.startsWith('https://');
    if (isPlayingRadio || !waveformSourcePath || isHttp) {
      setWaveformState({ key: null, peaks: [], bands: [], isLoading: false });
      return;
    }

    const cacheKey = `${waveformSourcePath}|${waveformTrackId ?? ''}`;
    const cached = waveformCacheRef.current.get(cacheKey);
    if (cached) {
      setWaveformState({ key: cacheKey, peaks: cached.peaks, bands: cached.bands, isLoading: false });
      return;
    }

    let isCancelled = false;
    setWaveformState({ key: cacheKey, peaks: [], bands: [], isLoading: true });

    invoke<TrackWaveformData>('get_track_waveform', {
      path: waveformSourcePath,
      trackId: waveformTrackId,
      sampleCount: WAVEFORM_BUCKETS,
    })
      .then((data) => {
        if (isCancelled) return;
        if (!data || !Array.isArray(data.peaks)) {
          setWaveformState({ key: cacheKey, peaks: [], bands: [], isLoading: false });
          return;
        }
        const scaledPeaks = data.peaks.map((p) =>
          Math.max(5, Math.min(100, Math.round(p * 1000) / 10))
        );
        const bands = Array.isArray(data.bands) ? data.bands : [];
        if (waveformCacheRef.current.size >= WAVEFORM_SESSION_CACHE_CAP) {
          const oldest = waveformCacheRef.current.keys().next().value;
          if (oldest !== undefined) waveformCacheRef.current.delete(oldest);
        }
        waveformCacheRef.current.set(cacheKey, { peaks: scaledPeaks, bands });
        setWaveformState({ key: cacheKey, peaks: scaledPeaks, bands, isLoading: false });
      })
      .catch(() => {
        if (!isCancelled) {
          setWaveformState({ key: cacheKey, peaks: [], bands: [], isLoading: false });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isPlayingRadio, waveformSourcePath, waveformTrackId]);

  const trackWaveformPeaks = waveformState.peaks;
  const trackWaveformBands = waveformState.bands;
  const isWaveformLoading = waveformState.isLoading;

  return {
    currentPlayingTrack,
    currentAlbum,
    activeTrackKeyBpm,
    dspCombination,
    dspBadgeText,
    dspBadgeTitle,
    currentCover,
    cleanLiveTitle,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    trackWaveformPeaks,
    trackWaveformBands,
    isWaveformLoading,
    isPlayingRadio,
  };
}
