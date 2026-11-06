import { describe, expect, it } from 'vitest';
import { listingIdHash, pickRotatingLinks } from './listingLinks';

const pool = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}` }));

describe('listingIdHash', () => {
  it('is stable and non-negative', () => {
    expect(listingIdHash('github-github-mcp-server')).toBe(
      listingIdHash('github-github-mcp-server'),
    );
    for (const id of ['a', 'zzzzzzzzzzzzzzzzzzzzzzzz', '']) {
      expect(listingIdHash(id)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('pickRotatingLinks', () => {
  it('returns `count` distinct entries, the same ones on every render', () => {
    const a = pickRotatingLinks(pool, 'some-listing', 5);
    expect(a).toHaveLength(5);
    expect(new Set(a.map((p) => p.id)).size).toBe(5);
    expect(pickRotatingLinks(pool, 'some-listing', 5)).toEqual(a);
  });

  it('never links the listing itself or anything excluded', () => {
    const self = pool[3].id;
    for (let i = 0; i < 50; i++) {
      const picked = pickRotatingLinks(pool, i === 0 ? self : `x${i}`, 5, [
        'n0',
        'n1',
      ]);
      const got = picked.map((p) => p.id);
      expect(got).not.toContain('n0');
      expect(got).not.toContain('n1');
      if (i === 0) expect(got).not.toContain(self);
    }
  });

  it('spreads picks across the pool for different listings', () => {
    const covered = new Set<string>();
    for (let i = 0; i < 200; i++) {
      for (const p of pickRotatingLinks(pool, `listing-${i}`, 5)) {
        covered.add(p.id);
      }
    }
    expect(covered.size).toBe(pool.length);
  });

  it('returns everything eligible when the pool is small', () => {
    expect(pickRotatingLinks(pool.slice(0, 3), 'n1', 5)).toEqual([
      { id: 'n0' },
      { id: 'n2' },
    ]);
    expect(pickRotatingLinks([], 'n1', 5)).toEqual([]);
  });
});
