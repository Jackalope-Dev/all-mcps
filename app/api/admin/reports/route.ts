import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, count, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { reports, servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

/**
 * Paginated/filterable report listing for the admin console — the initial
 * page load instead uses a direct query in app/admin/page.tsx's
 * getAdminData() (same pattern as every other pending-queue tab), so this
 * route exists for follow-up fetches (e.g. filtering by status/reason
 * beyond the default "open" queue) rather than the first render.
 */
export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'open';
    const reason = url.searchParams.get('reason');
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT),
    );

    const ctx = await getCloudflareContext();
    const env = ctx.env;
    if (!env?.DB) {
      return NextResponse.json(
        { error: 'Database binding not found' },
        { status: 500 },
      );
    }
    const db = drizzle(env.DB as any);

    const conditions = [];
    if (status !== 'all') conditions.push(eq(reports.status, status));
    if (reason) conditions.push(eq(reports.reason, reason));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: reports.id,
          serverId: reports.serverId,
          serverName: servers.name,
          reason: reports.reason,
          details: reports.details,
          status: reports.status,
          createdAt: reports.createdAt,
          reviewedAt: reports.reviewedAt,
        })
        .from(reports)
        .leftJoin(servers, eq(servers.id, reports.serverId))
        .where(where)
        .orderBy(desc(reports.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(reports).where(where),
    ]);

    return NextResponse.json({
      items: items.map((r: (typeof items)[number]) => ({
        ...r,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
        reviewedAt:
          r.reviewedAt instanceof Date
            ? r.reviewedAt.toISOString()
            : r.reviewedAt,
      })),
      total: totalRows[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('Admin reports error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
