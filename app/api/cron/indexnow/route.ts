import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, gte } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { submitIndexNowUrls } from '../../../../lib/indexnow';
import { INDEXNOW_CORE_PATHS } from '../../../../lib/sitemapHelpers';
import { engagementScore } from '../../../../lib/search';
import { getAllPosts } from '../../../../lib/blog';

/**
 * Periodic IndexNow batch: core hubs first, then recent listings, then top
 * engagement listings. Complements per-approve pings so Bing/Yandex get a
 * steady high-priority URL stream (Google ignores IndexNow).
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

    // 1) Core hub pages (always first — highest indexing ROI)
    const coreUrls = INDEXNOW_CORE_PATHS.map((p) => (p === '/' ? HOST : `${HOST}${p}`));

    // 2) Recent blog posts (last 14 days by filename date)
    const blogCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    let blogUrls: string[] = [];
    try {
      blogUrls = getAllPosts()
        .filter((p) => p.date >= blogCutoff)
        .slice(0, 10)
        .map((p) => `${HOST}/blog/${p.slug}`);
    } catch {
      /* blog optional at runtime */
    }

    // 3) Recently approved listings
    const recent = await db
      .select({ id: servers.id })
      .from(servers)
      .where(and(eq(servers.status, 'active'), gte(servers.createdAt, since)))
      .orderBy(desc(servers.createdAt))
      .limit(40);

    // 4) Top engagement listings (authority pages worth re-pinging)
    const activePool = await db
      .select({
        id: servers.id,
        upvotes: servers.upvotes,
        copies: servers.copies,
        views: servers.views,
        githubStars: servers.githubStars,
        npmDownloads: servers.npmDownloads,
      })
      .from(servers)
      .where(eq(servers.status, 'active'))
      .limit(500);

    const topEngagement = [...activePool]
      .sort((a, b) => engagementScore(b) - engagementScore(a))
      .slice(0, 30)
      .map((s) => s.id);

    const listingIds = [...new Set([...recent.map((s) => s.id), ...topEngagement])];
    const listingUrls = listingIds.map((id) => `${HOST}/mcp/${id}`);

    // Preserve priority order: core → blog → listings (dedupe by URL)
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const u of [...coreUrls, ...blogUrls, ...listingUrls]) {
      if (seen.has(u)) continue;
      seen.add(u);
      urls.push(u);
      if (urls.length >= MAX_URLS) break;
    }

    const ok = await submitIndexNowUrls(urls);

    return NextResponse.json({
      success: ok,
      submitted: urls.length,
      core: coreUrls.length,
      blog: blogUrls.length,
      recentListings: recent.length,
      topEngagement: topEngagement.length,
      windowDays: 3,
    });
  } catch (error) {
    console.error('IndexNow cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
