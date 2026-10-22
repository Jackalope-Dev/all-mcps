import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import serversData from '../data/mcp-servers.json';
import {
  listingSignals,
  reviews,
  serverHealthChecks,
  servers as serversTable,
  stdioVerifications,
  users,
} from '../db/schema';
import {
  type AiFaqItem,
  parseFaqArray,
  parseStringArray,
  stripDocFiller,
  stripFaqSourceReferences,
  stripSourceReferences,
} from './aiContent';
import type { BestTopic } from './bestTopics';
import { categoryFromSlug } from './categories';
import { cleanListingDescription } from './description';
import { readEdgeCache, swrEdgeCache, writeEdgeCache } from './edgeCache';
import { isFeaturedListing } from './featuredStatus';
import { publicViewCount } from './format';
import {
  installConfidenceNote,
  isUnverifiedInstall,
  resolveInstallConfig,
} from './installConfig';
import { indexableListingSql } from './listingIndexability';
import {
  buildAiSearchText,
  buildSearchPrefilter,
  type Engagement,
  engagementScore,
  hybridRankServers,
  rankServers,
  type Searchable,
  type SearchPrefilter,
} from './search';
import {
  errorText,
  type FtsModePlan,
  ftsFuzzyMatch,
  ftsKeywordPlan,
  isFtsSchemaError,
  isSearchFtsReady,
  markSearchFtsUnavailable,
  SEARCH_FTS_READY_CURSOR,
} from './searchFts';
import { servableSql } from './servability';
import { rankShowcaseServers } from './showcase';
import { computeTrustTier, type TrustTierInput } from './trustTier';

/**
 * Active and not flagged by the stale sweep — the filter on every catalog
 * read that recommends listings. See lib/servability.ts for why.
 */
function servableFilter(): SQL {
  return and(
    eq(serversTable.status, 'active'),
    isNull(serversTable.staleFlaggedAt),
  ) as SQL;
}

export type ServerTool = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

/** Parse the `tools` column (JSON string) into a typed array, tolerating bad data. */
export function parseServerTools(raw: unknown): ServerTool[] {
  if (Array.isArray(raw)) return raw as ServerTool[];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.name === 'string')
      .map((t) => ({
        name: String(t.name),
        description: t.description ? String(t.description) : undefined,
        parameters: t.parameters || t.inputSchema || undefined,
      }));
  } catch {
    return [];
  }
}

function snapshotServers(): Server[] {
  return serversData as unknown as Server[];
}

/** Static catalog when D1 is down — omits retired redirect tombstones. */
function snapshotCatalogServers(): Server[] {
  return snapshotServers().filter((s) => s.status !== 'removed');
}

/**
 * Normalizes a raw listing so downstream consumers never see scraped README chrome.
 * Returns a shallow copy — the imported JSON module is shared across requests and
 * must not be mutated in place. Also parses the `tools` JSON column into an array.
 */
function normalizeServer<
  T extends { description?: string | null; tools?: unknown },
>(server: T): T {
  const s = server as {
    aiUseCases?: unknown;
    aiFeatures?: unknown;
    aiEnvVars?: unknown;
    aiFaq?: unknown;
    aiDoc?: string | null;
    aiOverview?: string | null;
    tags?: unknown;
    compatibleClients?: unknown;
    suggestedInstallArgs?: unknown;
  };
  return {
    ...server,
    description: cleanListingDescription(server.description),
    tools: parseServerTools((server as { tools?: unknown }).tools),
    // AI content JSON-array columns → typed arrays (absent in the static snapshot → []).
    aiUseCases: parseStringArray(s.aiUseCases),
    aiFeatures: parseStringArray(s.aiFeatures),
    aiEnvVars: parseStringArray(s.aiEnvVars),
    aiFaq: stripFaqSourceReferences(parseFaqArray(s.aiFaq)),
    ...(s.aiDoc !== undefined
      ? { aiDoc: stripSourceReferences(stripDocFiller(s.aiDoc)) }
      : {}),
    ...(s.aiOverview !== undefined
      ? { aiOverview: stripSourceReferences(s.aiOverview) }
      : {}),
    // Submitter-controlled JSON-array columns → typed arrays.
    tags: parseStringArray(s.tags),
    compatibleClients: parseStringArray(s.compatibleClients),
    suggestedInstallArgs: parseStringArray(s.suggestedInstallArgs),
  };
}

/**
 * Columns safe to expose to anonymous visitors and public API consumers.
 * Deliberately excludes submitterEmail, stripeCustomerId, stripeSubscriptionId,
 * ownerUserId, pendingClaimUserId/WebsiteUrl, premiumStatus, pendingRevision,
 * reviewPriority, reviewFlagged, claimedAt, badgeLastCheckedAt — never bare `db.select()` a
 * server row for a public page or API response; select this instead.
 */
export const PUBLIC_SERVER_COLUMNS = {
  id: serversTable.id,
  name: serversTable.name,
  url: serversTable.url,
  description: serversTable.description,
  category: serversTable.category,
  websiteUrl: serversTable.websiteUrl,
  logoUrl: serversTable.logoUrl,
  isPremium: serversTable.isPremium,
  websiteVerified: serversTable.websiteVerified,
  isOfficial: serversTable.isOfficial,
  featuredUntil: serversTable.featuredUntil,
  categorySponsorUntil: serversTable.categorySponsorUntil,
  status: serversTable.status,
  lastCheckedAt: serversTable.lastCheckedAt,
  isVerifiedActive: serversTable.isVerifiedActive,
  healthStatus: serversTable.healthStatus,
  reciprocalBadgeOk: serversTable.reciprocalBadgeOk,
  readmeBadgeOk: serversTable.readmeBadgeOk,
  websiteBacklinkOk: serversTable.websiteBacklinkOk,
  githubStars: serversTable.githubStars,
  npmDownloads: serversTable.npmDownloads,
  lastCommitAt: serversTable.lastCommitAt,
  tools: serversTable.tools,
  toolsSource: serversTable.toolsSource,
  remoteEndpointUrl: serversTable.remoteEndpointUrl,
  remoteEndpointHealthy: serversTable.remoteEndpointHealthy,
  remoteEndpointCheckedAt: serversTable.remoteEndpointCheckedAt,
  aiSummary: serversTable.aiSummary,
  aiOverview: serversTable.aiOverview,
  aiUseCases: serversTable.aiUseCases,
  aiFeatures: serversTable.aiFeatures,
  aiFaq: serversTable.aiFaq,
  aiFaqAt: serversTable.aiFaqAt,
  aiEnvVars: serversTable.aiEnvVars,
  aiEnrichedAt: serversTable.aiEnrichedAt,
  aiDoc: serversTable.aiDoc,
  aiDocAt: serversTable.aiDocAt,
  installKind: serversTable.installKind,
  installCommand: serversTable.installCommand,
  installArgs: serversTable.installArgs,
  installPackage: serversTable.installPackage,
  installConfidence: serversTable.installConfidence,
  installExtractedAt: serversTable.installExtractedAt,
  vulnEcosystem: serversTable.vulnEcosystem,
  vulnCriticalCount: serversTable.vulnCriticalCount,
  vulnHighCount: serversTable.vulnHighCount,
  vulnMediumCount: serversTable.vulnMediumCount,
  vulnLowCount: serversTable.vulnLowCount,
  vulnScannedAt: serversTable.vulnScannedAt,
  installNeedsConfig: serversTable.installNeedsConfig,
  staleFlaggedAt: serversTable.staleFlaggedAt,
  views: serversTable.views,
  totalViews: serversTable.totalViews,
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
  createdAt: serversTable.createdAt,
  tags: serversTable.tags,
  pricingModel: serversTable.pricingModel,
  pricingNotes: serversTable.pricingNotes,
  authType: serversTable.authType,
  license: serversTable.license,
  compatibleClients: serversTable.compatibleClients,
  maintenanceStatus: serversTable.maintenanceStatus,
  supportUrl: serversTable.supportUrl,
  screenshotUrl: serversTable.screenshotUrl,
  suggestedInstallCommand: serversTable.suggestedInstallCommand,
  suggestedInstallArgs: serversTable.suggestedInstallArgs,
  redirectTo: serversTable.redirectTo,
} as const;

export type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  redirectTo?: string | null;
  /** Optional setup note shown above install config. JSON-only until persisted. */
  installNote?: string | null;
  installNoteHref?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  isPremium?: boolean;
  websiteVerified?: boolean;
  featuredUntil?: string | Date | null;
  /** Active only when purchased via category_sponsor_7d and not yet expired; scoped to `category` at purchase time. */
  categorySponsorUntil?: string | Date | null;
  status: string;
  lastCheckedAt?: string | Date | null;
  isVerifiedActive?: boolean;
  healthStatus?: string;
  /** Derived aggregate: readmeBadgeOk || websiteBacklinkOk. See db/schema.ts. */
  reciprocalBadgeOk?: boolean;
  /** Repo README carries our badge/link. See db/schema.ts. */
  readmeBadgeOk?: boolean;
  /** Custom website carries a dofollow backlink — gates website-link dofollow. See db/schema.ts. */
  websiteBacklinkOk?: boolean;
  githubStars?: number | null;
  npmDownloads?: number | null;
  /** Repo `pushed_at` from GitHub, refreshed by the health cron. Null = not a GitHub-linked listing or not measured yet. */
  lastCommitAt?: string | Date | null;
  /** Parsed by normalizeServer from the `tools` JSON column. */
  tools?: ServerTool[];
  /** 'introspected' (live MCP handshake) | 'readme' (best-effort static parse) | null. */
  toolsSource?: string | null;
  /** Optional secondary connection method — a hosted endpoint offered alongside the primary install method. See db/schema.ts. */
  remoteEndpointUrl?: string | null;
  /** Live health of remoteEndpointUrl specifically, from the health cron's handshake. Separate from healthStatus/isVerifiedActive, which track the primary url. Null = never checked. */
  remoteEndpointHealthy?: boolean | null;
  remoteEndpointCheckedAt?: string | Date | null;
  /**
   * Combined "we actually observed this server working" signal for the
   * quality score's availability component — max of the rolling
   * remote-endpoint check history and a recent E2B stdio verification pass, so a
   * transient failure on one transport doesn't erase a confirmed-working
   * result from the other. Not persisted; computed and attached only where a
   * caller has both signals on hand (currently just the detail page — see
   * app/mcp/[id]/page.tsx). Undefined everywhere else, where
   * computeQualityScore falls back to the live remoteEndpointHealthy snapshot.
   */
  combinedAvailabilityPct?: number | null;
  /**
   * Review aggregate for the quality score's community-engagement component
   * (see lib/qualityScore.ts, getServerReviews below). Not persisted on
   * `servers` and not populated by getServerById itself — bulk contexts
   * (search results, category cards, catalog-wide stats) would otherwise pay
   * for a reviews join on every listing they touch just for a small score
   * bonus. Undefined everywhere except the detail page (app/mcp/[id]/page.tsx,
   * which already fetches getServerReviews for the Reviews section and merges
   * it in), where computeQualityScore treats undefined the same as 0 —
   * a listing without review data simply forfeits that slice of credit
   * rather than being penalized or excluded.
   */
  reviewCount?: number;
  avgRating?: number;
  /** LLM-generated content layer (see lib/aiContent + /api/cron/ai-content). */
  aiSummary?: string | null;
  aiOverview?: string | null;
  /** Parsed by normalizeServer from the `ai_use_cases` / `ai_features` / `ai_env_vars` JSON columns. */
  aiUseCases?: string[];
  aiFeatures?: string[];
  /** Parsed by normalizeServer from the `ai_faq` JSON column. Empty until the
   * ai-content/ai-faq cron has generated it — pages fall back to boilerplate. */
  aiFaq?: AiFaqItem[];
  /** When the FAQ was last generated (`ai_faq_at`). Feeds the honest
   * content-freshness lastmod — see lib/sitemapHelpers.ts listingLastMod. */
  aiFaqAt?: string | Date | null;
  /** UPPER_SNAKE_CASE env var names the README/setup instructions say are required to run this server. */
  aiEnvVars?: string[];
  aiEnrichedAt?: string | Date | null;
  /** Long-form restructured markdown writeup — the /mcp/[id] body content that
   * replaced mirroring the raw README (which moved to /mcp/[id]/readme). Null
   * until the ai-content cron reaches this row. See lib/aiContent.ts. */
  aiDoc?: string | null;
  /** When `ai_doc` was last generated (`ai_doc_at`). Separate backfill clock;
   * also feeds the content-freshness lastmod. */
  aiDocAt?: string | Date | null;
  installKind?: string | null;
  installCommand?: string | null;
  installArgs?: string | string[] | null;
  installPackage?: string | null;
  installConfidence?: string | null;
  /** When the LLM last validated/void'd the install fields above. See installExtractedAt in db/schema.ts. */
  installExtractedAt?: string | Date | null;
  /** Supply-chain vulnerability signal (see /api/cron/vuln-scan, lib/vulnScan.ts). Null/undefined = never scanned — never treated as a negative signal. */
  vulnEcosystem?: string | null;
  vulnCriticalCount?: number | null;
  vulnHighCount?: number | null;
  vulnMediumCount?: number | null;
  vulnLowCount?: number | null;
  vulnScannedAt?: string | Date | null;
  /** E2B started it, then it stopped for configuration (API key etc.). Feeds the trust tier. */
  installNeedsConfig?: string | Date | null;
  /** Jev is-an-MCP-server probability (lib/listingReview.ts). From listing_signals — only the detail page merges it in. */
  mcpProbability?: number | null;
  /** Set while the stale sweep has this listing flagged (noindexed). See lib/staleness.ts. */
  staleFlaggedAt?: string | Date | null;
  /** Raw SecurityProfile JSON (listing_signals) — parse with parseSecurityProfile. Detail page only. */
  securityProfile?: string | null;
  /** Last time the tool definitions changed after a previous profile existed. */
  toolsChangedAt?: string | Date | null;
  /** Comma-separated StaleReason list while the stale sweep has this listing flagged (listing_signals). */
  staleReasons?: string | null;
  /** Windowed ranking count — internal; display totalViews via publicViewCount. */
  views?: number;
  /** Public view count (every listing page load). Absent on snapshot rows. */
  totalViews?: number;
  copies?: number;
  upvotes?: number;
  createdAt: string | Date;
  /** Parsed by normalizeServer from the `tags` JSON column. Freeform, submitter-chosen (≤5, ≤30 chars each). */
  tags?: string[];
  /** free | freemium | paid | byok — self-declared cost of *using* this MCP server. See lib/serverEnums.ts. */
  pricingModel?: string | null;
  pricingNotes?: string | null;
  /** none | api_key | oauth | other — self-declared auth requirement. See lib/serverEnums.ts. */
  authType?: string | null;
  license?: string | null;
  /** Parsed by normalizeServer from the `compatible_clients` JSON column. Slugs from lib/clients.ts MCP_CLIENTS. */
  compatibleClients?: string[];
  /** active | stable | experimental | archived — self-declared, distinct from the auto healthStatus. See lib/serverEnums.ts. */
  maintenanceStatus?: string | null;
  supportUrl?: string | null;
  /** Live, admin-approved screenshot URL (e.g. `/screenshots/<id>`). Null = no screenshot shown. */
  screenshotUrl?: string | null;
  /** Submitter-suggested install command, used as a hint only when installConfidence is low/absent. */
  suggestedInstallCommand?: string | null;
  /** Parsed by normalizeServer from the `suggested_install_args` JSON column. */
  suggestedInstallArgs?: string[];
};

/** Columns needed for homepage-wide ranking/counts — see getActiveServersLight. */
const DISCOVERY_COLUMNS = {
  id: serversTable.id,
  name: serversTable.name,
  url: serversTable.url,
  description: serversTable.description,
  category: serversTable.category,
  status: serversTable.status,
  createdAt: serversTable.createdAt,
  logoUrl: serversTable.logoUrl,
  isOfficial: serversTable.isOfficial,
  isPremium: serversTable.isPremium,
  featuredUntil: serversTable.featuredUntil,
  views: serversTable.views,
  totalViews: serversTable.totalViews,
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
  tags: serversTable.tags,
  aiUseCases: serversTable.aiUseCases,
} as const;

/** A DISCOVERY_COLUMNS row in the shape getActiveServersLight returns. */
function toLightServer(r: {
  description: string | null;
  tags: unknown;
  aiUseCases: unknown;
}): Server {
  return {
    ...r,
    description: cleanListingDescription(r.description),
    tags: parseStringArray(r.tags),
    aiUseCases: parseStringArray(r.aiUseCases),
  } as unknown as Server;
}

/** Snapshot rows trimmed to the getActiveServersLight shape. */
function snapshotLightServers(limit?: number): Server[] {
  const base = snapshotCatalogServers();
  const candidates = limit ? base.slice(0, limit) : base;
  return candidates.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    description: cleanListingDescription(s.description),
    category: s.category,
    status: s.status,
    createdAt: s.createdAt,
    logoUrl: s.logoUrl ?? null,
    isOfficial: !!s.isOfficial,
    isPremium: !!s.isPremium,
    featuredUntil: s.featuredUntil ?? null,
    views: s.views ?? 0,
    totalViews: s.totalViews ?? 0,
    copies: s.copies ?? 0,
    upvotes: s.upvotes ?? 0,
    githubStars: s.githubStars ?? null,
    npmDownloads: s.npmDownloads ?? null,
    tags: parseStringArray(s.tags),
    aiUseCases: parseStringArray(s.aiUseCases),
  })) as unknown as Server[];
}

/**
 * Lightweight discovery rows for homepage marquee/featured ranking: the
 * `limit` most-engaged servable listings. Deliberately excludes `tools` and
 * the AI-content columns — those can be several KB per listing (introspected
 * tool schemas, generated overviews). Whole-catalog consumers (tag counts)
 * must page with iterateActiveServersLight instead: ~32k rows at once, even
 * slim, is enough to push a render over the Worker memory limit.
 */
export async function getActiveServersLight(limit: number): Promise<Server[]> {
  const rows = await swrEdgeCache(
    `catalog/discovery-pool/v1/${limit}`,
    CATALOG_POOL_CACHE,
    () => queryDiscoveryPool(limit),
  );
  if (rows) return rows.map(toLightServer);
  return snapshotLightServers(limit);
}

/**
 * Catalog pools for the homepage and /categories sort every servable listing
 * (~32k rows, on expressions no index covers). On a D1 busy with the cron
 * ticks that ran past the 25s ISR revalidation timeout on `/`
 * ("TimeoutError: The operation was aborted due to timeout"), so they are
 * served stale-while-revalidate from the edge cache.
 */
const CATALOG_POOL_CACHE = {
  freshMs: 10 * 60 * 1000,
  maxAgeSeconds: 24 * 60 * 60,
};

async function queryDiscoveryPool(limit: number) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(DISCOVERY_COLUMNS)
        .from(serversTable)
        .where(servableFilter())
        .orderBy(
          desc(serversTable.isPremium),
          // Active featured boosts must make the capped pool regardless of
          // traffic, or a low-view paid listing never reaches the shelf.
          desc(sql`coalesce(${serversTable.featuredUntil} > unixepoch(), 0)`),
          desc(serversTable.views),
          desc(serversTable.copies),
          desc(serversTable.upvotes),
        )
        .limit(limit);
      if (rows.length > 0) return rows;
    }
  } catch (_e) {
    // Callers fall back to static JSON
  }
  return null;
}

/** Rows per iterateActiveServersLight page; slim rows keep a page a few MB. */
const LIGHT_PAGE_SIZE = 2000;

/**
 * Every servable listing as getActiveServersLight-shaped rows, one keyset page
 * at a time, so whole-catalog aggregations (tag counts, tag hubs) hold one
 * page instead of the full ~32k-row catalog. Paged on rowid like
 * lib/siteStats.ts queryQualityTiers: (status, rowid) walks
 * idx_servers_status in order instead of re-sorting every active row per page.
 */
type LightPageRow = {
  rowid: number;
  description: string | null;
  tags: unknown;
  aiUseCases: unknown;
  indexable: number;
};

/**
 * A light row from iterateActiveServersLight. `indexable` is the listing's
 * isListingIndexable verdict, read from D1; undefined for snapshot rows.
 */
export type LightServer = Server & { indexable?: boolean };

export async function* iterateActiveServersLight(
  pageSize = LIGHT_PAGE_SIZE,
  /** false: yield nothing when D1 is unavailable (callers that cache the result). */
  { snapshotFallback = true }: { snapshotFallback?: boolean } = {},
): AsyncGenerator<LightServer[]> {
  const searchDb = await getSearchDb();
  let yielded = false;
  if (searchDb) {
    try {
      let afterRowid: number | null = null;
      for (;;) {
        // Annotated: afterRowid feeding back into the query defeats inference.
        const rows: LightPageRow[] = await searchDb.db
          .select({
            rowid: sql<number>`rowid`,
            ...DISCOVERY_COLUMNS,
            // engagementScore inputs: the tag index ranks each tag's listings.
            githubStars: serversTable.githubStars,
            npmDownloads: serversTable.npmDownloads,
            // Tag pages index only on listings we index (lib/tags.ts).
            indexable: sql<number>`${indexableListingSql()}`,
          })
          .from(serversTable)
          .where(
            afterRowid === null
              ? servableFilter()
              : and(servableFilter(), sql`rowid > ${afterRowid}`),
          )
          .orderBy(sql`rowid`)
          .limit(pageSize);
        if (rows.length === 0) break;
        yielded = true;
        yield rows.map(({ rowid: _rowid, indexable, ...r }) => ({
          ...toLightServer(r),
          indexable: Boolean(indexable),
        }));
        if (rows.length < pageSize) break;
        afterRowid = rows[rows.length - 1].rowid;
      }
    } catch (e) {
      // Fall back to static JSON only if nothing was yielded yet; a partial
      // scan followed by the snapshot would double-count listings.
      if (yielded) throw e;
    }
  }
  if (!yielded && snapshotFallback) yield snapshotLightServers();
}

/**
 * Newest N active listings with full detail (tools, AI content, install
 * hints) — sorted and capped at the DB level so we never have to pull and
 * parse the entire catalog in the Worker just to keep the first 48.
 */
/**
 * The general-purpose "install these first" stack shown on client landers
 * (/mcp-for-cursor, /mcp-for-claude-desktop, etc.) — real, well-known servers
 * people actually search for, not whatever was submitted most recently.
 * Ordered roughly by how often a new MCP setup reaches for it.
 */
const CURATED_STARTER_STACK_IDS: string[] = [
  'github-github-mcp-server', // GitHub, official
  'filesystem', // Filesystem
  'crystaldba-postgres-mcp', // Postgres
  'microsoft-playwright-mcp', // Playwright, official (Microsoft)
  'upstash-context7', // Context7
  'fetch', // Fetch
  'korotovsky-slack-mcp-server', // Slack
  'hashicorp-terraform-mcp-server', // Terraform, official
  'firecrawl-firecrawl-mcp-server', // Firecrawl, official
  'mcp-121', // Notion, official (makenotion/notion-next)
  'tacticlaunch-mcp-linear', // Linear
  'getsentry-sentry-mcp', // Sentry, official
];

/**
 * Curated starter stack, backfilled with the newest active listings if any
 * curated id is missing/inactive so callers always get `limit` servers.
 */
export async function getCuratedStarterServers(limit = 12): Promise<Server[]> {
  const curated = await getServersByIds(
    CURATED_STARTER_STACK_IDS.slice(0, limit),
  );
  if (curated.length >= limit) return curated.slice(0, limit);
  const seen = new Set(curated.map((s) => s.id));
  const fill = await getNewestActiveServers(limit - curated.length + seen.size);
  for (const s of fill) {
    if (curated.length >= limit) break;
    if (!seen.has(s.id)) {
      curated.push(s);
      seen.add(s.id);
    }
  }
  return curated;
}

/**
 * Active servers matching the given ids, in the order requested (curated
 * "starter stack" lists — client landers, etc.) — not sorted by recency.
 * Any id with no active match is silently dropped, so callers should backfill
 * (e.g. with getNewestActiveServers) if they need an exact count.
 */
async function getServersByIds(ids: string[]): Promise<Server[]> {
  if (ids.length === 0) return [];
  let found: Server[] = [];
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(and(inArray(serversTable.id, ids), servableFilter()));
      found = rows.map((r) => normalizeServer(r as unknown as Server));
    }
  } catch (_e) {
    // Fall back to static JSON
  }
  if (found.length === 0) {
    const all = snapshotCatalogServers();
    found = ids
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Server => Boolean(s))
      .map(normalizeServer);
  }
  const byId = new Map(found.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is Server => Boolean(s));
}

export async function getNewestActiveServers(limit: number): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(servableFilter())
        .orderBy(desc(serversTable.createdAt))
        .limit(limit);
      if (rows.length > 0) {
        return rows.map((r) => normalizeServer(r as unknown as Server));
      }
    }
  } catch (_e) {
    // Fall back to static JSON
  }
  return snapshotCatalogServers()
    .map(normalizeServer)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))
    .slice(0, limit);
}

/**
 * Homepage showcase: the strongest active listings (logo, alive, adopted,
 * well-documented) rather than the newest imports. Pulls a popularity-ordered
 * candidate pool of indexable listings (our writeup, traction, proof it runs;
 * lib/listingIndexability.ts) from D1, then re-ranks it with
 * rankShowcaseServers. The pool is ordered by adoption, not the official flag
 * first: that put the protocol's reference servers and tiny self-declared
 * "official" repos ahead of the vendor servers people come looking for. The pool
 * uses the slim scoring columns (no aiDoc/aiFaq, tools trimmed in SQLite):
 * 300 full rows with tool schemas blew the Worker memory limit on `/`.
 */
export async function getShowcaseActiveServers(
  limit: number,
): Promise<Server[]> {
  const poolSize = Math.max(limit * 6, 300);
  const rows = await swrEdgeCache(
    `catalog/showcase-pool/v2/${poolSize}`,
    CATALOG_POOL_CACHE,
    () => queryShowcasePool(poolSize),
  );
  if (rows) {
    return rankShowcaseServers(
      rows.map((r) => normalizeServer(r as unknown as Server)),
      limit,
    );
  }
  return rankShowcaseServers(
    snapshotCatalogServers().map(normalizeServer),
    limit,
  );
}

async function queryShowcasePool(poolSize: number) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(SCORING_SERVER_COLUMNS)
        .from(serversTable)
        .where(
          and(
            servableFilter(),
            sql`coalesce(${serversTable.logoUrl}, '') <> ''`,
            sql`coalesce(${serversTable.healthStatus}, '') not in ('archived', 'offline')`,
            indexableListingSql(),
            // Reference servers (lib/showcase.ts isReferenceServer) would fill
            // the top of a stars-ordered pool with monorepo stars. instr, not
            // LIKE: D1 rejects LIKE patterns this long as "too complex".
            sql`instr(lower(${serversTable.url}), 'github.com/modelcontextprotocol/servers/') = 0`,
            sql`instr(lower(${serversTable.url}), 'github.com/modelcontextprotocol/servers-archived/') = 0`,
          ),
        )
        .orderBy(
          desc(serversTable.githubStars),
          desc(serversTable.npmDownloads),
          desc(serversTable.upvotes),
          desc(serversTable.copies),
          desc(serversTable.views),
        )
        .limit(poolSize);
      if (rows.length > 0) return rows;
    }
  } catch (_e) {
    // The caller falls back to static JSON
  }
  return null;
}

/**
 * Every column relatedRankingScore() (without a `current` server) and
 * engagementScore() read, plus what category cards, /best rows and markdown
 * summary lines render. No `tools`, no AI text.
 */
const RANKING_COLUMNS = {
  id: serversTable.id,
  name: serversTable.name,
  url: serversTable.url,
  description: serversTable.description,
  category: serversTable.category,
  logoUrl: serversTable.logoUrl,
  createdAt: serversTable.createdAt,
  views: serversTable.views,
  totalViews: serversTable.totalViews,
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
  githubStars: serversTable.githubStars,
  npmDownloads: serversTable.npmDownloads,
  installConfidence: serversTable.installConfidence,
  isOfficial: serversTable.isOfficial,
  isPremium: serversTable.isPremium,
  isVerifiedActive: serversTable.isVerifiedActive,
  healthStatus: serversTable.healthStatus,
  reciprocalBadgeOk: serversTable.reciprocalBadgeOk,
  featuredUntil: serversTable.featuredUntil,
  categorySponsorUntil: serversTable.categorySponsorUntil,
} as const;

/**
 * Slim rows (RANKING_COLUMNS only) for ranking a slice of the active catalog:
 * one category, and/or listings whose name or description mentions a keyword.
 *
 * Category and topic pages used to load every matching row with the full
 * public column set (raw tools JSON + every AI-text column). The catalog is
 * now ~27k listings carrying ~30MB of tools JSON and ~15MB of AI text, and
 * "💻 Developer Tools" alone holds ~13.7k of them, so those pages tripped the
 * Worker memory limit (outcome: exceededMemory on /best/google-workspace, a
 * keyword topic that scanned the whole catalog). Callers rank these slim rows
 * and pass only the ids they render to hydrateServersByIds when they need
 * more than these columns.
 *
 * `keywords` is a coarse SQL LIKE prefilter; callers still apply their exact
 * (word-boundary) match in JS, as selectServersForTopic does.
 */
export async function getRankingCandidates(filter: {
  category?: string | null;
  keywords?: string[];
}): Promise<Server[]> {
  const keywords = (filter.keywords ?? []).filter(Boolean);
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const conditions: (SQL | undefined)[] = [servableFilter()];
      if (filter.category) {
        conditions.push(eq(serversTable.category, filter.category));
      }
      if (keywords.length > 0) {
        conditions.push(
          or(
            ...keywords.flatMap((k) => [
              like(serversTable.name, `%${k}%`),
              like(serversTable.description, `%${k}%`),
            ]),
          ),
        );
      }
      const rows = await db
        .select(RANKING_COLUMNS)
        .from(serversTable)
        .where(and(...conditions));
      if (rows.length > 0) {
        return rows.map((r) => ({
          ...r,
          description: cleanListingDescription(r.description),
        })) as unknown as Server[];
      }
    }
  } catch (_e) {
    // Fall back to static JSON
  }

  const lowered = keywords.map((k) => k.toLowerCase());
  return snapshotCatalogServers()
    .filter(
      (s) =>
        (!filter.category || s.category === filter.category) &&
        (lowered.length === 0 ||
          lowered.some((k) =>
            `${s.name} ${s.description || ''}`.toLowerCase().includes(k),
          )),
    )
    .map(normalizeServer);
}

/**
 * Full rows (public columns, tools trimmed to name + description) for just the
 * ids a page renders, in the order given. Pairs with getRankingCandidates.
 */
export async function hydrateServersByIds(ids: string[]): Promise<Server[]> {
  if (ids.length === 0) return [];
  const searchDb = await getSearchDb();
  if (searchDb) {
    try {
      const rows = await hydrateSearchResults(searchDb.db, ids);
      if (rows.length > 0) return rows;
    } catch (_e) {
      // Fall back to static JSON
    }
  }
  const byId = new Map(snapshotCatalogServers().map((s) => [s.id, s]));
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is Server => Boolean(s))
    .map(normalizeServer);
}

/**
 * A uniform random sample of active listings (optionally one category), as full
 * rows with tools trimmed. Lets "random"/"surprise me" pickers choose from a
 * bounded pool instead of loading the whole ~27k-row catalog to keep 1-5 rows.
 */
export async function getRandomActiveServers(
  sampleSize: number,
  category?: string | null,
): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(SCORING_SERVER_COLUMNS)
        .from(serversTable)
        .where(
          and(
            servableFilter(),
            category ? eq(serversTable.category, category) : undefined,
          ),
        )
        .orderBy(sql`random()`)
        .limit(sampleSize);
      if (rows.length > 0) {
        return rows.map((r) => normalizeServer(r as unknown as Server));
      }
    }
  } catch (_e) {
    // Fall back to static JSON
  }
  return snapshotCatalogServers()
    .filter((s) => !category || s.category === category)
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize)
    .map(normalizeServer);
}

/**
 * Every active listing, `pageSize` full rows (tools trimmed) at a time in id
 * order, for whole-catalog exports such as /llms-full.txt. Holding the whole
 * ~27k-row catalog plus the rendered output at once exceeds the Worker memory
 * limit, so callers stream each page out before asking for the next.
 */
export async function* iterateActiveServers(
  pageSize = 500,
): AsyncGenerator<Server[]> {
  const searchDb = await getSearchDb();
  let after = '';
  let yielded = false;
  if (searchDb) {
    try {
      for (;;) {
        const rows = await searchDb.db
          .select(SCORING_SERVER_COLUMNS)
          .from(serversTable)
          .where(and(servableFilter(), gt(serversTable.id, after)))
          .orderBy(serversTable.id)
          .limit(pageSize);
        if (rows.length === 0) break;
        yielded = true;
        yield rows.map((r) => normalizeServer(r as unknown as Server));
        after = rows[rows.length - 1].id;
        if (rows.length < pageSize) break;
      }
    } catch (e) {
      // Fall back to static JSON only if nothing was streamed yet; a partial
      // export followed by a different snapshot would duplicate listings.
      if (yielded) throw e;
    }
  }
  if (!yielded) {
    const snapshot = snapshotCatalogServers().map(normalizeServer);
    for (let i = 0; i < snapshot.length; i += pageSize) {
      yield snapshot.slice(i, i + pageSize);
    }
  }
}

/** Row shape for whole-catalog indexes (/data.json, the Cmd+K search index). */
export type CatalogIndexRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  url: string;
  logoUrl: string | null;
  aiSummary: string | null;
};

/**
 * Every active listing with only the columns a catalog index needs. Like
 * getServersForLlmsTxt, it skips `tools` and the long AI columns that made
 * getActiveServersForScoring() too heavy for whole-catalog routes.
 */
export async function getCatalogIndexRows(): Promise<CatalogIndexRow[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({
          id: serversTable.id,
          name: serversTable.name,
          description: serversTable.description,
          category: serversTable.category,
          url: serversTable.url,
          logoUrl: serversTable.logoUrl,
          aiSummary: serversTable.aiSummary,
        })
        .from(serversTable)
        .where(servableFilter());
      if (rows.length > 0) {
        return rows.map((r) => ({
          ...r,
          description: cleanListingDescription(r.description),
        }));
      }
    }
  } catch (_e) {
    // Fall back to static JSON
  }
  return snapshotCatalogServers().map((s) => ({
    id: s.id,
    name: s.name,
    description: cleanListingDescription(s.description),
    category: s.category,
    url: s.url,
    logoUrl: s.logoUrl ?? null,
    aiSummary: s.aiSummary ?? null,
  }));
}

/** Category counts computed via lightweight SQL GROUP BY for category sidebar links. */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({
          category: serversTable.category,
          count: sql<number>`count(*)`,
        })
        .from(serversTable)
        .where(servableFilter())
        .groupBy(serversTable.category);
      const counts: Record<string, number> = {};
      for (const r of rows) {
        if (r.category) counts[r.category] = Number(r.count);
      }
      if (Object.keys(counts).length > 0) return counts;
    }
  } catch (_e) {}

  const counts: Record<string, number> = {};
  for (const s of snapshotCatalogServers()) {
    if (s.category) counts[s.category] = (counts[s.category] || 0) + 1;
  }
  return counts;
}

/** Top N active servers sorted by overall popularity (views + installs + upvotes), capped at the DB level. */
export async function getPopularServers(limit: number): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(servableFilter())
        .orderBy(
          desc(serversTable.views),
          desc(serversTable.copies),
          desc(serversTable.upvotes),
        )
        .limit(limit);
      if (rows.length > 0) {
        return rows.map((r) => normalizeServer(r as unknown as Server));
      }
    }
  } catch (_e) {}

  return snapshotCatalogServers()
    .map(normalizeServer)
    .sort(
      (a, b) =>
        (b.views || 0) + (b.copies || 0) - ((a.views || 0) + (a.copies || 0)),
    )
    .slice(0, limit);
}

/**
 * Trims each row's `tools` JSON down to {name, description} inside SQLite
 * itself, so the full parameter/inputSchema blobs (a few outlier listings
 * carry hundreds of tools, one has 987) never get pulled into the Worker's
 * JS heap in the first place. Trimming after the fact in JS was too late —
 * the OOM happens while D1 hands back and drizzle parses the full rows, not
 * afterward. json_valid guards malformed `tools` text (parseServerTools()
 * already tolerates bad JSON) so one bad row can't abort the whole scan.
 */
const TRIMMED_TOOLS_SQL = sql<
  string | null
>`CASE WHEN json_valid(${serversTable.tools}) THEN (
  SELECT json_group_array(json_object('name', json_extract(je.value, '$.name'), 'description', json_extract(je.value, '$.description')))
  FROM json_each(${serversTable.tools}) AS je
) ELSE NULL END`;

/**
 * PUBLIC_SERVER_COLUMNS minus the big text blobs never read by
 * relatedRankingScore/engagementScore (aiFaq, aiDoc — several KB each per row,
 * and this scans the whole catalog), tools trimmed at the SQL level.
 */
const {
  aiFaq: _omitAiFaq,
  aiDoc: _omitAiDoc,
  tools: _fullTools,
  ...SCORING_SERVER_COLUMNS_REST
} = PUBLIC_SERVER_COLUMNS;
const SCORING_SERVER_COLUMNS = {
  ...SCORING_SERVER_COLUMNS_REST,
  tools: TRIMMED_TOOLS_SQL,
};

/**
 * Most rows one search prefilter pass hands back to the Worker. Slim candidate rows
 * are a few KB each, so this stays far below the Worker memory limit whatever the
 * query. Name hits and engagement are sorted first so the cut drops the weakest
 * rows. A broad single term like "ai" matches ~13k listings, and callers only take
 * up to 100 results.
 */
const SEARCH_CANDIDATE_CAP = 1500;

/** How long a search waits on the best-effort vector step before going keyword-only. */
const VECTOR_SEARCH_TIMEOUT_MS = 1500;

/** D1 rejects statements with more than 100 bound parameters. */
const D1_ID_CHUNK = 90;

/**
 * Every column scoreServerMatch can match on, concatenated inside SQLite. Raw
 * `tools` JSON is a superset of the tool names the JS scorer reads, which is
 * fine here: extra recall only costs a JS re-score, and missing recall would drop
 * real hits.
 */
const SEARCH_HAYSTACK_SQL = [
  'name',
  'category',
  'description',
  'ai_summary',
  'ai_overview',
  'ai_use_cases',
  'ai_features',
  'tags',
  'license',
  'pricing_model',
  'auth_type',
  'compatible_clients',
  'tools',
]
  .map((c) => `coalesce(${c}, '')`)
  .join(` || ' ' || `);

/** rankServers' typo fallback only looks at name, category and description. */
const FUZZY_HAYSTACK_SQL = ['name', 'category', 'description']
  .map((c) => `coalesce(${c}, '')`)
  .join(` || ' ' || `);

/**
 * Just the text rankServers/hybridRankServers score, plus the engagement
 * tie-breakers. Tool names come out of SQLite as a single string, so tool
 * schemas never reach the Worker. The AI prose is clipped to buildAiSearchText's
 * 600-char cap.
 */
const SEARCH_CANDIDATE_SELECT_SQL = `s.id AS id, s.name AS name, s.description AS description, s.category AS category,
  substr(s.ai_summary, 1, 600) AS aiSummary, substr(s.ai_overview, 1, 600) AS aiOverview,
  s.ai_use_cases AS aiUseCases, s.ai_features AS aiFeatures, s.tags AS tags, s.license AS license,
  s.pricing_model AS pricingModel, s.auth_type AS authType, s.compatible_clients AS compatibleClients,
  s.upvotes AS upvotes, s.copies AS copies, s.views AS views,
  s.github_stars AS githubStars, s.npm_downloads AS npmDownloads,
  s.health_status AS healthStatus, s.tools_source AS toolsSource,
  s.install_needs_config AS installNeedsConfig, s.remote_endpoint_healthy AS remoteEndpointHealthy,
  CASE WHEN json_valid(s.tools) THEN (
    SELECT group_concat(json_extract(je.value, '$.name'), ' ') FROM json_each(s.tools) AS je
  ) END AS toolText`;

type SearchCandidateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  aiSummary: string | null;
  aiOverview: string | null;
  aiUseCases: string | null;
  aiFeatures: string | null;
  tags: string | null;
  license: string | null;
  pricingModel: string | null;
  authType: string | null;
  compatibleClients: string | null;
  upvotes: number | null;
  copies: number | null;
  views: number | null;
  githubStars: number | null;
  npmDownloads: number | null;
  healthStatus: string | null;
  toolsSource: string | null;
  installNeedsConfig: number | null;
  remoteEndpointHealthy: number | null;
  toolText: string | null;
};

type SearchCandidate = Searchable &
  Engagement & {
    id: string;
  };

function toSearchCandidate(row: SearchCandidateRow): SearchCandidate {
  return {
    id: row.id,
    name: row.name,
    description: cleanListingDescription(row.description),
    category: row.category,
    toolText: row.toolText,
    extraText: buildAiSearchText({
      aiSummary: row.aiSummary,
      aiOverview: row.aiOverview,
      aiUseCases: parseStringArray(row.aiUseCases),
      aiFeatures: parseStringArray(row.aiFeatures),
      tags: parseStringArray(row.tags),
      license: row.license,
      pricingModel: row.pricingModel,
      authType: row.authType,
      compatibleClients: parseStringArray(row.compatibleClients),
    }),
    upvotes: row.upvotes,
    copies: row.copies,
    views: row.views,
    githubStars: row.githubStars,
    npmDownloads: row.npmDownloads,
    healthStatus: row.healthStatus,
    toolsSource: row.toolsSource,
    installNeedsConfig: row.installNeedsConfig,
    remoteEndpointHealthy: row.remoteEndpointHealthy,
  };
}

type D1Drizzle = ReturnType<typeof drizzle>;

type PrefilterMode = 'all' | 'any' | 'fuzzy';

/** WHERE clause over the CTE's haystack `h` for one prefilter mode, or null if it can't match. */
function prefilterWhere(
  plan: SearchPrefilter,
  mode: PrefilterMode,
): SQL | null {
  const like = (p: string) => sql`h LIKE ${`%${p}%`}`;
  if (mode === 'all') {
    return sql.join(
      plan.terms.map((alts) => sql`(${sql.join(alts.map(like), sql` OR `)})`),
      sql` AND `,
    );
  }
  const patterns = mode === 'any' ? plan.terms.flat() : plan.fuzzy;
  if (patterns.length === 0) return null;
  return sql.join(patterns.map(like), sql` OR `);
}

/**
 * Prefilter passes: 'all' = every term group matches (the scorer's strict AND),
 * 'any' = at least one term matches (its relaxed OR), 'fuzzy' = a typo-tolerant
 * trigram hit on name/category/description. Each mode keeps its own
 * top-SEARCH_CANDIDATE_CAP, ordered by name hits then engagement; several modes
 * are unioned into one statement. 'fuzzy' reads different columns, so it can't
 * share a call with the others.
 *
 * Reads the servers_fts trigram index once the backfill has marked it ready
 * (see lib/searchFts.ts), else the LIKE scan. The LIKE scan read every servable
 * row, raw tools JSON included, on each uncached search: 13-18s in production
 * under cron load.
 */
async function prefilterSearchCandidates(
  db: D1Drizzle,
  plan: SearchPrefilter,
  modes: PrefilterMode[],
  category: string | null,
): Promise<SearchCandidate[]> {
  if (modes.includes('fuzzy') && modes.length > 1) {
    throw new Error('fuzzy prefilter uses its own haystack; run it alone');
  }
  const ready = await isSearchFtsReady(async () => {
    const rows = await db.all<{ ok: number }>(
      sql`SELECT 1 AS ok FROM job_cursors WHERE name = ${SEARCH_FTS_READY_CURSOR}`,
    );
    return rows.length > 0;
  });
  if (ready) {
    try {
      return await ftsPrefilterCandidates(db, plan, modes, category);
    } catch (e) {
      // Only a missing index justifies the LIKE scan. A busy or reset D1
      // fails the search like any other D1 error: retrying with a
      // full-catalog scan (and pinning it for minutes) fed the overload.
      if (!isFtsSchemaError(e)) throw e;
      console.error(
        'search: FTS prefilter failed, using LIKE scan:',
        errorText(e),
      );
      markSearchFtsUnavailable();
    }
  }
  return likePrefilterCandidates(db, plan, modes, category);
}

/** Per-term name-hit count, the first sort key of every prefilter cap. */
function nameHitsSql(plan: SearchPrefilter, nameCol: string): SQL {
  return sql.join(
    plan.terms.map(
      ([term]) =>
        sql`(CASE WHEN ${sql.raw(nameCol)} LIKE ${`%${term}%`} THEN 1 ELSE 0 END)`,
    ),
    sql` + `,
  );
}

const FTS_HAYSTACK_SQL = sql.raw(
  `(coalesce(f.name, '') || ' ' || coalesce(f.category, '') || ' ' || coalesce(f.description, '') || ' ' || coalesce(f.body, ''))`,
);

/** Every inner group must match one of its substrings, over the indexed text. */
function ftsLikeGroupsSql(groups: string[][]): SQL[] {
  return groups.map(
    (alts) =>
      sql`(${sql.join(
        alts.map((a) => sql`${FTS_HAYSTACK_SQL} LIKE ${`%${a}%`}`),
        sql` OR `,
      )})`,
  );
}

/**
 * prefilterSearchCandidates over servers_fts. The index narrows to matching
 * rowids; only those servers rows are read, for the servable/category filter
 * and the name-hit/engagement ordering.
 */
async function ftsPrefilterCandidates(
  db: D1Drizzle,
  plan: SearchPrefilter,
  modes: PrefilterMode[],
  category: string | null,
): Promise<SearchCandidate[]> {
  const modePlans: FtsModePlan[] = [];
  for (const mode of modes) {
    if (mode === 'fuzzy') {
      const match = ftsFuzzyMatch(plan);
      if (match) modePlans.push({ kind: 'match', match, likeGroups: [] });
    } else {
      const p = ftsKeywordPlan(plan, mode);
      if (p) modePlans.push(p);
    }
  }
  if (modePlans.length === 0) return [];
  const nameHits = nameHitsSql(plan, 's.name');
  const categoryFilter = category ? sql` AND s.category = ${category}` : sql``;
  const topMatches = (p: FtsModePlan) => {
    const conds = [
      ...(p.kind === 'match' ? [sql`servers_fts MATCH ${p.match}`] : []),
      ...ftsLikeGroupsSql(p.likeGroups),
    ];
    return sql`
      SELECT id FROM (
        SELECT s.id AS id
        FROM servers_fts f JOIN servers s ON s.rowid = f.rowid AND s.id = f.id
        WHERE ${sql.join(conds, sql` AND `)}
          AND ${sql.raw(servableSql('s'))}${categoryFilter}
        ORDER BY ${nameHits} DESC, (s.upvotes * 5 + s.copies + s.views * 0.05) DESC
        LIMIT ${SEARCH_CANDIDATE_CAP}
      )`;
  };
  const rows = await db.all<SearchCandidateRow>(sql`
    WITH m AS (${sql.join(modePlans.map(topMatches), sql` UNION `)})
    SELECT ${sql.raw(SEARCH_CANDIDATE_SELECT_SQL)}
    FROM servers s JOIN m ON m.id = s.id
  `);
  return rows.map(toSearchCandidate);
}

/**
 * The pre-index prefilter: one full scan of servable rows, LIKE over every
 * searchable column. Used until servers_fts is backfilled.
 *
 * The haystack is concatenated once per row in a MATERIALIZED CTE. Inlined, SQLite
 * rebuilds it for every LIKE, which is about 2x slower on a synonym-heavy query
 * (measured ~650ms vs ~310ms on the live catalog).
 */
async function likePrefilterCandidates(
  db: D1Drizzle,
  plan: SearchPrefilter,
  modes: PrefilterMode[],
  category: string | null,
): Promise<SearchCandidate[]> {
  const fuzzy = modes.includes('fuzzy');
  const wheres = modes
    .map((mode) => prefilterWhere(plan, mode))
    .filter((w): w is SQL => w !== null);
  if (wheres.length === 0) return [];
  const nameHits = nameHitsSql(plan, 'name');
  const haystack = sql.raw(fuzzy ? FUZZY_HAYSTACK_SQL : SEARCH_HAYSTACK_SQL);
  const categoryFilter = category ? sql` AND category = ${category}` : sql``;
  // Wrapped in a subquery so each branch's ORDER BY/LIMIT applies before the UNION.
  const topMatches = (where: SQL) => sql`
      SELECT id FROM (
        SELECT id FROM c WHERE ${where}
        ORDER BY ${nameHits} DESC, eng DESC
        LIMIT ${SEARCH_CANDIDATE_CAP}
      )`;

  const rows = await db.all<SearchCandidateRow>(sql`
    WITH c AS MATERIALIZED (
      SELECT id, name, (upvotes * 5 + copies + views * 0.05) AS eng, ${haystack} AS h
      FROM servers
      WHERE ${sql.raw(servableSql())}${categoryFilter}
    ),
    m AS (${sql.join(wheres.map(topMatches), sql` UNION `)})
    SELECT ${sql.raw(SEARCH_CANDIDATE_SELECT_SQL)}
    FROM servers s JOIN m ON m.id = s.id
  `);
  return rows.map(toSearchCandidate);
}

/** Slim candidate rows for specific ids (vector-search recall), active only. */
async function searchCandidatesByIds(
  db: D1Drizzle,
  ids: string[],
  category: string | null,
): Promise<SearchCandidate[]> {
  const out: SearchCandidate[] = [];
  const categoryFilter = category ? sql` AND s.category = ${category}` : sql``;
  for (let i = 0; i < ids.length; i += D1_ID_CHUNK) {
    const chunk = ids.slice(i, i + D1_ID_CHUNK);
    const rows = await db.all<SearchCandidateRow>(sql`
      SELECT ${sql.raw(SEARCH_CANDIDATE_SELECT_SQL)}
      FROM servers s
      WHERE ${sql.raw(servableSql('s'))}${categoryFilter}
        AND s.id IN (${sql.join(
          chunk.map((id) => sql`${id}`),
          sql`, `,
        )})
    `);
    out.push(...rows.map(toSearchCandidate));
  }
  return out;
}

/** Full scoring-column rows for the final result ids, in the order given. */
async function hydrateSearchResults(
  db: D1Drizzle,
  ids: string[],
): Promise<Server[]> {
  const found = new Map<string, Server>();
  for (let i = 0; i < ids.length; i += D1_ID_CHUNK) {
    const rows = await db
      .select(SCORING_SERVER_COLUMNS)
      .from(serversTable)
      .where(
        and(
          inArray(serversTable.id, ids.slice(i, i + D1_ID_CHUNK)),
          servableFilter(),
        ),
      );
    for (const r of rows) {
      found.set(r.id, normalizeServer(r as unknown as Server));
    }
  }
  return ids.map((id) => found.get(id)).filter((s): s is Server => Boolean(s));
}

async function getSearchDb(): Promise<{
  db: D1Drizzle;
  env: CloudflareEnv;
} | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx?.env as CloudflareEnv | undefined;
    if (env && (env as any).DB) {
      return { db: drizzle((env as any).DB), env };
    }
  } catch {
    // No Cloudflare context (local dev without bindings, tests)
  }
  return null;
}

/**
 * Most-engaged active listings, optionally scoped to a category, capped in SQL.
 * This is the no-query result for /api/v1/search and the MCP search tool.
 * Those used to load the whole catalog (or a 13k-row category) just to slice off
 * the first `limit` rows.
 */
async function getTopActiveServers(
  category: string | null,
  limit: number,
): Promise<Server[]> {
  const conn = await getSearchDb();
  if (conn) {
    try {
      const rows = await conn.db
        .select(SCORING_SERVER_COLUMNS)
        .from(serversTable)
        .where(
          category
            ? and(servableFilter(), eq(serversTable.category, category))
            : servableFilter(),
        )
        .orderBy(
          desc(serversTable.views),
          desc(serversTable.copies),
          desc(serversTable.upvotes),
        )
        .limit(limit);
      if (rows.length > 0) {
        return rows.map((r) => normalizeServer(r as unknown as Server));
      }
    } catch {
      // Fall back to static JSON
    }
  }
  return snapshotCatalogServers()
    .filter((s) => !category || s.category === category)
    .map(normalizeServer)
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, limit);
}

/** Static-snapshot search when D1 isn't reachable. The snapshot is small enough to rank in JS. */
async function searchSnapshot(
  query: string,
  category: string | null,
  limit: number,
): Promise<Server[]> {
  const pool = snapshotCatalogServers()
    .filter((s) => !category || s.category === category)
    .map(normalizeServer)
    .map((s) => ({
      ...s,
      toolText: (s.tools || []).map((t) => t.name).join(' '),
      extraText: buildAiSearchText(s),
    }));
  return rankServers(pool, query, { limit });
}

/**
 * Keyword + vector search over the active catalog for /api/v1/search and the
 * MCP `search_mcp_servers` tool. Ranking is the same rankServers /
 * hybridRankServers every other search surface uses. What changed is where the
 * candidates come from.
 *
 * Both endpoints used to load the entire active catalog (getActiveServersForScoring)
 * and rank it in JS. At ~22.5k listings and ~23MB of tools JSON that blew the
 * Worker memory limit on every search (outcome: exceededMemory, ~2.6s wall time),
 * even for a query matching one row. Now SQLite discards non-matches with a
 * prefilter shaped like the scorer's own passes (strict AND, then relaxed OR,
 * then typo-tolerant) over the servers_fts trigram index (LIKE scan until it is
 * backfilled), the Worker only scores slim candidate rows, and full rows
 * are loaded just for the `limit` results that are returned.
 */
/** Ranked search ids are reused this long; new listings show up in search after it. */
const SEARCH_CACHE_TTL_SECONDS = 10 * 60;
/** Longer queries skip the cache rather than risk an oversized cache key. */
const SEARCH_CACHE_MAX_QUERY = 200;

type SearchOpts = {
  query: string;
  category?: string | null;
  limit: number;
  /** Vectorize neighbours to blend in; 0 skips the embedding call entirely. */
  vectorTopK?: number;
};

/**
 * Ranked ids from D1, or already-built servers when D1 isn't used. `snapshot`
 * is the bundled-catalog fallback after a D1 failure: fine to return once,
 * never to cache (it only knows ~114 listings).
 */
type RankedSearch =
  | { kind: 'servers'; servers: Server[] }
  | { kind: 'snapshot'; servers: Server[] }
  | { kind: 'ids'; ids: string[]; db: D1Drizzle };

export async function searchActiveServers(opts: SearchOpts): Promise<Server[]> {
  const ranked = await rankSearch(opts);
  if (ranked.kind !== 'ids') return ranked.servers;
  try {
    return await hydrateSearchResults(ranked.db, ranked.ids);
  } catch (e) {
    console.error('searchActiveServers: hydrate failed:', errorText(e));
    return searchSnapshot(opts.query, opts.category || null, opts.limit);
  }
}

/**
 * Just the ranked ids. Callers that load their own rows (/browse pages 24 at a
 * time) skip hydrateSearchResults, which reads every ranked listing (~400
 * rows in 90-id chunks, tool names extracted per row): 2.4-3.3s per search on
 * prod D1 and enough to hit its CPU limit when busy.
 */
export async function searchActiveServerIds(
  opts: SearchOpts,
): Promise<string[] | null> {
  const ranked = await rankSearch(opts);
  if (ranked.kind === 'snapshot') return null;
  return ranked.kind === 'servers'
    ? ranked.servers.map((s) => s.id)
    : ranked.ids;
}

async function rankSearch(opts: SearchOpts): Promise<RankedSearch> {
  const servers = (list: Server[]): RankedSearch => ({
    kind: 'servers',
    servers: list,
  });
  const { query, limit } = opts;
  const category = opts.category || null;
  if (!query.trim()) return servers(await getTopActiveServers(category, limit));

  const plan = buildSearchPrefilter(query);
  // All-punctuation query: a real search with no possible matches (see rankServers).
  if (plan.terms.length === 0) return servers([]);

  const conn = await getSearchDb();
  if (!conn) return servers(await searchSnapshot(query, category, limit));
  const { db, env } = conn;
  const vectorTopK = opts.vectorTopK ?? 40;

  // Agents and the site re-run the same searches. Caching the ranked ids
  // (not the rows) skips the embedding call and the prefilter query,
  // while hydrateSearchResults still reads current listing data by id.
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const cacheKey =
    normalizedQuery.length <= SEARCH_CACHE_MAX_QUERY
      ? `search/v1/${category ?? ''}/${limit}/${vectorTopK}/${normalizedQuery}`
      : null;
  if (cacheKey) {
    const cachedIds = await readEdgeCache<string[]>(cacheKey);
    if (cachedIds) return { kind: 'ids', ids: cachedIds, db };
  }

  const t0 = Date.now();
  const phases: Record<string, number | string> = {};
  try {
    let vectorMatches: Array<{ id: string; score: number }> = [];
    if (vectorTopK > 0 && (env as any).VECTOR_INDEX && (env as any).AI) {
      try {
        const { queryVectorIndex } = await import('./vectorSearch');
        // Best-effort and unbounded (Workers AI embedding + Vectorize): after
        // the FTS index made the keyword prefilter ~10ms, uncached searches
        // still took 12-23s wall at 0.1-0.5s CPU. Keyword-only results beat
        // making every search wait on a slow embedding.
        const timedOut = Symbol('timeout');
        const result = await Promise.race([
          queryVectorIndex(query, env, vectorTopK),
          new Promise<typeof timedOut>((resolve) =>
            setTimeout(() => resolve(timedOut), VECTOR_SEARCH_TIMEOUT_MS),
          ),
        ]);
        if (result === timedOut) phases.vector = 'timeout';
        else vectorMatches = result;
      } catch {
        /* Vector search is best-effort */
      }
    }
    phases.vectorMs = Date.now() - t0;

    let ranked: SearchCandidate[];
    if (vectorMatches.length > 0) {
      // hybridRankServers scores in relaxed (OR) mode, so give it partial
      // matches too, plus the vector hits keyword search can't see.
      const pool = new Map<string, SearchCandidate>();
      const add = (rows: SearchCandidate[]) => {
        for (const r of rows) pool.set(r.id, r);
      };
      add(
        await prefilterSearchCandidates(
          db,
          plan,
          plan.terms.length >= 2 ? ['all', 'any'] : ['all'],
          category,
        ),
      );
      const missing = vectorMatches
        .map((m) => m.id)
        .filter((id) => !pool.has(id));
      add(await searchCandidatesByIds(db, missing, category));
      ranked = hybridRankServers(
        Array.from(pool.values()),
        query,
        vectorMatches,
        {
          limit,
        },
      );
    } else {
      // Same escalation rankServers does internally, one SQL pass per stage so
      // each stage only ever pulls its own matches into memory.
      ranked = rankServers(
        await prefilterSearchCandidates(db, plan, ['all'], category),
        query,
        { limit },
      );
      if (ranked.length === 0 && plan.terms.length >= 2) {
        ranked = rankServers(
          await prefilterSearchCandidates(db, plan, ['any'], category),
          query,
          { limit },
        );
      }
      if (ranked.length === 0) {
        ranked = rankServers(
          await prefilterSearchCandidates(db, plan, ['fuzzy'], category),
          query,
          { limit },
        );
      }
    }

    phases.rankedMs = Date.now() - t0;
    const rankedIds = ranked.map((s) => s.id);
    if (cacheKey) {
      await writeEdgeCache(cacheKey, rankedIds, SEARCH_CACHE_TTL_SECONDS);
    }
    // TEMPORARY (2026-10-15): find where slow uncached searches spend their
    // time. Remove once known.
    if (Date.now() - t0 > 3000) {
      phases.totalMs = Date.now() - t0;
      console.warn('[search] slow ranking (ms)', JSON.stringify(phases));
    }
    return { kind: 'ids', ids: rankedIds, db };
  } catch (e) {
    console.error('searchActiveServers: D1 search failed:', errorText(e));
    return {
      kind: 'snapshot',
      servers: await searchSnapshot(query, category, limit),
    };
  }
}

/**
 * Slim candidate rows for a curated /best/[topic] page: the topic's category,
 * narrowed by its keywords when it has them (selectServersForTopic applies the
 * exact word-boundary match on top). See getRankingCandidates for why this
 * never loads full rows.
 */
export async function getServersForTopic(topic: BestTopic): Promise<Server[]> {
  const category = topic.categorySlug
    ? categoryFromSlug(topic.categorySlug)
    : undefined;
  if (topic.match && topic.match.length > 0) {
    return getRankingCandidates({ category, keywords: topic.match });
  }
  return category ? getRankingCandidates({ category }) : [];
}

/** Minimal row shape needed by the /llms.txt route. */
export type LlmsTxtServer = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  installKind: string | null;
  installCommand: string | null;
  installPackage: string | null;
};

/**
 * Ultra-slim catalog fetch for the /llms.txt route.
 * Fetches ONLY id, name, description, category — the four fields the route
 * actually uses. Loading the full catalog via getActiveServersForScoring()
 * pulled every AI-text blob, tools JSON, and scoring column into the Worker
 * heap for all ~3200 rows, which reliably OOMs the Cloudflare Worker on this
 * route. This query is ~10-20× lighter.
 */
export async function getServersForLlmsTxt(): Promise<LlmsTxtServer[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({
          id: serversTable.id,
          name: serversTable.name,
          description: serversTable.description,
          category: serversTable.category,
          installKind: serversTable.installKind,
          installCommand: serversTable.installCommand,
          installPackage: serversTable.installPackage,
        })
        .from(serversTable)
        .where(servableFilter())
        // Same order as idx_servers_status_popularity, so "top 10 per
        // category" really is the most-used ten, not insertion order.
        .orderBy(
          desc(serversTable.views),
          desc(serversTable.copies),
          desc(serversTable.upvotes),
        );
      if (rows.length > 0) return rows;
    }
  } catch {
    // Fall back to static JSON
  }
  return snapshotCatalogServers().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    category: s.category ?? null,
    installKind: s.installKind ?? null,
    installCommand: s.installCommand ?? null,
    installPackage: s.installPackage ?? null,
  }));
}

/**
 * Slim listing shape powering the /browse client feed. Only the fields the
 * directory grid actually reads for search/sort/filter/render — the heavy AI
 * text is pre-collapsed into a single bounded `aiText` blob so pages stay small.
 */
function isTestedWorking(s: TrustTierInput): boolean {
  const tier = computeTrustTier(s);
  return tier === 'verified' || tier === 'runs_needs_keys';
}

export type DirectoryFeedItem = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  logoUrl: string | null;
  isOfficial: boolean;
  isPremium: boolean;
  featuredUntil: string | Date | null;
  githubStars: number | null;
  npmDownloads: number | null;
  /** Repo `pushed_at` from GitHub, refreshed by the health cron. */
  lastCommitAt: string | Date | null;
  installConfidence: string | null;
  toolText: string | null;
  /** Tool count only — the full schema JSON stays server-side to keep the feed light. */
  toolCount: number;
  /** 'introspected' (live MCP handshake) | 'readme' (best-effort static parse) | null. */
  toolsSource: string | null;
  /** Trust tier verified or runs_needs_keys (lib/trustTier.ts) — drives the browse "Tested working" filter. */
  testedWorking: boolean;
  aiText: string | null;
  views: number;
  copies: number;
  upvotes: number;
  createdAt: string | Date | null;
  tags: string[];
  pricingModel: string | null;
  authType: string | null;
  compatibleClients: string[];
};

/** Max length of the client-side AI search blob — room for FAQ terms after the core AI fields. */
const FEED_AI_TEXT_MAX = 400;
/** Max length of the space-joined tool-name blob for search recall. */
const FEED_TOOL_TEXT_MAX = 400;

/** Space-joined tool names for client search, bounded. Null when there are none. */
function feedToolText(rawTools: unknown): string | null {
  const tools = parseServerTools(rawTools);
  const joined = tools
    .map((t) => t.name)
    .filter(Boolean)
    .join(' ')
    .slice(0, FEED_TOOL_TEXT_MAX);
  return joined || null;
}

/**
 * Build the bounded AI search blob from already-length-capped raw column values.
 * `aiUseCases`/`aiFeatures`/`aiFaq` arrive as JSON *strings* (the columns store JSON);
 * we strip the structural punctuation so only the human-readable words feed search.
 */
function feedAiTextFromRaw(
  summary?: string | null,
  overview?: string | null,
  useCases?: string | null,
  features?: string | null,
  faq?: string | null,
): string | null {
  const clean = (v?: string | null) => (v || '').replace(/["[\]{}]/g, ' ');
  // FAQ JSON keys (`q`/`a`) would otherwise leak into the blob as noise tokens.
  const cleanFaq = (v?: string | null) => clean(v).replace(/\b[qa]\s*:/gi, ' ');
  // FAQ after use-cases so intent-shaped questions contribute before features fill the cap.
  const text = [
    summary || '',
    overview || '',
    clean(useCases),
    cleanFaq(faq),
    clean(features),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > FEED_AI_TEXT_MAX
    ? text.slice(0, FEED_AI_TEXT_MAX)
    : text;
}

/**
 * The browse grid's row shape: only what it renders, with the heavy
 * AI-content columns capped in SQL so a page stays small even when individual
 * overviews or use-case lists are long.
 */
function selectFeedRows(db: D1Drizzle, where: SQL) {
  return db
    .select({
      id: serversTable.id,
      name: serversTable.name,
      url: serversTable.url,
      description: serversTable.description,
      category: serversTable.category,
      logoUrl: serversTable.logoUrl,
      isOfficial: serversTable.isOfficial,
      isPremium: serversTable.isPremium,
      featuredUntil: serversTable.featuredUntil,
      githubStars: serversTable.githubStars,
      npmDownloads: serversTable.npmDownloads,
      lastCommitAt: serversTable.lastCommitAt,
      installConfidence: serversTable.installConfidence,
      tools: serversTable.tools,
      toolsSource: serversTable.toolsSource,
      installNeedsConfig: serversTable.installNeedsConfig,
      remoteEndpointHealthy: serversTable.remoteEndpointHealthy,
      views: serversTable.views,
      copies: serversTable.copies,
      upvotes: serversTable.upvotes,
      createdAt: serversTable.createdAt,
      tags: serversTable.tags,
      pricingModel: serversTable.pricingModel,
      authType: serversTable.authType,
      compatibleClients: serversTable.compatibleClients,
      // Cap the heavy AI-content columns in SQL so a page stays small even
      // when individual overviews/use-case lists are long.
      aiSummary: sql<
        string | null
      >`substr(${serversTable.aiSummary}, 1, ${FEED_AI_TEXT_MAX})`,
      aiOverview: sql<
        string | null
      >`substr(${serversTable.aiOverview}, 1, ${FEED_AI_TEXT_MAX})`,
      aiUseCases: sql<
        string | null
      >`substr(${serversTable.aiUseCases}, 1, ${FEED_AI_TEXT_MAX})`,
      aiFeatures: sql<
        string | null
      >`substr(${serversTable.aiFeatures}, 1, ${FEED_AI_TEXT_MAX})`,
      aiFaq: sql<
        string | null
      >`substr(${serversTable.aiFaq}, 1, ${FEED_AI_TEXT_MAX})`,
    })
    .from(serversTable)
    .where(where);
}

type FeedRow = Awaited<ReturnType<typeof selectFeedRows>>[number];

function toFeedItem(r: FeedRow): DirectoryFeedItem {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    description: cleanListingDescription(r.description),
    category: r.category,
    logoUrl: r.logoUrl ?? null,
    isOfficial: !!r.isOfficial,
    isPremium: !!r.isPremium,
    featuredUntil: r.featuredUntil ?? null,
    githubStars: r.githubStars ?? null,
    npmDownloads: r.npmDownloads ?? null,
    lastCommitAt: r.lastCommitAt ?? null,
    installConfidence: r.installConfidence ?? null,
    toolText: feedToolText(r.tools),
    toolCount: parseServerTools(r.tools).length,
    toolsSource: r.toolsSource ?? null,
    testedWorking: isTestedWorking(r),
    aiText: feedAiTextFromRaw(
      r.aiSummary,
      r.aiOverview,
      r.aiUseCases,
      r.aiFeatures,
      r.aiFaq,
    ),
    views: r.views ?? 0,
    copies: r.copies ?? 0,
    upvotes: r.upvotes ?? 0,
    createdAt: r.createdAt ?? null,
    tags: parseStringArray(r.tags),
    pricingModel: r.pricingModel ?? null,
    authType: r.authType ?? null,
    compatibleClients: parseStringArray(r.compatibleClients),
  };
}

/**
 * Feed items for `ids`, in the order given, servable listings only. The browse
 * API picks and orders ids in SQL (lib/browse.ts) and hydrates just the page
 * it returns through here.
 */
export async function getFeedItemsByIds(
  ids: string[],
): Promise<DirectoryFeedItem[]> {
  if (ids.length === 0) return [];
  try {
    const conn = await getSearchDb();
    if (conn) {
      const found = new Map<string, DirectoryFeedItem>();
      for (let i = 0; i < ids.length; i += D1_ID_CHUNK) {
        const rows = await selectFeedRows(
          conn.db,
          and(
            inArray(serversTable.id, ids.slice(i, i + D1_ID_CHUNK)),
            servableFilter(),
          ) as SQL,
        );
        for (const r of rows) found.set(r.id, toFeedItem(r));
      }
      return ids
        .map((id) => found.get(id))
        .filter((s): s is DirectoryFeedItem => Boolean(s));
    }
  } catch (_e) {
    // Fall back to the static snapshot below.
  }
  const byId = new Map(
    snapshotFeedPage(0, Number.MAX_SAFE_INTEGER).items.map((s) => [s.id, s]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is DirectoryFeedItem => Boolean(s));
}

/**
 * A newest-first page of the bundled snapshot, for local dev and tests where
 * D1 isn't reachable, so browse still renders something real.
 */
export function snapshotFeedPage(
  offset: number,
  limit: number,
): { items: DirectoryFeedItem[]; total: number } {
  const all = snapshotCatalogServers()
    .map(normalizeServer)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
  const total = all.length;
  const items: DirectoryFeedItem[] = all
    .slice(offset, offset + limit)
    .map((s) => {
      const tools = Array.isArray(s.tools) ? s.tools : [];
      const toolText =
        tools
          .map((t) => (t && typeof t.name === 'string' ? t.name : ''))
          .filter(Boolean)
          .join(' ')
          .slice(0, FEED_TOOL_TEXT_MAX) || null;
      return {
        id: s.id,
        name: s.name,
        url: s.url,
        description: s.description,
        category: s.category,
        logoUrl: s.logoUrl ?? null,
        isOfficial: !!s.isOfficial,
        isPremium: !!s.isPremium,
        featuredUntil: s.featuredUntil ?? null,
        githubStars: s.githubStars ?? null,
        npmDownloads: s.npmDownloads ?? null,
        lastCommitAt: s.lastCommitAt ?? null,
        installConfidence: s.installConfidence ?? null,
        toolText,
        toolCount: tools.length,
        toolsSource: s.toolsSource ?? null,
        testedWorking: isTestedWorking(s),
        aiText: buildAiSearchText(s, FEED_AI_TEXT_MAX),
        views: s.views ?? 0,
        copies: s.copies ?? 0,
        upvotes: s.upvotes ?? 0,
        createdAt: s.createdAt ?? null,
        tags: s.tags ?? [],
        pricingModel: s.pricingModel ?? null,
        authType: s.authType ?? null,
        compatibleClients: s.compatibleClients ?? [],
      };
    });
  return { items, total };
}

/** Epoch millis for a listing timestamp, tolerant of strings/Dates/nulls. */
function toEpoch(v: unknown): number {
  const t = new Date(v as string | number | Date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * ownerUserId is deliberately excluded from PUBLIC_SERVER_COLUMNS above, so it's
 * queried separately here — only when a session exists — purely to compute a
 * boolean, never exposed to the client. Called from the /api/mcp/[id]/is-owner
 * route rather than the detail page itself, so the page stays cacheable (see
 * app/mcp/[id]/page.tsx — it no longer reads the session server-side).
 */
export async function checkIsOwner(
  id: string,
  userId: string,
): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({ ownerUserId: serversTable.ownerUserId })
        .from(serversTable)
        .where(eq(serversTable.id, id))
        .limit(1);
      return rows[0]?.ownerUserId === userId;
    }
  } catch (_e) {}
  return false;
}

/**
 * The listing_signals fields the public detail page shows (trust tier,
 * security card). Separate from getServerById because they live in their own
 * table (servers is near D1's column cap); one primary-key read. Empty object
 * when there is no row or D1 is unavailable.
 */
export async function getServerSignalsById(
  id: string,
): Promise<
  Pick<
    Server,
    'mcpProbability' | 'securityProfile' | 'toolsChangedAt' | 'staleReasons'
  >
> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const [row] = await db
        .select({
          mcpProbability: listingSignals.mcpProbability,
          securityProfile: listingSignals.securityProfile,
          toolsChangedAt: listingSignals.toolsChangedAt,
          staleReasons: listingSignals.staleReasons,
        })
        .from(listingSignals)
        .where(eq(listingSignals.serverId, id))
        .limit(1);
      if (row) return row;
    }
  } catch {
    // No signals is a normal state — the page renders without them.
  }
  return {};
}

/**
 * One listing by id: D1 first, the build-time snapshot when D1 isn't bound
 * (local dev, tests) or the read fails. When the read fails and the snapshot
 * doesn't have the id either, this throws rather than returning undefined:
 * the listing may well exist (it was added after the snapshot), and callers
 * treat undefined as "no such listing". /mcp/[id] turned that into notFound(),
 * and ISR cached the "Not Found" page with a 200 for real, active listings
 * (Oct 2026). A thrown error keeps the stale page instead.
 */
export async function getServerById(id: string): Promise<Server | undefined> {
  let dbError: unknown = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.id, id))
        .limit(1);
      if (dbServers.length > 0) {
        return normalizeServer(dbServers[0] as unknown as Server);
      }
    }
  } catch (e) {
    dbError = e;
  }
  const found = snapshotServers().find((s) => s.id === id);
  if (found) return normalizeServer(found);
  if (dbError) {
    throw new Error(`getServerById(${id}): D1 read failed`, {
      cause: dbError,
    });
  }
  return undefined;
}

export type StdioVerificationResult = {
  status:
    | 'ok'
    | 'needs_credentials'
    | 'install_failed'
    | 'handshake_failed'
    | 'timeout'
    | 'error';
  toolCount: number | null;
  error: string | null;
  durationMs: number | null;
  checkedAt: string | Date;
};

/**
 * Latest E2B sandbox verification attempt for a listing, if any (see the
 * e2b-stdio-verify GitHub Actions workflow). Deliberately separate from
 * tools/toolsSource — this surfaces the *attempt*, friendly and non-alarming,
 * so a submitter/owner can see exactly what we tried and why it didn't
 * confirm, without us asserting the listing is broken (false negatives from
 * missing env vars, slow cold installs, etc. are expected).
 */
export async function getStdioVerification(
  serverId: string,
): Promise<StdioVerificationResult | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env || !(ctx.env as any).DB) return null;
    const db = drizzle((ctx.env as any).DB);
    const rows = await db
      .select({
        status: stdioVerifications.status,
        toolCount: stdioVerifications.toolCount,
        error: stdioVerifications.error,
        durationMs: stdioVerifications.durationMs,
        checkedAt: stdioVerifications.checkedAt,
      })
      .from(stdioVerifications)
      .where(
        and(
          eq(stdioVerifications.serverId, serverId),
          ne(stdioVerifications.status, 'pending'),
        ),
      )
      .orderBy(desc(stdioVerifications.checkedAt))
      .limit(1);
    return (rows[0] as StdioVerificationResult) ?? null;
  } catch {
    return null;
  }
}

export type ServerHealthCheck = {
  checkedAt: string | Date;
  healthy: boolean;
  detail: string | null;
  /** Remote-endpoint reading from the same check pass. Null = no remoteEndpointUrl, or predates this column. */
  remoteHealthy: boolean | null;
};

/**
 * Bounded health-check history (see HEALTH_HISTORY_LIMIT in the health cron
 * and server_health_checks in db/schema.ts), oldest-first so callers can
 * render it left-to-right as a timeline without re-sorting.
 */
export async function getServerHealthHistory(
  serverId: string,
): Promise<ServerHealthCheck[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env || !(ctx.env as any).DB) return [];
    const db = drizzle((ctx.env as any).DB);
    const rows = await db
      .select({
        checkedAt: serverHealthChecks.checkedAt,
        healthy: serverHealthChecks.healthy,
        detail: serverHealthChecks.detail,
        remoteHealthy: serverHealthChecks.remoteHealthy,
      })
      .from(serverHealthChecks)
      .where(eq(serverHealthChecks.serverId, serverId))
      .orderBy(desc(serverHealthChecks.checkedAt))
      .limit(96);
    return (rows as ServerHealthCheck[]).reverse();
  } catch {
    return [];
  }
}

export type ReviewSummary = {
  avgRating: number;
  count: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  comments: {
    rating: number;
    comment: string;
    createdAt: string;
    reviewerLabel: string;
  }[];
};

const EMPTY_REVIEW_SUMMARY: ReviewSummary = {
  avgRating: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  comments: [],
};

/** First name + last-initial, or a generic fallback — never the raw account name/email verbatim beyond that. */
function reviewerLabelFromName(name: string | null | undefined): string {
  if (!name?.trim()) return 'AllMCPs user';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Star-rating aggregate + approved written comments for a listing. Every
 * rated review counts toward the aggregate regardless of `commentStatus` —
 * only the comment *text* is gated (see db/schema.ts's `reviews` table).
 * Used both by GET /api/mcp/[id]/reviews and directly here (server-side) by
 * the /mcp/[id] page's data-loading Promise.all — this is a plain DB read,
 * not a session call, so it doesn't threaten that page's ISR cache the way
 * an auth() call would.
 */
export async function getServerReviews(
  serverId: string,
): Promise<ReviewSummary> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env || !(ctx.env as any).DB) return EMPTY_REVIEW_SUMMARY;
    const db = drizzle((ctx.env as any).DB);
    const rows = await db
      .select({
        rating: reviews.rating,
        comment: reviews.comment,
        commentStatus: reviews.commentStatus,
        createdAt: reviews.createdAt,
        reviewerName: users.name,
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(eq(reviews.serverId, serverId))
      .orderBy(desc(reviews.createdAt));

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of rows) {
      const rating = Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5;
      distribution[rating] += 1;
      sum += rating;
    }
    const count = rows.length;

    const comments = rows
      .filter((r) => r.commentStatus === 'approved' && r.comment)
      .map((r) => ({
        rating: r.rating,
        comment: r.comment as string,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
        reviewerLabel: reviewerLabelFromName(r.reviewerName),
      }));

    return {
      avgRating: count > 0 ? sum / count : 0,
      count,
      distribution,
      comments,
    };
  } catch {
    return EMPTY_REVIEW_SUMMARY;
  }
}

/** Below this many remote-endpoint readings, prefer the live snapshot over a rolling % (too little data to trust a trend). */
const MIN_REMOTE_HISTORY_SAMPLES = 4;

/**
 * Combines the rolling remote-endpoint check history with a recent E2B
 * stdio-verify pass into one 0-100 availability signal — max of the two, not
 * an average: a listing confirmed working via *either* transport shouldn't
 * be dragged down by the other having a bad day (confirmed as a real,
 * reported false-negative: a live remote-endpoint blip showed 0/25 on the
 * quality score despite the stdio install being independently verified
 * working). Returns null when neither signal has enough data to say
 * anything, so the caller can fall back to today's live-snapshot behavior.
 */
export function computeCombinedAvailabilityPct(
  history: ServerHealthCheck[],
  verifiedOk: boolean,
): number | null {
  const remoteSamples = history.filter((h) => h.remoteHealthy !== null);
  const remotePct =
    remoteSamples.length >= MIN_REMOTE_HISTORY_SAMPLES
      ? (remoteSamples.filter((h) => h.remoteHealthy).length /
          remoteSamples.length) *
        100
      : null;

  if (remotePct === null && !verifiedOk) return null;
  return Math.max(remotePct ?? 0, verifiedOk ? 100 : 0);
}

export async function fetchServerReadme(url: string): Promise<string | null> {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;

    const owner = match[1];
    let repo = match[2];

    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    // HEAD resolves to the repo's default branch (main, master, trunk, dev…).
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
      {
        next: { revalidate: 3600 },
      },
    );

    if (res.ok) {
      const text = await res.text();
      return text.length > 250000
        ? `${text.slice(0, 250000)}\n\n*(README truncated for size)*`
        : text;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

const COMMON_STOP_WORDS = new Set([
  'the',
  'be',
  'to',
  'of',
  'and',
  'a',
  'in',
  'that',
  'have',
  'i',
  'it',
  'for',
  'not',
  'on',
  'with',
  'he',
  'as',
  'you',
  'do',
  'at',
  'this',
  'but',
  'his',
  'by',
  'from',
  'they',
  'we',
  'say',
  'her',
  'she',
  'or',
  'an',
  'will',
  'my',
  'one',
  'all',
  'would',
  'there',
  'their',
  'what',
  'so',
  'up',
  'out',
  'if',
  'about',
  'who',
  'get',
  'which',
  'go',
  'me',
  'when',
  'make',
  'can',
  'like',
  'time',
  'no',
  'just',
  'him',
  'know',
  'take',
  'people',
  'into',
  'year',
  'your',
  'good',
  'some',
  'could',
  'them',
  'see',
  'other',
  'than',
  'then',
  'now',
  'look',
  'only',
  'come',
  'its',
  'over',
  'think',
  'also',
  'back',
  'after',
  'use',
  'two',
  'how',
  'our',
  'work',
  'first',
  'well',
  'way',
  'even',
  'new',
  'want',
  'because',
  'any',
  'these',
  'give',
  'day',
  'most',
  'us',
  'server',
  'mcp',
  'model',
  'context',
  'protocol',
  'allow',
  'allows',
  'provides',
  'using',
  'used',
  'support',
  'supports',
  'client',
  'clients',
  'tools',
  'tool',
  'integration',
  'official',
  'service',
  'https',
  'http',
  'com',
  'github',
  'org',
  'repo',
  'package',
  'npm',
  'pypi',
  'python',
  'typescript',
  'javascript',
]);

// Keyed by object identity, not server.id — getActiveServers() is request-
// memoized (see `cache()` below), so every call within a request reuses the
// same Server object references, and stale entries become garbage-collectable
// on their own once a request's objects are no longer reachable, with no
// unbounded/cross-request growth to worry about.
const semanticTokenCache = new WeakMap<Server, Set<string>>();

/**
 * Full-text tokenization is expensive (every tool name/description, not just
 * short fields) and relatedRankingScore calls this per-candidate across the
 * whole active catalog — memoized, or this recomputes from scratch for every
 * comparison. Confirmed in practice: some listings carry hundreds of tools
 * (one had 987), and getRelatedServers() scoring the full ~3200-listing
 * catalog against both sides of a compare page without this cache OOM'd the
 * Worker (each call allocating a fresh multi-hundred-entry Set).
 */
function extractSemanticTokens(s: Server): Set<string> {
  const cached = semanticTokenCache.get(s);
  if (cached) return cached;

  const tokens = new Set<string>();
  const add = (text?: string | null) => {
    if (!text) return;
    const str = text.length > 2000 ? text.slice(0, 2000) : text;
    const words = str
      .toLowerCase()
      .replace(/[^a-z0-9_\-.]/g, ' ')
      .split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && w.length < 50 && !COMMON_STOP_WORDS.has(w)) {
        tokens.add(w);
      }
    }
  };

  add(s.name);
  add(s.category);
  add(s.description);
  add(s.aiSummary);
  add(s.aiOverview);
  // Guarded with Array.isArray: some callers (e.g. the sitemap route) pass raw D1
  // rows through here without normalizeServer's JSON-column parsing, so these
  // fields can arrive as unparsed JSON strings instead of arrays.
  if (Array.isArray(s.tags)) s.tags.forEach(add);
  if (Array.isArray(s.aiUseCases)) s.aiUseCases.forEach(add);
  if (Array.isArray(s.aiFeatures)) s.aiFeatures.forEach(add);
  if (Array.isArray(s.tools))
    s.tools.forEach((t) => {
      add(t.name);
      add(t.description);
    });

  semanticTokenCache.set(s, tokens);
  return tokens;
}

/**
 * Computes semantic Jaccard similarity index (0.0 to 1.0) based on rich server metadata tokens.
 */
function computeServerSemanticSimilarity(a: Server, b: Server): number {
  const tokensA = extractSemanticTokens(a);
  const tokensB = extractSemanticTokens(b);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

// Same memoize-by-object-identity rationale as semanticTokenCache above —
// relatedRankingScore rebuilt these from scratch on every single per-candidate
// call even though `current`'s side never changes across a whole sort, which
// on a compare page (current = a huge-tool-count outlier, scored against the
// ~3200-listing catalog on both sides) meant rebuilding a several-hundred-
// entry Set per comparison. Confirmed in practice as the remaining cause of a
// ~40s render even after the semantic-token OOM fix.
const toolNameSetCache = new WeakMap<Server, Set<string>>();
function toolNameSet(s: Server): Set<string> {
  const cached = toolNameSetCache.get(s);
  if (cached) return cached;
  // Array.isArray-guarded: some callers (e.g. the sitemap route) pass raw D1
  // rows through here without normalizeServer's JSON-column parsing, so this
  // field can arrive as an unparsed JSON string instead of an array.
  const set = Array.isArray(s.tools)
    ? new Set(
        s.tools
          .map((t) => t.name?.toLowerCase())
          .filter((n): n is string => Boolean(n)),
      )
    : new Set<string>();
  toolNameSetCache.set(s, set);
  return set;
}

const tagSetCache = new WeakMap<Server, Set<string>>();
function tagSet(s: Server): Set<string> {
  const cached = tagSetCache.get(s);
  if (cached) return cached;
  const set = Array.isArray(s.tags)
    ? new Set(s.tags.map((t) => t.toLowerCase()))
    : new Set<string>();
  tagSetCache.set(s, set);
  return set;
}

const envVarSetCache = new WeakMap<Server, Set<string>>();
function envVarSet(s: Server): Set<string> {
  const cached = envVarSetCache.get(s);
  if (cached) return cached;
  const set = Array.isArray(s.aiEnvVars)
    ? new Set(s.aiEnvVars.map((v) => v.toUpperCase()))
    : new Set<string>();
  envVarSetCache.set(s, set);
  return set;
}

/**
 * Ranking signal for related/similar listings.
 * Engagement + install readiness + tool overlap + semantic text similarity with current page.
 * Exported so category pages stay consistent.
 */
export function relatedRankingScore(
  candidate: Server,
  current?: Server | null,
): number {
  let score = engagementScore(candidate);

  // Prefer listings with known install paths (higher install conversion).
  const conf = (candidate.installConfidence || '').toLowerCase();
  if (conf === 'high') score += 8;
  else if (conf === 'medium') score += 4;
  else if (conf === 'low') score += 1;

  if (candidate.isOfficial || candidate.isPremium) score += 5;
  if (candidate.isVerifiedActive || candidate.healthStatus === 'healthy')
    score += 3;
  if (candidate.reciprocalBadgeOk) score += 2;

  if (current) {
    // Semantic vector / text similarity score boost
    const semanticSim = computeServerSemanticSimilarity(current, candidate);
    score += semanticSim * 120;

    // Tool name overlap.
    const currentTools = toolNameSet(current);
    const candidateTools = toolNameSet(candidate);
    if (currentTools.size && candidateTools.size) {
      let overlap = 0;
      for (const name of candidateTools) {
        if (currentTools.has(name)) overlap += 1;
      }
      score += overlap * 12;
    }

    // Tag overlap
    const currentTags = tagSet(current);
    const candidateTags = tagSet(candidate);
    if (currentTags.size && candidateTags.size) {
      let tagOverlap = 0;
      for (const t of candidateTags) {
        if (currentTags.has(t)) tagOverlap += 1;
      }
      score += tagOverlap * 10;
    }

    // Shared environment variables (indicates same API/service family)
    const currentEnvs = envVarSet(current);
    const candidateEnvs = envVarSet(candidate);
    if (currentEnvs.size && candidateEnvs.size) {
      let envOverlap = 0;
      for (const v of candidateEnvs) {
        if (currentEnvs.has(v)) envOverlap += 1;
      }
      score += envOverlap * 15;
    }
  }

  return score;
}

/**
 * Rewrites relative links and image sources inside a fetched GitHub README to
 * absolute URLs, so the mirrored markdown doesn't carry links that resolve
 * against allmcps.com. A bare `docs/x.md` link in a README, served at
 * `/mcp/<id>.md`, otherwise resolves to `/mcp/docs/x.md` and 404s (crawlers
 * followed hundreds of these). Uses the `HEAD` ref so it works whether the
 * repo's default branch is `main` or `master`. Fenced code blocks are skipped
 * so install-example placeholders (e.g. `/path/to/your/config`) are untouched.
 */
export function absolutizeReadmeMarkdown(md: string, repoUrl?: string): string {
  if (!md || !repoUrl) return md;
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!m) return md;
  const owner = m[1];
  const repo = m[2].endsWith('.git') ? m[2].slice(0, -4) : m[2];

  const SKIP = /^(https?:|\/\/|#|mailto:|tel:|data:|\?)/i;
  const toAbs = (target: string, isImage: boolean): string => {
    const t = target.trim();
    if (!t || SKIP.test(t)) return target;
    const clean = t.replace(/^\.\//, '').replace(/^\//, '');
    return isImage
      ? `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${clean}`
      : `https://github.com/${owner}/${repo}/blob/HEAD/${clean}`;
  };

  const lines = md.split('\n');
  let inFence = false;
  let fenceMarker = '';
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s*(```+|~~~+)/);
    if (fence) {
      const c = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = c;
      } else if (c === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }
    if (inFence) continue;

    // Inline links and images: [text](target) / ![alt](target)
    lines[i] = lines[i].replace(
      /(!?)\[([^\]]*)\]\(\s*(<)?([^)\s>]+)(>)?(\s+"[^"]*"|\s+'[^']*')?\s*\)/g,
      (full, bang, text, _lt, target, _gt, title) => {
        const abs = toAbs(target, bang === '!');
        return abs === target ? full : `${bang}[${text}](${abs}${title || ''})`;
      },
    );
    // Reference-style link definitions: [label]: target
    lines[i] = lines[i].replace(
      /^(\s*\[[^\]]+\]:\s*)(<)?([^\s>]+)(>)?(.*)$/,
      (full, pre, _lt, target, _gt, post) => {
        const abs = toAbs(target, false);
        return abs === target ? full : `${pre}${abs}${post}`;
      },
    );
    // Raw HTML href/src attributes (READMEs often use <img src="assets/…">)
    lines[i] = lines[i].replace(
      /\b(href|src)=("|')([^"']+)\2/gi,
      (full, attr, q, target) => {
        const abs = toAbs(target, attr.toLowerCase() === 'src');
        return abs === target ? full : `${attr}=${q}${abs}${q}`;
      },
    );
  }
  return lines.join('\n');
}

/**
 * Max rendered README length on a listing page. Upstream READMEs mirror content
 * Google already indexed at the source and can run to hundreds of KB — shipping
 * all of it server-side both bloats the HTML (LCP/CWV) and dilutes the page's
 * unique-content ratio. Typical READMEs are well under this, so only the long
 * tail of giant docs is trimmed (with a "read the full README" link to source).
 */
const README_EXCERPT_CHARS = 10000;

/**
 * Returns a render-safe excerpt of a README. Cuts at a paragraph (or line)
 * boundary at/before `maxChars`, and re-balances code fences so a cut inside a
 * ``` / ~~~ block can't swallow the rest of the page. `truncated` tells the
 * caller to show a link to the full upstream README.
 */
export function truncateReadmeExcerpt(
  md: string | null | undefined,
  maxChars: number = README_EXCERPT_CHARS,
): { excerpt: string | null | undefined; truncated: boolean } {
  if (typeof md !== 'string' || md.length <= maxChars) {
    return { excerpt: md, truncated: false };
  }
  let cut = md.lastIndexOf('\n\n', maxChars);
  if (cut < maxChars * 0.5) {
    const nl = md.lastIndexOf('\n', maxChars);
    cut = nl > maxChars * 0.5 ? nl : maxChars;
  }
  let excerpt = md.slice(0, cut).trimEnd();
  const fences = excerpt.match(/^[ \t]*(```+|~~~+)/gm) || [];
  if (fences.length % 2 !== 0) {
    const marker = fences[fences.length - 1].trim().charAt(0);
    excerpt += `\n\n${marker.repeat(3)}`;
  }
  return { excerpt, truncated: true };
}

export function formatServerAsMarkdown(
  server: Server,
  readme?: string | null,
): string {
  // The mcpServers object key just needs to be a readable identifier, not a real
  // package name, so it's safe to slugify.
  const slug =
    (server.name.split('/').pop() || server.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mcp-server';
  const verifiedBadge =
    server.isOfficial || server.isPremium ? ' [Verified]' : '';
  const activeBadge = server.isVerifiedActive ? ' [Health: Active]' : '';

  let md = `# ${server.name}${verifiedBadge}${activeBadge}\n\n`;
  md += `**Category:** ${server.category}  \n`;
  md += `**Repository:** ${server.url}  \n`;
  if (typeof server.githubStars === 'number')
    md += `**GitHub Stars:** ${server.githubStars}  \n`;
  if (typeof server.npmDownloads === 'number')
    md += `**npm Downloads (last month):** ${server.npmDownloads}  \n`;
  md += `**Views:** ${publicViewCount(server)}  \n`;
  md += `**Installs:** ${server.copies || 0}  \n`;
  md += `**Upvotes:** ${server.upvotes || 0}  \n`;
  md += `**Directory Page:** https://allmcps.com/mcp/${server.id}\n\n`;

  md += `## Description\n${server.description}\n\n`;

  if (server.tools && server.tools.length > 0) {
    md += `## Tools\nCapabilities this server exposes over MCP:\n\n`;
    for (const tool of server.tools) {
      md += `- **${tool.name}**${tool.description ? ` — ${tool.description}` : ''}\n`;
    }
    md += `\n`;
  }

  // Prefer resolved install (cached README/description hint) over blind npx + name.
  const install = resolveInstallConfig({
    id: server.id,
    name: server.name,
    url: server.url,
    description: server.description,
    installKind: server.installKind,
    installCommand: server.installCommand,
    installArgs: server.installArgs,
    installPackage: server.installPackage,
    installConfidence: server.installConfidence,
  });

  const envVars = server.aiEnvVars || [];
  const confNote = installConfidenceNote(install);

  md += `## Claude Desktop Quick Installation\n`;
  if (isUnverifiedInstall(install)) {
    // Same rule as the listing page's config tabs: a package guessed from the
    // listing name may not exist or may be someone else's, so print no config.
    md += `No confirmed install details yet, so no config is published. Follow the setup steps in the repository above.\n\n`;
  } else if (install.kind === 'remote') {
    md += `Remote MCP endpoint (confidence: ${install.confidence}). ${confNote} Add as a URL/SSE server in your client:\n\n`;
    md += `\`\`\`json\n`;
    md += `"mcpServers": {\n`;
    md += `  "${slug}": {\n`;
    md += `    "url": "${install.url}"\n`;
    md += `  }\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
  } else {
    const argsJson = JSON.stringify(install.args);
    md += `${confNote} Uses \`${install.command}\` (confidence: ${install.confidence}):\n\n`;
    md += `\`\`\`json\n`;
    md += `"mcpServers": {\n`;
    md += `  "${slug}": {\n`;
    md += `    "command": "${install.command}",\n`;
    md += `    "args": ${argsJson}${envVars.length > 0 ? ',' : ''}\n`;
    if (envVars.length > 0) {
      md += `    "env": ${JSON.stringify(
        Object.fromEntries(envVars.map((v) => [v, ''])),
        null,
        2,
      )
        .split('\n')
        .join('\n    ')}\n`;
    }
    md += `  }\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
    if (envVars.length > 0) {
      md += `**Requires environment variables:** ${envVars.map((v) => `\`${v}\``).join(', ')} — the values above are empty placeholders; fill in real credentials before running (see the repository for what each one is for).\n\n`;
    }
  }

  const hasAiContent = Boolean(
    server.aiOverview || server.aiUseCases?.length || server.aiFeatures?.length,
  );

  if (server.aiDoc?.trim()) {
    // Prefer our own restructured writeup over dumping the upstream README — the
    // raw README is a duplicate of content Google already indexed at the source
    // (that mirror is what got these pages reranked). The full README lives at
    // the noindex /mcp/[id]/readme route for anyone who wants it.
    md += `## Documentation\n\n${server.aiDoc.trim()}\n\n`;
    md += `_Full upstream README: https://allmcps.com/mcp/${server.id}/readme_\n\n`;
  } else if (readme) {
    md += `## Documentation & README\n\n${absolutizeReadmeMarkdown(readme, server.url)}\n`;
  } else if (hasAiContent) {
    md += `## Documentation\n`;
    if (server.aiOverview) md += `${server.aiOverview}\n\n`;
    if (server.aiUseCases?.length) {
      md += `**Use cases:**\n`;
      for (const useCase of server.aiUseCases) md += `- ${useCase}\n`;
      md += `\n`;
    }
    if (server.aiFeatures?.length) {
      md += `**Key features:**\n`;
      for (const feature of server.aiFeatures) md += `- ${feature}\n`;
      md += `\n`;
    }
    md += `_Summarized from the repository README — see the link above for the full text._\n\n`;
  } else {
    md += `## Documentation\nNo cached documentation available for this listing yet. Check the repository above for the README and setup instructions.\n\n`;
  }

  return md;
}

/**
 * One-line markdown summary for a server, with no network I/O — safe to call for every
 * listing on a category page. Contrast with formatServerAsMarkdown, which fetches the
 * README and is only used for single-listing pages.
 */
export function formatServerSummaryLine(server: Server): string {
  const bits: string[] = [];
  if (typeof server.githubStars === 'number')
    bits.push(`⭐ ${server.githubStars.toLocaleString()}`);
  if (server.copies) bits.push(`${server.copies.toLocaleString()} installs`);
  const meta = bits.length ? ` (${bits.join(' · ')})` : '';
  return `- [${server.name}](https://allmcps.com/mcp/${server.id})${meta} — ${server.description}`;
}

/**
 * Cap on the same-category candidate pool loaded for related/alternative ranking.
 *
 * This query used to be unbounded — every active listing in the category. That was
 * survivable when the catalog was ~3200 rows spread over the category list (see the
 * OOM history on extractSemanticTokens and getActiveServersForScoring), and it is not
 * now: "💻 Developer Tools" alone holds >13k active listings, and a compare page runs
 * this once per side. Two ~13k-row result sets, each normalized into full Server
 * objects and then given a semantic token Set apiece, is what pushed
 * /mcp/[a]/vs/[b] over the Worker's memory limit (outcome: exceededMemory, ~4s wall
 * time at 31ms CPU — the time is D1 handing back rows, not us scoring them).
 *
 * The pool is ordered by engagement before it is cut, mirroring how the
 * cross-category fallback below already picks its 30 candidates. The trade-off is
 * real and worth stating: a semantically perfect but completely unengaged listing
 * deep in a 13k-row category can no longer surface as "related". Callers only ever
 * take 4-8 results, so the ranking still has two orders of magnitude of headroom to
 * work with, and a page that renders beats a page that OOMs.
 */
const RELATED_CANDIDATE_POOL = 300;

/** Cross-category candidates considered when the same category is too small. */
const RELATED_FALLBACK_POOL = 30;

/**
 * Most tools per candidate that related ranking reads. Tool overlap and the
 * semantic token set both walk every tool, and a few listings carry hundreds
 * (one has 987), so an uncapped outlier in the pool costs a large JSON string,
 * an object per tool and a big token Set. Past the first couple hundred tools
 * the overlap/similarity signal is already saturated for ranking purposes.
 */
const RELATED_TOOLS_CAP = 200;

/**
 * extractSemanticTokens reads at most 2000 chars of any one text field, so
 * longer text is truncated in SQLite. Descriptions get headroom because
 * cleanListingDescription strips README chrome before the slice.
 */
const RELATED_TEXT_CHARS = 2000;
const RELATED_DESCRIPTION_CHARS = 4000;

/**
 * Tool names and descriptions only (no parameter schemas), capped at
 * RELATED_TOOLS_CAP tools and truncated to what the tokenizer reads, built in
 * SQLite so the full tools JSON never reaches the Worker heap.
 */
const RELATED_TOOLS_SQL = sql<
  string | null
>`CASE WHEN json_valid(${serversTable.tools}) THEN (
  SELECT json_group_array(json_object('name', json_extract(je.value, '$.name'), 'description', substr(json_extract(je.value, '$.description'), 1, ${RELATED_TEXT_CHARS})))
  FROM (SELECT value FROM json_each(${serversTable.tools}) LIMIT ${RELATED_TOOLS_CAP}) AS je
) ELSE NULL END`;

/**
 * Only the columns relatedRankingScore reads (engagement, install readiness,
 * trust flags, and the text/tool/tag/env-var fields it compares), with long
 * text truncated to what it reads. The pool is 300 rows per call and a compare
 * page ranks two pools, so carrying full public rows (aiOverview, pricing,
 * install fields, the whole tools JSON) for every candidate is what kept
 * /mcp/[a]/vs/[b] and /mcp/[id]/alternatives over the Worker memory limit.
 * Only the handful of winners are hydrated into full rows afterwards.
 */
const RELATED_RANKING_COLUMNS = {
  id: serversTable.id,
  name: serversTable.name,
  category: serversTable.category,
  description: sql<string>`substr(${serversTable.description}, 1, ${RELATED_DESCRIPTION_CHARS})`,
  aiSummary: sql<
    string | null
  >`substr(${serversTable.aiSummary}, 1, ${RELATED_TEXT_CHARS})`,
  aiOverview: sql<
    string | null
  >`substr(${serversTable.aiOverview}, 1, ${RELATED_TEXT_CHARS})`,
  tags: serversTable.tags,
  aiUseCases: serversTable.aiUseCases,
  aiFeatures: serversTable.aiFeatures,
  aiEnvVars: serversTable.aiEnvVars,
  tools: RELATED_TOOLS_SQL,
  installConfidence: serversTable.installConfidence,
  isOfficial: serversTable.isOfficial,
  isPremium: serversTable.isPremium,
  isVerifiedActive: serversTable.isVerifiedActive,
  healthStatus: serversTable.healthStatus,
  reciprocalBadgeOk: serversTable.reciprocalBadgeOk,
  views: serversTable.views,
  totalViews: serversTable.totalViews,
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
  githubStars: serversTable.githubStars,
  npmDownloads: serversTable.npmDownloads,
} as const;

/**
 * Engagement-ordered slim ranking candidates other than `current`, either from
 * its own category or (fallback) from every other one. Empty on a D1 error:
 * related listings are a garnish and must not break the page.
 */
async function getRelatedRankingCandidates(
  db: D1Drizzle,
  current: Server,
  sameCategory: boolean,
  poolLimit: number,
): Promise<Server[]> {
  try {
    const rows = await db
      .select(RELATED_RANKING_COLUMNS)
      .from(serversTable)
      .where(
        and(
          servableFilter(),
          sameCategory
            ? eq(serversTable.category, current.category)
            : ne(serversTable.category, current.category),
          ne(serversTable.id, current.id),
        ),
      )
      .orderBy(
        desc(serversTable.views),
        desc(serversTable.copies),
        desc(serversTable.upvotes),
      )
      .limit(poolLimit);
    return rows.map((r) => normalizeServer(r as unknown as Server));
  } catch (_e) {
    return [];
  }
}

/** `candidates` best-first against `current`, scoring each candidate once. */
function rankRelated(candidates: Server[], current: Server): Server[] {
  return candidates
    .map((s) => ({ s, score: relatedRankingScore(s, current) }))
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s);
}

/** Related listings from the bundled snapshot, for when D1 is unavailable. */
function getRelatedFromSnapshot(
  currentServer: Server,
  limit: number,
): Server[] {
  const all = snapshotCatalogServers();
  // Slice before normalizing: normalizeServer parses each row's JSON columns, so
  // mapping the whole category first would allocate exactly what the cap avoids.
  const sameCategory = all
    .filter(
      (s) => s.id !== currentServer.id && s.category === currentServer.category,
    )
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, RELATED_CANDIDATE_POOL)
    .map(normalizeServer);
  const ranked = rankRelated(sameCategory, currentServer).slice(0, limit);
  if (ranked.length >= limit) return ranked;
  const fallback = all
    .filter(
      (s) => s.id !== currentServer.id && s.category !== currentServer.category,
    )
    .slice(0, RELATED_FALLBACK_POOL)
    .map(normalizeServer);
  return [...ranked, ...rankRelated(fallback, currentServer)].slice(0, limit);
}

/**
 * The `limit` listings most related to `currentServer`: engagement-capped
 * same-category pool first, topped up from other categories when that runs
 * short. Ranks slim rows, then hydrates only the winners.
 */
export async function getRelatedServers(
  currentServer: Server,
  limit = 4,
): Promise<Server[]> {
  const searchDb = await getSearchDb();
  if (!searchDb) return getRelatedFromSnapshot(currentServer, limit);
  const { db } = searchDb;

  let ranked = rankRelated(
    await getRelatedRankingCandidates(
      db,
      currentServer,
      true,
      RELATED_CANDIDATE_POOL,
    ),
    currentServer,
  ).slice(0, limit);
  if (ranked.length < limit) {
    const fallback = await getRelatedRankingCandidates(
      db,
      currentServer,
      false,
      RELATED_FALLBACK_POOL,
    );
    ranked = [...ranked, ...rankRelated(fallback, currentServer)].slice(
      0,
      limit,
    );
  }
  if (ranked.length === 0) return getRelatedFromSnapshot(currentServer, limit);

  try {
    // Full public rows (tools trimmed) for just the winners, in ranked order.
    return await hydrateSearchResults(
      db,
      ranked.map((s) => s.id),
    );
  } catch (_e) {
    return ranked;
  }
}

/** Paid/featured listings eligible to rotate into promotional ad slots, excluding the given server. */
export async function getFeaturedServers(
  excludeId?: string,
  limit = 10,
): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      // One query per index (idx_servers_status_premium_popularity / _featured_until):
      // as a single `is_premium OR featured_until` filter SQLite scanned every
      // active listing on each page render to find a handful of rows.
      const select = (match: SQL) =>
        db
          .select(SCORING_SERVER_COLUMNS)
          .from(serversTable)
          .where(
            and(
              servableFilter(),
              match,
              excludeId ? ne(serversTable.id, excludeId) : undefined,
            ),
          )
          .limit(limit);
      const [premium, featured] = await Promise.all([
        select(eq(serversTable.isPremium, true)),
        // featured_until is unix seconds; it used to be compared to the text
        // CURRENT_TIMESTAMP, which SQLite sorts above every integer — never true.
        select(gt(serversTable.featuredUntil, new Date())),
      ]);
      const byId = new Map(
        [...premium, ...featured].map((r) => [r.id, r] as const),
      );
      if (byId.size > 0) {
        return [...byId.values()]
          .slice(0, limit)
          .map((r) => normalizeServer(r as unknown as Server));
      }
    }
  } catch (_e) {
    // Fall back to static JSON
  }

  return snapshotCatalogServers()
    .map(normalizeServer)
    .filter((s) => s.id !== excludeId && isFeaturedListing(s))
    .slice(0, limit);
}
