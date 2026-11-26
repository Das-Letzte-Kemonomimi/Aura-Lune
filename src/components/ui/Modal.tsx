import type React from 'react';
import { useEffect, useRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { IconButton } from './Button';
import { X } from './icons';
import { iconTileTones, type Tone } from './tones';

/*
 * Stacking scale (bare z-index numbers, see the tailwind-v4 skill):
 *   30 header · 40 dock · 50 drawer · 60 modal · 70 nested · 80 system · 90 studio ·
 *   100 tool · 110 tool dialog · 120 top (palette, recap) · 130 OSD · 140 fatal
 */
const backdropVariants = cva(
  'fixed inset-0 flex justify-center bg-black/75 p-5 backdrop-blur-sm motion-safe:animate-fade-in',
  {
    variants: {
      placement: {
        center: 'items-center',
        /** Anchored near the top, for search-style dialogs (command palette). */
        top: 'items-start pt-[12vh]',
      },
      layer: {
        /** Ordinary modal. */
        modal: 'z-60',
        /** Opened on top of another modal (settings → sleep timer, playlist picker…). */
        nested: 'z-70',
        /** Onboarding and system checks. */
        system: 'z-80',
        /** Large studio workspaces (tag editor, stem studio, mixers). */
        studio: 'z-90',
        /** Tools opened over a studio (parametric EQ, AutoEQ, harmonic suggester). */
        tool: 'z-100',
        /** Dialog opened from a tool. */
        toolDialog: 'z-110',
        /** Always on top: command palette, recap, key/BPM. */
        top: 'z-120',
      },
    },
    defaultVariants: { layer: 'modal', placement: 'center' },
  },
);

const panelVariants = cva(
  'bg-modal relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-line-accent text-fg shadow-modal motion-safe:animate-modal-in',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        md: 'max-w-140',
        lg: 'max-w-170',
        xl: 'max-w-205',
        '2xl': 'max-w-240',
        /** Wide tools whose height follows their content (parametric EQ). */
        '3xl': 'max-w-270',
        /** Workspaces that use the whole window (studios, editors). */
        full: 'h-[90vh] max-w-[96vw]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface ModalShellProps extends VariantProps<typeof backdropVariants>, VariantProps<typeof panelVariants> {
  onClose: () => void;
  /** Id of the element that names the dialog (usually its title heading). */
  labelledBy?: string;
  /** Accessible name for a dialog without a visible title (command palette). */
  label?: string;
  /** Extra classes for the panel, e.g. a different surface or padding. */
  className?: string;
  /** Runtime-only panel styles (computed sizes, per-item colours). */
  style?: React.CSSProperties;
  /** Close when the backdrop itself is clicked. */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/** Open dialogs in mount order; the last one is on top and is the only one Escape closes. */
const openModals: symbol[] = [];

/**
 * Backdrop + dialog panel shared by every modal. Escape (topmost dialog only) and a click on the
 * backdrop call `onClose`; clicks inside the panel never reach the backdrop.
 */
export function ModalShell({
  onClose,
  labelledBy,
  label,
  className,
  style,
  layer,
  placement,
  size,
  closeOnBackdrop = true,
  children,
}: ModalShellProps) {
  // Read through a ref so a new `onClose` each render neither re-subscribes nor reorders the stack.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const token = Symbol('modal');
    openModals.push(token);
    const onKeyDown = (e: KeyboardEvent) => {
      // Only the most recently opened dialog answers Escape, so nested dialogs close one at a time.
      if (e.key !== 'Escape' || openModals[openModals.length - 1] !== token) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(token), 1);
    };
  }, []);

  return (
    <div
      className={backdropVariants({ layer, placement })}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        className={cn(panelVariants({ size }), className)}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}

export interface ModalHeaderProps {
  title: React.ReactNode;
  /** Id of the title heading; pass the same value to `ModalShell`'s `labelledBy`. */
  titleId?: string;
  subtitle?: React.ReactNode;
  /** Icon shown in a tinted tile before the title. */
  icon?: React.ReactNode;
  tone?: Tone;
  /** Renders a close button when set. */
  onClose?: () => void;
  /** Accessible name of the close button (usually `loc.common.close`). */
  closeLabel?: string;
  /** Extra controls placed before the close button. */
  actions?: React.ReactNode;
  className?: string;
}

/** Title bar of a dialog: icon tile, title, subtitle, actions and the close button. */
export function ModalHeader({
  title,
  titleId,
  subtitle,
  icon,
  tone = 'pink',
  onClose,
  closeLabel = 'Close',
  actions,
  className,
}: ModalHeaderProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-3 border-b border-line px-6 py-4', className)}>
      {icon && (
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', iconTileTones[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="truncate text-lg font-bold text-fg">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      {onClose && (
        <IconButton label={closeLabel} onClick={onClose}>
          <X size={18} />
        </IconButton>
      )}
    </div>
  );
}

/** Scrolling content area of a dialog. */
export function ModalBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-4', className)} {...props} />;
}

/** Action row at the bottom of a dialog; buttons align to the right. */
export function ModalFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-4', className)}
      {...props}
    />
  );
}
