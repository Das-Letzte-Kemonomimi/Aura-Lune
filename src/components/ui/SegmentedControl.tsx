import type React from 'react';
import { useRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { selectedTones, type Tone } from './tones';

const tabVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent font-semibold whitespace-nowrap text-fg-muted hover:text-fg',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1 text-xs',
        md: 'px-3.5 py-1.5 text-ui',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface SegmentedItem<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Accessible name when `label` is not plain text (or is empty). */
  ariaLabel?: string;
  /** Native tooltip. */
  title?: string;
  disabled?: boolean;
  /** Overrides the group tone for this tab (e.g. a warning filter). */
  tone?: Tone;
}

export interface SegmentedControlProps<T extends string> {
  items: readonly SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the whole group. */
  label: string;
  size?: 'sm' | 'md';
  tone?: Tone;
  /** Stretch the tabs to fill the row. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * One-of-many switch (view modes, tab bars). Rendered as a `tablist`: only the selected tab is in
 * the Tab order, and the arrow keys, Home and End move the selection.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  size,
  tone = 'pink',
  fullWidth,
  className,
}: SegmentedControlProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.value);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(index);
    if (pos < 0) return;
    let next: number | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    select(next);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'inline-flex gap-1 rounded-xl border border-line bg-black/30 p-1',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={item.ariaLabel}
            title={item.title}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(tabVariants({ size }), selectedTones[item.tone ?? tone], fullWidth && 'flex-1')}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
