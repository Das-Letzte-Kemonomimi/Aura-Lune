import React, { useState, useEffect, useMemo } from 'react';
import {
  Music,
  RotateCcw,
  Download,
  X,
  Repeat,
  Sparkles,
} from '../ui/icons';
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
  transposeChordName,
  type ChordCell,
  TONE_COLORS,
  type ChordTone,
} from '../../utils/chordChart';
import { getTransposedKey } from '../../utils/harmonicMixing';
import { ChordChart, ChordOverview } from './ChordChart';
import { cn } from '../../utils/cn';
import { Button, Callout, Card, Chip, IconButton, ModalBody, ModalFooter, ModalHeader, ModalShell, TextArea } from '../ui';

export interface ChordTimelineViewProps {
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  trackArtist?: string;
  currentTimeMs: number;
  durationMs?: number;
  pitchSemitones?: number;
  playbackSpeed?: number;
  onSeek: (positionMs: number) => void;
  onSetLoop?: (startMs: number, endMs: number) => void;
  onClose?: () => void;
  currentLang?: Language;
}

export const ChordTimelineView: React.FC<ChordTimelineViewProps> = ({
  trackId,
  trackPath,
  trackTitle,
  trackArtist,
  currentTimeMs: currentTimeMsProp,
  durationMs,
  pitchSemitones = 0,
  playbackSpeed = 1,
  onSeek,
  onSetLoop,
  onClose,
  currentLang = 'en',
}) => {
  // The live position is read here, not in the modal, so the modal does not render on every tick.
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

  // Fetch the data or analyse
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

  // Force a recalculation
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

  const speed = playbackSpeed > 0 ? playbackSpeed : 1;
  const roundedSemitones = Math.round(pitchSemitones);
  const hasPitchShift = roundedSemitones !== 0;
  const hasSpeedChange = Math.abs(speed - 1) > 0.005;
  const hasDspAdjustment = hasPitchShift || hasSpeedChange;

  const transposeBy = showTransposed ? roundedSemitones : 0;
  const effectiveSpeed = showTransposed ? speed : 1;
  const displayChord = (chord: string) => transposeChordName(chord, transposeBy);

  const transposedKey = data && transposeBy !== 0 ? getTransposedKey(data.key || data.camelot, transposeBy) : null;
  const displayKey = transposedKey ? transposedKey.keyName : data?.key;
  const displayCamelot = transposedKey ? transposedKey.camelot : data?.camelot;
  const displayBpm = data ? data.bpm * effectiveSpeed : 0;

  const handleSaveOverride = async () => {
    if (!data || !trackId || !editingCell) return;
    const value = editValue.trim();
    const cell = editingCell;
    setEditingCell(null);
    if (!value || value === cell.chord) return;
    // The change applies to all merged detections of this chord in the bar.
    const updated = data.chords.map((c, i) => (cell.idxs.includes(i) ? { ...c, chord: value } : c));
    setData({ ...data, chords: updated });

    try {
      await invoke('save_chord_overrides', {
        trackId,
        overridesJson: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Failed to save the chord override:', err);
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
      {/* Sub-view top bar */}
      <Card padding="none" className="flex flex-wrap items-center justify-between gap-3 px-4.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent-pink/15 text-accent-pink">
            <Music size={18} />
          </div>
          <div>
            <span className="text-sm font-extrabold text-fg">
              {t.player.chordTimelineTitle}
            </span>
            <p className="mt-0.5 text-xs text-fg-secondary">
              {data
                ? `${t.dsp.keyLabel}: ${displayKey} (${displayCamelot}) • ${displayBpm.toFixed(1)} BPM${effectiveSpeed !== 1 ? ` (${effectiveSpeed.toFixed(2)}×)` : ''}`
                : t.player.harmonicAnalysis}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasDspAdjustment && (
            <Chip
              tone="amber"
              pressed={showTransposed}
              onClick={() => setShowTransposed(!showTransposed)}
              title={t.player.transposeToggleTooltip}
              className="px-3.5 py-2 text-ui"
            >
              {hasPitchShift && !hasSpeedChange
                ? fmt(t.player.transposition, roundedSemitones > 0 ? `+${roundedSemitones}` : String(roundedSemitones), showTransposed ? t.player.transposedOn : t.player.transposedOrig)
                : hasPitchShift && hasSpeedChange
                  ? `${roundedSemitones > 0 ? `+${roundedSemitones}` : roundedSemitones} st · ${speed.toFixed(2)}× (${showTransposed ? t.player.transposedOn : t.player.transposedOrig})`
                  : fmt(t.player.tempoAdaptation, `${speed.toFixed(2)}×`, showTransposed ? t.player.transposedOn : t.player.transposedOrig)}
            </Chip>
          )}

          <IconButton variant="secondary" label={t.player.recomputeChordsTooltip} onClick={handleRecompute} disabled={loading}>
            <RotateCcw size={16} className={cn(loading && 'motion-safe:animate-spin')} />
          </IconButton>
          <IconButton variant="secondary" label={fmt(t.player.exportChords, exportFormat.toUpperCase())} onClick={() => handleExport(exportFormat)}>
            <Download size={16} />
          </IconButton>
          {onClose && (
            <IconButton variant="secondary" label={t.common.close} onClick={onClose}>
              <X size={16} />
            </IconButton>
          )}
        </div>
      </Card>

      {/* Current and next chord */}
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
          <Button onClick={() => onSetLoop(activeChord.start_ms, activeChord.end_ms)}>
            <Repeat size={14} />
            {t.player.loopChord}
          </Button>
        )}
      </div>

      {/* Timeline: an overview of the whole track + the bar grid */}
      <div className="flex min-h-55 flex-1 flex-col gap-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12">
            <Sparkles size={28} className="animate-spin text-accent-pink" />
            <p className="text-sm text-fg-secondary">
              {t.player.detectingChords}
            </p>
          </div>
        ) : error ? (
          <Callout tone="red" role="alert" className="text-sm">
            {error}
          </Callout>
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
              timeScale={effectiveSpeed}
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
              saveLabel={t.common.save}
            />
          </>
        ) : (
          <div className="p-9 text-center text-sm text-fg-secondary">
            {t.analysis.noChordsDetected}
          </div>
        )}
      </div>

      {/* Export modal */}
      {exportOutput && (
        <ModalShell onClose={() => setExportOutput(null)} layer="tool" size="md" labelledBy="chord-export-title">
          <ModalHeader
            titleId="chord-export-title"
            title={fmt(t.analysis.exportChordsTitle, exportFormat.toUpperCase())}
            onClose={() => setExportOutput(null)}
            closeLabel={t.common.close}
          />
          <ModalBody>
            <TextArea
              mono
              readOnly
              aria-label={fmt(t.analysis.exportChordsTitle, exportFormat.toUpperCase())}
              value={exportOutput}
              className="h-55 resize-none"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="primary"
              onClick={() => {
                navigator.clipboard.writeText(exportOutput);
                setExportOutput(null);
              }}
            >
              {t.common.copyToClipboard}
            </Button>
          </ModalFooter>
        </ModalShell>
      )}
    </div>
  );
};
