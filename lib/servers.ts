import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';
import { isFeaturedListing } from './featuredStatus';

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
  status: serversTable.status,
  lastCheckedAt: serversTable.lastCheckedAt,
  isVerifiedActive: serversTable.isVerifiedActive,
  healthStatus: serversTable.healthStatus,
  reciprocalBadgeOk: serversTable.reciprocalBadgeOk,
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
  logoUrl?: string | null;
  isPremium?: boolean;
  featuredUntil?: string | Date | null;
  status: string;
  lastCheckedAt?: string | Date | null;
  isVerifiedActive?: boolean;
  healthStatus?: string;
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
  return servers;
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
        return dbServers[0] as unknown as Server;
      }
    }
  } catch (e) {
    // Fall back to static JSON
  }
  const servers = serversData as unknown as Server[];
  return servers.find((s) => s.id === id);
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

export function formatServerAsMarkdown(server: Server, readme?: string | null): string {
  // The mcpServers object key just needs to be a readable identifier, not a real
  // package name, so it's safe to slugify. The npx arg below uses server.name
  // verbatim since that's typically the actual publishable package name
  // (e.g. "@agentfund/mcp") and slugifying it would silently produce a
  // nonexistent package (e.g. "-agentfund-mcp").
  const slug = (server.name.split('/').pop() || server.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mcp-server';
  const verifiedBadge = server.isOfficial || server.isPremium ? ' [Verified]' : '';
  const activeBadge = server.isVerifiedActive ? ' [Health: Active]' : '';

  let md = `# ${server.name}${verifiedBadge}${activeBadge}\n\n`;
  md += `**Category:** ${server.category}  \n`;
  md += `**Repository:** ${server.url}  \n`;
  md += `**Views:** ${server.views || 0}  \n`;
  md += `**Installs:** ${server.copies || 0}  \n`;
  md += `**Upvotes:** ${server.upvotes || 0}  \n`;
  md += `**Directory Page:** https://allmcps.com/mcp/${server.id}\n\n`;

  md += `## Description\n${server.description}\n\n`;

  md += `## Claude Desktop Quick Installation\n`;
  md += `This assumes the package is published to npm and installable via \`npx\`. Verify against the README/repository below first — some servers require Python (\`uvx\`), Docker, or other manual setup instead:\n\n`;
  md += `\`\`\`json\n`;
  md += `"mcpServers": {\n`;
  md += `  "${slug}": {\n`;
  md += `    "command": "npx",\n`;
  md += `    "args": ["-y", "${server.name}"]\n`;
  md += `  }\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;

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

  sameCategory.sort((a, b) => {
    const scoreA = (a.upvotes || 0) * 5 + (a.copies || 0) + (a.views || 0) * 0.05;
    const scoreB = (b.upvotes || 0) * 5 + (b.copies || 0) + (b.views || 0) * 0.05;
    return scoreB - scoreA;
  });

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const otherServers = allServers.filter(
    (s) => s.id !== currentServer.id && s.category !== currentServer.category
  );
  otherServers.sort((a, b) => {
    const scoreA = (a.upvotes || 0) * 5 + (a.copies || 0) + (a.views || 0) * 0.05;
    const scoreB = (b.upvotes || 0) * 5 + (b.copies || 0) + (b.views || 0) * 0.05;
    return scoreB - scoreA;
  });

  return [...sameCategory, ...otherServers].slice(0, limit);
}

/** Paid/featured listings eligible to rotate into promotional ad slots, excluding the given server. */
export async function getFeaturedServers(excludeId?: string, limit = 10): Promise<Server[]> {
  const allServers = await getActiveServers();
  return allServers.filter((s) => s.id !== excludeId && isFeaturedListing(s)).slice(0, limit);
}
