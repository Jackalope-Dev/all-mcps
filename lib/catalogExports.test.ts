import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * The whole-catalog exports (llms.txt, llms-full.txt, data.json): paged D1
 * reads, the site-wide count, and a 503 instead of the bundled snapshot when
 * D1 fails. Runs the real queries against node:sqlite behind a
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

// The real retry waits 1.5-3 s for D1's 10 s window; these tests fail on purpose.
vi.mock('./d1Retry', async (importOriginal) => {
  const real = await importOriginal<typeof import('./d1Retry')>();
  return {
    withD1Retry: <T>(label: string, run: () => Promise<T>) =>
      real.withD1Retry(label, run, { delayMs: 0 }),
  };
});

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: d1Shim }, ctx: {} }),
}));

const { resetCatalogCountMemo } = await import('./catalogCount');
const { getCatalogIndexRows, getServersForLlmsTxt, iterateActiveServers } =
  await import('./servers');
const { GET: dataJsonGet } = await import('../app/data.json/route');
const { GET: llmsFullGet } = await import('../app/llms-full.txt/route');
const { GET: llmsGet } = await import('../app/llms.txt/route');

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

describe('whole-catalog exports', () => {
  it('llms.txt rows page through every servable listing, most-used first', async () => {
    const rows = await getServersForLlmsTxt({ pageSize: 2 });
    expect(rows.map((r) => r.id)).toEqual([
      'b-two',
      'g-three',
      'a-one',
      'c-archived',
    ]);
    expect(rows[0]).not.toHaveProperty('views');
    // 4 servable rows at 2 a page: two full pages and an empty one.
    expect(state.serverQueries).toBe(3);
  });

  it('data.json rows page through every servable listing in id order', async () => {
    const rows = await getCatalogIndexRows({ pageSize: 3 });
    expect(rows.map((r) => r.id)).toEqual(SERVABLE);
    expect(state.serverQueries).toBe(2);
  });

  it('a D1 failure throws instead of returning the bundled snapshot', async () => {
    state.failing = true;
    await expect(getServersForLlmsTxt()).rejects.toThrow();
    await expect(getCatalogIndexRows()).rejects.toThrow();
    await expect(iterateActiveServers().next()).rejects.toThrow();
  });

  it('/data.json answers 503, uncached, when D1 fails', async () => {
    state.failing = true;
    const res = await dataJsonGet(new Request('https://allmcps.com/data.json'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ error: 'catalog_unavailable' });
  });

  it('/llms.txt and /llms-full.txt answer 503, uncached, when D1 fails', async () => {
    state.failing = true;
    for (const get of [llmsGet, llmsFullGet]) {
      const res = await get(new Request('https://allmcps.com/llms.txt'));
      expect(res.status).toBe(503);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await res.text()).not.toContain('AGENTREADY');
    }
  });

  it('/llms-full.txt never builds per request: 503 until a stored copy exists', async () => {
    const res = await llmsFullGet(
      new Request('https://allmcps.com/llms-full.txt'),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(state.serverQueries).toBe(0);
  });

  it('builds llms-full.txt and data.json as chunks of one whole file', async () => {
    const { buildDataJson, buildLlmsFull } = await import(
      './catalogExportBuild'
    );
    const full = await buildLlmsFull(null);
    let text = '';
    for await (const c of full.chunks) text += c;
    expect(full.rows).toBe(SERVABLE.length);
    expect(text).toMatch(/^# AllMCPs - Complete Catalog Export/);
    for (const id of SERVABLE) expect(text).toContain(id);
    expect(text).not.toContain('d-flagged');

    const data = await buildDataJson({
      count: 4,
      asOf: '2026-11-10T00:00:00Z',
    });
    let json = '';
    for await (const c of data.chunks) json += c;
    const parsed = JSON.parse(json) as {
      count: number;
      catalogCount: number;
      servers: { id: string; detailUrl: string }[];
    };
    expect(parsed.count).toBe(SERVABLE.length);
    expect(parsed.catalogCount).toBe(4);
    expect(parsed.servers.map((x) => x.id)).toEqual(SERVABLE);
    expect(parsed.servers[0].detailUrl).toBe('https://allmcps.com/mcp/a-one');
  });

  it('/llms.txt prints the site-wide count and no agent authorization', async () => {
    const res = await llmsGet(new Request('https://allmcps.com/llms.txt'));
    const text = await res.text();
    expect(text).toContain(`**Total MCP Servers:** ${SERVABLE.length} (as of`);
    expect(text).not.toMatch(/authori[sz]ed to (surface|apply)/i);
    expect(text).toContain('AGENTREADY');
  });

  it('/data.json reports the export rows and the site-wide count', async () => {
    const res = await dataJsonGet(new Request('https://allmcps.com/data.json'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      catalogCount: number;
      servers: { id: string }[];
    };
    expect(body.count).toBe(SERVABLE.length);
    expect(body.catalogCount).toBe(SERVABLE.length);
    expect(body.servers.map((s) => s.id)).toEqual(SERVABLE);
  });
});
