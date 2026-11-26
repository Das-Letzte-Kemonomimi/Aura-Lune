import type React from 'react';

/**
 * Types CSS custom properties for a `style` prop. React's `CSSProperties` has no index for
 * `--*` names, so runtime values that classes read (`range-fill` reads `--fill`) go through here:
 * `style={cssVars({ '--fill': `${pct}%` })}`.
 */
export function cssVars(vars: Record<`--${string}`, string | number>): React.CSSProperties {
  return vars as React.CSSProperties;
}
