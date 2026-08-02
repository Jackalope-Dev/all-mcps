import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, gte } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { submitIndexNowUrls } from '../../../../lib/indexnow';

/**
 * Periodic IndexNow batch for recently approved listings.
 * Complements the per-approve ping so missed/fire-and-forget failures still get coverage.
 *
 * Window: active listings created in the last 3 days (cron runs daily).
 */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_URLS = 100;
const HOST = 'https://allmcps.com';

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env?.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);
    const since = new Date(Date.now() - LOOKBACK_MS);

    const recent = await db
      .select({ id: servers.id })
      .from(servers)
      .where(and(eq(servers.status, 'active'), gte(servers.createdAt, since)))
      .orderBy(desc(servers.createdAt))
      .limit(MAX_URLS - 2);

    const urls = [
      `${HOST}/browse`,
      `${HOST}/`,
      ...recent.map((s) => `${HOST}/mcp/${s.id}`),
    ].slice(0, MAX_URLS);

    const ok = await submitIndexNowUrls(urls);

    return NextResponse.json({
      success: ok,
      submitted: urls.length,
      listings: recent.length,
      windowDays: 3,
    });
  } catch (error) {
    console.error('IndexNow cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
