import { describe, it, expect } from 'vitest';
import { isMainTab } from './navigation';

describe('isMainTab', () => {
  it('accepts routed views and rejects settings redirects', () => {
    expect(isMainTab('player')).toBe(true);
    expect(isMainTab('stem-projects')).toBe(true);
    expect(isMainTab('devices')).toBe(false);
    expect(isMainTab('unknown')).toBe(false);
  });
});
