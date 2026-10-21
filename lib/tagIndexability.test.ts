import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * Which /tags/[slug] pages search engines get (lib/tags.ts isTagIndexable):
 * enough listings that are themselves indexable, not a near-universal tag,
 * and not a copy of a category hub. Runs the real tag index walk against
 * node:sqlite behind a minimal D1 shim, as tags.test.ts does.
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

/** [id prefix, description, rows, indexable] */
const GROUPS: [string, string, number, boolean][] = [
  // 16 of 96 indexable listings: above the floor, under the 20% share cap.
  ['w', 'Weather forecast service.', 16, true],
  // 80 of 96: near-universal, says nothing about its listings.
  ['c', 'Calendar scheduling.', 80, true],
  // Big, but none of its listings are indexable.
  ['s', 'Slack messages.', 30, false],
];

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, tools, tags, views, copies, upvotes, github_stars, ai_doc, is_official)
     VALUES (?, ?, ?, ?, ?, 'active', '[]', '[]', 0, 0, 0, ?, ?, 0)`,
  );
  for (const [prefix, description, rows, indexable] of GROUPS) {
    for (let n = 0; n < rows; n++) {
      const id = `${prefix}-${n}`;
      insert.run(
        id,
        `Server ${id}`,
        `https://example.com/${id}`,
        description,
        DEV,
        indexable ? 300 : 0,
        indexable ? 'Our writeup.' : null,
      );
    }
  }
});

describe('tag indexability', () => {
  it('indexes a tag only on enough indexable listings, never a near-universal or category tag', async () => {
    const indexable = Object.fromEntries(
      (await getAllTagsWithCounts()).map((t) => [t.slug, t.indexable]),
    );
    expect(indexable).toEqual({
      'developer-tools': false,
      calendar: false,
      slack: false,
      weather: true,
    });
  });

  it('gives the tag page the same verdict as the sitemap', async () => {
    expect((await getServersForTag('weather')).indexable).toBe(true);
    expect((await getServersForTag('slack')).indexable).toBe(false);
    expect((await getServersForTag('no-such-tag')).indexable).toBe(false);
  });
});
