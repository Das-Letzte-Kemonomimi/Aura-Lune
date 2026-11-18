import { describe, it, expect } from 'vitest';
import { normalizeStr } from './textNormalize';

describe('textNormalize utility', () => {
  it('handles empty, null, and undefined strings', () => {
    expect(normalizeStr('')).toBe('');
    expect(normalizeStr(null)).toBe('');
    expect(normalizeStr(undefined)).toBe('');
  });

  it('converts uppercase to lowercase', () => {
    expect(normalizeStr('AURA LUNE')).toBe('aura lune');
    expect(normalizeStr('FLAC Audio')).toBe('flac audio');
  });

  it('strips European accents and diacritics', () => {
    expect(normalizeStr('Beyoncé')).toBe('beyonce');
    expect(normalizeStr('Café')).toBe('cafe');
    expect(normalizeStr('München')).toBe('munchen');
    expect(normalizeStr('naïve')).toBe('naive');
  });

  it('handles Polish diacritics correctly for search indexing', () => {
    expect(normalizeStr('Zażółć gęślą jaźń')).toBe('zazolc gesla jazn');
    expect(normalizeStr('Stanisław Moniuszko')).toBe('stanislaw moniuszko');
  });
});
