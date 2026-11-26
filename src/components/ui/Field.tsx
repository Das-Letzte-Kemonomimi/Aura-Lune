import type React from 'react';
import { cn } from '../../utils/cn';

/** Classes for a dark inset text field; also usable on <textarea>. */
export const inputClass =
  'w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent-purple focus-visible:ring-2 focus-visible:ring-accent-purple/25';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

/** Form label above a field. */
export function FieldLabel({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('mb-1.5 block text-ui font-semibold text-slate-200', className)} {...props} />;
}
