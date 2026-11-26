// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isMainTab, isNowPlayingVisualMode } from './navigation';

describe('isMainTab', () => {
  it('accepts routed views and rejects settings redirects', () => {
    expect(isMainTab('player')).toBe(true);
    expect(isMainTab('stem-projects')).toBe(true);
    expect(isMainTab('devices')).toBe(false);
    expect(isMainTab('unknown')).toBe(false);
  });
});

describe('isNowPlayingVisualMode', () => {
  it('accepts the four modes and rejects anything else from a saved session', () => {
    expect(isNowPlayingVisualMode('turntable')).toBe(true);
    expect(isNowPlayingVisualMode('vumeter')).toBe(true);
    expect(isNowPlayingVisualMode('vinyl')).toBe(false);
    expect(isNowPlayingVisualMode(3)).toBe(false);
    expect(isNowPlayingVisualMode(undefined)).toBe(false);
  });
});
