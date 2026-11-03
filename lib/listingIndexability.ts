import { type SQL, sql } from 'drizzle-orm';
import { servers } from '../db/schema';

/**
 * Single source of truth for whether a /mcp/[id] listing is offered to search
 * engines. Used by the page's robots meta AND the listings sitemap so we never
 * submit a URL the page itself noindexes.
 *
 * Why this bar: Search Console showed ~6.5k listing pages in "Crawled -
 * currently not indexed" by mid-Sept 2026 (then a site-wide drop after the
 * Sept 2026 spam update). A listing without our own writeup only shows a README
 * excerpt — duplicate content Google already has from GitHub — so it's never
 * indexable. A writeup alone is templated-catalog shaped, and once the
 * ai-content cron had written ~21.8k of them, "writeup plus any one signal"
 * still left ~7.5k listings indexable (Oct 2026). So a listing now needs BOTH
 * independent signals — real-world traction and proof the server runs — unless
 * its traction alone is strong enough that people clearly search for it
 * (~1.7k listings).
 *
 * Oct 22 2026: Search Console showed the whole domain still demoted after the
 * Aug + Sept 2026 spam updates — only 12 of ~330 hand-written core pages and
 * ~620 listings indexed. With ~2.6k listings still offered, the site kept the
 * shape of a scaled catalog, so the bar was raised again (25→100 stars /
 * 100→1k downloads with a verified run; 250→1k stars / 5k→20k downloads on
 * traction alone), leaving ~770 listings (estimated from a 10% sample of the
 * listings sitemap). Lower it again once indexing recovers.
 *
 * "Proof it runs" means we saw it work: a live tools/list (toolsSource
 * 'introspected'), a sandbox run that started and asked for keys
 * (installNeedsConfig), or a remote endpoint that answered within
 * REMOTE_HEALTHY_WINDOW_MS. remoteEndpointHealthy alone flips false on one bad
 * answer, and the health cron rechecks every listing every couple of days, so
 * listings (and the hubs counting them) used to drop out of the sitemap and
 * get noindexed over a single CDN blip, then come back on the next pass. A tool list parsed from
 * the README used to count, but that is the README's claim, not evidence —
 * and it let thin listings in on documentation alone.
 *
 * Fully self-healing: once the enrich cron writes a writeup, or a listing
 * crosses the traction bar, it becomes indexable and enters the sitemap with
 * no manual step.
 */
const INDEXABLE_MIN_GITHUB_STARS = 100;
const INDEXABLE_MIN_NPM_DOWNLOADS = 1000;
/** Traction high enough to index without a verified run. */
const INDEXABLE_STRONG_GITHUB_STARS = 1000;
const INDEXABLE_STRONG_NPM_DOWNLOADS = 20000;
/** A remote endpoint seen healthy this recently still counts as proof it runs. */
const REMOTE_HEALTHY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type IndexabilityInput = {
  status?: string | null;
  hasAiDoc: boolean;
  toolsSource?: string | null;
  installNeedsConfig?: Date | string | number | null;
  remoteEndpointHealthy?: boolean | number | null;
  /** Last successful remote handshake (servers.remoteEndpointHealthyAt). */
  remoteEndpointHealthyAt?: Date | string | number | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  /** Flagged by the stale sweep (lib/staleness.ts). Noindexed during the grace period, before any removal. */
  staleFlagged?: boolean;
};

export function isListingIndexable(s: IndexabilityInput): boolean {
  if (s.status && s.status !== 'active') return false;
  if (s.staleFlagged) return false;
  if (!s.hasAiDoc) return false;
  const stars = s.githubStars ?? 0;
  const downloads = s.npmDownloads ?? 0;
  const hasTraction =
    stars >= INDEXABLE_MIN_GITHUB_STARS ||
    downloads >= INDEXABLE_MIN_NPM_DOWNLOADS;
  const hasStrongTraction =
    stars >= INDEXABLE_STRONG_GITHUB_STARS ||
    downloads >= INDEXABLE_STRONG_NPM_DOWNLOADS;
  return hasStrongTraction || (hasTraction && hasVerifiedRun(s));
}

/** A servers row (or the page's Server shape) as isServerRowIndexable reads it. */
type IndexabilityRow = Omit<IndexabilityInput, 'hasAiDoc' | 'staleFlagged'> & {
  aiDoc?: string | null;
  staleFlaggedAt?: unknown;
};

/** isListingIndexable for a servers row, as the /mcp/[id] page reads it. */
export function isServerRowIndexable(row: IndexabilityRow): boolean {
  return isListingIndexable({
    status: row.status,
    hasAiDoc: Boolean(row.aiDoc?.trim()),
    toolsSource: row.toolsSource,
    installNeedsConfig: row.installNeedsConfig,
    remoteEndpointHealthy: row.remoteEndpointHealthy,
    remoteEndpointHealthyAt: row.remoteEndpointHealthyAt,
    githubStars: row.githubStars,
    npmDownloads: row.npmDownloads,
    staleFlagged: row.staleFlaggedAt != null,
  });
}

/** We saw the server work: live tools, a sandbox start that asked for keys, or a recently healthy remote endpoint. */
function hasVerifiedRun(
  s: Pick<
    IndexabilityInput,
    | 'toolsSource'
    | 'installNeedsConfig'
    | 'remoteEndpointHealthy'
    | 'remoteEndpointHealthyAt'
  >,
): boolean {
  return (
    s.toolsSource === 'introspected' ||
    s.installNeedsConfig != null ||
    Boolean(s.remoteEndpointHealthy) ||
    healthyWithinWindow(s.remoteEndpointHealthyAt)
  );
}

function healthyWithinWindow(at: IndexabilityInput['remoteEndpointHealthyAt']) {
  if (at == null) return false;
  // Seconds or ms; D1 rows read raw (not through Drizzle) carry epoch seconds.
  const ms =
    typeof at === 'number'
      ? at < 1e12
        ? at * 1000
        : at
      : new Date(at).getTime();
  return !Number.isNaN(ms) && Date.now() - ms <= REMOTE_HEALTHY_WINDOW_MS;
}

/**
 * SQL form of isListingIndexable for aggregate reads (catalog coverage, hub
 * thresholds). Callers add the status / stale filter themselves.
 */
export function indexableListingSql(): SQL {
  const stars = sql`coalesce(${servers.githubStars}, 0)`;
  const downloads = sql`coalesce(${servers.npmDownloads}, 0)`;
  const traction = sql`(${stars} >= ${INDEXABLE_MIN_GITHUB_STARS} OR ${downloads} >= ${INDEXABLE_MIN_NPM_DOWNLOADS})`;
  const strongTraction = sql`(${stars} >= ${INDEXABLE_STRONG_GITHUB_STARS} OR ${downloads} >= ${INDEXABLE_STRONG_NPM_DOWNLOADS})`;
  const healthySince = Math.floor(
    (Date.now() - REMOTE_HEALTHY_WINDOW_MS) / 1000,
  );
  const verifiedRun = sql`(${servers.toolsSource} = 'introspected' OR ${servers.installNeedsConfig} IS NOT NULL OR coalesce(${servers.remoteEndpointHealthy}, 0) = 1 OR coalesce(${servers.remoteEndpointHealthyAt}, 0) >= ${healthySince})`;
  return sql`(coalesce(${servers.aiDoc}, '') <> '' AND (${strongTraction} OR (${traction} AND ${verifiedRun})))`;
}
