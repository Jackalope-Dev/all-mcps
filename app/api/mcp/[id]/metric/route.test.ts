import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { servers, viewRecords } from '@/db/schema';

/**
 * View metric against real SQLite: every load bumps the public totalViews,
 * while the ranking `views` count relies on an upsert whose update only applies
 * once the 24h recount window has passed — a mock would match anything.
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

const { POST } = await import('./route');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function view(ip: string, ua = BROWSER_UA) {
  return POST(
    new Request('https://allmcps.test/api/mcp/srv/metric', {
      method: 'POST',
      headers: { 'cf-connecting-ip': ip, 'user-agent': ua },
      body: JSON.stringify({ metric: 'view' }),
    }),
    { params: Promise.resolve({ id: 'srv' }) },
  );
}

function counts() {
  return sqlite
    .prepare('SELECT views, total_views AS totalViews FROM servers')
    .get() as { views: number; totalViews: number };
}

const HOUR = 60 * 60 * 1000;
const prevSecret = process.env.UPVOTE_HASH_SECRET;

beforeAll(() => {
  process.env.UPVOTE_HASH_SECRET = 'test-pepper';
  const cols = (table: typeof servers | typeof viewRecords) =>
    getTableConfig(table)
      .columns.map((c) => c.name)
      .join(', ');
  sqlite.exec(`CREATE TABLE servers (${cols(servers)})`);
  sqlite.exec(
    `CREATE TABLE view_records (${cols(viewRecords)}, PRIMARY KEY (server_id, ip_hash))`,
  );
  sqlite.exec(
    "INSERT INTO servers (id, name, views, total_views) VALUES ('srv', 'Server', 0, 0)",
  );
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
  process.env.UPVOTE_HASH_SECRET = prevSecret;
});

describe('POST view metric', () => {
  it('counts every load publicly but one per IP per 24h for ranking', async () => {
    expect(await (await view('1.1.1.1')).json()).toMatchObject({
      counted: true,
    });
    expect(await (await view('1.1.1.1')).json()).toMatchObject({
      counted: false,
    });
    await view('2.2.2.2');
    expect(counts()).toEqual({ views: 2, totalViews: 3 });

    vi.setSystemTime(new Date(Date.now() + 23 * HOUR));
    await view('1.1.1.1');
    expect(counts()).toEqual({ views: 2, totalViews: 4 });

    vi.setSystemTime(new Date(Date.now() + 2 * HOUR));
    expect(await (await view('1.1.1.1')).json()).toMatchObject({
      counted: true,
    });
    expect(counts()).toEqual({ views: 3, totalViews: 5 });
  });

  it('recounts gate rows from before the window existed', async () => {
    sqlite.exec('UPDATE view_records SET last_counted_at = NULL');
    const before = counts();
    await view('1.1.1.1');
    expect(counts()).toEqual({
      views: before.views + 1,
      totalViews: before.totalViews + 1,
    });
  });

  it('skips bots entirely', async () => {
    const before = counts();
    await view('3.3.3.3', 'Googlebot/2.1 (+http://www.google.com/bot.html)');
    expect(counts()).toEqual(before);
  });
});
