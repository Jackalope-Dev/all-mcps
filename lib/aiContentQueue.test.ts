import { DatabaseSync } from 'node:sqlite';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { listingSignals, servers } from '@/db/schema';
import {
  CONTENT_STALE_MS,
  changedCandidates,
  claimInstallIds,
  countChanged,
  countNewBacklog,
  countStaleDue,
  hasDemand,
  installCandidateIds,
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
function d1Over(sqlite: DatabaseSync) {
  const queries: string[] = [];
  const shim = {
    prepare(query: string) {
      queries.push(query);
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
  return { db: drizzle(shim as never), queries };
}

function createServersTable(sqlite: DatabaseSync) {
  const serverCols = getTableConfig(servers).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${serverCols.join(', ')})`);
}

const sqlite = new DatabaseSync(':memory:');
const { db } = d1Over(sqlite);

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
  createServersTable(sqlite);
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
    const rows = await changedCandidates(db, new Date(), 10);
    expect(rows.map((r) => r.id)).toEqual(['changed']);
    expect(await countChanged(db)).toBe(1);
  });

  it('backs off a changed row whose refresh just failed', async () => {
    const now = new Date();
    sqlite
      .prepare(
        "UPDATE listing_signals SET content_refresh_failed_at = ? WHERE server_id = 'changed'",
      )
      .run(Math.floor(now.getTime() / 1000) - 3600);
    expect(await changedCandidates(db, now, 10)).toEqual([]);
    const dayLater = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    expect(
      (await changedCandidates(db, dayLater, 10)).map((r) => r.id),
    ).toEqual(['changed']);
    sqlite
      .prepare(
        "UPDATE listing_signals SET content_refresh_failed_at = NULL WHERE server_id = 'changed'",
      )
      .run();
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

describe('install claim', () => {
  // Own database: the install pass reads columns the queue fixtures leave
  // NULL, and enough rows to need several pages of the bounded walk.
  const installDb = new DatabaseSync(':memory:');
  const { db: idb, queries } = d1Over(installDb);
  const FILLER = 2500;
  const recheckBefore = new Date(NOW.getTime() - 7 * DAY * 1000);

  type InstallRow = {
    id: string;
    views?: number;
    copies?: number;
    status?: string;
    staleFlaggedAt?: number | null;
    aiEnrichedAt?: number | null;
    aiDoc?: string | null;
    installExtractedAt?: number | null;
    installPackage?: string | null;
    lastCommitAt?: number | null;
  };
  const insert = (r: InstallRow) =>
    installDb
      .prepare(
        `INSERT INTO servers (id, name, url, description, category, status, stale_flagged_at, ai_enriched_at, ai_doc, install_extracted_at, install_package, last_commit_at, views, copies, upvotes, created_at)
         VALUES (?, ?, 'https://github.com/x/y', 'd', 'c', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      )
      .run(
        r.id,
        r.id,
        r.status ?? 'active',
        r.staleFlaggedAt ?? null,
        r.aiEnrichedAt ?? null,
        r.aiDoc ?? null,
        r.installExtractedAt ?? null,
        r.installPackage ?? null,
        r.lastCommitAt ?? null,
        r.views ?? 0,
        r.copies ?? 0,
      );

  beforeAll(() => {
    createServersTable(installDb);
    installDb.exec(
      'CREATE INDEX idx_servers_status_popularity ON servers (status, views, copies, upvotes)',
    );
    // No engagement and inserted first: ties go newest-first (rowid desc),
    // so this sorts after every filler row, on a later page.
    insert({ id: 'cold', aiDoc: 'doc', aiEnrichedAt: nowSec });
    const done = { installExtractedAt: nowSec - DAY, aiDoc: 'doc' };
    // Already-checked rows, mostly tied at zero engagement, so the walk has
    // to page through ties by rowid.
    for (let i = 0; i < FILLER; i++) {
      insert({ id: `done-${i}`, views: i % 7 === 0 ? 3 : 0, ...done });
    }
    // Candidates, by demand: views, then copies.
    insert({ id: 'hot', views: 90, aiDoc: 'doc', aiEnrichedAt: nowSec });
    insert({ id: 'warm-copied', views: 5, copies: 4 });
    insert({ id: 'warm', views: 5, copies: 1 });
    // No install found 30 days ago, repo moved on since: re-check due.
    insert({
      id: 'recheck',
      views: 2,
      installExtractedAt: nowSec - 30 * DAY,
      lastCommitAt: nowSec - 2 * DAY,
    });
    // Never eligible.
    insert({ id: 'flagged', views: 999, staleFlaggedAt: nowSec });
    insert({ id: 'pending', views: 999, status: 'pending' });
    insert({ id: 'thin', views: 999, aiDoc: '' });
    insert({
      id: 'recheck-too-soon',
      views: 999,
      installExtractedAt: nowSec - 2 * DAY,
      lastCommitAt: nowSec - DAY,
    });
    insert({
      id: 'recheck-has-install',
      views: 999,
      installExtractedAt: nowSec - 30 * DAY,
      installPackage: 'pkg',
      lastCommitAt: nowSec - DAY,
    });
    insert({
      id: 'recheck-no-commit',
      views: 999,
      installExtractedAt: nowSec - 30 * DAY,
      lastCommitAt: nowSec - 60 * DAY,
    });
  });

  it('walks the catalog in bounded pages, most-used first', async () => {
    queries.length = 0;
    const ids = await installCandidateIds(
      idb,
      { installOnly: true, recheckBefore },
      24,
    );
    expect(ids).toEqual(['hot', 'warm-copied', 'warm', 'recheck', 'cold']);
    // 'cold' sits past the first page, so this took several statements,
    // each bounded by its LIMIT rather than scanning the whole table.
    expect(queries.length).toBeGreaterThan(1);
    for (const q of queries) expect(q).toMatch(/limit \?$/i);
  });

  it('stops walking once the batch is full', async () => {
    queries.length = 0;
    expect(
      await installCandidateIds(idb, { installOnly: true, recheckBefore }, 2),
    ).toEqual(['hot', 'warm-copied']);
    expect(queries).toHaveLength(1);
  });

  it('waits for a writeup on the regular pass', async () => {
    expect(
      await installCandidateIds(idb, { installOnly: false, recheckBefore }, 24),
    ).toEqual(['hot', 'cold']);
  });

  it('claims each row once, even when two runs pick the same ids', async () => {
    const pass = { installOnly: true, recheckBefore };
    const ids = await installCandidateIds(idb, pass, 3);
    const first = await claimInstallIds(idb, pass, NOW, ids);
    expect(first.map((r) => r.id)).toEqual(['hot', 'warm-copied', 'warm']);
    expect(first[0]).toMatchObject({ name: 'hot', url: expect.any(String) });
    // A run that picked the same ids before the first claim landed.
    expect(await claimInstallIds(idb, pass, NOW, ids)).toEqual([]);
    const next = await installCandidateIds(idb, pass, 3);
    expect(next).toEqual(['recheck', 'cold']);
    expect(
      (await claimInstallIds(idb, pass, NOW, next)).map((r) => r.id),
    ).toEqual(['recheck', 'cold']);
    expect(await installCandidateIds(idb, pass, 3)).toEqual([]);
  });
});
