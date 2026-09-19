import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * searchActiveServers runs hand-built SQL (MATERIALIZED CTE, json_each tool-name
 * extraction, bound LIKE patterns) against D1. A mocked catalog can't catch a
 * query D1 would reject, so this runs the real function against a real SQLite
 * engine (node:sqlite) behind a minimal D1 binding shim.
 *
 * Regression: /api/v1/search and the MCP search tool used to load the entire
 * ~22.5k-row catalog into the Worker and hit exceededMemory on every query.
 */

const sqlite = new DatabaseSync(':memory:');

/** Just enough of the D1 binding surface for drizzle-orm/d1. */
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

const { searchActiveServers } = await import('./servers');

type Row = {
  id: string;
  name: string;
  description: string;
  category: string;
  status?: string;
  tools?: string | null;
  aiUseCases?: string | null;
  views?: number;
};

const ROWS: Row[] = [
  {
    id: 'afterlaunch',
    name: 'AfterLaunch: the agentic growth marketing engine',
    description: 'Growth marketing agent.',
    category: '🎯 Marketing',
  },
  {
    id: 'pg-admin',
    name: 'PG Admin',
    description: 'Manage PostgreSQL clusters.',
    category: '🗄️ Databases',
    views: 50,
  },
  {
    id: 'coin-tracker',
    name: 'Coin Tracker',
    description: 'Portfolio tools.',
    category: '💰 Finance',
    tools: JSON.stringify([
      {
        name: 'get_bitcoin_price',
        description: 'Spot price',
        inputSchema: { type: 'object', properties: { symbol: {} } },
      },
    ]),
  },
  {
    id: 'vault-notes',
    name: 'Vault Notes',
    description: 'Plain notes.',
    category: '📝 Productivity',
    aiUseCases: JSON.stringify(['Sync your obsidian vault']),
  },
  {
    id: 'retired-postgres',
    name: 'Retired Postgres',
    description: 'Old postgres listing.',
    category: '🗄️ Databases',
    status: 'removed',
  },
  {
    id: 'broken-tools',
    name: 'Broken Tools Postgres',
    description: 'Postgres with malformed tools JSON.',
    category: '🗄️ Databases',
    tools: '{not json',
  },
];

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, tools, ai_use_cases, views, copies, upvotes, is_official)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
  );
  for (const r of ROWS) {
    insert.run(
      r.id,
      r.name,
      `https://github.com/example/${r.id}`,
      r.description,
      r.category,
      r.status ?? 'active',
      r.tools ?? null,
      r.aiUseCases ?? null,
      r.views ?? 0,
    );
  }
});

const ids = (servers: Array<{ id: string }>) => servers.map((s) => s.id);

describe('searchActiveServers against real SQLite', () => {
  it('finds the listing from the crashing production query', async () => {
    const hits = await searchActiveServers({
      query: 'afterlaunch',
      limit: 5,
    });
    expect(ids(hits)).toEqual(['afterlaunch']);
    expect(hits[0].category).toBe('🎯 Marketing');
  });

  it('expands synonyms and skips inactive rows', async () => {
    const hits = await searchActiveServers({ query: 'postgres', limit: 10 });
    expect(ids(hits)).toContain('pg-admin');
    expect(ids(hits)).toContain('broken-tools');
    expect(ids(hits)).not.toContain('retired-postgres');
  });

  it('matches tool names and AI use cases, returning trimmed tools', async () => {
    const coin = await searchActiveServers({ query: 'bitcoin', limit: 5 });
    expect(ids(coin)).toEqual(['coin-tracker']);
    expect(coin[0].tools).toEqual([
      { name: 'get_bitcoin_price', description: 'Spot price' },
    ]);

    const notes = await searchActiveServers({ query: 'obsidian', limit: 5 });
    expect(ids(notes)).toEqual(['vault-notes']);
  });

  it('applies the category filter in SQL', async () => {
    const hits = await searchActiveServers({
      query: 'postgres',
      category: '💰 Finance',
      limit: 10,
    });
    expect(hits).toEqual([]);
  });

  it('falls back to relaxed OR, then typo matching', async () => {
    const relaxed = await searchActiveServers({
      query: 'postgres kubernetes',
      limit: 10,
    });
    expect(ids(relaxed)).toContain('pg-admin');

    const typo = await searchActiveServers({ query: 'markting', limit: 5 });
    expect(ids(typo)).toEqual(['afterlaunch']);
  });

  it('returns the top listings, bounded, when there is no query', async () => {
    const top = await searchActiveServers({ query: '', limit: 2 });
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe('pg-admin');

    const inCategory = await searchActiveServers({
      query: '',
      category: '🗄️ Databases',
      limit: 10,
    });
    expect(ids(inCategory).sort()).toEqual(['broken-tools', 'pg-admin']);
  });

  it('returns nothing for an all-punctuation query', async () => {
    expect(await searchActiveServers({ query: '!!!', limit: 5 })).toEqual([]);
  });
});
