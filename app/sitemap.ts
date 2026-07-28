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
function safeDate(val: unknown): Date {
  if (!val) return new Date();

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }

  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return new Date();
    // If 10-digit Unix timestamp in seconds (< 10_000_000_000), convert to ms
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  if (typeof val === 'string') {
    let str = val.trim();
    if (!str || str === 'null' || str === 'undefined') return new Date();
    // Normalize SQLite format "YYYY-MM-DD HH:MM:SS" to ISO "YYYY-MM-DDTHH:MM:SSZ"
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(str)) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  return new Date();
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
      lastModified: safeDate(new Date()),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/what-is-mcp`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/build-mcp-server`,
      lastModified: safeDate(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    }
  ];

  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = getAllPosts();
    blogEntries = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: safeDate(post.date ? `${post.date}T12:00:00.000Z` : undefined),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (e) {
    console.error('Failed to read blog posts for sitemap', e);
  }

  const serverEntries = servers.map((server) => ({
    url: `${baseUrl}/mcp/${server.id}`,
    lastModified: safeDate(server.lastCheckedAt || server.createdAt || server.created_at),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...sitemapEntries, ...blogEntries, ...serverEntries];
}

