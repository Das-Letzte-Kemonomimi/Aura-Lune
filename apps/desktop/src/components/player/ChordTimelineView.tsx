import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Music,
  RotateCcw,
  Download,
  Edit3,
  Check,
  X,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { TrackChordsData } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';

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
  const [editingChordIdx, setEditingChordIdx] = useState<number | null>(null);
  const [editChordValue, setEditChordValue] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'chordpro' | 'text' | 'json'>('text');
  const [exportOutput, setExportOutput] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Znajdź aktywny akord dla aktualnego czasu odtwarzania
  const activeChord = useMemo(() => {
    if (!data || !data.chords.length) return null;
    return data.chords.find(
      (c) => currentTimeMs >= c.start_ms && currentTimeMs < c.end_ms
    );
  }, [data, currentTimeMs]);

  // Autoprzewijanie osi czasu za pozycją odtwarzania
  useEffect(() => {
    if (!activeChord || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const activeEl = container.querySelector('.chord-active-block') as HTMLElement | null;
    if (activeEl) {
      const containerLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const elLeft = activeEl.offsetLeft;
      const elWidth = activeEl.clientWidth;

      if (elLeft < containerLeft || elLeft + elWidth > containerLeft + containerWidth) {
        container.scrollTo({
          left: elLeft - containerWidth / 2 + elWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [activeChord]);

  const handleSaveOverride = async (idx: number) => {
    if (!data || !trackId) return;
    const updated = [...data.chords];
    updated[idx] = { ...updated[idx], chord: editChordValue };
    setData({ ...data, chords: updated });
    setEditingChordIdx(null);

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

  const currentDisplayChord = activeChord
    ? showTransposed && pitchSemitones !== 0
      ? transposeChordName(activeChord.chord, Math.round(pitchSemitones))
      : activeChord.chord
    : '—';

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
              {t.player.transposition
                .replace('{0}', pitchSemitones > 0 ? `+${pitchSemitones}` : String(pitchSemitones))
                .replace('{1}', showTransposed ? t.player.transposedOn : t.player.transposedOrig)}
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
            title={t.player.exportChords.replace('{0}', exportFormat.toUpperCase())}
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

      {/* Duży wskaźnik aktualnego akordu (Hero Banner) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(168, 85, 247, 0.12))',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 700 }}>
            {t.player.currentChord}
          </span>
          <span
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              color: '#f43f5e',
              fontFamily: 'var(--font-mono)',
              textShadow: '0 0 20px rgba(244, 63, 94, 0.5)',
              lineHeight: 1,
            }}
          >
            {currentDisplayChord}
          </span>
          {pitchSemitones !== 0 && showTransposed && activeChord && (
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              ({t.player.transposedOrig.toLowerCase()} {activeChord.chord})
            </span>
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
              background: 'rgba(244, 63, 94, 0.18)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fda4af',
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

      {/* Oś czasu (Timeline) */}
      <div style={{ flex: 1, minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
        ) : data && data.chords.length > 0 ? (
          <div
            ref={scrollContainerRef}
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', minWidth: 'max-content', padding: '8px 4px' }}>
              {data.chords.map((chordSeg, idx) => {
                const isActive = currentTimeMs >= chordSeg.start_ms && currentTimeMs < chordSeg.end_ms;
                const isMinor = chordSeg.quality.includes('min');
                const is7th = chordSeg.quality.includes('7');
                const displayLabel = showTransposed && pitchSemitones !== 0
                  ? transposeChordName(chordSeg.chord, Math.round(pitchSemitones))
                  : chordSeg.chord;

                return (
                  <div
                    key={`${chordSeg.start_ms}-${idx}`}
                    onClick={() => onSeek(chordSeg.start_ms)}
                    className={isActive ? 'chord-active-block' : undefined}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      minWidth: '110px',
                      height: '115px',
                      transition: 'all 0.18s ease',
                      border: isActive
                        ? '2px solid #f43f5e'
                        : isMinor
                        ? '1px solid rgba(168, 85, 247, 0.35)'
                        : is7th
                        ? '1px solid rgba(245, 158, 11, 0.35)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      background: isActive
                        ? 'rgba(244, 63, 94, 0.22)'
                        : isMinor
                        ? 'rgba(88, 28, 135, 0.25)'
                        : is7th
                        ? 'rgba(120, 53, 15, 0.25)'
                        : 'rgba(255, 255, 255, 0.04)',
                      boxShadow: isActive ? '0 0 20px rgba(244, 63, 94, 0.4)' : 'none',
                      transform: isActive ? 'scale(1.04)' : 'scale(1)',
                      zIndex: isActive ? 2 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
                      <span>Takt {chordSeg.bar}</span>
                      <span>{(chordSeg.confidence * 100).toFixed(0)}%</span>
                    </div>

                    <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: '#f8fafc' }}>
                      {editingChordIdx === idx ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editChordValue}
                            onChange={(e) => setEditChordValue(e.target.value)}
                            style={{
                              width: '56px',
                              padding: '2px 4px',
                              background: '#090a12',
                              border: '1px solid #f43f5e',
                              borderRadius: '6px',
                              textAlign: 'center',
                              fontSize: '0.78rem',
                              color: '#ffffff',
                              fontFamily: 'var(--font-mono)',
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveOverride(idx)}
                            style={{
                              padding: '2px',
                              background: 'none',
                              border: 'none',
                              color: '#34d399',
                              cursor: 'pointer',
                            }}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <span>{displayLabel}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
                      <span>
                        {Math.floor(chordSeg.start_ms / 1000 / 60)}:
                        {String(Math.floor((chordSeg.start_ms / 1000) % 60)).padStart(2, '0')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingChordIdx(idx);
                          setEditChordValue(chordSeg.chord);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title={t.common.edit}
                      >
                        <Edit3 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.85rem' }}>
            Brak wykrytych akordów dla tego utworu.
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
                Eksport akordów ({exportFormat.toUpperCase()})
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
