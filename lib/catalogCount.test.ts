import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * The one count every page shows (lib/catalogCount.ts): which listings it
 * counts, the per-isolate reuse, and keeping the last good count. Runs the real queries against node:sqlite behind a
 * minimal D1 shim, as catalogLoaders.test.ts does.
 */

const sqlite = new DatabaseSync(':memory:');
const state = { failing: false, serverQueries: 0 };

const d1Shim = {
  prepare(query: string) {
    if (/from\s+["`]?servers["`]?/i.test(query)) state.serverQueries++;
    let params: unknown[] = [];
    const guard = () => {
      if (state.failing) throw new Error('D1_ERROR: simulated overload');
    };
    const stmt = {
      bind(...p: unknown[]) {
        params = p;
        return stmt;
      },
      async first() {
        guard();
        return sqlite.prepare(query).get(...(params as never[])) ?? null;
      },
      async all() {
        guard();
        return {
          results: sqlite.prepare(query).all(...(params as never[])),
        };
      },
      async raw() {
        guard();
        return sqlite
          .prepare(query)
          .all(...(params as never[]))
          .map((row) => Object.values(row));
      },
      async run() {
        guard();
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

const {
  formatCatalogAsOf,
  getCatalogCount,
  queryCatalogCount,
  resetCatalogCountMemo,
} = await import('./catalogCount');

// id, status, health, stale-flagged, views
const ROWS: [string, string, string, boolean, number][] = [
  ['a-one', 'active', 'healthy', false, 5],
  ['b-two', 'active', 'healthy', false, 50],
  // Archived repos stay listed (lib/servability.ts) and are counted.
  ['c-archived', 'active', 'archived', false, 1],
  ['d-flagged', 'active', 'healthy', true, 999],
  ['e-pending', 'pending', 'unknown', false, 999],
  ['f-removed', 'removed', 'offline', false, 999],
  ['g-three', 'active', 'healthy', false, 20],
];
const SERVABLE = ['a-one', 'b-two', 'c-archived', 'g-three'];

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, health_status, stale_flagged_at, views, copies, upvotes)
     VALUES (?, ?, ?, 'A server.', '💻 Developer Tools', ?, ?, ?, ?, 0, 0)`,
  );
  for (const [id, status, health, flagged, views] of ROWS) {
    insert.run(
      id,
      id,
      `https://github.com/example/${id}`,
      status,
      health,
      flagged ? 1_700_000_000 : null,
      views,
    );
  }
});

beforeEach(() => {
  state.failing = false;
  state.serverQueries = 0;
  resetCatalogCountMemo();
});

describe('queryCatalogCount', () => {
  it('counts servable listings: active and not stale-flagged, archived included', async () => {
    const c = await queryCatalogCount(d1Shim);
    expect(c?.count).toBe(SERVABLE.length);
    expect(Number.isNaN(Date.parse(c?.asOf ?? ''))).toBe(false);
  });

  it('returns null when D1 fails instead of a guessed number', async () => {
    state.failing = true;
    expect(await queryCatalogCount(d1Shim)).toBeNull();
  });
});

describe('getCatalogCount', () => {
  it('reuses the count inside the freshness window', async () => {
    const first = await getCatalogCount();
    const second = await getCatalogCount();
    expect(first?.count).toBe(SERVABLE.length);
    expect(second).toEqual(first);
    expect(state.serverQueries).toBe(1);
  });

  it('keeps the last good count when a refresh fails', async () => {
    const good = await getCatalogCount();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 16 * 60 * 1000);
      state.failing = true;
      expect(await getCatalogCount()).toEqual(good);
    } finally {
      vi.useRealTimers();
    }
  });

  it('formats the as-of time in UTC', () => {
    expect(
      formatCatalogAsOf({ count: 1, asOf: '2026-11-10T22:15:00.000Z' }),
    ).toBe('Nov 10, 2026, 22:15 UTC');
  });
});
