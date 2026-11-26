import React, { useEffect, useRef } from 'react';
import { Badge, Button, Card, Chip, RangeSlider } from '../../../components/ui';
import { Sparkles } from '../../../components/ui/icons';
import type { Translations } from '../../../i18n';
import { fmt } from '../../../utils/fmt';
import {
  PREAMP_MAX_DB,
  PREAMP_MIN_DB,
  formatSignedDb,
  preampStepSize,
  stepPreampDb,
  wheelPreampStep,
} from '../../../utils/preamp';

const STEP_UP_KEYS = ['ArrowUp', 'ArrowRight'];
const STEP_DOWN_KEYS = ['ArrowDown', 'ArrowLeft'];

export interface PreampControlProps {
  loc: Translations;
  preampDb: number;
  preampAuto: boolean;
  /** The cut the Auto preamp currently applies to the graphic EQ (dB, ≤ 0). */
  autoPreampValue: number;
  equalizerEnabled: boolean;
  onPreampChange: (db: number) => void;
  onToggleAuto: () => void;
}

/**
 * The always-on preamp (applied even with the EQ off) and the graphic EQ Auto preamp toggle.
 * Wheel and arrow keys: ±0.5 dB (Shift 0.1 dB). Double-click or "0 dB": reset.
 */
export const PreampControl: React.FC<PreampControlProps> = ({
  autoPreampValue,
  equalizerEnabled,
  loc,
  onPreampChange,
  onToggleAuto,
  preampAuto,
  preampDb,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // The wheel listener is attached once; it reads the latest values through this ref.
  const latestRef = useRef({ preampDb, onPreampChange });
  useEffect(() => {
    latestRef.current = { preampDb, onPreampChange };
  });

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Native listener: React's onWheel is passive, so it could not stop the page from scrolling.
    const onWheel = (e: WheelEvent) => {
      const delta = wheelPreampStep(e.deltaY, e);
      if (!delta) return;
      e.preventDefault();
      const { preampDb: current, onPreampChange: send } = latestRef.current;
      send(stepPreampDb(current, delta));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const sign = STEP_UP_KEYS.includes(e.key) ? 1 : STEP_DOWN_KEYS.includes(e.key) ? -1 : 0;
    if (!sign) return;
    // The native range step would ignore Shift; step here so Shift gives 0.1 dB.
    e.preventDefault();
    onPreampChange(stepPreampDb(preampDb, sign * preampStepSize(e)));
  };

  return (
    <Card variant="inset" padding="none" className="mt-4 flex flex-col gap-2 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="mr-1.5 text-sm font-bold text-fg">{loc.dsp.preamp}</span>
          <span className="text-xxs text-fg-muted">{loc.dsp.preampDesc}</span>
        </span>
        <div className="flex items-center gap-2">
          {preampAuto && equalizerEnabled && (
            <span className="font-mono text-xxs text-fg-muted" data-testid="preamp-auto-readout">
              {fmt(loc.dsp.preampAutoReadout, formatSignedDb(autoPreampValue))}
            </span>
          )}
          <Chip size="xs" pressed={preampAuto} tone="cyan" onClick={onToggleAuto} title={loc.dsp.preampAutoTooltip}>
            <Sparkles size={12} /> {loc.dsp.preampAuto}
          </Chip>
          <Button size="sm" onClick={() => onPreampChange(0)} title={loc.dsp.preampResetTooltip}>
            0 dB
          </Button>
          <Badge mono tone={preampDb > 0 ? 'pink' : preampDb < 0 ? 'cyan' : 'neutral'} className="min-w-16 justify-center">
            {formatSignedDb(preampDb)}
          </Badge>
        </div>
      </div>
      <RangeSlider
        ref={inputRef}
        aria-label={loc.dsp.preamp}
        aria-valuetext={formatSignedDb(preampDb)}
        min={PREAMP_MIN_DB}
        max={PREAMP_MAX_DB}
        step={0.5}
        value={preampDb}
        onChange={onPreampChange}
        onDoubleClick={() => onPreampChange(0)}
        onKeyDown={onKeyDown}
        title={loc.dsp.preampResetTooltip}
      />
    </Card>
  );
};
