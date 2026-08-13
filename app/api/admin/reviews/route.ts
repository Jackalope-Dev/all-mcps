import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, count, desc, eq } from 'drizzle-orm';
import { reviews, servers, users } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

/**
 * Paginated/filterable review listing for the admin console — the initial
 * page load instead uses a direct query in app/admin/page.tsx's
 * getAdminData() (same pattern as every other pending-queue tab), so this
 * route exists for follow-up fetches beyond the default "pending" queue.
 */
export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const commentStatus = url.searchParams.get('commentStatus') || 'pending';
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT));

    const ctx = await getCloudflareContext();
    const env = ctx.env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database binding not found' }, { status: 500 });
    }
    const db = drizzle(env.DB as any);

    const where = commentStatus !== 'all' ? eq(reviews.commentStatus, commentStatus) : undefined;

    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: reviews.id,
          serverId: reviews.serverId,
          serverName: servers.name,
          reviewerEmail: users.email,
          rating: reviews.rating,
          comment: reviews.comment,
          commentStatus: reviews.commentStatus,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .leftJoin(servers, eq(servers.id, reviews.serverId))
        .leftJoin(users, eq(users.id, reviews.userId))
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(reviews).where(where),
    ]);

    return NextResponse.json({
      items: items.map((r: (typeof items)[number]) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
      total: totalRows[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('Admin reviews error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
