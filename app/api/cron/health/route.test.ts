import { DatabaseSync } from 'node:sqlite';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listingSignals,
  serverHealthChecks,
  servers as serversTable,
} from '@/db/schema';

/**
 * The health cron batches GitHub reads through GraphQL and writes every
 * listing's update, signals and history in D1 batches. This runs the real
 * route against SQLite (node:sqlite) behind a D1 shim, with GitHub and npm
 * stubbed, so a query D1 would reject or a write that lands on the wrong row
 * fails here rather than in production.
 */

const sqlite = new DatabaseSync(':memory:');

function statement(query: string) {
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
    async first() {
      return sqlite.prepare(query).get(...(params as never[])) ?? null;
    },
    async run() {
      sqlite.prepare(query).run(...(params as never[]));
      return { success: true, meta: {}, results: [] };
    },
  };
  return stmt;
}

const d1Shim = {
  prepare: statement,
  async batch(stmts: ReturnType<typeof statement>[]) {
    const out = [];
    for (const s of stmts) out.push(await s.all());
    return out;
  },
};

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: { DB: d1Shim, GITHUB_TOKEN: 'test-token' },
    ctx: {},
  }),
}));
vi.mock('@/lib/cronAuth', () => ({ isCronAuthorized: async () => true }));
vi.mock('@/lib/listingPageRefresh', () => ({
  listingRenderChanged: () => false,
  refreshListingPages: async () => ({ refreshed: [], failed: [] }),
}));

const { POST } = await import('./route');

function createTable(table: SQLiteTable, pk: string) {
  const cols = getTableConfig(table).columns.map((c) =>
    c.name === pk ? `${c.name} ${c.primary ? 'PRIMARY KEY' : ''}` : c.name,
  );
  const name = getTableConfig(table).name;
  if (name === 'server_health_checks') {
    cols[0] = 'id INTEGER PRIMARY KEY AUTOINCREMENT';
  }
  sqlite.exec(`CREATE TABLE ${name} (${cols.join(', ')})`);
}

createTable(serversTable, 'id');
createTable(listingSignals, 'server_id');
createTable(serverHealthChecks, 'id');

const DAY = 24 * 60 * 60;
const nowSec = Math.floor(Date.now() / 1000);

function insertServer(id: string, extra: Record<string, unknown>) {
  const row = {
    id,
    name: id,
    url: `https://github.com/acme/${id}`,
    description: 'x',
    category: 'Developer Tools',
    status: 'active',
    health_status: 'unknown',
    views: 0,
    copies: 0,
    upvotes: 0,
    is_premium: 0,
    install_extracted_at: nowSec,
    tools_checked_at: nowSec,
    ...extra,
  };
  const keys = Object.keys(row);
  sqlite
    .prepare(
      `INSERT INTO servers (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    )
    .run(...(Object.values(row) as never[]));
}

let graphqlCalls = 0;
let readmeFetches = 0;

beforeEach(() => {
  sqlite.exec(
    'DELETE FROM servers; DELETE FROM listing_signals; DELETE FROM server_health_checks;',
  );
  graphqlCalls = 0;
  readmeFetches = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.github.com/graphql') {
        graphqlCalls++;
        const query = JSON.parse(String(init?.body)).query as string;
        const data: Record<string, unknown> = {};
        const errors: unknown[] = [];
        for (const m of query.matchAll(
          /(r\d+): repository\(owner: "acme", name: "([^"]+)"\)/g,
        )) {
          const [, alias, name] = m;
          if (name === 'gone') {
            data[alias] = null;
            errors.push({ type: 'NOT_FOUND', path: [alias] });
          } else if (name === 'limited') {
            data[alias] = null;
            errors.push({ type: 'RATE_LIMITED', path: [alias] });
          } else {
            data[alias] = {
              stargazerCount: 77,
              pushedAt: '2026-10-01T00:00:00Z',
              isArchived: false,
              isDisabled: false,
              isFork: false,
              latestRelease: { tagName: 'v2' },
              rm0: { oid: `oid-${name}-new` },
            };
          }
        }
        return Response.json({ data, errors });
      }
      if (url.startsWith('https://docs.example.com/')) {
        // A docs page where an MCP endpoint was cached: HTML to every request.
        return new Response('<!doctype html><html><body>Docs</body></html>', {
          headers: { 'content-type': 'text/html' },
        });
      }
      if (url.startsWith('https://raw.githubusercontent.com/')) {
        readmeFetches++;
        return new Response('# Server\n\nDoes things.');
      }
      return new Response('not found', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const run = () =>
  POST(new Request('https://allmcps.com/api/cron/health', { method: 'POST' }));

describe('health cron', () => {
  it('reads every GitHub repo in one GraphQL request and records health', async () => {
    insertServer('alive', {});
    insertServer('gone', {});
    const res = await run();
    expect(res.status).toBe(200);
    expect(graphqlCalls).toBe(1);

    const rows = sqlite
      .prepare(
        'SELECT id, health_status, github_stars FROM servers ORDER BY id',
      )
      .all();
    expect(rows).toEqual([
      { id: 'alive', health_status: 'healthy', github_stars: 77 },
      { id: 'gone', health_status: 'offline', github_stars: null },
    ]);
    const history = sqlite
      .prepare(
        'SELECT server_id, healthy FROM server_health_checks ORDER BY server_id',
      )
      .all();
    expect(history).toEqual([
      { server_id: 'alive', healthy: 1 },
      { server_id: 'gone', healthy: 0 },
    ]);
  });

  it('keeps the last verdict and writes no history when GitHub gives no answer', async () => {
    insertServer('limited', {
      health_status: 'healthy',
      is_verified_active: 1,
    });
    await run();
    expect(
      sqlite
        .prepare("SELECT health_status FROM servers WHERE id = 'limited'")
        .get(),
    ).toEqual({ health_status: 'healthy' });
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM server_health_checks').get(),
    ).toEqual({ n: 0 });
  });

  it('marks content changed when the README blob changes, not on first sighting', async () => {
    insertServer('first', {});
    insertServer('changed', {});
    sqlite
      .prepare(
        "INSERT INTO listing_signals (server_id, readme_hash, latest_release_tag, repo_gone_count) VALUES ('changed', 'oid-changed-old', 'v2', 0)",
      )
      .run();
    await run();
    const signals = sqlite
      .prepare(
        'SELECT server_id, readme_hash, content_changed_at FROM listing_signals ORDER BY server_id',
      )
      .all() as {
      server_id: string;
      readme_hash: string;
      content_changed_at: number | null;
    }[];
    expect(signals.map((s) => [s.server_id, s.readme_hash])).toEqual([
      ['changed', 'oid-changed-new'],
      ['first', 'oid-first-new'],
    ]);
    expect(signals[0].content_changed_at).not.toBeNull();
    expect(signals[1].content_changed_at).toBeNull();
    // Both READMEs are read: one changed, the other had no hash yet.
    expect(readmeFetches).toBe(2);
  });

  it('skips listings checked within their tier window', async () => {
    insertServer('fresh', {
      last_checked_at: nowSec - DAY,
      health_status: 'healthy',
    });
    insertServer('due', {
      last_checked_at: nowSec - 8 * DAY,
      health_status: 'healthy',
    });
    await run();
    const checked = sqlite
      .prepare('SELECT server_id FROM server_health_checks')
      .all();
    expect(checked).toEqual([{ server_id: 'due' }]);
  });

  it('trims history to the newest 96 checks', async () => {
    insertServer('busy', {});
    const insert = sqlite.prepare(
      'INSERT INTO server_health_checks (server_id, checked_at, healthy) VALUES (?, ?, 1)',
    );
    for (let i = 0; i < 100; i++) insert.run('busy', nowSec - (i + 1) * 3600);
    await run();
    expect(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM server_health_checks WHERE server_id = 'busy'",
        )
        .get(),
    ).toEqual({ n: 96 });
  });
});

describe('health cron README reads', () => {
  it('does not download a README whose blob id is unchanged', async () => {
    insertServer('steady', {});
    sqlite
      .prepare(
        "INSERT INTO listing_signals (server_id, readme_hash, repo_gone_count) VALUES ('steady', 'oid-steady-new', 0)",
      )
      .run();
    await run();
    expect(readmeFetches).toBe(0);
  });
});

describe('health cron tiers', () => {
  it('rechecks popular listings twice a day and the long tail every four days', async () => {
    const healthy = { health_status: 'healthy' };
    const dayAndHalfAgo = nowSec - 1.5 * DAY;
    insertServer('popular', {
      ...healthy,
      last_checked_at: dayAndHalfAgo,
      views: 500,
    });
    insertServer('some-use', {
      ...healthy,
      last_checked_at: dayAndHalfAgo,
      views: 20,
    });
    insertServer('quiet', { ...healthy, last_checked_at: dayAndHalfAgo });
    insertServer('paid', {
      ...healthy,
      last_checked_at: dayAndHalfAgo,
      is_premium: 1,
    });
    await run();
    const checked = sqlite
      .prepare('SELECT server_id FROM server_health_checks ORDER BY server_id')
      .all();
    expect(checked).toEqual([{ server_id: 'paid' }, { server_id: 'popular' }]);
  });

  it('rechecks failing and never-checked listings within hours, whatever the tier', async () => {
    const sevenHoursAgo = nowSec - 7 * 3600;
    insertServer('down', {
      health_status: 'offline',
      last_checked_at: sevenHoursAgo,
    });
    insertServer('unchecked', {
      health_status: 'unknown',
      last_checked_at: sevenHoursAgo,
    });
    insertServer('fine', {
      health_status: 'healthy',
      last_checked_at: sevenHoursAgo,
    });
    await run();
    const checked = sqlite
      .prepare('SELECT server_id FROM server_health_checks ORDER BY server_id')
      .all();
    expect(checked).toEqual([
      { server_id: 'down' },
      { server_id: 'unchecked' },
    ]);
  });
});

describe('health cron cached remote endpoints', () => {
  it('keeps a cached remote install after a single failed check', async () => {
    insertServer('remote-once', {
      install_kind: 'remote',
      install_package: 'https://docs.example.com/mcp',
      install_confidence: 'high',
    });
    await run();
    expect(
      sqlite
        .prepare(
          "SELECT install_kind, remote_endpoint_healthy FROM servers WHERE id = 'remote-once'",
        )
        .get(),
    ).toEqual({ install_kind: 'remote', remote_endpoint_healthy: 0 });
  });

  it('clears a cached remote install that failed twice a day apart', async () => {
    insertServer('remote-docs', {
      install_kind: 'remote',
      install_package: 'https://docs.example.com/mcp',
      install_confidence: 'high',
      remote_endpoint_healthy: 0,
      remote_endpoint_checked_at: nowSec - 2 * DAY,
    });
    await run();
    expect(
      sqlite
        .prepare(
          "SELECT install_kind, install_package FROM servers WHERE id = 'remote-docs'",
        )
        .get(),
    ).toEqual({ install_kind: null, install_package: null });
  });
});

describe('health cron installs', () => {
  it('keeps a README-derived install when the README is unchanged', async () => {
    insertServer('readme-install', {
      install_extracted_at: null,
      install_kind: 'stdio',
      install_command: 'npx',
      install_package: '@acme/real-server',
      install_confidence: 'high',
    });
    sqlite
      .prepare(
        "INSERT INTO listing_signals (server_id, readme_hash, repo_gone_count) VALUES ('readme-install', 'oid-readme-install-new', 0)",
      )
      .run();
    await run();
    expect(
      sqlite
        .prepare(
          "SELECT install_package FROM servers WHERE id = 'readme-install'",
        )
        .get(),
    ).toEqual({ install_package: '@acme/real-server' });
  });
});
