/**
 * Shared helpers for multi-file sitemaps (core / listings / secondary).
 * Keeps lastmod honest so crawlers can trust change signals.
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { unstable_cache } from 'next/cache';
import serversData from '../data/mcp-servers.json';
import { servers as serversTable } from '../db/schema';

/**
 * Safely parses and normalizes any date input into a valid Date object.
 * Handles Date objects, Unix timestamps (seconds or ms), ISO strings,
 * SQLite datetime strings ("YYYY-MM-DD HH:MM:SS"), null, undefined,
 * or invalid strings, always returning a valid Date instance.
 *
 * Includes a year-range sanity check (2000–2100) to catch double-scaled
 * timestamps — e.g. when Drizzle `mode:'timestamp'` multiplies a value
 * already stored as milliseconds by 1000 again.
 */
export function safeDateISO(val: unknown): string {
  const MIN_YEAR = 2000;
  const MAX_YEAR = 2100;
  const now = new Date();

  function plausible(d: Date): boolean {
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= MIN_YEAR && y <= MAX_YEAR;
  }

  function rescue(d: Date): Date | null {
    const fixed = new Date(Math.floor(d.getTime() / 1000));
    return plausible(fixed) ? fixed : null;
  }

  let d: Date = now;

  if (val) {
    if (val instanceof Date) {
      if (plausible(val)) {
        d = val;
      } else {
        d = rescue(val) ?? now;
      }
    } else if (typeof val === 'number') {
      if (!isNaN(val) && val > 0) {
        let parsed = new Date(val);
        if (plausible(parsed)) {
          d = parsed;
        } else {
          parsed = new Date(val * 1000);
          if (plausible(parsed)) {
            d = parsed;
          } else {
            d = rescue(new Date(val)) ?? rescue(new Date(val * 1000)) ?? now;
          }
        }
      }
    } else if (typeof val === 'string') {
      let str = val.trim();
      if (str && str !== 'null' && str !== 'undefined') {
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(str)) {
          str = `${str.replace(' ', 'T')}Z`;
        }
        // Bare YYYY-MM-DD (static content ship dates)
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          str = `${str}T12:00:00.000Z`;
        }
        const parsed = new Date(str);
        if (plausible(parsed)) {
          d = parsed;
        } else if (!isNaN(parsed.getTime())) {
          d = rescue(parsed) ?? now;
        }
      }
    }
  }

  if (!plausible(d)) {
    d = now;
  }

  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Content ship / last editorial update dates for static marketing pages.
 * Update these when the page body meaningfully changes — never use "now"
 * on every request (that teaches crawlers to ignore lastmod).
 */
export const STATIC_PAGE_LASTMOD: Record<string, string> = {
  '/': '2026-09-09',
  '/browse': '2026-08-05',
  '/categories': '2026-08-05',
  '/best': '2026-08-13',
  '/clients': '2026-08-05',
  '/about': '2026-07-27',
  '/docs/api': '2026-09-10',
  '/blog': '2026-08-07',
  '/contact': '2026-07-27',
  '/submit': '2026-08-01',
  '/terms': '2026-07-27',
  '/privacy': '2026-07-27',
  '/guides': '2026-09-17',
  '/what-is-mcp': '2026-08-04',
  '/guide': '2026-08-04',
  '/build-mcp-server': '2026-08-04',
  '/mcp-security': '2026-08-04',
  '/deploy-mcp-server': '2026-08-28',
  '/mcp-troubleshooting': '2026-08-07',
  '/mcp-protocol-versioning': '2026-08-22',
  '/mcp-transports': '2026-09-17',
  '/pricing': '2026-08-08',
  '/tools': '2026-08-05',
  '/tools/openapi-to-mcp': '2026-08-05',
  '/tools/protocol-inspector': '2026-08-05',
  '/tools/config-generator': '2026-08-05',
  '/tools/config-validator': '2026-08-05',
  '/tools/token-calculator': '2026-08-05',
  '/tools/config-auditor': '2026-08-05',
  '/tools/playground': '2026-08-05',
  '/prompts': '2026-08-05',
  '/badge-generator': '2026-08-01',
  '/mcp-for-cursor': '2026-08-05',
  '/mcp-for-claude-desktop': '2026-08-05',
  '/mcp-for-windsurf': '2026-08-05',
  '/mcp-for-cline': '2026-08-05',
  '/trust': '2026-08-07',
  '/stack': '2026-08-10',
  '/compare': '2026-08-26',
  '/tags': '2026-08-26',
  '/best/seo': '2026-08-10',
  '/mcp-for-seo': '2026-08-23',
  '/lucky': '2026-08-13',
  '/advertise': '2026-08-13',
};

export type SitemapServer = {
  id: string;
  category?: string | null;
  lastCheckedAt?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  /** Content-change timestamps — see listingLastMod. */
  aiDocAt?: unknown;
  aiFaqAt?: unknown;
  aiEnrichedAt?: unknown;
  installExtractedAt?: unknown;
  lastCommitAt?: unknown;
  stars?: number | null;
  githubStars?: number | null;
  downloads?: number | null;
  npmDownloads?: number | null;
  views?: number | null;
  copies?: number | null;
  upvotes?: number | null;
};

// Only the columns sitemap.ts (SitemapServer) actually reads — the servers table
// carries ~70 columns including large AI-generated text blobs (aiSummary,
// aiOverview, tools JSON, etc.) that a full `db.select()` would otherwise pull
// across every active row on every sitemap shard request.
const SITEMAP_SERVER_COLUMNS = {
  id: serversTable.id,
  category: serversTable.category,
  lastCheckedAt: serversTable.lastCheckedAt,
  createdAt: serversTable.createdAt,
  aiDocAt: serversTable.aiDocAt,
  aiFaqAt: serversTable.aiFaqAt,
  aiEnrichedAt: serversTable.aiEnrichedAt,
  installExtractedAt: serversTable.installExtractedAt,
  lastCommitAt: serversTable.lastCommitAt,
  githubStars: serversTable.githubStars,
  npmDownloads: serversTable.npmDownloads,
  views: serversTable.views,
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
};

/** How long a sitemap's D1 read is reused before it's queried again. */
const SITEMAP_CACHE_SECONDS = 3600;

/**
 * One D1 read of every active listing, or null when D1 isn't reachable.
 *
 * Returns null rather than falling back here so callers can tell "D1 said
 * nothing" apart from "D1 wasn't available" — the difference between a
 * legitimately empty catalog and a build-time render with no binding.
 */
async function fetchSitemapServersFromD1(): Promise<SitemapServer[] | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (!ctx?.env || !(ctx.env as any).DB) return null;

    const db = drizzle((ctx.env as any).DB);
    const dbServers = await db
      .select(SITEMAP_SERVER_COLUMNS)
      .from(serversTable)
      .where(eq(serversTable.status, 'active'));

    return dbServers.length > 0 ? (dbServers as SitemapServer[]) : null;
  } catch (e: any) {
    const msg = e?.message || e?.cause?.message || String(e);
    if (msg.includes('no such table') || msg.includes('D1_ERROR')) {
      console.warn('[sitemap] D1 not available, falling back.');
    } else {
      console.error('[sitemap] Failed to fetch D1 for sitemap:', e);
    }
    return null;
  }
}

/**
 * Caches the D1 read itself rather than the rendered sitemap. The routes are
 * `force-dynamic` on purpose: an ISR sitemap gets prerendered at build time,
 * when there's no D1 binding, which froze a fallback-shaped sitemap into the
 * cache for a full revalidate window on every deploy. Caching here keeps that
 * from costing a query per crawl hit — the catalog is read at most once an
 * hour and every other request reuses it.
 */
const getCachedSitemapServersFromD1 = unstable_cache(
  fetchSitemapServersFromD1,
  ['sitemap-servers'],
  { revalidate: SITEMAP_CACHE_SECONDS },
);

/** Active directory listings for sitemap generation (D1 when available). */
export async function getSitemapServers(): Promise<SitemapServer[]> {
  let dbServers: SitemapServer[] | null = null;

  try {
    dbServers = await getCachedSitemapServersFromD1();
  } catch (e) {
    console.error('[sitemap] Cached D1 read failed, querying directly:', e);
  }

  // A null here means either D1 was genuinely unreachable or the cache layer
  // couldn't reach the request context. Retry uncached before falling back to
  // the bundled sample, so a cache problem costs a query instead of shipping a
  // sitemap that's missing almost every listing.
  if (!dbServers) {
    dbServers = await fetchSitemapServersFromD1();
  }

  const servers =
    dbServers ??
    (serversData as Array<SitemapServer & { status?: string }>).filter(
      (s) => s.status !== 'removed',
    );

  const seen = new Set<string>();
  const uniqueServers: SitemapServer[] = [];
  for (const s of servers) {
    if (s.id && !seen.has(s.id)) {
      seen.add(s.id);
      uniqueServers.push(s);
    }
  }

  return uniqueServers;
}

/**
 * Newest genuine *content* change to a listing page: the writeup, FAQ,
 * enrichment pass, or install re-validation we generated, plus the upstream
 * repo's last commit. Returns 0 when none are known.
 *
 * Deliberately excludes `lastCheckedAt` — the health cron rewrites that every
 * ~15 min on a non-content event, and letting it drive lastmod made every
 * listing look freshly updated on every crawl, which teaches crawlers to stop
 * trusting the signal (same reasoning as the STATIC_PAGE_LASTMOD rule).
 */
export function listingContentMs(server: SitemapServer): number {
  let maxMs = 0;
  for (const v of [
    server.aiDocAt,
    server.aiFaqAt,
    server.aiEnrichedAt,
    server.installExtractedAt,
    server.lastCommitAt,
  ]) {
    if (v === null || v === undefined) continue;
    const t = new Date(safeDateISO(v)).getTime();
    if (!Number.isNaN(t) && t > maxMs) maxMs = t;
  }
  return maxMs;
}

export function listingLastMod(server: SitemapServer): string {
  const contentMs = listingContentMs(server);
  if (contentMs > 0) {
    return new Date(contentMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return safeDateISO(server.createdAt || server.created_at);
}

/** Max lastmod among a set of servers (for category/topic hub pages). */
export function maxServerLastMod(servers: SitemapServer[]): string {
  if (servers.length === 0)
    return safeDateISO(STATIC_PAGE_LASTMOD['/categories']);
  let maxMs = 0;
  for (const s of servers) {
    const iso = listingLastMod(s);
    const t = new Date(iso).getTime();
    if (!isNaN(t) && t > maxMs) maxMs = t;
  }
  return maxMs > 0
    ? new Date(maxMs).toISOString().replace(/\.\d{3}Z$/, 'Z')
    : listingLastMod(servers[0]);
}

/** High-value core paths to submit first via IndexNow (priority crawl targets). */
export const INDEXNOW_CORE_PATHS = [
  '/',
  '/browse',
  '/categories',
  '/best',
  '/clients',
  '/guides',
  '/what-is-mcp',
  '/guide',
  '/build-mcp-server',
  '/mcp-security',
  '/deploy-mcp-server',
  '/mcp-troubleshooting',
  '/mcp-protocol-versioning',
  '/mcp-transports',
  '/tools',
  '/blog',
  '/trust',
  '/docs/api',
  '/prompts',
  '/pricing',
  '/submit',
  '/mcp-for-cursor',
  '/mcp-for-claude-desktop',
  '/mcp-for-windsurf',
  '/mcp-for-cline',
  '/mcp-for-seo',
  '/best/seo',
  '/lucky',
  '/advertise',
] as const;
