import { DatabaseSync } from 'node:sqlite';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { listingSignals, servers } from '@/db/schema';
import {
  CONTENT_STALE_MS,
  changedCandidates,
  countChanged,
  countNewBacklog,
  countStaleDue,
  hasDemand,
  isHeldFromEnrichment,
  LOW_DEMAND_STALE_MS,
  needsChangeRefresh,
  newCandidateIds,
  staleAfterMs,
  staleCandidates,
} from './aiContentQueue';

describe('queue rules', () => {
  it('counts any use or traction as demand', () => {
    expect(hasDemand({})).toBe(false);
    expect(hasDemand({ views: 1 })).toBe(true);
    expect(hasDemand({ githubStars: 9 })).toBe(false);
    expect(hasDemand({ githubStars: 10 })).toBe(true);
    expect(hasDemand({ npmDownloads: 100 })).toBe(true);
  });

  it('lets quiet listings wait twice as long', () => {
    expect(staleAfterMs({ views: 3 })).toBe(CONTENT_STALE_MS);
    expect(staleAfterMs({ githubStars: 2 })).toBe(LOW_DEMAND_STALE_MS);
  });

  it('holds unmodified forks without traction only', () => {
    expect(isHeldFromEnrichment({ repoForkOf: 'a/b', githubStars: 3 })).toBe(
      true,
    );
    expect(isHeldFromEnrichment({ repoForkOf: 'a/b', githubStars: 40 })).toBe(
      false,
    );
    expect(isHeldFromEnrichment({ repoForkOf: null, githubStars: 0 })).toBe(
      false,
    );
  });

  it('refreshes only when the source changed after the writeup', () => {
    const t = new Date('2026-10-01T00:00:00Z');
    const later = new Date('2026-10-05T00:00:00Z');
    expect(
      needsChangeRefresh({ aiEnrichedAt: t, contentChangedAt: later }),
    ).toBe(true);
    expect(
      needsChangeRefresh({ aiEnrichedAt: later, contentChangedAt: t }),
    ).toBe(false);
    expect(
      needsChangeRefresh({ aiEnrichedAt: null, contentChangedAt: t }),
    ).toBe(false);
  });
});

/**
 * The claim queries run against a real SQLite engine (node:sqlite) behind a
 * minimal D1 shim, so a query D1 would reject — or a join that silently drops
 * rows — fails here rather than in the cron.
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
const db = drizzle(d1Shim as never);

const NOW = new Date('2026-10-14T00:00:00Z');
const DAY = 24 * 60 * 60;
const nowSec = Math.floor(NOW.getTime() / 1000);

type Row = {
  id: string;
  status?: string;
  staleFlaggedAt?: number | null;
  aiEnrichedAt?: number | null;
  aiDoc?: string | null;
  aiSummary?: string | null;
  views?: number;
  githubStars?: number | null;
  repoForkOf?: string | null;
  contentChangedAt?: number | null;
};

const ROWS: Row[] = [
  // Never enriched, popular, popularity order: hot > warm.
  { id: 'new-hot', views: 50 },
  { id: 'new-warm', views: 5 },
  // Never enriched but flagged or not active — never claimed.
  { id: 'new-flagged', views: 999, staleFlaggedAt: nowSec - DAY },
  { id: 'new-pending', views: 999, status: 'pending' },
  // Unmodified fork without traction — held. With traction — kept.
  { id: 'fork-quiet', views: 80, githubStars: 2, repoForkOf: 'up/stream' },
  { id: 'fork-popular', views: 1, githubStars: 50, repoForkOf: 'up/stream' },
  // Enriched, then the source changed.
  {
    id: 'changed',
    aiEnrichedAt: nowSec - 10 * DAY,
    aiDoc: 'doc',
    aiSummary: 's',
    contentChangedAt: nowSec - 2 * DAY,
  },
  // Enriched after its last change — not due.
  {
    id: 'changed-already-refreshed',
    aiEnrichedAt: nowSec - DAY,
    aiDoc: 'doc',
    aiSummary: 's',
    contentChangedAt: nowSec - 2 * DAY,
  },
  // 100 days old: due with demand, not without.
  {
    id: 'stale-used',
    aiEnrichedAt: nowSec - 100 * DAY,
    aiDoc: 'doc',
    aiSummary: 's',
    views: 3,
  },
  {
    id: 'stale-quiet-100d',
    aiEnrichedAt: nowSec - 100 * DAY,
    aiDoc: 'doc',
    aiSummary: 's',
  },
  {
    id: 'stale-quiet-200d',
    aiEnrichedAt: nowSec - 200 * DAY,
    aiDoc: 'doc',
    aiSummary: 's',
  },
];

beforeAll(() => {
  const serverCols = getTableConfig(servers).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${serverCols.join(', ')})`);
  const signalCols = getTableConfig(listingSignals).columns.map((c) =>
    c.name === 'server_id' ? 'server_id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE listing_signals (${signalCols.join(', ')})`);
  const insertServer = sqlite.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, stale_flagged_at, ai_enriched_at, ai_doc, ai_summary, views, copies, upvotes, github_stars, created_at)
     VALUES (?, ?, 'https://github.com/x/y', 'd', '💻 Developer Tools', ?, ?, ?, ?, ?, ?, 0, 0, ?, 0)`,
  );
  const insertSignal = sqlite.prepare(
    `INSERT INTO listing_signals (server_id, repo_fork_of, content_changed_at, repo_gone_count) VALUES (?, ?, ?, 0)`,
  );
  for (const r of ROWS) {
    insertServer.run(
      r.id,
      r.id,
      r.status ?? 'active',
      r.staleFlaggedAt ?? null,
      r.aiEnrichedAt ?? null,
      r.aiDoc ?? null,
      r.aiSummary ?? null,
      r.views ?? 0,
      r.githubStars ?? null,
    );
    if (r.repoForkOf || r.contentChangedAt) {
      insertSignal.run(r.id, r.repoForkOf ?? null, r.contentChangedAt ?? null);
    }
  }
});

describe('claim queries', () => {
  it('claims changed writeups first', async () => {
    const rows = await changedCandidates(db, 10);
    expect(rows.map((r) => r.id)).toEqual(['changed']);
    expect(await countChanged(db)).toBe(1);
  });

  it('claims never-enriched servable rows by demand, holding quiet forks', async () => {
    const rows = await newCandidateIds(db, 10);
    expect(rows.map((r) => r.id)).toEqual([
      'new-hot',
      'new-warm',
      'fork-popular',
    ]);
    expect(await countNewBacklog(db)).toBe(3);
  });

  it('re-checks used writeups at 90 days and quiet ones at 180', async () => {
    const rows = await staleCandidates(db, NOW, 10);
    expect(rows.map((r) => r.id).sort()).toEqual([
      'stale-quiet-200d',
      'stale-used',
    ]);
    expect(await countStaleDue(db, NOW)).toBe(2);
  });

  // Runs last: it claims a row. Same statement shape as the cron's atomic
  // claim (UPDATE … WHERE id IN (joined subquery) RETURNING).
  it('claims atomically through the joined subquery', async () => {
    const claimed = await db
      .update(servers)
      .set({ aiEnrichedAt: NOW })
      .where(inArray(servers.id, newCandidateIds(db, 1)))
      .returning({ id: servers.id });
    expect(claimed.map((r) => r.id)).toEqual(['new-hot']);
    expect((await newCandidateIds(db, 10)).map((r) => r.id)).not.toContain(
      'new-hot',
    );
  });
});
