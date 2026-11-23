/**
 * Rysowanie poszczególnych trybów wizualizatora widma. Funkcje są czyste względem canvasu: dostają kontekst
 * (współrzędne w pikselach CSS), wygładzone pasma i stan animacji. Każdy tryb sam zapisuje/przywraca stan
 * kontekstu (`save`/`restore`), więc `lineCap`, cienie itp. nie „przeciekają” między trybami.
 */
import { GradientCache, roundRectPath } from '../../utils/canvasDraw';
import { circularBandIndex } from '../../utils/spectrumBands';

export const VISUALIZER_MODES = [
  'bars',
  'retro_bars',
  'anime_circle',
  'oscilloscope',
  'wave',
  'circular',
  'mirrored',
  'lissajous',
] as const;

export type VisualizerMode = (typeof VISUALIZER_MODES)[number];

export function isVisualizerMode(value: unknown): value is VisualizerMode {
  return typeof value === 'string' && (VISUALIZER_MODES as readonly string[]).includes(value);
}

export function nextVisualizerMode(mode: VisualizerMode): VisualizerMode {
  return VISUALIZER_MODES[(VISUALIZER_MODES.indexOf(mode) + 1) % VISUALIZER_MODES.length];
}

/** Prędkość obrotu (rad/s) trybów, które się obracają — tylko podczas odtwarzania. */
export const ROTATION_RAD_PER_SEC: Partial<Record<VisualizerMode, number>> = {
  circular: 0.42,
  anime_circle: 0.72,
  lissajous: 2.1,
};

/** Prędkość „czasu” oscyloskopu (jednostki/s) — dawne `Date.now() * 0.003`. */
export const OSCILLOSCOPE_TIME_PER_SEC = 3;

export interface SpectrumDrawState {
  ctx: CanvasRenderingContext2D;
  /** Rozmiar w pikselach CSS. */
  width: number;
  height: number;
  /** Wygładzone pasma 0..1 (liczba ważnych: `count`). */
  bands: readonly number[];
  peaks: readonly number[];
  count: number;
  isPlaying: boolean;
  rotation: number;
  time: number;
  gradients: GradientCache;
}

type Drawer = (s: SpectrumDrawState) => void;

const drawBars: Drawer = ({ ctx, width, height, bands, peaks, count, gradients }) => {
  const barWidth = (width - (count - 1) * 3) / count;
  for (let i = 0; i < count; i++) {
    const val = bands[i];
    const barHeight = Math.max(6, val * (height - 8));
    const x = i * (barWidth + 3);
    const y = height - barHeight;
    const gradY = Math.round(y);

    // Gradient neonowy zależy tylko od wysokości słupka — współdzielony między słupkami i klatkami
    ctx.fillStyle = gradients.get(`bars:${height}:${gradY}`, () => {
      const grad = ctx.createLinearGradient(0, height, 0, gradY);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
      grad.addColorStop(0.45, 'rgba(168, 85, 247, 0.8)');
      grad.addColorStop(1, 'rgba(244, 63, 94, 0.98)');
      return grad;
    });
    ctx.beginPath();
    roundRectPath(ctx, x, y, barWidth, barHeight, [4, 4, 0, 0]);
    ctx.fill();

    // Kapturek szczytu (Peak cap) w jaskrawym kolorze neonu
    const peakY = height - Math.max(6, peaks[i] * (height - 8)) - 3;
    ctx.fillStyle = '#ff6b81';
    ctx.fillRect(x, Math.max(0, peakY), barWidth, 3);
  }
};

const drawWave: Drawer = ({ ctx, width, height, bands, count, gradients }) => {
  if (count < 2) return; // krzywa wymaga co najmniej 2 pasm (inaczej dzielenie przez zero)
  const step = width / (count - 1);
  ctx.beginPath();
  ctx.moveTo(0, height - bands[0] * (height - 8));
  for (let i = 1; i < count; i++) {
    const prevX = (i - 1) * step;
    const prevY = height - bands[i - 1] * (height - 8);
    const currX = i * step;
    const currY = height - bands[i] * (height - 8);
    const midX = (prevX + currX) / 2;
    ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + currY) / 2);
  }
  ctx.lineTo(width, height - bands[count - 1] * (height - 8));

  // Obrys fali
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Wypełnienie gradientem
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = gradients.get(`wave:${height}`, () => {
    const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
    fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    fillGrad.addColorStop(1, 'rgba(168, 85, 247, 0.02)');
    return fillGrad;
  });
  ctx.fill();
};

const drawMirrored: Drawer = ({ ctx, width, height, bands, count, gradients }) => {
  const halfWidth = width / 2;
  const barWidth = (halfWidth - (count - 1) * 2) / count;
  for (let i = 0; i < count; i++) {
    const barHeight = Math.max(3, bands[i] * (height / 2 - 4));
    const h = Math.round(barHeight);

    ctx.fillStyle = gradients.get(`mirror:${height}:${h}`, () => {
      const grad = ctx.createLinearGradient(0, height / 2 - h, 0, height / 2 + h);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.5, '#06b6d4');
      grad.addColorStop(1, '#a855f7');
      return grad;
    });

    // Prawa strona
    ctx.fillRect(halfWidth + i * (barWidth + 2), height / 2 - barHeight, barWidth, barHeight * 2);
    // Lewa strona (lustrzana)
    ctx.fillRect(halfWidth - (i + 1) * (barWidth + 2), height / 2 - barHeight, barWidth, barHeight * 2);
  }
};

const drawCircular: Drawer = ({ ctx, width, height, bands, count, rotation, gradients }) => {
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) * 0.22;
  const totalRays = 48;
  const maxRay = Math.min(width, height) * 0.25;

  ctx.save();
  // Okrąg wewnętrzny
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius - 2, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < totalRays; i++) {
    const angle = (i / totalRays) * 2 * Math.PI + rotation;
    const val = bands[circularBandIndex(i, count)] || 0.05;
    const rayLen = Math.max(3, val * maxRay);
    const len = Math.round(rayLen);

    // Promień rysowany w lokalnym układzie (obrót wokół środka) — gradient zależy tylko od długości
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(baseRadius, 0);
    ctx.lineTo(baseRadius + rayLen, 0);
    ctx.strokeStyle = gradients.get(`circ:${Math.round(baseRadius)}:${len}`, () => {
      const grad = ctx.createLinearGradient(Math.round(baseRadius), 0, Math.round(baseRadius) + len, 0);
      grad.addColorStop(0, '#06b6d4');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#ff4d94');
      return grad;
    });
    ctx.stroke();

    // Kropka na szczycie promienia
    ctx.fillStyle = '#ff6b81';
    ctx.beginPath();
    ctx.arc(baseRadius + rayLen, 0, 1.2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

const drawAnimeCircle: Drawer = ({ ctx, width, height, bands, count, rotation, gradients }) => {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.44;
  const bassLevel = (bands[0] || 0) * 0.6 + (bands[1] || 0) * 0.4;
  const coreR = Math.max(8, 14 + bassLevel * 16);

  // Pulsujące jądro anime z poświatą neonową
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = 'rgba(255, 77, 148, 0.75)';

  // Wewnętrzne koło (Kitsune Core)
  const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.5, '#ff4d94');
  coreGrad.addColorStop(1, '#7928ca');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR, 0, 2 * Math.PI);
  ctx.fill();

  // Podwójny pierścień rezonansowy
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR + 4 + bassLevel * 6, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // 36 promieni mocy
  ctx.save();
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const raysCount = 36;
  const start = coreR + 3;
  const startKey = Math.round(start);
  for (let i = 0; i < raysCount; i++) {
    const angle = (i / raysCount) * 2 * Math.PI + rotation;
    const val = bands[i % count] || 0.04;
    const spikeLen = Math.max(4, val * (maxR - coreR));
    const len = Math.round(spikeLen);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(start, 0);
    ctx.lineTo(start + spikeLen, 0);
    ctx.strokeStyle = gradients.get(`anime:${startKey}:${len}`, () => {
      const rayGrad = ctx.createLinearGradient(startKey, 0, startKey + len, 0);
      rayGrad.addColorStop(0, '#06b6d4');
      rayGrad.addColorStop(0.6, '#ff4d94');
      rayGrad.addColorStop(1, '#fbbf24');
      return rayGrad;
    });
    ctx.stroke();

    // Iskra energii na szczycie każdego promienia
    if (val > 0.22) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(start + spikeLen, 0, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
};

const drawOscilloscope: Drawer = ({ ctx, width, height, bands, count, isPlaying, time }) => {
  // Siatka laboratoryjna CRT (delikatne linie pomocnicze) — bez poświaty
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Wiązka wektorowa CRT Phosphor Beam na podstawie składowych widma
  const pointsCount = 120;
  ctx.beginPath();
  for (let i = 0; i <= pointsCount; i++) {
    const t = i / pointsCount;
    const x = t * width;

    const bandIndex = Math.min(count - 1, Math.floor(t * count));
    const nextIndex = Math.min(count - 1, bandIndex + 1);
    const frac = t * count - bandIndex;
    const amp = bands[bandIndex] * (1 - frac) + bands[nextIndex] * frac;

    const f1 = Math.sin(t * 18.0 + time * 3.5) * amp;
    const f2 = Math.sin(t * 36.0 - time * 5.0) * (amp * 0.5);
    const f3 = Math.cos(t * 6.0 + time * 1.5) * (amp * 0.35);
    const offset = (f1 + f2 + f3) * (height * 0.42);

    const y = height / 2 + (isPlaying ? offset : Math.sin(t * 8.0 + time) * 2.0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Poświata tylko na szerokiej wiązce (jedno rozmycie zamiast trzech), cienka biała linia bez cienia
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00ffcc';
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
};

const drawRetroBars: Drawer = ({ ctx, width, height, bands, peaks, count, isPlaying }) => {
  // Klasyczny rack Hi-Fi z segmentowanymi diodami LED VFD (zielony / bursztynowy / czerwony peak)
  const segmentsPerCol = 14;
  const barSpacing = 4;
  const barWidth = (width - (count - 1) * barSpacing) / count;
  const segHeight = Math.max(3, (height - 14) / segmentsPerCol);
  const segGap = 1.5;

  for (let i = 0; i < count; i++) {
    const litSegments = Math.round(bands[i] * segmentsPerCol);
    const peakSegment = Math.min(segmentsPerCol - 1, Math.round(peaks[i] * segmentsPerCol));
    const colX = i * (barWidth + barSpacing);

    for (let s = 0; s < segmentsPerCol; s++) {
      const segY = height - 8 - (s + 1) * segHeight;
      const isLit = s < litSegments;
      const isPeak = s === peakSegment && isLit;

      let color = 'rgba(255, 255, 255, 0.05)';
      if (isLit) {
        if (s < segmentsPerCol * 0.6) color = '#10b981';
        else if (s < segmentsPerCol * 0.82) color = '#f59e0b';
        else color = '#ef4444';
      }

      ctx.fillStyle = color;
      ctx.fillRect(colX, segY, barWidth, segHeight - segGap);

      if (isPeak && isPlaying) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(colX, segY, barWidth, segHeight - segGap);
      }
    }
  }
};

const drawLissajous: Drawer = ({ ctx, width, height, bands, count, isPlaying, rotation }) => {
  // Stereo Vectorscope / Lissajous XY phase scope
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.44;

  ctx.save();
  // Siatka celownicza oscyloskopu
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  if (isPlaying) {
    const points = 120;
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;

    for (let p = 0; p <= points; p++) {
      const t = (p / points) * Math.PI * 2;
      const b1 = bands[p % count] || 0.1;
      const b2 = bands[(p + 3) % count] || 0.1;
      const x = centerX + Math.sin(t * 2 + rotation) * (radius * (0.25 + b1 * 0.75));
      const y = centerY + Math.cos(t * 3) * (radius * (0.25 + b2 * 0.75));
      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

export const MODE_DRAWERS: Record<VisualizerMode, Drawer> = {
  bars: drawBars,
  retro_bars: drawRetroBars,
  anime_circle: drawAnimeCircle,
  oscilloscope: drawOscilloscope,
  wave: drawWave,
  circular: drawCircular,
  mirrored: drawMirrored,
  lissajous: drawLissajous,
};
