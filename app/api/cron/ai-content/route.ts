import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { fetchGithubReadme, parseGithubUrl } from '../../../../lib/listingEnrich';
import { getGithubToken } from '../../../../lib/githubAuth';
import { cleanListingDescription } from '../../../../lib/description';
import { parseServerTools } from '../../../../lib/servers';
import { generateListingContent } from '../../../../lib/aiContent';

/**
 * AI content pass — writes the unique per-listing content layer (summary, overview,
 * use cases, features) that turns scraped README-mirror pages into original content.
 *
 * Kept separate from /api/cron/enrich on purpose: that pass is GitHub-bound and heavy,
 * and adding an LLM call per item to it risks Worker CPU/subrequest limits.
 *
 * No wasted compute, even with the 4h cron and a manual backfill (see
 * scripts/backfill-ai-content.mjs / the "Backfill AI Content" workflow) running at once:
 *  - Each run ATOMICALLY CLAIMS its batch in a single UPDATE…RETURNING that stamps
 *    ai_enriched_at. Because SQLite/D1 serializes writers, a concurrent run's claim sees
 *    those rows as already taken and picks different ones — so no listing is ever
 *    generated twice.
 *  - Claims are released (ai_enriched_at reset to NULL) for any listing that failed or
 *    that we didn't reach, so a transient error or a mid-batch spend-cap stop never
 *    permanently marks a row as "done" with no content.
 *
 * Spend-cap aware: the moment a generation reports 'budget' (429/402/quota/auth/no key),
 * the run stops — every further call would fail the same way — and releases the rest of
 * the claim. (A 429 charges no tokens, but there's no point burning calls or latency.)
 *
 * Auth: ADMIN_SECRET. Runs every Worker cron tick (custom-worker.ts) until drained.
 */

// Per call: claim up to BATCH_SIZE and generate CONCURRENCY at a time. Concurrency is
// what makes the backfill fast (LLM + README fetch are I/O-bound); keep it modest so a
// single Worker invocation stays within its limits.
const BATCH_SIZE = 24;
const CONCURRENCY = 6;
// Below this cleaned-description length with no README there's nothing to write from —
// the row stays claimed (a permanent skip) so we never reselect a hopeless listing.
const MIN_MATERIAL_CHARS = 30;

type ClaimedRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tools: string | null;
};

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env?.DB) throw new Error('Database binding not found');

    const db = drizzle(env.DB as any);
    const githubToken = getGithubToken(env);
    const claimTime = new Date();

    // Atomically claim the highest-value unenriched listings (views → community → stars).
    // Stamping ai_enriched_at in the same statement that selects them is the claim: any
    // concurrent run skips these rows. Released below for anything we don't complete.
    const claimed = (await db
      .update(servers)
      .set({ aiEnrichedAt: claimTime })
      .where(
        inArray(
          servers.id,
          db
            .select({ id: servers.id })
            .from(servers)
            .where(and(eq(servers.status, 'active'), isNull(servers.aiEnrichedAt)))
            .orderBy(
              desc(servers.views),
              desc(servers.upvotes),
              sql`${servers.githubStars} IS NULL`,
              desc(servers.githubStars),
              asc(servers.createdAt)
            )
            .limit(BATCH_SIZE)
        )
      )
      .returning({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        description: servers.description,
        category: servers.category,
        tools: servers.tools,
      })) as ClaimedRow[];

    const stats = { claimed: claimed.length, enriched: 0, skippedThin: 0, failed: 0, budgetStopped: false };
    // Rows that reached a terminal, keep-the-claim state (stored content, or a permanent
    // thin-skip). Everything else in `claimed` gets its claim released at the end.
    const keep = new Set<string>();
    let budgetHit = false;

    for (let i = 0; i < claimed.length && !budgetHit; i += CONCURRENCY) {
      const chunk = claimed.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        chunk.map(async (server) => {
          const gh = parseGithubUrl(server.url);
          const readme = gh ? await fetchGithubReadme(gh.owner, gh.repo, githubToken) : null;
          const cleanedDesc = cleanListingDescription(server.description) || '';

          if (!readme && cleanedDesc.length < MIN_MATERIAL_CHARS) {
            return { server, thin: true as const };
          }
          const outcome = await generateListingContent({
            name: server.name,
            description: server.description,
            category: server.category,
            url: server.url,
            readme,
            tools: parseServerTools(server.tools),
          });
          return { server, outcome };
        })
      );

      // Writes are sequential (D1 serializes them anyway) so behavior is predictable.
      for (const r of results) {
        if ('thin' in r) {
          stats.skippedThin++;
          keep.add(r.server.id); // keep the claim — permanent skip
          continue;
        }
        const o = r.outcome;
        if (o.status === 'ok') {
          await db
            .update(servers)
            .set({
              aiSummary: o.content.summary,
              aiOverview: o.content.overview || null,
              aiUseCases: o.content.useCases.length ? JSON.stringify(o.content.useCases) : null,
              aiFeatures: o.content.features.length ? JSON.stringify(o.content.features) : null,
              // ai_enriched_at already set at claim time.
            })
            .where(eq(servers.id, r.server.id));
          stats.enriched++;
          keep.add(r.server.id);
        } else {
          // 'budget' → stop the run; 'skip' → transient/unusable. Either way, release the
          // claim (not added to `keep`) so the row is retried on a later run.
          stats.failed++;
          if (o.status === 'budget') budgetHit = true;
        }
      }
    }

    // Release every claimed row we didn't complete: failures, plus anything left unprocessed
    // when a budget stop broke the loop. These return to the pool with ai_enriched_at = NULL.
    const toRelease = claimed.filter((c) => !keep.has(c.id)).map((c) => c.id);
    if (toRelease.length > 0) {
      await db.update(servers).set({ aiEnrichedAt: null }).where(inArray(servers.id, toRelease));
    }
    stats.budgetStopped = budgetHit;

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)` })
      .from(servers)
      .where(and(eq(servers.status, 'active'), isNull(servers.aiEnrichedAt)));

    return NextResponse.json({
      success: true,
      ...stats,
      remaining,
      githubAuth: Boolean(githubToken),
      message: `AI content: enriched ${stats.enriched}, skipped-thin ${stats.skippedThin}, failed ${stats.failed}${
        stats.budgetStopped ? ' (stopped — LLM spend cap/outage)' : ''
      }. ~${remaining} listings remaining.`,
    });
  } catch (error: any) {
    console.error('AI content cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
