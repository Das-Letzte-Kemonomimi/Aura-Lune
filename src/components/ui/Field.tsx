import type React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

/* The focus ring comes from `styles/base.css`; never add `outline-none` to a field. */
const fieldVariants = cva(
  'w-full rounded-lg border border-line bg-black/30 text-fg focus-visible:border-accent-pink disabled:opacity-45',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-3 py-2 text-ui',
      },
      mono: { true: 'font-mono', false: '' },
      withIcon: { true: 'pl-9', false: '' },
    },
    defaultVariants: { size: 'md', mono: false, withIcon: false },
  },
);

interface FieldOptions {
  size?: 'sm' | 'md';
  /** Monospace text (paths, URLs, numbers). */
  mono?: boolean;
}

export interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'size'>, FieldOptions {
  /** Icon shown inside the field on the left (search, link). */
  icon?: React.ReactNode;
}

/** Single-line text input. `type="text"` by default. */
export function TextField({ size, mono, icon, type = 'text', className, ...props }: TextFieldProps) {
  const input = (
    <input
      type={type}
      className={cn(fieldVariants({ size, mono, withIcon: Boolean(icon) }), !icon && className)}
      {...props}
    />
  );
  if (!icon) return input;
  return (
    <div className={cn('relative w-full', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 text-fg-muted">{icon}</span>
      {input}
    </div>
  );
}

export interface TextAreaProps extends React.ComponentProps<'textarea'>, FieldOptions {}

/** Multi-line text input. */
export function TextArea({ size, mono, className, ...props }: TextAreaProps) {
  return <textarea className={cn(fieldVariants({ size, mono }), 'resize-y', className)} {...props} />;
}

export interface SelectProps extends Omit<React.ComponentProps<'select'>, 'size'> {
  size?: 'sm' | 'md';
}

/**
 * Native select. Its colours, arrow and hover come from `styles/base.css` (forced there so the
 * GTK theme cannot bleed through); this only sets the width and size.
 */
export function Select({ size = 'md', className, ...props }: SelectProps) {
  return <select className={cn('w-full', size === 'sm' && 'py-1 text-xs', className)} {...props} />;
}

export interface FieldLabelProps extends React.ComponentProps<'label'> {}

/** Small uppercase label above a field. Pass `htmlFor` with the field's id. */
export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return <label className={cn('label-caps mb-1.5 block', className)} {...props} />;
}
