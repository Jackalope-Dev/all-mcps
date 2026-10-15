import { type SQL, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { BrowseParams } from './browseParams';
import { readEdgeCache, writeEdgeCache } from './edgeCache';
import { recordSearchMiss } from './searchMisses';
import { servableSql } from './servability';
import {
  type DirectoryFeedItem,
  getFeedItemsByIds,
  searchActiveServers,
  snapshotFeedPage,
} from './servers';

/**
 * Server-side search, filter, sort and paging for /browse.
 *
 * The grid used to download the whole catalog (50+ pages of 1,000 rows) and
 * filter it in the browser: tens of megabytes before search worked, a ranking
 * that differed from the API's, and guessed facets (a "Python" filter that
 * matched any name containing "py"). Now every facet is a column test in SQL,
 * text queries go through the same hybrid ranker as /api/v1/search and the
 * MCP server, and the browser receives one page at a time.
 */

export type BrowseResult = {
  items: DirectoryFeedItem[];
  /** Matching listings; null on pages after the first, which skip the count. */
  total: number | null;
  /** True when `total` hit the search pool cap, so "500+" is the honest count. */
  capped: boolean;
};

/** Ranked search results considered for facets and sorting. */
const SEARCH_POOL = 500;
const CACHE_TTL_SECONDS = 300;

/** Install runners per language: the stack filter reads the real install, not the name. */
const STACK_COMMANDS: Record<NonNullable<BrowseParams['stack']>, string[]> = {
  typescript: ['npx', 'bunx', 'npm', 'node', 'pnpm', 'yarn', 'deno'],
  python: ['uvx', 'uv', 'pip', 'pip3', 'pipx', 'python', 'python3'],
  go: ['go'],
  rust: ['cargo'],
};

/** True when anything narrows the set besides the text query and category. */
function hasFacets(p: BrowseParams): boolean {
  return Boolean(
    p.client || p.stack || p.transport || p.pricing || p.auth || p.verified,
  );
}

const VERIFIED_SQL =
  "(s.tools_source = 'introspected' OR s.remote_endpoint_healthy = 1 OR s.install_needs_config IS NOT NULL)";

function facetConditions(p: BrowseParams): SQL[] {
  const out: SQL[] = [sql.raw(servableSql('s'))];
  if (p.category) out.push(sql`s.category = ${p.category}`);
  if (p.client) {
    // compatible_clients is sparse, so a mention in the listing text counts too
    // (the grid's old rule), now evaluated in SQLite.
    const like = `%${p.client}%`;
    out.push(
      sql`(lower(coalesce(s.compatible_clients, '')) LIKE ${like} OR lower(s.name || ' ' || coalesce(s.description, '')) LIKE ${like})`,
    );
  }
  if (p.stack) {
    out.push(
      sql`lower(coalesce(s.install_command, '')) IN (${sql.join(
        STACK_COMMANDS[p.stack].map((c) => sql`${c}`),
        sql`, `,
      )})`,
    );
  }
  if (p.transport === 'remote') {
    out.push(
      sql`(s.install_kind = 'remote' OR s.remote_endpoint_url IS NOT NULL)`,
    );
  } else if (p.transport === 'stdio') {
    out.push(sql`s.install_kind = 'stdio'`);
  }
  if (p.pricing)
    out.push(sql`lower(coalesce(s.pricing_model, '')) = ${p.pricing}`);
  if (p.auth) out.push(sql`lower(coalesce(s.auth_type, '')) = ${p.auth}`);
  if (p.verified) out.push(sql.raw(VERIFIED_SQL));
  return out;
}

/**
 * ORDER BY for a sort mode. Popular mirrors engagementScore in lib/search.ts
 * (with step functions standing in for the logs, which SQLite lacks);
 * trending divides raw engagement by listing age in days + 2 so newer
 * listings with activity rise. Both are weighted by the same quality multiplier, and put
 * featured listings first as the pricing page promises. Literal metrics
 * (most viewed/upvoted, newest, A-Z) stay literal.
 */
function orderBy(p: BrowseParams, nowSec: number, ranked: boolean): SQL {
  const featured = sql`CASE WHEN s.is_premium = 1 OR coalesce(s.featured_until, 0) > ${nowSec} THEN 0 ELSE 1 END`;
  const quality =
    sql.raw(`(CASE WHEN s.health_status = 'archived' THEN 0.6 WHEN s.health_status = 'offline' THEN 0.5 ELSE 1.0 END)
    * (CASE WHEN ${VERIFIED_SQL} THEN 1.15 ELSE 1.0 END)`);
  const starPoints =
    sql.raw(`(CASE WHEN coalesce(s.github_stars, 0) >= 10000 THEN 12
    WHEN coalesce(s.github_stars, 0) >= 1000 THEN 9
    WHEN coalesce(s.github_stars, 0) >= 100 THEN 6
    WHEN coalesce(s.github_stars, 0) >= 10 THEN 3 ELSE 0 END)`);
  const npmPoints =
    sql.raw(`(CASE WHEN coalesce(s.npm_downloads, 0) >= 100000 THEN 10
    WHEN coalesce(s.npm_downloads, 0) >= 10000 THEN 8
    WHEN coalesce(s.npm_downloads, 0) >= 1000 THEN 6
    WHEN coalesce(s.npm_downloads, 0) >= 100 THEN 4
    WHEN coalesce(s.npm_downloads, 0) >= 10 THEN 2 ELSE 0 END)`);
  switch (p.sort) {
    case 'relevance':
      return ranked
        ? sql`${featured}, j.key ASC`
        : sql`${featured}, s.views DESC, s.id`;
    case 'popular':
      return sql`${featured}, (s.upvotes * 5 + s.copies + s.views * 0.05 + ${starPoints} + ${npmPoints}) * ${quality} DESC, s.created_at DESC, s.id`;
    case 'trending':
      return sql`${featured}, (s.upvotes * 10 + s.copies * 4 + s.views * 0.1
        + min(coalesce(s.github_stars, 0) * 0.1, 40) + min(coalesce(s.npm_downloads, 0) * 0.05, 25))
        * ${quality}
        / ((${nowSec} - coalesce(s.created_at, ${nowSec})) / 86400.0 + 2) DESC, s.created_at DESC, s.id`;
    case 'most_upvoted':
      return sql`s.upvotes DESC, coalesce(s.github_stars, 0) DESC, s.id`;
    case 'most_viewed':
      return sql`s.views DESC, s.id`;
    case 'newest':
      return sql`s.created_at DESC, s.id DESC`;
    case 'alpha':
      return sql`s.name COLLATE NOCASE ASC, s.id`;
  }
}

/** Page ids + total for params, entirely in SQL. `rankedIds` scopes and orders a text search. */
async function selectPage(
  db: ReturnType<typeof drizzle>,
  p: BrowseParams,
  rankedIds: string[] | null,
  now: Date,
): Promise<{ ids: string[]; total: number | null }> {
  const nowSec = Math.floor(now.getTime() / 1000);
  // One bound parameter however many ids: json_each unpacks the array in
  // SQLite, which also gives each id its rank (j.key) for relevance order.
  const from = rankedIds
    ? sql`servers s JOIN json_each(${JSON.stringify(rankedIds)}) j ON j.value = s.id`
    : sql`servers s`;
  const where = sql.join(facetConditions(p), sql` AND `);
  const [rows, countRows] = await Promise.all([
    db.all<{ id: string }>(
      sql`SELECT s.id AS id FROM ${from} WHERE ${where} ORDER BY ${orderBy(p, nowSec, rankedIds != null)} LIMIT ${p.limit} OFFSET ${p.offset}`,
    ),
    // The grid keeps page one's total, so later pages skip the count scan.
    p.offset === 0
      ? db.all<{ n: number }>(
          sql`SELECT count(*) AS n FROM ${from} WHERE ${where}`,
        )
      : Promise.resolve(null),
  ]);
  return {
    ids: rows.map((r) => r.id),
    total: countRows ? Number(countRows[0]?.n ?? 0) : null,
  };
}

function cacheKey(p: BrowseParams): string {
  return `browse/v1/${JSON.stringify(p)}`;
}

async function getDb(): Promise<ReturnType<typeof drizzle> | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx?.env as { DB?: unknown } | undefined;
    return env?.DB ? drizzle(env.DB as any) : null;
  } catch {
    return null;
  }
}

export async function browseCatalog(
  p: BrowseParams,
  now = new Date(),
): Promise<BrowseResult> {
  const db = await getDb();
  if (!db) {
    // Local dev without D1: newest-first snapshot, unfiltered.
    const { items, total } = snapshotFeedPage(p.offset, p.limit);
    return { items, total, capped: false };
  }

  const key = cacheKey(p);
  const cached = await readEdgeCache<{
    ids: string[];
    total: number | null;
    capped: boolean;
  }>(key);
  if (cached) {
    return {
      items: await getFeedItemsByIds(cached.ids),
      total: cached.total,
      capped: cached.capped,
    };
  }

  let rankedIds: string[] | null = null;
  let capped = false;
  if (p.q) {
    const ranked = await searchActiveServers({
      query: p.q,
      category: p.category,
      limit: SEARCH_POOL,
      vectorTopK: 30,
    });
    rankedIds = ranked.map((s) => s.id);
    capped = rankedIds.length >= SEARCH_POOL;
  }

  const page =
    rankedIds && rankedIds.length === 0
      ? { ids: [], total: 0 }
      : await selectPage(db, p, rankedIds, now);

  // A text search that found nothing is demand we can't meet. Facet misses are
  // the visitor narrowing too far, not a gap in the catalog.
  if (p.q && page.total === 0 && !hasFacets(p) && p.offset === 0) {
    await recordSearchMiss(db, p.q, 'browse', now);
  }

  await writeEdgeCache(
    key,
    { ids: page.ids, total: page.total, capped },
    CACHE_TTL_SECONDS,
  );
  return {
    items: await getFeedItemsByIds(page.ids),
    total: page.total,
    capped,
  };
}
