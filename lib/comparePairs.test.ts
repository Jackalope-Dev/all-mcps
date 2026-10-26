import { describe, expect, it } from 'vitest';
import { INDEXABLE_COMPARE_PAIRS, isCuratedPair } from './comparePairs';

describe('isCuratedPair', () => {
  const [pair] = INDEXABLE_COMPARE_PAIRS;

  it('matches a curated pair in either order', () => {
    expect(isCuratedPair(pair.a, pair.b)).toBe(true);
    expect(isCuratedPair(pair.b, pair.a)).toBe(true);
  });

  it('rejects any other pair', () => {
    expect(isCuratedPair(pair.a, 'acme-not-curated')).toBe(false);
  });
});
