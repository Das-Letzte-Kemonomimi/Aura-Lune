import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { BarChart2, Waves, Activity, Sliders } from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';
import { computeBarLayout, resamplePeaks, sanitizePeaks } from './waveformGeometry';

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

/** Szerokość jednego szczytu na przewijanej fali DJ (px) — wspólna dla rysowania i przeciągania. */
const SCROLL_UNIT_WIDTH = 6.5;
/** Pozycja stałej igły DJ jako ułamek szerokości (środek). */
const SCROLL_PLAYHEAD_RATIO = 0.5;
/** Minimalne przesunięcie (px), od którego przeciąganie fali DJ jest uznawane za przewijanie, a nie kliknięcie. */
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Szerokość 0 do czasu pierwszego pomiaru — wcześniej start z 800 px rozciągał płótno na mgnienie.
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height });
  const [dpr, setDpr] = useState<number>(() => (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  // Stan przeciągania fali (drag-to-seek)
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragProgressRef = useRef<number | null>(null);
  // Tryb przewijanej fali DJ: przeciąganie przesuwa utwór pod stałą igłą (jog), zamiast skakać do pozycji kursora
  const scrollDragStartXRef = useRef(0);
  const scrollDragStartProgressRef = useRef(0);
  const scrollDragMovedRef = useRef(false);

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
  // useLayoutEffect: pomiar przed pierwszym malowaniem, bez klatki z błędnym rozmiarem.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(height);
      if (w > 0) {
        setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
      const ratio = window.devicePixelRatio || 1;
      setDpr((prev) => (prev === ratio ? prev : ratio));
    };

    updateSize();

    // `resize` łapie też zmianę devicePixelRatio (zoom, przeniesienie na inny monitor).
    window.addEventListener('resize', updateSize);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateSize());
      ro.observe(container);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
    return () => window.removeEventListener('resize', updateSize);
  }, [height]);

  // Interpolacja / wygładzanie danych szczytów
  const normalizedPeaks = useMemo(() => sanitizePeaks(peaks), [peaks]);

  // Główna pętla renderowania Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = dimensions.width;
    const canvasHeight = dimensions.height;
    if (width <= 0 || canvasHeight <= 0) return;

    // Zmiana width/height czyści i realokuje bufor — robimy to tylko przy realnej zmianie rozmiaru,
    // a nie przy każdym ticku postępu (powodowało to migotanie / puste klatki).
    const pxW = Math.floor(width * dpr);
    const pxH = Math.floor(canvasHeight * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

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
      // Krzywa wymaga co najmniej 2 punktów (inaczej dzielenie przez zero → NaN).
      const smoothPeaks = normalizedPeaks.length >= 2 ? normalizedPeaks : [normalizedPeaks[0], normalizedPeaks[0]];
      const count = smoothPeaks.length;
      const step = width / (count - 1);
      const midY = canvasHeight / 2;

      // Punkty krzywej górnej i dolnej
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
      // Układ wypełnia dokładnie całą szerokość, więc słupki są zgodne z pozycją głowicy.
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
        for (const b of bars) {
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(b.x, b.y, barWidth, b.h, Math.min(barWidth / 2, radius));
          } else {
            ctx.rect(b.x, b.y, barWidth, b.h);
          }
        }
        ctx.fill();
      };

      // Jedno wypełnienie z jednym cieniem zamiast cienia dla każdego słupka (znacznie mniej pracy GPU/CPU).
      ctx.save();
      ctx.fillStyle = unplayedColor;
      fillBars(unplayedPath, 4);
      ctx.fillStyle = verticalPlayedGrad;
      ctx.shadowColor = 'rgba(244, 63, 94, 0.45)';
      ctx.shadowBlur = 8;
      fillBars(playedPath, 4);
      ctx.restore();

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
      const playheadX = Math.floor(width * SCROLL_PLAYHEAD_RATIO); // Stała igła DJ w środku
      const count = normalizedPeaks.length;
      const waveUnitWidth = SCROLL_UNIT_WIDTH; // Szerokość pojedynczego taktu
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

      // Rysowanie przewijanych słupków (zbiorczo: jedno wypełnienie na grupę, jeden cień)
      const bWidth = 4.5;
      const played: { x: number; y: number; h: number }[] = [];
      const upcoming: { x: number; y: number; h: number }[] = [];
      for (let i = 0; i < count; i++) {
        const barX = playheadX - scrollOffset + i * waveUnitWidth;

        // Rysuj tylko te elementy, które mieszczą się na ekranie
        if (barX < -20 || barX > width + 20) continue;

        const barHeight = Math.max(10, (Math.max(16, normalizedPeaks[i]) / 100) * (canvasHeight - 8));
        const bar = { x: barX, y: midY - barHeight / 2, h: barHeight };
        (barX <= playheadX ? played : upcoming).push(bar);
      }

      const fillScrollBars = (bars: { x: number; y: number; h: number }[]) => {
        if (bars.length === 0) return;
        ctx.beginPath();
        for (const b of bars) {
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(b.x, b.y, bWidth, b.h, 2.5);
          } else {
            ctx.rect(b.x, b.y, bWidth, b.h);
          }
        }
        ctx.fill();
      };

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      fillScrollBars(upcoming);
      ctx.fillStyle = verticalPlayedGrad;
      ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
      ctx.shadowBlur = 6;
      fillScrollBars(played);
      ctx.restore();

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
        // Bez poświaty igły: inaczej tło i tekst etykiety czasu są rozmyte.
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(15, 20, 32, 0.85)';
        ctx.fillRect(playheadX + 4, 4, 38, 14);
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(formatTimeSec(effectivePosMs / 1000), playheadX + 7, 14);
      }

      // Znacznik głowicy na górze i dole
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
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

      const addRect = (x: number, y: number, h: number, radii: number[]) => {
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, h, radii);
        } else {
          ctx.rect(x, y, barWidth, h);
        }
      };

      // Górna połowa (główna) i dolna (lustrzane odbicie z niższą przezroczystością) —
      // po jednym wypełnieniu na grupę zamiast cienia dla każdego słupka.
      const fillGroup = (
        bars: { x: number; h: number }[],
        fill: string | CanvasGradient,
        lowerAlpha: number,
        glow: boolean,
      ) => {
        if (bars.length === 0) return;
        ctx.save();
        ctx.fillStyle = fill;
        if (glow) {
          ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        for (const b of bars) addRect(b.x, midY - b.h - 1, b.h, [3, 3, 0, 0]);
        ctx.fill();

        ctx.globalAlpha = lowerAlpha;
        ctx.beginPath();
        for (const b of bars) addRect(b.x, midY + 1, b.h * 0.75, [0, 0, 3, 3]);
        ctx.fill();
        ctx.restore();
      };
      fillGroup(unplayedBars, unplayedColor, 0.15, false);
      fillGroup(playedBars, playedGrad, 0.45, true);

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
    if (hoverX !== null && hoverX >= 0 && hoverX <= width && !(activeStyle === 'scrolling' && isDragging)) {
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

        // Etykieta [A (bez cienia — inaczej tekst jest rozmyty)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
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
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('B]', Math.max(2, xB - 15), 11);
      }
      ctx.restore();
    }

    ctx.restore();
  }, [
    dimensions,
    dpr,
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

  const isScrolling = activeStyle === 'scrolling';

  /** Całkowita szerokość przewijanej fali (px) — 1 px przeciągnięcia = utwór / ta szerokość. */
  const scrollTotalWidth = normalizedPeaks.length * SCROLL_UNIT_WIDTH;

  /**
   * Zwraca pozycję (0..1) wskazywaną przez kursor w punkcie `clientX` oraz jego `x` w kontenerze.
   * Dla przewijanej fali DJ `pct` to czas pod kursorem względem stałej igły (podgląd po najechaniu);
   * dla pozostałych stylów to bezwzględna pozycja na osi czasu.
   */
  const getPctFromClientX = (clientX: number): { pct: number; x: number } => {
    const container = containerRef.current;
    if (!container) return { pct: 0, x: 0 };
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    if (isScrolling) {
      const base = (isDraggingRef.current && dragProgressRef.current !== null ? dragProgressRef.current : progress) / 100;
      const pct = base + (x - rect.width * SCROLL_PLAYHEAD_RATIO) / scrollTotalWidth;
      return { pct: Math.max(0, Math.min(1, pct)), x };
    }
    const pct = rect.width > 0 ? x / rect.width : 0;
    return { pct, x };
  };

  /** Nowy postęp (0..1) po przeciągnięciu fali DJ: fala podąża za kursorem, więc utwór cofa się/przewija odwrotnie. */
  const getScrollDragPct = (clientX: number): number => {
    const dx = clientX - scrollDragStartXRef.current;
    const next = scrollDragStartProgressRef.current - (dx / scrollTotalWidth) * 100;
    return Math.max(0, Math.min(100, next)) / 100;
  };

  const beginDrag = (clientX: number, pct: number, x: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    setHoverX(x);
    setHoverPct(pct);

    if (isScrolling) {
      // Fala stoi w miejscu do czasu faktycznego przeciągnięcia; samo kliknięcie nic nie przewija.
      scrollDragStartXRef.current = clientX;
      scrollDragStartProgressRef.current = progress;
      scrollDragMovedRef.current = false;
      dragProgressRef.current = progress;
      setDragProgress(progress);
      return;
    }

    dragProgressRef.current = pct * 100;
    setDragProgress(pct * 100);
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
      setDragProgress(nextPct * 100);
      onSeekPreview?.(nextPct);
      return;
    }

    dragProgressRef.current = pct * 100;
    setDragProgress(pct * 100);
    setHoverX(x);
    setHoverPct(pct);
    onSeekPreview?.(pct);
  };

  /** Kończy przeciąganie; zwraca pozycję do zatwierdzenia albo null, gdy nic nie trzeba przewijać. */
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
    setDragProgress(null);
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
    setHoverX(x);
    setHoverPct(pct);
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
      setDragProgress(null);
    }
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      setHoverX(null);
      setHoverPct(null);
    }
  };

  // Najnowsze funkcje przeciągania dla nasłuchów okna (rejestrowanych tylko na czas przeciągania)
  const dragApiRef = useRef({ getPctFromClientX, moveDrag, endDrag, commitSeek });
  useEffect(() => {
    dragApiRef.current = { getPctFromClientX, moveDrag, endDrag, commitSeek };
  });

  // Obsługa przeciągania na poziomie okna, gdyby kursor opuścił kontener
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
          cursor: isDragging ? 'grabbing' : isScrolling ? 'grab' : onSeek || onSeekCommit ? 'pointer' : 'default',
          borderRadius: '12px',
          overflow: 'hidden',
          // Bez backdrop-filter: kontener jest przemalowywany co tick, a rozmycie tła pod ciągle
          // zmieniającym się płótnem powodowało artefakty kompozytora (WebKitGTK) i spadki klatek.
          background: 'rgba(10, 12, 22, 0.72)',
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
        {(isDragging || hoverX !== null) && hoverX !== null && hoverTimeStr && !(isScrolling && isDragging) && (
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
