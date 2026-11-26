// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { shouldCommitStatus, COARSE_POSITION_STEP_MS } from './statusCommit';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';
import type { PlaybackStatus } from '../types/playback';

const base: PlaybackStatus = {
  ...(DEFAULT_PLAYBACK_STATUS as PlaybackStatus),
  state: 'Playing',
  position_ms: 10_000,
  spectrum: [0.1, 0.2],
};

describe('shouldCommitStatus', () => {
  it('skips frames where only live fields moved a little', () => {
    expect(shouldCommitStatus(base, { ...base, position_ms: 10_100, spectrum: [0.5, 0.9] })).toBe(false);
  });

  it('commits once position advanced by the coarse step', () => {
    expect(shouldCommitStatus(base, { ...base, position_ms: 10_000 + COARSE_POSITION_STEP_MS })).toBe(true);
  });

  it('commits when position jumps backwards (seek / loop)', () => {
    expect(shouldCommitStatus(base, { ...base, position_ms: 9_950 })).toBe(true);
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
