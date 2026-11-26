import type React from 'react';
import { ArrowUpDown, SortAscending, SortDescending } from '../../../components/ui/icons';
import { IconButton, Select } from '../../../components/ui';

export interface SortControlsProps<F extends string> {
  /** Accessible name of the sort-field select. */
  label: string;
  field: F;
  options: readonly { value: F; label: string }[];
  onFieldChange: (field: F) => void;
  order: 'asc' | 'desc';
  onToggleOrder: () => void;
  ascLabel: string;
  descLabel: string;
  /** Visible text before the select (the select is still named by `label`). */
  caption?: React.ReactNode;
  className?: string;
}

/** Sort-field select and the ascending/descending toggle, shared by the track and album toolbars. */
export function SortControls<F extends string>({
  label,
  field,
  options,
  onFieldChange,
  order,
  onToggleOrder,
  ascLabel,
  descLabel,
  caption,
  className,
}: SortControlsProps<F>) {
  return (
    <div className={className ?? 'flex items-center gap-1.5'}>
      <ArrowUpDown size={13} className="text-fg-muted" aria-hidden="true" />
      {caption && <span className="text-xs font-semibold text-fg-muted">{caption}</span>}
      <Select
        size="sm"
        aria-label={label}
        value={field}
        // The options are built from `options`, so the value is always one of them.
        onChange={(e) => onFieldChange(e.target.value as F)}
        className="w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <IconButton
        variant="secondary"
        size="sm"
        label={order === 'asc' ? ascLabel : descLabel}
        onClick={onToggleOrder}
        className="text-accent-cyan"
      >
        {order === 'asc' ? <SortAscending size={14} /> : <SortDescending size={14} />}
      </IconButton>
    </div>
  );
}
