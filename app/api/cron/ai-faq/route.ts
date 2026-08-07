import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { fetchGithubReadme, parseGithubUrl } from '../../../../lib/listingEnrich';
import { getGithubToken } from '../../../../lib/githubAuth';
import { cleanListingDescription } from '../../../../lib/description';
import { parseServerTools } from '../../../../lib/servers';
import { generateListingContent } from '../../../../lib/aiContent';

/**
 * FAQ backfill pass — fills `ai_faq` on listings that were enriched by
 * /api/cron/ai-content *before* it started generating FAQ pairs (see the
 * ai_faq_at column, added alongside this route). Every future first-time
 * enrichment already writes ai_faq in the same call as the rest of the content
 * layer, so once this drains the backlog it settles into a permanent no-op —
 * same shape as /api/cron/ai-content's own steady state.
 *
 * Deliberately reuses generateListingContent() (same prompt, same README fetch)
 * rather than a second, leaner prompt: it costs 4 fields' worth of output tokens
 * we discard, but it's a one-time bounded backlog and this way there's no second
 * prompt to keep in sync with the first. Only `faq` from the result is persisted;
 * summary/overview/useCases/features on these rows are left exactly as they are.
 *
 * Same atomic-claim, concurrency, and spend-cap semantics as /api/cron/ai-content
 * — see that file for the reasoning. Auth: ADMIN_SECRET. Runs every Worker cron
 * tick (custom-worker.ts) until drained. For the initial backlog, drive
 * scripts/backfill-ai-faq.mjs against this endpoint to drain it faster.
 */

const BATCH_SIZE = 24;
const CONCURRENCY = 6;
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

    // Atomically claim already-enriched rows still missing a FAQ, highest-value first.
    const claimed = (await db
      .update(servers)
      .set({ aiFaqAt: claimTime })
      .where(
        inArray(
          servers.id,
          db
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(
                eq(servers.status, 'active'),
                isNotNull(servers.aiEnrichedAt),
                isNull(servers.aiFaqAt)
              )
            )
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

      for (const r of results) {
        if ('thin' in r) {
          stats.skippedThin++;
          keep.add(r.server.id); // permanent skip — nothing to ground a FAQ on
          continue;
        }
        const o = r.outcome;
        if (o.status === 'ok') {
          // Only aiFaq/aiFaqAt — summary/overview/useCases/features on this row
          // already exist and are intentionally left untouched.
          await db
            .update(servers)
            .set({
              aiFaq: o.content.faq.length ? JSON.stringify(o.content.faq) : null,
            })
            .where(eq(servers.id, r.server.id));
          stats.enriched++;
          keep.add(r.server.id);
        } else {
          stats.failed++;
          if (o.status === 'budget') budgetHit = true;
        }
      }
    }

    // Release every claimed row we didn't complete, same as /api/cron/ai-content.
    const toRelease = claimed.filter((c) => !keep.has(c.id)).map((c) => c.id);
    if (toRelease.length > 0) {
      await db.update(servers).set({ aiFaqAt: null }).where(inArray(servers.id, toRelease));
    }
    stats.budgetStopped = budgetHit;

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)` })
      .from(servers)
      .where(
        and(eq(servers.status, 'active'), isNotNull(servers.aiEnrichedAt), isNull(servers.aiFaqAt))
      );

    return NextResponse.json({
      success: true,
      ...stats,
      remaining,
      githubAuth: Boolean(githubToken),
      message: `AI FAQ backfill: enriched ${stats.enriched}, skipped-thin ${stats.skippedThin}, failed ${stats.failed}${
        stats.budgetStopped ? ' (stopped — LLM spend cap/outage)' : ''
      }. ~${remaining} listings remaining.`,
    });
  } catch (error: any) {
    console.error('AI FAQ cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
