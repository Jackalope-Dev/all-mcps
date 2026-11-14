import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * The sitemap routes fold the catalog into a small summary while paging it,
 * instead of holding every active listing at once — that whole-catalog read is
 * what pushed /sitemap/core.xml and /sitemap/listings.xml over the Worker
 * memory limit. Runs the real paged query against node:sqlite behind a minimal
 * D1 shim, as catalogLoaders.test.ts does.
 */

const sqlite = new DatabaseSync(':memory:');

/** Set to make every query fail, like a D1 CPU-limit reset. */
const d1 = { failing: false, prepares: 0 };

const d1Shim = {
  prepare(query: string) {
    d1.prepares++;
    if (d1.failing) {
      throw new Error('D1 DB exceeded its CPU time limit and was reset.');
    }
    let params: unknown[] = [];
    const stmt = {
      bind(...p: unknown[]) {
        params = p;
        return stmt;
      },
      async all() {
        return {
          results: sqlite.prepare(query).all(...(params as never[])),
        };
      },
      async raw() {
        return sqlite
          .prepare(query)
          .all(...(params as never[]))
          .map((row) => Object.values(row));
      },
    };
    return stmt;
  },
};

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: d1Shim }, ctx: {} }),
}));
vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T) => fn,
}));

const { categoryLastMod, createSitemapSummarizer, getSitemapSummary } =
  await import('./sitemapHelpers');

const DEV = '💻 Developer Tools';
const COMMS = '💬 Communication';
const iso = (sec: number) =>
  new Date(sec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, category, status, ai_doc, ai_doc_at, created_at, github_stars, tools_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // Writeup + strong traction: indexable, and one side of a curated compare pair.
  insert.run(
    'executeautomation-playwright-mcp-server',
    DEV,
    'active',
    'doc',
    1790000000,
    1700000000,
    1500,
    null,
  );
  // Writeup + traction + proof it runs: indexable, the other side of that pair.
  insert.run(
    'microsoft-playwright-mcp',
    COMMS,
    'active',
    'doc',
    1780000000,
    1700000000,
    150,
    'introspected',
  );
  // No writeup: not indexable, but still dates its category hub.
  insert.run('thin', DEV, 'active', null, null, 1795000000, 0, null);
  // No category: counts under 'other'.
  insert.run('nocat', null, 'active', null, null, 1750000000, 0, null);
  // Removed: ignored entirely.
  insert.run('gone', DEV, 'removed', 'doc', 1799000000, 1700000000, 999, null);
});

describe('getSitemapSummary', () => {
  it('folds the active catalog into indexable listings, hub dates and compare pairs', async () => {
    const summary = await getSitemapSummary();
    expect(summary.listings).toEqual([
      {
        id: 'executeautomation-playwright-mcp-server',
        lastmod: iso(1790000000),
      },
      { id: 'microsoft-playwright-mcp', lastmod: iso(1780000000) },
    ]);
    expect(summary.comparePairLastMod).toEqual({
      'executeautomation-playwright-mcp-server': iso(1790000000),
      'microsoft-playwright-mcp': iso(1780000000),
    });
    expect(categoryLastMod(summary, (c) => c === DEV)).toBe(iso(1795000000));
    expect(categoryLastMod(summary, (c) => (c || 'other') === 'other')).toBe(
      iso(1750000000),
    );
    expect(categoryLastMod(summary, () => true)).toBe(iso(1795000000));
  });
});

describe('createSitemapSummarizer', () => {
  it('dedupes ids across pages and is null when nothing was added', () => {
    const empty = createSitemapSummarizer();
    expect(empty.result()).toBeNull();

    const s = createSitemapSummarizer();
    const row = {
      id: 'x',
      category: DEV,
      hasAiDoc: 1,
      githubStars: 1500,
      aiDocAt: '2026-09-01T00:00:00Z',
    };
    s.add([row]);
    s.add([{ ...row, aiDocAt: '2026-10-01T00:00:00Z' }]);
    expect(s.result()?.listings).toEqual([
      { id: 'x', lastmod: '2026-09-01T00:00:00Z' },
    ]);
  });

  it('falls back to the /categories ship date for a hub with no listings', () => {
    const s = createSitemapSummarizer();
    s.add([{ id: 'x', category: DEV, createdAt: '2026-09-01T00:00:00Z' }]);
    const summary = s.result();
    if (!summary) throw new Error('expected a summary');
    expect(categoryLastMod(summary, (c) => c === COMMS)).toMatch(
      /^2026-\d{2}-\d{2}T12:00:00Z$/,
    );
  });
});

describe('getSitemapSummary when D1 fails', () => {
  it('scans once, without retrying, and falls back to the bundled sample', async () => {
    d1.failing = true;
    d1.prepares = 0;
    try {
      const summary = await getSitemapSummary();
      // Only the cached scan ran: a second, uncached scan would just add load
      // to the D1 that just failed.
      expect(d1.prepares).toBe(1);
      expect(summary.listings).not.toContainEqual(
        expect.objectContaining({ id: 'thin' }),
      );
    } finally {
      d1.failing = false;
    }
  });
});

describe('listings sitemap quality rule', () => {
  it('submits only listings the page leaves indexable', async () => {
    const { buildListingsSitemap } = await import('./sitemapShards');
    const s = createSitemapSummarizer();
    const doc = { category: DEV, hasAiDoc: 1, aiDocAt: '2026-09-01T00:00:00Z' };
    s.add([
      // Kept: strong traction, an Official listing, a live human submission.
      { ...doc, id: 'popular', name: 'Popular', githubStars: 5000 },
      { ...doc, id: 'vendor', name: 'Vendor', isOfficial: 1 },
      {
        ...doc,
        id: 'hosted',
        name: 'Hosted',
        url: 'https://hosted.example/mcp',
        humanSubmitted: 1,
        remoteEndpointHealthy: 1,
      },
      // Noindexed: npm downloads without stars, a generic slug, a duplicate,
      // an archived repo, no writeup.
      {
        ...doc,
        id: 'npm-only',
        name: 'Npm Only',
        githubStars: 2,
        npmDownloads: 4000,
        toolsSource: 'introspected',
      },
      {
        ...doc,
        id: 'mcp-server-62',
        name: 'Clipform MCP',
        githubStars: 300,
        toolsSource: 'introspected',
      },
      { ...doc, id: 'posthog-posthog', name: 'PostHog', githubStars: 40000 },
      {
        ...doc,
        id: 'old',
        name: 'Old',
        githubStars: 5000,
        healthStatus: 'archived',
      },
      { id: 'bare', name: 'Bare', category: DEV, githubStars: 5000 },
    ]);
    const summary = s.result();
    if (!summary) throw new Error('expected a summary');
    expect(buildListingsSitemap(summary).map((e) => e.url)).toEqual([
      'https://allmcps.com/mcp/popular',
      'https://allmcps.com/mcp/vendor',
      'https://allmcps.com/mcp/hosted',
    ]);
  });
});
