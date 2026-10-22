import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { jobCursors, servers } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { indexableListingSql } from '../../../../lib/listingIndexability';
import { classifyTags } from '../../../../lib/tagClassifier';

/**
 * Re-tags the catalog from the fixed vocabulary (lib/tagVocabulary.ts) with
 * Jev (lib/tagClassifier.ts). New listings are tagged by /api/cron/ai-content
 * when their writeup is generated; this walks the existing catalog once.
 *
 * Two phases, each a rowid cursor in job_cursors so a run cut short resumes
 * where it stopped: indexable listings first (they make or break which tag
 * pages search engines get), then every servable listing. Rowids only grow,
 * so the 'all' phase also picks up any listing added since. No OpenAI — Jev
 * only — so it is cheap enough for the fast cron tick.
 *
 * Response matches the backfill workflow's counters: `processed`, `enriched`
 * (listings whose tags changed), `remaining`, `budgetStopped` (Jev unavailable).
 */

const DEFAULT_BATCH_SIZE = 60;
const MAX_BATCH_SIZE = 200;
const CONCURRENCY = 8;

const PHASES = ['indexable', 'all'] as const;
type Phase = (typeof PHASES)[number];
const cursorName = (phase: Phase) => `tag-classify:${phase}`;

type Row = {
  rowid: number;
  id: string;
  name: string;
  description: string | null;
  url: string;
  aiSummary: string | null;
  aiOverview: string | null;
  tools: string | null;
  installKind: string | null;
  installCommand: string | null;
  remoteEndpointUrl: string | null;
  tags: string | null;
};

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

    const cursors = new Map<string, number>(
      (
        await db
          .select({ name: jobCursors.name, value: jobCursors.value })
          .from(jobCursors)
          .where(
            sql`${jobCursors.name} IN (${cursorName('indexable')}, ${cursorName('all')})`,
          )
      ).map((r) => [r.name, Number(r.value) || 0]),
    );

    const servable = and(
      eq(servers.status, 'active'),
      isNull(servers.staleFlaggedAt),
    );
    const phaseFilter = (phase: Phase) =>
      phase === 'indexable' ? and(servable, indexableListingSql()) : servable;
    const remainingIn = async (phase: Phase) => {
      const after = cursors.get(cursorName(phase)) ?? 0;
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(servers)
        .where(and(phaseFilter(phase), gt(sql`rowid`, after)));
      return Number(r?.n ?? 0);
    };

    // The first phase with work left.
    let phase: Phase = 'all';
    for (const p of PHASES) {
      if ((await remainingIn(p)) > 0) {
        phase = p;
        break;
      }
    }
    const after = cursors.get(cursorName(phase)) ?? 0;

    const rows = (await db
      .select({
        rowid: sql<number>`rowid`,
        id: servers.id,
        name: servers.name,
        description: servers.description,
        url: servers.url,
        aiSummary: servers.aiSummary,
        aiOverview: servers.aiOverview,
        tools: servers.tools,
        installKind: servers.installKind,
        installCommand: servers.installCommand,
        remoteEndpointUrl: servers.remoteEndpointUrl,
        tags: servers.tags,
      })
      .from(servers)
      .where(and(phaseFilter(phase), gt(sql`rowid`, after)))
      .orderBy(asc(sql`rowid`))
      .limit(batchSize)) as Row[];

    let processed = 0;
    let changed = 0;
    let budgetStopped = false;
    let cursor = after;

    // Waves in rowid order; the cursor only moves past rows actually done, so
    // a Jev outage mid-batch resumes from the first row it couldn't tag.
    for (let i = 0; i < rows.length && !budgetStopped; i += CONCURRENCY) {
      const wave = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.all(wave.map((row) => classifyTags(row)));
      for (let k = 0; k < wave.length; k++) {
        const tags = results[k];
        if (tags === null) {
          budgetStopped = true;
          break;
        }
        const row = wave[k];
        const next = JSON.stringify(tags);
        if (next !== (row.tags ?? '')) {
          await db
            .update(servers)
            .set({ tags: next })
            .where(eq(servers.id, row.id));
          changed++;
        }
        processed++;
        cursor = row.rowid;
      }
    }

    if (cursor !== after) {
      const now = new Date();
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
      cursors.set(cursorName(phase), cursor);
    }

    let remaining = 0;
    for (const p of PHASES) remaining += await remainingIn(p);

    return NextResponse.json({
      phase,
      processed,
      enriched: changed,
      remaining,
      budgetStopped,
      drained: remaining === 0,
    });
  } catch (e: any) {
    console.error('[tag-classify] failed:', e);
    return NextResponse.json(
      { error: e?.message || 'tag-classify failed' },
      { status: 500 },
    );
  }
}
