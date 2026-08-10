/**
 * Shared helpers for multi-file sitemaps (core / listings / secondary).
 * Keeps lastmod honest so crawlers can trust change signals.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers as serversTable } from '../db/schema';
import serversData from '../data/mcp-servers.json';

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
          str = str.replace(' ', 'T') + 'Z';
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
  '/': '2026-08-08',
  '/browse': '2026-08-05',
  '/categories': '2026-08-05',
  '/best': '2026-08-09',
  '/clients': '2026-08-05',
  '/about': '2026-07-27',
  '/docs/api': '2026-08-04',
  '/blog': '2026-08-07',
  '/contact': '2026-07-27',
  '/submit': '2026-08-01',
  '/terms': '2026-07-27',
  '/privacy': '2026-07-27',
  '/guides': '2026-08-07',
  '/what-is-mcp': '2026-08-04',
  '/guide': '2026-08-04',
  '/build-mcp-server': '2026-08-04',
  '/mcp-security': '2026-08-04',
  '/deploy-mcp-server': '2026-08-05',
  '/mcp-troubleshooting': '2026-08-07',
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
  '/compare': '2026-08-10',
  '/tags': '2026-08-10',
  '/best/seo': '2026-08-10',
};

export type SitemapServer = {
  id: string;
  category?: string | null;
  lastCheckedAt?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  stars?: number | null;
  githubStars?: number | null;
  downloads?: number | null;
  npmDownloads?: number | null;
  views?: number | null;
  copies?: number | null;
  upvotes?: number | null;
};

/** Active directory listings for sitemap generation (D1 when available). */
export async function getSitemapServers(): Promise<SitemapServer[]> {
  let servers = serversData as SitemapServer[];

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.status, 'active'));
      if (dbServers.length > 0) {
        servers = dbServers as SitemapServer[];
      }
    }
  } catch (e: any) {
    const msg = e?.message || e?.cause?.message || String(e);
    if (msg.includes('no such table') || msg.includes('D1_ERROR')) {
      console.warn(
        '[sitemap] D1 table not available during build time, using static mcp-servers.json fallback.'
      );
    } else {
      console.error('[sitemap] Failed to fetch D1 for sitemap:', e);
    }
  }

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

export function listingLastMod(server: SitemapServer): string {
  return safeDateISO(server.lastCheckedAt || server.createdAt || server.created_at);
}

/** Max lastmod among a set of servers (for category/topic hub pages). */
export function maxServerLastMod(servers: SitemapServer[]): string {
  if (servers.length === 0) return safeDateISO(STATIC_PAGE_LASTMOD['/categories']);
  let maxMs = 0;
  for (const s of servers) {
    const iso = listingLastMod(s);
    const t = new Date(iso).getTime();
    if (!isNaN(t) && t > maxMs) maxMs = t;
  }
  return maxMs > 0 ? new Date(maxMs).toISOString().replace(/\.\d{3}Z$/, 'Z') : listingLastMod(servers[0]);
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
  '/best/seo',
] as const;
