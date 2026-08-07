import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
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
 *  - Claims are released for any listing that failed or that we didn't reach, so a
 *    transient error or a mid-batch spend-cap stop never permanently marks a row as
 *    "done" with no content. Never-enriched rows release back to NULL; stale re-checks
 *    (see below) release back to their previous ai_enriched_at, not NULL — a re-check
 *    that keeps failing should retry after the normal staleness window, not cut in line
 *    ahead of listings that have never been enriched at all.
 *
 * Two-phase batch, in priority order:
 *  1. Never-enriched listings (ai_enriched_at IS NULL) — always fully drained first,
 *     highest-value (views/community/stars) first within that.
 *  2. Only once phase 1 has no more candidates for this batch, stale re-checks: listings
 *     enriched more than STALE_RECHECK_MS ago, oldest-enriched first. Content and READMEs
 *     do change after initial enrichment (new install instructions, new env vars, a
 *     rewritten description) and there was previously no path back to fresh content once
 *     a row was enriched once. Oldest-first (rather than weighted by popularity, like
 *     phase 1) guarantees every listing eventually rotates through instead of popular
 *     ones being refreshed forever while long-tail listings never are.
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
// How long enriched content is trusted before it's eligible for a refresh. The cron fires
// every 4h and claims up to BATCH_SIZE=24 rows/tick (144/day); re-checking the ~3.4k-listing
// catalog on a 90-day rotation needs ~38 rows/day, well inside that headroom even while
// phase 1 (never-enriched) keeps first priority. Kept well above the health cron's 3-day
// popularity-refresh window (app/api/cron/health) because this pass costs an LLM call per
// row, not just an HTTP fetch — READMEs don't churn often enough to justify checking more often.
const STALE_RECHECK_MS = 90 * 24 * 60 * 60 * 1000;

type ClaimedRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tools: string | null;
  /** Set only for phase-2 rows — the ai_enriched_at value to restore if this re-check fails. */
  previousEnrichedAt?: Date | null;
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

    // Phase 1: atomically claim the highest-value never-enriched listings (views →
    // community → stars). Stamping ai_enriched_at in the same statement that selects
    // them is the claim: any concurrent run skips these rows.
    const claimedNew = (await db
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

    // Phase 2: only spend leftover batch capacity on stale re-checks, oldest-enriched
    // first. Not a single atomic UPDATE…RETURNING like phase 1 (need each row's previous
    // ai_enriched_at to restore on failure — see the docstring) — select candidates, then
    // claim exactly those ids. The gap between the two statements is a real but narrow
    // double-claim window; a duplicate LLM call on an already-fresh row is a cheap price
    // for reusing the simple claim pattern the rest of this cron already relies on.
    let claimedStale: ClaimedRow[] = [];
    const staleSlots = BATCH_SIZE - claimedNew.length;
    if (staleSlots > 0) {
      const staleCutoff = new Date(claimTime.getTime() - STALE_RECHECK_MS);
      const candidates = await db
        .select({
          id: servers.id,
          name: servers.name,
          url: servers.url,
          description: servers.description,
          category: servers.category,
          tools: servers.tools,
          aiEnrichedAt: servers.aiEnrichedAt,
        })
        .from(servers)
        .where(
          and(
            eq(servers.status, 'active'),
            isNotNull(servers.aiEnrichedAt),
            lt(servers.aiEnrichedAt, staleCutoff)
          )
        )
        .orderBy(asc(servers.aiEnrichedAt))
        .limit(staleSlots);

      if (candidates.length > 0) {
        await db
          .update(servers)
          .set({ aiEnrichedAt: claimTime })
          .where(
            inArray(
              servers.id,
              candidates.map((c) => c.id)
            )
          );
        claimedStale = candidates.map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          description: c.description,
          category: c.category,
          tools: c.tools,
          previousEnrichedAt: c.aiEnrichedAt as Date | null,
        }));
      }
    }

    const claimed = [...claimedNew, ...claimedStale];
    const stats = {
      claimed: claimed.length,
      claimedNew: claimedNew.length,
      claimedStale: claimedStale.length,
      enriched: 0,
      skippedThin: 0,
      failed: 0,
      budgetStopped: false,
    };
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
              aiEnvVars: o.content.envVars.length ? JSON.stringify(o.content.envVars) : null,
              // Every fresh enrichment gets its FAQ in the same call — stamping
              // ai_faq_at here means the ai-faq backfill cron (which only targets
              // ai_faq_at IS NULL) never re-processes this row.
              aiFaq: o.content.faq.length ? JSON.stringify(o.content.faq) : null,
              aiFaqAt: claimTime,
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
    // when a budget stop broke the loop. Never-enriched releases return to NULL (top
    // priority again); stale re-checks release back to their previous ai_enriched_at, not
    // NULL, so a re-check that keeps failing doesn't masquerade as brand-new backlog.
    const unreleased = claimed.filter((c) => !keep.has(c.id));
    const releaseNew = unreleased.filter((c) => c.previousEnrichedAt === undefined).map((c) => c.id);
    const releaseStale = unreleased.filter((c) => c.previousEnrichedAt !== undefined);
    if (releaseNew.length > 0) {
      await db.update(servers).set({ aiEnrichedAt: null }).where(inArray(servers.id, releaseNew));
    }
    for (const row of releaseStale) {
      await db
        .update(servers)
        .set({ aiEnrichedAt: row.previousEnrichedAt })
        .where(eq(servers.id, row.id));
    }
    stats.budgetStopped = budgetHit;

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)` })
      .from(servers)
      .where(and(eq(servers.status, 'active'), isNull(servers.aiEnrichedAt)));

    const staleCutoffNow = new Date(Date.now() - STALE_RECHECK_MS);
    const [{ dueForRecheck }] = await db
      .select({ dueForRecheck: sql<number>`count(*)` })
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          isNotNull(servers.aiEnrichedAt),
          lt(servers.aiEnrichedAt, staleCutoffNow)
        )
      );

    return NextResponse.json({
      success: true,
      ...stats,
      remaining,
      dueForRecheck,
      githubAuth: Boolean(githubToken),
      message:
        `AI content: enriched ${stats.enriched} (${stats.claimedNew} new, ${stats.claimedStale} re-checked), ` +
        `skipped-thin ${stats.skippedThin}, failed ${stats.failed}${
          stats.budgetStopped ? ' (stopped — LLM spend cap/outage)' : ''
        }. ~${remaining} never-enriched, ~${dueForRecheck} due for re-check.`,
    });
  } catch (error: any) {
    console.error('AI content cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
