import React, { useState, useEffect } from 'react';
import { X, Play, RotateCcw, Clock, Check, AlertCircle, Scissors, Bookmark } from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';

import { parseTimeToMs, formatTimeMs } from '../../utils/timeFormat';
import { useLivePositionMs } from '../../state/livePlayback';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';
export { parseTimeToMs, formatTimeMs };

export interface LoopEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  loopPointA: number | null;
  loopPointB: number | null;
  currentPositionMs: number;
  durationMs: number | null;
  onApplyLoop: (a: number | null, b: number | null) => void;
  onSeek: (positionMs: number) => void;
  onExportLoop?: (a: number | null, b: number | null) => void;
  onSaveAsTrackBookmarks?: (a: number | null, b: number | null) => void;
  loc?: any;
  currentLang?: Language;
}

export const LoopEditorModal: React.FC<LoopEditorModalProps> = ({
  isOpen,
  onClose,
  loopPointA,
  loopPointB,
  currentPositionMs: currentPositionMsProp,
  durationMs,
  onApplyLoop,
  onSeek,
  onExportLoop,
  onSaveAsTrackBookmarks,
  loc: propLoc,
  currentLang = 'pl',
}) => {
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const currentPositionMs = useLivePositionMs(currentPositionMsProp);
  const loc = propLoc || getTranslations(currentLang);
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
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-w-130 flex-col gap-4.5 rounded-2xl border border-accent-cyan/35 p-6 text-fg"
    >
      {/* Nagłówek modalu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent-cyan/40 bg-accent-cyan/15 text-accent-cyan"
          >
            <Clock size={20} />
          </div>
          <div>
            <h3 className="m-0 text-lg font-extrabold tracking-tight">
              {loc.player.editLoopTitle}
            </h3>
            <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
              {loc.player.editLoopDesc}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="glass-card rounded-lg border-0 bg-transparent p-1.5 text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Informacja o bieżącej pozycji utworu */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-white/3 px-3 py-2 text-ui">
        <span className="text-fg-muted">{loc.player.useCurrentPos}:</span>
        <span className="font-mono font-bold text-accent-cyan">
          {formatTimeMs(currentPositionMs)} ({currentPositionMs} ms)
        </span>
      </div>

      {/* Sekcja Punktu A */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-accent-cyan/25 bg-accent-cyan/5 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-accent-cyan">
            {loc.player.loopPointA}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleSetCurrent('A')}
              className="rounded-md border border-accent-cyan/40 bg-accent-cyan/20 px-2 py-1 text-xs font-semibold text-accent-cyan"
            >
              {loc.player.useCurrentPos || 'Ustaw teraz'}
            </button>
            {parsedA !== null && (
              <button
                type="button"
                onClick={() => onSeek(parsedA)}
                className="flex items-center gap-1 rounded-md border border-line bg-white/6 px-2 py-1 text-xs text-fg"
                title={loc.player.jumpToA || 'Skocz do A'}
              >
                <Play size={10} fill="currentColor" /> {loc.player.jumpToA || 'Skocz'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputA}
            onChange={(e) => setInputA(e.target.value)}
            placeholder="np. 860ms, 860 lub 0:00.860"
            className={cn(
              'flex-1 rounded-lg border bg-black/35 px-3 py-2 font-mono text-sm text-fg outline-none',
              !isAValid ? 'border-accent-pink' : 'border-accent-cyan/40',
            )}
          />
          <div className="min-w-25 text-right font-mono text-ui">
            {parsedA !== null ? (
              <span className="font-bold text-accent-cyan">{formatTimeMs(parsedA)}</span>
            ) : (
              <span className="text-fg-muted">--:--.---</span>
            )}
          </div>
        </div>

        {/* Przyciski mikro-korekty (Nudge A) */}
        <div className="flex flex-wrap gap-1">
          <span className="mr-1 self-center text-xxs text-fg-muted">
            Korekta:
          </span>
          {[-1000, -100, -10, 10, 100, 1000].map((delta) => (
            <button
              key={`nudge-A-${delta}`}
              type="button"
              onClick={() => handleNudge('A', delta)}
              className={cn(
                'rounded-sm border border-line bg-white/5 px-1.5 py-0.5 font-mono text-xxs',
                delta > 0 ? 'text-accent-cyan' : 'text-fg-muted',
              )}
            >
              {delta > 0 ? `+${delta >= 1000 ? `${delta / 1000}s` : `${delta}ms`}` : `${delta <= -1000 ? `${delta / 1000}s` : `${delta}ms`}`}
            </button>
          ))}
        </div>
      </div>

      {/* Sekcja Punktu B */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-accent-pink/25 bg-accent-pink/5 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-accent-pink">
            {loc.player.loopPointB}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleSetCurrent('B')}
              className="rounded-md border border-accent-pink/40 bg-accent-pink/20 px-2 py-1 text-xs font-semibold text-accent-pink"
            >
              {loc.player.useCurrentPos || 'Ustaw teraz'}
            </button>
            {parsedB !== null && (
              <button
                type="button"
                onClick={() => onSeek(parsedB)}
                className="flex items-center gap-1 rounded-md border border-line bg-white/6 px-2 py-1 text-xs text-fg"
                title={loc.player.jumpToA ? loc.player.jumpToA.replace('A', 'B') : 'Jump to B'}
              >
                <Play size={10} fill="currentColor" /> Skocz
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputB}
            onChange={(e) => setInputB(e.target.value)}
            placeholder="np. 5000ms, 5200 lub 0:05.200"
            className={cn(
              'flex-1 rounded-lg border bg-black/35 px-3 py-2 font-mono text-sm text-fg outline-none',
              !isBValid ? 'border-accent-pink' : 'border-accent-pink/40',
            )}
          />
          <div className="min-w-25 text-right font-mono text-ui">
            {parsedB !== null ? (
              <span className="font-bold text-accent-pink">{formatTimeMs(parsedB)}</span>
            ) : (
              <span className="text-fg-muted">--:--.---</span>
            )}
          </div>
        </div>

        {/* Przyciski mikro-korekty (Nudge B) */}
        <div className="flex flex-wrap gap-1">
          <span className="mr-1 self-center text-xxs text-fg-muted">
            Korekta:
          </span>
          {[-1000, -100, -10, 10, 100, 1000].map((delta) => (
            <button
              key={`nudge-B-${delta}`}
              type="button"
              onClick={() => handleNudge('B', delta)}
              className={cn(
                'rounded-sm border border-line bg-white/5 px-1.5 py-0.5 font-mono text-xxs',
                delta > 0 ? 'text-accent-pink' : 'text-fg-muted',
              )}
            >
              {delta > 0 ? `+${delta >= 1000 ? `${delta / 1000}s` : `${delta}ms`}` : `${delta <= -1000 ? `${delta / 1000}s` : `${delta}ms`}`}
            </button>
          ))}
        </div>
      </div>

      {/* Podsumowanie pętli / Walidacja */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-black/25 px-3.5 py-2.5 text-ui">
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">{loc.player.loopDuration}:</span>
          <span className={cn('font-mono font-extrabold', loopDuration ? 'text-accent-amber' : 'text-fg-muted')}>
            {loopDuration !== null ? `${loopDuration} ms (${(loopDuration / 1000).toFixed(3)} s)` : '--'}
          </span>
        </div>

        {!isOrderValid && (
          <div className="flex items-center gap-1.5 text-ui text-accent-pink">
            <AlertCircle size={14} />
            <span>{loc.player.loopBMustBeGreaterThanA}</span>
          </div>
        )}

        {(!isAValid || !isBValid) && (
          <div className="flex items-center gap-1.5 text-ui text-accent-pink">
            <AlertCircle size={14} />
            <span>{loc.player.invalidTimeFormat}</span>
          </div>
        )}
      </div>

      {/* Przyciski dolne modalu */}
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={handleClear}
          className="glass-card flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/8 px-3.5 py-2 text-ui text-rose-400"
        >
          <RotateCcw size={14} /> {loc.player.clearLoop}
        </button>

        {onExportLoop && (
          <button
            type="button"
            onClick={() => {
              if (isAValid && isBValid && isOrderValid) {
                onExportLoop(parsedA, parsedB);
                onClose();
              }
            }}
            disabled={!isAValid || !isBValid || !isOrderValid || (parsedA === null && parsedB === null)}
            className={cn(
              'glass-card flex items-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3.5 py-2 text-ui font-semibold text-accent-cyan',
              !isAValid || !isBValid || !isOrderValid || (parsedA === null && parsedB === null) ? 'cursor-not-allowed' : 'cursor-pointer',
              !isAValid || !isBValid || !isOrderValid || (parsedA === null && parsedB === null) ? 'opacity-50' : 'opacity-100',
            )}
            title={loc.loopEditor.exportLoopTitle}
          >
            <Scissors size={14} /> {loc.loopEditor.exportLoop}
          </button>
        )}

        {onSaveAsTrackBookmarks && (
          <button
            type="button"
            onClick={() => {
              if (isAValid && isBValid && isOrderValid) {
                onSaveAsTrackBookmarks(parsedA, parsedB);
              }
            }}
            disabled={!isAValid || !isBValid || !isOrderValid || (parsedA === null && parsedB === null)}
            className={cn(
              'glass-card flex items-center gap-1.5 rounded-lg border border-pink-500/40 bg-pink-500/10 px-3.5 py-2 text-ui font-semibold text-accent-pink',
              !isAValid || !isBValid || !isOrderValid || (parsedA === null && parsedB === null) ? 'cursor-not-allowed' : 'cursor-pointer',
              !isAValid || !isBValid || !isOrderValid || (parsedA === null && parsedB === null) ? 'opacity-50' : 'opacity-100',
            )}
            title={loc.loopEditor.saveBookmarksTitle}
          >
            <Bookmark size={14} /> {loc.loopEditor.saveBookmarks}
          </button>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="glass-card rounded-lg border border-line bg-transparent px-3.5 py-2 text-ui text-fg-muted"
          >
            {loc.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!isAValid || !isBValid || !isOrderValid}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border-0 bg-linear-135 from-accent-cyan to-accent-pink px-4.5 py-2 text-ui font-bold text-on-accent shadow-lift shadow-accent-cyan/35',
              !isAValid || !isBValid || !isOrderValid ? 'cursor-not-allowed' : 'cursor-pointer',
              !isAValid || !isBValid || !isOrderValid ? 'opacity-50' : 'opacity-100',
            )}
          >
            <Check size={14} /> {loc.player.applyAndClose}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
