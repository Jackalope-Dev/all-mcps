import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { listingSignals, servers } from '../db/schema';

/**
 * Which listings the ai-content cron spends its LLM budget on, and in what
 * order. The catalog is far larger than a day of enrichment, so the order
 * decides whether people find a fresh writeup on the pages they actually open.
 *
 * Each tick fills its batch in this order:
 *   1. Changed: the listing's source moved on since its writeup — the health
 *      cron set listing_signals.content_changed_at (new README, release or
 *      tools) after servers.ai_enriched_at. A writeup that describes an old
 *      version is worse than none, so these jump the queue.
 *   2. Never enriched (or summarized without a writeup), by demand.
 *   3. Stale, by demand: 90 days for a listing anyone uses, 180 days for one
 *      with no views, copies or upvotes and under 10 stars / 100 npm downloads.
 *      Nobody is reading those pages, and a change still refreshes them via (1).
 * Install validation and metadata passes take whatever slots are left.
 *
 * Every pass is limited to servable listings (lib/servability.ts): a listing
 * the stale sweep has flagged is out of search and noindexed, so a writeup for
 * it reaches nobody. Unmodified forks with no traction of their own are held
 * too: the stale sweep flags them, and the upstream listing already has the
 * writeup. A listing with no README to read and a too-short description costs
 * no LLM call either way — the route marks it thin before calling the model.
 *
 * The pure functions below are the same rules as the SQL, for tests and for
 * anyone reading a single row.
 */

export const CONTENT_STALE_MS = 90 * 24 * 60 * 60 * 1000;
export const LOW_DEMAND_STALE_MS = 180 * 24 * 60 * 60 * 1000;
const DEMAND_MIN_STARS = 10;
const DEMAND_MIN_NPM = 100;
const FORK_HOLD_MAX_STARS = 10;

export type DemandInput = {
  views?: number | null;
  copies?: number | null;
  upvotes?: number | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
};

/** Anyone uses or looks at this listing. */
export function hasDemand(r: DemandInput): boolean {
  return (
    (r.views ?? 0) > 0 ||
    (r.copies ?? 0) > 0 ||
    (r.upvotes ?? 0) > 0 ||
    (r.githubStars ?? 0) >= DEMAND_MIN_STARS ||
    (r.npmDownloads ?? 0) >= DEMAND_MIN_NPM
  );
}

/** How old a writeup may get before the stale pass refreshes it. */
export function staleAfterMs(r: DemandInput): number {
  return hasDemand(r) ? CONTENT_STALE_MS : LOW_DEMAND_STALE_MS;
}

/** An unmodified fork with no traction of its own: not worth a writeup. */
export function isHeldFromEnrichment(r: {
  repoForkOf?: string | null;
  githubStars?: number | null;
}): boolean {
  return r.repoForkOf != null && (r.githubStars ?? 0) < FORK_HOLD_MAX_STARS;
}

type Instant = Date | string | number | null | undefined;

function toMs(v: Instant): number | null {
  if (v == null) return null;
  const ms = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** The source changed after the current writeup was generated. */
export function needsChangeRefresh(r: {
  aiEnrichedAt?: Instant;
  contentChangedAt?: Instant;
}): boolean {
  const enriched = toMs(r.aiEnrichedAt);
  const changed = toMs(r.contentChangedAt);
  return enriched != null && changed != null && changed > enriched;
}

// --- SQL mirrors of the rules above -------------------------------------

/** Active and not flagged — lib/servability.ts. */
export const servableWhere = and(
  eq(servers.status, 'active'),
  isNull(servers.staleFlaggedAt),
) as SQL;

/** NOT isHeldFromEnrichment. Needs listing_signals left-joined. */
const notHeldWhere = sql`NOT (${listingSignals.repoForkOf} IS NOT NULL AND coalesce(${servers.githubStars}, 0) < ${FORK_HOLD_MAX_STARS})`;

/** hasDemand. */
const demandWhere = sql`(${servers.views} > 0 OR ${servers.copies} > 0 OR ${servers.upvotes} > 0 OR coalesce(${servers.githubStars}, 0) >= ${DEMAND_MIN_STARS} OR coalesce(${servers.npmDownloads}, 0) >= ${DEMAND_MIN_NPM})`;

/**
 * Most-used first. Leads with idx_servers_status_popularity's columns so D1
 * walks the index and stops after the batch instead of sorting the catalog.
 */
const demandOrder = [
  desc(servers.views),
  desc(servers.copies),
  desc(servers.upvotes),
  sql`${servers.githubStars} IS NULL`,
  desc(servers.githubStars),
  desc(servers.npmDownloads),
  asc(servers.createdAt),
];

type Db = ReturnType<typeof drizzle>;

/** Columns a claimed row needs, without the ai_* blobs (Worker memory). */
const claimColumns = {
  id: servers.id,
  name: servers.name,
  url: servers.url,
  description: servers.description,
  category: servers.category,
  tools: servers.tools,
  aiEnrichedAt: servers.aiEnrichedAt,
};

/** A changed row whose refresh failed waits this long before it is tried again. */
const CHANGED_RETRY_MS = 24 * 60 * 60 * 1000;
/** Failed refreshes of one change before it is dropped back to the normal cycle. */
export const CHANGED_MAX_FAILURES = 3;

/**
 * Pass 1: writeups older than their listing's latest source change. A row
 * whose refresh just failed backs off for CHANGED_RETRY_MS, so one listing
 * with a persistent LLM error can't take a slot every tick.
 */
export function changedCandidates(db: Db, now: Date, limit: number) {
  return db
    .select(claimColumns)
    .from(servers)
    .innerJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        servableWhere,
        notHeldWhere,
        isNotNull(servers.aiEnrichedAt),
        gt(listingSignals.contentChangedAt, servers.aiEnrichedAt),
        or(
          isNull(listingSignals.contentRefreshFailedAt),
          lt(
            listingSignals.contentRefreshFailedAt,
            new Date(now.getTime() - CHANGED_RETRY_MS),
          ),
        ),
      ),
    )
    .orderBy(...demandOrder)
    .limit(limit);
}

/**
 * Pass 2 (ids only, for the atomic claim subquery): never enriched, or
 * summarized without a writeup. A summarized row whose writeup was skipped
 * carries aiDoc = '' and drops out.
 */
export function newCandidateIds(db: Db, limit: number) {
  return db
    .select({ id: servers.id })
    .from(servers)
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        servableWhere,
        notHeldWhere,
        or(
          isNull(servers.aiEnrichedAt),
          and(isNull(servers.aiDoc), isNotNull(servers.aiSummary)),
        ),
      ),
    )
    .orderBy(...demandOrder)
    .limit(limit);
}

/** Pass 3: writeups past staleAfterMs for their listing's demand. */
export function staleCandidates(db: Db, now: Date, limit: number) {
  const demandCutoff = new Date(now.getTime() - CONTENT_STALE_MS);
  const quietCutoff = new Date(now.getTime() - LOW_DEMAND_STALE_MS);
  return db
    .select(claimColumns)
    .from(servers)
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        servableWhere,
        notHeldWhere,
        isNotNull(servers.aiEnrichedAt),
        or(
          lt(servers.aiEnrichedAt, quietCutoff),
          and(lt(servers.aiEnrichedAt, demandCutoff), demandWhere),
        ),
      ),
    )
    .orderBy(...demandOrder)
    .limit(limit);
}

/** Never-enriched servable listings that are not held — the backlog size. */
export async function countNewBacklog(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(servers)
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(and(servableWhere, notHeldWhere, isNull(servers.aiEnrichedAt)));
  return Number(row?.n ?? 0);
}

/** Listings whose writeup is due under the stale rule. */
export async function countStaleDue(db: Db, now: Date): Promise<number> {
  const demandCutoff = new Date(now.getTime() - CONTENT_STALE_MS);
  const quietCutoff = new Date(now.getTime() - LOW_DEMAND_STALE_MS);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(servers)
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        servableWhere,
        notHeldWhere,
        isNotNull(servers.aiEnrichedAt),
        or(
          lt(servers.aiEnrichedAt, quietCutoff),
          and(lt(servers.aiEnrichedAt, demandCutoff), demandWhere),
        ),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Writeups waiting on a source change. */
export async function countChanged(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(servers)
    .innerJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        servableWhere,
        notHeldWhere,
        isNotNull(servers.aiEnrichedAt),
        gt(listingSignals.contentChangedAt, servers.aiEnrichedAt),
      ),
    );
  return Number(row?.n ?? 0);
}
