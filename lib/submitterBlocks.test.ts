import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servers } from '@/db/schema';
import {
  blockSubmitter,
  hashSubmitterIp,
  isSubmitterBlocked,
  MAX_LISTINGS_PER_HOUR,
  overHourlyListingCap,
  requestIp,
  SUBMIT_RATE_ERROR,
  screenStatus,
  screenSubmitter,
} from './submitterBlocks';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('requestIp', () => {
  it("prefers Cloudflare's header", () => {
    const req = new Request('https://brainscanner.dev', {
      headers: {
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.1',
      },
    });
    expect(requestIp(req)).toBe('203.0.113.7');
  });

  it('is null with no client header, so one block never catches everyone', () => {
    expect(requestIp(new Request('https://brainscanner.dev'))).toBeNull();
  });
});

describe('hashSubmitterIp', () => {
  it('is stable per IP, differs across IPs, and never returns the IP', async () => {
    vi.stubEnv('UPVOTE_HASH_SECRET', 'pepper');
    const a = await hashSubmitterIp('203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashSubmitterIp('203.0.113.7')).toBe(a);
    expect(await hashSubmitterIp('203.0.113.8')).not.toBe(a);
  });

  it('is null with no IP or no pepper', async () => {
    vi.stubEnv('UPVOTE_HASH_SECRET', 'pepper');
    expect(await hashSubmitterIp(null)).toBeNull();
    expect(await hashSubmitterIp('unknown')).toBeNull();
    vi.stubEnv('UPVOTE_HASH_SECRET', '');
    expect(await hashSubmitterIp('203.0.113.7')).toBeNull();
  });
});

/** node:sqlite behind a minimal D1 shim (same as lib/aiContentQueue.test.ts). */
function d1Over(sqlite: DatabaseSync) {
  const shim = {
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
  return drizzle(shim as never);
}

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  const cols = getTableConfig(servers).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  // The real DDL, so the unique index that onConflictDoNothing relies on is there.
  const migration = readFileSync(
    new URL('../drizzle/0074_submitter_blocks.sql', import.meta.url),
    'utf8',
  )
    .split('--> statement-breakpoint')
    .filter((s) => !/ALTER TABLE/.test(s));
  for (const stmt of migration) sqlite.exec(stmt);
  const insert = sqlite.prepare(
    'INSERT INTO servers (id, name, url, description, category, status, submitter_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
  );
  const insertIp = sqlite.prepare(
    'INSERT INTO submission_ips (server_id, ip_hash, created_at) VALUES (?, ?, 0)',
  );
  const add = (
    id: string,
    status: string,
    email: string | null,
    ip: string | null,
  ) => {
    insert.run(
      id,
      id,
      `https://brainscanner.dev/${id}`,
      'd',
      'Other',
      status,
      email,
    );
    if (ip) insertIp.run(id, ip);
  };
  add('spam-1', 'pending', 'bot@spam-farm.dev', 'iphash-a');
  add('spam-2', 'pending', 'bot@spam-farm.dev', null);
  add('spam-3', 'pending', 'other@elsewhere.dev', 'iphash-a');
  add('innocent', 'pending', 'dev@brainscanner.dev', 'iphash-b');
  add('spam-live', 'active', 'bot@spam-farm.dev', 'iphash-a');
  add('gmail-spam', 'pending', 'spammer@gmail.com', null);
  return { sqlite, db: d1Over(sqlite) };
}

describe('blockSubmitter + isSubmitterBlocked', () => {
  it('blocks email, domain and IP, and rejects only their pending listings', async () => {
    const { sqlite, db } = setup();
    const out = await blockSubmitter(db, {
      serverId: 'spam-1',
      blockDomain: true,
      reason: 'test',
      admin: 'admin@brainscanner.dev',
    });
    expect(out).toEqual({
      blocked: ['email:bot@spam-farm.dev', 'domain:spam-farm.dev', 'ip'],
      rejected: 3,
    });
    const status = (id: string) =>
      (
        sqlite.prepare('SELECT status FROM servers WHERE id = ?').get(id) as {
          status: string;
        }
      ).status;
    expect(status('spam-2')).toBe('rejected'); // same email
    expect(status('spam-3')).toBe('rejected'); // same IP
    expect(status('innocent')).toBe('pending');
    expect(status('spam-live')).toBe('active'); // live listings are left for a human

    expect(await isSubmitterBlocked(db, { email: 'BOT@spam-farm.dev' })).toBe(
      true,
    );
    expect(
      await isSubmitterBlocked(db, { email: 'new@mx.spam-farm.dev' }),
    ).toBe(true);
    expect(
      await isSubmitterBlocked(db, {
        email: 'x@brainscanner.dev',
        ipHash: 'iphash-a',
      }),
    ).toBe(true);
    expect(
      await isSubmitterBlocked(db, {
        email: 'dev@brainscanner.dev',
        ipHash: 'iphash-b',
      }),
    ).toBe(false);

    // A second block of the same submitter is a no-op, not a unique-index error.
    await expect(
      blockSubmitter(db, {
        serverId: 'spam-1',
        blockDomain: true,
        reason: '',
        admin: 'a',
      }),
    ).resolves.toMatchObject({ rejected: 0 });
  });

  it('never blocks a webmail domain, only the address', async () => {
    const { db } = setup();
    const out = await blockSubmitter(db, {
      serverId: 'gmail-spam',
      blockDomain: true,
      reason: '',
      admin: 'a',
    });
    expect(out).toMatchObject({ blocked: ['email:spammer@gmail.com'] });
    expect(await isSubmitterBlocked(db, { email: 'friend@gmail.com' })).toBe(
      false,
    );
  });
});

describe('rate limits', () => {
  it('refuses with 429 when the Cloudflare limiter says no, and fails open without one', async () => {
    const { db } = setup();
    const denied = {
      SUBMIT_LIMITER: { limit: async () => ({ success: false }) },
    };
    const broken = {
      SUBMIT_LIMITER: {
        limit: async () => {
          throw new Error('down');
        },
      },
    };
    // DNS unreachable: the email check fails open, so only the limiter can refuse.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const who = { email: 'bot@spam-farm.dev', ipHash: 'iphash-z' };
    const err = await screenSubmitter(db, who, denied);
    expect(err).toBe(SUBMIT_RATE_ERROR);
    expect(screenStatus(err as string)).toBe(429);
    // A limiter error or a missing binding lets the request through.
    expect(await screenSubmitter(db, who, broken)).toBeNull();
    expect(await screenSubmitter(db, who)).toBeNull();
  });

  it('caps listings per IP hash per hour across isolates', async () => {
    const { sqlite, db } = setup();
    const now = Date.now();
    const ins = sqlite.prepare(
      'INSERT INTO submission_ips (server_id, ip_hash, created_at) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < MAX_LISTINGS_PER_HOUR - 1; i++) {
      ins.run(`recent-${i}`, 'iphash-burst', Math.floor(now / 1000) - 60);
    }
    ins.run('old', 'iphash-burst', Math.floor(now / 1000) - 7200);
    expect(await overHourlyListingCap(db, 'iphash-burst', now)).toBe(false);
    ins.run('one-more', 'iphash-burst', Math.floor(now / 1000) - 10);
    expect(await overHourlyListingCap(db, 'iphash-burst', now)).toBe(true);
    expect(await overHourlyListingCap(db, null, now)).toBe(false);
  });
});
