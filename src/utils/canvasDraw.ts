/** Canvas drawing helpers shared by the visualisations. */

/** Clamps devicePixelRatio to a sensible range (memory and fill cost grow with its square). */
export function clampDpr(dpr: number, max = 2): number {
  if (!Number.isFinite(dpr) || dpr < 1) return 1;
  return Math.min(max, dpr);
}

/**
 * Canvas buffer size. It is rounded (not truncated): `canvas.width` is an integer, so with
 * a fractional DPR (1.25, 1.5) the comparison `canvas.width !== css * dpr` was always true and the buffer
 * was reallocated and cleared on every frame.
 */
export function computeBackingSize(cssWidth: number, cssHeight: number, dpr: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr)),
  };
}

/** Gradient cache (e.g. by rounded bar length). Clear it when the size/DPR/theme changes. */
export class GradientCache {
  private readonly map = new Map<string, CanvasGradient>();
  private readonly maxEntries: number;

  constructor(maxEntries = 256) {
    this.maxEntries = maxEntries;
  }

  get(key: string, create: () => CanvasGradient): CanvasGradient {
    const hit = this.map.get(key);
    if (hit) return hit;
    // Unbounded growth (e.g. many different heights): start over once the limit is exceeded.
    if (this.map.size >= this.maxEntries) this.map.clear();
    const gradient = create();
    this.map.set(key, gradient);
    return gradient;
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export type RoundRectRadii = number | readonly number[];

function expandRadii(radii: RoundRectRadii): [number, number, number, number] {
  if (typeof radii === 'number') return [radii, radii, radii, radii];
  const r = radii;
  if (r.length === 1) return [r[0], r[0], r[0], r[0]];
  if (r.length === 2) return [r[0], r[1], r[0], r[1]];
  if (r.length === 3) return [r[0], r[1], r[2], r[1]];
  return [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 0];
}

/**
 * Adds a rounded rectangle to the current path. Uses `ctx.roundRect`, and when it is missing
 * (older WebKitGTK) a manual path made of arcs, instead of throwing in the drawing loop.
 */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: RoundRectRadii = 0,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radii as number | number[]);
    return;
  }
  const [tl0, tr0, br0, bl0] = expandRadii(radii);
  const limit = Math.max(0, Math.min(Math.abs(w), Math.abs(h)) / 2);
  const tl = Math.min(Math.max(0, tl0), limit);
  const tr = Math.min(Math.max(0, tr0), limit);
  const br = Math.min(Math.max(0, br0), limit);
  const bl = Math.min(Math.max(0, bl0), limit);
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}
