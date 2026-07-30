import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { tweetMcpServer } from '../../../../lib/twitter';
import serversData from '../../../../data/mcp-servers.json';

// A listing counts as "new" (eligible for the new-server tier) for this many days
// after it was created.
const NEW_WINDOW_DAYS = 14;
// Priority weighting for which tier gets the highlight. Featured first, new next,
// everything else fills the remainder — each tier still rotates internally.
const FEATURED_SHARE = 0.6;
const NEW_SHARE = 0.25;

export async function POST(req: Request) {
  try {
    // Validate authorization (via admin auth or CRON_SECRET header)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthorized && !(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let selectedServer:
      | { id: string; name: string; description: string; category?: string; isFeatured?: boolean; isNew?: boolean }
      | null = null;
    // Held so we can stamp `lastTweetedAt` only after a successful post (D1 path only).
    let db: ReturnType<typeof drizzle> | null = null;

    try {
      const ctx = await getCloudflareContext();
      if (ctx && ctx.env && (ctx.env as any).DB) {
        db = drizzle((ctx.env as any).DB);
        const activeServers = await db.select().from(servers).where(eq(servers.status, 'active'));

        if (activeServers.length > 0) {
          const now = new Date();
          const newCutoff = new Date(now.getTime() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);

          type Row = (typeof activeServers)[number];
          const isFeatured = (s: Row) =>
            Boolean(
              s.isPremium ||
                s.reviewPriority ||
                s.isOfficial ||
                s.premiumStatus === 'active' ||
                (s.featuredUntil && new Date(s.featuredUntil) > now)
            );
          const isNewServer = (s: Row) =>
            !isFeatured(s) && Boolean(s.createdAt && new Date(s.createdAt) > newCutoff);

          // Never-posted (null) sorts first, then oldest post first — so a full
          // rotation happens before anything repeats.
          const leastRecentlyTweeted = (a: Row, b: Row) => {
            const ta = a.lastTweetedAt ? new Date(a.lastTweetedAt).getTime() : 0;
            const tb = b.lastTweetedAt ? new Date(b.lastTweetedAt).getTime() : 0;
            return ta - tb;
          };

          const featuredPool = activeServers.filter(isFeatured).sort(leastRecentlyTweeted);
          const newPool = activeServers.filter(isNewServer).sort(leastRecentlyTweeted);
          const restPool = activeServers
            .filter((s) => !isFeatured(s) && !isNewServer(s))
            .sort(leastRecentlyTweeted);

          // Priority with weighted rotation: featured get the spotlight most often,
          // new servers next, everything else fills in — but each tier still cycles
          // least-recently-posted first, so nothing repeats until its tier is exhausted.
          const roll = Math.random();
          let pool: Row[];
          if (featuredPool.length && roll < FEATURED_SHARE) {
            pool = featuredPool;
          } else if (newPool.length && roll < FEATURED_SHARE + NEW_SHARE) {
            pool = newPool;
          } else if (restPool.length) {
            pool = restPool;
          } else if (newPool.length) {
            pool = newPool;
          } else {
            pool = featuredPool;
          }

          const item = pool[0];
          const featuredFlag = isFeatured(item);

          selectedServer = {
            id: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            isFeatured: featuredFlag,
            isNew: !featuredFlag && isNewServer(item),
          };
        }
      }
    } catch (e) {
      console.warn('Could not query Cloudflare D1 for highlight, falling back to static JSON.', e);
    }

    // Fallback to static servers data if D1 is not accessible (no rotation state here).
    if (!selectedServer && Array.isArray(serversData) && serversData.length > 0) {
      db = null;
      const randomIndex = Math.floor(Math.random() * serversData.length);
      const item = (serversData as any)[randomIndex];
      selectedServer = {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        isFeatured: false,
        isNew: false,
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
      isNew: selectedServer.isNew,
      isFeatured: selectedServer.isFeatured,
    });

    // Record the post so the next run rotates to a different server. Only on a real
    // send — a failed tweet shouldn't burn the server's turn in the rotation.
    if (db && tweetResult?.success) {
      try {
        await db.update(servers).set({ lastTweetedAt: new Date() }).where(eq(servers.id, selectedServer.id));
      } catch (e) {
        console.warn('Posted highlight but failed to record lastTweetedAt.', e);
      }
    }

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
