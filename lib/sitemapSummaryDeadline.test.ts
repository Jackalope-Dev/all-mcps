import { describe, expect, it, vi } from 'vitest';

/**
 * A catalog scan that outlives the request's wait (a cold scan after a deploy
 * takes 10-15s) must not hold the sitemap response: the request answers from
 * the last good summary in R2, and the scan carries on via waitUntil.
 */

const stored = {
  categoryLastMs: { '💻 Developer Tools': 1_790_000_000_000 },
  listings: [{ id: 'a-one', lastmod: '2026-11-10T00:00:00Z' }],
  comparePairLastMod: {},
};
// Every D1 call returns a promise that never settles: a scan that hangs.
const never = () => new Promise<never>(() => {});
const stmt: Record<string, unknown> = {};
for (const m of ['all', 'raw', 'run', 'first', 'values']) stmt[m] = never;
stmt.bind = () => stmt;
const hangingDb = { prepare: () => stmt, batch: never };
const bucket = {
  get: vi.fn(async () => ({ text: async () => JSON.stringify(stored) })),
  put: vi.fn(async () => null),
};
const waitUntil = vi.fn();

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: { DB: hangingDb, NEXT_INC_CACHE_R2_BUCKET: bucket },
    ctx: { waitUntil },
  }),
}));
vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T) => fn,
}));

const { getSitemapSummary } = await import('./sitemapHelpers');

describe('getSitemapSummary when the scan is slow', () => {
  it('answers from R2 after the wait and lets the scan finish in the background', async () => {
    vi.useFakeTimers();
    try {
      const first = getSitemapSummary();
      await vi.advanceTimersByTimeAsync(4_000);
      const summary = await first;
      expect(summary.listings).toEqual(stored.listings);
      expect(waitUntil).toHaveBeenCalledTimes(1);

      // A second request while that scan is still running doesn't wait on it
      // or start another: it answers straight away from the same copy.
      const second = await getSitemapSummary();
      expect(second.listings).toEqual(stored.listings);
      expect(waitUntil).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
