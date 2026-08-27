import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers, socialPosts } from '@/db/schema';
import { isAdminAuthorized } from '@/lib/adminAuth';

/**
 * Automation callback for the outbound tweet queue: marks a row `sent` so it drops
 * out of /tweets/rss.xml. Lives under /api/cron/* (unlike /api/admin/social) because
 * that's the one prefix not gated by the Cloudflare Access application in front of
 * /admin — this is meant to be called by the Make.com scenario itself, right after
 * Buffer/Twitter confirms a post went out, using `Authorization: Bearer <CRON_SECRET>`
 * or `<ADMIN_SECRET>`. Without it, a queued row never expires, Buffer/Make eventually
 * re-sends something it already posted, X.com rejects it as a duplicate, and Make
 * disables the scenario after enough consecutive 400s.
 */
async function handleMarkSent(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const isCronAuthorized =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthorized && !(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let id: number | undefined;
    let guid: string | undefined;
    let guids: string[] | undefined;

    // Check URL search parameters (convenient for webhook GET/POST)
    const url = new URL(req.url);
    const queryGuid = url.searchParams.get('guid');
    const queryId = url.searchParams.get('id');

    if (queryGuid) guid = queryGuid;
    if (queryId) id = Number(queryId);

    // If body exists (POST), parse json
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as {
        guid?: string;
        id?: number;
        guids?: string[];
      };
      if (body.guid) guid = body.guid;
      if (typeof body.id === 'number') id = body.id;
      if (Array.isArray(body.guids)) guids = body.guids;
    }

    if (typeof id !== 'number' && !guid && (!guids || guids.length === 0)) {
      return NextResponse.json(
        { error: 'id, guid, or guids is required.' },
        { status: 400 },
      );
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env?.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);
    const sentAt = new Date();

    let updated: Array<{ id: number; serverId: string | null }> = [];

    if (guids && guids.length > 0) {
      updated = await db
        .update(socialPosts)
        .set({ status: 'sent', sentAt })
        .where(inArray(socialPosts.guid, guids))
        .returning({ id: socialPosts.id, serverId: socialPosts.serverId });
    } else {
      const where =
        typeof id === 'number'
          ? eq(socialPosts.id, id)
          : eq(socialPosts.guid, guid!);
      updated = await db
        .update(socialPosts)
        .set({ status: 'sent', sentAt })
        .where(where)
        .returning({ id: socialPosts.id, serverId: socialPosts.serverId });
    }

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'No matching queued post found.' },
        { status: 404 },
      );
    }

    // Stamp lastFeaturedAt on the associated server
    for (const post of updated) {
      if (post.serverId) {
        await db
          .update(servers)
          .set({ lastFeaturedAt: sentAt })
          .where(eq(servers.id, post.serverId))
          .catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: `Marked ${updated.length} post(s) as sent.`,
      count: updated.length,
    });
  } catch (error: any) {
    console.error('Social mark-sent error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handleMarkSent(req);
}

export async function GET(req: Request) {
  return handleMarkSent(req);
}
