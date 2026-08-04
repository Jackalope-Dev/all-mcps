import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
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
 * and adding an LLM call per item to it risks Worker CPU/subrequest limits. This pass
 * does at most BATCH_SIZE LLM calls per tick and prioritizes the listings most likely
 * to earn traffic (most-viewed, most-upvoted, most-starred) so the highest-value pages
 * get real content first.
 *
 * Auth: ADMIN_SECRET. Runs every Worker cron tick (see custom-worker.ts) until the
 * catalog is fully enriched, then no-ops cheaply (empty candidate set).
 */

// Small batch: LLM latency (~2-6s each) has to finish inside the cron's budget.
const BATCH_SIZE = 12;
// If this many listings that DID have material fail in a row, assume an outage / budget
// wall and stop for this tick rather than burning calls (unmarked rows retry next tick).
const MAX_CONSECUTIVE_FAILURES = 3;
// Below this cleaned-description length with no README, there's nothing to write from —
// mark as attempted so the pass doesn't reselect a hopeless row every tick.
const MIN_MATERIAL_CHARS = 30;

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

    // Highest-value pages first: views, then community signal, then stars. Nulls sort last.
    const batch = await db
      .select({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        description: servers.description,
        category: servers.category,
        tools: servers.tools,
      })
      .from(servers)
      .where(and(eq(servers.status, 'active'), isNull(servers.aiEnrichedAt)))
      .orderBy(
        desc(servers.views),
        desc(servers.upvotes),
        sql`${servers.githubStars} IS NULL`,
        desc(servers.githubStars),
        asc(servers.createdAt)
      )
      .limit(BATCH_SIZE);

    const stats = { processed: 0, enriched: 0, skippedThin: 0, failed: 0, stoppedEarly: false };
    let consecutiveFailures = 0;

    for (const server of batch) {
      stats.processed++;

      const gh = parseGithubUrl(server.url);
      const readme = gh ? await fetchGithubReadme(gh.owner, gh.repo, githubToken) : null;
      const cleanedDesc = cleanListingDescription(server.description) || '';

      // Nothing to write from — mark attempted (permanent skip) so we stop reselecting it.
      if (!readme && cleanedDesc.length < MIN_MATERIAL_CHARS) {
        await db.update(servers).set({ aiEnrichedAt: new Date() }).where(eq(servers.id, server.id));
        stats.skippedThin++;
        continue;
      }

      const content = await generateListingContent({
        name: server.name,
        description: server.description,
        category: server.category,
        url: server.url,
        readme,
        tools: parseServerTools(server.tools),
      });

      if (!content) {
        // Transient (budget/timeout) — leave unmarked so it retries next tick.
        stats.failed++;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          stats.stoppedEarly = true;
          break;
        }
        continue;
      }

      consecutiveFailures = 0;
      await db
        .update(servers)
        .set({
          aiSummary: content.summary,
          aiOverview: content.overview || null,
          aiUseCases: content.useCases.length ? JSON.stringify(content.useCases) : null,
          aiFeatures: content.features.length ? JSON.stringify(content.features) : null,
          aiEnrichedAt: new Date(),
        })
        .where(eq(servers.id, server.id));
      stats.enriched++;
    }

    // Rough remaining count so the owner can watch the backlog drain.
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
        stats.stoppedEarly ? ' (stopped early — likely LLM budget/outage)' : ''
      }. ~${remaining} listings remaining.`,
    });
  } catch (error: any) {
    console.error('AI content cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
