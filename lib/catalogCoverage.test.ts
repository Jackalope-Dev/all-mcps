import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { searchMisses, servers } from '@/db/schema';
import { getCatalogCoverage, getDemandGaps } from './catalogCoverage';

/** Real SQLite (node:sqlite) behind a minimal D1 shim, as in the other D1 query tests. */
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
const db = drizzle(d1Shim as never);
const NOW = new Date('2026-10-14T00:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);
const DAY = 86400;

function createTable(table: Parameters<typeof getTableConfig>[0], pk: string) {
  const cfg = getTableConfig(table);
  const cols = cfg.columns.map((c) =>
    c.name === pk ? `${pk} TEXT PRIMARY KEY` : c.name,
  );
  sqlite.exec(`CREATE TABLE ${cfg.name} (${cols.join(', ')})`);
}

beforeAll(() => {
  createTable(servers, 'id');
  createTable(searchMisses, 'query');
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, status, stale_flagged_at, category, ai_doc, tools, tools_source, github_stars, last_checked_at, install_kind, logo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tools = JSON.stringify([{ name: 't' }]);
  // Indexable: writeup + traction + verified tools, specific category, fresh check, install, logo.
  insert.run(
    'a',
    'active',
    null,
    '🗄️ Databases',
    'doc',
    tools,
    'introspected',
    150,
    nowSec - DAY,
    'stdio',
    'https://x/logo.png',
  );
  // Not indexable: writeup + traction but only README tools (no verified run), default category, stale check.
  insert.run(
    'b',
    'active',
    null,
    '💻 Developer Tools',
    'doc',
    tools,
    'readme',
    30,
    nowSec - 30 * DAY,
    null,
    '',
  );
  // Skip marker (aiDoc '') and empty tools list: neither counts.
  insert.run(
    'c',
    'active',
    null,
    '💻 Developer Tools',
    '',
    '[]',
    null,
    0,
    null,
    null,
    null,
  );
  // Flagged and pending rows are outside the servable catalog.
  insert.run(
    'd',
    'active',
    nowSec,
    '🗄️ Databases',
    'doc',
    tools,
    'introspected',
    150,
    nowSec,
    'stdio',
    'x',
  );
  insert.run(
    'e',
    'pending',
    null,
    '🗄️ Databases',
    'doc',
    tools,
    'introspected',
    150,
    nowSec,
    'stdio',
    'x',
  );

  const miss = sqlite.prepare(
    `INSERT INTO search_misses (query, surface, count, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
  );
  miss.run('salesforce cpq', 'browse', 12, nowSec - 5 * DAY, nowSec - DAY);
  miss.run('figma tokens', 'mcp', 30, nowSec - 9 * DAY, nowSec - 2 * DAY);
  miss.run('old gap', 'api', 99, nowSec - 90 * DAY, nowSec - 60 * DAY);
});

describe('getCatalogCoverage', () => {
  it('counts each field over servable listings only', async () => {
    const cov = await getCatalogCoverage(db, NOW);
    const by = Object.fromEntries(cov.fields.map((f) => [f.key, f.count]));
    expect(cov.total).toBe(3);
    expect(by).toMatchObject({
      indexable: 1,
      aiDoc: 2,
      toolsIntrospected: 1,
      toolsReadme: 1,
      toolsNone: 1,
      install: 1,
      logo: 1,
      categorized: 1,
      checkedRecently: 1,
    });
  });
});

describe('getDemandGaps', () => {
  it('lists recent misses, most frequent first', async () => {
    const gaps = await getDemandGaps(db, NOW);
    expect(gaps.map((g) => g.query)).toEqual([
      'figma tokens',
      'salesforce cpq',
    ]);
    expect(gaps[0].count).toBe(30);
  });
});
