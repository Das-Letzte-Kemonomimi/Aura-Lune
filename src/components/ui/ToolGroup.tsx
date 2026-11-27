import type React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const toolGroupVariants = cva('border border-line bg-black/25 p-1', {
  variants: {
    size: {
      md: 'rounded-2xl',
      sm: 'rounded-xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export interface ToolGroupProps extends Omit<React.ComponentProps<'div'>, 'aria-label'>, VariantProps<typeof toolGroupVariants> {
  /** Accessible name of the group. */
  label?: string;
}

/** Dark inset container that holds a row or column of related controls (nav items, transport buttons). */
export function ToolGroup({ size, label, role = 'group', className, ...props }: ToolGroupProps) {
  return <div role={role} aria-label={label} className={cn(toolGroupVariants({ size }), className)} {...props} />;
}
