// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { shouldCommitStatus } from './statusCommit';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';
import type { PlaybackStatus } from '../types/playback';

const base: PlaybackStatus = {
  ...(DEFAULT_PLAYBACK_STATUS as PlaybackStatus),
  state: 'Playing',
  position_ms: 10_000,
  spectrum: [0.1, 0.2],
};

describe('shouldCommitStatus', () => {
  it('skips frames where only live position or spectrum changed (even across whole seconds or loops)', () => {
    expect(shouldCommitStatus(base, { ...base, position_ms: 10_100, spectrum: [0.5, 0.9] })).toBe(false);
    expect(shouldCommitStatus(base, { ...base, position_ms: 25_000, spectrum: [0.2, 0.4] })).toBe(false);
    expect(shouldCommitStatus(base, { ...base, position_ms: 0 })).toBe(false);
  });

  it('commits on any structural change', () => {
    expect(shouldCommitStatus(base, { ...base, state: 'Paused' })).toBe(true);
    expect(shouldCommitStatus(base, { ...base, volume: 0.42 })).toBe(true);
    expect(
      shouldCommitStatus(base, {
        ...base,
        equalizer_bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      } as PlaybackStatus)
    ).toBe(true);
  });

  it('treats structurally equal objects as unchanged', () => {
    const copy = JSON.parse(JSON.stringify(base)) as PlaybackStatus;
    expect(shouldCommitStatus(base, copy)).toBe(false);
  });
});
