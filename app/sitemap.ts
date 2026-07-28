import { MetadataRoute } from 'next';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';

export const runtime = 'edge';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://allmcps.com';
  
  let servers = serversData as any[];
  
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
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
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }
  ];

  const serverEntries = servers.map((server) => ({
    url: `${baseUrl}/mcp/${server.id}`,
    lastModified: server.lastCheckedAt ? new Date(server.lastCheckedAt) : new Date(server.createdAt || new Date()),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...sitemapEntries, ...serverEntries];
}
