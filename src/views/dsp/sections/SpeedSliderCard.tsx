import type React from 'react';
import { useId, useRef, useState } from 'react';
import { Card, Chip, NudgeButtons, RangeSlider, TextField, type Tone } from '../../../components/ui';
import { textTones } from '../../../components/ui/tones';
import { cn } from '../../../utils/cn';
import { SPEED_NUDGES, clamp, parseSpeedEntry, round2 } from './speedSliderModel';

export interface SpeedSliderCardProps {
  label: string;
  tone: Tone;
  value: number;
  onChange: (value: number) => void;
  /** Range of the slider itself. */
  sliderMin: number;
  sliderMax: number;
  /** Limits for typed values and nudges; wider than the slider so odd values can still be typed. */
  min: number;
  max: number;
  formatStep?: (step: number) => string;
  /** Text shown in the value field when it is not being edited. */
  formatEntry: (value: number) => string;
  placeholder: string;
  /** Tooltip of the value field (how to type a value). */
  entryTitle: string;
  /** Unit and conversions after the value field. */
  unit: React.ReactNode;
  /** Resulting key / tempo line under the value. */
  info: React.ReactNode;
  presets: readonly { value: number; label: string }[];
}

/**
 * One speed control of the DSP studio (pitch, tempo or rate): nudge buttons, a value field that
 * takes typed values and Up/Down (Shift for fine steps), the slider and preset chips.
 */
export function SpeedSliderCard({
  label,
  tone,
  value,
  onChange,
  sliderMin,
  sliderMax,
  min,
  max,
  formatStep,
  formatEntry,
  placeholder,
  entryTitle,
  unit,
  info,
  presets,
}: SpeedSliderCardProps) {
  const fieldId = useId();
  // Text being typed; null while the field shows the live value.
  const [draft, setDraft] = useState<string | null>(null);
  // Set by Escape so the blur that follows discards the draft instead of applying it.
  const cancelled = useRef(false);

  const step = (direction: 1 | -1, fine: boolean) => {
    const current = parseSpeedEntry(draft ?? String(value));
    if (Number.isNaN(current)) return;
    const next = clamp(round2(current + direction * (fine ? 0.01 : 0.1)), min, max);
    setDraft(formatEntry(next));
    onChange(next);
  };

  const commit = () => {
    if (draft === null) return;
    const typed = parseSpeedEntry(draft);
    if (!cancelled.current && !Number.isNaN(typed)) onChange(clamp(round2(typed), min, max));
    cancelled.current = false;
    setDraft(null);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={fieldId} className="text-sm font-semibold text-fg">
            {label}
          </label>
          <NudgeButtons
            value={value}
            onChange={onChange}
            steps={SPEED_NUDGES}
            min={min}
            max={max}
            formatStep={formatStep}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <TextField
              id={fieldId}
              size="sm"
              mono
              value={draft ?? formatEntry(value)}
              onFocus={(e) => {
                setDraft(formatEntry(value));
                e.target.select();
              }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
                } else if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  cancelled.current = true;
                  e.currentTarget.blur();
                }
              }}
              onBlur={commit}
              placeholder={placeholder}
              title={entryTitle}
              className={cn('w-17 cursor-text text-center font-bold', textTones[tone])}
            />
            <span className={cn('font-mono text-sm font-semibold', textTones[tone])}>{unit}</span>
          </div>
          <div className={cn('flex flex-wrap items-center justify-end gap-2 text-xs font-semibold', textTones[tone])}>
            {info}
          </div>
        </div>
      </div>
      <RangeSlider
        aria-label={label}
        min={sliderMin}
        max={sliderMax}
        step={0.01}
        value={value}
        onChange={onChange}
        className="my-4"
      />
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <Chip
            key={p.value}
            tone={tone}
            pressed={Math.abs(value - p.value) < 0.005}
            onClick={() => onChange(p.value)}
            className="flex-1 py-2"
          >
            {p.label}
          </Chip>
        ))}
      </div>
    </Card>
  );
}
