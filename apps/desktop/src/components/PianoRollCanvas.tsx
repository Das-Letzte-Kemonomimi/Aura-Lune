import React, { useState, useEffect, useRef } from 'react';
import {
  Piano,
  ZoomIn,
  ZoomOut,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { TrackTranscriptionData } from '../types/analysis';

interface PianoRollCanvasProps {
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  currentTimeMs: number;
  durationMs?: number;
  onSeek: (positionMs: number) => void;
  onClose?: () => void;
}

const MIN_MIDI = 36; // C2
const MAX_MIDI = 84; // C6
const NUM_KEYS = MAX_MIDI - MIN_MIDI + 1;

function isBlackKey(midi: number): boolean {
  const n = midi % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = ({
  trackId,
  trackPath,
  trackTitle = 'Transkrypcja',
  currentTimeMs,
  durationMs = 180000,
  onSeek,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<TrackTranscriptionData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pixelsPerSec, setPixelsPerSec] = useState<number>(80);
  const [keyHeight] = useState<number>(14);

  // Pobranie danych transkrypcji
  useEffect(() => {
    if (!trackId && !trackPath) return;

    let isMounted = true;
    const fetchTranscription = async () => {
      setLoading(true);
      setError(null);
      try {
        if (trackId) {
          const cached = await invoke<TrackTranscriptionData | null>('get_cached_transcription', {
            trackId,
          });
          if (cached && isMounted) {
            setData(cached);
            setLoading(false);
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
      } catch (err) {
        if (isMounted) setError(String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTranscription();
    return () => {
      isMounted = false;
    };
  }, [trackId, trackPath]);

  // Rysowanie Piano-Roll na Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const pianoWidth = 50;

    ctx.clearRect(0, 0, width, height);

    // Przesunięcie widoku, aby playhead był w widocznym oknie
    const playheadX = pianoWidth + (currentTimeMs / 1000) * pixelsPerSec;
    const scrollX = Math.max(0, playheadX - width / 2);

    ctx.save();

    // 1. Siatka pozioma i klawisze fortepianu po lewej
    for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
      const y = height - (m - MIN_MIDI + 1) * keyHeight;
      const isBlack = isBlackKey(m);

      // Tło wiersza nuty
      ctx.fillStyle = isBlack ? '#0f172a' : '#1e293b';
      ctx.fillRect(pianoWidth, y, width - pianoWidth, keyHeight);

      // Linia podziałki nuty
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pianoWidth, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Siatka pionowa (sekundy / takty)
    const totalSecs = Math.ceil(durationMs / 1000);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1;
    for (let s = 0; s <= totalSecs; s++) {
      const x = pianoWidth + s * pixelsPerSec - scrollX;
      if (x >= pianoWidth && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Numer sekundy
        if (s % 5 === 0) {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px monospace';
          ctx.fillText(`${s}s`, x + 3, height - 4);
        }
      }
    }

    // 3. Rysowanie wykrytych nut
    if (data && data.notes) {
      for (const note of data.notes) {
        if (note.midi_pitch < MIN_MIDI || note.midi_pitch > MAX_MIDI) continue;

        const startX = pianoWidth + (note.onset_ms / 1000) * pixelsPerSec - scrollX;
        const noteWidth = Math.max(4, (note.duration_ms / 1000) * pixelsPerSec);
        const y = height - (note.midi_pitch - MIN_MIDI + 1) * keyHeight;

        // Czy nuta aktualnie brzmi
        const isActive =
          currentTimeMs >= note.onset_ms &&
          currentTimeMs < note.onset_ms + note.duration_ms;

        if (startX + noteWidth < pianoWidth || startX > width) continue;

        // Kolor zależny od aktywności i stemu
        if (isActive) {
          ctx.fillStyle = '#f43f5e'; // Bright Rose/Pink Glow
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 10;
        } else if (note.stem === 'bass') {
          ctx.fillStyle = '#38bdf8'; // Sky blue
          ctx.shadowBlur = 0;
        } else if (note.stem === 'drums') {
          ctx.fillStyle = '#facc15'; // Amber
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#c084fc'; // Purple/Violet
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.roundRect(startX, y + 1, noteWidth - 1, keyHeight - 2, 3);
        ctx.fill();

        // Nazwa nuty wewnątrz klocka jeśli jest miejsce
        if (noteWidth > 20) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '9px sans-serif';
          ctx.fillText(note.pitch_name, startX + 3, y + keyHeight - 4);
        }
      }
    }

    ctx.restore();

    // 4. Klawiatura fortepianu po lewej (na stałe przypięta)
    for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
      const y = height - (m - MIN_MIDI + 1) * keyHeight;
      const isBlack = isBlackKey(m);
      const isC = m % 12 === 0;

      ctx.fillStyle = isBlack ? '#020617' : '#f8fafc';
      ctx.fillRect(0, y, pianoWidth, keyHeight);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(0, y, pianoWidth, keyHeight);

      if (isC) {
        ctx.fillStyle = '#020617';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`C${Math.floor(m / 12) - 1}`, 4, y + keyHeight - 3);
      }
    }

    // 5. Linia kursora odtwarzania (Playhead)
    const playheadScreenX = playheadX - scrollX;
    if (playheadScreenX >= pianoWidth && playheadScreenX <= width) {
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(playheadScreenX, 0);
      ctx.lineTo(playheadScreenX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [data, currentTimeMs, durationMs, pixelsPerSec, keyHeight]);

  const handleExportMidi = async () => {
    if (!trackId) return;
    try {
      const midiBytes = await invoke<number[]>('export_transcription_midi', { trackId });
      const blob = new Blob([new Uint8Array(midiBytes)], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trackTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_transcription.mid`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Błąd eksportu MIDI: ${err}`);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pianoWidth = 50;
    if (x < pianoWidth) return;

    const playheadX = pianoWidth + (currentTimeMs / 1000) * pixelsPerSec;
    const scrollX = Math.max(0, playheadX - canvas.width / 2);
    const clickedSec = (x - pianoWidth + scrollX) / pixelsPerSec;
    onSeek(Math.max(0, Math.floor(clickedSec * 1000)));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-5 text-slate-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Piano className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Piano-Roll (Polifoniczna Transkrypcja)
            </h2>
            <p className="text-xs text-slate-400">
              {data ? `Wykryto ${data.notes.length} nut • Tempo: ${data.bpm.toFixed(1)} BPM` : 'Analiza nutowa...'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setPixelsPerSec((p) => Math.max(30, p - 20))}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Oddal czas"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono px-2 text-slate-300">
              {pixelsPerSec}px/s
            </span>
            <button
              onClick={() => setPixelsPerSec((p) => Math.min(200, p + 20))}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Przybliż czas"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportMidi}
            disabled={!data || !data.notes.length}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-xs font-medium transition disabled:opacity-50"
            title="Eksportuj do standardowego pliku MIDI (.mid)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pobierz MIDI (.mid)</span>
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

      {/* Canvas container */}
      <div className="flex-1 relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-10 bg-slate-950/80 backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-sm text-slate-300">Analiza spektralna salience i transkrypcja nut...</p>
          </div>
        ) : error ? (
          <div className="p-4 m-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm">
            {error}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={900}
            height={NUM_KEYS * keyHeight}
            onClick={handleCanvasClick}
            className="w-full h-full cursor-crosshair"
          />
        )}
      </div>
    </div>
  );
};

