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
  currentTimeMs,
  durationMs: _durationMs,
  pitchSemitones = 0,
  onSeek,
  onSetLoop,
  onClose,
  currentLang = 'en',
}) => {
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
  const bars = useMemo(() => groupByBar(cells), [cells]);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', width: '100%' }}>
      {/* Pasek górny pod-widoku */}
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
              background: 'rgba(244, 63, 94, 0.2)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f43f5e',
            }}
          >
            <Music size={18} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
              {t.player.chordTimelineTitle}
            </span>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              {data ? `${t.dsp.keyLabel}: ${data.key} (${data.camelot}) • ${data.bpm.toFixed(1)} BPM` : t.player.harmonicAnalysis}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pitchSemitones !== 0 && (
            <button
              onClick={() => setShowTransposed(!showTransposed)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: showTransposed ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: showTransposed ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                color: showTransposed ? '#fbbf24' : '#94a3b8',
              }}
              title={t.player.transposeToggleTooltip}
            >
              {fmt(t.player.transposition, pitchSemitones > 0 ? `+${pitchSemitones}` : String(pitchSemitones), showTransposed ? t.player.transposedOn : t.player.transposedOrig)}
            </button>
          )}

          <button
            onClick={handleRecompute}
            disabled={loading}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={t.player.recomputeChordsTooltip}
          >
            <RotateCcw size={16} style={loading ? { animation: 'spin 1.5s linear infinite' } : undefined} />
          </button>

          <button
            onClick={() => handleExport(exportFormat)}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={fmt(t.player.exportChords, exportFormat.toUpperCase())}
          >
            <Download size={16} />
          </button>

          {onClose && (
            <button
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

      {/* Aktualny i następny akord */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderRadius: '16px',
          background: `linear-gradient(135deg, ${activeColor}1f, rgba(15, 20, 34, 0.4))`,
          border: `1px solid ${activeColor}55`,
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>
              {t.player.currentChord}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span
                style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  color: activeColor,
                  fontFamily: 'var(--font-mono)',
                  textShadow: `0 0 22px ${activeColor}80`,
                  lineHeight: 1,
                }}
              >
                {currentDisplayChord}
              </span>
              {transposeBy !== 0 && activeChord && (
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                  ({t.player.transposedOrig.toLowerCase()} {activeChord.chord})
                </span>
              )}
            </div>
          </div>

          {nextChord && (
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>
                {t.player.chordNext}
              </div>
              <span
                style={{
                  fontSize: '1.7rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: TONE_COLORS[chordTone(nextChord.quality)],
                  opacity: 0.9,
                }}
              >
                {displayChord(nextChord.chord)}
              </span>
            </div>
          )}
        </div>

        {activeChord && onSetLoop && (
          <button
            onClick={() => onSetLoop(activeChord.start_ms, activeChord.end_ms)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#e2e8f0',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Repeat size={14} />
            <span>{t.player.loopChord}</span>
          </button>
        )}
      </div>

      {/* Oś czasu: przegląd całego utworu + siatka taktów */}
      <div style={{ flex: 1, minHeight: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '12px' }}>
            <Sparkles size={28} color="#f43f5e" style={{ animation: 'spin 1.5s linear infinite' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
              {t.player.detectingChords}
            </p>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        ) : cells.length > 0 ? (
          <>
            <ChordOverview cells={cells} currentTimeMs={currentTimeMs} onSeek={onSeek} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.72rem', color: '#94a3b8' }}>
              {legend.map(([tone, label]) => (
                <span key={tone} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: TONE_COLORS[tone] }} />
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
          <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.85rem' }}>
            {t.analysis.noChordsDetected}
          </div>
        )}
      </div>

      {/* Modal eksportu */}
      {exportOutput && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setExportOutput(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#0f1422',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              maxHeight: '80vh',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                {fmt(t.analysis.exportChordsTitle, exportFormat.toUpperCase())}
              </h3>
              <button
                onClick={() => setExportOutput(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              readOnly
              value={exportOutput}
              style={{
                width: '100%',
                height: '220px',
                background: '#090a12',
                color: '#f8fafc',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                resize: 'none',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportOutput);
                  setExportOutput(null);
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f43f5e, #c084fc)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
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
