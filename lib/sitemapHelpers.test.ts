import { describe, expect, it } from 'vitest';
import { safeDateISO } from './sitemapHelpers';

describe('safeDateISO', () => {
  it('handles valid ISO date strings (strips ms for clean sitemap timestamp)', () => {
    const iso = '2026-05-10T12:00:00.000Z';
    expect(safeDateISO(iso)).toBe('2026-05-10T12:00:00Z');
  });

  it('handles Date objects', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(safeDateISO(d)).toBe('2026-01-01T00:00:00Z');
  });

  it('returns valid ISO fallback for null or undefined', () => {
    const resultNull = safeDateISO(null);
    expect(typeof resultNull).toBe('string');
    expect(() => new Date(resultNull)).not.toThrow();

    const resultUndefined = safeDateISO(undefined);
    expect(typeof resultUndefined).toBe('string');
    expect(() => new Date(resultUndefined)).not.toThrow();
  });
});
