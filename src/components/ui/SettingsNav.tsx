import type React from 'react';
import { useRef } from 'react';
import { cn } from '../../utils/cn';
import { ToolGroup } from './ToolGroup';

export interface SettingsNavItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  /** Bubble pinned to the item's top-right corner (e.g. the "new" marker on Updates); it floats over the item, so it never changes the layout. */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SettingsNavGroup<T extends string> {
  id: string;
  /** Eyebrow label shown above the items. */
  label?: string;
  items: readonly SettingsNavItem<T>[];
}

export interface SettingsNavProps<T extends string> {
  groups: readonly SettingsNavGroup<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the whole list. */
  label: string;
  /** `vertical` is the side rail; `horizontal` is the scrollable strip used on narrow widths (no eyebrows). */
  orientation?: 'vertical' | 'horizontal';
  /** Builds the `id` of each tab so a `tabpanel` can reference it with `aria-labelledby`. */
  tabId?: (id: T) => string;
  /** The `id` of the panel each tab controls (`aria-controls`). */
  panelId?: string;
  className?: string;
}

/**
 * Side navigation for the settings modal: a `tablist` of grouped tabs with a solid purple active
 * item (as in `AppNavbar`). Only the selected tab is in the Tab order; arrow keys, Home and End
 * move the selection, Enter and Space activate the focused tab.
 */
export function SettingsNav<T extends string>({
  groups,
  value,
  onChange,
  label,
  orientation = 'vertical',
  tabId,
  panelId,
  className,
}: SettingsNavProps<T>) {
  const vertical = orientation === 'vertical';
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const enabledIds = groups.flatMap((g) => g.items.filter((i) => !i.disabled).map((i) => i.id));

  const select = (id: T) => {
    onChange(id);
    tabRefs.current.get(id)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, id: T) => {
    const pos = enabledIds.indexOf(id);
    if (pos < 0) return;
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    let next: T | undefined;
    if (e.key === nextKey) next = enabledIds[(pos + 1) % enabledIds.length];
    else if (e.key === prevKey) next = enabledIds[(pos - 1 + enabledIds.length) % enabledIds.length];
    else if (e.key === 'Home') next = enabledIds[0];
    else if (e.key === 'End') next = enabledIds[enabledIds.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    select(next);
  };

  return (
    <ToolGroup
      role="tablist"
      aria-orientation={orientation}
      label={label}
      className={cn(
        vertical ? 'flex flex-col gap-3' : 'scrollbar-none flex gap-1 overflow-x-auto',
        className,
      )}
    >
      {groups.map((group) => (
        <div key={group.id} className={cn('flex gap-0.5', vertical ? 'flex-col' : 'shrink-0')}>
          {vertical && group.label && (
            <div aria-hidden="true" className="label-caps px-3 pt-1 pb-0.5 text-fg-muted">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const selected = item.id === value;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(item.id, el);
                  else tabRefs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={tabId?.(item.id)}
                aria-selected={selected}
                aria-controls={selected ? panelId : undefined}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => onChange(item.id)}
                onKeyDown={(e) => onKeyDown(e, item.id)}
                className={cn(
                  'relative flex items-center gap-2 rounded-xl px-3 py-2 text-left text-ui font-semibold whitespace-nowrap text-fg-secondary hover:text-fg',
                  'aria-selected:bg-accent-purple aria-selected:text-fg aria-selected:shadow-halo-sm aria-selected:shadow-accent-purple/40',
                  !vertical && 'shrink-0',
                )}
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="pointer-events-none absolute -top-1 -right-0.5 z-1 flex">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </ToolGroup>
  );
}
