import { cache } from 'react';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable, stdioVerificationPilot } from '../db/schema';
import { eq, desc, sql, and, ne } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';
import { isFeaturedListing } from './featuredStatus';
import { cleanListingDescription } from './description';
import { engagementScore, buildAiSearchText } from './search';
import { resolveInstallConfig, installConfidenceNote } from './installConfig';
import { parseStringArray, parseFaqArray, type AiFaqItem } from './aiContent';

export type ServerTool = { name: string; description?: string; parameters?: Record<string, unknown> };

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

/**
 * Normalizes a raw listing so downstream consumers never see scraped README chrome.
 * Returns a shallow copy — the imported JSON module is shared across requests and
 * must not be mutated in place. Also parses the `tools` JSON column into an array.
 */
function normalizeServer<T extends { description?: string | null; tools?: unknown }>(server: T): T {
  const s = server as {
    aiUseCases?: unknown;
    aiFeatures?: unknown;
    aiEnvVars?: unknown;
    aiFaq?: unknown;
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
    aiFaq: parseFaqArray(s.aiFaq),
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
 * reviewPriority, claimedAt, badgeLastCheckedAt — never bare `db.select()` a
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
  aiEnvVars: serversTable.aiEnvVars,
  aiEnrichedAt: serversTable.aiEnrichedAt,
  installKind: serversTable.installKind,
  installCommand: serversTable.installCommand,
  installArgs: serversTable.installArgs,
  installPackage: serversTable.installPackage,
  installConfidence: serversTable.installConfidence,
  installExtractedAt: serversTable.installExtractedAt,
  views: serversTable.views,
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
} as const;

export type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
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
  reciprocalBadgeOk?: boolean;
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
  /** LLM-generated content layer (see lib/aiContent + /api/cron/ai-content). */
  aiSummary?: string | null;
  aiOverview?: string | null;
  /** Parsed by normalizeServer from the `ai_use_cases` / `ai_features` / `ai_env_vars` JSON columns. */
  aiUseCases?: string[];
  aiFeatures?: string[];
  /** Parsed by normalizeServer from the `ai_faq` JSON column. Empty until the
   * ai-content/ai-faq cron has generated it — pages fall back to boilerplate. */
  aiFaq?: AiFaqItem[];
  /** UPPER_SNAKE_CASE env var names the README/setup instructions say are required to run this server. */
  aiEnvVars?: string[];
  aiEnrichedAt?: string | Date | null;
  installKind?: string | null;
  installCommand?: string | null;
  installArgs?: string | string[] | null;
  installPackage?: string | null;
  installConfidence?: string | null;
  /** When the LLM last validated/void'd the install fields above. See installExtractedAt in db/schema.ts. */
  installExtractedAt?: string | Date | null;
  views?: number;
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
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
} as const;

/**
 * Lightweight full-catalog scan for homepage discovery: marquee/featured
 * ranking, category counts, total count. Deliberately excludes `tools` and
 * the AI-content columns — those can be several KB per listing (introspected
 * tool schemas, generated overviews), and loading them for every active
 * listing just to rank ~20 cards out of thousands risks tripping the
 * Worker's memory limit. Same reasoning as getDirectoryFeedPage's column
 * sharding for /browse; the homepage needs the same treatment because it
 * scans the whole catalog too (for counts/ranking), not just its own page.
 */
export async function getActiveServersLight(): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(DISCOVERY_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.status, 'active'));
      if (rows.length > 0) {
        return rows.map((r) => ({ ...r, description: cleanListingDescription(r.description) })) as unknown as Server[];
      }
    }
  } catch (e) {
    // Fall back to static JSON
  }
  return (serversData as unknown as Server[]).map((s) => ({
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
    copies: s.copies ?? 0,
    upvotes: s.upvotes ?? 0,
  })) as unknown as Server[];
}

/**
 * Newest N active listings with full detail (tools, AI content, install
 * hints) — sorted and capped at the DB level so we never have to pull and
 * parse the entire catalog in the Worker just to keep the first 48.
 */
export async function getNewestActiveServers(limit: number): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.status, 'active'))
        .orderBy(desc(serversTable.createdAt))
        .limit(limit);
      if (rows.length > 0) {
        return rows.map((r) => normalizeServer(r as unknown as Server));
      }
    }
  } catch (e) {
    // Fall back to static JSON
  }
  return (serversData as unknown as Server[])
    .map(normalizeServer)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))
    .slice(0, limit);
}

/**
 * Full active-catalog scan (thousands of rows, every column). Wrapped in React's
 * `cache()` so multiple call sites within the same request/render (e.g. a detail
 * page's related-servers and featured-servers lookups both need it) share one
 * D1 query + normalize pass instead of each re-scanning the whole table.
 */
export const getActiveServers = cache(async (): Promise<Server[]> => {
  let servers = serversData as unknown as Server[];
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.status, 'active'));
      if (dbServers.length > 0) {
        servers = dbServers as unknown as Server[];
      }
    }
  } catch (e) {
    // Fall back to static JSON
  }
  return servers.map(normalizeServer);
});

/**
 * Slim listing shape powering the /browse client feed. Only the fields the
 * directory grid actually reads for search/sort/filter/render — the heavy AI
 * text is pre-collapsed into a single bounded `aiText` blob so pages stay small.
 */
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
  faq?: string | null
): string | null {
  const clean = (v?: string | null) => (v || '').replace(/["[\]{}]/g, ' ');
  // FAQ JSON keys (`q`/`a`) would otherwise leak into the blob as noise tokens.
  const cleanFaq = (v?: string | null) => clean(v).replace(/\b[qa]\s*:/gi, ' ');
  // FAQ after use-cases so intent-shaped questions contribute before features fill the cap.
  const text = [summary || '', overview || '', clean(useCases), cleanFaq(faq), clean(features)]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > FEED_AI_TEXT_MAX ? text.slice(0, FEED_AI_TEXT_MAX) : text;
}

/**
 * One page of the public directory feed for the /browse client grid.
 *
 * The full catalog is thousands of listings; pulling every row's full AI-content
 * columns in a single query loads several MB into the Worker/D1 isolate at once,
 * which can trip D1's per-query memory/CPU limits and leave the browse grid stuck
 * on its initial slice. So we *shard*: select only the columns the grid reads,
 * cap the AI text at the SQL level, and page with LIMIT/OFFSET. The client walks
 * the pages until `nextOffset` is null, assembling the whole catalog reliably.
 */
export async function getDirectoryFeedPage(
  offset: number,
  limit: number
): Promise<{ items: DirectoryFeedItem[]; total: number }> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
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
          aiSummary: sql<string | null>`substr(${serversTable.aiSummary}, 1, ${FEED_AI_TEXT_MAX})`,
          aiOverview: sql<string | null>`substr(${serversTable.aiOverview}, 1, ${FEED_AI_TEXT_MAX})`,
          aiUseCases: sql<string | null>`substr(${serversTable.aiUseCases}, 1, ${FEED_AI_TEXT_MAX})`,
          aiFeatures: sql<string | null>`substr(${serversTable.aiFeatures}, 1, ${FEED_AI_TEXT_MAX})`,
          aiFaq: sql<string | null>`substr(${serversTable.aiFaq}, 1, ${FEED_AI_TEXT_MAX})`,
        })
        .from(serversTable)
        .where(eq(serversTable.status, 'active'))
        // Deterministic order (newest first, id tiebreaker) keeps paging stable.
        .orderBy(desc(serversTable.createdAt), desc(serversTable.id))
        .limit(limit)
        .offset(offset);

      const totalRow = await db
        .select({ c: sql<number>`count(*)` })
        .from(serversTable)
        .where(eq(serversTable.status, 'active'));
      const total = Number(totalRow[0]?.c ?? rows.length);

      const items: DirectoryFeedItem[] = rows.map((r) => ({
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
        aiText: feedAiTextFromRaw(r.aiSummary, r.aiOverview, r.aiUseCases, r.aiFeatures, r.aiFaq),
        views: r.views ?? 0,
        copies: r.copies ?? 0,
        upvotes: r.upvotes ?? 0,
        createdAt: r.createdAt ?? null,
        tags: parseStringArray(r.tags),
        pricingModel: r.pricingModel ?? null,
        authType: r.authType ?? null,
        compatibleClients: parseStringArray(r.compatibleClients),
      }));

      return { items, total };
    }
  } catch (e) {
    // Fall back to the static JSON snapshot below.
  }

  // Static fallback (local dev / DB unavailable): page the bundled snapshot with
  // the same newest-first ordering so behavior matches production.
  const all = (serversData as unknown as Server[])
    .map(normalizeServer)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
  const total = all.length;
  const items: DirectoryFeedItem[] = all.slice(offset, offset + limit).map((s) => {
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
export async function checkIsOwner(id: string, userId: string): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({ ownerUserId: serversTable.ownerUserId })
        .from(serversTable)
        .where(eq(serversTable.id, id))
        .limit(1);
      return rows[0]?.ownerUserId === userId;
    }
  } catch (e) {}
  return false;
}

export async function getServerById(id: string): Promise<Server | undefined> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
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
    // Fall back to static JSON
  }
  const servers = serversData as unknown as Server[];
  const found = servers.find((s) => s.id === id);
  return found ? normalizeServer(found) : undefined;
}

export type StdioPilotResult = {
  status: 'ok' | 'install_failed' | 'handshake_failed' | 'timeout' | 'error';
  toolCount: number | null;
  error: string | null;
  durationMs: number | null;
  checkedAt: string | Date;
};

/**
 * Latest E2B sandbox verification attempt for a listing, if any (see the
 * e2b-stdio-pilot GitHub Actions workflow). Deliberately separate from
 * tools/toolsSource — this surfaces the *attempt*, friendly and non-alarming,
 * so a submitter/owner can see exactly what we tried and why it didn't
 * confirm, without us asserting the listing is broken (false negatives from
 * missing env vars, slow cold installs, etc. are expected).
 */
export async function getStdioPilotResult(serverId: string): Promise<StdioPilotResult | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env || !(ctx.env as any).DB) return null;
    const db = drizzle((ctx.env as any).DB);
    const rows = await db
      .select({
        status: stdioVerificationPilot.status,
        toolCount: stdioVerificationPilot.toolCount,
        error: stdioVerificationPilot.error,
        durationMs: stdioVerificationPilot.durationMs,
        checkedAt: stdioVerificationPilot.checkedAt,
      })
      .from(stdioVerificationPilot)
      .where(and(eq(stdioVerificationPilot.serverId, serverId), ne(stdioVerificationPilot.status, 'pending')))
      .orderBy(desc(stdioVerificationPilot.checkedAt))
      .limit(1);
    return (rows[0] as StdioPilotResult) ?? null;
  } catch {
    return null;
  }
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

    let res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`, {
        next: { revalidate: 3600 },
      });
    }

    if (res.ok) {
      return await res.text();
    }
    return null;
  } catch (e) {
    return null;
  }
}

const COMMON_STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'server', 'mcp', 'model', 'context', 'protocol', 'allow', 'allows', 'provides', 'using',
  'used', 'support', 'supports', 'client', 'clients', 'tools', 'tool', 'integration', 'official', 'service', 'https',
  'http', 'com', 'github', 'org', 'repo', 'package', 'npm', 'pypi', 'python', 'typescript', 'javascript'
]);

function extractSemanticTokens(s: Server): Set<string> {
  const tokens = new Set<string>();
  const add = (text?: string | null) => {
    if (!text) return;
    const words = text.toLowerCase().replace(/[^a-z0-9_\-\.]/g, ' ').split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && !COMMON_STOP_WORDS.has(w)) {
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
  if (Array.isArray(s.tools)) s.tools.forEach((t) => { add(t.name); add(t.description); });

  return tokens;
}

/**
 * Computes semantic Jaccard similarity index (0.0 to 1.0) based on rich server metadata tokens.
 */
export function computeServerSemanticSimilarity(a: Server, b: Server): number {
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

/**
 * Ranking signal for related/similar listings.
 * Engagement + install readiness + tool overlap + semantic text similarity with current page.
 * Exported so category pages stay consistent.
 */
export function relatedRankingScore(candidate: Server, current?: Server | null): number {
  let score = engagementScore(candidate);

  // Prefer listings with known install paths (higher install conversion).
  const conf = (candidate.installConfidence || '').toLowerCase();
  if (conf === 'high') score += 8;
  else if (conf === 'medium') score += 4;
  else if (conf === 'low') score += 1;

  if (candidate.isOfficial || candidate.isPremium) score += 5;
  if (candidate.websiteVerified) score += 2;
  if (candidate.isVerifiedActive || candidate.healthStatus === 'healthy') score += 3;
  if (candidate.reciprocalBadgeOk) score += 2;

  if (current) {
    // Semantic vector / text similarity score boost
    const semanticSim = computeServerSemanticSimilarity(current, candidate);
    score += semanticSim * 120;

    // Tool name overlap
    if (current.tools?.length && candidate.tools?.length) {
      const currentNames = new Set(
        current.tools.map((t) => t.name.toLowerCase()).filter(Boolean)
      );
      let overlap = 0;
      for (const t of candidate.tools) {
        if (currentNames.has(t.name.toLowerCase())) overlap += 1;
      }
      score += overlap * 12;
    }

    // Tag overlap
    if (current.tags?.length && candidate.tags?.length) {
      const currentTags = new Set(current.tags.map((t) => t.toLowerCase()));
      let tagOverlap = 0;
      for (const t of candidate.tags) {
        if (currentTags.has(t.toLowerCase())) tagOverlap += 1;
      }
      score += tagOverlap * 10;
    }

    // Shared environment variables (indicates same API/service family)
    if (current.aiEnvVars?.length && candidate.aiEnvVars?.length) {
      const currentEnvs = new Set(current.aiEnvVars.map((v) => v.toUpperCase()));
      let envOverlap = 0;
      for (const v of candidate.aiEnvVars) {
        if (currentEnvs.has(v.toUpperCase())) envOverlap += 1;
      }
      score += envOverlap * 15;
    }
  }

  return score;
}

export function formatServerAsMarkdown(server: Server, readme?: string | null): string {
  // The mcpServers object key just needs to be a readable identifier, not a real
  // package name, so it's safe to slugify.
  const slug = (server.name.split('/').pop() || server.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mcp-server';
  const verifiedBadge = server.isOfficial || server.isPremium ? ' [Verified]' : '';
  const activeBadge = server.isVerifiedActive ? ' [Health: Active]' : '';

  let md = `# ${server.name}${verifiedBadge}${activeBadge}\n\n`;
  md += `**Category:** ${server.category}  \n`;
  md += `**Repository:** ${server.url}  \n`;
  if (typeof server.githubStars === 'number') md += `**GitHub Stars:** ${server.githubStars}  \n`;
  if (typeof server.npmDownloads === 'number') md += `**npm Downloads (last month):** ${server.npmDownloads}  \n`;
  md += `**Views:** ${server.views || 0}  \n`;
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
  if (install.kind === 'remote') {
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
      md += `    "env": ${JSON.stringify(Object.fromEntries(envVars.map((v) => [v, ''])), null, 2).split('\n').join('\n    ')}\n`;
    }
    md += `  }\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
    if (envVars.length > 0) {
      md += `**Requires environment variables:** ${envVars.map((v) => `\`${v}\``).join(', ')} — the values above are empty placeholders; fill in real credentials before running (see the repository for what each one is for).\n\n`;
    }
  }

  const hasAiContent = Boolean(
    server.aiOverview || server.aiUseCases?.length || server.aiFeatures?.length
  );

  if (readme) {
    md += `## Documentation & README\n\n${readme}\n`;
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
  if (typeof server.githubStars === 'number') bits.push(`⭐ ${server.githubStars.toLocaleString()}`);
  if (server.copies) bits.push(`${server.copies.toLocaleString()} installs`);
  const meta = bits.length ? ` (${bits.join(' · ')})` : '';
  return `- [${server.name}](https://allmcps.com/mcp/${server.id})${meta} — ${server.description}`;
}

export async function getRelatedServers(currentServer: Server, limit = 4): Promise<Server[]> {
  const allServers = await getActiveServers();
  const sameCategory = allServers.filter(
    (s) => s.id !== currentServer.id && s.category === currentServer.category
  );

  sameCategory.sort(
    (a, b) => relatedRankingScore(b, currentServer) - relatedRankingScore(a, currentServer)
  );

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const otherServers = allServers.filter(
    (s) => s.id !== currentServer.id && s.category !== currentServer.category
  );
  otherServers.sort(
    (a, b) => relatedRankingScore(b, currentServer) - relatedRankingScore(a, currentServer)
  );

  return [...sameCategory, ...otherServers].slice(0, limit);
}

/** Paid/featured listings eligible to rotate into promotional ad slots, excluding the given server. */
export async function getFeaturedServers(excludeId?: string, limit = 10): Promise<Server[]> {
  const allServers = await getActiveServers();
  return allServers.filter((s) => s.id !== excludeId && isFeaturedListing(s)).slice(0, limit);
}
