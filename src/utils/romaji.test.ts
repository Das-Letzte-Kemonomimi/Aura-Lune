import { describe, it, expect } from 'vitest';
import { hasJapaneseCharacters, toRomaji } from './romaji';

describe('romaji - Hepburn Romanization utility', () => {
  it('detects Japanese characters accurately', () => {
    expect(hasJapaneseCharacters('Aura-Lune')).toBe(false);
    expect(hasJapaneseCharacters('きつね')).toBe(true); // Hiragana
    expect(hasJapaneseCharacters('アニメ')).toBe(true); // Katakana
    expect(hasJapaneseCharacters('白狐')).toBe(true); // Kanji
    expect(hasJapaneseCharacters('English & 日本語')).toBe(true);
  });

  it('transliterates basic Hiragana to Romaji', () => {
    expect(toRomaji('きつね')).toBe('kitsune');
    expect(toRomaji('さくら')).toBe('sakura');
    expect(toRomaji('ありがとう')).toBe('arigatou');
  });

  it('transliterates basic Katakana to Romaji', () => {
    expect(toRomaji('アニメ')).toBe('anime');
    expect(toRomaji('プレイヤー')).toBe('pureiyaa');
  });

  it('handles digraphs (Youon) correctly', () => {
    expect(toRomaji('とうきょう')).toBe('toukyou'); // kyo
    expect(toRomaji('にんじゃ')).toBe('ninja');     // ja
  });

  it('handles sokuon (small tsu / doubled consonants)', () => {
    expect(toRomaji('きっぷ')).toBe('kippu'); // doubled p
    expect(toRomaji('まっちゃ')).toBe('matcha'); // tch before ch
  });

  it('preserves Latin characters and spaces', () => {
    expect(toRomaji('Kitsune きつね Player')).toBe('Kitsune kitsune Player');
  });

  it('converts half-width katakana and rare kana', () => {
    expect(toRomaji('ｱｲｳ')).toBe('aiu');
    expect(toRomaji('ｶﾞｸ')).toBe('gaku');
    expect(toRomaji('ヶ月')).toBe('ke月');
    expect(toRomaji('ヴァイオリン')).toBe('vaiorin');
  });
});
