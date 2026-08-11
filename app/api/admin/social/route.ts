import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { socialPosts, servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { dedupeTweetItems, normalizeTweetForDedup, tweetMcpServer } from '@/lib/twitter';

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    const posts = await db
      .select({
        id: socialPosts.id,
        guid: socialPosts.guid,
        channel: socialPosts.channel,
        status: socialPosts.status,
        serverId: socialPosts.serverId,
        tweetText: socialPosts.tweetText,
        source: socialPosts.source,
        createdAt: socialPosts.createdAt,
        sentAt: socialPosts.sentAt,
      })
      .from(socialPosts)
      .orderBy(desc(socialPosts.createdAt))
      .limit(50);

    return NextResponse.json({
      posts: posts.map((p: typeof posts[number]) => ({
        ...p,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
        sentAt: p.sentAt instanceof Date ? p.sentAt.toISOString() : p.sentAt ? String(p.sentAt) : null,
      })),
    });
  } catch (error: any) {
    console.error('Admin social GET error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Admin dashboard authenticates via Cloudflare Access; automation callers
    // (the Make.com scenario, once Buffer confirms a post went out) can't present
    // that, so they authenticate with `Authorization: Bearer <ADMIN_SECRET>` instead,
    // same pattern as the highlight cron.
    if (!(await getAuthorizedAdminEmail(req.headers)) && !(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, serverId, tweetText, id, guid } = body as {
      action?: string;
      serverId?: string;
      tweetText?: string;
      id?: number;
      guid?: string;
    };

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    // Mark a queued post as sent so it drops out of the outbound RSS feed. Use this
    // for a row Buffer already posted successfully (an "identify successful posts and
    // clear them" action) — the feed only serves status='queued' rows. Accepts `guid`
    // (all the Make.com scenario ever sees, from the RSS item) as well as the internal
    // `id` (used by the admin dashboard) — without this getting marked, the same row
    // stays in the feed forever and Buffer eventually re-sends it, which X.com rejects
    // as a duplicate and Make disables the scenario after enough consecutive 400s.
    if (action === 'mark_sent') {
      if (typeof id !== 'number' && !guid) {
        return NextResponse.json({ error: 'id or guid is required.' }, { status: 400 });
      }
      const where = typeof id === 'number' ? eq(socialPosts.id, id) : eq(socialPosts.guid, guid!);
      const updated = await db
        .update(socialPosts)
        .set({ status: 'sent', sentAt: new Date() })
        .where(where)
        .returning({ id: socialPosts.id });
      if (updated.length === 0) {
        return NextResponse.json({ error: 'No matching queued post found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Post marked as sent.' });
    }

    // Clear duplicate queued tweets so Buffer never receives two posts X.com would
    // reject as identical. Keeps the newest row of each unique body and deletes the
    // older duplicates.
    if (action === 'dedupe_queue') {
      const queued = await db
        .select({ id: socialPosts.id, tweetText: socialPosts.tweetText })
        .from(socialPosts)
        .where(and(eq(socialPosts.channel, 'twitter'), eq(socialPosts.status, 'queued')))
        .orderBy(desc(socialPosts.createdAt));

      const keepIds = new Set(dedupeTweetItems(queued).map((row) => row.id));
      const duplicateIds = queued.filter((row) => !keepIds.has(row.id)).map((row) => row.id);

      if (duplicateIds.length > 0) {
        await db.delete(socialPosts).where(inArray(socialPosts.id, duplicateIds));
      }

      return NextResponse.json({
        success: true,
        cleared: duplicateIds.length,
        message:
          duplicateIds.length > 0
            ? `Cleared ${duplicateIds.length} duplicate queued tweet${duplicateIds.length === 1 ? '' : 's'}.`
            : 'No duplicate queued tweets found.',
      });
    }

    if (action === 'queue_tweet') {
      if (!serverId && !tweetText) {
        return NextResponse.json({ error: 'serverId or tweetText is required.' }, { status: 400 });
      }

      if (serverId) {
        const rows = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
        const server = rows[0];
        if (!server) {
          return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
        }

        const tweetResult = await tweetMcpServer(
          db,
          {
            id: server.id,
            name: server.name,
            description: server.description,
            category: server.category,
            isNew: false,
          },
          { source: 'admin_manual' }
        );

        return NextResponse.json({
          success: true,
          message: 'Social post queued successfully.',
          result: tweetResult,
        });
      } else if (tweetText) {
        // Refuse to queue a body identical to one already waiting in the feed —
        // Buffer would post the first and X.com would reject the second as a repeat.
        const normalized = normalizeTweetForDedup(tweetText);
        const existingQueued = await db
          .select({ tweetText: socialPosts.tweetText })
          .from(socialPosts)
          .where(and(eq(socialPosts.channel, 'twitter'), eq(socialPosts.status, 'queued')));
        if (existingQueued.some((row) => normalizeTweetForDedup(row.tweetText) === normalized)) {
          return NextResponse.json(
            { error: 'An identical tweet is already queued.' },
            { status: 409 },
          );
        }

        const guid = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await db.insert(socialPosts).values({
          guid,
          channel: 'twitter',
          status: 'queued',
          tweetText: tweetText.trim(),
          source: 'admin_custom',
        });
        return NextResponse.json({ success: true, message: 'Custom tweet queued successfully.' });
      }
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin social POST error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
