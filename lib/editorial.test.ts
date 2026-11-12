import { describe, expect, it } from 'vitest';
import { bestTopicBySlug } from './bestTopics';
import {
  formatReviewedAt,
  HUB_EDITORIAL,
  hubEditorial,
  LISTING_VERDICTS,
  listingVerdict,
} from './editorial';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('HUB_EDITORIAL', () => {
  it('only covers real /best topics', () => {
    for (const slug of Object.keys(HUB_EDITORIAL)) {
      expect(bestTopicBySlug(slug), slug).toBeDefined();
    }
  });

  it('gives every hub 3-5 distinct picks, each with a verdict', () => {
    for (const [slug, hub] of Object.entries(HUB_EDITORIAL)) {
      expect(hub.picks.length, slug).toBeGreaterThanOrEqual(3);
      expect(hub.picks.length, slug).toBeLessThanOrEqual(5);
      const ids = hub.picks.map((p) => p.serverId);
      expect(new Set(ids).size, slug).toBe(ids.length);
      for (const pick of hub.picks) {
        expect(LISTING_VERDICTS[pick.serverId], pick.serverId).toBeDefined();
        expect(pick.label.trim(), pick.serverId).not.toBe('');
        expect(pick.name.trim(), pick.serverId).not.toBe('');
      }
      expect(hub.reviewedAt, slug).toMatch(DATE);
    }
  });
});

describe('LISTING_VERDICTS', () => {
  const entries = Object.entries(LISTING_VERDICTS);

  it('has a valid review date and a substantive verdict for every entry', () => {
    for (const [id, v] of entries) {
      expect(v.reviewedAt, id).toMatch(DATE);
      expect(Number.isNaN(Date.parse(v.reviewedAt)), id).toBe(false);
      expect(v.verdict.length, id).toBeGreaterThan(150);
      expect(v.verdict.length, id).toBeLessThan(800);
    }
  });

  it('avoids superlatives with no number behind them', () => {
    for (const [id, v] of entries) {
      expect(v.verdict, id).not.toMatch(
        /\b(the best|most popular|number one|#1|world-class)\b/i,
      );
    }
  });
});

describe('lookups', () => {
  it('returns entries by id and slug, undefined otherwise', () => {
    expect(listingVerdict('dbhub')?.verdict).toContain('DBHub');
    expect(listingVerdict('no-such-listing')).toBeUndefined();
    expect(hubEditorial('postgres')?.picks[0].serverId).toBe('dbhub');
    expect(hubEditorial('no-such-hub')).toBeUndefined();
  });

  it('formats review dates in UTC', () => {
    expect(formatReviewedAt('2026-11-11')).toBe('November 11, 2026');
  });
});
