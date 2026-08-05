import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';
import { isFeaturedListing } from './featuredStatus';
import { cleanListingDescription } from './description';
import { engagementScore, buildAiSearchText } from './search';
import { resolveInstallConfig } from './installConfig';
import { parseStringArray } from './aiContent';

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
  const s = server as { aiUseCases?: unknown; aiFeatures?: unknown };
  return {
    ...server,
    description: cleanListingDescription(server.description),
    tools: parseServerTools((server as { tools?: unknown }).tools),
    // AI content JSON-array columns → typed arrays (absent in the static snapshot → []).
    aiUseCases: parseStringArray(s.aiUseCases),
    aiFeatures: parseStringArray(s.aiFeatures),
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
  tools: serversTable.tools,
  aiSummary: serversTable.aiSummary,
  aiOverview: serversTable.aiOverview,
  aiUseCases: serversTable.aiUseCases,
  aiFeatures: serversTable.aiFeatures,
  aiEnrichedAt: serversTable.aiEnrichedAt,
  installKind: serversTable.installKind,
  installCommand: serversTable.installCommand,
  installArgs: serversTable.installArgs,
  installPackage: serversTable.installPackage,
  installConfidence: serversTable.installConfidence,
  views: serversTable.views,
  copies: serversTable.copies,
  upvotes: serversTable.upvotes,
  createdAt: serversTable.createdAt,
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
  /** Parsed by normalizeServer from the `tools` JSON column. */
  tools?: ServerTool[];
  /** LLM-generated content layer (see lib/aiContent + /api/cron/ai-content). */
  aiSummary?: string | null;
  aiOverview?: string | null;
  /** Parsed by normalizeServer from the `ai_use_cases` / `ai_features` JSON columns. */
  aiUseCases?: string[];
  aiFeatures?: string[];
  aiEnrichedAt?: string | Date | null;
  installKind?: string | null;
  installCommand?: string | null;
  installArgs?: string | string[] | null;
  installPackage?: string | null;
  installConfidence?: string | null;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt: string | Date;
};

export async function getActiveServers(): Promise<Server[]> {
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
}

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
  installConfidence: string | null;
  toolText: string | null;
  aiText: string | null;
  views: number;
  copies: number;
  upvotes: number;
  createdAt: string | Date | null;
};

/** Max length of the client-side AI search blob — matches the old feed bound. */
const FEED_AI_TEXT_MAX = 320;
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
 * `aiUseCases`/`aiFeatures` arrive as JSON-array *strings* (the columns store JSON);
 * we strip the structural punctuation so only the human-readable words feed search.
 */
function feedAiTextFromRaw(
  summary?: string | null,
  overview?: string | null,
  useCases?: string | null,
  features?: string | null
): string | null {
  const clean = (v?: string | null) => (v || '').replace(/["[\]{}]/g, ' ');
  const text = [summary || '', overview || '', clean(useCases), clean(features)]
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
          installConfidence: serversTable.installConfidence,
          tools: serversTable.tools,
          views: serversTable.views,
          copies: serversTable.copies,
          upvotes: serversTable.upvotes,
          createdAt: serversTable.createdAt,
          // Cap the heavy AI-content columns in SQL so a page stays small even
          // when individual overviews/use-case lists are long.
          aiSummary: sql<string | null>`substr(${serversTable.aiSummary}, 1, ${FEED_AI_TEXT_MAX})`,
          aiOverview: sql<string | null>`substr(${serversTable.aiOverview}, 1, ${FEED_AI_TEXT_MAX})`,
          aiUseCases: sql<string | null>`substr(${serversTable.aiUseCases}, 1, ${FEED_AI_TEXT_MAX})`,
          aiFeatures: sql<string | null>`substr(${serversTable.aiFeatures}, 1, ${FEED_AI_TEXT_MAX})`,
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
        installConfidence: r.installConfidence ?? null,
        toolText: feedToolText(r.tools),
        aiText: feedAiTextFromRaw(r.aiSummary, r.aiOverview, r.aiUseCases, r.aiFeatures),
        views: r.views ?? 0,
        copies: r.copies ?? 0,
        upvotes: r.upvotes ?? 0,
        createdAt: r.createdAt ?? null,
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
      installConfidence: s.installConfidence ?? null,
      toolText,
      aiText: buildAiSearchText(s, FEED_AI_TEXT_MAX),
      views: s.views ?? 0,
      copies: s.copies ?? 0,
      upvotes: s.upvotes ?? 0,
      createdAt: s.createdAt ?? null,
    };
  });
  return { items, total };
}

/** Epoch millis for a listing timestamp, tolerant of strings/Dates/nulls. */
function toEpoch(v: unknown): number {
  const t = new Date(v as string | number | Date).getTime();
  return Number.isNaN(t) ? 0 : t;
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

/**
 * Ranking signal for related/similar listings.
 * Engagement + install readiness + tool overlap with the current page.
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

  if (current?.tools?.length && candidate.tools?.length) {
    const currentNames = new Set(
      current.tools.map((t) => t.name.toLowerCase()).filter(Boolean)
    );
    let overlap = 0;
    for (const t of candidate.tools) {
      if (currentNames.has(t.name.toLowerCase())) overlap += 1;
    }
    score += overlap * 10;
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

  md += `## Claude Desktop Quick Installation\n`;
  if (install.kind === 'remote') {
    md += `Remote MCP endpoint (confidence: ${install.confidence}). Add as a URL/SSE server in your client:\n\n`;
    md += `\`\`\`json\n`;
    md += `"mcpServers": {\n`;
    md += `  "${slug}": {\n`;
    md += `    "url": "${install.url}"\n`;
    md += `  }\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
  } else {
    const confNote =
      install.confidence === 'high'
        ? 'Install path detected from listing signals.'
        : install.confidence === 'medium'
          ? 'Install path inferred — verify against the README before production use.'
          : 'Heuristic fallback — verify the package name and runner against the repository README.';
    const argsJson = JSON.stringify(install.args);
    md += `${confNote} Uses \`${install.command}\` (confidence: ${install.confidence}):\n\n`;
    md += `\`\`\`json\n`;
    md += `"mcpServers": {\n`;
    md += `  "${slug}": {\n`;
    md += `    "command": "${install.command}",\n`;
    md += `    "args": ${argsJson}\n`;
    md += `  }\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
  }

  if (readme) {
    md += `## Documentation & README\n\n${readme}\n`;
  } else {
    md += `## Documentation\nNo README could be fetched automatically. Check the repository above for setup instructions before installing.\n\n`;
  }

  return md;
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
