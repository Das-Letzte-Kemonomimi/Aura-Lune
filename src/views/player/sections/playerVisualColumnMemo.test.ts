import { describe, it, expect } from 'vitest';
import { arePlayerVisualColumnPropsEqual } from './playerVisualColumnMemo';
import { DEFAULT_PLAYBACK_STATUS } from '../../../types/player';
import type { PlayerVisualColumnProps } from './PlayerVisualColumn';

const base = (overrides: Record<string, unknown> = {}) =>
  ({
    status: { ...DEFAULT_PLAYBACK_STATUS, state: 'Playing', position_ms: 12_300, spectrum: [0.1, 0.2] },
    tracks: [],
    loc: {},
    language: 'en',
    handlePlayPause: () => {},
    ...overrides,
  }) as unknown as PlayerVisualColumnProps;

describe('arePlayerVisualColumnPropsEqual', () => {
  it('ignores ~10 Hz position and spectrum churn within the same second', () => {
    const a = base();
    const b = base({ status: { ...a.status, position_ms: 12_900, spectrum: [0.9, 0.8] }, tracks: a.tracks, loc: a.loc, handlePlayPause: a.handlePlayPause });
    expect(arePlayerVisualColumnPropsEqual(a, b)).toBe(true);
  });

  it('re-renders when the whole second changes (tape counter / reel radii)', () => {
    const a = base();
    const b = base({ status: { ...a.status, position_ms: 13_050 }, tracks: a.tracks, loc: a.loc, handlePlayPause: a.handlePlayPause });
    expect(arePlayerVisualColumnPropsEqual(a, b)).toBe(false);
  });

  it('re-renders on playback state, DSP and volume changes', () => {
    const a = base();
    const same = { tracks: a.tracks, loc: a.loc, handlePlayPause: a.handlePlayPause };
    expect(arePlayerVisualColumnPropsEqual(a, base({ ...same, status: { ...a.status, state: 'Paused' } }))).toBe(false);
    expect(arePlayerVisualColumnPropsEqual(a, base({ ...same, status: { ...a.status, tempo_ratio: 1.2 } }))).toBe(false);
    expect(arePlayerVisualColumnPropsEqual(a, base({ ...same, status: { ...a.status, volume: 0.3 } }))).toBe(false);
  });

  it('re-renders when any other prop changes identity', () => {
    const a = base();
    expect(arePlayerVisualColumnPropsEqual(a, base({ status: a.status, tracks: a.tracks, loc: a.loc }))).toBe(false); // nowy handler
    expect(arePlayerVisualColumnPropsEqual(a, base({ status: a.status, tracks: [], loc: a.loc, handlePlayPause: a.handlePlayPause }))).toBe(false);
  });
});
