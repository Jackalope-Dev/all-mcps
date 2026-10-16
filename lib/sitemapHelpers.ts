/**
 * Shared helpers for multi-file sitemaps (core / listings / secondary).
 * Keeps lastmod honest so crawlers can trust change signals.
 */

import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { unstable_cache } from 'next/cache';
import serversData from '../data/mcp-servers.json';
import { servers as serversTable } from '../db/schema';
import { INDEXABLE_COMPARE_PAIRS } from './comparePairs';
import { isListingIndexable } from './listingIndexability';

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
    if (Number.isNaN(d.getTime())) return false;
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
      if (!Number.isNaN(val) && val > 0) {
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
        } else if (!Number.isNaN(parsed.getTime())) {
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
  '/': '2026-10-14',
  '/browse': '2026-10-14',
  '/categories': '2026-10-14',
  '/best': '2026-10-14',
  '/clients': '2026-09-23',
  '/about': '2026-10-14',
  '/docs/api': '2026-10-14',
  '/blog': '2026-08-07',
  '/contact': '2026-10-14',
  '/submit': '2026-10-14',
  '/terms': '2026-07-27',
  '/privacy': '2026-07-27',
  '/guides': '2026-10-14',
  '/what-is-mcp': '2026-08-04',
  '/guide': '2026-08-04',
  '/build-mcp-server': '2026-10-14',
  '/mcp-security': '2026-08-04',
  '/deploy-mcp-server': '2026-10-14',
  '/mcp-troubleshooting': '2026-08-07',
  '/mcp-protocol-versioning': '2026-08-22',
  '/mcp-transports': '2026-09-17',
  '/state-of-mcp': '2026-10-05',
  '/pricing': '2026-10-14',
  '/tools': '2026-10-14',
  '/tools/openapi-to-mcp': '2026-08-05',
  '/tools/protocol-inspector': '2026-08-05',
  '/tools/config-generator': '2026-08-05',
  '/tools/config-validator': '2026-08-05',
  '/tools/token-calculator': '2026-10-14',
  '/tools/config-auditor': '2026-09-23',
  '/tools/playground': '2026-09-23',
  '/prompts': '2026-10-14',
  '/badge-generator': '2026-08-01',
  '/mcp-for-cursor': '2026-10-14',
  '/mcp-for-claude-desktop': '2026-10-14',
  '/mcp-for-windsurf': '2026-10-14',
  '/mcp-for-cline': '2026-10-14',
  '/trust': '2026-10-14',
  '/stack': '2026-10-14',
  '/compare': '2026-09-23',
  '/tags': '2026-10-14',
  '/best/seo': '2026-08-10',
  '/mcp-for-seo': '2026-08-23',
  '/lucky': '2026-10-14',
  '/advertise': '2026-10-14',
  '/best/figma': '2026-09-23',
  '/best/obsidian': '2026-09-23',
  '/best/shopify': '2026-09-23',
  '/best/gmail': '2026-09-23',
  '/best/redis': '2026-09-23',
  '/best/cloudflare': '2026-09-23',
  '/best/supabase': '2026-09-23',
  '/best/confluence': '2026-09-23',
  '/best/bigquery': '2026-09-23',
  '/best/n8n': '2026-09-23',
  '/best/salesforce': '2026-09-23',
  '/best/terraform': '2026-09-23',
  '/clients/claude-desktop': '2026-08-05',
  '/clients/cursor': '2026-08-05',
  '/clients/cline': '2026-08-05',
  '/clients/windsurf': '2026-08-05',
  '/clients/claude-code': '2026-08-05',
  '/clients/vs-code': '2026-08-05',
  '/clients/zed': '2026-09-23',
  '/clients/codex': '2026-09-23',
  '/clients/gemini-cli': '2026-09-23',
  '/clients/jetbrains': '2026-09-23',
  '/clients/roo-code': '2026-09-23',
  '/clients/continue': '2026-09-23',
  '/clients/lm-studio': '2026-09-23',
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
  hasAiDoc?: number | boolean | null;
  toolsSource?: string | null;
  installNeedsConfig?: Date | string | number | null;
  remoteEndpointHealthy?: boolean | number | null;
  staleFlagged?: number | boolean | null;
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
  // Boolean, not the doc itself — curated compare pairs are only submitted
  // when both sides have a writeup (lib/comparePairs.ts).
  hasAiDoc: sql<number>`${serversTable.aiDoc} IS NOT NULL AND ${serversTable.aiDoc} != ''`,
  // Feed isListingIndexable's proof-it-runs check (hasVerifiedRun).
  toolsSource: serversTable.toolsSource,
  installNeedsConfig: serversTable.installNeedsConfig,
  remoteEndpointHealthy: serversTable.remoteEndpointHealthy,
  staleFlagged: sql<number>`${serversTable.staleFlaggedAt} IS NOT NULL`,
};

/** How long a sitemap's D1 read is reused before it's queried again. */
const SITEMAP_CACHE_SECONDS = 3600;

/**
 * Rows per sitemap scan page. Slim rows are a few hundred bytes, so a page is
 * a few MB of heap at most however large the catalog grows.
 */
const SITEMAP_PAGE_SIZE = 2000;

/**
 * Everything the sitemap routes need from the catalog, folded down while it is
 * scanned so no request ever holds every listing row at once. Holding the full
 * ~32k-row catalog (plus its unstable_cache copy and the rendered XML) is what
 * pushed /sitemap/core.xml and /sitemap/listings.xml over the Worker memory
 * limit. Plain JSON so unstable_cache can store it.
 */
export type SitemapSummary = {
  /** Newest listingLastMod (epoch ms) per raw category value ('' when unset). */
  categoryLastMs: Record<string, number>;
  /** Indexable listings in catalog order, for the listings shard. */
  listings: { id: string; lastmod: string }[];
  /** lastmod of curated compare-pair listings that carry an AI writeup. */
  comparePairLastMod: Record<string, string>;
};

const COMPARE_PAIR_IDS = new Set(
  INDEXABLE_COMPARE_PAIRS.flatMap((p) => [p.a, p.b]),
);

/** Folds sitemap rows into a SitemapSummary one page at a time. */
export function createSitemapSummarizer() {
  const seen = new Set<string>();
  const summary: SitemapSummary = {
    categoryLastMs: {},
    listings: [],
    comparePairLastMod: {},
  };
  return {
    add(rows: SitemapServer[]) {
      for (const s of rows) {
        if (!s.id || seen.has(s.id)) continue;
        seen.add(s.id);
        const lastmod = listingLastMod(s);
        const ms = new Date(lastmod).getTime();
        const cat = s.category || '';
        if (!Number.isNaN(ms) && ms > (summary.categoryLastMs[cat] ?? 0)) {
          summary.categoryLastMs[cat] = ms;
        }
        if (s.hasAiDoc && COMPARE_PAIR_IDS.has(s.id)) {
          summary.comparePairLastMod[s.id] = lastmod;
        }
        // Only listings the page itself leaves indexable (see /mcp/[id] metadata).
        if (
          isListingIndexable({
            hasAiDoc: Boolean(s.hasAiDoc),
            toolsSource: s.toolsSource,
            installNeedsConfig: s.installNeedsConfig,
            remoteEndpointHealthy: s.remoteEndpointHealthy,
            githubStars: s.githubStars ?? s.stars,
            npmDownloads: s.npmDownloads ?? s.downloads,
            staleFlagged: Boolean(s.staleFlagged),
          })
        ) {
          summary.listings.push({ id: s.id, lastmod });
        }
      }
    },
    /** Null when no listing was added, so callers can tell "empty" apart. */
    result(): SitemapSummary | null {
      return seen.size > 0 ? summary : null;
    },
  };
}

/**
 * One paged D1 scan of every active listing, folded into a SitemapSummary, or
 * null when D1 isn't reachable (or has no active rows).
 *
 * Returns null rather than falling back here so callers can tell "D1 said
 * nothing" apart from "D1 wasn't available" — the difference between a
 * legitimately empty catalog and a build-time render with no binding.
 */
async function fetchSitemapSummaryFromD1(): Promise<SitemapSummary | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (!ctx?.env || !(ctx.env as any).DB) return null;

    const db = drizzle((ctx.env as any).DB);
    const summarizer = createSitemapSummarizer();
    let afterRowid: number | null = null;
    for (;;) {
      // Paged on rowid, not id: (status, rowid) walks idx_servers_status in
      // order (see queryQualityTiers in lib/siteStats.ts).
      const rows: (SitemapServer & { rowid: number })[] = await db
        .select({ rowid: sql<number>`rowid`, ...SITEMAP_SERVER_COLUMNS })
        .from(serversTable)
        .where(
          afterRowid === null
            ? eq(serversTable.status, 'active')
            : and(
                eq(serversTable.status, 'active'),
                sql`rowid > ${afterRowid}`,
              ),
        )
        .orderBy(sql`rowid`)
        .limit(SITEMAP_PAGE_SIZE);
      if (rows.length === 0) break;
      summarizer.add(rows);
      if (rows.length < SITEMAP_PAGE_SIZE) break;
      afterRowid = rows[rows.length - 1].rowid;
    }
    return summarizer.result();
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

/** Thrown inside the cache so a failed scan is never stored. */
class SitemapSummaryUnavailable extends Error {}

/**
 * Caches the folded D1 scan rather than the rendered sitemap. The routes are
 * `force-dynamic` on purpose: an ISR sitemap gets prerendered at build time,
 * when there's no D1 binding, which froze a fallback-shaped sitemap into the
 * cache for a full revalidate window on every deploy. Caching here keeps that
 * from costing a catalog scan per crawl hit — the catalog is read at most once
 * an hour and every other request reuses the (small) summary.
 */
const getCachedSitemapSummaryFromD1 = unstable_cache(
  // unstable_cache stores whatever resolves, null included: one failed scan
  // during a D1 reset was cached for the full hour, and every sitemap hit in
  // that hour fell through to an uncached ~32k-row scan (3-6s wall, up to
  // ~1.8s CPU each) on the already struggling D1. Throwing skips the write.
  async () => {
    const summary = await fetchSitemapSummaryFromD1();
    if (!summary) throw new SitemapSummaryUnavailable();
    return summary;
  },
  ['sitemap-summary-v2'],
  { revalidate: SITEMAP_CACHE_SECONDS },
);

/** Catalog summary for sitemap generation (D1 when available). */
export async function getSitemapSummary(): Promise<SitemapSummary> {
  let summary: SitemapSummary | null = null;

  try {
    summary = await getCachedSitemapSummaryFromD1();
  } catch (e) {
    // The scan itself just failed: retrying it at once only adds D1 load.
    if (!(e instanceof SitemapSummaryUnavailable)) {
      // The cache layer failed (e.g. no request context). Retry uncached
      // before falling back to the bundled sample, so a cache problem costs a
      // query instead of shipping a sitemap missing almost every listing.
      console.error('[sitemap] Cached D1 read failed, querying directly:', e);
      summary = await fetchSitemapSummaryFromD1();
    }
  }
  if (summary) return summary;

  const summarizer = createSitemapSummarizer();
  summarizer.add(
    (serversData as Array<SitemapServer & { status?: string }>).filter(
      (s) => s.status !== 'removed',
    ),
  );
  return (
    summarizer.result() ?? {
      categoryLastMs: {},
      listings: [],
      comparePairLastMod: {},
    }
  );
}

/**
 * Newest listing lastmod among categories satisfying `match` (category and
 * topic hubs, the sitemap index), or the /categories ship date when none do.
 */
export function categoryLastMod(
  summary: SitemapSummary,
  match: (category: string) => boolean,
): string {
  let maxMs = 0;
  for (const [cat, ms] of Object.entries(summary.categoryLastMs)) {
    if (ms > maxMs && match(cat)) maxMs = ms;
  }
  return maxMs > 0
    ? new Date(maxMs).toISOString().replace(/\.\d{3}Z$/, 'Z')
    : safeDateISO(STATIC_PAGE_LASTMOD['/categories']);
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
function listingContentMs(server: SitemapServer): number {
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
  '/state-of-mcp',
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
