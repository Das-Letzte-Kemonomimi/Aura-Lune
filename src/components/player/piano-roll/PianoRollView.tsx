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

export interface PianoRollViewProps {
  currentLang?: Language;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  durationMs?: number;
  isPlaying: boolean;
  /** Prędkość czasu źródła względem rzeczywistego (tempo × rate przy aktywnym DSP). */
  speed?: number;
  /** Pozycja do czasu pierwszego statusu na żywo; sama pozycja nie wymusza renderu widoku. */
  currentTimeMs: number;
  onSeek: (positionMs: number) => void;
  /** Komunikaty (toasty) dla eksportu MIDI. */
  onNotify?: (message: string, isError?: boolean) => void;
  onClose?: () => void;
}

const ZOOM_STEP = 1.25;

const parsePxPerSec = (raw: string): number | undefined => {
  const v = Number(raw);
  return Number.isFinite(v) ? clamp(v, MIN_PX_PER_SEC, MAX_PX_PER_SEC) : undefined;
};
/** `null` = automatyczna wysokość wiersza. */
const parseRowHeight = (raw: string): number | null | undefined => {
  if (raw === 'auto') return null;
  const v = Number(raw);
  return Number.isFinite(v) ? clampRowHeight(v) : undefined;
};

const iconButton: React.CSSProperties = {
  padding: '4px',
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  display: 'flex',
};

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
  // Szerokość (zoom czasu) i wysokość wierszy zapamiętujemy między sesjami.
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
  // Nuty mogą wykraczać poza deklarowany czas trwania (np. brak metadanych) — oś obejmuje je w całości.
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'rgba(192, 132, 252, 0.2)',
              border: '1px solid rgba(192, 132, 252, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
            }}
          >
            <Piano size={18} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>{t.analysis.pianoRollTitle}</span>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              {data ? fmt(t.analysis.detectedNotes, String(noteCount), data.bpm.toFixed(1)) : t.analysis.analyzingNotes}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'follow' ? 'free' : 'follow'))}
            aria-pressed={mode === 'follow'}
            title={t.analysis.followModeTooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: mode === 'follow' ? '#f472b6' : '#94a3b8',
              background: mode === 'follow' ? 'rgba(236, 72, 153, 0.16)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${mode === 'follow' ? 'rgba(236, 72, 153, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            }}
          >
            <Crosshair size={14} />
            <span>{t.analysis.followMode}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            aria-pressed={showLabels}
            title={t.analysis.noteLabelsTooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: showLabels ? '#c084fc' : '#94a3b8',
              background: showLabels ? 'rgba(192, 132, 252, 0.16)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${showLabels ? 'rgba(192, 132, 252, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            }}
          >
            <Type size={14} />
            <span>{t.analysis.noteLabels}</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => setPxPerSec((p) => clamp(Math.round(p / ZOOM_STEP), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
              style={iconButton}
              title={t.analysis.zoomOut}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', padding: '0 6px', color: '#cbd5e1' }}>
              {Math.round(pxPerSec)}px/s
            </span>
            <button
              type="button"
              onClick={() => setPxPerSec((p) => clamp(Math.round(p * ZOOM_STEP), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
              style={iconButton}
              title={t.analysis.zoomIn}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button type="button" onClick={() => stepRowHeight(-1)} style={iconButton} title={t.analysis.rowHeightLess}>
              <ChevronsUpDown size={14} style={{ transform: 'scaleY(0.7)' }} />
            </button>
            <button
              type="button"
              onClick={() => setRowHeight(null)}
              title={t.analysis.rowHeightReset}
              style={{
                ...iconButton,
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                padding: '0 6px',
                color: rowHeight === null ? '#94a3b8' : '#cbd5e1',
                minWidth: '44px',
                justifyContent: 'center',
              }}
            >
              {rowHeight === null ? t.analysis.rowHeightAuto : `${Math.round(rowHeight)}px`}
            </button>
            <button type="button" onClick={() => stepRowHeight(1)} style={iconButton} title={t.analysis.rowHeightMore}>
              <ChevronsUpDown size={14} style={{ transform: 'scaleY(1.3)' }} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportMidi}
            disabled={!canExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '10px',
              background: 'rgba(236, 72, 153, 0.2)',
              border: '1px solid rgba(236, 72, 153, 0.4)',
              color: '#f472b6',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: canExport ? 'pointer' : 'not-allowed',
              opacity: canExport ? 1 : 0.5,
            }}
            title={t.analysis.exportMidiTooltip}
          >
            <Download size={14} />
            <span>{t.analysis.downloadMidi}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {exportError && !onNotify && (
        <div role="alert" style={{ color: '#fca5a5', fontSize: '0.8rem' }}>
          {exportError}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: '320px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: '#090a12',
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: 'rgba(9, 10, 18, 0.85)',
              zIndex: 10,
            }}
          >
            <Sparkles size={28} color="#c084fc" style={{ animation: 'spin 1.5s linear infinite' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{t.analysis.transcribingNotes}</p>
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              margin: '20px',
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}
        {!error && data && noteCount === 0 && (
          <p style={{ position: 'absolute', inset: 0, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
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
