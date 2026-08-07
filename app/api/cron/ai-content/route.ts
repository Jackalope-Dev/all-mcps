import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { fetchGithubReadme, parseGithubUrl } from '../../../../lib/listingEnrich';
import { getGithubToken } from '../../../../lib/githubAuth';
import { cleanListingDescription } from '../../../../lib/description';
import { parseServerTools } from '../../../../lib/servers';
import { generateListingContent } from '../../../../lib/aiContent';

/**
 * AI content pass — writes the unique per-listing content layer (summary, overview,
 * use cases, features, faq, envVars, authType, pricingModel, license, tags, compatibleClients)
 * that turns scraped README-mirror pages into rich, original listings.
 */

const BATCH_SIZE = 24;
const CONCURRENCY = 6;
const MIN_MATERIAL_CHARS = 30;
const STALE_RECHECK_MS = 90 * 24 * 60 * 60 * 1000;

type ClaimedRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tools: string | null;
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

    // Phase 1: atomically claim highest-value never-enriched OR metadata-missing listings
    const claimedNew = (await db
      .update(servers)
      .set({ aiEnrichedAt: claimTime })
      .where(
        inArray(
          servers.id,
          db
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(
                eq(servers.status, 'active'),
                or(isNull(servers.aiEnrichedAt), isNull(servers.authType), isNull(servers.pricingModel))
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
          keep.add(r.server.id);
          continue;
        }
        const o = r.outcome;
        if (o.status === 'ok') {
          const updatePayload: Record<string, unknown> = {
            aiSummary: o.content.summary,
            aiOverview: o.content.overview || null,
            aiUseCases: o.content.useCases.length ? JSON.stringify(o.content.useCases) : null,
            aiFeatures: o.content.features.length ? JSON.stringify(o.content.features) : null,
            aiEnvVars: o.content.envVars.length ? JSON.stringify(o.content.envVars) : null,
            aiFaq: o.content.faq.length ? JSON.stringify(o.content.faq) : null,
            aiFaqAt: claimTime,
          };

          if (o.content.pricingModel) updatePayload.pricingModel = o.content.pricingModel;
          if (o.content.authType) updatePayload.authType = o.content.authType;
          if (o.content.license) updatePayload.license = o.content.license;
          if (o.content.tags && o.content.tags.length > 0) updatePayload.tags = JSON.stringify(o.content.tags);
          if (o.content.compatibleClients && o.content.compatibleClients.length > 0) {
            updatePayload.compatibleClients = JSON.stringify(o.content.compatibleClients);
          }

          await db
            .update(servers)
            .set(updatePayload as any)
            .where(eq(servers.id, r.server.id));
          stats.enriched++;
          keep.add(r.server.id);
        } else {
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
