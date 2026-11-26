import type React from 'react';
import { useId } from 'react';
import { cn } from '../../utils/cn';
import { cssVars } from '../../utils/cssVars';
import { Badge } from './Badge';
import { textTones, type Tone } from './tones';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function decimalsOf(n: number): number {
  return (String(n).split('.')[1] ?? '').length;
}

/**
 * Rounds away float noise from a nudge (0.2 + 0.1 → 0.3) while keeping the finer of the two
 * precisions, so +0.1 on 1.05 gives 1.15 and not 1.2.
 */
function roundNudge(value: number, current: number, step: number): number {
  const decimals = Math.min(6, Math.max(decimalsOf(step), decimalsOf(current)));
  return Number(value.toFixed(decimals));
}

export interface NudgeButtonsProps {
  value: number;
  onChange: (value: number) => void;
  /** Signed steps, one button each, e.g. `[-1, -0.1, 0.1, 1]`. */
  steps: readonly number[];
  min: number;
  max: number;
  /** Button text for a step; defaults to `−1` / `+1`. */
  formatStep?: (step: number) => string;
  disabled?: boolean;
  className?: string;
}

const defaultStepLabel = (step: number) => `${step < 0 ? '−' : '+'}${Math.abs(step)}`;

/** Fine-adjust buttons next to a slider. Each one adds its step and clamps to `min`…`max`. */
export function NudgeButtons({
  value,
  onChange,
  steps,
  min,
  max,
  formatStep = defaultStepLabel,
  disabled,
  className,
}: NudgeButtonsProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      {steps.map((step) => {
        const next = clamp(roundNudge(value + step, value, step), min, max);
        return (
          <button
            key={step}
            type="button"
            disabled={disabled || next === value}
            onClick={() => onChange(next)}
            className="rounded-md border border-line bg-white/5 px-2 py-0.5 font-mono text-xxs font-semibold text-fg-secondary hover:bg-white/8 hover:text-fg"
          >
            {formatStep(step)}
          </button>
        );
      })}
    </div>
  );
}

export interface RangeSliderProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'min' | 'max'> {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

/**
 * Bare range input with the gradient fill up to the thumb. Use it where the label and readout
 * are laid out by hand (EQ bands, the speed cards); otherwise use `SliderRow`.
 */
export function RangeSlider({ value, onChange, min, max, className, style, ...props }: RangeSliderProps) {
  const pct = max > min ? ((clamp(value, min, max) - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('range-fill w-full', className)}
      style={{ ...cssVars({ '--fill': `${pct}%` }), ...style }}
      {...props}
    />
  );
}

export interface SliderRowProps {
  label: React.ReactNode;
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Readout text; defaults to the raw number. */
  format?: (value: number) => string;
  /** Colour of the readout. */
  tone?: Tone;
  /** Signed nudge steps shown under the slider (see `NudgeButtons`). */
  nudges?: readonly number[];
  disabled?: boolean;
  className?: string;
}

/** Labelled range slider with a value readout and optional nudge buttons. */
export function SliderRow({
  label,
  ariaLabel,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  tone = 'pink',
  nudges,
  disabled,
  className,
}: SliderRowProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold text-fg-secondary">
          {label}
        </label>
        <Badge mono className={textTones[tone]}>
          {format(value)}
        </Badge>
      </div>
      <RangeSlider
        id={id}
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
      {nudges && nudges.length > 0 && (
        <NudgeButtons
          value={value}
          onChange={onChange}
          steps={nudges}
          min={min}
          max={max}
          disabled={disabled}
          className="justify-end"
        />
      )}
    </div>
  );
}
