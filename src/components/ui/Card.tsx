import type React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { highlightTones, iconTileTones, type Tone } from './tones';

const cardVariants = cva('border border-line', {
  variants: {
    variant: {
      /** Top-level surface of a view section. */
      panel: 'rounded-2xl bg-surface shadow-panel',
      /** Card inside a panel. */
      card: 'rounded-xl bg-card',
      /** Recessed well (readouts, code, previews). */
      inset: 'rounded-xl bg-black/30',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
    /** Hover highlight for a card that is itself clickable (the `glass-card` hover). */
    interactive: {
      true: 'hover:border-line-accent hover:bg-surface-hover',
      false: '',
    },
  },
  defaultVariants: { variant: 'card', padding: 'md', interactive: false },
});

export interface CardProps extends React.ComponentProps<'div'>, VariantProps<typeof cardVariants> {
  /** Tint the card while the feature it controls is on (`false` or unset: no tint). */
  highlight?: Tone | false;
}

/** Surface container. Use it instead of `glass-panel` / `glass-card` and hand-written card classes. */
export function Card({ variant, padding, interactive, highlight, className, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding, interactive }), highlight && highlightTones[highlight], className)}
      {...props}
    />
  );
}

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Icon shown in a tinted tile before the title. */
  icon?: React.ReactNode;
  tone?: Tone;
  /** Controls aligned to the right of the title (buttons, a switch). */
  actions?: React.ReactNode;
  as?: 'h2' | 'h3';
  /** Id for the heading, e.g. to label the section with `aria-labelledby`. */
  id?: string;
  className?: string;
}

/** Icon + heading + description row at the top of a card or settings section. */
export function SectionHeader({
  title,
  description,
  icon,
  tone = 'purple',
  actions,
  as: Heading = 'h3',
  id,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconTileTones[tone])}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <Heading id={id} className="text-md font-bold text-fg">
            {title}
          </Heading>
          {description && <p className="mt-1 text-xs text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const pageHeaderTile = cva('flex shrink-0 items-center justify-center border border-current/25', {
  variants: {
    size: {
      md: 'size-10 rounded-xl',
      /** Settings pages: the tile matches `ModalHeader` and carries a 22px icon. */
      lg: 'size-11 rounded-2xl',
    },
  },
  defaultVariants: { size: 'md' },
});

const pageHeaderTitle = cva('font-bold text-fg', {
  variants: { size: { md: 'text-lg', lg: 'text-xl' } },
  defaultVariants: { size: 'md' },
});

export interface PageHeaderProps extends VariantProps<typeof pageHeaderTile> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Icon shown in a tinted tile before the title. */
  icon?: React.ReactNode;
  tone?: Tone;
  /** Buttons aligned to the right of the heading; they wrap below it on narrow windows. */
  actions?: React.ReactNode;
  className?: string;
}

/** The h2 heading at the top of a view or settings tab. */
export function PageHeader({ title, description, icon, tone = 'pink', size, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className={cn(pageHeaderTile({ size }), iconTileTones[tone])}>{icon}</span>
        )}
        <div className="min-w-0">
          <h2 className={pageHeaderTitle({ size })}>{title}</h2>
          {description && <p className="mt-0.5 text-ui text-fg-secondary">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface SettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** The control on the right (a `ToggleSwitch`, `Select`, `Button`…). */
  control?: React.ReactNode;
  /** Extra content below the row (sliders, hints). */
  children?: React.ReactNode;
  className?: string;
}

/** One setting: title and description on the left, its control on the right. */
export function SettingRow({ title, description, icon, control, children, className }: SettingRowProps) {
  return (
    <div className={cn('py-3', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className="mt-0.5 shrink-0 text-fg-muted">{icon}</span>}
          <div className="min-w-0">
            <div className="text-ui font-semibold text-fg">{title}</div>
            {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
          </div>
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
