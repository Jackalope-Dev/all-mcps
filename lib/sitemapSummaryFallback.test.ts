import { describe, expect, it, vi } from 'vitest';

/**
 * A fresh isolate whose first catalog scan fails (D1 overloaded) serves the
 * global last good summary from R2, never the bundled sample's near-empty
 * listings shard.
 */

const stored = {
  categoryLastMs: { '💻 Developer Tools': 1_790_000_000_000 },
  listings: [{ id: 'a-one', lastmod: '2026-11-10T00:00:00Z' }],
  comparePairLastMod: {},
};
const failingDb = {
  prepare() {
    throw new Error('D1_ERROR: D1 DB is overloaded.');
  },
};
const bucket = {
  get: vi.fn(async () => ({ text: async () => JSON.stringify(stored) })),
  put: vi.fn(async () => null),
};

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: { DB: failingDb, NEXT_INC_CACHE_R2_BUCKET: bucket },
    ctx: {},
  }),
}));
vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T) => fn,
}));

const { getSitemapSummary } = await import('./sitemapHelpers');

describe('getSitemapSummary when the scan fails', () => {
  it('serves the last good summary from R2, lastmod still a string', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const summary = await getSitemapSummary();
    expect(summary.listings).toEqual(stored.listings);
    expect(typeof summary.listings[0].lastmod).toBe('string');
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
