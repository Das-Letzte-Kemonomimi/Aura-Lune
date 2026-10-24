import React, { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  peaks: number[];
  progress: number; // 0..100
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  colorPlayedStart?: string;
  colorPlayedEnd?: string;
  colorUnplayed?: string;
  onSeek?: (pct: number) => void;
  title?: string;
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

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  peaks,
  progress,
  height = 48,
  className,
  style,
  colorPlayedStart = '#06b6d4',
  colorPlayedEnd = '#f43f5e',
  colorUnplayed = 'rgba(255, 255, 255, 0.16)',
  onSeek,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const count = peaks.length;
    if (count === 0) return;

    const width = canvas.width;
    const canvasHeight = canvas.height;
    ctx.clearRect(0, 0, width, canvasHeight);

    const gap = 2;
    const totalGap = (count - 1) * gap;
    const barWidth = Math.max(1, (width - totalGap) / count);

    // Bezpieczne rozwiązywanie kolorów dla Canvas 2D (nie toleruje bezpośrednich ciągów var(--...))
    const resolvedStart = resolveCssColor(colorPlayedStart, '#f43f5e');
    const resolvedEnd = resolveCssColor(colorPlayedEnd, '#a855f7');
    const resolvedUnplayed = resolveCssColor(colorUnplayed, 'rgba(255, 255, 255, 0.16)');

    // Gradient dla odtworzonej części
    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    try {
      grad.addColorStop(0, resolvedStart);
      grad.addColorStop(1, resolvedEnd);
    } catch {
      try {
        grad.addColorStop(0, '#f43f5e');
        grad.addColorStop(1, '#a855f7');
      } catch {
        // Ignoruj błędy gradientu w nietypowych środowiskach
      }
    }

    for (let i = 0; i < count; i++) {
      const peak = peaks[i];
      const barPct = (i / count) * 100;
      const isPlayed = barPct <= progress;

      const barHeight = Math.max(6, (Math.max(16, peak) / 100) * (canvasHeight - 4));
      const x = i * (barWidth + gap);
      const y = (canvasHeight - barHeight) / 2;

      ctx.fillStyle = isPlayed ? grad : resolvedUnplayed;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barWidth, barHeight, 2);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
  }, [peaks, progress, colorPlayedStart, colorPlayedEnd, colorUnplayed]);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        cursor: onSeek ? 'pointer' : 'default',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        padding: '2px 0',
        ...style,
      }}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(pct);
      }}
      title={title}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
    </div>
  );
};
