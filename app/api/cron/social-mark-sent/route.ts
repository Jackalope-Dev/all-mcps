import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { socialPosts } from '@/db/schema';
import { isAdminAuthorized } from '@/lib/adminAuth';

/**
 * Automation callback for the outbound tweet queue: marks a row `sent` so it drops
 * out of /tweets/rss.xml. Lives under /api/cron/* (unlike /api/admin/social) because
 * that's the one prefix not gated by the Cloudflare Access application in front of
 * /admin — this is meant to be called by the Make.com scenario itself, right after
 * Buffer confirms a post went out, using `Authorization: Bearer <ADMIN_SECRET>` the
 * same way the highlight cron already does. Without it, a queued row never expires,
 * Buffer eventually re-sends something it already posted, X.com rejects it as a
 * duplicate, and Make disables the scenario after enough consecutive 400s.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, guid } = body as { id?: number; guid?: string };
    if (typeof id !== 'number' && !guid) {
      return NextResponse.json({ error: 'id or guid is required.' }, { status: 400 });
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
  } catch (error: any) {
    console.error('Social mark-sent error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
