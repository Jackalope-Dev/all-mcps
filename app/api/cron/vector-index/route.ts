import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '@/db/schema';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { upsertServerEmbeddingsBatch } from '@/lib/vectorSearch';

/**
 * Vector-embedding sync — pushes each listing's semantic text into Cloudflare
 * Vectorize (lib/vectorSearch.ts) so /api/mcp and /api/v1/search can do hybrid
 * semantic search. Runs every Worker cron tick (custom-worker.ts) alongside 7
 * other jobs sharing one scheduled-invocation's time/subrequest budget, so —
 * same shape as /api/cron/ai-content and /api/cron/ai-faq — this claims a
 * bounded batch per tick instead of walking the whole catalog. An earlier
 * unbounded version (one AI-inference + one Vectorize call per active listing,
 * sequentially, for the entire multi-thousand-row catalog) blew that shared
 * budget on every tick, taking down every other cron job queued after it in
 * the same invocation — silently, for 5 days straight. See vectorSyncedAt in
 * db/schema.ts.
 */

const BATCH_SIZE = 30;
const CONCURRENCY = 5;

type ClaimedRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  aiSummary: string | null;
  aiOverview: string | null;
  aiUseCases: string | null;
  aiFeatures: string | null;
  aiFaq: string | null;
  tools: string | null;
  tags: string | null;
  license: string | null;
  pricingModel: string | null;
  authType: string | null;
  compatibleClients: string | null;
  maintenanceStatus: string | null;
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
    if (!env?.VECTOR_INDEX || !env?.AI) {
      return NextResponse.json(
        { error: 'Vectorize or Workers AI bindings not configured' },
        { status: 503 },
      );
    }

    const db = drizzle(env.DB);
    const claimTime = new Date();

    // Atomically claim a bounded batch of never-indexed active listings, highest-value
    // first — same claim-then-process shape as /api/cron/ai-faq.
    const claimed = (await db
      .update(servers)
      .set({ vectorSyncedAt: claimTime })
      .where(
        inArray(
          servers.id,
          db
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(eq(servers.status, 'active'), isNull(servers.vectorSyncedAt)),
            )
            .orderBy(
              desc(servers.views),
              desc(servers.upvotes),
              asc(servers.createdAt),
            )
            .limit(BATCH_SIZE),
        ),
      )
      .returning({
        id: servers.id,
        name: servers.name,
        category: servers.category,
        description: servers.description,
        aiSummary: servers.aiSummary,
        aiOverview: servers.aiOverview,
        aiUseCases: servers.aiUseCases,
        aiFeatures: servers.aiFeatures,
        aiFaq: servers.aiFaq,
        tools: servers.tools,
        tags: servers.tags,
        license: servers.license,
        pricingModel: servers.pricingModel,
        authType: servers.authType,
        compatibleClients: servers.compatibleClients,
        maintenanceStatus: servers.maintenanceStatus,
      })) as ClaimedRow[];

    const { successfulIds, failedIds } = await upsertServerEmbeddingsBatch(
      claimed,
      env,
      CONCURRENCY,
    );
    const indexed = successfulIds.length;
    const failed = failedIds.length;

    // Release claims that failed (transient AI/Vectorize error) so they're retried
    // next tick instead of stuck "claimed" forever.
    if (failedIds.length > 0) {
      await db
        .update(servers)
        .set({ vectorSyncedAt: null })
        .where(inArray(servers.id, failedIds));
    }

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)` })
      .from(servers)
      .where(and(eq(servers.status, 'active'), isNull(servers.vectorSyncedAt)));

    return NextResponse.json({
      status: 'ok',
      claimed: claimed.length,
      indexed,
      failed,
      remaining,
      timestamp: claimTime.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to execute vector indexing cron' },
      { status: 500 },
    );
  }
}
