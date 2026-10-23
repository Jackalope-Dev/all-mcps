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
 * Network-only (no LLM), so it runs on the fast tick in small batches.
 */

const CURSOR = 'endpoint-discovery:v1';
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

    const [cursorRow] = await db
      .select({ value: jobCursors.value })
      .from(jobCursors)
      .where(eq(jobCursors.name, CURSOR));
    const after = Number(cursorRow?.value) || 0;

    const rows = (await db
      .select({
        rowid: sql<number>`rowid`,
        id: servers.id,
        url: servers.url,
        websiteUrl: servers.websiteUrl,
        description: servers.description,
      })
      .from(servers)
      .where(and(due, gt(sql`rowid`, after)))
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
    if (cursor !== after) {
      const now = new Date();
      await db
        .insert(jobCursors)
        .values({ name: CURSOR, value: String(cursor), updatedAt: now })
        .onConflictDoUpdate({
          target: jobCursors.name,
          set: { value: String(cursor), updatedAt: now },
        });
    }

    const [left] = await db
      .select({ n: sql<number>`count(*)` })
      .from(servers)
      .where(and(due, gt(sql`rowid`, cursor)));
    const remaining = Number(left?.n ?? 0);

    return NextResponse.json({
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
