import React, { useState, useEffect, useRef } from 'react';
import {
  Piano,
  ZoomIn,
  ZoomOut,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { TrackTranscriptionData } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { fmt } from '../../utils/fmt';

export interface PianoRollCanvasProps {
  currentLang?: Language;
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
  currentLang,
  trackId,
  trackPath,
  trackTitle,
  currentTimeMs,
  durationMs = 180000,
  onSeek,
  onClose,
}) => {
  const t = getTranslations(currentLang);
  const displayTitle = trackTitle || t.analysis.transcriptionDefault;
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
      a.download = `${(displayTitle || 'track').replace(/[^a-zA-Z0-9_-]/g, '_')}_transcription.mid`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`${t.common.errorPrefix} ${err}`);
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
    const timeSec = (x - pianoWidth + scrollX) / pixelsPerSec;
    onSeek(Math.max(0, Math.min(durationMs, Math.round(timeSec * 1000))));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', width: '100%' }}>
      {/* Header pod-widoku */}
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
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
              {t.analysis.pianoRollTitle}
            </span>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              {data ? fmt(t.analysis.detectedNotes, String(data.notes.length), data.bpm.toFixed(1)) : t.analysis.analyzingNotes}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Zoom controls */}
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
              onClick={() => setPixelsPerSec((p) => Math.max(30, p - 20))}
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
              }}
              title={t.analysis.zoomOut}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', padding: '0 6px', color: '#cbd5e1' }}>
              {pixelsPerSec}px/s
            </span>
            <button
              onClick={() => setPixelsPerSec((p) => Math.min(200, p + 20))}
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
              }}
              title={t.analysis.zoomIn}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            onClick={handleExportMidi}
            disabled={!data || !data.notes.length}
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
              cursor: data && data.notes.length ? 'pointer' : 'not-allowed',
              opacity: data && data.notes.length ? 1 : 0.5,
            }}
            title={t.analysis.exportMidiTooltip}
          >
            <Download size={14} />
            <span>{t.analysis.downloadMidi}</span>
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

      {/* Canvas container */}
      <div
        style={{
          flex: 1,
          minHeight: '320px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: '#090a12',
          display: 'flex',
        }}
      >
        {loading ? (
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
              backdropFilter: 'blur(4px)',
              zIndex: 10,
            }}
          >
            <Sparkles size={28} color="#c084fc" style={{ animation: 'spin 1.5s linear infinite' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
              Analiza spektralna salience i transkrypcja nut...
            </p>
          </div>
        ) : error ? (
          <div
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
        ) : (
          <canvas
            ref={canvasRef}
            width={900}
            height={NUM_KEYS * keyHeight}
            onClick={handleCanvasClick}
            style={{
              width: '100%',
              height: '100%',
              cursor: 'crosshair',
              display: 'block',
            }}
          />
        )}
      </div>
    </div>
  );
};
