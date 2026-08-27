import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, desc, eq, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { getAllPosts } from '../../../../lib/blog';
import { submitIndexNowUrls } from '../../../../lib/indexnow';
import { INDEXNOW_CORE_PATHS } from '../../../../lib/sitemapHelpers';

/**
 * Change-scoped IndexNow safety net. IndexNow is a "this URL just changed"
 * signal, so this cron only submits URLs that genuinely changed in the lookback
 * window: listings approved in the last 3 days and blog posts published in the
 * last 14 days. When new content lands it also re-pings the aggregate hubs that
 * content changed (browse/categories/sitemap, via INDEXNOW_CORE_PATHS); when
 * nothing changed it submits nothing.
 *
 * We deliberately do NOT re-ping static hubs or "top engagement" authority
 * pages on a fixed daily cadence — resubmitting unchanged URLs is what makes
 * Bing Webmaster flag the key as "batch mode", which Bing recommends against.
 * Real-time discovery is handled by the per-approve/republish pings in
 * lib/indexnow.ts; this cron just catches fire-and-forget misses.
 * (Google ignores IndexNow either way.)
 */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const BLOG_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_URLS = 100;
const HOST = 'https://allmcps.com';

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: CloudflareEnv | undefined;
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

    // 1) Listings approved in the lookback window (genuinely new URLs)
    const recent = await db
      .select({ id: servers.id })
      .from(servers)
      .where(and(eq(servers.status, 'active'), gte(servers.createdAt, since)))
      .orderBy(desc(servers.createdAt))
      .limit(40);
    const listingUrls = recent.map((s) => `${HOST}/mcp/${s.id}`);

    // 2) Blog posts published in the last 14 days (by filename date)
    const blogCutoff = new Date(Date.now() - BLOG_LOOKBACK_MS)
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

    const changedUrls = [...listingUrls, ...blogUrls];

    // Nothing changed → submit nothing. IndexNow is a change signal, not a
    // sitemap resubmission; a quiet day should be quiet.
    if (changedUrls.length === 0) {
      return NextResponse.json({
        success: true,
        submitted: 0,
        core: 0,
        blog: 0,
        recentListings: 0,
        windowDays: 3,
      });
    }

    // 3) New content changed the aggregate hubs (browse/categories/sitemap),
    // so re-ping those — but only because something actually changed.
    const coreUrls = INDEXNOW_CORE_PATHS.map((p) =>
      p === '/' ? HOST : `${HOST}${p}`,
    );

    // Priority order: core hubs → changed listings → new blog (dedupe by URL)
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const u of [...coreUrls, ...listingUrls, ...blogUrls]) {
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
      windowDays: 3,
    });
  } catch (error) {
    console.error('IndexNow cron error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
