import { describe, expect, it } from 'vitest';
import { buildLetterIndex, letterFor } from './alphaIndexModel';

describe('letterFor', () => {
  it('uppercases and strips diacritics', () => {
    expect(letterFor('abba')).toBe('A');
    expect(letterFor('Étoile')).toBe('E');
    expect(letterFor('Östen')).toBe('O');
    expect(letterFor('Łąka')).toBe('L');
  });

  it('puts digits, symbols, empty values and non-Latin scripts under #', () => {
    expect(letterFor('2Pac')).toBe('#');
    expect(letterFor('(Intro)')).toBe('#');
    expect(letterFor('  ')).toBe('#');
    expect(letterFor(null)).toBe('#');
    expect(letterFor('千本桜')).toBe('#');
  });

  it('ignores leading whitespace', () => {
    expect(letterFor('  zebra')).toBe('Z');
  });
});

describe('buildLetterIndex', () => {
  it('records the first index of each letter in list order', () => {
    const titles = ['1999', 'Alpha', 'Apple', 'Beta', 'Ćma', 'Cat'];
    const index = buildLetterIndex(titles, (t) => t);
    expect(index.get('#')).toBe(0);
    expect(index.get('A')).toBe(1);
    expect(index.get('B')).toBe(3);
    expect(index.get('C')).toBe(4);
    expect(index.has('D')).toBe(false);
  });

  it('follows a descending list as given', () => {
    const index = buildLetterIndex(['Zed', 'Yak', 'Yes', 'Abc'], (t) => t);
    expect(index.get('Z')).toBe(0);
    expect(index.get('Y')).toBe(1);
    expect(index.get('A')).toBe(3);
  });
});
