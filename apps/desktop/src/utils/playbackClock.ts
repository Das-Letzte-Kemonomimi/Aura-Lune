/**
 * Zegar odtwarzania do płynnego rysowania paska postępu.
 *
 * Backend wysyła pozycję ~10×/s. Bez interpolacji głowica „skacze” co 100 ms. Tu pozycję ekstrapolujemy między
 * tickami (`pozycja + czas_od_ticka × prędkość`) i wygładzamy rozbieżności po nadejściu nowego ticka.
 */
import { smoothTo } from './smoothing';

export interface ClockAnchor {
  /** Ostatnia znana pozycja (ms, czas źródła). */
  positionMs: number;
  /** Moment (`performance.now()`), w którym ta pozycja nadeszła. */
  at: number;
}

export interface ExtrapolateOptions {
  /** Prędkość czasu źródła względem rzeczywistego (1 w Bypass, tempo*rate przy DSP). */
  speed: number;
  playing: boolean;
  durationMs?: number | null;
  /** Koniec pętli A-B (ms): w trakcie pętli nie wychodzimy poza niego; powrót do A to skok z backendu. */
  loopB?: number | null;
  /** Maksymalny czas (ms rzeczywiste) ekstrapolacji bez nowego ticka — zabezpieczenie przed zawieszeniem statusów. */
  maxAheadMs?: number;
}

export const DEFAULT_MAX_AHEAD_MS = 400;
/** Rozbieżność (ms), od której wyświetlana pozycja skacze do celu zamiast się wygładzać (seek, pętla A-B). */
export const SNAP_THRESHOLD_MS = 300;
/** Stała czasowa wygładzania rozbieżności (s). */
export const EASE_TAU_SEC = 0.08;

/** Ekstrapolowana pozycja w chwili `now`. Bez odtwarzania zwraca ostatnią znaną pozycję. */
export function extrapolatePositionMs(anchor: ClockAnchor, now: number, options: ExtrapolateOptions): number {
  const { speed, playing, durationMs, loopB, maxAheadMs = DEFAULT_MAX_AHEAD_MS } = options;
  if (!playing) return anchor.positionMs;

  const elapsed = Math.min(maxAheadMs, Math.max(0, now - anchor.at));
  let pos = anchor.positionMs + elapsed * (Number.isFinite(speed) && speed > 0 ? speed : 1);

  // Nie wychodzimy poza koniec pętli A-B (jeśli odtwarzanie jest przed jej końcem) ani poza koniec utworu
  if (loopB != null && loopB > 0 && anchor.positionMs <= loopB) pos = Math.min(pos, loopB);
  if (durationMs != null && durationMs > 0) pos = Math.min(pos, durationMs);
  return pos;
}

/**
 * Pozycja wyświetlana: wygładza drobne rozbieżności między ekstrapolacją a nowym tickiem, nigdy nie cofa się
 * podczas odtwarzania, a duże zmiany (seek, zapętlenie) przyjmuje natychmiast.
 */
export function easeDisplayPosition(prev: number | null, target: number, dtSec: number, playing: boolean): number {
  if (prev === null) return target;
  const error = target - prev;
  if (Math.abs(error) > SNAP_THRESHOLD_MS) return target;
  // Ekstrapolacja wyprzedziła rzeczywisty tick — czekamy, zamiast cofać głowicę
  if (playing && error < 0) return prev;
  return smoothTo(prev, target, dtSec, EASE_TAU_SEC);
}
