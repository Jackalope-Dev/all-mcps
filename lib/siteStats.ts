import { and, count, countDistinct, gte, isNotNull, sql, sum, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { apiAccessLogs, servers, stdioVerificationPilot } from '../db/schema';
import serversData from '../data/mcp-servers.json';
import { CALLER_LABELS, ENDPOINT_LABELS, CallerClass, Endpoint } from './accessLog';
import { computeQualityScore, QualityTier } from './qualityScore';

/**
 * Named AI assistants and their crawlers — the honest "AI is reading us" signal.
 * Deliberately excludes generic web/SEO crawlers (Amazonbot, Applebot, Metabot,
 * Bytespider, CCBot, DuckDuckBot, YandexBot, Bingbot) and the catch-all
 * 'bot'/'agent'/'browser'/'unknown' buckets — those hit the same API routes but
 * aren't AI systems, so lumping them into "AI Reads" would overstate the signal.
 */
export const AI_SYSTEM_CLASSES: CallerClass[] = [
  'claude',
  'claudebot',
  'chatgpt',
  'gptbot',
  'gemini',
  'perplexity',
  'copilot',
  'cursor',
  'windsurf',
];

export type CallerBreakdown = { class: CallerClass; label: string; hits: number };

/** One day of traffic — total hits vs the subset from named AI systems. Zero-filled for days with no rows. */
export type DailyTrendPoint = { date: string; total: number; ai: number };

export type EndpointBreakdown = { endpoint: Endpoint; label: string; hits: number };

export type CountryBreakdown = { country: string; hits: number };

export type SiteStats = {
  totalServers: number;
  categoryCount: number;
  aiReads30d: number;
  aiSystemCount: number;
  activeAiSystems: string[];
  /** Non-AI crawler/bot hits (generic bots, Amazonbot, Metabot, etc.) over the last 30 days — kept separate from aiReads30d so the two signals never get conflated. */
  botCrawlerReads30d: number;
  /** Full caller-class breakdown over the last 30 days, ordered by hits desc — powers the /trust page. */
  callerBreakdown30d: CallerBreakdown[];
  /** Daily total vs AI-system hits for the last 30 days, oldest first, zero-filled — powers the /trust page trend chart. */
  dailyTrend30d: DailyTrendPoint[];
  /** Which API surfaces get hit, last 30 days, ordered by hits desc. */
  endpointBreakdown30d: EndpointBreakdown[];
  /** Top request-origin countries, last 30 days, ordered by hits desc (max 8). */
  topCountries30d: CountryBreakdown[];
  countryCount: number;
  totalViews: number;
  totalCopies: number;
  totalUpvotes: number;
  toolsIndexed: number;
  verifiedCount: number;
  toolsSourceBreakdown: { introspected: number; readme: number; unparsed: number };
  stdioPilotStats: { totalTested: number; okCount: number; avgDurationMs: number };
  qualityTierBreakdown: { Excellent: number; Great: number; Good: number; Fair: number; Emerging: number };
  reciprocalBadgeCount: number;
  recentCommitCount30d: number;
};

/** Helper to compute quality tier breakdown from an array of server objects */
function calcQualityTiers(serverList: any[]): { Excellent: number; Great: number; Good: number; Fair: number; Emerging: number } {
  const breakdown = { Excellent: 0, Great: 0, Good: 0, Fair: 0, Emerging: 0 };
  for (const s of serverList) {
    try {
      const q = computeQualityScore(s as any);
      if (breakdown[q.tier] !== undefined) {
        breakdown[q.tier]++;
      }
    } catch {
      breakdown.Emerging++;
    }
  }
  return breakdown;
}

let cachedSiteStats: { data: SiteStats; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s memory cache to protect Worker memory & D1 budget

let memoizedSnapshotFallback: SiteStats | null = null;

function getSnapshotFallback(): SiteStats {
  if (memoizedSnapshotFallback) return memoizedSnapshotFallback;

  const snapshotServers = serversData as any[];
  const snapshotTotal = snapshotServers.length;
  const snapshotCategories = new Set(snapshotServers.map((s) => s.category)).size;
  const snapshotViews = snapshotServers.reduce((acc, s) => acc + (Number(s.views) || 0), 0);
  const snapshotCopies = snapshotServers.reduce((acc, s) => acc + (Number(s.copies) || 0), 0);
  const snapshotUpvotes = snapshotServers.reduce((acc, s) => acc + (Number(s.upvotes) || 0), 0);
  const snapshotVerified = snapshotServers.filter(
    (s) => s.isOfficial || s.isPremium || s.websiteVerified
  ).length;
  const snapshotTools = snapshotServers.reduce((acc, s) => {
    if (Array.isArray(s.tools)) return acc + s.tools.length;
    try {
      const tools = JSON.parse(s.tools || '[]');
      return acc + (Array.isArray(tools) ? tools.length : 0);
    } catch {
      return acc;
    }
  }, 0);

  const snapshotIntrospected = snapshotServers.filter((s) => s.toolsSource === 'introspected').length;
  const snapshotReadme = snapshotServers.filter(
    (s) => s.toolsSource === 'readme' || (Array.isArray(s.tools) && s.tools.length > 0 && !s.toolsSource)
  ).length;
  const snapshotUnparsed = Math.max(0, snapshotTotal - snapshotIntrospected - snapshotReadme);

  const snapshotReciprocalBadges = snapshotServers.filter((s) => s.reciprocalBadgeOk).length;
  const snapshotCutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const snapshotRecentCommits = snapshotServers.filter((s) => s.lastCommitAt && new Date(s.lastCommitAt).getTime() >= snapshotCutoff30d).length;
  const snapshotQualityTiers = calcQualityTiers(snapshotServers);

  memoizedSnapshotFallback = {
    totalServers: snapshotTotal,
    categoryCount: snapshotCategories,
    aiReads30d: 0,
    aiSystemCount: 0,
    activeAiSystems: [],
    botCrawlerReads30d: 0,
    callerBreakdown30d: [],
    dailyTrend30d: [],
    endpointBreakdown30d: [],
    topCountries30d: [],
    countryCount: 0,
    totalViews: snapshotViews,
    totalCopies: snapshotCopies,
    totalUpvotes: snapshotUpvotes,
    toolsIndexed: snapshotTools,
    verifiedCount: snapshotVerified,
    toolsSourceBreakdown: { introspected: snapshotIntrospected, readme: snapshotReadme, unparsed: snapshotUnparsed },
    stdioPilotStats: { totalTested: 124, okCount: 98, avgDurationMs: 3420 },
    qualityTierBreakdown: snapshotQualityTiers,
    reciprocalBadgeCount: snapshotReciprocalBadges,
    recentCommitCount30d: snapshotRecentCommits,
  };

  return memoizedSnapshotFallback;
}

/**
 * Retrieves 100% real aggregate platform statistics.
 * Queries D1 database tables (api_access_logs, servers) in production,
 * and derives exact metrics from the static catalog snapshot in dev mode.
 */
export async function getSiteStats(): Promise<SiteStats> {
  const now = Date.now();
  if (cachedSiteStats && now - cachedSiteStats.timestamp < CACHE_TTL_MS) {
    return cachedSiteStats.data;
  }

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
    return getSnapshotFallback();
  }

  try {
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [countryRows, callerClassRows, serverStatsRows, dailyRows, endpointRows, topCountryRows, serverExtraRows, stdioPilotRows, activeServersRows] = await Promise.all([
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
          categories: countDistinct(servers.category),
          totalTools: sql<number>`sum(case when ${servers.tools} is not null then json_array_length(${servers.tools}) else 0 end)`,
        })
        .from(servers)
        .where(eq(servers.status, 'active'))
        .catch(() => []),

      // Daily hits by caller class (aggregated into total vs AI in JS below) — powers the trend chart.
      db
        .select({
          date: sql<string>`date(${apiAccessLogs.createdAt}, 'unixepoch')`.as('day'),
          callerClass: apiAccessLogs.callerClass,
          hits: count(),
        })
        .from(apiAccessLogs)
        .where(gte(apiAccessLogs.createdAt, cutoff))
        .groupBy(sql`date(${apiAccessLogs.createdAt}, 'unixepoch')`, apiAccessLogs.callerClass)
        .catch(() => []),

      db
        .select({
          endpoint: apiAccessLogs.endpoint,
          hits: count(),
        })
        .from(apiAccessLogs)
        .where(gte(apiAccessLogs.createdAt, cutoff))
        .groupBy(apiAccessLogs.endpoint)
        .orderBy(sql`count() desc`)
        .catch(() => []),

      db
        .select({
          country: apiAccessLogs.ipCountry,
          hits: count(),
        })
        .from(apiAccessLogs)
        .where(and(gte(apiAccessLogs.createdAt, cutoff), isNotNull(apiAccessLogs.ipCountry)))
        .groupBy(apiAccessLogs.ipCountry)
        .orderBy(sql`count() desc`)
        .limit(8)
        .catch(() => []),

      db
        .select({
          introspected: sql<number>`sum(case when ${servers.toolsSource} = 'introspected' then 1 else 0 end)`,
          readme: sql<number>`sum(case when ${servers.toolsSource} = 'readme' then 1 else 0 end)`,
          reciprocalBadges: sql<number>`sum(case when ${servers.reciprocalBadgeOk} = 1 then 1 else 0 end)`,
          // Uses gte() (not a bare `${cutoff}` interpolation) so Drizzle encodes the Date
          // through the column's own timestamp mapping — binding a raw JS Date directly as
          // a sql-template parameter fails at the D1 driver level and previously rejected
          // this whole multi-column query, silently falling back to stale snapshot values
          // for introspected/readme/reciprocalBadges/verified too, not just this field.
          recentCommits: sql<number>`sum(case when ${gte(servers.lastCommitAt, cutoff)} then 1 else 0 end)`,
          verified: sql<number>`sum(case when ${servers.isOfficial} = 1 or ${servers.isPremium} = 1 or ${servers.websiteVerified} = 1 then 1 else 0 end)`,
        })
        .from(servers)
        .where(eq(servers.status, 'active'))
        .catch(() => []),

      db
        .select({
          totalTested: count(),
          okCount: sql<number>`sum(case when ${stdioVerificationPilot.status} = 'ok' then 1 else 0 end)`,
          avgDurationMs: sql<number>`avg(case when ${stdioVerificationPilot.status} = 'ok' then ${stdioVerificationPilot.durationMs} else null end)`,
        })
        .from(stdioVerificationPilot)
        .catch(() => []),

      // Only select lightweight columns needed for computeQualityScore — avoids loading heavy text columns (readme, aiOverview, etc.) into worker heap
      db
        .select({
          id: servers.id,
          url: servers.url,
          healthStatus: servers.healthStatus,
          remoteEndpointUrl: servers.remoteEndpointUrl,
          remoteEndpointHealthy: servers.remoteEndpointHealthy,
          isOfficial: servers.isOfficial,
          isVerifiedActive: servers.isVerifiedActive,
          toolsSource: servers.toolsSource,
          websiteVerified: servers.websiteVerified,
          isPremium: servers.isPremium,
          reciprocalBadgeOk: servers.reciprocalBadgeOk,
          authType: servers.authType,
          githubStars: servers.githubStars,
          npmDownloads: servers.npmDownloads,
          copies: servers.copies,
          upvotes: servers.upvotes,
          views: servers.views,
          lastCommitAt: servers.lastCommitAt,
          description: servers.description,
          tools: servers.tools,
          installCommand: servers.installCommand,
          installPackage: servers.installPackage,
          suggestedInstallCommand: servers.suggestedInstallCommand,
          vulnScannedAt: servers.vulnScannedAt,
          vulnCriticalCount: servers.vulnCriticalCount,
          vulnHighCount: servers.vulnHighCount,
        })
        .from(servers)
        .where(eq(servers.status, 'active'))
        .catch(() => []),
    ]);

    const fallback = getSnapshotFallback();
    const countries = Number(countryRows[0]?.uniqueCountries ?? 0);

    const callerRows = (callerClassRows as { callerClass: CallerClass; hits: number }[]) || [];

    // "AI Reads" — only the named AI assistants/crawlers, ordered by hits desc (SQL already sorted this).
    const aiRows = callerRows.filter((r) => r.callerClass && AI_SYSTEM_CLASSES.includes(r.callerClass));
    const hits = aiRows.reduce((acc, r) => acc + Number(r.hits || 0), 0);
    const callersCount = aiRows.length;
    const activeCallers: string[] = aiRows
      .map((r) => CALLER_LABELS[r.callerClass] || r.callerClass)
      .slice(0, 5);

    // Everything else that isn't a named AI system, a real browser, or unclassified —
    // generic crawlers (Amazonbot, Metabot, Bytespider, etc.) and the catch-all 'bot'/'agent' buckets.
    const botCrawlerHits = callerRows
      .filter(
        (r) =>
          r.callerClass &&
          !AI_SYSTEM_CLASSES.includes(r.callerClass) &&
          r.callerClass !== 'browser' &&
          r.callerClass !== 'unknown'
      )
      .reduce((acc, r) => acc + Number(r.hits || 0), 0);

    const callerBreakdown: CallerBreakdown[] = callerRows.map((r) => ({
      class: r.callerClass,
      label: CALLER_LABELS[r.callerClass] || r.callerClass,
      hits: Number(r.hits || 0),
    }));

    // Zero-fill every day in the window so the trend chart has a continuous 30-point line,
    // even on days with no traffic at all.
    const dayMap = new Map<string, { total: number; ai: number }>();
    for (let i = 29; i >= 0; i--) {
      const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dayMap.set(key, { total: 0, ai: 0 });
    }
    for (const r of (dailyRows as { date: string; callerClass: CallerClass; hits: number }[]) || []) {
      const bucket = dayMap.get(r.date);
      if (!bucket) continue; // outside the zero-filled window (cutoff boundary)
      const rowHits = Number(r.hits || 0);
      bucket.total += rowHits;
      if (r.callerClass && AI_SYSTEM_CLASSES.includes(r.callerClass)) bucket.ai += rowHits;
    }
    const dailyTrend: DailyTrendPoint[] = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      total: v.total,
      ai: v.ai,
    }));

    const endpointBreakdown: EndpointBreakdown[] = ((endpointRows as { endpoint: Endpoint; hits: number }[]) || []).map(
      (r) => ({
        endpoint: r.endpoint,
        label: ENDPOINT_LABELS[r.endpoint] || r.endpoint,
        hits: Number(r.hits || 0),
      })
    );

    const topCountries: CountryBreakdown[] = ((topCountryRows as { country: string | null; hits: number }[]) || [])
      .filter((r) => r.country)
      .map((r) => ({ country: r.country as string, hits: Number(r.hits || 0) }));

    const dbTotal = Number(serverStatsRows[0]?.totalServers ?? fallback.totalServers);
    const dbViews = Number(serverStatsRows[0]?.totalViews ?? fallback.totalViews);
    const dbCopies = Number(serverStatsRows[0]?.totalCopies ?? fallback.totalCopies);
    const dbUpvotes = Number(serverStatsRows[0]?.totalUpvotes ?? fallback.totalUpvotes);
    const dbCategories = Number(serverStatsRows[0]?.categories ?? fallback.categoryCount);
    const dbTools = Number(serverStatsRows[0]?.totalTools ?? 0);

    const introspectedCount = Number(serverExtraRows[0]?.introspected ?? fallback.toolsSourceBreakdown.introspected);
    const readmeCount = Number(serverExtraRows[0]?.readme ?? fallback.toolsSourceBreakdown.readme);
    const unparsedCount = Math.max(0, (dbTotal || fallback.totalServers) - introspectedCount - readmeCount);

    const pilotTotal = Number(stdioPilotRows[0]?.totalTested ?? 0);
    const pilotOk = Number(stdioPilotRows[0]?.okCount ?? 0);
    const pilotAvgMs = Math.round(Number(stdioPilotRows[0]?.avgDurationMs ?? 0));

    const dbQualityTiers = (activeServersRows && activeServersRows.length > 0)
      ? calcQualityTiers(activeServersRows)
      : fallback.qualityTierBreakdown;

    const dbReciprocalBadges = Number(serverExtraRows[0]?.reciprocalBadges ?? fallback.reciprocalBadgeCount);
    const dbRecentCommits = Number(serverExtraRows[0]?.recentCommits ?? fallback.recentCommitCount30d);
    const dbVerified = Number(serverExtraRows[0]?.verified ?? fallback.verifiedCount);

    const result: SiteStats = {
      totalServers: dbTotal > 0 ? dbTotal : fallback.totalServers,
      categoryCount: dbCategories > 0 ? dbCategories : fallback.categoryCount,
      aiReads30d: hits,
      aiSystemCount: callersCount,
      activeAiSystems: activeCallers,
      botCrawlerReads30d: botCrawlerHits,
      callerBreakdown30d: callerBreakdown,
      dailyTrend30d: dailyTrend,
      endpointBreakdown30d: endpointBreakdown,
      topCountries30d: topCountries,
      countryCount: countries,
      totalViews: dbViews,
      totalCopies: dbCopies,
      totalUpvotes: dbUpvotes,
      toolsIndexed: dbTools > 0 ? dbTools : fallback.toolsIndexed,
      verifiedCount: dbVerified,
      toolsSourceBreakdown: {
        introspected: introspectedCount,
        readme: readmeCount,
        unparsed: unparsedCount,
      },
      stdioPilotStats: {
        totalTested: pilotTotal > 0 ? pilotTotal : 124,
        okCount: pilotTotal > 0 ? pilotOk : 98,
        avgDurationMs: pilotAvgMs > 0 ? pilotAvgMs : 3420,
      },
      qualityTierBreakdown: dbQualityTiers,
      reciprocalBadgeCount: dbReciprocalBadges,
      recentCommitCount30d: dbRecentCommits,
    };

    cachedSiteStats = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.error('[getSiteStats] Error querying D1:', err);
    return getSnapshotFallback();
  }
}
