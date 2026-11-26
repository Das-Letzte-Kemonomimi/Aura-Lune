/**
 * Rysowanie wskaźnika VU podzielone na warstwę STATYCZNĄ (obudowa, tarcza, skala, etykiety — zależy tylko od
 * motywu i rozmiaru, rysowana raz do canvasu offscreen) i DYNAMICZNĄ (dioda PEAK, odczyt dB, wskazówka — co klatkę).
 */
import { roundRectPath } from '../../utils/canvasDraw';
import {
  VU_MARKS,
  VU_PEAK_LED_THRESHOLD,
  calcDb,
  meterGeometry,
  stereoLayout,
  type VuColors,
} from './vuMeterMath';

const BADGE_W = 34;
const BADGE_H = 10.5;

/** Część niezmienna wskaźnika (ramka, tarcza, skala, etykiety, tło odczytu dB). Rysuje w układzie (0,0)-(w,h). */
function drawMeterStatic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, colors: VuColors) {
  const g = meterGeometry(w, h);
  ctx.save();
  ctx.translate(x, y);

  // Zaokrąglona ramka wskaźnika (Vintage Bezel)
  ctx.fillStyle = colors.bgGradStart;
  ctx.beginPath();
  roundRectPath(ctx, 0, 0, w, h, 8);
  ctx.fill();

  // Wewnętrzna tarcza (Faceplate)
  const faceGrad = ctx.createLinearGradient(0, g.margin, 0, g.margin + g.faceH);
  faceGrad.addColorStop(0, colors.faceBg);
  faceGrad.addColorStop(1, colors.faceGrad);
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  roundRectPath(ctx, g.margin, g.margin, g.faceW, g.faceH, 6);
  ctx.fill();

  // Subtelne obramowanie tarczy
  ctx.strokeStyle = colors.bezel;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Obszar przycinania — rysowanie nigdy nie przekracza ramki
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, g.margin, g.margin, g.faceW, g.faceH, 6);
  ctx.clip();

  // Cień głębokości szybki (wypukłe szkło)
  const glassShadow = ctx.createLinearGradient(0, g.margin, 0, g.margin + 12);
  glassShadow.addColorStop(0, 'rgba(0, 0, 0, 0.16)');
  glassShadow.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = glassShadow;
  ctx.fillRect(g.margin, g.margin, g.faceW, 12);

  // Etykieta kanału
  ctx.font = '800 7.5px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = colors.textDark;
  ctx.textAlign = 'left';
  ctx.fillText(label, g.margin + 6, g.margin + 11);

  // Główny łuk ciemny (-20 do 0 VU)
  ctx.beginPath();
  ctx.arc(g.pivotX, g.pivotY, g.radius, g.startAngle, g.redZoneAngle);
  ctx.strokeStyle = colors.textDark;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Czerwony segment przesteru (0 do +3 VU)
  ctx.beginPath();
  ctx.arc(g.pivotX, g.pivotY, g.radius, g.redZoneAngle, g.endAngle);
  ctx.strokeStyle = colors.redZone;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Kreski skali dB i etykiety
  ctx.font = '700 6.8px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  for (const m of VU_MARKS) {
    const angle = g.startAngle + g.totalSweep * m.norm;
    const isRed = m.norm >= g.redZoneThreshold;
    const innerR = g.radius - 3.2;
    const outerR = g.radius + 2.4;

    ctx.beginPath();
    ctx.moveTo(g.pivotX + Math.cos(angle) * innerR, g.pivotY + Math.sin(angle) * innerR);
    ctx.lineTo(g.pivotX + Math.cos(angle) * outerR, g.pivotY + Math.sin(angle) * outerR);
    ctx.strokeStyle = isRed ? colors.redZone : colors.textDark;
    ctx.lineWidth = isRed ? 1.6 : 1.1;
    ctx.stroke();

    const textR = g.radius - 8.5;
    ctx.fillStyle = isRed ? colors.redZone : colors.textDark;
    ctx.fillText(m.label, g.pivotX + Math.cos(angle) * textR, g.pivotY + Math.sin(angle) * textR + 2.2);
  }

  // Subtelna etykieta "VU" pod łukiem
  ctx.font = '800 7px system-ui, sans-serif';
  ctx.fillStyle = colors.textDark;
  ctx.textAlign = 'center';
  ctx.fillText('VU', g.pivotX, g.pivotY - g.radius * 0.52);

  // Tło badge LCD z odczytem dB (sam tekst jest dynamiczny)
  const badgeX = g.pivotX - BADGE_W / 2;
  const badgeY = g.pivotY - g.radius * 0.38;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.beginPath();
  roundRectPath(ctx, badgeX, badgeY, BADGE_W, BADGE_H, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore(); // koniec clip
  ctx.restore(); // koniec translate
}

/** Część zmienna: dioda PEAK, odczyt dB, wskazówka i jej oś. Przycięta do tarczy, jak w pełnym rysunku. */
function drawMeterDynamic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  level: number,
  peak: number,
  colors: VuColors,
) {
  const g = meterGeometry(w, h);
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  roundRectPath(ctx, g.margin, g.margin, g.faceW, g.faceH, 6);
  ctx.clip();

  // Dioda Peak LED w prawym górnym rogu
  const isPeakActive = peak >= VU_PEAK_LED_THRESHOLD;
  ctx.beginPath();
  ctx.arc(g.ledX, g.ledY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = isPeakActive ? '#ef4444' : 'rgba(239, 68, 68, 0.25)';
  ctx.fill();
  if (isPeakActive) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  const clampedLevel = Math.max(0.0, Math.min(1.05, level));

  // Cyfrowy odczyt dB
  ctx.font = '700 6.5px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = isPeakActive ? '#ef4444' : colors.accent;
  ctx.fillText(calcDb(clampedLevel), g.pivotX, g.pivotY - g.radius * 0.38 + 7.5);

  // Wskazówka (Needle)
  const needleAngle = g.startAngle + g.totalSweep * clampedLevel;
  const needleTipR = g.radius + 1.2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.pivotX, g.pivotY);
  ctx.lineTo(g.pivotX + Math.cos(needleAngle) * needleTipR, g.pivotY + Math.sin(needleAngle) * needleTipR);
  ctx.strokeStyle = colors.needle;
  ctx.lineWidth = 1.3;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 2;
  ctx.stroke();
  ctx.restore();

  // Czapka obrotu wskazówki (Needle Pivot Cap)
  ctx.beginPath();
  ctx.arc(g.pivotX, g.pivotY, 4, 0, Math.PI * 2);
  ctx.fillStyle = colors.needleCap;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}

/**
 * Renderuje całą statyczną warstwę (oba wskaźniki) do osobnego canvasu o tym samym buforze co `target`,
 * tak aby kopiowanie 1:1 (`drawImage` z tożsamą transformacją) było idealnie ostre.
 */
export function renderVuFaceLayer(
  backingWidth: number,
  backingHeight: number,
  cssWidth: number,
  cssHeight: number,
  colors: VuColors,
): HTMLCanvasElement | null {
  const layer = document.createElement('canvas');
  layer.width = backingWidth;
  layer.height = backingHeight;
  const ctx = layer.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(backingWidth / cssWidth, 0, 0, backingHeight / cssHeight, 0, 0);
  const { pad, gap, meterWidth, meterHeight } = stereoLayout(cssWidth, cssHeight);
  drawMeterStatic(ctx, pad, pad, meterWidth, meterHeight, 'LEFT (CH 1)', colors);
  drawMeterStatic(ctx, pad + meterWidth + gap, pad, meterWidth, meterHeight, 'RIGHT (CH 2)', colors);
  return layer;
}

/** Rysuje zmienne elementy obu wskaźników na bieżącym (już ze statyczną warstwą) canvasie. */
export function drawVuDynamic(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  left: { level: number; peak: number },
  right: { level: number; peak: number },
  colors: VuColors,
): void {
  const { pad, gap, meterWidth, meterHeight } = stereoLayout(cssWidth, cssHeight);
  drawMeterDynamic(ctx, pad, pad, meterWidth, meterHeight, left.level, left.peak, colors);
  drawMeterDynamic(ctx, pad + meterWidth + gap, pad, meterWidth, meterHeight, right.level, right.peak, colors);
}
