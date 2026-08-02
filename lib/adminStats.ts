import { and, count, desc, eq, gt, ne, or, sum } from 'drizzle-orm';
import { servers } from '../db/schema';

export type AdminStats = {
  statusCounts: { pending: number; active: number; removed: number };
  premiumCount: number;
  featuredCount: number;
  unhealthyCount: number;
  logoSourceCounts: {
    manual: number;
    readme: number;
    website_favicon: number;
    github_org: number;
    github_user: number;
    none: number;
  };
  engagement: { totalViews: number; totalUpvotes: number; totalCopies: number };
  topByViews: { id: string; name: string; views: number }[];
};

/** `db` is a drizzle-orm/d1 database instance (typed loosely, matching this repo's `drizzle(env.DB as any)` convention). */
export async function getAdminStats(db: any): Promise<AdminStats> {
  const now = new Date();

  const [statusRows, premiumRows, featuredRows, unhealthyRows, logoSourceRows, engagementRows, topByViewsRows] =
    await Promise.all([
      db.select({ status: servers.status, total: count() }).from(servers).groupBy(servers.status),
      db.select({ total: count() }).from(servers).where(eq(servers.isPremium, true)),
      // Matches lib/featuredStatus.ts's isFeaturedListing (premium counts as featured too).
      db
        .select({ total: count() })
        .from(servers)
        .where(
          and(
            eq(servers.status, 'active'),
            or(eq(servers.isPremium, true), gt(servers.featuredUntil, now))
          )
        ),
      db
        .select({ total: count() })
        .from(servers)
        .where(and(eq(servers.status, 'active'), ne(servers.healthStatus, 'healthy'))),
      db.select({ source: servers.logoSource, total: count() }).from(servers).groupBy(servers.logoSource),
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

  const logoSourceCounts = {
    manual: 0,
    readme: 0,
    website_favicon: 0,
    github_org: 0,
    github_user: 0,
    none: 0,
  };
  for (const row of logoSourceRows as { source: string | null; total: number }[]) {
    if (row.source === 'manual') logoSourceCounts.manual = row.total;
    else if (row.source === 'readme') logoSourceCounts.readme = row.total;
    else if (row.source === 'website_favicon') logoSourceCounts.website_favicon = row.total;
    else if (row.source === 'github_org') logoSourceCounts.github_org = row.total;
    else if (row.source === 'github_user') logoSourceCounts.github_user = row.total;
    else logoSourceCounts.none += row.total;
  }

  return {
    statusCounts,
    premiumCount: premiumRows[0]?.total ?? 0,
    featuredCount: featuredRows[0]?.total ?? 0,
    unhealthyCount: unhealthyRows[0]?.total ?? 0,
    logoSourceCounts,
    engagement: {
      totalViews: Number(engagementRows[0]?.totalViews ?? 0),
      totalUpvotes: Number(engagementRows[0]?.totalUpvotes ?? 0),
      totalCopies: Number(engagementRows[0]?.totalCopies ?? 0),
    },
    topByViews: topByViewsRows,
  };
}
