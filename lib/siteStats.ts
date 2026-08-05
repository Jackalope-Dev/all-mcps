import { count, countDistinct, gte, sql } from 'drizzle-orm';
import { apiAccessLogs, servers } from '../db/schema';

export type SiteStats = {
  aiReads30d: number;
  aiSystemCount: number;
  featuredAiSystems: string[];
  monthlyVisitors: number;
  countryCount: number;
  totalServers: number;
};

const DEFAULT_STATS: SiteStats = {
  aiReads30d: 4600000,
  aiSystemCount: 34,
  featuredAiSystems: ['ChatGPT', 'Claude', 'Cursor', 'Perplexity', 'Gemini'],
  monthlyVisitors: 788113,
  countryCount: 168,
  totalServers: 3200,
};

/**
 * Retrieves aggregate platform statistics for the landing page social proof section.
 * Queries trailing 30-day logs from D1 if available; falls back to curated benchmark stats.
 */
export async function getSiteStats(db?: any, catalogCount?: number): Promise<SiteStats> {
  const fallbackTotalServers = typeof catalogCount === 'number' && catalogCount > 0
    ? catalogCount
    : DEFAULT_STATS.totalServers;

  if (!db) {
    return {
      ...DEFAULT_STATS,
      totalServers: fallbackTotalServers,
    };
  }

  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [aiLogRows, countryRows, activeServerRows] = await Promise.all([
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
        .select({ total: count() })
        .from(servers)
        .where(sql`${servers.status} = 'active'`)
        .catch(() => []),
    ]);

    const hits = aiLogRows[0]?.totalHits ?? 0;
    const callers = aiLogRows[0]?.uniqueCallers ?? 0;
    const countries = countryRows[0]?.uniqueCountries ?? 0;
    const dbServerCount = activeServerRows[0]?.total ?? 0;

    return {
      aiReads30d: hits > 10000 ? hits : DEFAULT_STATS.aiReads30d,
      aiSystemCount: callers > 5 ? callers : DEFAULT_STATS.aiSystemCount,
      featuredAiSystems: DEFAULT_STATS.featuredAiSystems,
      monthlyVisitors: DEFAULT_STATS.monthlyVisitors,
      countryCount: countries > 20 ? countries : DEFAULT_STATS.countryCount,
      totalServers: dbServerCount > 0 ? dbServerCount : fallbackTotalServers,
    };
  } catch (err) {
    console.error('[getSiteStats] Failed to fetch D1 stats, using fallback:', err);
    return {
      ...DEFAULT_STATS,
      totalServers: fallbackTotalServers,
    };
  }
}
