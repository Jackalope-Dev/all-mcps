import { MetadataRoute } from 'next';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';
import { getAllPosts } from '../lib/blog';
import { DIRECTORY_CATEGORIES, categorySlug } from '../lib/categories';
import { BEST_TOPICS } from '../lib/bestTopics';
import { MCP_CLIENTS } from '../lib/clients';
import { WORKFLOW_PROMPTS } from '../lib/prompts';
import { engagementScore } from '../lib/search';

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
function safeDateISO(val: unknown): string {
  const MIN_YEAR = 2000;
  const MAX_YEAR = 2100;
  const now = new Date();

  /** Return true when `d` falls within the plausible year window. */
  function plausible(d: Date): boolean {
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= MIN_YEAR && y <= MAX_YEAR;
  }

  /**
   * Try to rescue an out-of-range Date that was created from a
   * double-scaled timestamp (ms interpreted as seconds, then ×1000).
   * Dividing the underlying ms value by 1000 recovers the real date.
   */
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
        // Possibly double-scaled; try dividing ms by 1000
        d = rescue(val) ?? now;
      }
    } else if (typeof val === 'number') {
      if (!isNaN(val) && val > 0) {
        // Try as-is (milliseconds)
        let parsed = new Date(val);
        if (plausible(parsed)) {
          d = parsed;
        } else {
          // Try as seconds → ms
          parsed = new Date(val * 1000);
          if (plausible(parsed)) {
            d = parsed;
          } else {
            // Try rescuing (divide by 1000)
            d = rescue(new Date(val)) ?? rescue(new Date(val * 1000)) ?? now;
          }
        }
      }
    } else if (typeof val === 'string') {
      let str = val.trim();
      if (str && str !== 'null' && str !== 'undefined') {
        // Normalize SQLite format "YYYY-MM-DD HH:MM:SS" to ISO "YYYY-MM-DDTHH:MM:SSZ"
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(str)) {
          str = str.replace(' ', 'T') + 'Z';
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

  // Final guard: if the result is still out of range, use now
  if (!plausible(d)) {
    d = now;
  }

  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://allmcps.com';
  
  let servers = serversData as any[];
  
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.status, 'active'));
      if (dbServers.length > 0) {
        servers = dbServers;
      }
    }
  } catch (e) {
    console.error("Failed to fetch D1 for sitemap", e);
  }

  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/best`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/clients`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/api`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/guides`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/what-is-mcp`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/build-mcp-server`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-security`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/deploy-mcp-server`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/openapi-to-mcp`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/protocol-inspector`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/config-generator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/config-validator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/token-calculator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/config-auditor`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/tools/playground`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/prompts`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/badge-generator`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    },
    {
      url: `${baseUrl}/mcp-for-cursor`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-for-claude-desktop`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-for-windsurf`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-for-cline`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
  ];

  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = getAllPosts();
    blogEntries = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: safeDateISO(post.date ? `${post.date}T12:00:00.000Z` : undefined),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (e) {
    console.error('Failed to read blog posts for sitemap', e);
  }

  const serverEntries = servers.map((server) => ({
    url: `${baseUrl}/mcp/${server.id}`,
    lastModified: safeDateISO(server.lastCheckedAt || server.createdAt || server.created_at),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Alternatives pages are indexable + linked from listings; without sitemap
  // entries they stay under-discovered by crawlers despite full SEO markup.
  const alternativesEntries = servers.map((server) => ({
    url: `${baseUrl}/mcp/${server.id}/alternatives`,
    lastModified: safeDateISO(server.lastCheckedAt || server.createdAt || server.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.55,
  }));

  // Compare pages: top engagement listings × top peers in same category.
  // Cap pairs + use sorted ids for canonical URLs so we don't explode the sitemap.
  const engagement = (s: any) => engagementScore(s);
  const byCategory = new Map<string, any[]>();
  for (const s of servers) {
    const cat = s.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(s);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => engagement(b) - engagement(a));
  }
  const topSeeds = [...servers].sort((a, b) => engagement(b) - engagement(a)).slice(0, 80);
  const compareSeen = new Set<string>();
  const compareEntries: MetadataRoute.Sitemap = [];
  for (const seed of topSeeds) {
    const peers = (byCategory.get(seed.category) || [])
      .filter((p) => p.id !== seed.id)
      .slice(0, 3);
    for (const peer of peers) {
      const [a, b] = seed.id < peer.id ? [seed.id, peer.id] : [peer.id, seed.id];
      const key = `${a}|${b}`;
      if (compareSeen.has(key)) continue;
      compareSeen.add(key);
      compareEntries.push({
        url: `${baseUrl}/mcp/${a}/vs/${b}`,
        lastModified: safeDateISO(
          seed.lastCheckedAt || seed.createdAt || seed.created_at || peer.lastCheckedAt
        ),
        changeFrequency: 'weekly',
        priority: 0.5,
      });
      if (compareEntries.length >= 400) break;
    }
    if (compareEntries.length >= 400) break;
  }

  const categoryEntries: MetadataRoute.Sitemap = DIRECTORY_CATEGORIES.map((category) => ({
    url: `${baseUrl}/categories/${categorySlug(category)}`,
    lastModified: safeDateISO(new Date()),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  const clientEntries: MetadataRoute.Sitemap = MCP_CLIENTS.map((c) => ({
    url: `${baseUrl}/clients/${c.slug}`,
    lastModified: safeDateISO(new Date()),
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  // De-dupe by slug so accidental double entries never emit two /best/* URLs.
  const seenBest = new Set<string>();
  const bestEntries: MetadataRoute.Sitemap = BEST_TOPICS.filter((t) => {
    if (seenBest.has(t.slug)) return false;
    seenBest.add(t.slug);
    return true;
  }).map((t) => ({
    url: `${baseUrl}/best/${t.slug}`,
    lastModified: safeDateISO(new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  const promptEntries: MetadataRoute.Sitemap = WORKFLOW_PROMPTS.map((w) => ({
    url: `${baseUrl}/prompts/${w.slug}`,
    lastModified: safeDateISO(new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  return [
    ...sitemapEntries,
    ...categoryEntries,
    ...bestEntries,
    ...clientEntries,
    ...promptEntries,
    ...blogEntries,
    ...serverEntries,
    ...alternativesEntries,
    ...compareEntries,
  ];
}

