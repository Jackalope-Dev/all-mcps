import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { runBlogPipeline } from '@/lib/blogPipeline/pipeline';
import { isCronAuthorized } from '@/lib/cronAuth';

/**
 * Blog content pipeline tick (see lib/blogPipeline/pipeline.ts for the state
 * machine). Runs last in the 4-hourly slow list, so it gets a bounded time
 * budget instead of "as long as it takes": the scheduled invocation shares
 * one wall-clock limit with every job before it. A manual run from /admin can
 * pass ?budgetSeconds= (capped) — keep it under the ~100s edge timeout for a
 * browser-triggered call, e.g. ?budgetSeconds=90 to advance a single review.
 */
const DEFAULT_BUDGET_MS = 9 * 60_000;
const MAX_BUDGET_MS = 12 * 60_000;

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');

    const url = new URL(req.url);
    const requested = Number(url.searchParams.get('budgetSeconds')) * 1000;
    const budget =
      Number.isFinite(requested) && requested > 0
        ? Math.min(requested, MAX_BUDGET_MS)
        : DEFAULT_BUDGET_MS;

    const db = drizzle(env.DB);
    const result = await runBlogPipeline(db, env, Date.now() + budget);
    console.log('[blog-pipeline]', JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[blog-pipeline] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 },
    );
  }
}
