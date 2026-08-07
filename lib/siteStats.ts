import { count, countDistinct, gte, sql, sum, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { apiAccessLogs, servers } from '../db/schema';
import serversData from '../data/mcp-servers.json';
import { CALLER_LABELS, CallerClass } from './accessLog';

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
    if (Array.isArray(s.tools)) return acc + s.tools.length;
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
      botCrawlerReads30d: 0,
      callerBreakdown30d: [],
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

    const [countryRows, callerClassRows, serverStatsRows] = await Promise.all([
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
          // Defensive cap: the npm-downloads enrichment cron has produced corrupted
          // per-package values (one listing alone reported 674B monthly downloads —
          // more than npm's entire registry). Excluding outliers above a generous
          // per-package ceiling keeps a single bad row from poisoning the site total
          // until the underlying fetchNpmDownloads() bug is fixed separately.
          totalNpmDownloads: sql<number>`sum(case when ${servers.npmDownloads} < 300000000 then ${servers.npmDownloads} else 0 end)`,
          categories: countDistinct(servers.category),
        })
        .from(servers)
        .where(eq(servers.status, 'active'))
        .catch(() => []),
    ]);

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
      activeAiSystems: activeCallers,
      botCrawlerReads30d: botCrawlerHits,
      callerBreakdown30d: callerBreakdown,
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
      botCrawlerReads30d: 0,
      callerBreakdown30d: [],
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
