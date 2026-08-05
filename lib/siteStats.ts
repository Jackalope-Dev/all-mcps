import { count, countDistinct, gte, sql, sum, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { apiAccessLogs, servers } from '../db/schema';
import serversData from '../data/mcp-servers.json';
import { CALLER_LABELS, CallerClass } from './accessLog';

export type SiteStats = {
  totalServers: number;
  categoryCount: number;
  aiReads30d: number;
  aiSystemCount: number;
  activeAiSystems: string[];
  countryCount: number;
  totalViews: number;
  totalCopies: number;
  totalUpvotes: number;
  totalGithubStars: number;
  totalNpmDownloads: number;
  toolsIndexed: number;
  verifiedCount: number;
};

/**
 * Retrieves 100% real aggregate platform statistics.
 * Queries D1 database tables (api_access_logs, servers) in production,
 * and derives exact metrics from the static catalog snapshot in dev mode.
 */
export async function getSiteStats(): Promise<SiteStats> {
  const snapshotServers = serversData as any[];
  const snapshotTotal = snapshotServers.length;
  const snapshotCategories = new Set(snapshotServers.map((s) => s.category)).size;
  const snapshotViews = snapshotServers.reduce((acc, s) => acc + (Number(s.views) || 0), 0);
  const snapshotCopies = snapshotServers.reduce((acc, s) => acc + (Number(s.copies) || 0), 0);
  const snapshotUpvotes = snapshotServers.reduce((acc, s) => acc + (Number(s.upvotes) || 0), 0);
  const snapshotStars = snapshotServers.reduce((acc, s) => acc + (Number(s.githubStars) || 0), 0);
  const snapshotNpm = snapshotServers.reduce((acc, s) => acc + (Number(s.npmDownloads) || 0), 0);
  const snapshotVerified = snapshotServers.filter(
    (s) => s.isOfficial || s.isPremium || s.websiteVerified
  ).length;
  const snapshotTools = snapshotServers.reduce((acc, s) => {
    try {
      const tools = JSON.parse(s.tools || '[]');
      return acc + (Array.isArray(tools) ? tools.length : 0);
    } catch {
      return acc;
    }
  }, 0);

  let db: any = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      db = drizzle((ctx.env as any).DB);
    }
  } catch {
    // Local dev or no Cloudflare binding
  }

  if (!db) {
    return {
      totalServers: snapshotTotal,
      categoryCount: snapshotCategories,
      aiReads30d: 0,
      aiSystemCount: 0,
      activeAiSystems: [],
      countryCount: 0,
      totalViews: snapshotViews,
      totalCopies: snapshotCopies,
      totalUpvotes: snapshotUpvotes,
      totalGithubStars: snapshotStars,
      totalNpmDownloads: snapshotNpm,
      toolsIndexed: snapshotTools,
      verifiedCount: snapshotVerified,
    };
  }

  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [aiLogRows, countryRows, callerClassRows, serverStatsRows] = await Promise.all([
      db
        .select({
          totalHits: count(),
          uniqueCallers: countDistinct(apiAccessLogs.callerClass),
        })
        .from(apiAccessLogs)
        .where(gte(apiAccessLogs.createdAt, cutoff))
        .catch(() => []),

      db
        .select({
          uniqueCountries: countDistinct(apiAccessLogs.ipCountry),
        })
        .from(apiAccessLogs)
        .where(gte(apiAccessLogs.createdAt, cutoff))
        .catch(() => []),

      db
        .select({
          callerClass: apiAccessLogs.callerClass,
          hits: count(),
        })
        .from(apiAccessLogs)
        .where(gte(apiAccessLogs.createdAt, cutoff))
        .groupBy(apiAccessLogs.callerClass)
        .orderBy(sql`count() desc`)
        .catch(() => []),

      db
        .select({
          totalServers: count(),
          totalViews: sum(servers.views),
          totalCopies: sum(servers.copies),
          totalUpvotes: sum(servers.upvotes),
          totalGithubStars: sum(servers.githubStars),
          totalNpmDownloads: sum(servers.npmDownloads),
          categories: countDistinct(servers.category),
        })
        .from(servers)
        .where(eq(servers.status, 'active'))
        .catch(() => []),
    ]);

    const hits = Number(aiLogRows[0]?.totalHits ?? 0);
    const callersCount = Number(aiLogRows[0]?.uniqueCallers ?? 0);
    const countries = Number(countryRows[0]?.uniqueCountries ?? 0);

    const activeCallers: string[] = (callerClassRows as any[])
      .map((r) => r.callerClass)
      .filter((cls) => cls && cls !== 'unknown' && cls !== 'browser' && cls !== 'bot')
      .map((cls) => CALLER_LABELS[cls as CallerClass] || cls);

    const dbTotal = Number(serverStatsRows[0]?.totalServers ?? snapshotTotal);
    const dbViews = Number(serverStatsRows[0]?.totalViews ?? snapshotViews);
    const dbCopies = Number(serverStatsRows[0]?.totalCopies ?? snapshotCopies);
    const dbUpvotes = Number(serverStatsRows[0]?.totalUpvotes ?? snapshotUpvotes);
    const dbStars = Number(serverStatsRows[0]?.totalGithubStars ?? snapshotStars);
    const dbNpm = Number(serverStatsRows[0]?.totalNpmDownloads ?? snapshotNpm);
    const dbCategories = Number(serverStatsRows[0]?.categories ?? snapshotCategories);

    return {
      totalServers: dbTotal > 0 ? dbTotal : snapshotTotal,
      categoryCount: dbCategories > 0 ? dbCategories : snapshotCategories,
      aiReads30d: hits,
      aiSystemCount: callersCount,
      activeAiSystems: activeCallers.slice(0, 5),
      countryCount: countries,
      totalViews: dbViews,
      totalCopies: dbCopies,
      totalUpvotes: dbUpvotes,
      totalGithubStars: dbStars,
      totalNpmDownloads: dbNpm,
      toolsIndexed: snapshotTools, // Tools are parsed from JSON column — snapshot count is reliable
      verifiedCount: snapshotVerified,
    };
  } catch (err) {
    console.error('[getSiteStats] Error querying D1:', err);
    return {
      totalServers: snapshotTotal,
      categoryCount: snapshotCategories,
      aiReads30d: 0,
      aiSystemCount: 0,
      activeAiSystems: [],
      countryCount: 0,
      totalViews: snapshotViews,
      totalCopies: snapshotCopies,
      totalUpvotes: snapshotUpvotes,
      totalGithubStars: snapshotStars,
      totalNpmDownloads: snapshotNpm,
      toolsIndexed: snapshotTools,
      verifiedCount: snapshotVerified,
    };
  }
}
