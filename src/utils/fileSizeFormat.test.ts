import { describe, it, expect } from 'vitest';
import { formatBytes } from './fileSizeFormat';

describe('fileSizeFormat utility', () => {
  it('handles zero, negative, null, undefined, and NaN values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1024)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('formats bytes below 1 KB', () => {
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 500)).toBe('500 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 4.25)).toBe('4.3 MB');
    expect(formatBytes(1024 * 1024 * 50)).toBe('50 MB');
  });

  it('formats gigabytes and terabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });
});
