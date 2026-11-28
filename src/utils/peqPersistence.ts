/**
 * Persists the parametric EQ state (the `parametric_eq_state` setting) so the PEQ keeps the
 * on/off state and bands the user left it in. The host restores it at start-up; with no saved
 * value (fresh profile) the PEQ stays off.
 */
import { setSetting } from '../api/settings';
import type { ParametricEqStateDto } from './parametricEqMath';

export const PEQ_SAVE_DEBOUNCE_MS = 400;

export function savePeqState(state: ParametricEqStateDto): Promise<void> {
  return setSetting('parametric_eq_state', JSON.stringify(state));
}

/** Debounced saver: dragging a band fires many updates, only the last one is written. */
export function createPeqSaver(delayMs: number = PEQ_SAVE_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: ParametricEqStateDto | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const next = pending;
    pending = null;
    if (!next) return;
    savePeqState(next).catch((e: unknown) => console.warn('Failed to persist the PEQ state:', e));
  };

  return {
    schedule(state: ParametricEqStateDto) {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
