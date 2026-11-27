import type { SettingsTab } from '../types/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '../api/ipc';
import type { PlaybackStatus, TrackRecord, AlbumRecord, TrackBookmarkDto } from '../types/player';
import { formatTimeMs, parseTimeToMs } from '../utils/timeFormat';
import type { Language, Translations, getTranslations } from '../i18n';
import { useTauriEvent } from './useTauriEvent';
import { parseBoolean, usePersistedState } from './usePersistedState';
import { fmt } from '../utils/fmt';

export const TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY = 'auralune_transcode_auto_enqueue';

/** Serde shape of `domain::transcode::ExportFormat` (externally tagged enum). */
type ExportFormat = { Wav: null } | { Opus: { bitrate_kbps: number } } | { Flac: { compression_level: number } };

export interface UseTranscodeManagerProps {
  filePath: string;
  setFilePath: (p: string) => void;
  currentPlayingTrack: TrackRecord | null;
  status: PlaybackStatus;
  loopPointA: number | null;
  loopPointB: number | null;
  currentTrackBookmarks: TrackBookmarkDto[];
  activeTrackId: number | null;
  reverbEnabled: boolean;
  reverbLevel: number;
  language: Language;
  loc: Translations;
  t: ReturnType<typeof getTranslations>;
  showMessage: (msg: string, isError?: boolean) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  isSettingsOpen?: boolean;
  settingsTab?: string;
  setIsSettingsOpen: (open: boolean) => void;
  refreshTrackBookmarks: () => void;
  handleAddTrackToQueue: (track: TrackRecord) => Promise<void>;
  loadLibrary: () => Promise<void>;
  setTracks: (t: TrackRecord[]) => void;
  setAlbums: (a: AlbumRecord[]) => void;
}

export function useTranscodeManager({
  filePath,
  setFilePath,
  currentPlayingTrack,
  status,
  loopPointA,
  loopPointB,
  currentTrackBookmarks,
  activeTrackId,
  reverbEnabled,
  reverbLevel,
  loc,
  t,
  showMessage,
  setSettingsTab,
  isSettingsOpen,
  settingsTab,
  setIsSettingsOpen,
  refreshTrackBookmarks,
  handleAddTrackToQueue,
  loadLibrary,
  setTracks,
  setAlbums,
}: UseTranscodeManagerProps) {
  const [transcodeOutput, setTranscodeOutput] = useState('tests/fixtures/converted_sample.opus');
  const [transcodeFormat, setTranscodeFormat] = useState<'Opus' | 'Flac' | 'Wav'>('Opus');
  const [transcodeBitrate, setTranscodeBitrate] = useState(192);
  const [transcodeApplyDsp, setTranscodeApplyDsp] = useState(false);
  const [transcodeApplyRange, setTranscodeApplyRange] = useState(false);
  const [transcodeRangeA, setTranscodeRangeA] = useState<string>('');
  const [transcodeRangeB, setTranscodeRangeB] = useState<string>('');
  const [transcodeAutoEnqueue, setTranscodeAutoEnqueue] = usePersistedState(
    TRANSCODE_AUTO_ENQUEUE_STORAGE_KEY,
    true,
    { parse: parseBoolean },
  );
  const transcodeAutoEnqueueRef = useRef(transcodeAutoEnqueue);
  useEffect(() => {
    transcodeAutoEnqueueRef.current = transcodeAutoEnqueue;
  }, [transcodeAutoEnqueue]);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState<{
    percent: number;
    position_ms?: number;
    duration_ms?: number;
  } | null>(null);
  const [transcodeElapsedSeconds, setTranscodeElapsedSeconds] = useState<number>(0);
  const [lastExportedTrack, setLastExportedTrack] = useState<TrackRecord | null>(null);
  const [isPickingSource, setIsPickingSource] = useState(false);
  const [isPickingDestination, setIsPickingDestination] = useState(false);

  // Listen for transcoding progress from the backend
  useTauriEvent<{ percent: number; position_ms?: number; duration_ms?: number }>(
    'transcode_progress',
    setTranscodeProgress,
  );

  // Timer measuring the transcoding duration
  useEffect(() => {
    if (!isTranscoding) return;
    const interval = setInterval(() => {
      setTranscodeElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTranscoding]);

  // Sync the active A-B loop and the current path after opening the transcoding tab
  useEffect(() => {
    if (isSettingsOpen && settingsTab === 'transcode') {
      const curPath = currentPlayingTrack?.path || status.current_track?.uri;
      if (curPath && (!filePath || filePath === 'tests/fixtures/test_sine_440hz.wav')) {
        let clean = curPath;
        if (clean.startsWith('file://')) {
          try {
            clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
          } catch {
            clean = clean.replace(/^file:\/\//, '');
          }
        }
        setFilePath(clean);
      }

      if (loopPointA !== null || loopPointB !== null) {
        const strA = loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000';
        const strB = loopPointB !== null ? formatTimeMs(loopPointB) : '';
        setTranscodeRangeA(strA);
        setTranscodeRangeB(strB);
        setTranscodeApplyRange(true);

        const targetSource = curPath || filePath;
        if (targetSource) {
          let clean = targetSource;
          if (clean.startsWith('file://')) {
            try {
              clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
            } catch {
              clean = clean.replace(/^file:\/\//, '');
            }
          }
          const lastDot = clean.lastIndexOf('.');
          let base = lastDot > 0 ? clean.substring(0, lastDot) : clean;
          base = base.replace(/_loop_\d+-(?:\d+|end)$/i, '');
          const suffix = `_loop_${loopPointA !== null ? loopPointA : 0}-${loopPointB !== null ? loopPointB : 'end'}`;
          setTranscodeOutput(`${base}${suffix}.${transcodeFormat.toLowerCase()}`);
        }
      }
    }
  }, [isSettingsOpen, settingsTab, loopPointA, loopPointB, currentPlayingTrack, status.current_track, filePath, transcodeFormat, setFilePath]);

  const updateTranscodeOutputFilename = useCallback(
    (
      sourcePath?: string,
      fmt?: string,
      rangeAVal?: string,
      rangeBVal?: string,
      applyRange?: boolean
    ) => {
      const curSource = sourcePath || filePath;
      if (!curSource) return;
      let clean = curSource;
      if (clean.startsWith('file://')) {
        try {
          clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
        } catch {
          clean = clean.replace(/^file:\/\//, '');
        }
      }
      const lastDot = clean.lastIndexOf('.');
      let base = lastDot > 0 ? clean.substring(0, lastDot) : clean;
      base = base.replace(/_loop_\d+-(?:\d+|end)$/i, '');

      const targetFormat = (fmt || transcodeFormat).toLowerCase();
      const shouldApply = applyRange !== undefined ? applyRange : transcodeApplyRange;
      if (!shouldApply) {
        setTranscodeOutput(`${base}.${targetFormat}`);
        return;
      }

      const rA = rangeAVal !== undefined ? rangeAVal : transcodeRangeA;
      const rB = rangeBVal !== undefined ? rangeBVal : transcodeRangeB;

      let pA = parseTimeToMs(rA);
      if (pA === null && loopPointA !== null) pA = loopPointA;
      if (pA === null) pA = 0;

      let pB = parseTimeToMs(rB);
      if (pB === null && loopPointB !== null) pB = loopPointB;

      const rangeSuffix = `_loop_${pA}-${pB !== null ? pB : 'end'}`;
      setTranscodeOutput(`${base}${rangeSuffix}.${targetFormat}`);
    },
    [filePath, transcodeFormat, transcodeApplyRange, transcodeRangeA, transcodeRangeB, loopPointA, loopPointB]
  );

  const handlePickTranscodeSource = useCallback(async () => {
    try {
      setIsPickingSource(true);
      const selected = await invoke<string | null>('pick_single_audio_file');
      if (selected) {
        setFilePath(selected);
        updateTranscodeOutputFilename(selected, transcodeFormat, transcodeRangeA, transcodeRangeB, transcodeApplyRange);
      }
    } catch (e: unknown) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsPickingSource(false);
    }
  }, [setFilePath, updateTranscodeOutputFilename, transcodeFormat, transcodeRangeA, transcodeRangeB, transcodeApplyRange, showMessage, t.common.errorPrefix]);

  const handlePickTranscodeDestination = useCallback(async () => {
    try {
      setIsPickingDestination(true);
      const ext = transcodeFormat.toLowerCase();
      let defaultName = `converted_sample.${ext}`;
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath;
        const lastDot = fileName.lastIndexOf('.');
        const base = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
        defaultName = `${base}.${ext}`;
      }
      const selected = await invoke<string | null>('pick_save_destination', {
        defaultName,
        extension: ext,
      });
      if (selected) {
        setTranscodeOutput(selected);
      }
    } catch (e: unknown) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsPickingDestination(false);
    }
  }, [transcodeFormat, filePath, showMessage, t.common.errorPrefix]);

  const handleUseCurrentTrackAsSource = useCallback(() => {
    let curPath = currentPlayingTrack?.path || status.current_track?.uri;
    if (curPath) {
      if (curPath.startsWith('file://')) {
        try {
          curPath = decodeURIComponent(curPath.replace(/^file:\/\//, ''));
        } catch {
          curPath = curPath.replace(/^file:\/\//, '');
        }
      }
      setFilePath(curPath);
      const lastDot = curPath.lastIndexOf('.');
      let base = lastDot > 0 ? curPath.substring(0, lastDot) : curPath;
      base = base.replace(/_loop_\d+-(?:\d+|end)$/i, '');

      // Check whether there are active loop points in RAM or saved markers in the library for this track
      let effectiveA = loopPointA;
      let effectiveB = loopPointB;
      if (effectiveA === null && effectiveB === null && currentTrackBookmarks.length >= 2) {
        const bmA = currentTrackBookmarks.find((b) => /\b(a|punkt a|start|pocz[aą]tek)\b/i.test(b.name)) || currentTrackBookmarks[0];
        const bmB = currentTrackBookmarks.find((b) => /\b(b|punkt b|stop|end|koniec)\b/i.test(b.name) && b.id !== bmA?.id) || currentTrackBookmarks[1];
        if (bmA && bmB && bmB.position_ms > bmA.position_ms) {
          effectiveA = bmA.position_ms;
          effectiveB = bmB.position_ms;
        }
      }

      const rangeSuffix =
        effectiveA !== null || effectiveB !== null
          ? `_loop_${effectiveA !== null ? effectiveA : 0}-${effectiveB !== null ? effectiveB : 'end'}`
          : '';
      setTranscodeOutput(`${base}${rangeSuffix}.${transcodeFormat.toLowerCase()}`);
      if (effectiveA !== null || effectiveB !== null) {
        setTranscodeRangeA(effectiveA !== null ? formatTimeMs(effectiveA) : '0:00.000');
        setTranscodeRangeB(effectiveB !== null ? formatTimeMs(effectiveB) : '');
        setTranscodeApplyRange(true);
      }
      showMessage(loc.settings.useCurrentTrack);
    } else {
      showMessage(loc.queue.emptyQueueNotice, true);
    }
  }, [currentPlayingTrack?.path, status.current_track?.uri, setFilePath, loopPointA, loopPointB, currentTrackBookmarks, transcodeFormat, showMessage, loc.settings.useCurrentTrack, loc.queue.emptyQueueNotice]);

  const handleExportLoopFromModal = useCallback((a: number | null, b: number | null) => {
    let curPath = currentPlayingTrack?.path || status.current_track?.uri || filePath;
    if (curPath) {
      if (curPath.startsWith('file://')) {
        try {
          curPath = decodeURIComponent(curPath.replace(/^file:\/\//, ''));
        } catch {
          curPath = curPath.replace(/^file:\/\//, '');
        }
      }
      setFilePath(curPath);
      const lastDot = curPath.lastIndexOf('.');
      let base = lastDot > 0 ? curPath.substring(0, lastDot) : curPath;
      base = base.replace(/_loop_\d+-(?:\d+|end)$/i, '');
      const rangeSuffix = `_loop_${a !== null ? a : 0}-${b !== null ? b : 'end'}`;
      setTranscodeOutput(`${base}${rangeSuffix}.${transcodeFormat.toLowerCase()}`);
    }
    setTranscodeRangeA(a !== null ? formatTimeMs(a) : '0:00.000');
    setTranscodeRangeB(b !== null ? formatTimeMs(b) : '');
    setTranscodeApplyRange(true);
    setSettingsTab('transcode');
    setIsSettingsOpen(true);
    showMessage(
      fmt((t.notifications.loopRangeImported || 'Imported A-B loop range for export: {0} → {1}'), formatTimeMs(a ?? 0), formatTimeMs(b))
    );
  }, [currentPlayingTrack?.path, status.current_track?.uri, filePath, setFilePath, transcodeFormat, setSettingsTab, setIsSettingsOpen, showMessage, t.notifications.loopRangeImported]);

  const handleSaveLoopAsBookmarks = useCallback(async (a: number | null, b: number | null) => {
    if (!activeTrackId) {
      showMessage(t.notifications.noActiveTrackForMarkers, true);
      return;
    }
    try {
      if (a !== null) {
        await invoke('add_track_bookmark', {
          trackId: activeTrackId,
          name: 'Punkt A',
          positionMs: a,
        });
      }
      if (b !== null) {
        await invoke('add_track_bookmark', {
          trackId: activeTrackId,
          name: 'Punkt B',
          positionMs: b,
        });
      }
      await refreshTrackBookmarks();
      showMessage(t.notifications.savedMarkersAsBookmarks);
    } catch (e: unknown) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    }
  }, [activeTrackId, showMessage, t.notifications.noActiveTrackForMarkers, t.notifications.savedMarkersAsBookmarks, refreshTrackBookmarks, t.common.errorPrefix]);

  const handleTranscode = useCallback(async () => {
    if (isTranscoding) return;
    setIsTranscoding(true);
    setTranscodeProgress({ percent: 0 });
    setTranscodeElapsedSeconds(0);
    showMessage(t.notifications.exportStartedBackground);
    try {
      let formatObj: ExportFormat = { Wav: null };
      if (transcodeFormat === 'Opus') {
        formatObj = { Opus: { bitrate_kbps: transcodeBitrate } };
      } else if (transcodeFormat === 'Flac') {
        formatObj = { Flac: { compression_level: 5 } };
      }

      const dspSettings = transcodeApplyDsp
        ? {
          pitch_semitones: status.pitch_semitones ?? 0.0,
          tempo_ratio: status.tempo_ratio ?? 1.0,
          rate_ratio: status.rate_ratio ?? 1.0,
          engine: status.engine || 'RubberBand',
          reverb_level: reverbEnabled ? reverbLevel : 0.0,
          eq_bands: status.equalizer_enabled !== false ? (status.equalizer_bands || null) : null,
        }
        : null;

      let timeRange: { start_ms: number; end_ms: number | null } | null = null;
      if (transcodeApplyRange) {
        let parsedA = parseTimeToMs(transcodeRangeA);
        if (parsedA === null && loopPointA !== null) parsedA = loopPointA;
        if (parsedA === null) parsedA = 0;

        let parsedB = parseTimeToMs(transcodeRangeB);
        if (parsedB === null && loopPointB !== null) parsedB = loopPointB;

        if (parsedB !== null && parsedB <= parsedA) {
          showMessage(loc.settings.transcodeEndMustBeGreater, true);
          setIsTranscoding(false);
          return;
        }
        timeRange = {
          start_ms: parsedA,
          end_ms: parsedB,
        };
      }

      let cleanInput = filePath;
      if (cleanInput.startsWith('file://')) {
        try {
          cleanInput = decodeURIComponent(cleanInput.replace(/^file:\/\//, ''));
        } catch {
          cleanInput = cleanInput.replace(/^file:\/\//, '');
        }
      }

      let cleanOutput = transcodeOutput;
      if (cleanOutput.startsWith('file://')) {
        try {
          cleanOutput = decodeURIComponent(cleanOutput.replace(/^file:\/\//, ''));
        } catch {
          cleanOutput = cleanOutput.replace(/^file:\/\//, '');
        }
      }

      if (timeRange && cleanOutput.includes('_loop_')) {
        cleanOutput = cleanOutput.replace(/_loop_\d+-(?:\d+|end)(\.[a-z0-9]+)$/i, `_loop_${timeRange.start_ms}-${timeRange.end_ms ?? 'end'}$1`);
      }

      await invoke('transcode_file', {
        inputPath: cleanInput,
        outputPath: cleanOutput,
        format: formatObj,
        dspSettings,
        timeRange,
      });

      let renderedTrack: TrackRecord | null = null;
      try {
        await invoke('scan_paths', { paths: [cleanOutput] });
        const updatedTracks = await invoke<TrackRecord[]>('get_library_tracks');
        const updatedAlbums = await invoke<AlbumRecord[]>('get_library_albums');
        setTracks(updatedTracks);
        setAlbums(updatedAlbums);
        renderedTrack = updatedTracks.find((tr) => tr.path === cleanOutput) || null;
      } catch (scanErr) {
        console.warn('Automatic indexing of the rendered file failed:', scanErr);
      }

      if (!renderedTrack) {
        const fileName = cleanOutput.split('/').pop() || cleanOutput;
        const lastDot = fileName.lastIndexOf('.');
        const title = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
        const calculatedDuration =
          transcodeApplyRange && timeRange && timeRange.end_ms
            ? timeRange.end_ms - timeRange.start_ms
            : currentPlayingTrack?.duration_ms || 180000;
        renderedTrack = {
          id: Date.now(),
          path: cleanOutput,
          title,
          artist: currentPlayingTrack?.artist || 'Auralune Render',
          album_artist: currentPlayingTrack?.album_artist || null,
          album_id: null,
          disc_no: 1,
          track_no: 1,
          duration_ms: calculatedDuration,
          format: transcodeFormat.toLowerCase(),
          sample_rate: 44100,
          channels: 2,
          bit_depth: 16,
          file_size: 0,
          modified_time: Date.now(),
          is_favorite: false,
          play_count: 0,
          last_played_at: null,
          total_play_time_ms: 0,
        };
      }

      setLastExportedTrack(renderedTrack);

      if (transcodeAutoEnqueueRef.current && renderedTrack) {
        await handleAddTrackToQueue(renderedTrack);
      }

      showMessage(fmt(t.notifications.transcodeSuccessMsg, cleanOutput));
      await loadLibrary();
    } catch (e: unknown) {
      showMessage(`${t.common.errorPrefix} ${e}`, true);
    } finally {
      setIsTranscoding(false);
      setTranscodeProgress(null);
    }
  }, [
    isTranscoding,
    showMessage,
    transcodeFormat,
    transcodeBitrate,
    transcodeApplyDsp,
    status.pitch_semitones,
    status.tempo_ratio,
    status.rate_ratio,
    status.engine,
    status.equalizer_enabled,
    status.equalizer_bands,
    reverbEnabled,
    reverbLevel,
    transcodeApplyRange,
    transcodeRangeA,
    loopPointA,
    transcodeRangeB,
    loopPointB,
    loc.settings.transcodeEndMustBeGreater,
    filePath,
    transcodeOutput,
    setTracks,
    setAlbums,
    currentPlayingTrack,
    handleAddTrackToQueue,
    t.notifications.exportStartedBackground,
    t.notifications.transcodeSuccessMsg,
    t.common.errorPrefix,
    loadLibrary,
  ]);

  return {
    transcodeOutput,
    setTranscodeOutput,
    transcodeFormat,
    setTranscodeFormat,
    transcodeBitrate,
    setTranscodeBitrate,
    transcodeApplyDsp,
    setTranscodeApplyDsp,
    transcodeApplyRange,
    setTranscodeApplyRange,
    transcodeRangeA,
    setTranscodeRangeA,
    transcodeRangeB,
    setTranscodeRangeB,
    transcodeAutoEnqueue,
    setTranscodeAutoEnqueue,
    isTranscoding,
    transcodeProgress,
    setTranscodeProgress,
    transcodeElapsedSeconds,
    setTranscodeElapsedSeconds,
    lastExportedTrack,
    setLastExportedTrack,
    isPickingSource,
    isPickingDestination,
    updateTranscodeOutputFilename,
    handlePickTranscodeSource,
    handlePickTranscodeDestination,
    handleUseCurrentTrackAsSource,
    handleExportLoopFromModal,
    handleSaveLoopAsBookmarks,
    handleTranscode,
  };
}
