import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';

export type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
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
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.status, 'active'));
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
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
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
  const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const officialBadge = server.isOfficial ? ' [Official]' : '';
  const activeBadge = server.isVerifiedActive ? ' [Verified Active]' : '';

  let md = `# ${server.name}${officialBadge}${activeBadge}\n\n`;
  md += `**Category:** ${server.category}  \n`;
  md += `**Repository:** ${server.url}  \n`;
  md += `**Upvotes:** ${server.upvotes || 0}  \n`;
  md += `**Directory Page:** https://allmcps.com/mcp/${server.id}\n\n`;

  md += `## Description\n${server.description}\n\n`;

  md += `## Claude Desktop Quick Installation\n`;
  md += `Add the following block to your \`claude_desktop_config.json\` under \`mcpServers\`:\n\n`;
  md += `\`\`\`json\n`;
  md += `"mcpServers": {\n`;
  md += `  "${installName}": {\n`;
  md += `    "command": "npx",\n`;
  md += `    "args": ["-y", "${installName}"]\n`;
  md += `  }\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;

  if (readme) {
    md += `## Documentation & README\n\n${readme}\n`;
  }

  return md;
}
