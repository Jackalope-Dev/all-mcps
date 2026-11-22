import { describe, expect, it } from 'vitest';
import { mergeDiscoveryPool } from './servers';

const NOW = new Date('2026-11-22T12:00:00Z');
const LATER = new Date('2026-12-01T00:00:00Z');
const EARLIER = new Date('2026-11-01T00:00:00Z');

function row(
  id: string,
  o: Partial<{
    isPremium: boolean;
    featuredUntil: Date | null;
    views: number;
    copies: number;
    upvotes: number;
  }> = {},
) {
  return {
    id,
    isPremium: o.isPremium ?? false,
    featuredUntil: o.featuredUntil ?? null,
    views: o.views ?? 0,
    copies: o.copies ?? 0,
    upvotes: o.upvotes ?? 0,
  };
}

describe('mergeDiscoveryPool', () => {
  it('ranks premium, then active featured, then views/copies/upvotes', () => {
    const popular = [
      row('premium', { isPremium: true, views: 1 }),
      row('top', { views: 900 }),
      row('tie-more-copies', { views: 500, copies: 9 }),
      row('tie', { views: 500, copies: 1 }),
      row('expired', { views: 10, featuredUntil: EARLIER }),
    ];
    const featured = [row('boosted', { views: 0, featuredUntil: LATER })];
    expect(
      mergeDiscoveryPool(popular, featured, 10, NOW).map((r) => r.id),
    ).toEqual([
      'premium',
      'boosted',
      'top',
      'tie-more-copies',
      'tie',
      'expired',
    ]);
  });

  it('keeps a low-traffic featured listing inside the cap', () => {
    const popular = [row('a', { views: 3 }), row('b', { views: 2 })];
    const featured = [row('boosted', { featuredUntil: LATER })];
    expect(
      mergeDiscoveryPool(popular, featured, 2, NOW).map((r) => r.id),
    ).toEqual(['boosted', 'a']);
  });

  it('dedupes a listing returned by both reads', () => {
    const both = row('both', { views: 5, featuredUntil: LATER });
    expect(mergeDiscoveryPool([both], [both], 10, NOW)).toHaveLength(1);
  });
});
