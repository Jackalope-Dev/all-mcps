import { describe, expect, it } from 'vitest';
import {
  IMPRESSION_DOUBLE_FIRE_MS,
  IMPRESSION_HOURLY_CAP_PER_VISITOR,
  isBillableImpression,
  pickAdForSlot,
  validateAdPayload,
} from './ads';

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

describe('isBillableImpression', () => {
  const now = 1_000_000_000;

  it('bills a first view', () => {
    expect(isBillableImpression({ count: 0, lastAt: null }, now)).toBe(true);
  });

  it('bills repeat views by the same visitor as separate impressions', () => {
    expect(
      isBillableImpression({ count: 4, lastAt: now - 60 * 1000 }, now),
    ).toBe(true);
  });

  it('drops a double-fire of the same render', () => {
    expect(
      isBillableImpression(
        { count: 1, lastAt: now - IMPRESSION_DOUBLE_FIRE_MS + 1 },
        now,
      ),
    ).toBe(false);
  });

  it('stops billing one visitor past the hourly cap', () => {
    expect(
      isBillableImpression(
        { count: IMPRESSION_HOURLY_CAP_PER_VISITOR, lastAt: now - 60 * 1000 },
        now,
      ),
    ).toBe(false);
  });
});

describe('validateAdPayload', () => {
  const payload = {
    title: 'Brainscanner',
    description: 'Scan brains over MCP',
    targetUrl: 'https://brainscanner.dev/',
    logoUrl: '/api/ads/logo/ad_1',
    advertiserEmail: 'ads@brainscanner.dev',
    impressions: 1000,
    bidCpm: 500,
  };

  it('accepts a real campaign', () => {
    expect(validateAdPayload(payload)).toEqual({ valid: true });
  });

  it.each([
    { advertiserEmail: 'a@example.com' },
    { targetUrl: 'https://example.com/landing' },
    { logoUrl: 'https://example.com/l.png' },
  ])('refuses the Nov 2026 probe campaign field %o', (over) => {
    expect(validateAdPayload({ ...payload, ...over }).valid).toBe(false);
  });
});
