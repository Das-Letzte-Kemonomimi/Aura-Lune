// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isMainTab, isNowPlayingVisualMode, isSettingsRedirectTab, normalizeSettingsTab } from './navigation';

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

describe('normalizeSettingsTab', () => {
  it.each([
    ['themes', 'appearance'],
    ['devices', 'audio'],
    ['transcode', 'export'],
    ['backup', 'data'],
    ['updates', 'updates'],
    ['about', 'about'],
    ['playback', 'playback'],
    ['integrations', 'integrations'],
    ['nonsense', 'general'],
    [undefined, 'general'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeSettingsTab(input)).toBe(expected);
  });
});

describe('isSettingsRedirectTab', () => {
  it('accepts the legacy settings ids and the playback shortcut only', () => {
    expect(isSettingsRedirectTab('devices')).toBe(true);
    expect(isSettingsRedirectTab('playback')).toBe(true);
    expect(isSettingsRedirectTab('player')).toBe(false);
  });
});
