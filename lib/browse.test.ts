import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { searchMisses, servers as serversTable } from '@/db/schema';
import { parseBrowseParams } from './browseParams';

/**
 * lib/browse.ts builds its facet and sort SQL by hand (json_each ranking,
 * CASE weights, scalar min()), so it runs against real SQLite (node:sqlite)
 * behind a D1 shim rather than a mock that would accept anything.
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
        return { results: sqlite.prepare(query).all(...(params as never[])) };
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

const { browseCatalog } = await import('./browse');

const nowSec = Math.floor(Date.now() / 1000);
const DAY = 86400;

type Row = Partial<{
  status: string;
  category: string;
  install_kind: string;
  install_command: string;
  pricing_model: string;
  tools_source: string;
  stale_flagged_at: number;
  views: number;
  upvotes: number;
  created_at: number;
  is_premium: number;
  health_status: string;
  description: string;
}>;

const ROWS: Record<string, Row> = {
  'pg-remote': {
    category: 'Databases',
    install_kind: 'remote',
    views: 50,
    created_at: nowSec - 30 * DAY,
    description: 'Query PostgreSQL over HTTP.',
  },
  'pg-node': {
    category: 'Databases',
    install_kind: 'stdio',
    install_command: 'npx',
    tools_source: 'introspected',
    views: 10,
    created_at: nowSec - 2 * DAY,
    description: 'PostgreSQL tools for agents.',
  },
  'py-files': {
    category: 'Files',
    install_kind: 'stdio',
    install_command: 'uvx',
    pricing_model: 'free',
    views: 5,
    created_at: nowSec - 300 * DAY,
    description: 'Read files from python.',
  },
  'flagged-pg': {
    category: 'Databases',
    stale_flagged_at: nowSec,
    views: 999,
    description: 'PostgreSQL but flagged.',
  },
  'pending-pg': {
    status: 'pending',
    category: 'Databases',
    description: 'PostgreSQL pending review.',
  },
  'paid-files': {
    category: 'Files',
    is_premium: 1,
    created_at: nowSec - 400 * DAY,
    description: 'Paid file server.',
  },
};

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const missCols = getTableConfig(searchMisses).columns.map((c) =>
    c.name === 'query' ? 'query TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE search_misses (${missCols.join(', ')})`);
  for (const [id, r] of Object.entries(ROWS)) {
    const row = {
      id,
      name: id,
      url: `https://github.com/acme/${id}`,
      status: 'active',
      views: 0,
      copies: 0,
      upvotes: 0,
      is_premium: 0,
      is_official: 0,
      created_at: nowSec - DAY,
      ...r,
    };
    const keys = Object.keys(row);
    sqlite
      .prepare(
        `INSERT INTO servers (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      )
      .run(...(Object.values(row) as never[]));
  }
});

const browse = (qs: string) =>
  browseCatalog(parseBrowseParams(new URLSearchParams(qs)));
const ids = (r: { items: { id: string }[] }) => r.items.map((s) => s.id);

describe('browseCatalog against real SQLite', () => {
  it('lists only servable listings, featured first on trending', async () => {
    const r = await browse('');
    expect(r.total).toBe(4);
    expect(ids(r)[0]).toBe('paid-files');
    expect(ids(r)).not.toContain('flagged-pg');
    expect(ids(r)).not.toContain('pending-pg');
  });

  it('filters on real columns', async () => {
    expect(ids(await browse('transport=remote'))).toEqual(['pg-remote']);
    expect(ids(await browse('stack=python'))).toEqual(['py-files']);
    expect(ids(await browse('stack=typescript'))).toEqual(['pg-node']);
    expect(ids(await browse('pricing=free'))).toEqual(['py-files']);
    expect(ids(await browse('verified=1'))).toEqual(['pg-node']);
  });

  it('sorts literal metrics literally', async () => {
    expect(ids(await browse('sort=most_viewed'))[0]).toBe('pg-remote');
    expect(ids(await browse('sort=newest'))[0]).toBe('pg-node');
    expect(ids(await browse('sort=alpha'))).toEqual([
      'paid-files',
      'pg-node',
      'pg-remote',
      'py-files',
    ]);
  });

  it('counts on page one only', async () => {
    expect((await browse('sort=alpha')).total).toBe(4);
    const next = await browse('sort=alpha&offset=30');
    expect(ids(next)).toEqual([]);
    expect(next.total).toBeNull();
  });

  it('searches through the shared ranker and applies facets to the hits', async () => {
    const all = await browse('q=postgresql');
    expect(ids(all).sort()).toEqual(['pg-node', 'pg-remote']);
    expect(ids(await browse('q=postgresql&transport=stdio'))).toEqual([
      'pg-node',
    ]);
  });

  it('records a text search that found nothing', async () => {
    const r = await browse('q=quantum+teleporter');
    expect(r.total).toBe(0);
    expect(
      sqlite.prepare('SELECT query, surface, count FROM search_misses').all(),
    ).toEqual([{ query: 'quantum teleporter', surface: 'browse', count: 1 }]);
  });
});
