import { describe, expect, it } from 'vitest';
import { pickAdForSlot } from './ads';

const ad = (id: string, served = 0, purchased = 1000) => ({
  id,
  bidCpm: 500,
  impressionsServed: served,
  totalImpressionsPurchased: purchased,
});

describe('pickAdForSlot', () => {
  it('returns null only when no ad has impressions left', () => {
    expect(pickAdForSlot([])).toBeNull();
    expect(pickAdForSlot([ad('a', 1000)])).toBeNull();
  });

  it('prefers an ad that is not already on the page', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickAdForSlot([ad('a'), ad('b')], ['a'])?.id).toBe('b');
    }
  });

  it('repeats an ad instead of yielding the slot to the house card', () => {
    expect(pickAdForSlot([ad('a')], ['a'])?.id).toBe('a');
  });

  it('skips a fresh ad that is out of impressions', () => {
    expect(pickAdForSlot([ad('a'), ad('b', 1000)], ['a'])?.id).toBe('a');
  });
});
