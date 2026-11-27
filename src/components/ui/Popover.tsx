import type React from 'react';
import { useEffect, useRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { Check } from './icons';

const panelVariants = cva(
  'absolute z-50 flex min-w-48 flex-col gap-0.5 rounded-xl border border-line-accent bg-modal p-1.5 shadow-modal motion-safe:animate-fade-in-scale',
  {
    variants: {
      align: { start: 'left-0', end: 'right-0' },
      side: { bottom: 'top-full mt-2', top: 'bottom-full mb-2' },
    },
    defaultVariants: { align: 'start', side: 'bottom' },
  },
);

export interface PopoverProps extends VariantProps<typeof panelVariants> {
  open: boolean;
  onClose: () => void;
  /** The element that opens the popover; it stays inside the outside-click boundary. */
  trigger: React.ReactNode;
  /** Role of the panel: `menu` for `MenuItem` lists, `dialog` for free content. */
  role?: 'menu' | 'dialog' | 'listbox';
  label?: string;
  /** Classes for the panel. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Small floating panel anchored to its trigger (preset pickers, overflow menus). A click outside
 * the trigger and panel, or Escape, calls `onClose`.
 */
export function Popover({ open, onClose, trigger, role = 'menu', label, align, side, className, children }: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger}
      {open && (
        <div role={role} aria-label={label} className={cn(panelVariants({ align, side }), className)}>
          {children}
        </div>
      )}
    </div>
  );
}

export interface MenuItemProps extends Omit<React.ComponentProps<'button'>, 'role'> {
  icon?: React.ReactNode;
  /** Makes the item a radio choice: it gets `aria-checked` and a check mark when selected. */
  selected?: boolean;
}

/** One row of a `Popover` menu. */
export function MenuItem({ icon, selected, type = 'button', className, children, ...props }: MenuItemProps) {
  const isChoice = selected !== undefined;
  return (
    <button
      type={type}
      role={isChoice ? 'menuitemradio' : 'menuitem'}
      aria-checked={isChoice ? selected : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left text-ui text-fg-secondary hover:bg-white/8 hover:text-fg aria-checked:bg-accent-pink/15 aria-checked:text-accent-pink',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && <Check size={14} className="shrink-0" aria-hidden="true" />}
    </button>
  );
}
