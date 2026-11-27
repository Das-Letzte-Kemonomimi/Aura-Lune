import { describe, it, expect } from 'vitest';
import { coverUrlWithSize } from './mediaUrl';

describe('coverUrlWithSize', () => {
  it('rewrites size query param on auralune-media cover URLs', () => {
    expect(
      coverUrlWithSize('auralune-media://localhost/cover/album/42?s=256&v=abc123', 768),
    ).toBe('auralune-media://localhost/cover/album/42?s=768&v=abc123');

    expect(
      coverUrlWithSize('auralune-media://localhost/cover/track/9?s=768&v=xyz', 256),
    ).toBe('auralune-media://localhost/cover/track/9?s=256&v=xyz');
  });

  it('passes external, data, and nullish values through unchanged', () => {
    expect(coverUrlWithSize(null, 768)).toBeNull();
    expect(coverUrlWithSize(undefined, 768)).toBeNull();
    expect(coverUrlWithSize('https://coverartarchive.org/release/1/front-500', 768)).toBe(
      'https://coverartarchive.org/release/1/front-500',
    );
    expect(coverUrlWithSize('data:image/png;base64,AAA', 768)).toBe(
      'data:image/png;base64,AAA',
    );
  });
});
