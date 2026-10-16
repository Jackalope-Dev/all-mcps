import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';
import { buildSearchPrefilter } from './search';
import {
  errorText,
  ftsBackfillSql,
  ftsFuzzyMatch,
  ftsKeywordPlan,
  ftsPhrase,
  ftsReadySql,
  isFtsSchemaError,
  isSearchFtsReady,
  resetSearchFtsState,
} from './searchFts';

/**
 * The servers_fts trigram index (drizzle/0065_search_fts.sql) against a real
 * SQLite engine: the migration's own SQL, its triggers, the backfill, and
 * searchActiveServers on the index vs the LIKE scan it replaces.
 */

const MIGRATION = readFileSync(
  path.join(process.cwd(), 'drizzle/0065_search_fts.sql'),
  'utf8',
);

function createServersDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  db.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  db.exec(
    'CREATE TABLE job_cursors (name TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  );
  return db;
}

/** Index database: migration applied, then rows inserted (so the insert trigger fills it). */
const indexed = createServersDb();
indexed.exec(MIGRATION);
/** Same rows, never migrated: what production looks like before the rollout. */
const plain = createServersDb();
let current = indexed;

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
          results: current.prepare(query).all(...(params as never[])),
        };
      },
      async raw() {
        return current
          .prepare(query)
          .all(...(params as never[]))
          .map((row) => Object.values(row));
      },
      async run() {
        current.prepare(query).run(...(params as never[]));
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
  staleFlaggedAt?: number;
  tools?: string | null;
  aiUseCases?: string | null;
  aiOverview?: string | null;
  tags?: string | null;
  views?: number;
};

const DB = '🗄️ Databases';
const ROWS: Row[] = [
  {
    id: 'pg-admin',
    name: 'PG Admin',
    description: 'Manage PostgreSQL clusters.',
    category: DB,
    views: 50,
  },
  {
    id: 'postgres-mcp',
    name: 'Postgres MCP',
    description: 'Query a database over SQL.',
    category: DB,
    tags: JSON.stringify(['sql', 'database']),
  },
  {
    // "upgrade" contains "pg", a postgres synonym: the one known recall difference.
    id: 'upgrade-helper',
    name: 'Upgrade Helper',
    description: 'Keeps packages current.',
    category: '💻 Developer Tools',
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
    id: 'retired-bitcoin',
    name: 'Retired Postgres',
    description: 'Old postgres listing.',
    category: DB,
    status: 'removed',
  },
  {
    id: 'stale-bitcoin',
    name: 'Stale Postgres',
    description: 'Flagged stale.',
    category: DB,
    staleFlaggedAt: 1_700_000_000,
  },
  {
    id: 'broken-tools',
    name: 'Broken Tools Postgres',
    description: 'Postgres with malformed tools JSON.',
    category: DB,
    tools: '{not json',
  },
  {
    id: 'ai-gateway',
    name: 'AI Gateway',
    description: 'Route LLM calls to OpenAI and Claude.',
    category: '🤖 AI',
    views: 30,
  },
  {
    id: 's3-browser',
    name: 'S3 Browser',
    description: 'Browse AWS buckets.',
    category: '☁️ Cloud',
  },
  {
    id: 'afterlaunch',
    name: 'AfterLaunch: the agentic growth marketing engine',
    description: 'Growth marketing agent.',
    category: '🎯 Marketing',
  },
  {
    id: 'github-issues',
    name: 'GitHub Issues',
    description: 'Triage and label tickets.',
    category: '💻 Developer Tools',
    tools: JSON.stringify([
      { name: 'create_issue', description: 'Open an issue' },
    ]),
  },
  {
    id: 'kube-ctl',
    name: 'Kube Control',
    description: 'Drive k8s clusters.',
    category: '☁️ Cloud',
  },
  {
    // Past the 600-char prose clip, which the JS scorer never reads either.
    id: 'long-overview',
    name: 'Long Overview',
    description: 'Something.',
    category: '📝 Productivity',
    aiOverview: `${'filler '.repeat(120)}zeppelin`,
  },
];

function insertRows(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, stale_flagged_at, tools,
       ai_use_cases, ai_overview, tags, views, copies, upvotes, is_official)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
  );
  for (const r of ROWS) {
    insert.run(
      r.id,
      r.name,
      `https://github.com/example/${r.id}`,
      r.description,
      r.category,
      r.status ?? 'active',
      r.staleFlaggedAt ?? null,
      r.tools ?? null,
      r.aiUseCases ?? null,
      r.aiOverview ?? null,
      r.tags ?? null,
      r.views ?? 0,
    );
  }
}

beforeAll(() => {
  insertRows(indexed);
  insertRows(plain);
  indexed.exec(ftsReadySql(1_800_000_000));
});

afterEach(() => {
  current = indexed;
  resetSearchFtsState();
  vi.restoreAllMocks();
});

const ids = (servers: Array<{ id: string }>) => servers.map((s) => s.id);

/** Search on the index (current = indexed, ready row present) or the LIKE scan (plain db). */
async function search(
  query: string,
  path: 'fts' | 'like',
  opts: { category?: string; limit?: number } = {},
) {
  current = path === 'fts' ? indexed : plain;
  resetSearchFtsState();
  return ids(
    await searchActiveServers({
      query,
      category: opts.category,
      limit: opts.limit ?? 20,
      vectorTopK: 0,
    }),
  );
}

describe('FTS query building', () => {
  it('quotes every term so FTS5 syntax is inert', () => {
    expect(ftsPhrase('near')).toBe('"near"');
    expect(ftsPhrase('a"b')).toBe('"a""b"');
  });

  it('matches 3+ char groups through the index, dropping 1-2 char synonyms', () => {
    const plan = ftsKeywordPlan(buildSearchPrefilter('postgres'), 'all');
    expect(plan).toEqual({
      kind: 'match',
      match: '("postgres" OR "postgresql" OR "psql")',
      likeGroups: [],
    });
  });

  it('keeps a 1-2 char term as a LIKE filter on the matched rows', () => {
    const plan = ftsKeywordPlan(buildSearchPrefilter('ai gateway'), 'all');
    expect(plan?.kind).toBe('match');
    expect(plan?.likeGroups).toEqual([['ai', 'llm', 'openai', 'claude']]);
  });

  it('scans the index content when no term can use it', () => {
    expect(ftsKeywordPlan(buildSearchPrefilter('ai'), 'all')).toEqual({
      kind: 'scan',
      likeGroups: [['ai', 'llm', 'openai', 'claude']],
    });
    expect(ftsKeywordPlan(buildSearchPrefilter('aws s3'), 'any')?.kind).toBe(
      'scan',
    );
  });

  it('restricts the typo fallback to name, category and description', () => {
    expect(ftsFuzzyMatch(buildSearchPrefilter('markting'))).toBe(
      '{name category description} : ("mar" OR "ing")',
    );
    expect(ftsFuzzyMatch(buildSearchPrefilter('ab'))).toBeNull();
  });

  it('builds integer-only backfill SQL', () => {
    expect(ftsBackfillSql(1, 2000)).toContain(
      'WHERE rowid BETWEEN 1 AND 2000;',
    );
    expect(() => ftsBackfillSql(Number.NaN, 5)).toThrow();
  });
});

describe('servers_fts triggers', () => {
  const ftsRow = (id: string) =>
    indexed
      .prepare(
        'SELECT rowid, name, description, body FROM servers_fts WHERE id = ?',
      )
      .get(id) as
      | { rowid: number; name: string; description: string; body: string }
      | undefined;
  const writesFor = (statement: string) => {
    const before = indexed.prepare('SELECT total_changes() AS n').get() as {
      n: number;
    };
    indexed.exec(statement);
    const after = indexed.prepare('SELECT total_changes() AS n').get() as {
      n: number;
    };
    return after.n - before.n;
  };

  it('indexes inserts with tool names, not raw tool schemas', () => {
    const row = ftsRow('coin-tracker');
    expect(row?.body).toContain('get_bitcoin_price');
    expect(row?.body).not.toContain('inputSchema');
    expect(row?.body).not.toContain('Spot price');
  });

  it('agrees with the backfill SQL row for row', () => {
    const fromTriggers = indexed
      .prepare(
        'SELECT rowid, id, name, category, description, body FROM servers_fts ORDER BY rowid',
      )
      .all();
    const db = createServersDb();
    insertRows(db);
    db.exec(MIGRATION);
    db.exec(ftsBackfillSql(1, 5));
    db.exec(ftsBackfillSql(6, 1000));
    db.exec(ftsBackfillSql(1, 5)); // re-running a chunk is harmless
    const fromBackfill = db
      .prepare(
        'SELECT rowid, id, name, category, description, body FROM servers_fts ORDER BY rowid',
      )
      .all();
    expect(fromBackfill).toEqual(fromTriggers);
    expect(fromBackfill).toHaveLength(ROWS.length);
  });

  it('re-applying the migration is a no-op', () => {
    expect(() => indexed.exec(MIGRATION)).not.toThrow();
    expect(
      indexed.prepare('SELECT count(*) AS n FROM servers_fts').get(),
    ).toEqual({ n: ROWS.length });
  });

  it('leaves the index alone when unindexed columns change', () => {
    // Health / views / tools-check cron shape: one write, the servers row only.
    expect(
      writesFor(
        "UPDATE servers SET views = views + 1, last_checked_at = 5, health_status = 'healthy' WHERE id = 'kube-ctl'",
      ),
    ).toBe(1);
    // Rewriting an indexed column with the same value doesn't touch it either.
    expect(
      writesFor(
        "UPDATE servers SET tools = tools, description = description WHERE id = 'coin-tracker'",
      ),
    ).toBe(1);
  });

  it('re-indexes a row when an indexed column changes', async () => {
    expect(
      writesFor(
        "UPDATE servers SET description = 'Drive kubernetes and helm charts.' WHERE id = 'kube-ctl'",
      ),
    ).toBeGreaterThan(1);
    expect(ftsRow('kube-ctl')?.description).toContain('helm');
    expect(await search('helm', 'fts')).toEqual(['kube-ctl']);
    indexed.exec(
      "UPDATE servers SET description = 'Drive k8s clusters.' WHERE id = 'kube-ctl'",
    );
    expect(await search('helm', 'fts')).toEqual([]);
  });

  it('follows inserts and deletes', async () => {
    indexed.exec(
      "INSERT INTO servers (id, name, url, description, category, status, views, copies, upvotes, is_official) VALUES ('tmp-zebra', 'Zebra Tracker', 'https://x', 'Stripes.', '💰 Finance', 'active', 0, 0, 0, 0)",
    );
    expect(await search('zebra', 'fts')).toEqual(['tmp-zebra']);
    indexed.exec("DELETE FROM servers WHERE id = 'tmp-zebra'");
    expect(ftsRow('tmp-zebra')).toBeUndefined();
    expect(await search('zebra', 'fts')).toEqual([]);
  });
});

describe('searchActiveServers on the index vs the LIKE scan', () => {
  const PARITY_QUERIES = [
    'clusters',
    'bitcoin',
    'obsidian',
    'ai',
    'ai gateway',
    's3',
    'aws s3',
    'github issues',
    'create issue',
    'kubernetes',
    'k8s',
    'bitcoin kubernetes',
    'markting',
    'zeppelin',
    'symbol',
    'plain',
    'database sql',
    // Odd input: FTS5 operators, quotes and column filters must stay literal.
    '"; DROP TABLE servers; --',
    'NEAR(bitcoin tracker)',
    'name:bitcoin',
    'bitc*',
    '-bitcoin',
    '"unterminated',
    '(((',
    'AND OR NOT',
    '{name}: pg',
  ];

  it.each(PARITY_QUERIES)('%s returns the same results', async (q) => {
    const errors = vi.spyOn(console, 'error');
    const fts = await search(q, 'fts');
    const like = await search(q, 'like');
    expect(fts).toEqual(like);
    expect(errors).not.toHaveBeenCalled();
  });

  it('finds substrings inside words (postgres -> PostgreSQL)', async () => {
    const hits = await search('postgres', 'fts');
    expect(hits).toContain('pg-admin');
    expect(hits).toContain('postgres-mcp');
    expect(hits).toContain('broken-tools');
  });

  it('filters non-servable rows and applies the category', async () => {
    const hits = await search('postgres', 'fts');
    expect(hits).not.toContain('retired-bitcoin');
    expect(hits).not.toContain('stale-bitcoin');
    expect(await search('postgres', 'fts', { category: '💰 Finance' })).toEqual(
      [],
    );
    expect((await search('postgres', 'fts', { category: DB })).sort()).toEqual([
      'broken-tools',
      'pg-admin',
      'postgres-mcp',
    ]);
  });

  it('drops matches that rest only on a 1-2 char synonym', async () => {
    // LIKE '%pg%' hits "upgrade"; the index only recalls 3+ char alternatives.
    expect(await search('postgres', 'like')).toContain('upgrade-helper');
    expect(await search('postgres', 'fts')).not.toContain('upgrade-helper');
  });

  it('returns nothing for an all-punctuation query', async () => {
    expect(await search('!!!', 'fts')).toEqual([]);
  });
});

describe('rollout fallback', () => {
  it('uses the LIKE scan while the index has no ready row', async () => {
    indexed.exec("DELETE FROM job_cursors WHERE name = 'search_fts_ready'");
    try {
      current = indexed;
      resetSearchFtsState();
      const hits = ids(
        await searchActiveServers({
          query: 'postgres',
          limit: 20,
          vectorTopK: 0,
        }),
      );
      // Only the LIKE path recalls the "pg"-in-"upgrade" row.
      expect(hits).toContain('upgrade-helper');
    } finally {
      indexed.exec(ftsReadySql(1_800_000_000));
    }
  });

  it('falls back when the migration was never applied', async () => {
    const errors = vi.spyOn(console, 'error');
    current = plain;
    resetSearchFtsState();
    const hits = ids(
      await searchActiveServers({ query: 'bitcoin', limit: 5, vectorTopK: 0 }),
    );
    expect(hits).toEqual(['coin-tracker']);
    expect(errors).not.toHaveBeenCalled();
  });

  it('falls back, and remembers it, when the table vanishes after ready', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = createServersDb();
    insertRows(db);
    db.exec(ftsReadySql(1_800_000_000)); // ready row but no servers_fts
    current = db;
    resetSearchFtsState();
    const first = ids(
      await searchActiveServers({ query: 'bitcoin', limit: 5, vectorTopK: 0 }),
    );
    expect(first).toEqual(['coin-tracker']);
    expect(errors).toHaveBeenCalledTimes(1);
    // Memoized: the next search goes straight to LIKE without retrying FTS.
    const second = ids(
      await searchActiveServers({ query: 'obsidian', limit: 5, vectorTopK: 0 }),
    );
    expect(second).toEqual(['vault-notes']);
    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe('transient D1 errors', () => {
  const overloaded = new Error('Failed query: select ...', {
    cause: new Error(
      'D1_ERROR: D1 DB is overloaded. Requests queued for too long.',
    ),
  });

  it('only treats a missing index as a reason to use the LIKE scan', () => {
    expect(isFtsSchemaError(new Error('no such table: servers_fts'))).toBe(
      true,
    );
    expect(
      isFtsSchemaError(
        new Error('x', { cause: new Error('no such module: fts5') }),
      ),
    ).toBe(true);
    expect(isFtsSchemaError(overloaded)).toBe(false);
    expect(
      isFtsSchemaError(
        new Error('D1 DB exceeded its CPU time limit and was reset.'),
      ),
    ).toBe(false);
  });

  it('includes the wrapped D1 message in errorText', () => {
    expect(errorText(overloaded)).toContain('D1 DB is overloaded');
  });

  it('keeps the known readiness when the probe hits a transient error, and retries soon', async () => {
    resetSearchFtsState();
    expect(await isSearchFtsReady(async () => true, 1_000_000)).toBe(true);
    // Recheck due (5 min later) and the probe fails: still ready.
    const later = 1_000_000 + 5 * 60 * 1000 + 1;
    expect(
      await isSearchFtsReady(async () => {
        throw overloaded;
      }, later),
    ).toBe(true);
    // Retried within ~30s instead of pinning the answer for 5 minutes.
    const probe = vi.fn(async () => true);
    await isSearchFtsReady(probe, later + 31_000);
    expect(probe).toHaveBeenCalledTimes(1);
    resetSearchFtsState();
  });
});
