/** Czysta matematyka wskaźnika VU (bez canvasu): poziomy L/R ze spektrum, balistyka, skala dB. */
import { smoothTo, tauFromFrameLerp, fallPerSec } from '../../utils/smoothing';

export type VuTheme = 'amber' | 'sakura' | 'cyber';

export interface VuColors {
  bgGradStart: string;
  bgGradEnd: string;
  faceBg: string;
  faceGrad: string;
  bezel: string;
  textDark: string;
  needle: string;
  needleCap: string;
  glow: string;
  redZone: string;
  accent: string;
}

/** Motywy podświetlenia wskaźnika. */
export const VU_THEMES: Record<VuTheme, VuColors> = {
  amber: {
    bgGradStart: '#2d1b06',
    bgGradEnd: '#130c02',
    faceBg: '#fef3c7',
    faceGrad: '#fde68a',
    bezel: '#78350f',
    textDark: '#451a03',
    needle: '#b91c1c',
    needleCap: '#7f1d1d',
    glow: 'rgba(245, 158, 11, 0.45)',
    redZone: '#dc2626',
    accent: '#d97706',
  },
  sakura: {
    bgGradStart: '#2b091f',
    bgGradEnd: '#12040d',
    faceBg: '#fce7f3',
    faceGrad: '#fbcfe8',
    bezel: '#831843',
    textDark: '#500724',
    needle: '#e11d48',
    needleCap: '#881337',
    glow: 'rgba(244, 63, 94, 0.45)',
    redZone: '#e11d48',
    accent: '#db2777',
  },
  cyber: {
    bgGradStart: '#04222a',
    bgGradEnd: '#020e12',
    faceBg: '#cffafe',
    faceGrad: '#a5f3fc',
    bezel: '#155e75',
    textDark: '#083344',
    needle: '#0284c7',
    needleCap: '#0369a1',
    glow: 'rgba(6, 182, 212, 0.45)',
    redZone: '#ef4444',
    accent: '#0891b2',
  },
};

/** Wagi psychoakustyczne ITU-R BS.1770 dla 16 pasm percepcyjnych. */
export const VU_WEIGHTS = [1.2, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1.0, 1.0, 1.0, 1.05, 1.1, 1.05, 1.0, 0.95, 0.9];
const WEIGHT_SUM = VU_WEIGHTS.reduce((sum, w) => sum + w, 0);

/** Znaczniki skali (pozycja 0..1 na łuku → etykieta). */
export const VU_MARKS: readonly { norm: number; label: string }[] = [
  { norm: 0.0, label: '-20' },
  { norm: 0.26, label: '-10' },
  { norm: 0.44, label: '-7' },
  { norm: 0.6, label: '-5' },
  { norm: 0.72, label: '-3' },
  { norm: 0.8, label: '0' },
  { norm: 0.9, label: '+1' },
  { norm: 1.0, label: '+3' },
];

/** Punkty interpolacji dB dokładnie odpowiadające podziałce tarczy. */
const DB_POINTS: readonly { n: number; db: number }[] = [
  { n: 0.0, db: -20.0 },
  { n: 0.26, db: -10.0 },
  { n: 0.44, db: -7.0 },
  { n: 0.6, db: -5.0 },
  { n: 0.72, db: -3.0 },
  { n: 0.8, db: 0.0 },
  { n: 0.9, db: 1.0 },
  { n: 1.0, db: 3.0 },
  { n: 1.05, db: 3.8 },
];

/** Odczyt cyfrowy dB dla wychylenia wskazówki 0..1.05. */
export function calcDb(norm: number): string {
  if (norm <= 0.01) return '-∞ dB';
  const pts = DB_POINTS;
  if (norm <= pts[0].n) return `${pts[0].db.toFixed(1)} dB`;
  if (norm >= pts[pts.length - 1].n) return `+${pts[pts.length - 1].db.toFixed(1)} dB`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (norm >= p1.n && norm <= p2.n) {
      const t = (norm - p1.n) / (p2.n - p1.n);
      const val = p1.db + t * (p2.db - p1.db);
      return val > 0 ? `+${val.toFixed(1)} dB` : `${val.toFixed(1)} dB`;
    }
  }
  return '0.0 dB';
}

/** Surowe poziomy kanałów (przed balistyką). 32 pasma = L(0..15) + R(16..31), mniej = mono. */
export function computeVuLevels(
  spectrum: readonly number[],
  volume: number,
  isPlaying: boolean,
): { left: number; right: number } {
  if (!isPlaying || spectrum.length === 0) return { left: 0, right: 0 };

  if (spectrum.length >= 32) {
    let energyL = 0;
    let energyR = 0;
    for (let i = 0; i < 16; i++) {
      const w = VU_WEIGHTS[i] || 1.0;
      energyL += (spectrum[i] || 0) * w;
      energyR += (spectrum[i + 16] || 0) * w;
    }
    return {
      left: (energyL / Math.max(1, WEIGHT_SUM)) * volume * 1.45,
      right: (energyR / Math.max(1, WEIGHT_SUM)) * volume * 1.45,
    };
  }

  let total = 0;
  for (let i = 0; i < spectrum.length; i++) {
    total += (spectrum[i] || 0) * (VU_WEIGHTS[i] || 1.0);
  }
  const avg = (total / Math.max(1, WEIGHT_SUM)) * volume * 1.45;
  return { left: avg, right: avg };
}

/** Balistyka analogowa VU: szybki narost (attack), płynne opadanie (decay) — dawne stałe 0.35 / 0.08 na klatkę 60 Hz. */
export const VU_ATTACK_TAU = tauFromFrameLerp(0.35);
export const VU_DECAY_TAU = tauFromFrameLerp(0.08);
/** Opadanie wskaźnika szczytu (dawne 0.015 na klatkę 60 Hz). */
export const VU_PEAK_FALL_PER_SEC = fallPerSec(0.015);
/** Próg szczytu zapalający diodę PEAK. */
export const VU_PEAK_LED_THRESHOLD = 0.84;

export interface VuChannelState {
  level: number;
  peak: number;
}

export function stepVuChannel(state: VuChannelState, raw: number, dtSec: number): VuChannelState {
  const tau = raw > state.level ? VU_ATTACK_TAU : VU_DECAY_TAU;
  const level = smoothTo(state.level, raw, dtSec, tau);
  const peak = level > state.peak ? level : Math.max(0, state.peak - VU_PEAK_FALL_PER_SEC * dtSec);
  return { level, peak };
}

/** Wskaźnik jest ustalony (nic się nie rusza) — można uśpić pętlę rysowania. */
export function isVuSettled(state: VuChannelState, isPlaying: boolean): boolean {
  return !isPlaying && state.level < 0.001 && state.peak < 0.001;
}

export interface MeterGeometry {
  margin: number;
  faceW: number;
  faceH: number;
  pivotX: number;
  pivotY: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  totalSweep: number;
  redZoneThreshold: number;
  redZoneAngle: number;
  ledX: number;
  ledY: number;
}

/** Geometria jednego wskaźnika o wymiarach `w`×`h` (px CSS). */
export function meterGeometry(w: number, h: number): MeterGeometry {
  const margin = 3.5;
  const faceW = w - margin * 2;
  const faceH = h - margin * 2;
  const pivotX = margin + faceW / 2;
  const pivotY = margin + faceH * 0.94;

  // Kąty wychylenia: od -125° do -55° (70° zakres, standard IEC VU)
  const startAngle = -Math.PI * 0.694;
  const endAngle = -Math.PI * 0.306;
  const totalSweep = endAngle - startAngle;

  // Promień tak, aby łuk i kreski w 100% mieściły się w tarczy
  const maxRHorizontal = (faceW / 2 - 8) / 0.58; // cos(-125°) = -0.5735
  const maxRVertical = pivotY - (margin + 18);
  const radius = Math.max(20, Math.min(maxRHorizontal, maxRVertical));

  const redZoneThreshold = 0.8;
  return {
    margin,
    faceW,
    faceH,
    pivotX,
    pivotY,
    radius,
    startAngle,
    endAngle,
    totalSweep,
    redZoneThreshold,
    redZoneAngle: startAngle + totalSweep * redZoneThreshold,
    ledX: margin + faceW - 9,
    ledY: margin + 9,
  };
}

/** Układ dwóch wskaźników (L i R) w canvasie `width`×`height`. */
export function stereoLayout(width: number, height: number): { pad: number; gap: number; meterWidth: number; meterHeight: number } {
  const gap = 6;
  const pad = 4;
  return { pad, gap, meterWidth: (width - pad * 2 - gap) / 2, meterHeight: height - pad * 2 };
}
