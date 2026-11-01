export type ParametricFilterType = 'peak' | 'low-shelf' | 'high-shelf';

export interface ParametricBandDto {
  id: string;
  filter_type: ParametricFilterType;
  freq: number;
  gain_db: number;
  q: number;
  enabled: boolean;
}

export interface ParametricEqStateDto {
  enabled: boolean;
  preamp_db: number;
  bands: ParametricBandDto[];
}

export interface ParametricEqPresetDto {
  name: string;
  description: string;
  state: ParametricEqStateDto;
}

/**
 * Kolory akcentów dla kolejnych pasm parametrycznych w interfejsie.
 */
export const PEQ_BAND_COLORS = [
  '#f43f5e', // Rose
  '#38bdf8', // Sky
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#fb923c', // Orange
];

/**
 * Oblicza odpowiedź częstotliwościową (gain w dB) pojedynczego filtru biquad
 * dla zadanej częstotliwości f (Hz) przy próbkowaniu fs = 48000 Hz
 * na podstawie standardowych wzorów Audio EQ Cookbook Roberta Bristowa-Johnsona.
 */
export function calculateBiquadResponseDb(
  f: number,
  filterType: ParametricFilterType,
  f0: number,
  gainDb: number,
  q: number,
  fs: number = 48000
): number {
  if (gainDb === 0 && filterType === 'peak') return 0;

  const w0 = (2 * Math.PI * f0) / fs;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const safeQ = Math.max(0.05, q);
  const alpha = sinW0 / (2 * safeQ);
  const A = Math.pow(10, gainDb / 40); // sqrt(10^(gainDb/20))

  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a0 = 1;
  let a1 = 0;
  let a2 = 0;

  switch (filterType) {
    case 'peak': {
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
      break;
    }
    case 'low-shelf': {
      const sqrtA2 = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cosW0 + sqrtA2);
      b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
      b2 = A * (A + 1 - (A - 1) * cosW0 - sqrtA2);
      a0 = A + 1 + (A - 1) * cosW0 + sqrtA2;
      a1 = -2 * (A - 1 + (A + 1) * cosW0);
      a2 = A + 1 + (A - 1) * cosW0 - sqrtA2;
      break;
    }
    case 'high-shelf': {
      const sqrtA2 = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cosW0 + sqrtA2);
      b1 = -2 * A * (A - 1 + (A + 1) * cosW0);
      b2 = A * (A + 1 + (A - 1) * cosW0 - sqrtA2);
      a0 = A + 1 - (A - 1) * cosW0 + sqrtA2;
      a1 = 2 * (A - 1 - (A + 1) * cosW0);
      a2 = A + 1 - (A - 1) * cosW0 - sqrtA2;
      break;
    }
  }

  // Normalizacja współczynników przez a0
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  // Obliczenie modułu transmitancji H(e^(j*w)) na częstotliwości f
  const w = (2 * Math.PI * f) / fs;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  const numReal = nb0 + nb1 * cosW + nb2 * cos2W;
  const numImag = -(nb1 * sinW + nb2 * sin2W);

  const denReal = 1 + na1 * cosW + na2 * cos2W;
  const denImag = -(na1 * sinW + na2 * sin2W);

  const numMagSq = numReal * numReal + numImag * numImag;
  const denMagSq = denReal * denReal + denImag * denImag;

  if (denMagSq < 1e-12) return 0;
  const magSq = numMagSq / denMagSq;
  if (magSq <= 1e-12) return -60;

  return 10 * Math.log10(magSq);
}

/**
 * Generuje serię punktów [x, y] dla wykresu krzywej częstotliwości (logarytmiczna skala X od 20 Hz do 20 kHz).
 */
export function generateFrequencyResponseCurve(
  bands: ParametricBandDto[],
  preampDb: number,
  enabled: boolean = true,
  numPoints: number = 180
): Array<{ freq: number; db: number }> {
  const points: Array<{ freq: number; db: number }> = [];
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);

  const activeBands = enabled ? bands.filter((b) => b.enabled) : [];
  const effectivePreamp = enabled ? preampDb : 0;

  for (let i = 0; i <= numPoints; i++) {
    const logF = minLog + (i / numPoints) * (maxLog - minLog);
    const freq = Math.pow(10, logF);

    let totalDb = effectivePreamp;
    for (const band of activeBands) {
      totalDb += calculateBiquadResponseDb(
        freq,
        band.filter_type,
        band.freq,
        band.gain_db,
        band.q
      );
    }

    points.push({ freq, db: Math.max(-36, Math.min(24, totalDb)) });
  }

  return points;
}

/**
 * Konwertuje częstotliwość (Hz) na znormalizowaną pozycję X (0..1) w skali logarytmicznej 20 Hz - 20 kHz.
 */
export function freqToNormX(freq: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  const logF = Math.log10(Math.max(20, Math.min(20000, freq)));
  return (logF - minLog) / (maxLog - minLog);
}

/**
 * Konwertuje znormalizowaną pozycję X (0..1) na częstotliwość w Hz.
 */
export function normXToFreq(normX: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  const clampedX = Math.max(0, Math.min(1, normX));
  return Math.pow(10, minLog + clampedX * (maxLog - minLog));
}

/**
 * Konwertuje wzmocnienie (dB w zakresie -24..+24) na znormalizowaną pozycję Y (0..1, gdzie 0 to góra +24dB, 1 to dół -24dB).
 */
export function gainToNormY(gainDb: number, minDb: number = -24, maxDb: number = 24): number {
  const clamped = Math.max(minDb, Math.min(maxDb, gainDb));
  return 1 - (clamped - minDb) / (maxDb - minDb);
}

/**
 * Konwertuje pozycję Y (0..1) na wzmocnienie dB.
 */
export function normYToGain(normY: number, minDb: number = -24, maxDb: number = 24): number {
  const clamped = Math.max(0, Math.min(1, normY));
  return minDb + (1 - clamped) * (maxDb - minDb);
}
