import type React from 'react';
import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { Button } from './Button';
import { iconTileTones, type Tone } from './tones';

/*
 * Stacking scale for overlays (bare z-index numbers, not arbitrary values):
 *   z-30 dock · z-40 drawer · z-50 overlay · z-60 modal · z-70 nested modal ·
 *   z-80 command palette · z-90 toast · z-100 fatal error
 */
const backdropVariants = cva(
  'fixed inset-0 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm motion-safe:animate-fade-in',
  {
    variants: {
      layer: {
        modal: 'z-60',
        nested: 'z-70',
        palette: 'z-80',
      },
    },
    defaultVariants: { layer: 'modal' },
  },
);

const panelVariants = cva(
  'bg-modal relative flex max-h-[90vh] w-full flex-col rounded-2xl border border-line-accent text-fg shadow-modal motion-safe:animate-modal-in',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        md: 'max-w-140',
        lg: 'max-w-170',
        xl: 'max-w-205',
        '2xl': 'max-w-240',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface ModalShellProps extends VariantProps<typeof backdropVariants>, VariantProps<typeof panelVariants> {
  onClose: () => void;
  /** Id of the element that names the dialog (usually the `ModalHeader` title). */
  labelledBy?: string;
  /** Extra classes for the panel, e.g. a different surface or padding. */
  className?: string;
  /** Close when the backdrop itself is clicked. */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/**
 * Backdrop + dialog panel shared by every modal. Escape and a click on the backdrop call
 * `onClose`; clicks inside the panel never reach the backdrop.
 */
export function ModalShell({
  onClose,
  labelledBy,
  className,
  layer,
  size,
  closeOnBackdrop = true,
  children,
}: ModalShellProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className={backdropVariants({ layer })}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={cn(panelVariants({ size }), className)}>
        {children}
      </div>
    </div>
  );
}

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Id for the title, passed to `ModalShell`'s `labelledBy`. */
  titleId?: string;
  onClose?: () => void;
  closeLabel?: string;
  /** Extra content between the title and the close button (badges, actions). */
  actions?: React.ReactNode;
  /** Full-width header bar with a divider, for modals with scrolling bodies. */
  bar?: boolean;
  className?: string;
}

export function ModalHeader({
  title,
  subtitle,
  icon,
  tone = 'purple',
  titleId,
  onClose,
  closeLabel = 'Close',
  actions,
  bar = false,
  className,
}: ModalHeaderProps) {
  const fallbackId = useId();
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        bar ? 'shrink-0 border-b border-line bg-white/2 px-6 py-4.5' : 'mb-4.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', iconTileTones[tone])}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 id={titleId ?? fallbackId} className="text-lg font-bold">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-ui text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {(actions || onClose) && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
              <X size={18} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
