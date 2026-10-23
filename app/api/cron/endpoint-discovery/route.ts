import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { jobCursors, servers } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { discoverRemoteEndpoint } from '../../../../lib/tools/discoverRemoteEndpoint';

/**
 * Walks the catalog once and fills in the hosted MCP endpoint and auth type for
 * listings that have neither (lib/tools/discoverRemoteEndpoint.ts). New
 * submissions get the same discovery at intake; this covers everything listed
 * before it existed, and rows added later as the rowid cursor reaches them.
 *
 * Skips listings with a confirmed stdio install: they already have a working
 * command, and a guessed hosted endpoint beside it is all risk. Only ever
 * fills empty columns, so an owner's own endpoint or auth type always wins.
 *
 * Two rowid cursors, like tag-classify: pending listings first, so Jev's
 * triage and the automation gates see the endpoint before a decision, then
 * the whole catalog. The catalog walk restarts REWALK_MS after it drains, so
 * a server that ships its endpoint after we last looked is still found.
 *
 * Network-only (no LLM), so it runs on the fast tick in small batches.
 */

const PHASES = ['pending', 'all'] as const;
type Phase = (typeof PHASES)[number];
const cursorName = (phase: Phase) => `endpoint-discovery:v1:${phase}`;
const REWALK_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 30;
const MAX_BATCH_SIZE = 100;
const CONCURRENCY = 6;
const SAMPLE_ROWS = 20;

type Row = {
  rowid: number;
  id: string;
  url: string;
  websiteUrl: string | null;
  description: string | null;
};

const due = and(
  inArray(servers.status, ['active', 'pending']),
  isNull(servers.staleFlaggedAt),
  isNull(servers.remoteEndpointUrl),
  or(
    isNull(servers.installKind),
    sql`${servers.installKind} != 'stdio'`,
    eq(servers.installConfidence, 'low'),
  ),
  or(
    sql`${servers.url} NOT LIKE '%github.com/%'`,
    sql`${servers.websiteUrl} IS NOT NULL AND ${servers.websiteUrl} != ''`,
  ),
);

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext({ async: true });
    if (!(env as any)?.DB) throw new Error('Database binding not found');
    const db = drizzle((env as any).DB);

    const requested = Number(
      new URL(req.url).searchParams.get('batchSize') ?? '',
    );
    const batchSize =
      Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MAX_BATCH_SIZE)
        : DEFAULT_BATCH_SIZE;

    const now = new Date();
    const cursorRows = await db
      .select({
        name: jobCursors.name,
        value: jobCursors.value,
        updatedAt: jobCursors.updatedAt,
      })
      .from(jobCursors)
      .where(inArray(jobCursors.name, PHASES.map(cursorName)));
    const cursors = new Map(
      cursorRows.map((r) => [
        r.name,
        { value: Number(r.value) || 0, updatedAt: r.updatedAt },
      ]),
    );
    const phaseWhere = (phase: Phase) =>
      phase === 'pending' ? and(due, eq(servers.status, 'pending')) : due;
    const remainingIn = async (phase: Phase) => {
      const after = cursors.get(cursorName(phase))?.value ?? 0;
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(servers)
        .where(and(phaseWhere(phase), gt(sql`rowid`, after)));
      return Number(r?.n ?? 0);
    };

    // A drained catalog walk starts over once it is REWALK_MS old.
    const all = cursors.get(cursorName('all'));
    if (
      all &&
      all.value > 0 &&
      all.updatedAt &&
      now.getTime() - all.updatedAt.getTime() > REWALK_MS &&
      (await remainingIn('all')) === 0
    ) {
      all.value = 0;
    }

    let phase: Phase = 'all';
    for (const p of PHASES) {
      if ((await remainingIn(p)) > 0) {
        phase = p;
        break;
      }
    }
    const after = cursors.get(cursorName(phase))?.value ?? 0;

    const rows = (await db
      .select({
        rowid: sql<number>`rowid`,
        id: servers.id,
        url: servers.url,
        websiteUrl: servers.websiteUrl,
        description: servers.description,
      })
      .from(servers)
      .where(and(phaseWhere(phase), gt(sql`rowid`, after)))
      .orderBy(asc(sql`rowid`))
      .limit(batchSize)) as Row[];

    let found = 0;
    const samples: { id: string; url: string; authType: string | null }[] = [];

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const wave = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        wave.map((row) => discoverRemoteEndpoint(row)),
      );
      for (let k = 0; k < wave.length; k++) {
        const hit = results[k];
        if (!hit) continue;
        await db
          .update(servers)
          .set({
            remoteEndpointUrl: hit.url,
            remoteEndpointHealthy: true,
            remoteEndpointCheckedAt: now,
            authType: sql`COALESCE(${servers.authType}, ${hit.authType})`,
          })
          .where(
            and(eq(servers.id, wave[k].id), isNull(servers.remoteEndpointUrl)),
          );
        found++;
        if (samples.length < SAMPLE_ROWS) {
          samples.push({
            id: wave[k].id,
            url: hit.url,
            authType: hit.authType,
          });
        }
      }
    }

    // Every row in the batch was asked, hit or not; a miss is retried only if
    // the cursor is versioned and restarted.
    const cursor = rows.length ? rows[rows.length - 1].rowid : after;
    const stored = cursorRows.find((r) => r.name === cursorName(phase));
    if (cursor !== Number(stored?.value ?? 0)) {
      await db
        .insert(jobCursors)
        .values({
          name: cursorName(phase),
          value: String(cursor),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: jobCursors.name,
          set: { value: String(cursor), updatedAt: now },
        });
      cursors.set(cursorName(phase), { value: cursor, updatedAt: now });
    }

    let remaining = 0;
    for (const p of PHASES) remaining += await remainingIn(p);

    return NextResponse.json({
      phase,
      processed: rows.length,
      found,
      remaining,
      drained: remaining === 0,
      samples,
    });
  } catch (e: any) {
    console.error('[endpoint-discovery] failed:', e);
    return NextResponse.json(
      { error: e?.message || 'endpoint-discovery failed' },
      { status: 500 },
    );
  }
}
