import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Aggregate statistics about the MCP ecosystem as indexed by AllMCPs — powers
 * /state-of-mcp, a citable data page (original numbers are what earn links and
 * AI-answer citations; nobody else has this dataset).
 *
 * Every figure is computed live from active listings — nothing hand-entered —
 * and the page states the method next to each number. One D1 batch of GROUP BY
 * queries (~20k rows scanned), cached per isolate for CACHE_TTL_MS so crawler
 * traffic doesn't turn into repeated full scans.
 */

export type Bucket = { label: string; count: number };

export type EcosystemStats = {
  generatedAt: string;
  total: number;
  added30d: number;
  added90d: number;
  /** Listings added per month, oldest first, last 12 months. */
  monthly: Bucket[];
  health: Bucket[];
  transport: Bucket[];
  runners: Bucket[];
  auth: Bucket[];
  pricing: Bucket[];
  licenses: Bucket[];
  categories: Bucket[];
  stars: Bucket[];
  clients: Bucket[];
  official: number;
  vulnScanned: number;
  vulnCriticalOrHigh: number;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; stats: EcosystemStats } | null = null;

const ACTIVE = "status = 'active'";

type Row = Record<string, unknown>;

function buckets(rows: Row[], labelKey = 'k', countKey = 'c'): Bucket[] {
  return rows.map((r) => ({
    label: r[labelKey] == null ? 'unknown' : String(r[labelKey]),
    count: Number(r[countKey]) || 0,
  }));
}

export async function getEcosystemStats(): Promise<EcosystemStats | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.stats;

  let db: D1Database | undefined;
  try {
    db = (await getCloudflareContext()).env?.DB;
  } catch {
    return null; // build time — no D1
  }
  if (!db) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const q = (sql: string) => db.prepare(sql);
  try {
    const results = await db.batch([
      q(
        `SELECT count(*) AS total,
          sum(created_at >= ${nowSec - 30 * 86400}) AS added30d,
          sum(created_at >= ${nowSec - 90 * 86400}) AS added90d,
          sum(is_official = 1) AS official,
          sum(vuln_scanned_at IS NOT NULL) AS vulnScanned,
          sum(coalesce(vuln_critical_count,0) + coalesce(vuln_high_count,0) > 0) AS vulnCriticalOrHigh
         FROM servers WHERE ${ACTIVE}`,
      ),
      q(
        `SELECT strftime('%Y-%m', created_at, 'unixepoch') AS k, count(*) AS c
         FROM servers WHERE ${ACTIVE} AND created_at >= ${nowSec - 366 * 86400}
         GROUP BY k ORDER BY k`,
      ),
      q(
        `SELECT health_status AS k, count(*) AS c FROM servers WHERE ${ACTIVE} GROUP BY k ORDER BY c DESC`,
      ),
      q(
        `SELECT install_kind AS k, count(*) AS c FROM servers WHERE ${ACTIVE} GROUP BY k ORDER BY c DESC`,
      ),
      q(
        `SELECT install_command AS k, count(*) AS c FROM servers
         WHERE ${ACTIVE} AND install_kind = 'stdio' AND install_command IS NOT NULL
         GROUP BY k ORDER BY c DESC LIMIT 6`,
      ),
      q(
        `SELECT auth_type AS k, count(*) AS c FROM servers WHERE ${ACTIVE} AND auth_type IS NOT NULL GROUP BY k ORDER BY c DESC`,
      ),
      q(
        `SELECT pricing_model AS k, count(*) AS c FROM servers WHERE ${ACTIVE} AND pricing_model IS NOT NULL GROUP BY k ORDER BY c DESC`,
      ),
      q(
        `SELECT license AS k, count(*) AS c FROM servers WHERE ${ACTIVE} AND license IS NOT NULL GROUP BY k ORDER BY c DESC LIMIT 8`,
      ),
      q(
        `SELECT category AS k, count(*) AS c FROM servers WHERE ${ACTIVE} GROUP BY k ORDER BY c DESC LIMIT 12`,
      ),
      q(
        `SELECT CASE
            WHEN github_stars IS NULL THEN 'not on GitHub / unknown'
            WHEN github_stars < 10 THEN '0–9'
            WHEN github_stars < 100 THEN '10–99'
            WHEN github_stars < 1000 THEN '100–999'
            ELSE '1,000+' END AS k,
          count(*) AS c
         FROM servers WHERE ${ACTIVE} GROUP BY k`,
      ),
      q(
        `SELECT j.value AS k, count(*) AS c
         FROM servers, json_each(servers.compatible_clients) AS j
         WHERE ${ACTIVE} AND json_valid(servers.compatible_clients)
         GROUP BY k ORDER BY c DESC LIMIT 10`,
      ),
    ]);

    const rows = (i: number) => (results[i]?.results ?? []) as Row[];
    const head = rows(0)[0] ?? {};
    const starOrder = [
      '0–9',
      '10–99',
      '100–999',
      '1,000+',
      'not on GitHub / unknown',
    ];
    const stats: EcosystemStats = {
      generatedAt: new Date().toISOString(),
      total: Number(head.total) || 0,
      added30d: Number(head.added30d) || 0,
      added90d: Number(head.added90d) || 0,
      official: Number(head.official) || 0,
      vulnScanned: Number(head.vulnScanned) || 0,
      vulnCriticalOrHigh: Number(head.vulnCriticalOrHigh) || 0,
      monthly: buckets(rows(1)),
      health: buckets(rows(2)),
      transport: buckets(rows(3)).map((b) => ({
        ...b,
        label:
          b.label === 'stdio'
            ? 'Local (stdio)'
            : b.label === 'remote'
              ? 'Remote (HTTP)'
              : 'Not determined',
      })),
      runners: buckets(rows(4)),
      auth: buckets(rows(5)),
      pricing: buckets(rows(6)),
      licenses: buckets(rows(7)),
      categories: buckets(rows(8)),
      stars: buckets(rows(9)).sort(
        (a, b) => starOrder.indexOf(a.label) - starOrder.indexOf(b.label),
      ),
      clients: buckets(rows(10)),
    };
    if (stats.total > 0) cache = { at: Date.now(), stats };
    return stats;
  } catch (error) {
    console.error('[ecosystemStats] query failed', error);
    return null;
  }
}
