import React, { useState, useEffect, useMemo } from 'react';
import {
  Music,
  RotateCcw,
  Download,
  X,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { TrackChordsData } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { useLivePositionMs } from '../../state/livePlayback';
import {
  chordTone,
  findActiveCell,
  findNextDistinctCell,
  groupByBar,
  mergeChordSegments,
  type ChordCell,
  TONE_COLORS,
  type ChordTone,
} from '../../utils/chordChart';
import { ChordChart, ChordOverview } from './ChordChart';
import { cn } from '../../utils/cn';

export interface ChordTimelineViewProps {
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  trackArtist?: string;
  currentTimeMs: number;
  durationMs?: number;
  pitchSemitones?: number;
  onSeek: (positionMs: number) => void;
  onSetLoop?: (startMs: number, endMs: number) => void;
  onClose?: () => void;
  currentLang?: Language;
}

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function transposeChordName(chord: string, semitones: number): string {
  if (semitones === 0 || !chord || chord === 'N') return chord;
  let root = chord;
  let remainder = '';

  if (chord.length > 1 && (chord[1] === '#' || chord[1] === 'b')) {
    root = chord.substring(0, 2);
    remainder = chord.substring(2);
  } else {
    root = chord.substring(0, 1);
    remainder = chord.substring(1);
  }

  const idx = CHROMATIC.findIndex(
    (n) => n.toUpperCase() === root.toUpperCase() || (root.toUpperCase() === 'DB' && n === 'C#')
  );
  if (idx === -1) return chord;

  const newIdx = (idx + semitones + 120) % 12;
  return `${CHROMATIC[newIdx]}${remainder}`;
}

export const ChordTimelineView: React.FC<ChordTimelineViewProps> = ({
  trackId,
  trackPath,
  trackTitle,
  trackArtist,
  currentTimeMs: currentTimeMsProp,
  durationMs,
  pitchSemitones = 0,
  onSeek,
  onSetLoop,
  onClose,
  currentLang = 'en',
}) => {
  // Pozycja na żywo czytana tutaj, a nie w modalu — modal nie renderuje się przy każdym ticku.
  const currentTimeMs = useLivePositionMs(currentTimeMsProp);
  const t = getTranslations(currentLang);
  const [data, setData] = useState<TrackChordsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransposed, setShowTransposed] = useState<boolean>(true);
  const [editingCell, setEditingCell] = useState<ChordCell | null>(null);
  const [editValue, setEditChordValue] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'chordpro' | 'text' | 'json'>('text');
  const [exportOutput, setExportOutput] = useState<string | null>(null);

  // Pobranie danych lub analiza
  useEffect(() => {
    if (!trackId && !trackPath) return;

    let isMounted = true;
    const fetchChords = async () => {
      setLoading(true);
      setError(null);
      try {
        if (trackId) {
          const cached = await invoke<TrackChordsData | null>('get_cached_chords', { trackId });
          if (cached && isMounted) {
            setData(cached);
            setLoading(false);
            return;
          }
        }

        if (trackPath) {
          const analyzed = await invoke<TrackChordsData>('detect_track_chords', {
            path: trackPath,
            trackId: trackId || null,
            forceRecompute: false,
          });
          if (isMounted) {
            setData(analyzed);
          }
        }
      } catch (err) {
        if (isMounted) setError(String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchChords();
    return () => {
      isMounted = false;
    };
  }, [trackId, trackPath]);

  // Wymuszenie ponownej kalkulacji
  const handleRecompute = async () => {
    if (!trackPath) return;
    setLoading(true);
    setError(null);
    try {
      const analyzed = await invoke<TrackChordsData>('detect_track_chords', {
        path: trackPath,
        trackId: trackId || null,
        forceRecompute: true,
      });
      setData(analyzed);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const cells = useMemo(() => mergeChordSegments(data?.chords ?? []), [data]);
  const bars = useMemo(() => groupByBar(cells, data?.bpm), [cells, data?.bpm]);
  const activeIdx = findActiveCell(cells, currentTimeMs);
  const activeChord = activeIdx >= 0 ? cells[activeIdx] : null;
  const nextChord = findNextDistinctCell(cells, activeIdx);

  const transposeBy = showTransposed ? Math.round(pitchSemitones) : 0;
  const displayChord = (chord: string) => transposeChordName(chord, transposeBy);

  const handleSaveOverride = async () => {
    if (!data || !trackId || !editingCell) return;
    const value = editValue.trim();
    const cell = editingCell;
    setEditingCell(null);
    if (!value || value === cell.chord) return;
    // Zmiana dotyczy wszystkich scalonych detekcji tego akordu w takcie.
    const updated = data.chords.map((c, i) => (cell.idxs.includes(i) ? { ...c, chord: value } : c));
    setData({ ...data, chords: updated });

    try {
      await invoke('save_chord_overrides', {
        trackId,
        overridesJson: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Błąd zapisu nadpisanego akordu:', err);
    }
  };

  const handleExport = async (fmt: 'chordpro' | 'text' | 'json') => {
    if (!trackId) return;
    setExportFormat(fmt);
    try {
      const out = await invoke<string>('export_chords_file', {
        trackId,
        format: fmt,
        title: trackTitle,
        artist: trackArtist,
      });
      setExportOutput(out);
    } catch (err) {
      setError(String(err));
    }
  };

  const currentDisplayChord = activeChord ? displayChord(activeChord.chord) : '—';
  const activeColor = TONE_COLORS[activeChord ? chordTone(activeChord.quality) : 'none'];

  const legend: Array<[ChordTone, string]> = [
    ['major', t.player.chordLegendMajor],
    ['minor', t.player.chordLegendMinor],
    ['seventh', t.player.chordLegendSeventh],
    ['other', t.player.chordLegendOther],
  ];

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Pasek górny pod-widoku */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4.5 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-accent-pink/35 bg-accent-pink/20 text-accent-pink"
          >
            <Music size={18} />
          </div>
          <div>
            <span className="text-sm font-extrabold text-fg">
              {t.player.chordTimelineTitle}
            </span>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
              {data ? `${t.dsp.keyLabel}: ${data.key} (${data.camelot}) • ${data.bpm.toFixed(1)} BPM` : t.player.harmonicAnalysis}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pitchSemitones !== 0 && (
            <button
              onClick={() => setShowTransposed(!showTransposed)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-ui font-semibold',
                showTransposed ? 'border-accent-amber/40 bg-accent-amber/20 text-amber-400' : 'border-white/10 bg-white/4 text-fg-secondary',
              )}
              title={t.player.transposeToggleTooltip}
            >
              {fmt(t.player.transposition, pitchSemitones > 0 ? `+${pitchSemitones}` : String(pitchSemitones), showTransposed ? t.player.transposedOn : t.player.transposedOrig)}
            </button>
          )}

          <button
            onClick={handleRecompute}
            disabled={loading}
            className={cn(
              'flex items-center justify-center rounded-lg border border-white/10 bg-white/6 p-2 text-fg-secondary',
              loading ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
            title={t.player.recomputeChordsTooltip}
          >
            <RotateCcw size={16} style={loading ? { animation: 'spin 1.5s linear infinite' } : undefined} />
          </button>

          <button
            onClick={() => handleExport(exportFormat)}
            className="flex items-center justify-center rounded-lg border border-white/10 bg-white/6 p-2 text-fg-secondary"
            title={fmt(t.player.exportChords, exportFormat.toUpperCase())}
          >
            <Download size={16} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/6 p-2 text-fg-secondary"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Aktualny i następny akord */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
        style={{
          background: `linear-gradient(135deg, ${activeColor}1f, rgba(15, 20, 34, 0.4))`,
          border: `1px solid ${activeColor}55`,
        }}
      >
        <div className="flex flex-wrap items-center gap-7">
          <div>
            <div className="mb-1 text-xxs font-bold tracking-wider text-fg-secondary uppercase">
              {t.player.currentChord}
            </div>
            <div className="flex items-baseline gap-2.5">
              <span
                className="font-mono text-5xl leading-none font-black"
                style={{ color: activeColor, textShadow: `0 0 22px ${activeColor}80` }}
              >
                {currentDisplayChord}
              </span>
              {transposeBy !== 0 && activeChord && (
                <span className="font-mono text-sm text-fg-secondary">
                  ({t.player.transposedOrig.toLowerCase()} {activeChord.chord})
                </span>
              )}
            </div>
          </div>

          {nextChord && (
            <div>
              <div className="mb-1 text-xxs font-bold tracking-wider text-fg-secondary uppercase">
                {t.player.chordNext}
              </div>
              <span
                className="font-mono text-3xl font-extrabold opacity-90"
                style={{ color: TONE_COLORS[chordTone(nextChord.quality)] }}
              >
                {displayChord(nextChord.chord)}
              </span>
            </div>
          )}
        </div>

        {activeChord && onSetLoop && (
          <button
            onClick={() => onSetLoop(activeChord.start_ms, activeChord.end_ms)}
            className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/7 px-3.5 py-2 text-ui font-bold text-slate-200"
          >
            <Repeat size={14} />
            <span>{t.player.loopChord}</span>
          </button>
        )}
      </div>

      {/* Oś czasu: przegląd całego utworu + siatka taktów */}
      <div className="flex min-h-55 flex-1 flex-col gap-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12">
            <Sparkles size={28} className="animate-spin text-accent-pink" />
            <p className="m-0 text-sm text-slate-300">
              {t.player.detectingChords}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-accent-red/30 bg-accent-red/15 px-4.5 py-3.5 text-sm text-red-300">
            {error}
          </div>
        ) : cells.length > 0 ? (
          <>
            <ChordOverview
              cells={cells}
              currentTimeMs={currentTimeMs}
              onSeek={onSeek}
              durationMs={durationMs}
            />
            <div className="flex flex-wrap gap-3.5 text-xs text-fg-secondary">
              {legend.map(([tone, label]) => (
                <span key={tone} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: TONE_COLORS[tone] }} />
                  {label}
                </span>
              ))}
            </div>
            <ChordChart
              bars={bars}
              currentTimeMs={currentTimeMs}
              displayChord={displayChord}
              onSeek={onSeek}
              canEdit={!!trackId}
              editingCell={editingCell}
              editValue={editValue}
              onEditValueChange={setEditChordValue}
              onStartEdit={(cell) => {
                setEditingCell(cell);
                setEditChordValue(cell.chord);
              }}
              onCommitEdit={handleSaveOverride}
              onCancelEdit={() => setEditingCell(null)}
              barLabel={(bar) => fmt(t.player.chordBarLabel, bar)}
              lowConfidenceLabel={(pct) => fmt(t.player.chordLowConfidence, pct)}
              editLabel={t.common.edit}
            />
          </>
        ) : (
          <div className="p-9 text-center text-sm text-fg-secondary">
            {t.analysis.noChordsDetected}
          </div>
        )}
      </div>

      {/* Modal eksportu */}
      {exportOutput && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm motion-safe:animate-fade-in"
          onClick={() => setExportOutput(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-140 flex-col gap-3.5 rounded-3xl border border-white/15 bg-ink p-5 shadow-2xl shadow-black/80 motion-safe:animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="m-0 text-base font-extrabold text-fg">
                {fmt(t.analysis.exportChordsTitle, exportFormat.toUpperCase())}
              </h3>
              <button
                onClick={() => setExportOutput(null)}
                className="border-0 bg-transparent text-fg-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              readOnly
              value={exportOutput}
              className="h-55 w-full resize-none rounded-xl border border-white/10 bg-deep p-3 font-mono text-ui text-fg outline-none"
            />

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportOutput);
                  setExportOutput(null);
                }}
                className="rounded-xl border-0 bg-linear-135 from-accent-pink to-purple-400 px-4.5 py-2 text-ui font-bold text-fg"
              >
                {t.common.copyToClipboard}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
