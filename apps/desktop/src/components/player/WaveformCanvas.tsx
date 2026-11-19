import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BarChart2, Waves, Activity, Sliders } from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height });
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  // Stan przeciągania fali (drag-to-seek)
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragProgressRef = useRef<number | null>(null);

  // Styl fali (zapamiętywany w localStorage)
  const [activeStyle, setActiveStyle] = useState<WaveformStyle>(() => {
    if (initialStyle) return initialStyle;
    try {
      const saved = localStorage.getItem('auralune_waveform_style');
      if (saved === 'bars' || saved === 'smooth' || saved === 'scrolling' || saved === 'mirror') {
        return saved as WaveformStyle;
      }
    } catch {
      // Ignoruj błędy localStorage
    }
    return 'smooth';
  });

  const handleStyleSelect = (newStyle: WaveformStyle) => {
    setActiveStyle(newStyle);
    try {
      localStorage.setItem('auralune_waveform_style', newStyle);
    } catch {}
    if (onStyleChange) onStyleChange(newStyle);
  };

  // Obserwacja dynamicznego rozmiaru kontenera (HiDPI / Retina)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(height),
        });
      }
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateSize());
      ro.observe(container);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [height]);

  // Interpolacja / wygładzanie danych szczytów
  const normalizedPeaks = useMemo(() => {
    if (!peaks || peaks.length === 0) {
      return Array.from({ length: 120 }, () => 30);
    }
    return peaks;
  }, [peaks]);

  // Główna pętla renderowania Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const canvasHeight = dimensions.height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, canvasHeight);

    const startColor = resolveCssColor(colorPlayedStart, '#f43f5e');
    const endColor = resolveCssColor(colorPlayedEnd, '#a855f7');
    const unplayedColor = resolveCssColor(colorUnplayed, 'rgba(255, 255, 255, 0.16)');

    // Gradient dla odtworzonej części
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

    const effectiveProgress = isDragging && dragProgress !== null ? dragProgress : progress;
    const currentX = (effectiveProgress / 100) * width;

    // ==========================================
    // STYL 1: GŁADKA CIĄGŁA FALA (SMOOTH ANALOG WAVE)
    // ==========================================
    if (activeStyle === 'smooth') {
      const count = normalizedPeaks.length;
      const step = width / (count - 1);
      const midY = canvasHeight / 2;

      // Punkty krzywej górnej i dolnej
      const topPoints: { x: number; y: number }[] = [];
      const bottomPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < count; i++) {
        const x = i * step;
        const p = normalizedPeaks[i] / 100;
        const amp = Math.max(0.12, p) * (midY - 4);
        topPoints.push({ x, y: midY - amp });
        bottomPoints.push({ x, y: midY + amp * 0.85 });
      }

      const drawSpline = (ctxTarget: CanvasRenderingContext2D) => {
        ctxTarget.beginPath();
        ctxTarget.moveTo(topPoints[0].x, topPoints[0].y);

        // Górna krzywa Catmull-Rom do przodu
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

        // Dolna krzywa z powrotem od prawej do lewej
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

      // 1. Warstwa nieodtworzona (tło)
      drawSpline(ctx);
      ctx.fillStyle = unplayedColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Warstwa odtworzona (neonowy clip)
      if (currentX > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, currentX, canvasHeight);
        ctx.clip();

        drawSpline(ctx);
        ctx.fillStyle = verticalPlayedGrad;
        ctx.shadowColor = 'rgba(244, 63, 94, 0.5)';
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }

      // Wskaźnik głowicy (Playhead Laser Line)
      if (currentX > 0 && currentX < width) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(currentX, 2);
        ctx.lineTo(currentX, canvasHeight - 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(currentX, midY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ==========================================
    // STYL 2: NOWOCZESNE SŁUPKI CYBER (CYBER BARS)
    // ==========================================
    else if (activeStyle === 'bars') {
      const count = normalizedPeaks.length;
      const gap = 3;
      const totalGap = (count - 1) * gap;
      const barWidth = Math.max(2.5, (width - totalGap) / count);

      for (let i = 0; i < count; i++) {
        const peak = normalizedPeaks[i];
        const x = i * (barWidth + gap);
        const barCenter = x + barWidth / 2;
        const isPlayed = barCenter <= currentX;

        const barHeight = Math.max(8, (Math.max(14, peak) / 100) * (canvasHeight - 6));
        const y = (canvasHeight - barHeight) / 2;

        ctx.save();
        if (isPlayed) {
          ctx.fillStyle = verticalPlayedGrad;
          ctx.shadowColor = 'rgba(244, 63, 94, 0.45)';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = unplayedColor;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, Math.min(barWidth / 2, 4));
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
        ctx.restore();
      }

      // Wskaźnik playheadu z neonową kropką
      if (currentX > 0 && currentX < width) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(currentX, canvasHeight / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }
    }

    // ==========================================
    // STYL 3: PRZEWIJANA FALA DJ (SCROLLING DJ WAVE)
    // ==========================================
    else if (activeStyle === 'scrolling') {
      const midY = canvasHeight / 2;
      const playheadX = Math.floor(width * 0.4); // Igła DJ-ska na 40% szerokości
      const count = normalizedPeaks.length;
      const waveUnitWidth = 6.5; // Szerokość pojedynczego taktu
      const totalWaveWidth = count * waveUnitWidth;

      // Przesunięcie fali w zależności od postępu odtwarzania
      const scrollOffset = (effectiveProgress / 100) * totalWaveWidth;

      // Siatka tła (DJ Beat Grid)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvasHeight);
        ctx.stroke();
      }

      // Rysowanie przewijanych słupków
      for (let i = 0; i < count; i++) {
        const peak = normalizedPeaks[i];
        const barX = playheadX - scrollOffset + i * waveUnitWidth;

        // Rysuj tylko te elementy, które mieszczą się na ekranie
        if (barX < -20 || barX > width + 20) continue;

        const isPlayed = barX <= playheadX;
        const barHeight = Math.max(10, (Math.max(16, peak) / 100) * (canvasHeight - 8));
        const y = midY - barHeight / 2;
        const bWidth = 4.5;

        ctx.save();
        if (isPlayed) {
          ctx.fillStyle = verticalPlayedGrad;
          ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.shadowColor = 'transparent';
        }

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(barX, y, bWidth, barHeight, 2.5);
        } else {
          ctx.rect(barX, y, bWidth, barHeight);
        }
        ctx.fill();
        ctx.restore();
      }

      // Centralna laserowa igła DJ z poświatą (Playhead Marker)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.strokeStyle = isPlaying ? '#06b6d4' : '#f43f5e';
      ctx.lineWidth = 3;
      ctx.shadowColor = isPlaying ? '#06b6d4' : '#f43f5e';
      ctx.shadowBlur = isPlaying ? 16 : 8;
      ctx.stroke();

      // Wyświetlanie aktualnego czasu na igle DJ
      const effectivePosMs = isDragging && dragProgress !== null && durationMs > 0
        ? (dragProgress / 100) * durationMs
        : positionMs;
      if (durationMs > 0 && effectivePosMs > 0) {
        ctx.fillStyle = 'rgba(15, 20, 32, 0.85)';
        ctx.fillRect(playheadX + 4, 4, 38, 14);
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(formatTimeSec(effectivePosMs / 1000), playheadX + 7, 14);
      }

      // Znacznik głowicy na górze i dole
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
    // STYL 4: SYMETRYCZNA FALA LUSTRZANA (MIRROR SPECTRUM)
    // ==========================================
    else if (activeStyle === 'mirror') {
      const count = normalizedPeaks.length;
      const gap = 2.5;
      const totalGap = (count - 1) * gap;
      const barWidth = Math.max(2, (width - totalGap) / count);
      const midY = canvasHeight / 2;

      for (let i = 0; i < count; i++) {
        const peak = normalizedPeaks[i];
        const x = i * (barWidth + gap);
        const barCenter = x + barWidth / 2;
        const isPlayed = barCenter <= currentX;

        const halfHeight = Math.max(5, (Math.max(12, peak) / 100) * (midY - 4));

        ctx.save();
        // Górna połowa (główna)
        if (isPlayed) {
          ctx.fillStyle = playedGrad;
          ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = unplayedColor;
          ctx.shadowColor = 'transparent';
        }

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, midY - halfHeight - 1, barWidth, halfHeight, [3, 3, 0, 0]);
        } else {
          ctx.rect(x, midY - halfHeight - 1, barWidth, halfHeight);
        }
        ctx.fill();

        // Dolna połowa (lustrzane odbicie z niższą przezroczystością)
        ctx.globalAlpha = isPlayed ? 0.45 : 0.15;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, midY + 1, barWidth, halfHeight * 0.75, [0, 0, 3, 3]);
        } else {
          ctx.rect(x, midY + 1, barWidth, halfHeight * 0.75);
        }
        ctx.fill();

        ctx.restore();
      }

      // Linia zerowa (Central Zero-Line)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Laserowy wskaźnik
      if (currentX > 0 && currentX < width) {
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(currentX, 2);
        ctx.lineTo(currentX, canvasHeight - 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ==========================================
    // INTERAKTYWNA LINIA HOVERA (CURSOR PREVIEW)
    // ==========================================
    if (hoverX !== null && hoverX >= 0 && hoverX <= width) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, canvasHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // ==========================================
    // WIZUALIZACJA OBSZARU PĘTLI A-B (LOOP ZONE)
    // ==========================================
    if (durationMs > 0 && (loopPointA !== null || loopPointB !== null)) {
      ctx.save();
      const xA = loopPointA !== null ? Math.max(0, Math.min(width, (loopPointA / durationMs) * width)) : null;
      const xB = loopPointB !== null ? Math.max(0, Math.min(width, (loopPointB / durationMs) * width)) : null;

      // Obszar podświetlenia pętli pomiędzy A i B
      if (xA !== null && xB !== null && xB > xA) {
        const loopGrad = ctx.createLinearGradient(xA, 0, xB, 0);
        loopGrad.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
        loopGrad.addColorStop(1, 'rgba(244, 63, 94, 0.22)');
        ctx.fillStyle = loopGrad;
        ctx.fillRect(xA, 0, xB - xA, canvasHeight);

        // Krawędzie pętli (subtelne akcenty świetlne)
        ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.fillRect(xA, 0, Math.min(3, xB - xA), canvasHeight);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.fillRect(Math.max(xA, xB - 3), 0, Math.min(3, xB - xA), canvasHeight);
      }

      // Pionowy znacznik punktu A (Cyan)
      if (xA !== null) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 6;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(xA, 0);
        ctx.lineTo(xA, canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Etykieta [A
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('[A', Math.min(width - 18, Math.max(2, xA + 3)), 11);
      }

      // Pionowy znacznik punktu B (Pink)
      if (xB !== null) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 6;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(xB, 0);
        ctx.lineTo(xB, canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Etykieta B]
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('B]', Math.max(2, xB - 15), 11);
      }
      ctx.restore();
    }

    ctx.restore();
  }, [
    dimensions,
    normalizedPeaks,
    progress,
    isDragging,
    dragProgress,
    activeStyle,
    colorPlayedStart,
    colorPlayedEnd,
    colorUnplayed,
    hoverX,
    positionMs,
    durationMs,
    loopPointA,
    loopPointB,
    isPlaying,
  ]);

  const getPctFromClientX = (clientX: number): { pct: number; x: number } => {
    const container = containerRef.current;
    if (!container) return { pct: 0, x: 0 };
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = rect.width > 0 ? x / rect.width : 0;
    return { pct, x };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!onSeek && !onSeekCommit && !onSeekPreview) return;
    const { pct, x } = getPctFromClientX(e.clientX);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isDraggingRef.current = true;
    setIsDragging(true);
    dragProgressRef.current = pct * 100;
    setDragProgress(pct * 100);
    setHoverX(x);
    setHoverPct(pct);

    onSeekPreview?.(pct);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { pct, x } = getPctFromClientX(e.clientX);
    setHoverX(x);
    setHoverPct(pct);

    if (isDraggingRef.current) {
      dragProgressRef.current = pct * 100;
      setDragProgress(pct * 100);
      onSeekPreview?.(pct);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { pct } = getPctFromClientX(e.clientX);
    const finalPct = typeof e.clientX === 'number' && !isNaN(e.clientX)
      ? pct
      : (dragProgressRef.current !== null ? dragProgressRef.current / 100 : pct);

    dragProgressRef.current = null;
    setDragProgress(null);

    if (onSeekCommit) {
      onSeekCommit(finalPct);
    } else if (onSeek) {
      onSeek(finalPct);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      dragProgressRef.current = null;
      setDragProgress(null);
    }
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      setHoverX(null);
      setHoverPct(null);
    }
  };

  // Obsługa przeciągania na poziomie okna, gdyby kursor opuścił kontener
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const { pct, x } = getPctFromClientX(e.clientX);
      dragProgressRef.current = pct * 100;
      setDragProgress(pct * 100);
      setHoverX(x);
      setHoverPct(pct);
      onSeekPreview?.(pct);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      const { pct } = getPctFromClientX(e.clientX);
      const finalPct = typeof e.clientX === 'number' && !isNaN(e.clientX)
        ? pct
        : (dragProgressRef.current !== null ? dragProgressRef.current / 100 : pct);

      dragProgressRef.current = null;
      setDragProgress(null);

      if (onSeekCommit) {
        onSeekCommit(finalPct);
      } else if (onSeek) {
        onSeek(finalPct);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isDragging, onSeek, onSeekCommit, onSeekPreview]);

  const loc = useMemo(() => getTranslations(currentLang as Language), [currentLang]);

  const styleLabels: Record<WaveformStyle, { name: string; icon: React.ReactNode }> = {
    smooth: { name: loc.waveform.styleSmooth, icon: <Waves size={13} /> },
    bars: { name: loc.waveform.styleBars, icon: <BarChart2 size={13} /> },
    scrolling: { name: loc.waveform.styleScrolling, icon: <Activity size={13} /> },
    mirror: { name: loc.waveform.styleMirror, icon: <Sliders size={13} /> },
  };

  const hoverTimeStr = useMemo(() => {
    const activePct = isDragging && dragProgress !== null ? dragProgress / 100 : hoverPct;
    if (activePct === null || !durationMs || durationMs <= 0) return null;
    const timeSec = (activePct * durationMs) / 1000;
    return formatTimeSec(timeSec);
  }, [isDragging, dragProgress, hoverPct, durationMs]);

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
      {/* Pasek narzędzi fali NAD paskiem postępu */}
      {showStyleSelector && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '6px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              background: 'rgba(15, 18, 30, 0.88)',
              backdropFilter: 'blur(10px)',
              padding: '2px 4px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {(['smooth', 'bars', 'scrolling', 'mirror'] as WaveformStyle[]).map((st) => {
              const isSelected = activeStyle === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStyleSelect(st);
                  }}
                  title={styleLabels[st].name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--accent-pink)' : '1px solid transparent',
                    background: isSelected ? 'rgba(244, 63, 94, 0.22)' : 'transparent',
                    color: isSelected ? 'var(--accent-pink)' : 'var(--text-muted)',
                    fontSize: '0.7rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {styleLabels[st].icon}
                  <span style={{ display: isSelected ? 'inline' : 'none', fontSize: '0.68rem' }}>
                    {styleLabels[st].name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Kontener płótna fali (obsługa przeciągania myszą i dotykiem) */}
      <div
        ref={containerRef}
        className="waveform-container"
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          cursor: isDragging ? 'grabbing' : onSeek || onSeekCommit ? 'pointer' : 'default',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'rgba(10, 12, 22, 0.55)',
          backdropFilter: 'blur(12px)',
          border: isDragging ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
          boxShadow: isDragging
            ? '0 0 16px rgba(244, 63, 94, 0.35), inset 0 2px 8px rgba(0,0,0,0.4)'
            : 'inset 0 2px 8px rgba(0,0,0,0.4)',
          userSelect: 'none',
          touchAction: 'none',
          isolation: 'isolate',
          contain: 'paint layout',
          transition: isDragging ? 'none' : 'border-color 0.2s ease, box-shadow 0.2s ease',
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
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            willChange: 'transform',
          }}
        />

        {/* Pływający wskaźnik czasu przy najechaniu myszą lub przeciąganiu */}
        {(isDragging || hoverX !== null) && hoverX !== null && hoverTimeStr && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              left: `${Math.max(30, Math.min(dimensions.width - 30, hoverX))}px`,
              transform: 'translateX(-50%) translateZ(0)',
              background: 'rgba(15, 20, 32, 0.95)',
              border: isDragging ? '1px solid var(--accent-pink)' : '1px solid var(--accent-cyan)',
              color: '#fff',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              pointerEvents: 'none',
              boxShadow: isDragging ? '0 4px 14px rgba(244, 63, 94, 0.55)' : '0 4px 12px rgba(0,0,0,0.6)',
              zIndex: 10,
            }}
          >
            {hoverTimeStr}
          </div>
        )}
      </div>
    </div>
  );
};
