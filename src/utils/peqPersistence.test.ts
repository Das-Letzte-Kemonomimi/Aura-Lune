import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParametricEqStateDto } from './parametricEqMath';

const setSetting = vi.fn<(key: string, value: string) => Promise<void>>();
vi.mock('../api/settings', () => ({
  setSetting: (key: string, value: string) => setSetting(key, value),
}));

import { createPeqSaver, PEQ_SAVE_DEBOUNCE_MS, savePeqState } from './peqPersistence';

const state = (enabled: boolean, preamp_db = 0): ParametricEqStateDto => ({
  enabled,
  preamp_db,
  bands: [{ id: 'b1', filter_type: 'peak', freq: 1000, gain_db: 3, q: 1.4, enabled: true }],
});

describe('peqPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSetting.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('writes the state as JSON that round-trips, keeping the enabled flag', async () => {
    await savePeqState(state(true, -2));
    const [key, value] = setSetting.mock.calls[0];
    expect(key).toBe('parametric_eq_state');
    expect(JSON.parse(value)).toEqual(state(true, -2));
  });

  it('persists a deliberately disabled state too', async () => {
    await savePeqState(state(false));
    expect(JSON.parse(setSetting.mock.calls[0][1]).enabled).toBe(false);
  });

  it('debounces bursts and writes only the last state', () => {
    const saver = createPeqSaver();
    saver.schedule(state(true, -1));
    saver.schedule(state(true, -2));
    saver.schedule(state(true, -3));
    expect(setSetting).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PEQ_SAVE_DEBOUNCE_MS);
    expect(setSetting).toHaveBeenCalledTimes(1);
    expect(JSON.parse(setSetting.mock.calls[0][1]).preamp_db).toBe(-3);
  });

  it('flush writes immediately and nothing is written twice', () => {
    const saver = createPeqSaver();
    saver.schedule(state(true));
    saver.flush();
    vi.advanceTimersByTime(PEQ_SAVE_DEBOUNCE_MS * 2);
    expect(setSetting).toHaveBeenCalledTimes(1);
  });
});
