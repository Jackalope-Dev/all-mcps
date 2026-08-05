import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import { socialPosts, servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';
import { tweetMcpServer } from '@/lib/twitter';

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
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, serverId, tweetText } = body as { action?: string; serverId?: string; tweetText?: string };

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
