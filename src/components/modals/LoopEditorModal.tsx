import React, { useEffect, useId, useState } from 'react';
import { Play, RotateCcw, Clock, Check, AlertCircle, Scissors, Bookmark } from '../ui/icons';
import { type Language, type Translations, getTranslations } from '../../i18n';

import { formatTimeMs } from '../../utils/timeFormat';
import { useLivePositionMs } from '../../state/livePlayback';
import { cn } from '../../utils/cn';
import { Button, Callout, Card, ModalBody, ModalFooter, ModalHeader, ModalShell, NudgeButtons, TextField } from '../ui';
import { textTones } from '../ui/tones';
import { loopPointInputText, validateLoopInputs } from './loopEditorModel';

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
  loc?: Translations;
  currentLang?: Language;
}

export const LoopEditorModal: React.FC<LoopEditorModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <LoopEditorModalInner {...props} />;
};

const LoopEditorModalInner: React.FC<LoopEditorModalProps> = ({
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
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const currentPositionMs = useLivePositionMs(currentPositionMsProp);
  const loc = propLoc || getTranslations(currentLang);
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const titleId = useId();

  // Sync when loop bounds change while open
  useEffect(() => {
    setInputA(loopPointInputText(loopPointA));
    setInputB(loopPointInputText(loopPointB));
  }, [loopPointA, loopPointB]);

  const { parsedA, parsedB, isAValid, isBValid, isOrderValid, isWithinTrack, loopDurationMs: loopDuration, canApply } =
    validateLoopInputs(inputA, inputB, durationMs);

  const handleApply = () => {
    if (!canApply) return;
    onApplyLoop(parsedA, parsedB);
    onClose();
  };

  const handleClear = () => {
    onApplyLoop(null, null);
    setInputA('');
    setInputB('');
    onClose();
  };

  const invalidRange = !canApply;
  const nothingSet = parsedA === null && parsedB === null;
  const maxMs = durationMs ?? Number.MAX_SAFE_INTEGER;

  return (
    <ModalShell onClose={onClose} layer="studio" size="md" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.player.editLoopTitle}
        subtitle={loc.player.editLoopDesc}
        icon={<Clock size={20} />}
        tone="cyan"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-4">
        {/* Current track position */}
        <Card variant="inset" padding="none" className="flex items-center justify-between px-3 py-2 text-ui">
          <span className="text-fg-muted">{loc.player.useCurrentPos}:</span>
          <span className="font-mono font-bold text-accent-cyan">
            {formatTimeMs(currentPositionMs)} ({currentPositionMs} ms)
          </span>
        </Card>

        <LoopPointCard
          tone="cyan"
          label={loc.player.loopPointA}
          input={inputA}
          onInput={setInputA}
          parsed={parsedA}
          valid={isAValid}
          placeholder="m:ss.mmm"
          nudgeBase={parsedA ?? currentPositionMs}
          maxMs={maxMs}
          setNowLabel={loc.player.useCurrentPos || 'Set now'}
          jumpLabel={loc.player.jumpToA || 'Jump to A'}
          onSetNow={() => setInputA(loopPointInputText(currentPositionMs))}
          onSeek={onSeek}
        />
        <LoopPointCard
          tone="pink"
          label={loc.player.loopPointB}
          input={inputB}
          onInput={setInputB}
          parsed={parsedB}
          valid={isBValid}
          placeholder="m:ss.mmm"
          nudgeBase={parsedB ?? currentPositionMs}
          maxMs={maxMs}
          setNowLabel={loc.player.useCurrentPos || 'Set now'}
          jumpLabel={loc.player.jumpToA ? loc.player.jumpToA.replace('A', 'B') : 'Jump to B'}
          onSetNow={() => setInputB(loopPointInputText(currentPositionMs))}
          onSeek={onSeek}
        />

        {/* Loop summary / validation */}
        <Card variant="inset" padding="none" className="flex flex-col gap-1.5 px-3.5 py-2.5 text-ui">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted">{loc.player.loopDuration}:</span>
            <span className={cn('font-mono font-extrabold', loopDuration ? 'text-accent-amber' : 'text-fg-muted')}>
              {loopDuration !== null ? `${loopDuration} ms (${(loopDuration / 1000).toFixed(3)} s)` : '--'}
            </span>
          </div>
          {!isOrderValid && (
            <div className="flex items-center gap-1.5 text-accent-pink">
              <AlertCircle size={14} />
              <span>{loc.player.loopBMustBeGreaterThanA}</span>
            </div>
          )}
          {!isWithinTrack && (
            <div className="flex items-center gap-1.5 text-accent-pink">
              <AlertCircle size={14} />
              <span>{loc.player.loopPointBeyondTrack}</span>
            </div>
          )}
          {(!isAValid || !isBValid) && (
            <div className="flex items-center gap-1.5 text-accent-pink">
              <AlertCircle size={14} />
              <span>{loc.player.invalidTimeFormat}</span>
            </div>
          )}
        </Card>
      </ModalBody>

      <ModalFooter className="flex-wrap justify-between">
        <Button variant="danger" onClick={handleClear}>
          <RotateCcw size={14} /> {loc.player.clearLoop}
        </Button>

        <div className="flex flex-wrap gap-2">
          {onExportLoop && (
            <Button
              variant="tinted"
              tone="cyan"
              disabled={invalidRange || nothingSet}
              title={loc.loopEditor.exportLoopTitle}
              onClick={() => {
                onExportLoop(parsedA, parsedB);
                onClose();
              }}
            >
              <Scissors size={14} /> {loc.loopEditor.exportLoop}
            </Button>
          )}
          {onSaveAsTrackBookmarks && (
            <Button
              variant="tinted"
              tone="pink"
              disabled={invalidRange || nothingSet}
              title={loc.loopEditor.saveBookmarksTitle}
              onClick={() => onSaveAsTrackBookmarks(parsedA, parsedB)}
            >
              <Bookmark size={14} /> {loc.loopEditor.saveBookmarks}
            </Button>
          )}
          <Button onClick={onClose}>{loc.common.cancel}</Button>
          <Button variant="primary" onClick={handleApply} disabled={invalidRange}>
            <Check size={14} /> {loc.player.applyAndClose}
          </Button>
        </div>
      </ModalFooter>
    </ModalShell>
  );
};

const NUDGE_STEPS_MS = [-1000, -100, -10, 10, 100, 1000] as const;
const formatNudge = (ms: number) =>
  `${ms > 0 ? '+' : '−'}${Math.abs(ms) >= 1000 ? `${Math.abs(ms) / 1000}s` : `${Math.abs(ms)}ms`}`;

interface LoopPointCardProps {
  tone: 'cyan' | 'pink';
  label: string;
  input: string;
  onInput: (value: string) => void;
  parsed: number | null;
  valid: boolean;
  placeholder: string;
  /** Value the nudges start from: the parsed point, or the playhead when it is empty. */
  nudgeBase: number;
  maxMs: number;
  setNowLabel: string;
  jumpLabel: string;
  onSetNow: () => void;
  onSeek: (positionMs: number) => void;
}

/** Editor for one loop point: time field, "set now", "jump" and fine nudges. */
function LoopPointCard({
  tone,
  label,
  input,
  onInput,
  parsed,
  valid,
  placeholder,
  nudgeBase,
  maxMs,
  setNowLabel,
  jumpLabel,
  onSetNow,
  onSeek,
}: LoopPointCardProps) {
  return (
    <Callout tone={tone} className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-extrabold', textTones[tone])}>{label}</span>
        <div className="flex gap-1.5">
          <Button variant="tinted" tone={tone} size="sm" onClick={onSetNow}>
            {setNowLabel}
          </Button>
          {parsed !== null && (
            <Button size="sm" onClick={() => onSeek(parsed)} title={jumpLabel}>
              <Play size={10} fill="currentColor" /> {jumpLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TextField
          mono
          aria-label={label}
          aria-invalid={!valid}
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder={placeholder}
          className={cn('flex-1', !valid && 'border-accent-red')}
        />
        <div className="min-w-25 text-right font-mono text-ui">
          {parsed !== null ? (
            <span className={cn('font-bold', textTones[tone])}>{formatTimeMs(parsed)}</span>
          ) : (
            <span className="text-fg-muted">--:--.---</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xxs text-fg-muted">Nudge:</span>
        <NudgeButtons
          value={nudgeBase}
          onChange={(ms) => onInput(loopPointInputText(ms))}
          steps={NUDGE_STEPS_MS}
          min={0}
          max={maxMs}
          formatStep={formatNudge}
          className="flex-wrap"
        />
      </div>
    </Callout>
  );
}
