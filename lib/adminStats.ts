import { and, count, desc, eq, gt, ne, sum } from 'drizzle-orm';
import { servers } from '../db/schema';

export type AdminStats = {
  statusCounts: { pending: number; active: number; removed: number };
  premiumCount: number;
  featuredCount: number;
  unhealthyCount: number;
  engagement: { totalViews: number; totalUpvotes: number; totalCopies: number };
  topByViews: { id: string; name: string; views: number }[];
};

/** `db` is a drizzle-orm/d1 database instance (typed loosely, matching this repo's `drizzle(env.DB as any)` convention). */
export async function getAdminStats(db: any): Promise<AdminStats> {
  const now = new Date();

  const [statusRows, premiumRows, featuredRows, unhealthyRows, engagementRows, topByViewsRows] =
    await Promise.all([
      db.select({ status: servers.status, total: count() }).from(servers).groupBy(servers.status),
      db.select({ total: count() }).from(servers).where(eq(servers.isPremium, true)),
      db
        .select({ total: count() })
        .from(servers)
        .where(and(eq(servers.status, 'active'), gt(servers.featuredUntil, now))),
      db
        .select({ total: count() })
        .from(servers)
        .where(and(eq(servers.status, 'active'), ne(servers.healthStatus, 'healthy'))),
      db
        .select({
          totalViews: sum(servers.views),
          totalUpvotes: sum(servers.upvotes),
          totalCopies: sum(servers.copies),
        })
        .from(servers),
      db
        .select({ id: servers.id, name: servers.name, views: servers.views })
        .from(servers)
        .orderBy(desc(servers.views))
        .limit(5),
    ]);

  const statusCounts = { pending: 0, active: 0, removed: 0 };
  for (const row of statusRows as { status: string; total: number }[]) {
    if (row.status === 'pending' || row.status === 'active' || row.status === 'removed') {
      statusCounts[row.status] = row.total;
    }
  }

  return {
    statusCounts,
    premiumCount: premiumRows[0]?.total ?? 0,
    featuredCount: featuredRows[0]?.total ?? 0,
    unhealthyCount: unhealthyRows[0]?.total ?? 0,
    engagement: {
      totalViews: Number(engagementRows[0]?.totalViews ?? 0),
      totalUpvotes: Number(engagementRows[0]?.totalUpvotes ?? 0),
      totalCopies: Number(engagementRows[0]?.totalCopies ?? 0),
    },
    topByViews: topByViewsRows,
  };
}
