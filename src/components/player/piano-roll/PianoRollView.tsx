import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Crosshair, Download, Type, Piano, Sparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import { errorMessage, invoke } from '../../../api/ipc';
import type { TrackTranscriptionData } from '../../../types/analysis';
import { getTranslations, type Language } from '../../../i18n';
import { fmt } from '../../../utils/fmt';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { PianoRollCanvas, type PianoRollViewChange, type PianoRollViewMode } from './PianoRollCanvas';
import {
  DEFAULT_PX_PER_SEC,
  DEFAULT_ROW_HEIGHT,
  MAX_PX_PER_SEC,
  MIN_PX_PER_SEC,
  ROW_HEIGHT_STEP,
  buildNoteIndex,
  clamp,
  clampRowHeight,
} from './pianoRollModel';
import { cn } from '../../../utils/cn';

export interface PianoRollViewProps {
  currentLang?: Language;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  durationMs?: number;
  isPlaying: boolean;
  /** Speed of the source time relative to real time (tempo × rate with active DSP). */
  speed?: number;
  /** Position until the first live status; the position alone does not force the view to render. */
  currentTimeMs: number;
  onSeek: (positionMs: number) => void;
  /** Messages (toasts) for the MIDI export. */
  onNotify?: (message: string, isError?: boolean) => void;
  onClose?: () => void;
}

const ZOOM_STEP = 1.25;

const parsePxPerSec = (raw: string): number | undefined => {
  const v = Number(raw);
  return Number.isFinite(v) ? clamp(v, MIN_PX_PER_SEC, MAX_PX_PER_SEC) : undefined;
};
/** `null` = automatic row height. */
const parseRowHeight = (raw: string): number | null | undefined => {
  if (raw === 'auto') return null;
  const v = Number(raw);
  return Number.isFinite(v) ? clampRowHeight(v) : undefined;
};

/** Borderless toolbar icon button. */
const ICON_BUTTON = 'flex border-0 bg-transparent p-1 text-fg-secondary hover:text-fg';

function safeFileStem(title: string): string {
  const stem = title.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '');
  return stem || 'track';
}

export const PianoRollView = React.memo(function PianoRollView({
  currentLang,
  trackId,
  trackPath,
  trackTitle,
  durationMs = 180000,
  isPlaying,
  speed,
  currentTimeMs,
  onSeek,
  onNotify,
  onClose,
}: PianoRollViewProps) {
  const t = getTranslations(currentLang);
  const displayTitle = trackTitle || t.analysis.transcriptionDefault;
  const [data, setData] = useState<TrackTranscriptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // The width (time zoom) and row height are remembered between sessions.
  const [pxPerSec, setPxPerSec] = usePersistedState('auralune_piano_roll_px_per_sec', DEFAULT_PX_PER_SEC, {
    parse: parsePxPerSec,
    serialize: (v) => String(Math.round(v * 10) / 10),
  });
  const [rowHeight, setRowHeight] = usePersistedState<number | null>('auralune_piano_roll_row_height', null, {
    parse: parseRowHeight,
    serialize: (v) => (v === null ? 'auto' : String(Math.round(v * 10) / 10)),
  });
  const [mode, setMode] = useState<PianoRollViewMode>('follow');
  const [showLabels, setShowLabels] = usePersistedState('auralune_piano_roll_labels', true, {
    parse: (raw) => (raw === 'true' ? true : raw === 'false' ? false : undefined),
  });

  useEffect(() => {
    if (!trackId && !trackPath) return;
    let isMounted = true;
    setData(null);
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (trackId) {
          const cached = await invoke<TrackTranscriptionData | null>('get_cached_transcription', { trackId });
          if (cached) {
            if (isMounted) setData(cached);
            return;
          }
        }
        if (trackPath) {
          const res = await invoke<TrackTranscriptionData>('detect_track_transcription', {
            path: trackPath,
            trackId: trackId || null,
            forceRecompute: false,
          });
          if (isMounted) setData(res);
        }
      } catch (err: unknown) {
        if (isMounted) setError(errorMessage(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [trackId, trackPath]);

  const index = useMemo(() => buildNoteIndex(data?.notes ?? []), [data]);
  const noteCount = data?.notes.length ?? 0;
  // Notes can extend past the declared duration (e.g. missing metadata); the axis covers them fully.
  const effectiveDurationMs = useMemo(() => {
    const last = index.notes.reduce((end, n) => Math.max(end, n.onset_ms + n.duration_ms), 0);
    return Math.max(durationMs, last);
  }, [index, durationMs]);

  const onViewChange = useCallback(
    (change: PianoRollViewChange) => {
      if (change.pxPerSec !== undefined) setPxPerSec(change.pxPerSec);
      if (change.mode !== undefined) setMode(change.mode);
      if (change.rowHeight !== undefined) setRowHeight(change.rowHeight);
    },
    [setPxPerSec, setRowHeight],
  );

  const stepRowHeight = (direction: 1 | -1) =>
    setRowHeight((h) => clampRowHeight((h ?? DEFAULT_ROW_HEIGHT) + direction * ROW_HEIGHT_STEP));

  const labels = useMemo(
    () => ({ start: t.analysis.noteStart, length: t.analysis.noteLength, velocity: t.analysis.noteVelocity }),
    [t.analysis.noteStart, t.analysis.noteLength, t.analysis.noteVelocity],
  );

  const handleExportMidi = async () => {
    if (!trackId) return;
    setExportError(null);
    try {
      const dest = await invoke<string | null>('pick_save_destination', {
        defaultName: `${safeFileStem(displayTitle)}_transcription.mid`,
        extension: 'mid',
      });
      if (!dest) return;
      const saved = await invoke<string>('export_transcription_midi', { trackId, exportPath: dest });
      onNotify?.(fmt(t.analysis.midiSaved, saved));
    } catch (err: unknown) {
      const message = `${t.common.errorPrefix} ${errorMessage(err)}`;
      setExportError(message);
      onNotify?.(message, true);
    }
  };

  const canExport = Boolean(trackId) && noteCount > 0;

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4.5 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-purple-400/35 bg-purple-400/20 text-purple-400"
          >
            <Piano size={18} />
          </div>
          <div>
            <span className="text-sm font-extrabold text-fg">{t.analysis.pianoRollTitle}</span>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
              {data ? fmt(t.analysis.detectedNotes, String(noteCount), data.bpm.toFixed(1)) : t.analysis.analyzingNotes}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'follow' ? 'free' : 'follow'))}
            aria-pressed={mode === 'follow'}
            title={t.analysis.followModeTooltip}
            className={cn(
              'border',
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
              mode === 'follow' ? 'bg-pink-500/15 text-pink-400' : 'bg-white/5 text-fg-secondary',
              mode === 'follow' ? 'border-pink-500/40' : 'border-white/10',
            )}
          >
            <Crosshair size={14} />
            <span>{t.analysis.followMode}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            aria-pressed={showLabels}
            title={t.analysis.noteLabelsTooltip}
            className={cn(
              'border',
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
              showLabels ? 'bg-purple-400/15 text-purple-400' : 'bg-white/5 text-fg-secondary',
              showLabels ? 'border-purple-400/40' : 'border-white/10',
            )}
          >
            <Type size={14} />
            <span>{t.analysis.noteLabels}</span>
          </button>

          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setPxPerSec((p) => clamp(Math.round(p / ZOOM_STEP), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
              className={ICON_BUTTON}
              title={t.analysis.zoomOut}
            >
              <ZoomOut size={14} />
            </button>
            <span className="px-1.5 py-0 font-mono text-xs text-slate-300">
              {Math.round(pxPerSec)}px/s
            </span>
            <button
              type="button"
              onClick={() => setPxPerSec((p) => clamp(Math.round(p * ZOOM_STEP), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
              className={ICON_BUTTON}
              title={t.analysis.zoomIn}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button type="button" onClick={() => stepRowHeight(-1)} className={ICON_BUTTON} title={t.analysis.rowHeightLess}>
              <ChevronsUpDown size={14} className="scale-y-70" />
            </button>
            <button
              type="button"
              onClick={() => setRowHeight(null)}
              title={t.analysis.rowHeightReset}
              className={cn(ICON_BUTTON, 'min-w-11 justify-center px-1.5 py-0 font-mono text-xs', rowHeight !== null && 'text-slate-300')}
            >
              {rowHeight === null ? t.analysis.rowHeightAuto : `${Math.round(rowHeight)}px`}
            </button>
            <button type="button" onClick={() => stepRowHeight(1)} className={ICON_BUTTON} title={t.analysis.rowHeightMore}>
              <ChevronsUpDown size={14} className="scale-y-130" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportMidi}
            disabled={!canExport}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border border-pink-500/40 bg-pink-500/20 px-3.5 py-2 text-ui font-semibold text-pink-400',
              canExport ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50',
            )}
            title={t.analysis.exportMidiTooltip}
          >
            <Download size={14} />
            <span>{t.analysis.downloadMidi}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/6 p-2 text-fg-secondary"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {exportError && !onNotify && (
        <div role="alert" className="text-ui text-red-300">
          {exportError}
        </div>
      )}

      <div className="relative min-h-80 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-deep">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-deep/85">
            <Sparkles size={28} className="animate-spin text-purple-400" />
            <p className="m-0 text-sm text-slate-300">{t.analysis.transcribingNotes}</p>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="m-5 rounded-xl border border-accent-red/30 bg-accent-red/15 px-4.5 py-3.5 text-sm text-red-300"
          >
            {error}
          </div>
        )}
        {!error && data && noteCount === 0 && (
          <p className="absolute inset-0 m-0 flex items-center justify-center text-sm text-fg-secondary">
            {t.analysis.noNotesDetected}
          </p>
        )}
        {!error && (
          <PianoRollCanvas
            index={index}
            bpm={data?.bpm ?? 0}
            durationMs={effectiveDurationMs}
            isPlaying={isPlaying}
            speed={speed}
            fallbackPositionMs={currentTimeMs}
            pxPerSec={pxPerSec}
            mode={mode}
            rowHeight={rowHeight}
            showLabels={showLabels}
            onViewChange={onViewChange}
            onSeek={onSeek}
            labels={labels}
            ariaLabel={t.analysis.pianoRollTitle}
          />
        )}
      </div>
    </div>
  );
});
