import { and, count, desc, eq, gt, isNotNull, ne, or, sum } from 'drizzle-orm';
import {
  apiAccessLogs,
  impressionLogs,
  servers,
  socialPosts,
  users,
} from '../db/schema';

export type AdminStats = {
  statusCounts: { pending: number; active: number; removed: number };
  premiumCount: number;
  featuredCount: number;
  unhealthyCount: number;
  aiEnrichedCount: number;
  toolsCount: number;
  usersCount: number;
  categorySponsorsCount: number;
  toolsIntrospectionErrorCount: number;
  pendingCounts: {
    submissions: number;
    edits: number;
    claims: number;
    logos: number;
    screenshots: number;
    total: number;
  };
  socialCounts: { queued: number; sent: number; failed: number };
  callerCounts: Record<string, number>;
  surfaceImpressions: Record<string, number>;
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
  recentToolsErrors: {
    id: string;
    name: string;
    toolsError: string;
    toolsCheckedAt: string | null;
  }[];
};

/** `db` is a drizzle-orm/d1 database instance (typed loosely, matching this repo's `drizzle(env.DB as any)` convention). */
export async function getAdminStats(db: any): Promise<AdminStats> {
  const now = new Date();

  const [
    statusRows,
    premiumRows,
    featuredRows,
    unhealthyRows,
    aiEnrichedRows,
    toolsRows,
    pendingEditsRows,
    pendingClaimsRows,
    pendingLogosRows,
    pendingScreenshotsRows,
    usersRows,
    categorySponsorsRows,
    toolsErrorRows,
    logoSourceRows,
    engagementRows,
    topByViewsRows,
    socialRows,
    callerRows,
    surfaceRows,
    recentToolsErrorsRows,
  ] = await Promise.all([
    db
      .select({ status: servers.status, total: count() })
      .from(servers)
      .groupBy(servers.status),
    db
      .select({ total: count() })
      .from(servers)
      .where(eq(servers.isPremium, true)),
    // Matches lib/featuredStatus.ts's isFeaturedListing (premium counts as featured too).
    db
      .select({ total: count() })
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          or(eq(servers.isPremium, true), gt(servers.featuredUntil, now)),
        ),
      ),
    db
      .select({ total: count() })
      .from(servers)
      .where(
        and(eq(servers.status, 'active'), ne(servers.healthStatus, 'healthy')),
      ),
    db
      .select({ total: count() })
      .from(servers)
      .where(isNotNull(servers.aiSummary)),
    db.select({ total: count() }).from(servers).where(isNotNull(servers.tools)),
    db
      .select({ total: count() })
      .from(servers)
      .where(isNotNull(servers.pendingRevision)),
    db
      .select({ total: count() })
      .from(servers)
      .where(isNotNull(servers.pendingClaimUserId)),
    db
      .select({ total: count() })
      .from(servers)
      .where(isNotNull(servers.pendingLogoKey)),
    db
      .select({ total: count() })
      .from(servers)
      .where(isNotNull(servers.pendingScreenshotKey)),
    db
      .select({ total: count() })
      .from(users)
      .catch(() => [{ total: 0 }]),
    db
      .select({ total: count() })
      .from(servers)
      .where(gt(servers.categorySponsorUntil, now)),
    db
      .select({ total: count() })
      .from(servers)
      .where(isNotNull(servers.toolsError)),
    db
      .select({ source: servers.logoSource, total: count() })
      .from(servers)
      .groupBy(servers.logoSource),
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
    db
      .select({ status: socialPosts.status, total: count() })
      .from(socialPosts)
      .groupBy(socialPosts.status)
      .catch(() => []),
    db
      .select({ callerClass: apiAccessLogs.callerClass, total: count() })
      .from(apiAccessLogs)
      .groupBy(apiAccessLogs.callerClass)
      .catch(() => []),
    db
      .select({ surface: impressionLogs.surface, total: count() })
      .from(impressionLogs)
      .groupBy(impressionLogs.surface)
      .catch(() => []),
    db
      .select({
        id: servers.id,
        name: servers.name,
        toolsError: servers.toolsError,
        toolsCheckedAt: servers.toolsCheckedAt,
      })
      .from(servers)
      .where(isNotNull(servers.toolsError))
      .orderBy(desc(servers.toolsCheckedAt))
      .limit(5)
      .catch(() => []),
  ]);

  const statusCounts = { pending: 0, active: 0, removed: 0 };
  for (const row of statusRows as { status: string; total: number }[]) {
    if (
      row.status === 'pending' ||
      row.status === 'active' ||
      row.status === 'removed'
    ) {
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
  for (const row of logoSourceRows as {
    source: string | null;
    total: number;
  }[]) {
    if (row.source === 'manual') logoSourceCounts.manual = row.total;
    else if (row.source === 'readme') logoSourceCounts.readme = row.total;
    else if (row.source === 'website_favicon')
      logoSourceCounts.website_favicon = row.total;
    else if (row.source === 'github_org')
      logoSourceCounts.github_org = row.total;
    else if (row.source === 'github_user')
      logoSourceCounts.github_user = row.total;
    else logoSourceCounts.none += row.total;
  }

  const pendingSubmissions = statusCounts.pending;
  const pendingEdits = pendingEditsRows[0]?.total ?? 0;
  const pendingClaims = pendingClaimsRows[0]?.total ?? 0;
  const pendingLogos = pendingLogosRows[0]?.total ?? 0;
  const pendingScreenshots = pendingScreenshotsRows[0]?.total ?? 0;

  const socialCounts = { queued: 0, sent: 0, failed: 0 };
  for (const row of (socialRows || []) as { status: string; total: number }[]) {
    if (row.status === 'queued') socialCounts.queued = row.total;
    else if (row.status === 'sent') socialCounts.sent = row.total;
    else if (row.status === 'failed') socialCounts.failed = row.total;
  }

  const callerCounts: Record<string, number> = {};
  for (const row of (callerRows || []) as {
    callerClass: string;
    total: number;
  }[]) {
    if (row.callerClass) {
      callerCounts[row.callerClass] = row.total;
    }
  }

  const surfaceImpressions: Record<string, number> = {};
  for (const row of (surfaceRows || []) as {
    surface: string;
    total: number;
  }[]) {
    if (row.surface) {
      surfaceImpressions[row.surface] = row.total;
    }
  }

  const formattedRecentToolsErrors = (recentToolsErrorsRows || []).map(
    (row: any) => ({
      id: row.id,
      name: row.name,
      toolsError: String(row.toolsError || ''),
      toolsCheckedAt:
        row.toolsCheckedAt instanceof Date
          ? row.toolsCheckedAt.toISOString()
          : row.toolsCheckedAt
            ? String(row.toolsCheckedAt)
            : null,
    }),
  );

  return {
    statusCounts,
    premiumCount: premiumRows[0]?.total ?? 0,
    featuredCount: featuredRows[0]?.total ?? 0,
    unhealthyCount: unhealthyRows[0]?.total ?? 0,
    aiEnrichedCount: aiEnrichedRows[0]?.total ?? 0,
    toolsCount: toolsRows[0]?.total ?? 0,
    usersCount: usersRows[0]?.total ?? 0,
    categorySponsorsCount: categorySponsorsRows[0]?.total ?? 0,
    toolsIntrospectionErrorCount: toolsErrorRows[0]?.total ?? 0,
    pendingCounts: {
      submissions: pendingSubmissions,
      edits: pendingEdits,
      claims: pendingClaims,
      logos: pendingLogos,
      screenshots: pendingScreenshots,
      total:
        pendingSubmissions +
        pendingEdits +
        pendingClaims +
        pendingLogos +
        pendingScreenshots,
    },
    socialCounts,
    callerCounts,
    surfaceImpressions,
    logoSourceCounts,
    engagement: {
      totalViews: Number(engagementRows[0]?.totalViews ?? 0),
      totalUpvotes: Number(engagementRows[0]?.totalUpvotes ?? 0),
      totalCopies: Number(engagementRows[0]?.totalCopies ?? 0),
    },
    topByViews: topByViewsRows,
    recentToolsErrors: formattedRecentToolsErrors,
  };
}
