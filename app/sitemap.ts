import { MetadataRoute } from 'next';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';
import { getAllPosts } from '../lib/blog';

/**
 * Safely parses and normalizes any date input into a valid Date object.
 * Handles Date objects, Unix timestamps (seconds or ms), ISO strings,
 * SQLite datetime strings ("YYYY-MM-DD HH:MM:SS"), null, undefined,
 * or invalid strings, always returning a valid Date instance.
 */
function safeDateISO(val: unknown): string {
  let d = new Date();
  if (val) {
    if (val instanceof Date) {
      if (!isNaN(val.getTime())) d = val;
    } else if (typeof val === 'number') {
      if (!isNaN(val) && val > 0) {
        // If 10-digit Unix timestamp in seconds (< 10_000_000_000), convert to ms
        const ms = val < 10000000000 ? val * 1000 : val;
        const parsed = new Date(ms);
        if (!isNaN(parsed.getTime())) d = parsed;
      }
    } else if (typeof val === 'string') {
      let str = val.trim();
      if (str && str !== 'null' && str !== 'undefined') {
        // Normalize SQLite format "YYYY-MM-DD HH:MM:SS" to ISO "YYYY-MM-DDTHH:MM:SSZ"
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(str)) {
          str = str.replace(' ', 'T') + 'Z';
        }
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) d = parsed;
      }
    }
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
      url: `${baseUrl}/about`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
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
    }
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

  return [...sitemapEntries, ...blogEntries, ...serverEntries];
}

