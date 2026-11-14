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
import { invoke } from '@tauri-apps/api/core';
import type { TrackChordsData } from '../types/analysis';

interface ChordTimelineViewProps {
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
  trackTitle = 'Nieznany utwór',
  trackArtist = 'Nieznany wykonawca',
  currentTimeMs,
  durationMs: _durationMs,
  pitchSemitones = 0,
  onSeek,
  onSetLoop,
  onClose,
}) => {
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
        if (isMounted) {
          setError(String(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchChords();
    return () => {
      isMounted = false;
    };
  }, [trackId, trackPath]);

  // Wykrycie bieżącego akordu
  const activeChord = useMemo(() => {
    if (!data || !data.chords.length) return null;
    return data.chords.find(
      (c) => currentTimeMs >= c.start_ms && currentTimeMs < c.end_ms
    ) || null;
  }, [data, currentTimeMs]);

  // Automatyczne centrowanie osi na aktywnym akordzie
  useEffect(() => {
    if (!scrollContainerRef.current || !data) return;
    const activeEl = scrollContainerRef.current.querySelector('.chord-active-block');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeChord, data]);

  const handleRecompute = async () => {
    if (!trackPath) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<TrackChordsData>('detect_track_chords', {
        path: trackPath,
        trackId: trackId || null,
        forceRecompute: true,
      });
      setData(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

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
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-5 text-slate-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Oś Czasu Harmonii i Akordów
            </h2>
            <p className="text-xs text-slate-400">
              {data ? `Tonacja: ${data.key} (${data.camelot}) • ${data.bpm.toFixed(1)} BPM` : 'Analiza harmoniczna...'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {pitchSemitones !== 0 && (
            <button
              onClick={() => setShowTransposed(!showTransposed)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showTransposed
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Przełącz wyświetlanie transponowanych akordów dla aktywnego Pitch Shift"
            >
              Transpozycja: {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st ({showTransposed ? 'Włączona' : 'Oryginalna'})
            </button>
          )}

          <button
            onClick={handleRecompute}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Przelicz akordy ponownie"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => handleExport(exportFormat)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Eksportuj akordy"
          >
            <Download className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Duży wskaźnik aktualnego akordu */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-800/80 to-purple-900/30 border border-slate-700/50 rounded-xl p-4 mb-4">
        <div className="flex items-baseline space-x-4">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Aktualny akord:</span>
          <span className="text-4xl font-extrabold tracking-tight text-pink-400 font-mono drop-shadow-[0_0_12px_rgba(244,114,182,0.4)]">
            {currentDisplayChord}
          </span>
          {pitchSemitones !== 0 && showTransposed && activeChord && (
            <span className="text-sm text-slate-400 font-mono">
              (oryg. {activeChord.chord})
            </span>
          )}
        </div>

        {activeChord && onSetLoop && (
          <button
            onClick={() => onSetLoop(activeChord.start_ms, activeChord.end_ms)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-xs font-medium transition"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Zapętl ten akord (A-B)</span>
          </button>
        )}
      </div>

      {/* Oś czasu (Timeline) */}
      <div className="flex-1 overflow-hidden flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Sparkles className="w-8 h-8 text-pink-400 animate-spin" />
            <p className="text-sm text-slate-300">Wykrywanie siatki rytmicznej i progresji akordów...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm">
            {error}
          </div>
        ) : data && data.chords.length > 0 ? (
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto overflow-y-hidden pb-4 scrollbar-thin scrollbar-thumb-pink-500/30 scrollbar-track-slate-800/40"
          >
            <div className="flex space-x-2 min-w-max py-2">
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
                    className={`relative group flex flex-col justify-between p-3 rounded-xl border transition-all cursor-pointer min-w-[100px] h-28 ${
                      isActive
                        ? 'chord-active-block bg-pink-500/20 border-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.3)] scale-105 z-10'
                        : isMinor
                        ? 'bg-purple-950/30 border-purple-800/40 hover:bg-purple-900/40'
                        : is7th
                        ? 'bg-amber-950/30 border-amber-800/40 hover:bg-amber-900/40'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Takt {chordSeg.bar}</span>
                      <span>{(chordSeg.confidence * 100).toFixed(0)}%</span>
                    </div>

                    <div className="text-center font-mono font-bold text-xl text-slate-100">
                      {editingChordIdx === idx ? (
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editChordValue}
                            onChange={(e) => setEditChordValue(e.target.value)}
                            className="w-14 px-1 py-0.5 bg-slate-950 border border-pink-400 rounded text-center text-xs text-white font-mono"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveOverride(idx)}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span>{displayLabel}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
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
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-300 transition"
                        title="Edytuj akord"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">
            Brak wykrytych akordów dla tego utworu.
          </div>
        )}
      </div>

      {/* Modal eksportu */}
      {exportOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xl w-full flex flex-col max-h-[80vh] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-lg font-bold text-slate-100">
                Eksport akordów ({exportFormat.toUpperCase()})
              </h3>
              <button
                onClick={() => setExportOutput(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              readOnly
              value={exportOutput}
              className="flex-1 w-full bg-slate-950 font-mono text-xs text-slate-200 p-3 rounded-lg border border-slate-800 resize-none h-64 focus:outline-none"
            />

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportOutput);
                  setExportOutput(null);
                }}
                className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-medium text-xs transition"
              >
                Kopiuj do schowka
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

