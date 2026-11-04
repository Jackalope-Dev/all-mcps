import {
  and,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
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
    /** Pending rows with no submitterEmail (scripts/ingest-sources.mjs, not
     * a human /api/submit) — self-resolve via the daily auto-promote cron,
     * excluded from `submissions`/`total` so those stay "needs an admin". */
    syncQueue: number;
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

/** Rows in `servers` matching `cond`, as a column of the one-scan count query. */
function countWhere(cond: SQL | undefined): SQL<number> {
  return sql<number>`coalesce(sum(case when ${cond} then 1 else 0 end), 0)`;
}

/** `db` is a drizzle-orm/d1 database instance (typed loosely, matching this repo's `drizzle(env.DB as any)` convention). */
export async function getAdminStats(db: any): Promise<AdminStats> {
  const now = new Date();
  const active = eq(servers.status, 'active');

  const [
    serverRows,
    usersRows,
    topByViewsRows,
    socialRows,
    callerRows,
    surfaceRows,
    recentToolsErrorsRows,
  ] = await Promise.all([
    // Every servers count in ONE scan. As ~14 separate count queries fired at
    // once, each scanning the full table, an /admin load alone could push D1
    // past its 10-second resource limit ("D1 DB is overloaded"), and the
    // page's catch-all rendered every card as 0.
    db
      .select({
        pending: countWhere(eq(servers.status, 'pending')),
        active: countWhere(active),
        removed: countWhere(eq(servers.status, 'removed')),
        premium: countWhere(eq(servers.isPremium, true)),
        // Matches lib/featuredStatus.ts's isFeaturedListing (premium counts as featured too).
        featured: countWhere(
          and(
            active,
            or(eq(servers.isPremium, true), gt(servers.featuredUntil, now)),
          ),
        ),
        unhealthy: countWhere(and(active, ne(servers.healthStatus, 'healthy'))),
        aiEnriched: countWhere(and(active, isNotNull(servers.aiSummary))),
        tools: countWhere(isNotNull(servers.tools)),
        manualPending: countWhere(
          and(eq(servers.status, 'pending'), isNotNull(servers.submitterEmail)),
        ),
        pendingEdits: countWhere(isNotNull(servers.pendingRevision)),
        pendingClaims: countWhere(isNotNull(servers.pendingClaimUserId)),
        pendingLogos: countWhere(isNotNull(servers.pendingLogoKey)),
        pendingScreenshots: countWhere(isNotNull(servers.pendingScreenshotKey)),
        categorySponsors: countWhere(gt(servers.categorySponsorUntil, now)),
        toolsErrors: countWhere(and(active, isNotNull(servers.toolsError))),
        logoManual: countWhere(eq(servers.logoSource, 'manual')),
        logoReadme: countWhere(eq(servers.logoSource, 'readme')),
        logoFavicon: countWhere(eq(servers.logoSource, 'website_favicon')),
        logoGithubOrg: countWhere(eq(servers.logoSource, 'github_org')),
        logoGithubUser: countWhere(eq(servers.logoSource, 'github_user')),
        rows: count(),
        totalViews: sql<number>`coalesce(sum(${servers.views}), 0)`,
        totalUpvotes: sql<number>`coalesce(sum(${servers.upvotes}), 0)`,
        totalCopies: sql<number>`coalesce(sum(${servers.copies}), 0)`,
      })
      .from(servers),
    db
      .select({ total: count() })
      .from(users)
      .catch(() => [{ total: 0 }]),
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

  const c = serverRows[0] as Record<string, number | string | null>;
  const n = (k: string) => Number(c?.[k] ?? 0);

  const statusCounts = {
    pending: n('pending'),
    active: n('active'),
    removed: n('removed'),
  };

  const logoSourceCounts = {
    manual: n('logoManual'),
    readme: n('logoReadme'),
    website_favicon: n('logoFavicon'),
    github_org: n('logoGithubOrg'),
    github_user: n('logoGithubUser'),
    none: 0,
  };
  // Null and any unrecognized source, as before.
  logoSourceCounts.none =
    n('rows') -
    logoSourceCounts.manual -
    logoSourceCounts.readme -
    logoSourceCounts.website_favicon -
    logoSourceCounts.github_org -
    logoSourceCounts.github_user;

  const pendingManualSubmissions = n('manualPending');
  const pendingSyncQueue = statusCounts.pending - pendingManualSubmissions;
  const pendingEdits = n('pendingEdits');
  const pendingClaims = n('pendingClaims');
  const pendingLogos = n('pendingLogos');
  const pendingScreenshots = n('pendingScreenshots');

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
    premiumCount: n('premium'),
    featuredCount: n('featured'),
    unhealthyCount: n('unhealthy'),
    aiEnrichedCount: n('aiEnriched'),
    toolsCount: n('tools'),
    usersCount: usersRows[0]?.total ?? 0,
    categorySponsorsCount: n('categorySponsors'),
    toolsIntrospectionErrorCount: n('toolsErrors'),
    pendingCounts: {
      submissions: pendingManualSubmissions,
      syncQueue: pendingSyncQueue,
      edits: pendingEdits,
      claims: pendingClaims,
      logos: pendingLogos,
      screenshots: pendingScreenshots,
      total:
        pendingManualSubmissions +
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
      totalViews: n('totalViews'),
      totalUpvotes: n('totalUpvotes'),
      totalCopies: n('totalCopies'),
    },
    topByViews: topByViewsRows,
    recentToolsErrors: formattedRecentToolsErrors,
  };
}
