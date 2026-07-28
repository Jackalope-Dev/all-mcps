import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { tweetMcpServer } from '../../../../lib/twitter';
import serversData from '../../../../data/mcp-servers.json';

export async function POST(req: Request) {
  try {
    // Validate authorization (via admin auth or CRON_SECRET header)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthorized && !(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let selectedServer: { id: string; name: string; description: string; category?: string; isFeatured?: boolean } | null = null;

    try {
      const ctx = await getCloudflareContext();
      if (ctx && ctx.env && (ctx.env as any).DB) {
        const db = drizzle((ctx.env as any).DB);
        const activeServers = await db.select().from(servers).where(eq(servers.status, 'active'));
        
        if (activeServers.length > 0) {
          const now = new Date();
          // Filter premium / featured / official / reviewPriority servers
          const premiumServers = activeServers.filter(
            (s) =>
              s.isPremium ||
              s.reviewPriority ||
              s.isOfficial ||
              s.premiumStatus === 'active' ||
              (s.featuredUntil && new Date(s.featuredUntil) > now)
          );

          // 80% chance to pick from premium pool if available; 20% standard rotation
          const usePremiumPool = premiumServers.length > 0 && Math.random() < 0.8;
          const pool = usePremiumPool ? premiumServers : activeServers;
          
          const randomIndex = Math.floor(Math.random() * pool.length);
          const item = pool[randomIndex];
          const isFeatured = Boolean(
            item.isPremium ||
            item.reviewPriority ||
            item.isOfficial ||
            item.premiumStatus === 'active' ||
            (item.featuredUntil && new Date(item.featuredUntil) > now)
          );

          selectedServer = {
            id: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            isFeatured,
          };
        }
      }
    } catch (e) {
      console.warn('Could not query Cloudflare D1 for highlight, falling back to static JSON.', e);
    }

    // Fallback to static servers data if D1 is not accessible
    if (!selectedServer && Array.isArray(serversData) && serversData.length > 0) {
      const randomIndex = Math.floor(Math.random() * serversData.length);
      const item = (serversData as any)[randomIndex];
      selectedServer = {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        isFeatured: false,
      };
    }

    if (!selectedServer) {
      return NextResponse.json({ error: 'No active MCP servers found to highlight.' }, { status: 404 });
    }

    const tweetResult = await tweetMcpServer({
      id: selectedServer.id,
      name: selectedServer.name,
      description: selectedServer.description,
      category: selectedServer.category,
      isNew: false,
      isFeatured: selectedServer.isFeatured,
    });

    return NextResponse.json({
      success: true,
      server: selectedServer,
      tweetResult,
    });
  } catch (error: any) {
    console.error('Highlight cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
