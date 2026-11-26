// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatRelativeTime,
  formatTimeMs,
  formatDuration,
  parseTimeToMs,
} from './timeFormat';

describe('timeFormat utility', () => {
  describe('formatTime', () => {
    it('handles zero, negative, null, undefined, and NaN gracefully', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(-1000)).toBe('0:00');
      expect(formatTime(null)).toBe('0:00');
      expect(formatTime(undefined)).toBe('0:00');
      expect(formatTime(NaN)).toBe('0:00');
    });

    it('formats normal seconds and minutes with zero-padding', () => {
      expect(formatTime(5000)).toBe('0:05');
      expect(formatTime(59000)).toBe('0:59');
      expect(formatTime(60000)).toBe('1:00');
      expect(formatTime(65000)).toBe('1:05');
      expect(formatTime(3599000)).toBe('59:59');
      expect(formatTime(3600000)).toBe('60:00');
    });
  });

  describe('formatTimeMs', () => {
    it('handles invalid inputs returning 0:00.000', () => {
      expect(formatTimeMs(0)).toBe('0:00.000');
      expect(formatTimeMs(-50)).toBe('0:00.000');
      expect(formatTimeMs(null)).toBe('0:00.000');
      expect(formatTimeMs(undefined)).toBe('0:00.000');
      expect(formatTimeMs(NaN)).toBe('0:00.000');
    });

    it('formats millisecond precision with proper 3-digit padding', () => {
      expect(formatTimeMs(5)).toBe('0:00.005');
      expect(formatTimeMs(50)).toBe('0:00.050');
      expect(formatTimeMs(1234)).toBe('0:01.234');
      expect(formatTimeMs(65432)).toBe('1:05.432');
    });
  });

  describe('formatDuration', () => {
    it('returns placeholder --:-- for invalid or non-positive durations', () => {
      expect(formatDuration(0)).toBe('--:--');
      expect(formatDuration(-10)).toBe('--:--');
      expect(formatDuration(null)).toBe('--:--');
      expect(formatDuration(undefined)).toBe('--:--');
      expect(formatDuration(NaN)).toBe('--:--');
    });

    it('formats tracks under an hour as M:SS', () => {
      expect(formatDuration(5000)).toBe('0:05');
      expect(formatDuration(185000)).toBe('3:05');
      expect(formatDuration(3599000)).toBe('59:59');
    });

    it('formats tracks over an hour as H:MM:SS', () => {
      expect(formatDuration(3600000)).toBe('1:00:00');
      expect(formatDuration(3665000)).toBe('1:01:05');
      expect(formatDuration(7325000)).toBe('2:02:05');
    });
  });

  describe('parseTimeToMs', () => {
    it('returns null for empty or invalid inputs', () => {
      expect(parseTimeToMs('')).toBeNull();
      expect(parseTimeToMs('   ')).toBeNull();
      expect(parseTimeToMs('invalid')).toBeNull();
      expect(parseTimeToMs('1:2:3:4')).toBeNull();
    });

    it('parses explicit millisecond strings', () => {
      expect(parseTimeToMs('860ms')).toBe(860);
      expect(parseTimeToMs('1250 ms')).toBe(1250);
      expect(parseTimeToMs('0ms')).toBe(0);
    });

    it('parses explicit second strings', () => {
      expect(parseTimeToMs('1.5s')).toBe(1500);
      expect(parseTimeToMs('12s')).toBe(12000);
      expect(parseTimeToMs('0.25s')).toBe(250);
    });

    it('handles decimal commas as dots', () => {
      expect(parseTimeToMs('1,5s')).toBe(1500);
      expect(parseTimeToMs('2,5')).toBe(2500);
    });

    it('strips Polish/standard marker prefixes like punkt a: or B:', () => {
      expect(parseTimeToMs('a: 1:30')).toBe(90000);
      expect(parseTimeToMs('punkt b: 2:00')).toBe(120000);
      expect(parseTimeToMs('B: 45s')).toBe(45000);
    });

    it('parses MM:SS and MM:SS.mmm colon formats', () => {
      expect(parseTimeToMs('1:30')).toBe(90000);
      expect(parseTimeToMs('01:30.500')).toBe(90500);
      expect(parseTimeToMs('0:05')).toBe(5000);
    });

    it('parses HH:MM:SS colon format', () => {
      expect(parseTimeToMs('1:00:00')).toBe(3600000);
      expect(parseTimeToMs('01:02:03')).toBe(3723000);
      expect(parseTimeToMs('01:02:03.500')).toBe(3723500);
    });

    it('parses plain integers as milliseconds', () => {
      expect(parseTimeToMs('500')).toBe(500);
      expect(parseTimeToMs('60000')).toBe(60000);
    });
  });
});

describe('formatRelativeTime', () => {
  const labels = {
    never: 'Never',
    justNow: 'Just now',
    minutesAgo: '{0} min ago',
    hoursAgo: '{0} h ago',
    daysAgo: '{0} days ago',
    oneDayAgo: '1 day ago',
  };
  const now = 1_000_000;

  it('includes the count for minutes, hours and days', () => {
    expect(formatRelativeTime(now - 5 * 60, labels, now)).toBe('5 min ago');
    expect(formatRelativeTime(now - 3 * 3600, labels, now)).toBe('3 h ago');
    expect(formatRelativeTime(now - 4 * 86400, labels, now)).toBe('4 days ago');
  });

  it('handles never, just now and singular day', () => {
    expect(formatRelativeTime(null, labels, now)).toBe('Never');
    expect(formatRelativeTime(now - 10, labels, now)).toBe('Just now');
    expect(formatRelativeTime(now - 86400, labels, now)).toBe('1 day ago');
  });
});
