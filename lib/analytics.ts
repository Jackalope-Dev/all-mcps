/**
 * Analytics query functions for the Premium owner dashboard.
 * Aggregates api_access_logs and impression_logs data per server.
 */
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { apiAccessLogs, impressionLogs } from '@/db/schema';
import type { CallerClass } from './accessLog';
import type { ImpressionSurface } from './impressionLog';

export type AnalyticsSummary = {
  totalApiHits: number;
  totalImpressions: number;
  totalOutboundClicks: number;
  uniqueCallers: number;
  topCaller: string | null;
  trend: 'up' | 'down' | 'flat';
};

export type CallerBreakdown = {
  caller: CallerClass;
  hits: number;
  pct: number;
};

export type DailyHits = {
  date: string;
  hits: number;
};

export type EndpointBreakdown = {
  endpoint: string;
  hits: number;
};

export type SurfaceBreakdown = {
  surface: ImpressionSurface;
  impressions: number;
};

export type ServerAnalytics = {
  summary: AnalyticsSummary;
  byCallerClass: CallerBreakdown[];
  byDay: DailyHits[];
  byEndpoint: EndpointBreakdown[];
  bySurface: SurfaceBreakdown[];
  recentSearchQueries: string[];
};

/**
 * Fetch full analytics data for a single server over the last N days.
 */
export async function getServerAnalytics(
  db: any,
  serverId: string,
  days = 30
): Promise<ServerAnalytics> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    callerRows,
    dailyRows,
    endpointRows,
    surfaceRows,
    searchRows,
    // Previous period for trend calculation
    prevPeriodRows,
  ] = await Promise.all([
    // Caller class breakdown
    db
      .select({
        caller: apiAccessLogs.callerClass,
        hits: count(),
      })
      .from(apiAccessLogs)
      .where(and(eq(apiAccessLogs.serverId, serverId), gte(apiAccessLogs.createdAt, cutoff)))
      .groupBy(apiAccessLogs.callerClass)
      .orderBy(desc(count())),

    // Daily hits (using SQLite date function on the unix timestamp)
    db
      .select({
        date: sql<string>`date(${apiAccessLogs.createdAt}, 'unixepoch')`.as('day'),
        hits: count(),
      })
      .from(apiAccessLogs)
      .where(and(eq(apiAccessLogs.serverId, serverId), gte(apiAccessLogs.createdAt, cutoff)))
      .groupBy(sql`date(${apiAccessLogs.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${apiAccessLogs.createdAt}, 'unixepoch')`),

    // Endpoint breakdown
    db
      .select({
        endpoint: apiAccessLogs.endpoint,
        hits: count(),
      })
      .from(apiAccessLogs)
      .where(and(eq(apiAccessLogs.serverId, serverId), gte(apiAccessLogs.createdAt, cutoff)))
      .groupBy(apiAccessLogs.endpoint)
      .orderBy(desc(count())),

    // Impression surface breakdown
    db
      .select({
        surface: impressionLogs.surface,
        impressions: count(),
      })
      .from(impressionLogs)
      .where(and(eq(impressionLogs.serverId, serverId), gte(impressionLogs.createdAt, cutoff)))
      .groupBy(impressionLogs.surface)
      .orderBy(desc(count())),

    // Recent search queries that returned this server
    db
      .select({ query: apiAccessLogs.methodOrTool })
      .from(apiAccessLogs)
      .where(
        and(
          eq(apiAccessLogs.serverId, serverId),
          eq(apiAccessLogs.endpoint, 'v1_search'),
          gte(apiAccessLogs.createdAt, cutoff),
          sql`${apiAccessLogs.methodOrTool} IS NOT NULL`
        )
      )
      .orderBy(desc(apiAccessLogs.createdAt))
      .limit(20),

    // Previous period total for trend
    db
      .select({ hits: count() })
      .from(apiAccessLogs)
      .where(
        and(
          eq(apiAccessLogs.serverId, serverId),
          gte(apiAccessLogs.createdAt, new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000)),
          sql`${apiAccessLogs.createdAt} < ${cutoff}`
        )
      ),
  ]);

  const totalApiHits = callerRows.reduce(
    (sum: number, r: { hits: number }) => sum + r.hits,
    0
  );
  const totalImpressions = surfaceRows.reduce(
    (sum: number, r: { impressions: number }) => sum + r.impressions,
    0
  );
  const totalOutboundClicks = surfaceRows
    .filter((r: { surface: string; impressions: number }) => r.surface === 'outbound_github' || r.surface === 'outbound_website')
    .reduce((sum: number, r: { impressions: number }) => sum + r.impressions, 0);

  const uniqueCallers = callerRows.length;
  const topCaller =
    callerRows.length > 0 ? (callerRows[0] as { caller: string }).caller : null;

  const prevTotal = prevPeriodRows[0]?.hits ?? 0;
  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (totalApiHits > prevTotal * 1.1) trend = 'up';
  else if (totalApiHits < prevTotal * 0.9) trend = 'down';

  const byCallerClass: CallerBreakdown[] = callerRows.map(
    (r: { caller: CallerClass; hits: number }) => ({
      caller: r.caller,
      hits: r.hits,
      pct: totalApiHits > 0 ? Math.round((r.hits / totalApiHits) * 1000) / 10 : 0,
    })
  );

  // Deduplicate search queries
  const seen = new Set<string>();
  const recentSearchQueries: string[] = [];
  for (const row of searchRows as { query: string | null }[]) {
    const q = row.query?.trim();
    if (q && !seen.has(q.toLowerCase())) {
      seen.add(q.toLowerCase());
      recentSearchQueries.push(q);
    }
  }

  return {
    summary: { totalApiHits, totalImpressions, totalOutboundClicks, uniqueCallers, topCaller, trend },
    byCallerClass,
    byDay: dailyRows as DailyHits[],
    byEndpoint: endpointRows as EndpointBreakdown[],
    bySurface: surfaceRows as SurfaceBreakdown[],
    recentSearchQueries,
  };
}

/**
 * Fetch lightweight analytics summary for multiple servers at once.
 * Used in the dashboard listing view.
 */
export async function getServerAnalyticsBatch(
  db: any,
  serverIds: string[],
  days = 30
): Promise<Record<string, AnalyticsSummary>> {
  if (serverIds.length === 0) return {};

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevCutoff = new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000);

  // One query per aggregation — D1 doesn't support complex subqueries well
  const [hitRows, impressionRows, prevRows] = await Promise.all([
    db
      .select({
        serverId: apiAccessLogs.serverId,
        callerClass: apiAccessLogs.callerClass,
        hits: count(),
      })
      .from(apiAccessLogs)
      .where(
        and(
          sql`${apiAccessLogs.serverId} IN (${sql.join(serverIds.map((id) => sql`${id}`), sql`, `)})`,
          gte(apiAccessLogs.createdAt, cutoff)
        )
      )
      .groupBy(apiAccessLogs.serverId, apiAccessLogs.callerClass),

    db
      .select({
        serverId: impressionLogs.serverId,
        surface: impressionLogs.surface,
        impressions: count(),
      })
      .from(impressionLogs)
      .where(
        and(
          sql`${impressionLogs.serverId} IN (${sql.join(serverIds.map((id) => sql`${id}`), sql`, `)})`,
          gte(impressionLogs.createdAt, cutoff)
        )
      )
      .groupBy(impressionLogs.serverId, impressionLogs.surface),

    db
      .select({
        serverId: apiAccessLogs.serverId,
        hits: count(),
      })
      .from(apiAccessLogs)
      .where(
        and(
          sql`${apiAccessLogs.serverId} IN (${sql.join(serverIds.map((id) => sql`${id}`), sql`, `)})`,
          gte(apiAccessLogs.createdAt, prevCutoff),
          sql`${apiAccessLogs.createdAt} < ${cutoff}`
        )
      )
      .groupBy(apiAccessLogs.serverId),
  ]);

  // Aggregate per server
  const result: Record<string, AnalyticsSummary> = {};
  for (const id of serverIds) {
    result[id] = {
      totalApiHits: 0,
      totalImpressions: 0,
      totalOutboundClicks: 0,
      uniqueCallers: 0,
      topCaller: null,
      trend: 'flat',
    };
  }

  // Process hit rows
  const callerMap = new Map<string, Map<string, number>>();
  for (const row of hitRows as { serverId: string; callerClass: string; hits: number }[]) {
    if (!row.serverId) continue;
    if (!callerMap.has(row.serverId)) callerMap.set(row.serverId, new Map());
    callerMap.get(row.serverId)!.set(row.callerClass, row.hits);
    result[row.serverId].totalApiHits += row.hits;
  }

  for (const [sid, classMap] of callerMap) {
    result[sid].uniqueCallers = classMap.size;
    let topHits = 0;
    for (const [cls, hits] of classMap) {
      if (hits > topHits) {
        topHits = hits;
        result[sid].topCaller = cls;
      }
    }
  }

  // Process impression & click rows
  for (const row of impressionRows as { serverId: string; surface: string; impressions: number }[]) {
    if (row.serverId && result[row.serverId]) {
      result[row.serverId].totalImpressions += row.impressions;
      if (row.surface === 'outbound_github' || row.surface === 'outbound_website') {
        result[row.serverId].totalOutboundClicks += row.impressions;
      }
    }
  }

  // Process trend
  const prevMap = new Map<string, number>();
  for (const row of prevRows as { serverId: string; hits: number }[]) {
    if (row.serverId) prevMap.set(row.serverId, row.hits);
  }
  for (const id of serverIds) {
    const prev = prevMap.get(id) ?? 0;
    const cur = result[id].totalApiHits;
    if (cur > prev * 1.1) result[id].trend = 'up';
    else if (cur < prev * 0.9) result[id].trend = 'down';
  }

  return result;
}
