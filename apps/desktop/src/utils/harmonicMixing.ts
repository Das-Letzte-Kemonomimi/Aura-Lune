/**
 * Moduł miksowania harmonicznego (Camelot Wheel & BPM Matching) dla Auralune.
 * 
 * Zasady koła Camelot (Mixed In Key):
 * - 12 pozycji (1 - 12), każda z dwoma trybami: 'A' (moll / minor) i 'B' (dur / major).
 * - Idealny miks: ten sam kod (np. 8A -> 8A, 100%).
 * - Zmiana nastroju (Relative Major/Minor): ta sama liczba, przeciwna litera (np. 8A <-> 8B, 95%).
 * - Zmiana energii (Adjacent / Steps): ±1 na kole Camelota (np. 8A -> 7A lub 9A, 90%).
 * - Przekątna (Diagonal): ±1 i przeciwna litera (np. 8A -> 7B lub 9B, 85%).
 * - Energy Boost (+1 semiton): +7 godzin na kole Camelota (np. 8A -> 3A, 80%).
 * 
 * Zgodność tempa (BPM):
 * - Zgodność bezpośrednia: różnica <= 3% (100%), <= 6% (85%), <= 10% (60%), <= 15% (30%).
 * - Zgodność half-time / double-time: np. 70 BPM do 140 BPM, lub 175 BPM (DnB) do 87.5 BPM (Halftime).
 */

export interface CamelotKey {
  number: number; // 1 - 12
  letter: 'A' | 'B';
  raw: string; // np. "8A"
  keyName: string; // np. "A min" lub "C Maj"
}

export interface HarmonicMatchResult {
  score: number; // 0 - 100
  keyScore: number; // 0 - 100
  bpmScore: number; // 0 - 100
  matchType:
    | 'perfect' // Ten sam klucz (100%)
    | 'relative' // Molowy <-> durowy odpowiednik (95%)
    | 'adjacent' // Krok energii ±1 (90%)
    | 'diagonal' // Krok przekątny ±1 (85%)
    | 'energy_boost' // Podbicie energii +1 semiton / +7 (80%)
    | 'half_double' // Dopasowanie połowiczne/podwójne BPM
    | 'compatible' // Akceptowalny miks
    | 'dissonant'; // Ryzyko dysonansu
  badgeLabel: string;
  badgeColor: string;
  bpmDiffPercent: number;
  bpmRelation: 'direct' | 'half' | 'double';
  suggestedCrossfadeMs: number;
}

// Mapowanie tonacji muzycznych na kod Camelot
export const CAMELOT_KEY_MAP: Record<string, CamelotKey> = {
  // Minor (A)
  'G#m': { number: 1, letter: 'A', raw: '1A', keyName: 'G# min' },
  'Abm': { number: 1, letter: 'A', raw: '1A', keyName: 'Ab min' },
  'D#m': { number: 2, letter: 'A', raw: '2A', keyName: 'D# min' },
  'Ebm': { number: 2, letter: 'A', raw: '2A', keyName: 'Eb min' },
  'A#m': { number: 3, letter: 'A', raw: '3A', keyName: 'A# min' },
  'Bbm': { number: 3, letter: 'A', raw: '3A', keyName: 'Bb min' },
  'Fm': { number: 4, letter: 'A', raw: '4A', keyName: 'F min' },
  'Cm': { number: 5, letter: 'A', raw: '5A', keyName: 'C min' },
  'Gm': { number: 6, letter: 'A', raw: '6A', keyName: 'G min' },
  'Dm': { number: 7, letter: 'A', raw: '7A', keyName: 'D min' },
  'Am': { number: 8, letter: 'A', raw: '8A', keyName: 'A min' },
  'Em': { number: 9, letter: 'A', raw: '9A', keyName: 'E min' },
  'Bm': { number: 10, letter: 'A', raw: '10A', keyName: 'B min' },
  'F#m': { number: 11, letter: 'A', raw: '11A', keyName: 'F# min' },
  'Gbm': { number: 11, letter: 'A', raw: '11A', keyName: 'Gb min' },
  'C#m': { number: 12, letter: 'A', raw: '12A', keyName: 'C# min' },
  'Dbm': { number: 12, letter: 'A', raw: '12A', keyName: 'Db min' },

  // Major (B)
  'B': { number: 1, letter: 'B', raw: '1B', keyName: 'B Maj' },
  'F#': { number: 2, letter: 'B', raw: '2B', keyName: 'F# Maj' },
  'Gb': { number: 2, letter: 'B', raw: '2B', keyName: 'Gb Maj' },
  'C#': { number: 3, letter: 'B', raw: '3B', keyName: 'C# Maj' },
  'Db': { number: 3, letter: 'B', raw: '3B', keyName: 'Db Maj' },
  'G#': { number: 4, letter: 'B', raw: '4B', keyName: 'G# Maj' },
  'Ab': { number: 4, letter: 'B', raw: '4B', keyName: 'Ab Maj' },
  'D#': { number: 5, letter: 'B', raw: '5B', keyName: 'D# Maj' },
  'Eb': { number: 5, letter: 'B', raw: '5B', keyName: 'Eb Maj' },
  'A#': { number: 6, letter: 'B', raw: '6B', keyName: 'A# Maj' },
  'Bb': { number: 6, letter: 'B', raw: '6B', keyName: 'Bb Maj' },
  'F': { number: 7, letter: 'B', raw: '7B', keyName: 'F Maj' },
  'C': { number: 8, letter: 'B', raw: '8B', keyName: 'C Maj' },
  'G': { number: 9, letter: 'B', raw: '9B', keyName: 'G Maj' },
  'D': { number: 10, letter: 'B', raw: '10B', keyName: 'D Maj' },
  'A': { number: 11, letter: 'B', raw: '11B', keyName: 'A Maj' },
  'E': { number: 12, letter: 'B', raw: '12B', keyName: 'E Maj' },
};

/**
 * Parsuje kod Camelot (np. "8A", "11B") lub standardową notację (np. "Am", "C Maj")
 */
export function parseCamelotKey(raw?: string | null): CamelotKey | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // Sprawdź kod Camelot (np. 8A, 12B)
  const match = s.match(/^(\d{1,2})\s*([ABab])$/);
  if (match) {
    const num = parseInt(match[1], 10);
    const letter = match[2].toUpperCase() as 'A' | 'B';
    if (num >= 1 && num <= 12) {
      // Odtwórz nazwę klucza
      for (const val of Object.values(CAMELOT_KEY_MAP)) {
        if (val.number === num && val.letter === letter) {
          return { number: num, letter, raw: `${num}${letter}`, keyName: val.keyName };
        }
      }
      return { number: num, letter, raw: `${num}${letter}`, keyName: `${num}${letter}` };
    }
  }

  // Wyszukaj po notacji literowej
  const clean = s.replace(/maj(or)?/i, '').replace(/min(or)?/i, 'm').trim();
  if (CAMELOT_KEY_MAP[clean]) {
    return CAMELOT_KEY_MAP[clean];
  }
  if (CAMELOT_KEY_MAP[s]) {
    return CAMELOT_KEY_MAP[s];
  }

  return null;
}

/**
 * Oblicza najkrótszy dystans na 12-godzinnym kole zegarowym Camelot (0 - 6)
 */
export function getCamelotDistance(num1: number, num2: number): number {
  const diff = Math.abs(num1 - num2);
  return Math.min(diff, 12 - diff);
}

/**
 * Oblicza harmoniczne dopasowanie tonacji na kole Camelota (0 - 100%)
 */
export function calculateKeyHarmonicScore(
  k1: CamelotKey,
  k2: CamelotKey
): { score: number; type: HarmonicMatchResult['matchType']; label: string } {
  // Ten sam klucz (np. 8A -> 8A)
  if (k1.number === k2.number && k1.letter === k2.letter) {
    return { score: 100, type: 'perfect', label: 'Idealna tonacja' };
  }

  // Odpowiednik molowy <-> durowy (np. 8A <-> 8B)
  if (k1.number === k2.number && k1.letter !== k2.letter) {
    return { score: 95, type: 'relative', label: 'Zmiana nastroju (Dur/Mol)' };
  }

  const dist = getCamelotDistance(k1.number, k2.number);

  // Krok energii ±1 na kole Camelota (np. 8A -> 7A lub 9A)
  if (dist === 1 && k1.letter === k2.letter) {
    const isStepUp = (k1.number % 12) + 1 === k2.number || (k1.number === 12 && k2.number === 1);
    return {
      score: 90,
      type: 'adjacent',
      label: isStepUp ? 'Wzrost energii (+1)' : 'Spadek energii (-1)',
    };
  }

  // Przekątna: ±1 i zmiana litery (np. 8A -> 7B lub 9B)
  if (dist === 1 && k1.letter !== k2.letter) {
    return { score: 85, type: 'diagonal', label: 'Płynna modulacja (Przekątna)' };
  }

  // Podbicie energii +1 semiton (+7 godzin na Camelocie, np. 8A -> 3A)
  if (dist === 5 || dist === 7) {
    return { score: 80, type: 'energy_boost', label: 'Modulacja semitonowa (+1)' };
  }

  if (dist === 2 && k1.letter === k2.letter) {
    return { score: 65, type: 'compatible', label: 'Krok 2 tonów' };
  }

  return { score: Math.max(10, 50 - dist * 8), type: 'dissonant', label: 'Kontrastujący klucz' };
}

/**
 * Oblicza zgodność tempa (BPM) z uwzględnieniem tolerancji ±6% oraz relacji half-time / double-time
 */
export function calculateBpmMatchScore(
  bpm1: number,
  bpm2: number
): { score: number; diffPercent: number; relation: 'direct' | 'half' | 'double' } {
  if (bpm1 <= 0 || bpm2 <= 0) {
    return { score: 50, diffPercent: 0, relation: 'direct' };
  }

  const directDiff = Math.abs(bpm1 - bpm2) / bpm1;
  const halfDiff = Math.abs(bpm1 - bpm2 * 2) / bpm1;
  const doubleDiff = Math.abs(bpm1 - bpm2 / 2) / bpm1;

  let bestDiff = directDiff;
  let relation: 'direct' | 'half' | 'double' = 'direct';

  if (halfDiff < bestDiff) {
    bestDiff = halfDiff;
    relation = 'half';
  }
  if (doubleDiff < bestDiff) {
    bestDiff = doubleDiff;
    relation = 'double';
  }

  const diffPercent = Math.round(bestDiff * 1000) / 10; // np. 2.4%

  // Punktacja:
  // <= 1% = 100
  // <= 3% = 95
  // <= 6% = 85 (standardowy limit DJ pitch fader bez deformacji)
  // <= 10% = 65
  // <= 15% = 40
  // > 15% = 15
  let score: number;
  if (bestDiff <= 0.01) {
    score = 100;
  } else if (bestDiff <= 0.03) {
    score = 95 - ((bestDiff - 0.01) / 0.02) * 10;
  } else if (bestDiff <= 0.06) {
    score = 85 - ((bestDiff - 0.03) / 0.03) * 20;
  } else if (bestDiff <= 0.1) {
    score = 65 - ((bestDiff - 0.06) / 0.04) * 25;
  } else if (bestDiff <= 0.15) {
    score = 40 - ((bestDiff - 0.1) / 0.05) * 25;
  } else {
    score = Math.max(0, 15 - (bestDiff - 0.15) * 50);
  }

  return { score: Math.round(score), diffPercent, relation };
}

/**
 * Oblicza czas crossfade w milisekundach zsynchronizowany do tempa utworu (w takt/beaty)
 */
export function calculateBeatMatchedCrossfadeMs(
  bpm: number,
  beats: number = 8 // domyślnie 8 beatów = 2 takty w 4/4
): number {
  if (bpm <= 40 || bpm > 260) {
    return 3000;
  }
  const beatDurationSec = 60 / bpm;
  const targetMs = Math.round(beatDurationSec * beats * 1000);
  // Ogranicz do bezpiecznego zakresu [1000ms, 8000ms]
  return Math.min(8000, Math.max(1000, targetMs));
}

/**
 * Główna funkcja porównująca dwa utwory pod kątem miksowania harmonicznego
 */
export function evaluateHarmonicMatch(
  currentKeyStr?: string | null,
  currentBpm?: number | null,
  candidateKeyStr?: string | null,
  candidateBpm?: number | null
): HarmonicMatchResult {
  const currentKey = parseCamelotKey(currentKeyStr);
  const candidateKey = parseCamelotKey(candidateKeyStr);

  const cBpm = currentBpm && currentBpm > 0 ? currentBpm : 128;
  const candBpm = candidateBpm && candidateBpm > 0 ? candidateBpm : 128;

  let keyScore = 50;
  let matchType: HarmonicMatchResult['matchType'] = 'compatible';
  let badgeLabel = 'Dopasowanie harmoniczne';
  let badgeColor = '#60a5fa'; // Blue

  if (currentKey && candidateKey) {
    const keyEval = calculateKeyHarmonicScore(currentKey, candidateKey);
    keyScore = keyEval.score;
    matchType = keyEval.type;
    badgeLabel = keyEval.label;

    if (matchType === 'perfect') {
      badgeColor = '#10b981'; // Emerald green
    } else if (matchType === 'relative') {
      badgeColor = '#8b5cf6'; // Purple
    } else if (matchType === 'adjacent') {
      badgeColor = '#06b6d4'; // Cyan
    } else if (matchType === 'diagonal') {
      badgeColor = '#3b82f6'; // Blue
    } else if (matchType === 'energy_boost') {
      badgeColor = '#f59e0b'; // Amber
    } else if (matchType === 'dissonant') {
      badgeColor = '#ef4444'; // Red
    }
  }

  const bpmEval = calculateBpmMatchScore(cBpm, candBpm);
  let bpmScore = bpmEval.score;

  if (bpmEval.relation !== 'direct') {
    if (matchType === 'perfect' || matchType === 'adjacent') {
      matchType = 'half_double';
      badgeLabel = `${badgeLabel} (${bpmEval.relation === 'half' ? 'Half-Time' : 'Double-Time'})`;
    }
  }

  // Ważona punktacja końcowa: 60% klucz, 40% tempo
  const finalScore = Math.round(keyScore * 0.6 + bpmScore * 0.4);
  const suggestedCrossfadeMs = calculateBeatMatchedCrossfadeMs(cBpm, 8);

  return {
    score: finalScore,
    keyScore,
    bpmScore,
    matchType,
    badgeLabel,
    badgeColor,
    bpmDiffPercent: bpmEval.diffPercent,
    bpmRelation: bpmEval.relation,
    suggestedCrossfadeMs,
  };
}
