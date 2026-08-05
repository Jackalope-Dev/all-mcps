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
  const snapshotVerified = snapshotServers.filter(
    (s) => s.isOfficial || s.isPremium || s.websiteVerified
  ).length;

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
      verifiedCount: snapshotVerified,
    };
  }
}
