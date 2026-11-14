import { type SQL, sql } from 'drizzle-orm';
import { servers } from '../db/schema';

/**
 * Single source of truth for whether a /mcp/[id] listing is offered to search
 * engines. The page's robots meta, the listings sitemap, IndexNow pings,
 * llms.txt and the hub counts all read it, so we never submit a URL the page
 * itself noindexes. Noindexed listings stay live and linked (noindex, follow):
 * this decides what Google is asked to index, not what exists.
 *
 * History, so nobody lowers the bar to grow the page count:
 * - Sept 2026: ~6.5k listings in "Crawled - currently not indexed". A listing
 *   without our own writeup is a README excerpt Google already has from
 *   GitHub, so it is never indexable.
 * - Oct 22 2026: whole domain still demoted after the Aug + Sept spam updates;
 *   bar raised to "writeup + traction + proof it runs" (~1.6k listings).
 * - Nov 13 2026: Google impressions had fallen from ~1,500/day (Aug 12-18) to
 *   ~0-6/day. Half the ~1.6k indexable listings were auto-ingested npm
 *   packages with 0-25 GitHub stars that qualified on 1-2k monthly npm
 *   downloads alone (mirrors and scanners download every new package), many
 *   under numbered or collision-suffixed slugs (mcp-server-62, iris-2): the
 *   scaled, templated shape spam updates target. Since then npm downloads only
 *   count next to real GitHub stars, the repo must be alive, generic slugs
 *   need strong traction, and duplicates of one project index once.
 *
 * Do not lower these thresholds to inflate the indexed page count. Recovery
 * from a spam demotion needs a smaller, clearly better indexed set, not more.
 *
 * A listing is indexable when it is active and, in this order:
 *  1. it is not a known duplicate of another listing (DUPLICATE_LISTINGS);
 *  2. it is not flagged by the stale sweep (dead or deprecated, pending removal);
 *  3. it earned Google impressions on its own (SEARCH_TRAFFIC_LISTINGS); or
 *  4. it has our own writeup (aiDoc), its repo is not archived, and one of:
 *     - trusted: Official (admin-checked vendor evidence) or Verified owner
 *       (an approved ownership claim);
 *     - strong traction: >= 1000 GitHub stars or >= 20k npm downloads/month,
 *       which also clears a generic slug;
 *     - traction (not under a generic slug): proof it runs, a commit in the
 *       last 12 months, and >= 100 stars or >= 10 stars with >= 5k downloads;
 *     - human-submitted (approved via /submit, not ingested) with proof it
 *       runs, not offline, and not a near-starless GitHub repo (one-person
 *       batches of generated repos come in that way).
 *
 * "Proof it runs" means we saw it work: a live tools/list (toolsSource
 * 'introspected'), a sandbox run that started and asked for keys
 * (installNeedsConfig), or a remote endpoint that answered within
 * REMOTE_HEALTHY_WINDOW_MS. remoteEndpointHealthy alone flips false on one bad
 * answer, and the health cron rechecks every listing every couple of days, so
 * a 14-day window keeps listings from leaving the sitemap over one CDN blip. A
 * tool list parsed from the README does not count: that is the README's claim.
 *
 * Self-healing: once a listing earns a writeup, stars, a claim or Official
 * status it becomes indexable and enters the sitemap with no manual step.
 *
 * isListingIndexable (JS: page, sitemap, IndexNow) and indexableListingSql
 * (SQL: hubs, IndexNow cron, llms.txt, related links) must agree;
 * listingIndexability.test.ts runs both over the same rows.
 */
const STRONG_GITHUB_STARS = 1000;
const STRONG_NPM_DOWNLOADS = 20000;
const TRACTION_GITHUB_STARS = 100;
/** npm downloads count only next to some GitHub stars: downloads alone are mostly mirrors and scanners. */
const TRACTION_DOWNLOADS_MIN_STARS = 10;
const TRACTION_NPM_DOWNLOADS = 5000;
/** A repo with no commit in this long is treated as dead unless its traction is strong. */
const REPO_ALIVE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
/** A human-submitted GitHub repo below this many stars needs another signal. */
const SUBMITTED_GITHUB_MIN_STARS = 10;
/** A remote endpoint seen healthy this recently still counts as proof it runs. */
const REMOTE_HEALTHY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Listings that are the same project as another listing (a renamed or
 * transferred repo, a fork publishing the same package, a monorepo path listed
 * twice), mapped to the one listing we index. The others stay reachable with
 * noindex, follow and a canonical to the kept one. Picked from the Nov 13 2026
 * catalog (same repo, same package or same endpoint, same star count); the
 * kept one is Official/claimed first, then the most viewed. Merging them for
 * good (servers.redirect_to + status) is an admin decision.
 */
export const DUPLICATE_LISTINGS: Readonly<Record<string, string>> = {
  'mineru-open-mcp': 'opendatalab-mineru-ecosystem',
  microcharts: 'ganapativs-microcharts',
  'microsoft-mcp': 'azure-mcp-server',
  'posthog-posthog': 'posthog-mcp-server',
  'dayuanjiang-next-ai-draw-io': 'next-ai-draw-io',
  netdata: 'netdata-netdata-netdata',
  'safedep-vet': 'safedep-vet-mcp',
  nhost: 'nhost-nhost',
  'highstory-mcp-2': 'memory',
  'tavily-mcp-server': 'tavily-mcp',
  'luminati-io-brightdata-mcp': 'brightdata-mcp',
  'apify-actors-mcp-server': 'apify-mcp-server',
  'manusa-kubernetes-mcp-server': 'kubernetes-mcp-server',
  'supabase-community-supabase-mcp': 'supabase',
  'googleapis-genai-toolbox': 'mcp-toolbox-for-databases',
  'victoriametrics-community-mcp-victorialogs': 'mcp-victorialogs',
  'victoriametrics-community-mcp-victoriametrics': 'mcp-victoriametrics',
  'bitbonsai-mcpvault': 'bitbonsai-mcp-obsidian',
  'mbailey-voice-mcp': 'voicemode',
  'kicad-mcp-pro-server': 'kicad-mcp-pro',
  'yusong652-pfc-mcp': 'itasca-mcp-server',
  'goldentrii-agentrecall': 'agent-recall',
  'mcp-server-apple-events': 'fradser-mcp-server-apple-reminders',
  'prism-coder': 'dcostenco-prism-mcp',
  'fatwang2-search1api-mcp': 'search1api',
  'openfate-bazi-mcp': 'openfate-ai-bazi-mcp',
  'mcp-odoo': 'tuanle96-mcp-odoo',
  'notfair-googleads': 'notfair',
  'google-ads-meta-ads-ga4-mcp': 'google-ads-meta-ads-seo-geo-mcp',
  'letsfg-flights-hotels': 'boostedtravel',
  'crw-web-scraper': 'us-crw',
  'mcp-video': 'kyanitelabs-kinocut',
  'payram-helper-mcp-server': 'payram',
};

/**
 * Listing pages with Google impressions from real queries (not `site:`) in
 * the 28 days to Nov 12 2026, per Search Console's pages and page-query
 * reports via LopeBase. They stay indexable whatever the other signals say.
 * Bing page data was unavailable that day (its LopeBase sign-in had expired).
 */
export const SEARCH_TRAFFIC_LISTINGS: ReadonlySet<string> = new Set([
  'agntor-mcp',
  'alforge-labs-alpha-forge-mcp',
  'andresdefi-zerodust',
  'askads-mcp-vk-ads',
  'beever-ai-beever-atlas',
  'blakerouse-ssh-mcp',
  'buildsyncinc-gibs-mcp',
  'ccf-agentcairn',
  'costajohnt-oss-autopilot',
  'hloiseaufcms-mcp-gopls',
  'isnow890-naver-search-mcp',
  'jobspipe',
  'kagisearch-kagimcp',
  'kukapay-defi-yields-mcp',
  'kukapay-raydium-launchlab-mcp',
  'linkedin-mcp-by-talktohumans',
  'liquidiction-liquidiction-mcp',
  'louis030195-easy-obsidian-mcp',
  'mcp-162',
  'mcpware-pagecast',
  'mkturner74-botverse-mcp',
  'newzai-mcp-server',
  'ofershap-real-browser-mcp',
  'openai-ads-mcp',
  'pab1ito-chess-mcp',
  'savvly-savvly-mcp',
  'testdino-hq-testdino-mcp',
  'toadlybroodle-satring',
  'unibaseio-membase-mcp',
  'varun29ankus-shodh-memory',
]);

export type IndexabilityInput = {
  id?: string;
  name?: string | null;
  /** Source repo or site URL (servers.url). */
  url?: string | null;
  status?: string | null;
  hasAiDoc: boolean;
  toolsSource?: string | null;
  installNeedsConfig?: Date | string | number | null;
  remoteEndpointHealthy?: boolean | number | null;
  /** Last successful remote handshake (servers.remoteEndpointHealthyAt). */
  remoteEndpointHealthyAt?: Date | string | number | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  /** Repo's last push (servers.lastCommitAt). Null = not measured. */
  lastCommitAt?: Date | string | number | null;
  /** servers.healthStatus: healthy | offline | archived | unknown. */
  healthStatus?: string | null;
  isOfficial?: boolean | number | null;
  ownerVerified?: boolean | number | null;
  /** Came in through /submit (servers.submitter_email set), not ingest. */
  humanSubmitted?: boolean | number | null;
  /** Flagged by the stale sweep (lib/staleness.ts). Noindexed during the grace period, before any removal. */
  staleFlagged?: boolean;
};

type IndexReason =
  | 'search-traffic'
  | 'trusted'
  | 'strong-traction'
  | 'traction'
  | 'submitted';

type NoindexReason =
  | 'not-active'
  | 'duplicate'
  | 'stale'
  | 'no-writeup'
  | 'archived'
  | 'generic-slug'
  | 'low-signal';

export type IndexVerdict =
  | { indexable: true; reason: IndexReason }
  | { indexable: false; reason: NoindexReason };

/** Why a listing is or isn't offered to search engines (see the module comment). */
export function listingIndexVerdict(s: IndexabilityInput): IndexVerdict {
  const no = (reason: NoindexReason): IndexVerdict => ({
    indexable: false,
    reason,
  });
  const yes = (reason: IndexReason): IndexVerdict => ({
    indexable: true,
    reason,
  });
  if (s.status && s.status !== 'active') return no('not-active');
  if (s.id && DUPLICATE_LISTINGS[s.id]) return no('duplicate');
  if (s.staleFlagged) return no('stale');
  if (s.id && SEARCH_TRAFFIC_LISTINGS.has(s.id)) return yes('search-traffic');
  if (!s.hasAiDoc) return no('no-writeup');
  if (s.healthStatus === 'archived') return no('archived');
  if (truthy(s.isOfficial) || truthy(s.ownerVerified)) return yes('trusted');

  const stars = s.githubStars ?? 0;
  const downloads = s.npmDownloads ?? 0;
  if (stars >= STRONG_GITHUB_STARS || downloads >= STRONG_NPM_DOWNLOADS) {
    return yes('strong-traction');
  }
  if (isGenericSlug(s.id, s.name)) return no('generic-slug');

  const verifiedRun = hasVerifiedRun(s);
  const traction =
    stars >= TRACTION_GITHUB_STARS ||
    (stars >= TRACTION_DOWNLOADS_MIN_STARS &&
      downloads >= TRACTION_NPM_DOWNLOADS);
  if (traction && verifiedRun && repoAlive(s.lastCommitAt)) {
    return yes('traction');
  }
  if (
    truthy(s.humanSubmitted) &&
    verifiedRun &&
    s.healthStatus !== 'offline' &&
    !(isGithubUrl(s.url) && stars < SUBMITTED_GITHUB_MIN_STARS)
  ) {
    return yes('submitted');
  }
  return no('low-signal');
}

export function isListingIndexable(s: IndexabilityInput): boolean {
  return listingIndexVerdict(s).indexable;
}

/** The listing a duplicate defers to (its canonical URL), or the id itself. */
export function canonicalListingId(id: string): string {
  return DUPLICATE_LISTINGS[id] ?? id;
}

/**
 * Slugs that read as mass-produced: a numbered placeholder (mcp-291,
 * mcp-server-62) that isn't the project's own name, or an ingest collision
 * suffix (iris-2, aws-mcp-server-3) the name doesn't carry. A project really
 * named "mcp-server-12306" or "GPT Image 2.5" is not flagged.
 */
export function isGenericSlug(
  id: string | undefined,
  name: string | null | undefined,
): boolean {
  if (!id) return false;
  const n = (name ?? '').trim();
  if (/^(mcp|mcp-server|server)-\d+$/.test(id) && n.toLowerCase() !== id) {
    return true;
  }
  const suffix = id.match(/-(\d{1,2})$/);
  return Boolean(suffix && !n.endsWith(suffix[1]));
}

function truthy(v: boolean | number | null | undefined): boolean {
  return v === true || v === 1;
}

function isGithubUrl(url: string | null | undefined): boolean {
  return /^http[^:]*:\/\/(www\.)?github\.com\//i.test(url ?? '');
}

/** A servers row (or the page's Server shape) as isServerRowIndexable reads it. */
type IndexabilityRow = Omit<
  IndexabilityInput,
  'hasAiDoc' | 'staleFlagged' | 'humanSubmitted'
> & {
  aiDoc?: string | null;
  staleFlaggedAt?: unknown;
  humanSubmitted?: boolean | number | null;
  /** A raw servers row (admin routes) carries the email instead of the flag. */
  submitterEmail?: string | null;
};

/** isListingIndexable for a servers row, as the /mcp/[id] page reads it. */
export function isServerRowIndexable(row: IndexabilityRow): boolean {
  return isListingIndexable(serverRowIndexabilityInput(row));
}

function serverRowIndexabilityInput(row: IndexabilityRow): IndexabilityInput {
  const { aiDoc, staleFlaggedAt, submitterEmail, humanSubmitted, ...rest } =
    row;
  return {
    ...rest,
    hasAiDoc: Boolean(aiDoc?.trim()),
    staleFlagged: staleFlaggedAt != null,
    humanSubmitted: truthy(humanSubmitted) || Boolean(submitterEmail),
  };
}

/**
 * Robots and canonical for a /mcp/[id] page. Removed listings are
 * noindex, nofollow; any other listing the rule leaves out is noindex, follow,
 * so link equity still flows through it. A duplicate canonicalizes to the
 * listing it defers to; everything else to itself.
 */
export function listingRobotsMeta(row: IndexabilityRow & { id: string }): {
  robots: { index: false; follow: boolean } | null;
  canonicalUrl: string;
} {
  const canonicalUrl = `https://allmcps.com/mcp/${canonicalListingId(row.id)}`;
  if (row.status === 'removed') {
    return { robots: { index: false, follow: false }, canonicalUrl };
  }
  return {
    robots: isServerRowIndexable(row) ? null : { index: false, follow: true },
    canonicalUrl,
  };
}

/** We saw the server work: live tools, a sandbox start that asked for keys, or a recently healthy remote endpoint. */
export function hasVerifiedRun(
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
    truthy(s.remoteEndpointHealthy) ||
    withinWindow(s.remoteEndpointHealthyAt, REMOTE_HEALTHY_WINDOW_MS)
  );
}

/** Unknown counts as alive: only GitHub-linked listings carry a commit date. */
function repoAlive(lastCommitAt: IndexabilityInput['lastCommitAt']): boolean {
  return (
    lastCommitAt == null || withinWindow(lastCommitAt, REPO_ALIVE_WINDOW_MS)
  );
}

function withinWindow(
  at: Date | string | number | null | undefined,
  windowMs: number,
) {
  if (at == null) return false;
  // Seconds or ms; D1 rows read raw (not through Drizzle) carry epoch seconds.
  const ms =
    typeof at === 'number'
      ? at < 1e12
        ? at * 1000
        : at
      : new Date(at).getTime();
  return !Number.isNaN(ms) && Date.now() - ms <= windowMs;
}

function idList(ids: Iterable<string>): SQL {
  return sql.join(
    [...ids].map((id) => sql`${id}`),
    sql`, `,
  );
}

/**
 * SQL form of isListingIndexable for aggregate reads (catalog coverage, hub
 * thresholds, IndexNow, llms.txt). Callers add the status filter themselves
 * (see servableFilter: `+status` keeps the planner off the status index).
 */
export function indexableListingSql(): SQL {
  const stars = sql`coalesce(${servers.githubStars}, 0)`;
  const downloads = sql`coalesce(${servers.npmDownloads}, 0)`;
  const nowSec = Math.floor(Date.now() / 1000);
  const healthySince = nowSec - REMOTE_HEALTHY_WINDOW_MS / 1000;
  const aliveSince = nowSec - REPO_ALIVE_WINDOW_MS / 1000;
  const verifiedRun = sql`(${servers.toolsSource} = 'introspected' OR ${servers.installNeedsConfig} IS NOT NULL OR coalesce(${servers.remoteEndpointHealthy}, 0) = 1 OR coalesce(${servers.remoteEndpointHealthyAt}, 0) >= ${healthySince})`;
  const strong = sql`(${stars} >= ${STRONG_GITHUB_STARS} OR ${downloads} >= ${STRONG_NPM_DOWNLOADS})`;
  const name = sql`trim(coalesce(${servers.name}, ''))`;
  const numbered = sql`((${servers.id} GLOB 'mcp-[0-9]*' AND substr(${servers.id}, 5) NOT GLOB '*[^0-9]*') OR (${servers.id} GLOB 'mcp-server-[0-9]*' AND substr(${servers.id}, 12) NOT GLOB '*[^0-9]*') OR (${servers.id} GLOB 'server-[0-9]*' AND substr(${servers.id}, 8) NOT GLOB '*[^0-9]*'))`;
  const genericSlug = sql`((${numbered} AND lower(${name}) <> ${servers.id}) OR (${servers.id} GLOB '*-[0-9]' AND NOT ${name} GLOB ('*' || substr(${servers.id}, -1))) OR (${servers.id} GLOB '*-[0-9][0-9]' AND NOT ${name} GLOB ('*' || substr(${servers.id}, -2))))`;
  const traction = sql`(${stars} >= ${TRACTION_GITHUB_STARS} OR (${stars} >= ${TRACTION_DOWNLOADS_MIN_STARS} AND ${downloads} >= ${TRACTION_NPM_DOWNLOADS}))`;
  const alive = sql`(${servers.lastCommitAt} IS NULL OR ${servers.lastCommitAt} >= ${aliveSince})`;
  const githubUrl = sql`(lower(${servers.url}) GLOB 'http*://github.com/*' OR lower(${servers.url}) GLOB 'http*://www.github.com/*')`;
  const submitted = sql`(${servers.submitterEmail} IS NOT NULL AND ${verifiedRun} AND coalesce(${servers.healthStatus}, '') <> 'offline' AND NOT (${githubUrl} AND ${stars} < ${SUBMITTED_GITHUB_MIN_STARS}))`;
  return sql`(CASE
    WHEN ${servers.id} IN (${idList(Object.keys(DUPLICATE_LISTINGS))}) THEN 0
    WHEN ${servers.staleFlaggedAt} IS NOT NULL THEN 0
    WHEN ${servers.id} IN (${idList(SEARCH_TRAFFIC_LISTINGS)}) THEN 1
    WHEN coalesce(${servers.aiDoc}, '') = '' THEN 0
    WHEN coalesce(${servers.healthStatus}, '') = 'archived' THEN 0
    WHEN coalesce(${servers.isOfficial}, 0) = 1 OR coalesce(${servers.ownerVerified}, 0) = 1 THEN 1
    WHEN ${strong} THEN 1
    WHEN ${genericSlug} THEN 0
    WHEN ${traction} AND ${verifiedRun} AND ${alive} THEN 1
    WHEN ${submitted} THEN 1
    ELSE 0 END) = 1`;
}
