import { DatabaseSync } from 'node:sqlite';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoDecisions,
  listingSignals,
  moderationDecisions,
  servers,
} from '@/db/schema';

const sent = vi.hoisted(() => [] as { canResubmit?: boolean; to: string }[]);
vi.mock('./notify', () => ({
  sendListingStatusEmail: async (p: { canResubmit?: boolean; to: string }) => {
    sent.push(p);
  },
}));
vi.mock('./listingApprovalNotify', () => ({ notifyListingApproved: vi.fn() }));
vi.mock('./indexnow', () => ({ notifyListingIndexed: vi.fn() }));

const { rejectPendingListing, MAX_SUBMISSION_REJECTIONS } = await import(
  './listingApproval'
);
const { expireRejectedSubmissions, getMySubmissions, resubmitSubmission } =
  await import('./submissions');

/**
 * The reject → edit → resubmit loop against a real SQLite engine, through
 * drizzle's proxy driver so the production queries run unchanged.
 */
function createDb() {
  const raw = new DatabaseSync(':memory:');
  for (const t of [
    servers,
    moderationDecisions,
    listingSignals,
    autoDecisions,
  ]) {
    const cfg = getTableConfig(t as SQLiteTable);
    const cols = cfg.columns.map((c) =>
      c.primary
        ? c.name === 'id' && c.getSQLType() === 'integer'
          ? 'id INTEGER PRIMARY KEY AUTOINCREMENT'
          : `${c.name} TEXT PRIMARY KEY`
        : c.name,
    );
    raw.exec(`CREATE TABLE ${cfg.name} (${cols.join(', ')})`);
  }
  const db = drizzle(async (sql, params, method) => {
    const stmt = raw.prepare(sql);
    if (method === 'run') {
      stmt.run(...(params as never[]));
      return { rows: [] };
    }
    stmt.setReturnArrays(true);
    const rows = stmt.all(...(params as never[])) as unknown as unknown[][];
    return { rows: method === 'get' ? (rows[0] ?? []) : rows };
  });
  return { raw, db: db as any };
}

let raw: DatabaseSync;
let db: any;

function addPending(id: string, email: string | null = 'dev@acme.dev') {
  raw
    .prepare(
      `INSERT INTO servers (id, name, url, description, category, submitter_email, status, created_at, review_flagged, review_priority, is_premium, premium_status)
       VALUES (?, ?, ?, ?, 'Developer Tools', ?, 'pending', 1, 0, 0, 0, 'free')`,
    )
    .run(
      id,
      `Acme ${id}`,
      `https://github.com/acme/${id}`,
      'An MCP server for Acme things.',
      email,
    );
}

const status = (id: string) =>
  (
    raw.prepare('SELECT status FROM servers WHERE id = ?').get(id) as
      | { status: string }
      | undefined
  )?.status;

beforeEach(() => {
  ({ raw, db } = createDb());
  sent.length = 0;
});

describe('rejectPendingListing', () => {
  it('keeps a fixable rejection for the submitter to edit', async () => {
    addPending('a');
    const r = await rejectPendingListing(db, 'a', {
      reasons: ['incomplete'],
      source: 'modal',
      decidedBy: 'admin@x',
    });
    expect(r?.kept).toBe(true);
    expect(status('a')).toBe('rejected');
    expect(sent[0]).toMatchObject({ to: 'dev@acme.dev', canResubmit: true });
    const log = raw
      .prepare('SELECT reasons, feedback FROM moderation_decisions')
      .get() as { reasons: string; feedback: string };
    expect(JSON.parse(log.reasons)).toEqual(['incomplete']);
    expect(log.feedback).toMatch(/missing or didn't match/);
  });

  it('deletes a rejection no edit can fix', async () => {
    addPending('b');
    const r = await rejectPendingListing(db, 'b', {
      reasons: ['spam'],
      source: 'modal',
      decidedBy: null,
    });
    expect(r?.kept).toBe(false);
    expect(status('b')).toBeUndefined();
    expect(sent[0].canResubmit).toBe(false);
  });

  it('deletes an imported listing, which nobody can edit', async () => {
    addPending('c', null);
    const r = await rejectPendingListing(db, 'c', {
      reasons: ['broken'],
      source: 'gate',
      decidedBy: null,
    });
    expect(r?.kept).toBe(false);
    expect(status('c')).toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});

describe('resubmitting', () => {
  const fields = {
    name: 'Acme MCP',
    description: 'Search Acme tickets and create new ones from your AI client.',
    url: 'https://github.com/acme/acme-mcp',
  };

  it('lets the submitter edit and send it back, and nobody else', async () => {
    addPending('d');
    await rejectPendingListing(db, 'd', {
      reasons: ['incomplete'],
      source: 'modal',
      decidedBy: null,
    });

    const mine = await getMySubmissions(db, 'DEV@acme.dev');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      status: 'rejected',
      canResubmit: true,
      reasons: ['Missing or misleading details'],
    });

    expect(
      (await resubmitSubmission(db, 'someone@else.dev', 'd', fields)).ok,
    ).toBe(false);
    const r = await resubmitSubmission(db, 'dev@acme.dev', 'd', fields);
    expect(r.ok).toBe(true);
    expect(status('d')).toBe('pending');
    expect(
      raw.prepare('SELECT name FROM servers WHERE id = ?').get('d'),
    ).toEqual({ name: 'Acme MCP' });
  });

  it('rejects unsafe URLs and a short description', async () => {
    addPending('e');
    await rejectPendingListing(db, 'e', {
      reasons: ['incomplete'],
      source: 'modal',
      decidedBy: null,
    });
    expect(
      await resubmitSubmission(db, 'dev@acme.dev', 'e', {
        ...fields,
        url: 'http://127.0.0.1/mcp',
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await resubmitSubmission(db, 'dev@acme.dev', 'e', {
        ...fields,
        description: 'too short',
      }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it(`deletes on the ${MAX_SUBMISSION_REJECTIONS}rd rejection instead of looping`, async () => {
    addPending('f');
    for (let i = 1; i <= MAX_SUBMISSION_REJECTIONS; i++) {
      const r = await rejectPendingListing(db, 'f', {
        reasons: ['incomplete'],
        source: 'modal',
        decidedBy: null,
      });
      expect(r?.kept).toBe(i < MAX_SUBMISSION_REJECTIONS);
      if (r?.kept)
        await resubmitSubmission(db, 'dev@acme.dev', 'f', {
          ...fields,
          url: `https://github.com/acme/acme-mcp-${i}`,
        });
    }
    expect(status('f')).toBeUndefined();
    expect(sent.at(-1)?.canResubmit).toBe(false);
  });
});

describe('expireRejectedSubmissions', () => {
  it('deletes rejected rows untouched for 90 days, keeping the log', async () => {
    addPending('g');
    await rejectPendingListing(db, 'g', {
      reasons: ['incomplete'],
      source: 'modal',
      decidedBy: null,
    });
    expect(await expireRejectedSubmissions(db)).toBe(0);
    const later = new Date(Date.now() + 91 * 86_400_000);
    expect(await expireRejectedSubmissions(db, later)).toBe(1);
    expect(status('g')).toBeUndefined();
    expect(
      raw.prepare('SELECT count(*) n FROM moderation_decisions').get(),
    ).toEqual({ n: 1 });
  });
});
