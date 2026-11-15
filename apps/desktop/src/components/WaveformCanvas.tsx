import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BarChart2, Waves, Activity, Sliders } from 'lucide-react';

export type WaveformStyle = 'bars' | 'smooth' | 'scrolling' | 'mirror';

export interface WaveformCanvasProps {
  peaks: number[];
  progress: number; // 0..100
  durationMs?: number;
  positionMs?: number;
  isPlaying?: boolean;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  colorPlayedStart?: string;
  colorPlayedEnd?: string;
  colorUnplayed?: string;
  onSeek?: (pct: number) => void;
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
  isPlaying = false,
  height = 64,
  className,
  style,
  colorPlayedStart = '#f43f5e',
  colorPlayedEnd = '#a855f7',
  colorUnplayed = 'rgba(255, 255, 255, 0.16)',
  onSeek,
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

    const currentX = (progress / 100) * width;

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
      const scrollOffset = (progress / 100) * totalWaveWidth;

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
      if (durationMs > 0 && positionMs > 0) {
        ctx.fillStyle = 'rgba(15, 20, 32, 0.85)';
        ctx.fillRect(playheadX + 4, 4, 38, 14);
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(formatTimeSec(positionMs / 1000), playheadX + 7, 14);
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

    ctx.restore();
  }, [
    dimensions,
    normalizedPeaks,
    progress,
    activeStyle,
    colorPlayedStart,
    colorPlayedEnd,
    colorUnplayed,
    hoverX,
    positionMs,
    durationMs,
    isPlaying,
  ]);

  // Obsługa kliknięcia i najechania myszką
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = x / rect.width;
    setHoverX(x);
    setHoverPct(pct);
  };

  const handleMouseLeave = () => {
    setHoverX(null);
    setHoverPct(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  const isPl = currentLang === 'pl';

  const styleLabels: Record<WaveformStyle, { name: string; icon: React.ReactNode }> = {
    smooth: { name: isPl ? 'Gładka Fala' : 'Smooth Wave', icon: <Waves size={13} /> },
    bars: { name: isPl ? 'Słupki Cyber' : 'Cyber Bars', icon: <BarChart2 size={13} /> },
    scrolling: { name: isPl ? 'Przewijana DJ' : 'Scrolling DJ', icon: <Activity size={13} /> },
    mirror: { name: isPl ? 'Lustrzane Spektrum' : 'Mirror Spectrum', icon: <Sliders size={13} /> },
  };

  const hoverTimeStr = useMemo(() => {
    if (hoverPct === null || !durationMs || durationMs <= 0) return null;
    const timeSec = (hoverPct * durationMs) / 1000;
    return formatTimeSec(timeSec);
  }, [hoverPct, durationMs]);

  return (
    <div
      ref={containerRef}
      className={`waveform-container ${className || ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        cursor: onSeek ? 'pointer' : 'default',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'rgba(10, 12, 22, 0.55)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
        userSelect: 'none',
        transition: 'border-color 0.2s ease',
        ...style,
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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

      {/* Pływający wskaźnik czasu przy najechaniu myszą */}
      {hoverX !== null && hoverTimeStr && (
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            left: `${Math.max(30, Math.min(dimensions.width - 30, hoverX))}px`,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 20, 32, 0.95)',
            border: '1px solid var(--accent-cyan)',
            color: '#fff',
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            zIndex: 10,
          }}
        >
          {hoverTimeStr}
        </div>
      )}

      {/* Przełącznik stylów fali w prawym górnym rogu */}
      {showStyleSelector && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(15, 18, 30, 0.88)',
            backdropFilter: 'blur(10px)',
            padding: '2px 4px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            zIndex: 20,
            opacity: 0.82,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.82')}
          onClick={(e) => e.stopPropagation()}
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
                  padding: '3px 6px',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid var(--accent-pink)' : '1px solid transparent',
                  background: isSelected ? 'rgba(244, 63, 94, 0.22)' : 'transparent',
                  color: isSelected ? 'var(--accent-pink)' : 'var(--text-muted)',
                  fontSize: '0.68rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {styleLabels[st].icon}
                <span style={{ display: isSelected ? 'inline' : 'none', fontSize: '0.65rem' }}>
                  {styleLabels[st].name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
