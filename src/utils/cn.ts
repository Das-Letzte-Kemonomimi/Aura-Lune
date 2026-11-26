import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default scale names. Register the project tokens from
 * `src/styles/theme.css` so it groups them correctly: without this, `text-ui` would be read as
 * a text *colour* and `cn('text-ui', 'text-fg')` would drop one of the two classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'xxs', 'ui', 'md'],
      shadow: ['accent-glow', 'panel', 'brand', 'brand-glow', 'modal'],
      tracking: ['label'],
    },
  },
});

/** Joins conditional class names and resolves Tailwind conflicts (the last class wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
