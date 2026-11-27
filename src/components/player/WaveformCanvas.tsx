import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { BarChart2, Waves, Activity, Sliders } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { computeBarLayout, resamplePeaks, sanitizePeaks } from './waveformGeometry';
import { parseOneOf, usePersistedState } from '../../hooks/usePersistedState';
import { useCanvasLoop } from '../../hooks/useCanvasLoop';
import { roundRectPath } from '../../utils/canvasDraw';
import { cn } from '../../utils/cn';
import { Chip } from '../ui';

export type WaveformStyle = 'bars' | 'smooth' | 'scrolling' | 'mirror';

export interface WaveformCanvasProps {
  peaks: number[];
  progress: number; // 0..100
  durationMs?: number;
  positionMs?: number;
  loopPointA?: number | null;
  loopPointB?: number | null;
  isPlaying?: boolean;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  colorPlayedStart?: string;
  colorPlayedEnd?: string;
  colorUnplayed?: string;
  onSeek?: (pct: number) => void;
  onSeekPreview?: (pct: number) => void;
  onSeekCommit?: (pct: number) => void;
  title?: string;
  initialStyle?: WaveformStyle;
  onStyleChange?: (style: WaveformStyle) => void;
  showStyleSelector?: boolean;
  currentLang?: string;
}

/** Width of one peak on the scrolling DJ wave (px), shared by drawing and dragging. */
const SCROLL_UNIT_WIDTH = 6.5;
/** Position of the fixed DJ needle as a fraction of the width (centre). */
const SCROLL_PLAYHEAD_RATIO = 0.5;
/** Minimum shift (px) from which dragging the DJ wave counts as scrolling rather than a click. */
const SCROLL_DRAG_THRESHOLD_PX = 3;

function resolveCssColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (trimmed.startsWith('var(')) {
    try {
      const varName = trimmed.slice(4, -1).trim();
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return resolved || fallback;
    } catch {
      return fallback;
    }
  }
  return trimmed;
}

function formatTimeSec(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  peaks,
  progress,
  durationMs = 0,
  positionMs = 0,
  loopPointA = null,
  loopPointB = null,
  isPlaying = false,
  height = 64,
  className,
  style,
  colorPlayedStart = '#f43f5e',
  colorPlayedEnd = '#a855f7',
  colorUnplayed = 'rgba(255, 255, 255, 0.16)',
  onSeek,
  onSeekPreview,
  onSeekCommit,
  title,
  initialStyle,
  onStyleChange,
  showStyleSelector = true,
  currentLang = 'pl',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const canvasWidthRef = useRef(0);
  const hoverXRef = useRef<number | null>(null);
  const hoverPctRef = useRef<number | null>(null);

  // Wave dragging state (drag-to-seek): per-move progress stays in refs so hovering/scrubbing
  // never triggers React reconciliation; `isDragging` only flips on pointer down/up.
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragProgressRef = useRef<number | null>(null);
  // Scrolling DJ wave mode: dragging moves the track under a fixed needle (jog) instead of jumping to the cursor position
  const scrollDragStartXRef = useRef(0);
  const scrollDragStartProgressRef = useRef(0);
  const scrollDragMovedRef = useRef(false);

  // Wave style (remembered in localStorage, shared by the main player and BigScreen).
  // `initialStyle` is only the default when nothing is saved: no caller passes it in the app.
  const [activeStyle, setActiveStyle] = usePersistedState<WaveformStyle>(
    'auralune_waveform_style',
    initialStyle ?? 'smooth',
    { parse: parseOneOf(['bars', 'smooth', 'scrolling', 'mirror'] as const) },
  );

  const handleStyleSelect = (newStyle: WaveformStyle) => {
    setActiveStyle(newStyle);
    if (onStyleChange) onStyleChange(newStyle);
  };

  // Interpolate / smooth the peak data
  const normalizedPeaks = useMemo(() => sanitizePeaks(peaks), [peaks]);

  const isScrolling = activeStyle === 'scrolling';

  /** Updates the hover timestamp pill imperatively (outside React state and outside the clipped canvas). */
  const syncTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (!tip) return;
    const x = hoverXRef.current;
    const dragging = isDraggingRef.current;
    const activePct = dragging && dragProgressRef.current !== null ? dragProgressRef.current / 100 : hoverPctRef.current;
    const visible =
      (dragging || x !== null) &&
      x !== null &&
      activePct !== null &&
      durationMs > 0 &&
      !(isScrolling && dragging);

    if (!visible) {
      tip.style.display = 'none';
      tip.textContent = '';
      return;
    }

    const timeSec = (activePct * durationMs) / 1000;
    tip.textContent = formatTimeSec(timeSec);
    tip.style.display = 'block';

    const surfaceWidth =
      canvasWidthRef.current > 0
        ? canvasWidthRef.current
        : (containerRef.current?.getBoundingClientRect().width ?? 0);
    const halfWidth = tip.offsetWidth > 0 ? Math.max(24, tip.offsetWidth / 2 + 2) : 30;
    const clampedX =
      surfaceWidth > 0
        ? Math.max(Math.min(halfWidth, surfaceWidth / 2), Math.min(surfaceWidth - Math.min(halfWidth, surfaceWidth / 2), x))
        : x;
    tip.style.left = `${clampedX}px`;
  }, [durationMs, isScrolling]);

  const { canvasRef, invalidate } = useCanvasLoop(
    ({ ctx, width, height: canvasHeight }) => {
      canvasWidthRef.current = width;
      const startColor = resolveCssColor(colorPlayedStart, '#f43f5e');
      const endColor = resolveCssColor(colorPlayedEnd, '#a855f7');
      const unplayedColor = resolveCssColor(colorUnplayed, 'rgba(255, 255, 255, 0.16)');

      // Gradient for the played part
      const playedGrad = ctx.createLinearGradient(0, 0, width, 0);
      try {
        playedGrad.addColorStop(0, startColor);
        playedGrad.addColorStop(1, endColor);
      } catch {
        playedGrad.addColorStop(0, '#f43f5e');
        playedGrad.addColorStop(1, '#a855f7');
      }

      const verticalPlayedGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      try {
        verticalPlayedGrad.addColorStop(0, startColor);
        verticalPlayedGrad.addColorStop(0.5, endColor);
        verticalPlayedGrad.addColorStop(1, '#06b6d4');
      } catch {
        verticalPlayedGrad.addColorStop(0, '#f43f5e');
        verticalPlayedGrad.addColorStop(1, '#a855f7');
      }

      const effectiveProgress = isDraggingRef.current && dragProgressRef.current !== null ? dragProgressRef.current : progress;
      const currentX = (effectiveProgress / 100) * width;

      // ==========================================
      // STYLE 1: SMOOTH CONTINUOUS WAVE (SMOOTH ANALOG WAVE)
      // ==========================================
      if (activeStyle === 'smooth') {
        // The curve needs at least 2 points (otherwise division by zero → NaN).
        const smoothPeaks = normalizedPeaks.length >= 2 ? normalizedPeaks : [normalizedPeaks[0], normalizedPeaks[0]];
        const count = smoothPeaks.length;
        const step = width / (count - 1);
        const midY = canvasHeight / 2;

        // Upper and lower curve points
        const topPoints: { x: number; y: number }[] = [];
        const bottomPoints: { x: number; y: number }[] = [];

        for (let i = 0; i < count; i++) {
          const x = i * step;
          const p = smoothPeaks[i] / 100;
          const amp = Math.max(0.12, p) * (midY - 4);
          topPoints.push({ x, y: midY - amp });
          bottomPoints.push({ x, y: midY + amp * 0.85 });
        }

        const drawSpline = (ctxTarget: CanvasRenderingContext2D) => {
          ctxTarget.beginPath();
          ctxTarget.moveTo(topPoints[0].x, topPoints[0].y);

          // Upper Catmull-Rom curve forwards
          for (let i = 0; i < count - 1; i++) {
            const p0 = topPoints[Math.max(0, i - 1)];
            const p1 = topPoints[i];
            const p2 = topPoints[i + 1];
            const p3 = topPoints[Math.min(count - 1, i + 2)];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            ctxTarget.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }

          // Lower curve back from right to left
          ctxTarget.lineTo(bottomPoints[count - 1].x, bottomPoints[count - 1].y);
          for (let i = count - 1; i > 0; i--) {
            const p0 = bottomPoints[Math.min(count - 1, i + 1)];
            const p1 = bottomPoints[i];
            const p2 = bottomPoints[i - 1];
            const p3 = bottomPoints[Math.max(0, i - 2)];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            ctxTarget.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }

          ctxTarget.closePath();
        };

        // 1. Unplayed layer (background)
        drawSpline(ctx);
        ctx.fillStyle = unplayedColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 2. Played layer (neon clip, no shadowBlur for WebKitGTK compositor stability)
        if (currentX > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, currentX, canvasHeight);
          ctx.clip();

          drawSpline(ctx);
          ctx.fillStyle = verticalPlayedGrad;
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1.75;
          ctx.stroke();

          ctx.restore();
        }

        // Playhead laser line
        if (currentX > 0 && currentX < width) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(currentX, 2);
          ctx.lineTo(currentX, canvasHeight - 2);
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.32)';
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(currentX, 2);
          ctx.lineTo(currentX, canvasHeight - 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(currentX, midY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // ==========================================
      // STYLE 2: MODERN CYBER BARS
      // ==========================================
      else if (activeStyle === 'bars') {
        // The layout fills exactly the whole width, so the bars match the playhead position.
        const layout = computeBarLayout(width, normalizedPeaks.length, 3, 2.5);
        const barPeaks = resamplePeaks(normalizedPeaks, layout.count);
        const { barWidth, step } = layout;

        const playedPath: { x: number; y: number; h: number }[] = [];
        const unplayedPath: { x: number; y: number; h: number }[] = [];
        for (let i = 0; i < barPeaks.length; i++) {
          const x = i * step;
          const barHeight = Math.max(8, (Math.max(14, barPeaks[i]) / 100) * (canvasHeight - 6));
          const bar = { x, y: (canvasHeight - barHeight) / 2, h: barHeight };
          (x + barWidth / 2 <= currentX ? playedPath : unplayedPath).push(bar);
        }

        const fillBars = (bars: { x: number; y: number; h: number }[], radius: number) => {
          if (bars.length === 0) return;
          ctx.beginPath();
          const r = Math.min(barWidth / 2, radius);
          for (const b of bars) {
            roundRectPath(ctx, b.x, b.y, barWidth, b.h, r);
          }
          ctx.fill();
        };

        ctx.save();
        ctx.fillStyle = unplayedColor;
        fillBars(unplayedPath, 4);
        ctx.fillStyle = verticalPlayedGrad;
        fillBars(playedPath, 4);
        ctx.restore();

        // Playhead indicator with a crisp halo dot
        if (currentX > 0 && currentX < width) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(currentX, canvasHeight / 2, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(244, 63, 94, 0.32)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(currentX, canvasHeight / 2, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();
        }
      }

      // ==========================================
      // STYLE 3: SCROLLING DJ WAVE
      // ==========================================
      else if (activeStyle === 'scrolling') {
        const midY = canvasHeight / 2;
        const playheadX = Math.floor(width * SCROLL_PLAYHEAD_RATIO); // Fixed DJ needle in the centre
        const count = normalizedPeaks.length;
        const waveUnitWidth = SCROLL_UNIT_WIDTH; // Width of a single bar
        const totalWaveWidth = count * waveUnitWidth;

        // Wave offset based on playback progress
        const scrollOffset = (effectiveProgress / 100) * totalWaveWidth;

        // Background grid (DJ beat grid)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < width; gx += 40) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, canvasHeight);
          ctx.stroke();
        }

        // Draw the scrolling bars (batched: one fill per group)
        const bWidth = 4.5;
        const played: { x: number; y: number; h: number }[] = [];
        const upcoming: { x: number; y: number; h: number }[] = [];
        for (let i = 0; i < count; i++) {
          const barX = playheadX - scrollOffset + i * waveUnitWidth;

          // Draw only the elements that fit on the screen
          if (barX < -20 || barX > width + 20) continue;

          const barHeight = Math.max(10, (Math.max(16, normalizedPeaks[i]) / 100) * (canvasHeight - 8));
          const bar = { x: barX, y: midY - barHeight / 2, h: barHeight };
          (barX <= playheadX ? played : upcoming).push(bar);
        }

        const fillScrollBars = (bars: { x: number; y: number; h: number }[]) => {
          if (bars.length === 0) return;
          ctx.beginPath();
          for (const b of bars) {
            roundRectPath(ctx, b.x, b.y, bWidth, b.h, 2.5);
          }
          ctx.fill();
        };

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        fillScrollBars(upcoming);
        ctx.fillStyle = verticalPlayedGrad;
        fillScrollBars(played);
        ctx.restore();

        // Central laser DJ needle with crisp halo (playhead marker)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvasHeight);
        ctx.strokeStyle = isPlaying ? 'rgba(6, 182, 212, 0.28)' : 'rgba(244, 63, 94, 0.28)';
        ctx.lineWidth = isPlaying ? 7 : 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvasHeight);
        ctx.strokeStyle = isPlaying ? '#06b6d4' : '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Show the current time on the DJ needle
        const effectivePosMs =
          isDraggingRef.current && dragProgressRef.current !== null && durationMs > 0
            ? (dragProgressRef.current / 100) * durationMs
            : positionMs;
        if (durationMs > 0 && effectivePosMs > 0) {
          ctx.fillStyle = 'rgba(15, 20, 32, 0.85)';
          ctx.fillRect(playheadX + 4, 4, 38, 14);
          ctx.fillStyle = '#fff';
          ctx.font = '9px monospace';
          ctx.fillText(formatTimeSec(effectivePosMs / 1000), playheadX + 7, 14);
        }

        // Playhead marker at the top and bottom
        ctx.fillStyle = isPlaying ? '#06b6d4' : '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(playheadX - 6, canvasHeight);
        ctx.lineTo(playheadX + 6, canvasHeight);
        ctx.lineTo(playheadX, canvasHeight - 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ==========================================
      // STYLE 4: SYMMETRIC MIRROR WAVE (MIRROR SPECTRUM)
      // ==========================================
      else if (activeStyle === 'mirror') {
        const layout = computeBarLayout(width, normalizedPeaks.length, 2.5, 2);
        const barPeaks = resamplePeaks(normalizedPeaks, layout.count);
        const { barWidth, step } = layout;
        const midY = canvasHeight / 2;

        const playedBars: { x: number; h: number }[] = [];
        const unplayedBars: { x: number; h: number }[] = [];
        for (let i = 0; i < barPeaks.length; i++) {
          const x = i * step;
          const halfHeight = Math.max(5, (Math.max(12, barPeaks[i]) / 100) * (midY - 4));
          (x + barWidth / 2 <= currentX ? playedBars : unplayedBars).push({ x, h: halfHeight });
        }

        // Upper half (main) and lower half (mirror with a lower opacity),
        // one fill per group without shadowBlur so WebKitGTK compositing stays crisp.
        const fillGroup = (
          bars: { x: number; h: number }[],
          fill: string | CanvasGradient,
          lowerAlpha: number,
        ) => {
          if (bars.length === 0) return;
          ctx.save();
          ctx.fillStyle = fill;
          ctx.beginPath();
          for (const b of bars) roundRectPath(ctx, b.x, midY - b.h - 1, barWidth, b.h, [3, 3, 0, 0]);
          ctx.fill();

          ctx.globalAlpha = lowerAlpha;
          ctx.beginPath();
          for (const b of bars) roundRectPath(ctx, b.x, midY + 1, barWidth, b.h * 0.75, [0, 0, 3, 3]);
          ctx.fill();
          ctx.restore();
        };
        fillGroup(unplayedBars, unplayedColor, 0.15);
        fillGroup(playedBars, playedGrad, 0.45);

        // Central zero line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();

        // Laser indicator
        if (currentX > 0 && currentX < width) {
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.32)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(currentX, 2);
          ctx.lineTo(currentX, canvasHeight - 2);
          ctx.stroke();

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(currentX, 2);
          ctx.lineTo(currentX, canvasHeight - 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ==========================================
      // INTERACTIVE HOVER LINE (CURSOR PREVIEW)
      // ==========================================
      const hoverX = hoverXRef.current;
      if (hoverX !== null && hoverX >= 0 && hoverX <= width && !(activeStyle === 'scrolling' && isDraggingRef.current)) {
        ctx.save();
        ctx.setLineDash([4, 3]);

        // Crisp translucent cyan halo stroke (avoids WebKitGTK shadowBlur tile artifacts)
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, canvasHeight);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, canvasHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // ==========================================
      // A-B LOOP ZONE VISUALISATION
      // ==========================================
      if (durationMs > 0 && (loopPointA !== null || loopPointB !== null)) {
        ctx.save();
        const xA = loopPointA !== null ? Math.max(0, Math.min(width, (loopPointA / durationMs) * width)) : null;
        const xB = loopPointB !== null ? Math.max(0, Math.min(width, (loopPointB / durationMs) * width)) : null;

        // Loop highlight area between A and B
        if (xA !== null && xB !== null && xB > xA) {
          const loopGrad = ctx.createLinearGradient(xA, 0, xB, 0);
          loopGrad.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
          loopGrad.addColorStop(1, 'rgba(244, 63, 94, 0.22)');
          ctx.fillStyle = loopGrad;
          ctx.fillRect(xA, 0, xB - xA, canvasHeight);

          // Loop edges (subtle light accents)
          ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
          ctx.fillRect(xA, 0, Math.min(3, xB - xA), canvasHeight);
          ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
          ctx.fillRect(Math.max(xA, xB - 3), 0, Math.min(3, xB - xA), canvasHeight);
        }

        // Vertical point A marker (cyan)
        if (xA !== null) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(xA, 0);
          ctx.lineTo(xA, canvasHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#06b6d4';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('[A', Math.min(width - 18, Math.max(2, xA + 3)), 11);
        }

        // Vertical point B marker (pink)
        if (xB !== null) {
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(xB, 0);
          ctx.lineTo(xB, canvasHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#f43f5e';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('B]', Math.max(2, xB - 15), 11);
        }
        ctx.restore();
      }

      return false;
    },
    {
      pixelRatio: 'device',
      onResize: ({ width }) => {
        canvasWidthRef.current = width;
        syncTooltip();
      },
    },
  );

  // Redraw when props/style change (hover/drag pointer moves call `invalidate()` directly).
  useEffect(() => {
    invalidate();
    syncTooltip();
  }, [
    invalidate,
    syncTooltip,
    normalizedPeaks,
    progress,
    isDragging,
    activeStyle,
    colorPlayedStart,
    colorPlayedEnd,
    colorUnplayed,
    positionMs,
    durationMs,
    loopPointA,
    loopPointB,
    isPlaying,
  ]);

  /** Total width of the scrolling wave (px): 1 px of dragging = track / this width. */
  const scrollTotalWidth = normalizedPeaks.length * SCROLL_UNIT_WIDTH;

  /**
   * Returns the position (0..1) pointed at by the cursor at `clientX` and its `x` relative to the canvas.
   * Falls back to the container rect when the canvas has 0 layout width (e.g. jsdom tests mocking `.waveform-container`).
   */
  const getPctFromClientX = (clientX: number): { pct: number; x: number } => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const rect = canvasRect && canvasRect.width > 0 ? canvasRect : containerRef.current?.getBoundingClientRect();
    if (!rect) return { pct: 0, x: 0 };
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    if (isScrolling) {
      const base = (isDraggingRef.current && dragProgressRef.current !== null ? dragProgressRef.current : progress) / 100;
      const pct = base + (x - rect.width * SCROLL_PLAYHEAD_RATIO) / scrollTotalWidth;
      return { pct: Math.max(0, Math.min(1, pct)), x };
    }
    const pct = rect.width > 0 ? x / rect.width : 0;
    return { pct, x };
  };

  /** New progress (0..1) after dragging the DJ wave: the wave follows the cursor, so the track moves the opposite way. */
  const getScrollDragPct = (clientX: number): number => {
    const dx = clientX - scrollDragStartXRef.current;
    const next = scrollDragStartProgressRef.current - (dx / scrollTotalWidth) * 100;
    return Math.max(0, Math.min(100, next)) / 100;
  };

  const beginDrag = (clientX: number, pct: number, x: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    hoverXRef.current = x;
    hoverPctRef.current = pct;

    if (isScrolling) {
      // The wave stays put until it is actually dragged; a click alone does not seek.
      scrollDragStartXRef.current = clientX;
      scrollDragStartProgressRef.current = progress;
      scrollDragMovedRef.current = false;
      dragProgressRef.current = progress;
      syncTooltip();
      invalidate();
      return;
    }

    dragProgressRef.current = pct * 100;
    syncTooltip();
    invalidate();
    onSeekPreview?.(pct);
  };

  const moveDrag = (clientX: number, pct: number, x: number) => {
    if (isScrolling) {
      if (!scrollDragMovedRef.current) {
        if (Math.abs(clientX - scrollDragStartXRef.current) < SCROLL_DRAG_THRESHOLD_PX) return;
        scrollDragMovedRef.current = true;
      }
      const nextPct = getScrollDragPct(clientX);
      dragProgressRef.current = nextPct * 100;
      syncTooltip();
      invalidate();
      onSeekPreview?.(nextPct);
      return;
    }

    dragProgressRef.current = pct * 100;
    hoverXRef.current = x;
    hoverPctRef.current = pct;
    syncTooltip();
    invalidate();
    onSeekPreview?.(pct);
  };

  /** Ends dragging; returns the position to commit, or null when nothing needs seeking. */
  const endDrag = (clientX: number, pct: number): number | null => {
    isDraggingRef.current = false;
    setIsDragging(false);

    let result: number | null;
    if (isScrolling) {
      result = scrollDragMovedRef.current ? getScrollDragPct(clientX) : null;
      scrollDragMovedRef.current = false;
    } else {
      result = typeof clientX === 'number' && !isNaN(clientX)
        ? pct
        : (dragProgressRef.current !== null ? dragProgressRef.current / 100 : pct);
    }

    dragProgressRef.current = null;
    syncTooltip();
    invalidate();
    return result;
  };

  const commitSeek = (target: number | null) => {
    if (target === null) return;
    if (onSeekCommit) {
      onSeekCommit(target);
    } else if (onSeek) {
      onSeek(target);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!onSeek && !onSeekCommit && !onSeekPreview) return;
    const { pct, x } = getPctFromClientX(e.clientX);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    beginDrag(e.clientX, pct, x);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { pct, x } = getPctFromClientX(e.clientX);
    if (isDraggingRef.current) {
      moveDrag(e.clientX, pct, x);
      return;
    }
    hoverXRef.current = x;
    hoverPctRef.current = pct;
    syncTooltip();
    invalidate();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { pct } = getPctFromClientX(e.clientX);
    commitSeek(endDrag(e.clientX, pct));
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      scrollDragMovedRef.current = false;
      dragProgressRef.current = null;
    }
    hoverXRef.current = null;
    hoverPctRef.current = null;
    syncTooltip();
    invalidate();
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      hoverXRef.current = null;
      hoverPctRef.current = null;
      syncTooltip();
      invalidate();
    }
  };

  // The latest drag functions for the window listeners (registered only while dragging)
  const dragApiRef = useRef({ getPctFromClientX, moveDrag, endDrag, commitSeek });
  useEffect(() => {
    dragApiRef.current = { getPctFromClientX, moveDrag, endDrag, commitSeek };
  });

  // Window-level drag handling, in case the cursor leaves the container
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const api = dragApiRef.current;
      const { pct, x } = api.getPctFromClientX(e.clientX);
      api.moveDrag(e.clientX, pct, x);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const api = dragApiRef.current;
      const { pct } = api.getPctFromClientX(e.clientX);
      api.commitSeek(api.endDrag(e.clientX, pct));
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isDragging]);

  const loc = useMemo(() => getTranslations(currentLang as Language), [currentLang]);

  const styleLabels: Record<WaveformStyle, { name: string; icon: React.ReactNode }> = {
    smooth: { name: loc.waveform.styleSmooth, icon: <Waves size={13} /> },
    bars: { name: loc.waveform.styleBars, icon: <BarChart2 size={13} /> },
    scrolling: { name: loc.waveform.styleScrolling, icon: <Activity size={13} /> },
    mirror: { name: loc.waveform.styleMirror, icon: <Sliders size={13} /> },
  };

  return (
    <div
      className={`waveform-wrapper ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: '6px',
        ...style,
      }}
    >
      {/* Wave toolbar ABOVE the progress bar */}
      {showStyleSelector && (
        <div className="flex w-full items-center justify-end gap-1.5">
          <div role="group" aria-label="Waveform style" className="flex items-center gap-0.5 rounded-full border border-line bg-black/30 p-0.5">
            {(['smooth', 'bars', 'scrolling', 'mirror'] as WaveformStyle[]).map((st) => {
              const isSelected = activeStyle === st;
              return (
                <Chip
                  key={st}
                  size="xs"
                  pressed={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStyleSelect(st);
                  }}
                  aria-label={styleLabels[st].name}
                  title={styleLabels[st].name}
                  className="gap-1 rounded-full border-transparent bg-transparent px-2.5 py-1"
                >
                  {styleLabels[st].icon}
                  <span className={cn('text-xxs', isSelected ? 'inline' : 'hidden')}>
                    {styleLabels[st].name}
                  </span>
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {/* Wave canvas wrapper (non-clipped so the hover tooltip sits cleanly above the canvas) */}
      <div className="relative w-full">
        {/* Floating time indicator above the waveform (avoids cursor occlusion and WebKitGTK canvas layer tearing) */}
        <div
          ref={tooltipRef}
          aria-hidden="true"
          style={{ display: 'none', left: '0px', transform: 'translateX(-50%)' }}
          className={cn(
            'pointer-events-none absolute bottom-full mb-1.5 z-20 rounded-sm border bg-ink/95 px-1.5 py-0.5 font-mono text-xxs font-bold whitespace-nowrap text-fg shadow-lift',
            isDragging ? 'border-accent-pink shadow-accent-pink/55' : 'border-accent-cyan shadow-black/60',
          )}
        />

        {/* Wave canvas container (mouse and touch dragging) */}
        <div
          ref={containerRef}
          className={cn(
            'relative w-full select-none overflow-hidden rounded-xl border waveform-container',
            isDragging ? 'border-accent-pink transition-none' : 'border-line transition-[border-color,box-shadow] duration-200',
            isDragging ? 'cursor-grabbing' : isScrolling ? 'cursor-grab' : onSeek || onSeekCommit ? 'cursor-pointer' : 'cursor-default',
          )}
          style={{
            height: `${height}px`,
            background: 'rgba(10, 12, 22, 0.72)',
            boxShadow: isDragging
              ? '0 0 16px rgba(244, 63, 94, 0.35), inset 0 2px 8px rgba(0,0,0,0.4)'
              : 'inset 0 2px 8px rgba(0,0,0,0.4)',
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
          title={title}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full"
          />
        </div>
      </div>
    </div>
  );
};
