import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * The shared tag index behind /tags, /tags/[slug] and /sitemap/core.xml: one
 * catalog walk yields every tag's label, true count and its most-engaged ids
 * (capped), and tag pages hydrate only those ids. Runs the real queries
 * against node:sqlite behind a minimal D1 shim, as catalogLoaders.test.ts does.
 */

const sqlite = new DatabaseSync(':memory:');

const d1Shim = {
  prepare(query: string) {
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
      async run() {
        sqlite.prepare(query).run(...(params as never[]));
        return { success: true, meta: {}, results: [] };
      },
    };
    return stmt;
  },
};

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: d1Shim }, ctx: {} }),
}));

const { getAllTagsWithCounts, getServersForTag } = await import('./tags');

const DEV = '💻 Developer Tools';
const COMMS = '💬 Communication';

type Row = {
  id: string;
  name: string;
  description: string;
  category: string;
  status?: string;
  upvotes?: number;
  githubStars?: number;
  tags?: string[];
};

/** 140 weather listings, so the per-tag id cap (60) and its trimming kick in. */
const BULK = 140;
const pad = (n: number) => String(n).padStart(3, '0');

const ROWS: Row[] = [
  // postgres: q (upvotes 3 → 15) > p (1000 stars → ~9) > r (0).
  {
    id: 'p-pg',
    name: 'Postgres Admin',
    description: 'Query postgres.',
    category: DEV,
    githubStars: 1000,
  },
  {
    id: 'q-pg',
    name: 'PG Lite',
    description: 'Embedded postgresql.',
    category: DEV,
    upvotes: 3,
    tags: ['Slack Bot'],
  },
  {
    id: 'r-pg',
    name: 'Pg Tools',
    description: 'More postgres.',
    category: DEV,
  },
  {
    id: 's-removed',
    name: 'Old Postgres',
    description: 'Retired postgres weather.',
    category: DEV,
    status: 'removed',
    upvotes: 1000,
  },
  // Pairs share a score (upvotes = n/2), so ties must keep catalog order.
  ...Array.from({ length: BULK }, (_, n) => ({
    id: `w-${pad(n)}`,
    name: `Bulk ${pad(n)}`,
    description: 'Weather forecast service.',
    category: COMMS,
    upvotes: Math.floor(n / 2),
  })),
];

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, tools, tags, views, copies, upvotes, github_stars, is_official)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?, 0, 0, ?, ?, 0)`,
  );
  for (const r of ROWS) {
    insert.run(
      r.id,
      r.name,
      `https://example.com/${r.id}`,
      r.description,
      r.category,
      r.status ?? 'active',
      JSON.stringify(r.tags ?? []),
      r.upvotes ?? 0,
      r.githubStars ?? 0,
    );
  }
});

describe('getAllTagsWithCounts', () => {
  it('counts every servable listing per tag, most-used first then by label', async () => {
    expect(await getAllTagsWithCounts()).toEqual([
      { slug: 'communication', label: 'Communication', count: BULK },
      { slug: 'weather', label: 'Weather', count: BULK },
      { slug: 'developer-tools', label: 'Developer Tools', count: 3 },
      { slug: 'postgres', label: 'PostgreSQL', count: 3 },
      { slug: 'slack-bot', label: 'Slack Bot', count: 1 },
    ]);
  });
});

describe('getServersForTag', () => {
  it('returns the rows best-first by engagement, with the label and true total', async () => {
    const { servers, total, rawTag } = await getServersForTag('postgres');
    expect(rawTag).toBe('PostgreSQL');
    expect(total).toBe(3);
    expect(servers.map((s) => s.id)).toEqual(['q-pg', 'p-pg', 'r-pg']);
    // Full rows, not the slim index walk rows.
    expect(servers[1].githubStars).toBe(1000);
  });

  it('caps the rows at 60 but keeps the true total, ties in catalog order', async () => {
    const { servers, total } = await getServersForTag('weather');
    expect(total).toBe(BULK);
    expect(servers).toHaveLength(60);
    const expected: string[] = [];
    for (let hi = BULK - 1; expected.length < 60; hi -= 2) {
      expected.push(`w-${pad(hi - 1)}`, `w-${pad(hi)}`);
    }
    expect(servers.map((s) => s.id)).toEqual(expected);
  });

  it('treats an unknown tag (including object prototype keys) as empty', async () => {
    for (const slug of ['no-such-tag', 'constructor', 'tostring']) {
      const { servers, total, rawTag } = await getServersForTag(slug);
      expect(servers).toEqual([]);
      expect(total).toBe(0);
      expect(rawTag).toBe(slug);
    }
  });
});
