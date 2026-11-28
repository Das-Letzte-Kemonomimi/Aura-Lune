import { formatTimeMs, parseTimeToMs } from '../../utils/timeFormat';

export interface LoopEditorValidation {
  parsedA: number | null;
  parsedB: number | null;
  /** Field is empty or parses to a time. */
  isAValid: boolean;
  isBValid: boolean;
  /** B is strictly after A (or one of them is unset). */
  isOrderValid: boolean;
  /** Both points lie within the track (when its duration is known). */
  isWithinTrack: boolean;
  /** Length of the loop in ms, only when both points are set and valid. */
  loopDurationMs: number | null;
  /** The loop can be applied, exported or saved. */
  canApply: boolean;
}

/** Text shown in a loop point field: `m:ss.mmm`, empty when the point is unset. */
export function loopPointInputText(ms: number | null): string {
  return ms === null ? '' : formatTimeMs(ms);
}

/** Validates the raw text of the A and B fields against the track length. */
export function validateLoopInputs(inputA: string, inputB: string, durationMs: number | null): LoopEditorValidation {
  const parsedA = parseTimeToMs(inputA);
  const parsedB = parseTimeToMs(inputB);
  const isAValid = inputA.trim() === '' || parsedA !== null;
  const isBValid = inputB.trim() === '' || parsedB !== null;
  const isOrderValid = parsedA === null || parsedB === null || parsedB > parsedA;
  const limit = durationMs !== null && durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY;
  const isWithinTrack = (parsedA === null || parsedA <= limit) && (parsedB === null || parsedB <= limit);
  const valid = isAValid && isBValid && isOrderValid && isWithinTrack;
  return {
    parsedA,
    parsedB,
    isAValid,
    isBValid,
    isOrderValid,
    isWithinTrack,
    loopDurationMs: valid && parsedA !== null && parsedB !== null ? parsedB - parsedA : null,
    canApply: valid,
  };
}
