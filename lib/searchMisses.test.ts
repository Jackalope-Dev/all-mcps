import { describe, expect, it } from 'vitest';
import { normalizeMissQuery } from './searchMisses';

describe('normalizeMissQuery', () => {
  it('normalizes case and spacing', () => {
    expect(normalizeMissQuery('  Postgres   Vector  ')).toBe('postgres vector');
  });

  it('drops queries too short, too long or without letters', () => {
    expect(normalizeMissQuery('ab')).toBeNull();
    expect(normalizeMissQuery('x'.repeat(121))).toBeNull();
    expect(normalizeMissQuery('1234 !!')).toBeNull();
  });
});
