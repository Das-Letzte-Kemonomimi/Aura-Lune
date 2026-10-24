import React, { useState, useEffect } from 'react';
import { X, Play, RotateCcw, Clock, Check, AlertCircle } from 'lucide-react';

export function parseTimeToMs(input: string): number | null {
  if (!input) return null;
  const str = input.trim().toLowerCase();
  if (!str) return null;

  // 1. Jawny sufiks 'ms': np. "860ms", "860 ms"
  if (str.endsWith('ms')) {
    const val = parseFloat(str.slice(0, -2).trim());
    return isNaN(val) ? null : Math.max(0, Math.round(val));
  }

  // 2. Jawny sufiks 's': np. "1.5s", "12s"
  if (str.endsWith('s')) {
    const val = parseFloat(str.slice(0, -1).trim());
    return isNaN(val) ? null : Math.max(0, Math.round(val * 1000));
  }

  // 3. Format z dwukropkiem: [HH:]MM:SS[.mmm] lub MM:SS[.mmm]
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length === 2) {
      const minutes = parseFloat(parts[0]);
      const seconds = parseFloat(parts[1]);
      if (isNaN(minutes) || isNaN(seconds)) return null;
      return Math.max(0, Math.round((minutes * 60 + seconds) * 1000));
    } else if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
      return Math.max(0, Math.round((hours * 3600 + minutes * 60 + seconds) * 1000));
    }
    return null;
  }

  // 4. Format z kropką bez dwukropka: np. "0.860" lub "12.5" -> traktowane jako sekundy
  if (str.includes('.')) {
    const val = parseFloat(str);
    return isNaN(val) ? null : Math.max(0, Math.round(val * 1000));
  }

  // 5. Czyste cyfry całkowite -> traktowane bezpośrednio jako milisekundy (np. "860" -> 860ms, "1500" -> 1500ms)
  const val = parseInt(str, 10);
  return isNaN(val) ? null : Math.max(0, val);
}

export function formatTimeMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0 || isNaN(ms)) return '0:00.000';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const remMs = Math.floor(ms % 1000);
  return `${m}:${s < 10 ? '0' : ''}${s}.${remMs.toString().padStart(3, '0')}`;
}

export interface LoopEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  loopPointA: number | null;
  loopPointB: number | null;
  currentPositionMs: number;
  durationMs: number | null;
  onApplyLoop: (a: number | null, b: number | null) => void;
  onSeek: (positionMs: number) => void;
  loc: any;
}

export const LoopEditorModal: React.FC<LoopEditorModalProps> = ({
  isOpen,
  onClose,
  loopPointA,
  loopPointB,
  currentPositionMs,
  durationMs,
  onApplyLoop,
  onSeek,
  loc,
}) => {
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');

  // Synchronizacja po otwarciu okna
  useEffect(() => {
    if (isOpen) {
      setInputA(loopPointA !== null ? `${loopPointA}ms` : '');
      setInputB(loopPointB !== null ? `${loopPointB}ms` : '');
    }
  }, [isOpen, loopPointA, loopPointB]);

  if (!isOpen) return null;

  const parsedA = parseTimeToMs(inputA);
  const parsedB = parseTimeToMs(inputB);

  const isAValid = inputA.trim() === '' || parsedA !== null;
  const isBValid = inputB.trim() === '' || parsedB !== null;
  const isOrderValid = parsedA === null || parsedB === null || parsedB > parsedA;

  const loopDuration = parsedA !== null && parsedB !== null && parsedB > parsedA ? parsedB - parsedA : null;

  const handleNudge = (which: 'A' | 'B', deltaMs: number) => {
    if (which === 'A') {
      const base = parsedA !== null ? parsedA : currentPositionMs;
      const nextVal = Math.max(0, base + deltaMs);
      setInputA(`${nextVal}ms`);
    } else {
      const base = parsedB !== null ? parsedB : currentPositionMs;
      const maxVal = durationMs ? durationMs : 99999999;
      const nextVal = Math.max(0, Math.min(maxVal, base + deltaMs));
      setInputB(`${nextVal}ms`);
    }
  };

  const handleSetCurrent = (which: 'A' | 'B') => {
    if (which === 'A') {
      setInputA(`${currentPositionMs}ms`);
    } else {
      setInputB(`${currentPositionMs}ms`);
    }
  };

  const handleApply = () => {
    if (!isAValid || !isBValid || !isOrderValid) return;
    onApplyLoop(parsedA, parsedB);
    onClose();
  };

  const handleClear = () => {
    onApplyLoop(null, null);
    setInputA('');
    setInputB('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 15, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(16, 20, 36, 0.94)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 30px rgba(6, 182, 212, 0.15)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          color: 'var(--text-main)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek modalu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {loc.player.editLoopTitle || 'Edycja pętli A-B'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {loc.player.editLoopDesc || 'Wpisz precyzyjne punkty pętli co do milisekundy (np. 860ms, 860 lub 0:00.860)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass-card"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Informacja o bieżącej pozycji utworu */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{loc.player.useCurrentPos || 'Bieżąca pozycja'}:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {formatTimeMs(currentPositionMs)} ({currentPositionMs} ms)
          </span>
        </div>

        {/* Sekcja Punktu A */}
        <div
          style={{
            background: 'rgba(6, 182, 212, 0.05)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
              {loc.player.loopPointA || 'Punkt A (początek)'}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleSetCurrent('A')}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(6, 182, 212, 0.2)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {loc.player.useCurrentPos || 'Ustaw teraz'}
              </button>
              {parsedA !== null && (
                <button
                  type="button"
                  onClick={() => onSeek(parsedA)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={loc.player.jumpToA || 'Skocz do A'}
                >
                  <Play size={10} fill="currentColor" /> {loc.player.jumpToA || 'Skocz'}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              placeholder="np. 860ms, 860 lub 0:00.860"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: !isAValid ? '1px solid #f43f5e' : '1px solid rgba(6, 182, 212, 0.4)',
                color: '#fff',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {parsedA !== null ? (
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{formatTimeMs(parsedA)}</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>--:--.---</span>
              )}
            </div>
          </div>

          {/* Przyciski mikro-korekty (Nudge A) */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>
              Korekta:
            </span>
            {[-1000, -100, -10, 10, 100, 1000].map((delta) => (
              <button
                key={`nudge-A-${delta}`}
                type="button"
                onClick={() => handleNudge('A', delta)}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: delta > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {delta > 0 ? `+${delta >= 1000 ? `${delta / 1000}s` : `${delta}ms`}` : `${delta <= -1000 ? `${delta / 1000}s` : `${delta}ms`}`}
              </button>
            ))}
          </div>
        </div>

        {/* Sekcja Punktu B */}
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.05)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-pink)' }}>
              {loc.player.loopPointB || 'Punkt B (koniec)'}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleSetCurrent('B')}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(244, 63, 94, 0.2)',
                  color: 'var(--accent-pink)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {loc.player.useCurrentPos || 'Ustaw teraz'}
              </button>
              {parsedB !== null && (
                <button
                  type="button"
                  onClick={() => onSeek(parsedB)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={loc.player.jumpToA ? loc.player.jumpToA.replace('A', 'B') : 'Jump to B'}
                >
                  <Play size={10} fill="currentColor" /> Skocz
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              placeholder="np. 5000ms, 5200 lub 0:05.200"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: !isBValid ? '1px solid #f43f5e' : '1px solid rgba(244, 63, 94, 0.4)',
                color: '#fff',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {parsedB !== null ? (
                <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>{formatTimeMs(parsedB)}</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>--:--.---</span>
              )}
            </div>
          </div>

          {/* Przyciski mikro-korekty (Nudge B) */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>
              Korekta:
            </span>
            {[-1000, -100, -10, 10, 100, 1000].map((delta) => (
              <button
                key={`nudge-B-${delta}`}
                type="button"
                onClick={() => handleNudge('B', delta)}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: delta > 0 ? 'var(--accent-pink)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {delta > 0 ? `+${delta >= 1000 ? `${delta / 1000}s` : `${delta}ms`}` : `${delta <= -1000 ? `${delta / 1000}s` : `${delta}ms`}`}
              </button>
            ))}
          </div>
        </div>

        {/* Podsumowanie pętli / Walidacja */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>{loc.player.loopDuration || 'Długość pętli'}:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: loopDuration ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
              {loopDuration !== null ? `${loopDuration} ms (${(loopDuration / 1000).toFixed(3)} s)` : '--'}
            </span>
          </div>

          {!isOrderValid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e', fontSize: '0.78rem' }}>
              <AlertCircle size={14} />
              <span>{loc.player.loopBMustBeGreaterThanA || 'Punkt B musi być większy niż punkt A'}</span>
            </div>
          )}

          {(!isAValid || !isBValid) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e', fontSize: '0.78rem' }}>
              <AlertCircle size={14} />
              <span>{loc.player.invalidTimeFormat || 'Nieprawidłowy format czasu (np. 860ms, 860, 0:00.860 lub 1:23.450)'}</span>
            </div>
          )}
        </div>

        {/* Przyciski dolne modalu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <button
            type="button"
            onClick={handleClear}
            className="glass-card"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#ff6b81',
              border: '1px solid rgba(255, 107, 129, 0.3)',
              background: 'rgba(255, 107, 129, 0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={14} /> {loc.player.clearLoop || 'Wyczyść pętlę'}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="glass-card"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!isAValid || !isBValid || !isOrderValid}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
                border: 'none',
                cursor: !isAValid || !isBValid || !isOrderValid ? 'not-allowed' : 'pointer',
                opacity: !isAValid || !isBValid || !isOrderValid ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.35)',
              }}
            >
              <Check size={14} /> {loc.player.applyAndClose || 'Zastosuj pętlę'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
