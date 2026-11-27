/**
 * Static waveform layers: the wave body of the `smooth`, `bars` and `mirror` styles depends only on
 * (peaks, bands, size, colours), not on the playback position. It is drawn once into two offscreen canvases
 * (all unplayed / all played) and every progress tick only blits them with a clip at the playhead,
 * instead of rebuilding the spline or every bar 10×/s.
 */
import type { SpectralBandTriple } from '../../types/analysis';
import { roundRectPath } from '../../utils/canvasDraw';
import { computeBarLayout, resampleBands, resamplePeaks, spectralColor } from './waveformGeometry';

export type LayeredWaveStyle = 'smooth' | 'bars' | 'mirror';

export interface WaveColors {
  start: string;
  end: string;
  unplayed: string;
}

export interface WaveLayerSpec {
  style: LayeredWaveStyle;
  peaks: number[];
  /** Spectral colours per peak (empty or a different length = monochrome gradient). */
  bands: SpectralBandTriple[];
  /** CSS size (px). */
  width: number;
  height: number;
  colors: WaveColors;
}

export interface WaveLayers {
  unplayed: HTMLCanvasElement;
  played: HTMLCanvasElement;
}

const FALLBACK_START = '#f43f5e';
const FALLBACK_END = '#a855f7';

/** Horizontal gradient for the played part (start → end colour). */
export function horizontalPlayedGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  colors: WaveColors,
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  try {
    grad.addColorStop(0, colors.start);
    grad.addColorStop(1, colors.end);
  } catch {
    grad.addColorStop(0, FALLBACK_START);
    grad.addColorStop(1, FALLBACK_END);
  }
  return grad;
}

/** Vertical gradient for played bars (start → end → cyan). */
export function verticalPlayedGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  colors: WaveColors,
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  try {
    grad.addColorStop(0, colors.start);
    grad.addColorStop(0.5, colors.end);
    grad.addColorStop(1, '#06b6d4');
  } catch {
    grad.addColorStop(0, FALLBACK_START);
    grad.addColorStop(1, FALLBACK_END);
  }
  return grad;
}

function hasSpectral(spec: WaveLayerSpec): boolean {
  return spec.bands.length > 0 && spec.bands.length === spec.peaks.length;
}

function barLayoutFor(spec: WaveLayerSpec) {
  return spec.style === 'mirror'
    ? computeBarLayout(spec.width, spec.peaks.length, 2.5, 2)
    : computeBarLayout(spec.width, spec.peaks.length, 3, 2.5);
}

/**
 * The x (CSS px) up to which the played layer is shown. Smooth: exactly the playhead.
 * Bars/mirror: a bar counts as played once its centre is at or left of the playhead, so the clip
 * snaps into the gap after the last played bar (a bar is never cut in half).
 */
export function playedClipX(spec: WaveLayerSpec, currentX: number): number {
  if (currentX <= 0) return 0;
  if (spec.style === 'smooth') return Math.min(spec.width, currentX);
  const { count, barWidth, step } = barLayoutFor(spec);
  const reach = currentX - barWidth / 2;
  if (reach < 0) return 0;
  const played = Math.min(count, Math.floor(reach / step) + 1);
  if (played >= count) return spec.width;
  return played * step - (step - barWidth) / 2;
}

function drawSmooth(ctx: CanvasRenderingContext2D, spec: WaveLayerSpec, played: boolean): void {
  const { peaks, width, height, colors } = spec;
  // The curve needs at least 2 points (otherwise division by zero → NaN).
  const smoothPeaks = peaks.length >= 2 ? peaks : [peaks[0] ?? 0, peaks[0] ?? 0];
  const count = smoothPeaks.length;
  const step = width / (count - 1);
  const midY = height / 2;

  const topX = new Float64Array(count);
  const topY = new Float64Array(count);
  const bottomY = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const amp = Math.max(0.12, smoothPeaks[i] / 100) * (midY - 4);
    topX[i] = i * step;
    topY[i] = midY - amp;
    bottomY[i] = midY + amp * 0.85;
  }

  // Closed Catmull-Rom outline: upper curve forwards, lower curve back from right to left.
  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(topX[0], topY[0]);
    for (let i = 0; i < count - 1; i++) {
      const i0 = Math.max(0, i - 1);
      const i3 = Math.min(count - 1, i + 2);
      ctx.bezierCurveTo(
        topX[i] + (topX[i + 1] - topX[i0]) / 6,
        topY[i] + (topY[i + 1] - topY[i0]) / 6,
        topX[i + 1] - (topX[i3] - topX[i]) / 6,
        topY[i + 1] - (topY[i3] - topY[i]) / 6,
        topX[i + 1],
        topY[i + 1],
      );
    }
    ctx.lineTo(topX[count - 1], bottomY[count - 1]);
    for (let i = count - 1; i > 0; i--) {
      const i0 = Math.min(count - 1, i + 1);
      const i3 = Math.max(0, i - 2);
      ctx.bezierCurveTo(
        topX[i] + (topX[i - 1] - topX[i0]) / 6,
        bottomY[i] + (bottomY[i - 1] - bottomY[i0]) / 6,
        topX[i - 1] - (topX[i3] - topX[i]) / 6,
        bottomY[i - 1] - (bottomY[i3] - bottomY[i]) / 6,
        topX[i - 1],
        bottomY[i - 1],
      );
    }
    ctx.closePath();
  };

  // 1. Unplayed body (also under the played part, as the played fill is translucent).
  tracePath();
  ctx.fillStyle = colors.unplayed;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!played) return;

  // 2. Played body on top (no shadowBlur for WebKitGTK compositor stability).
  tracePath();
  if (hasSpectral(spec)) {
    const spectralGrad = ctx.createLinearGradient(0, 0, width, 0);
    const stopCount = Math.min(24, spec.bands.length);
    for (let s = 0; s < stopCount; s++) {
      const t = stopCount > 1 ? s / (stopCount - 1) : 0;
      const idx = Math.min(spec.bands.length - 1, Math.round(t * (spec.bands.length - 1)));
      spectralGrad.addColorStop(t, spectralColor(spec.bands[idx], 0.92));
    }
    ctx.fillStyle = spectralGrad;
  } else {
    ctx.fillStyle = verticalPlayedGradient(ctx, height, colors);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.75;
  ctx.stroke();
}

function drawBars(ctx: CanvasRenderingContext2D, spec: WaveLayerSpec, played: boolean): void {
  const { height, colors } = spec;
  const layout = barLayoutFor(spec);
  const barPeaks = resamplePeaks(spec.peaks, layout.count);
  const barBands = hasSpectral(spec) ? resampleBands(spec.bands, layout.count) : [];
  const { barWidth, step } = layout;
  const r = Math.min(barWidth / 2, 4);
  const barHeight = (i: number) => Math.max(8, (Math.max(14, barPeaks[i]) / 100) * (height - 6));

  if (barBands.length === barPeaks.length && barBands.length > 0) {
    for (let i = 0; i < barPeaks.length; i++) {
      const h = barHeight(i);
      ctx.fillStyle = spectralColor(barBands[i], played ? 0.95 : 0.22);
      ctx.beginPath();
      roundRectPath(ctx, i * step, (height - h) / 2, barWidth, h, r);
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = played ? verticalPlayedGradient(ctx, height, colors) : colors.unplayed;
  ctx.beginPath();
  for (let i = 0; i < barPeaks.length; i++) {
    const h = barHeight(i);
    roundRectPath(ctx, i * step, (height - h) / 2, barWidth, h, r);
  }
  ctx.fill();
}

function drawMirror(ctx: CanvasRenderingContext2D, spec: WaveLayerSpec, played: boolean): void {
  const { width, height, colors } = spec;
  const layout = barLayoutFor(spec);
  const barPeaks = resamplePeaks(spec.peaks, layout.count);
  const barBands = hasSpectral(spec) ? resampleBands(spec.bands, layout.count) : [];
  const { barWidth, step } = layout;
  const midY = height / 2;

  if (barBands.length === barPeaks.length && barBands.length > 0) {
    for (let i = 0; i < barPeaks.length; i++) {
      const x = i * step;
      const [low, mid, high] = barBands[i];
      const upperHeight = Math.max(5, (Math.max(12, barPeaks[i]) / 100) * (midY - 4));
      // Lower reflection emphasises bass/low-mid weight so kicks punch downward.
      const bassWeight = 0.55 * low + 0.3 * mid + 0.15 * high;
      const lowerHeight = Math.max(4, upperHeight * (0.45 + 0.5 * bassWeight));

      ctx.fillStyle = spectralColor(barBands[i], played ? 0.95 : 0.22);
      ctx.beginPath();
      roundRectPath(ctx, x, midY - upperHeight - 1, barWidth, upperHeight, [3, 3, 0, 0]);
      ctx.fill();

      ctx.fillStyle = spectralColor([low, mid * 0.7, high * 0.4], played ? 0.48 : 0.14);
      ctx.beginPath();
      roundRectPath(ctx, x, midY + 1, barWidth, lowerHeight, [0, 0, 3, 3]);
      ctx.fill();
    }
  } else {
    // Upper half (main) and lower half (mirror with a lower opacity), one fill per half.
    ctx.save();
    ctx.fillStyle = played ? horizontalPlayedGradient(ctx, width, colors) : colors.unplayed;
    ctx.beginPath();
    for (let i = 0; i < barPeaks.length; i++) {
      const h = Math.max(5, (Math.max(12, barPeaks[i]) / 100) * (midY - 4));
      roundRectPath(ctx, i * step, midY - h - 1, barWidth, h, [3, 3, 0, 0]);
    }
    ctx.fill();
    ctx.globalAlpha = played ? 0.45 : 0.15;
    ctx.beginPath();
    for (let i = 0; i < barPeaks.length; i++) {
      const h = Math.max(5, (Math.max(12, barPeaks[i]) / 100) * (midY - 4));
      roundRectPath(ctx, i * step, midY + 1, barWidth, h * 0.75, [0, 0, 3, 3]);
    }
    ctx.fill();
    ctx.restore();
  }

  // Central zero line
  const zeroY = Math.round(midY) + 0.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(width, zeroY);
  ctx.stroke();
}

const DRAWERS: Record<LayeredWaveStyle, (ctx: CanvasRenderingContext2D, spec: WaveLayerSpec, played: boolean) => void> = {
  smooth: drawSmooth,
  bars: drawBars,
  mirror: drawMirror,
};

function renderLayer(
  spec: WaveLayerSpec,
  backingWidth: number,
  backingHeight: number,
  played: boolean,
): HTMLCanvasElement | null {
  const layer = document.createElement('canvas');
  layer.width = backingWidth;
  layer.height = backingHeight;
  const ctx = layer.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(backingWidth / spec.width, 0, 0, backingHeight / spec.height, 0, 0);
  DRAWERS[spec.style](ctx, spec, played);
  return layer;
}

/** Draws both layers at the backing (device pixel) size; null when no 2D context is available. */
export function renderWaveLayers(spec: WaveLayerSpec, backingWidth: number, backingHeight: number): WaveLayers | null {
  if (spec.width <= 0 || spec.height <= 0 || spec.peaks.length === 0) return null;
  const unplayed = renderLayer(spec, backingWidth, backingHeight, false);
  const played = renderLayer(spec, backingWidth, backingHeight, true);
  if (!unplayed || !played) return null;
  return { unplayed, played };
}

/**
 * Blits the layers onto `ctx` (whose transform maps CSS px to the backing store): everything unplayed,
 * then the played layer up to `clipX` (CSS px). Copies are 1:1 in device pixels.
 */
export function blitWaveLayers(ctx: CanvasRenderingContext2D, layers: WaveLayers, cssWidth: number, clipX: number): void {
  const backingWidth = layers.unplayed.width;
  const backingHeight = layers.unplayed.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layers.unplayed, 0, 0);
  const clipPx = Math.min(backingWidth, Math.round((clipX / cssWidth) * backingWidth));
  if (clipPx > 0) {
    ctx.drawImage(layers.played, 0, 0, clipPx, backingHeight, 0, 0, clipPx, backingHeight);
  }
  ctx.restore();
}

/** Playhead marker of the layered styles, drawn every tick over the blitted layers. */
export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  style: LayeredWaveStyle,
  currentX: number,
  width: number,
  height: number,
): void {
  if (currentX <= 0 || currentX >= width) return;
  const midY = height / 2;
  ctx.save();
  if (style === 'bars') {
    // Crisp halo dot
    ctx.beginPath();
    ctx.arc(currentX, midY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.32)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(currentX, midY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    return;
  }

  // Laser line: translucent halo stroke + white core
  ctx.beginPath();
  ctx.moveTo(currentX, 2);
  ctx.lineTo(currentX, height - 2);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.32)';
  ctx.lineWidth = style === 'smooth' ? 6 : 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(currentX, 2);
  ctx.lineTo(currentX, height - 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (style === 'smooth') {
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(currentX, midY, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
