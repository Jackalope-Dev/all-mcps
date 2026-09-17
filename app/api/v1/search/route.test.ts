import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression coverage for category filtering on GET /api/v1/search.
 *
 * The endpoint used to lowercase the raw `category` query param and hand it to a
 * catalog query that compares it against the stored category *exactly* — and
 * stored categories are emoji-prefixed and title-cased ("🗄️ Databases"). So
 * every category-filtered search returned 200 with zero results, for slugs and
 * for names alike, while the same listings were reachable by keyword.
 *
 * getCategoryServers is mocked with an exact-equality filter on purpose: that is
 * what D1 does (`category = ?`), so these tests fail if the route ever goes back
 * to passing an unresolved string through.
 */

type FakeServer = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
};

const CATALOG: FakeServer[] = [
  {
    id: 'postgres',
    name: 'Postgres MCP',
    url: 'https://github.com/example/postgres',
    description: 'Query and inspect PostgreSQL databases.',
    category: '🗄️ Databases',
  },
  {
    id: 'sqlite-explorer',
    name: 'SQLite Explorer',
    url: 'https://github.com/example/sqlite-explorer',
    description: 'Browse SQLite files.',
    category: '🗄️ Databases',
  },
  {
    id: 'postgres-deploy-helper',
    name: 'Postgres Deploy Helper',
    url: 'https://github.com/example/postgres-deploy-helper',
    description: 'Deploy a postgres cluster to your cloud account.',
    category: '☁️ Cloud Platforms',
  },
  {
    id: 'repo-tools',
    name: 'Repo Tools',
    url: 'https://github.com/example/repo-tools',
    description: 'Everyday git and repository chores.',
    category: '💻 Developer Tools',
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    url: 'https://github.com/example/web-scraper',
    description: 'Extract structured data from web pages.',
    category: '🔎 Search & Data Extraction',
  },
];

vi.mock('@/lib/servers', () => ({
  getActiveServersForScoring: async () => CATALOG,
  // Mirrors the D1 query: exact match against the stored category string.
  getCategoryServers: async (category: string) =>
    CATALOG.filter((s) => s.category === category),
}));

vi.mock('@/lib/ads', () => ({
  fetchActiveSponsorAd: async () => null,
}));

const { GET } = await import('./route');

type SearchBody = {
  total: number;
  query: string | null;
  category: string | null;
  servers: Array<{ id: string; category: string }>;
  error?: string;
  message?: string;
};

let requestCount = 0;

async function search(params: string): Promise<{
  status: number;
  body: SearchBody;
}> {
  // Unique client IP per call so the in-memory rate limiter never trips.
  requestCount += 1;
  const response = await GET(
    new Request(`https://allmcps.com/api/v1/search?${params}`, {
      headers: { 'cf-connecting-ip': `10.0.0.${requestCount % 250}` },
    }),
  );
  return {
    status: response.status,
    body: (await response.json()) as SearchBody,
  };
}

beforeEach(() => {
  requestCount += 1;
});

describe('GET /api/v1/search category filtering', () => {
  it('resolves every accepted category format to the same result set', async () => {
    const formats = [
      'databases', // catalog slug
      'Databases', // plain label
      'DATABASES', // label, different case
      '%F0%9F%97%84%EF%B8%8F%20Databases', // full stored name with emoji
      '%20databases%20', // padded whitespace
      'sql', // alias
    ];

    const responses = await Promise.all(
      formats.map((f) => search(`category=${f}&limit=24`)),
    );

    for (const { status, body } of responses) {
      expect(status).toBe(200);
      // The canonical stored name is echoed back, whatever format came in.
      expect(body.category).toBe('🗄️ Databases');
      expect(body.servers.map((s) => s.id).sort()).toEqual([
        'postgres',
        'sqlite-explorer',
      ]);
      expect(body.total).toBe(2);
    }
  });

  it('returns the listings in a category-only search', async () => {
    const { status, body } = await search('category=databases&limit=1');
    expect(status).toBe(200);
    expect(body.query).toBeNull();
    expect(body.total).toBe(1);
    expect(body.servers).toHaveLength(1);
    expect(body.servers[0].category).toBe('🗄️ Databases');
  });

  it('applies both filters on a combined keyword + category search', async () => {
    const { body } = await search('q=postgres&category=databases&limit=24');
    // "postgres" also matches a Cloud Platforms listing; the category filter
    // must exclude it, and the keyword must exclude the other database listing.
    expect(body.servers.map((s) => s.id)).toEqual(['postgres']);
    expect(body.query).toBe('postgres');
    expect(body.category).toBe('🗄️ Databases');
  });

  it('never leaks listings from unrelated categories', async () => {
    const cases: Array<[string, string]> = [
      ['cloud-platforms', '☁️ Cloud Platforms'],
      ['search-and-data-extraction', '🔎 Search & Data Extraction'],
      ['developer-tools', '💻 Developer Tools'],
    ];

    for (const [slug, canonical] of cases) {
      const { body } = await search(`category=${slug}&limit=24`);
      expect(body.category).toBe(canonical);
      expect(body.servers.length).toBeGreaterThan(0);
      for (const server of body.servers) {
        expect(server.category).toBe(canonical);
      }
    }
  });

  it('rejects an unknown category with 400 unknown_category', async () => {
    const { status, body } = await search('category=not-a-real-category');
    expect(status).toBe(400);
    expect(body.error).toBe('unknown_category');
    expect(body.message).toContain('not-a-real-category');
    expect(body.servers).toBeUndefined();
  });

  it('ignores an empty category and searches the whole catalog', async () => {
    const { status, body } = await search('category=%20%20&limit=24');
    expect(status).toBe(200);
    expect(body.category).toBeNull();
    expect(body.total).toBe(CATALOG.length);
  });
});
