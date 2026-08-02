import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers, socialPosts } from '../../../../db/schema';
import { eq, lt } from 'drizzle-orm';
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
// Never repost the same listing inside this window. Without it, a small high-priority
// tier (e.g. a single paid listing that wins the ~60% featured roll) sits at the top
// of the rotation every run and gets tweeted over and over. Configurable via env so it
// can be pushed out to effectively "never repeat" if desired.
const REPOST_COOLDOWN_DAYS = Number(process.env.TWEET_REPOST_COOLDOWN_DAYS) || 365;
const HIGHLIGHT_INTERVAL_HOURS = 4;
const FEED_RETENTION_DAYS = Number(process.env.TWEET_FEED_RETENTION_DAYS) || 180;

function getHighlightSlotKey(now: Date): string {
  const slotMs = HIGHLIGHT_INTERVAL_HOURS * 60 * 60 * 1000;
  const slotStart = new Date(Math.floor(now.getTime() / slotMs) * slotMs);
  return slotStart.toISOString();
}

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
          const cooldownCutoff = new Date(now.getTime() - REPOST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

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

          // A listing is eligible only if it has never been tweeted, or was last
          // tweeted before the cooldown window — this is the guard that stops the
          // same server (especially a lone paid listing) from being reposted.
          const isEligible = (s: Row) =>
            !s.lastTweetedAt || new Date(s.lastTweetedAt) <= cooldownCutoff;

          // Full tiers (for the relaxed fallback below), least-recently-tweeted first.
          const featuredAll = activeServers.filter(isFeatured).sort(leastRecentlyTweeted);
          const newAll = activeServers.filter(isNewServer).sort(leastRecentlyTweeted);
          const restAll = activeServers
            .filter((s) => !isFeatured(s) && !isNewServer(s))
            .sort(leastRecentlyTweeted);

          // Same tiers, but only listings outside the repost cooldown.
          const featuredPool = featuredAll.filter(isEligible);
          const newPool = newAll.filter(isEligible);
          const restPool = restAll.filter(isEligible);

          // Priority with weighted rotation over *eligible* listings: featured/paid get
          // the spotlight most often, new servers next, everything else fills in. Within
          // the chosen tier we pick at random for variety, and the cooldown filter
          // guarantees nothing repeats until it ages out of the window.
          const roll = Math.random();
          let pool: Row[];
          // True while we're drawing from the cooldown-filtered eligible pools (pick at
          // random); false only in the relaxed fallback below (every listing is inside
          // the cooldown, so take the one tweeted longest ago instead).
          let eligible = true;
          if (featuredPool.length && roll < FEATURED_SHARE) {
            pool = featuredPool;
          } else if (newPool.length && roll < FEATURED_SHARE + NEW_SHARE) {
            pool = newPool;
          } else if (restPool.length) {
            pool = restPool;
          } else if (featuredPool.length) {
            pool = featuredPool;
          } else if (newPool.length) {
            pool = newPool;
          } else {
            // Every listing has been tweeted within the cooldown window. Rather than
            // stay silent, relax the cooldown and repost the one tweeted longest ago,
            // still giving featured/paid listings priority.
            pool = featuredAll.length ? featuredAll : newAll.length ? newAll : restAll;
            eligible = false;
          }

          // Random pick among eligible listings gives real variety between posts; the
          // cooldown filter already guarantees none of them repeat. In the relaxed
          // fallback we deterministically take the least-recently-tweeted (pool[0]).
          const item = eligible ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
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

    if (!db) {
      return NextResponse.json(
        { error: 'Tweet queue storage is unavailable (DB not accessible).' },
        { status: 503 },
      );
    }

    const now = new Date();
    const tweetResult = await tweetMcpServer(db, {
      id: selectedServer.id,
      name: selectedServer.name,
      description: selectedServer.description,
      category: selectedServer.category,
      isNew: selectedServer.isNew,
      isFeatured: selectedServer.isFeatured,
    }, {
      source: 'highlight_cron',
      dedupeKey: `highlight:${getHighlightSlotKey(now)}`,
      now,
    });

    if (!tweetResult.success) {
      return NextResponse.json(
        { error: tweetResult.error || 'Failed to enqueue tweet item.', server: selectedServer, tweetResult },
        { status: 500 },
      );
    }

    // Record rotation only when we successfully created a new queue item.
    if (tweetResult?.success && tweetResult?.queued) {
      try {
        await db.update(servers).set({ lastTweetedAt: new Date() }).where(eq(servers.id, selectedServer.id));
        const retentionCutoff = new Date(Date.now() - FEED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await db.delete(socialPosts).where(lt(socialPosts.createdAt, retentionCutoff));
      } catch (e) {
        console.warn('Queued highlight but failed post-enqueue housekeeping.', e);
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
