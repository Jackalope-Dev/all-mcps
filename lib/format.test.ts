import { describe, expect, it } from 'vitest';
import { formatCheckAge, formatPageDate, formatUtcDateTime } from './format';

const NOW = Date.parse('2026-11-12T20:00:00Z');

describe('formatCheckAge', () => {
  it('rounds to the hour and never claims finer freshness', () => {
    expect(formatCheckAge('2026-11-12T19:30:00Z', NOW)).toBe(
      'under an hour ago',
    );
    expect(formatCheckAge('2026-11-12T15:00:00Z', NOW)).toBe('5h ago');
  });

  it('switches to days, months and years', () => {
    expect(formatCheckAge('2026-11-11T19:00:00Z', NOW)).toBe('1d ago');
    expect(formatCheckAge('2026-09-01T00:00:00Z', NOW)).toBe('2mo ago');
    expect(formatCheckAge('2024-11-01T00:00:00Z', NOW)).toBe('2y ago');
  });

  it('returns null for missing, invalid or future dates', () => {
    expect(formatCheckAge(null, NOW)).toBeNull();
    expect(formatCheckAge('not a date', NOW)).toBeNull();
    expect(formatCheckAge('2026-11-13T00:00:00Z', NOW)).toBeNull();
  });
});

describe('formatUtcDateTime', () => {
  it('formats in UTC with a 24-hour clock and a zone label', () => {
    expect(formatUtcDateTime('2026-11-11T19:00:31Z')).toBe(
      'Nov 11, 2026, 19:00 UTC',
    );
    expect(formatUtcDateTime(new Date('2026-01-02T03:04:00Z'))).toBe(
      'Jan 2, 2026, 03:04 UTC',
    );
  });

  it('returns null for missing or invalid dates', () => {
    expect(formatUtcDateTime(undefined)).toBeNull();
    expect(formatUtcDateTime('nope')).toBeNull();
  });
});

describe('formatPageDate', () => {
  it('formats a YYYY-MM-DD page date without shifting the day', () => {
    expect(formatPageDate('2026-10-14')).toBe('Oct 14, 2026');
    expect(formatPageDate('2026-01-01')).toBe('Jan 1, 2026');
  });
});
