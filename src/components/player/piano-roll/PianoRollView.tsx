import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Crosshair, Download, Type, Piano, Sparkles, X, ZoomIn, ZoomOut } from '../../ui/icons';
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
import { Button, Callout, Card, Chip, IconButton } from '../../ui';

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
      <Card padding="none" className="flex flex-wrap items-center justify-between gap-3 px-4.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent-purple/15 text-accent-purple">
            <Piano size={18} />
          </div>
          <div>
            <span className="text-sm font-extrabold text-fg">{t.analysis.pianoRollTitle}</span>
            <p className="mt-0.5 text-xs text-fg-secondary">
              {data ? fmt(t.analysis.detectedNotes, String(noteCount), data.bpm.toFixed(1)) : t.analysis.analyzingNotes}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Chip pressed={mode === 'follow'} onClick={() => setMode((m) => (m === 'follow' ? 'free' : 'follow'))} title={t.analysis.followModeTooltip}>
            <Crosshair size={14} />
            {t.analysis.followMode}
          </Chip>
          <Chip tone="purple" pressed={showLabels} onClick={() => setShowLabels((v) => !v)} title={t.analysis.noteLabelsTooltip}>
            <Type size={14} />
            {t.analysis.noteLabels}
          </Chip>

          <div className="flex items-center rounded-lg border border-line bg-white/5 p-0.5">
            <IconButton
              size="sm"
              label={t.analysis.zoomOut}
              onClick={() => setPxPerSec((p) => clamp(Math.round(p / ZOOM_STEP), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
            >
              <ZoomOut size={14} />
            </IconButton>
            <span className="px-1.5 font-mono text-xs text-fg-secondary">{Math.round(pxPerSec)}px/s</span>
            <IconButton
              size="sm"
              label={t.analysis.zoomIn}
              onClick={() => setPxPerSec((p) => clamp(Math.round(p * ZOOM_STEP), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
            >
              <ZoomIn size={14} />
            </IconButton>
          </div>

          <div className="flex items-center rounded-lg border border-line bg-white/5 p-0.5">
            <IconButton size="sm" label={t.analysis.rowHeightLess} onClick={() => stepRowHeight(-1)}>
              <ChevronsUpDown size={14} className="scale-y-70" />
            </IconButton>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRowHeight(null)}
              title={t.analysis.rowHeightReset}
              className={cn('min-w-11 px-1.5 font-mono', rowHeight !== null && 'text-fg-secondary')}
            >
              {rowHeight === null ? t.analysis.rowHeightAuto : `${Math.round(rowHeight)}px`}
            </Button>
            <IconButton size="sm" label={t.analysis.rowHeightMore} onClick={() => stepRowHeight(1)}>
              <ChevronsUpDown size={14} className="scale-y-130" />
            </IconButton>
          </div>

          <Button variant="tinted" tone="pink" onClick={handleExportMidi} disabled={!canExport} title={t.analysis.exportMidiTooltip}>
            <Download size={14} />
            {t.analysis.downloadMidi}
          </Button>

          {onClose && (
            <IconButton variant="secondary" label={t.common.close} onClick={onClose}>
              <X size={16} />
            </IconButton>
          )}
        </div>
      </Card>

      {exportError && !onNotify && (
        <div role="alert" className="text-ui text-accent-red">
          {exportError}
        </div>
      )}

      <div className="relative min-h-80 flex-1 overflow-hidden rounded-2xl border border-line bg-deep">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-deep/85">
            <Sparkles size={28} className="text-accent-purple motion-safe:animate-spin" />
            <p className="text-sm text-fg-secondary">{t.analysis.transcribingNotes}</p>
          </div>
        )}
        {error && (
          <Callout tone="red" role="alert" className="m-5">
            {error}
          </Callout>
        )}
        {!error && data && noteCount === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-fg-secondary">
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
