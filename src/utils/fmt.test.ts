import { describe, expect, it } from 'vitest';
import { fmt } from './fmt';

describe('fmt', () => {
  it('fills positional placeholders in any order', () => {
    expect(fmt('{1} z {0}', 'A', 'B')).toBe('B z A');
  });
  it('accepts numbers and replaces every occurrence', () => {
    expect(fmt('{0}/{1} · {0}', 3, 10)).toBe('3/10 · 3');
  });
  it('leaves placeholders without arguments untouched', () => {
    expect(fmt('{0} {2}', 'x')).toBe('x {2}');
  });
  it('treats $ in arguments literally', () => {
    expect(fmt('Price: {0}', '$& $1')).toBe('Price: $& $1');
  });
});
