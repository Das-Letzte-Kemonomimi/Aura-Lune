import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Chip, IconButton, StatusDot } from '../../../components/ui';
import { Gauge, Sparkles } from '../../../components/ui/icons';
import type { Translations } from '../../../i18n';
import { cn } from '../../../utils/cn';
import { fmt } from '../../../utils/fmt';
import {
  PREAMP_MAX_DB,
  PREAMP_MIN_DB,
  clampPreampDb,
  formatSignedDb,
  preampStepSize,
  stepPreampDb,
  wheelPreampStep,
} from '../../../utils/preamp';

const STEP_UP_KEYS = ['ArrowUp', 'ArrowRight'];
const STEP_DOWN_KEYS = ['ArrowDown', 'ArrowLeft'];
const TICK_PERCENTS = [0, 16.67, 33.33, 50, 66.67, 83.33, 100] as const;

export interface PreampControlProps {
  loc: Translations;
  preampDb: number;
  preampAuto: boolean;
  /** The cut the Auto preamp currently applies to the graphic EQ (dB, <= 0). */
  autoPreampValue: number;
  equalizerEnabled: boolean;
  onPreampChange: (db: number) => void;
  onToggleAuto: () => void;
  /** A sample above 0 dBFS reached the output stage since the last reset (engine latch). */
  clipDetected: boolean;
  /** Clears the clip latch. */
  onResetClip: () => void;
}

/** Converts a vertical pointer coordinate inside `rect` to a quantized dB value. */
function verticalPointerToDb(clientY: number, rect: DOMRect, shiftKey: boolean): number {
  if (rect.height <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
  const rawDb = PREAMP_MIN_DB + ratio * (PREAMP_MAX_DB - PREAMP_MIN_DB);
  const step = shiftKey ? 0.1 : 0.5;
  return clampPreampDb(Math.round(Math.round(rawDb / step) * step * 10) / 10);
}

/**
 * Always-on vertical Poweramp-style preamp fader (applied even with the EQ off) and the EQ Auto
 * preamp toggle. Wheel and arrow keys: +/- 0.5 dB (Shift 0.1 dB). Double-click or "0 dB": reset.
 */
export const PreampControl: React.FC<PreampControlProps> = ({
  autoPreampValue,
  clipDetected,
  equalizerEnabled,
  loc,
  onPreampChange,
  onResetClip,
  onToggleAuto,
  preampAuto,
  preampDb,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // The wheel listener is attached once; it reads the latest values through this ref.
  const latestRef = useRef({ preampDb, onPreampChange });
  useEffect(() => {
    latestRef.current = { preampDb, onPreampChange };
  });

  useEffect(() => {
    const el = sliderRef.current;
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

  const updateFromPointer = useCallback(
    (clientY: number, shiftKey: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      onPreampChange(verticalPointerToDb(clientY, track.getBoundingClientRect(), shiftKey));
    },
    [onPreampChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    updateFromPointer(e.clientY, e.shiftKey);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateFromPointer(e.clientY, e.shiftKey);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Home') {
      e.preventDefault();
      onPreampChange(PREAMP_MIN_DB);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      onPreampChange(PREAMP_MAX_DB);
      return;
    }
    const sign = STEP_UP_KEYS.includes(e.key) ? 1 : STEP_DOWN_KEYS.includes(e.key) ? -1 : 0;
    if (!sign) return;
    e.preventDefault();
    onPreampChange(stepPreampDb(preampDb, sign * preampStepSize(e)));
  };

  const ratio = (clampPreampDb(preampDb) - PREAMP_MIN_DB) / (PREAMP_MAX_DB - PREAMP_MIN_DB);
  const thumbBottomPct = ratio * 100;
  const fillBottomPct = preampDb >= 0 ? 50 : thumbBottomPct;
  const fillHeightPct = Math.abs(ratio - 0.5) * 100;

  return (
    <Card variant="inset" padding="none" className="flex shrink-0 flex-col items-center justify-between gap-2.5 px-3 py-3 md:w-38">
      {/* Header row with Poweramp-inspired preamp icon and hardware clip indicator */}
      <div className="flex w-full items-center justify-between gap-1.5">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-purple/25 bg-accent-purple/15 text-accent-purple"
          title={`${loc.dsp.preamp} ${loc.dsp.preampDesc}`}
          aria-hidden="true"
        >
          <Gauge size={15} />
        </div>
        <IconButton
          size="sm"
          label={clipDetected ? loc.dsp.clipIndicatorClipped : loc.dsp.clipIndicatorClear}
          onClick={onResetClip}
          data-testid="clip-indicator"
        >
          <StatusDot
            tone={clipDetected ? 'red' : 'neutral'}
            className={cn('size-2.5', clipDetected ? 'shadow-halo-sm shadow-accent-red/60' : 'opacity-40')}
          />
        </IconButton>
      </div>

      {/* Vertical Poweramp-style fader track & draggable pill thumb */}
      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label={loc.dsp.preamp}
        aria-orientation="vertical"
        aria-valuemin={PREAMP_MIN_DB}
        aria-valuemax={PREAMP_MAX_DB}
        aria-valuenow={preampDb}
        aria-valuetext={formatSignedDb(preampDb)}
        title={loc.dsp.preampResetTooltip}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onPreampChange(0)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="group flex min-h-48 w-full flex-1 cursor-ns-resize flex-col items-center rounded-xl py-5 select-none focus-visible:ring-2 focus-visible:ring-accent-pink/60 focus-visible:outline-none"
      >
        <div ref={trackRef} className="relative w-16 flex-1">
          {/* Subtle calibration ticks flanking the rail (with emphasized 0 dB center notch) */}
          {TICK_PERCENTS.map((pct) => {
            const isCenter = pct === 50;
            return (
              <div
                key={pct}
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-between',
                  isCenter ? 'w-12' : 'w-10',
                )}
                style={{ bottom: `${pct}%` }}
              >
                <span className={cn('h-px rounded-full', isCenter ? 'w-2.5 bg-fg-muted' : 'w-1.5 bg-white/20')} />
                <span className={cn('h-px rounded-full', isCenter ? 'w-2.5 bg-fg-muted' : 'w-1.5 bg-white/20')} />
              </div>
            );
          })}

          {/* Recessed center rail */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-white/10"
          />

          {/* Bipolar gain fill radiating from 0 dB */}
          {fillHeightPct > 0 && (
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full transition-[background-color]',
                preampDb >= 0 ? 'bg-linear-to-t from-accent-purple to-accent-pink' : 'bg-accent-cyan',
              )}
              style={{ bottom: `${fillBottomPct}%`, height: `${fillHeightPct}%` }}
            />
          )}

          {/* Poweramp-style capsule pill thumb */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-1/2 flex h-10 w-6.5 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border bg-surface shadow-panel transition-[border-color,box-shadow,transform] duration-150',
              preampDb > 0
                ? 'border-accent-pink/70 shadow-halo-sm shadow-accent-pink/40'
                : preampDb < 0
                  ? 'border-accent-cyan/70 shadow-halo-sm shadow-accent-cyan/40'
                  : 'border-line-accent group-hover:border-accent-pink/60 group-focus-visible:border-accent-pink',
              dragging && 'scale-105 border-accent-pink shadow-halo shadow-accent-pink/50',
            )}
            style={{ bottom: `${thumbBottomPct}%` }}
          >
            <span
              className={cn(
                'h-0.5 w-3 rounded-full transition-colors',
                preampDb > 0 ? 'bg-accent-pink' : preampDb < 0 ? 'bg-accent-cyan' : 'bg-fg-secondary',
              )}
            />
          </div>
        </div>
      </div>

      {/* Footer readout, Auto chip and 0 dB reset */}
      <div className="flex w-full flex-col items-center gap-1.5">
        <span className="max-w-full truncate text-xs font-bold text-fg" title={`${loc.dsp.preamp} ${loc.dsp.preampDesc}`}>
          {loc.dsp.preamp}
        </span>
        <Badge mono tone={preampDb > 0 ? 'pink' : preampDb < 0 ? 'cyan' : 'neutral'} className="min-w-16 justify-center">
          {formatSignedDb(preampDb)}
        </Badge>
        <div className="flex w-full items-center justify-center gap-1.5">
          <Chip size="xs" pressed={preampAuto} tone="cyan" onClick={onToggleAuto} title={loc.dsp.preampAutoTooltip}>
            <Sparkles size={12} /> {loc.dsp.preampAuto}
          </Chip>
          <Button size="sm" onClick={() => onPreampChange(0)} title={loc.dsp.preampResetTooltip}>
            0 dB
          </Button>
        </div>
        {preampAuto && equalizerEnabled && (
          <span className="text-center font-mono text-2xs text-fg-muted" data-testid="preamp-auto-readout">
            {fmt(loc.dsp.preampAutoReadout, formatSignedDb(autoPreampValue))}
          </span>
        )}
      </div>
    </Card>
  );
};
