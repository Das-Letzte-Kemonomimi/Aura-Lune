/**
 * Applies an explicit alpha (`opacity` in `[0, 1]`) to a CSS colour string
 * (`rgba(...)`, `rgb(...)`, or any fallback colour via `color-mix()`).
 */
export function setCssColorOpacity(color: string, opacity: number): string {
  const clamped = Math.round(Math.min(1, Math.max(0, opacity)) * 1000) / 1000;
  const rgbaMatch = color
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*[\d.]+)?\s*\)$/i);
  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  const pct = Math.round(clamped * 100);
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
